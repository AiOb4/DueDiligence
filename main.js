import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from "dotenv";
import ollama from "ollama";
import { parseDir, searchCodebase } from "./ipcModules/semanticSearch.js";
import { indexPolicies, askPolicyQuestion,loadPolicyIndexFromDisk,clearPolicyIndex,listPolicyDocs,removePolicyByDocName,} from "./ipcModules/policyQA.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const isDev = !app.isPackaged;

function getSccPath() {
  const binaryName = process.platform === 'win32' ? 'scc.exe' : 'scc';
  return path.join(app.isPackaged ? process.resourcesPath : __dirname, 'resources', 'scc', binaryName);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  try {
    const reloadResult = loadPolicyIndexFromDisk();
    console.log("Policy index reload on startup:", reloadResult);
  } catch (err) {
    console.error("Error reloading saved policy index:", err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('runCodeCounter', async (event , {dir}) => {
  const sccPath = getSccPath();
  
  try {
    // Run SCC command
    const { stdout } = await execPromise(`"${sccPath}" --format json "${dir}"`);

    // Parse JSON
    const data = JSON.parse(stdout);
    return { success: true, data };
  } catch (error) {
    console.error('SCC error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('indexDirectory', async (event , {dir}) => {
  
  try {
    // trying parser
    await parseDir(dir);
    return true;

  } catch (error) {
    console.error('Index error:', error);
    return false;
  }
});

ipcMain.handle('searchVector', async (event, { query }) => {
  const results = await searchCodebase(query);
  return results;
});

ipcMain.handle('selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  } else {
    return null;
  }
});

// Let the user choose policy files to upload
ipcMain.handle("policySelectFiles", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Policy files",
        extensions: ["txt", "md", "docx"],
      },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, filePaths: [] };
  }
  return { success: true, filePaths: result.filePaths };
});

// Build / refresh the policy embedding index from selected files
ipcMain.handle("policyIndexPolicies", async (event, { filePaths }) => {
  try {
    const summary = await indexPolicies(filePaths);
    return { success: true, ...summary };
  } catch (err) {
    console.error("policyIndexPolicies error:", err);
    return { success: false, error: err.message };
  }
});

// Answer a policy question using the indexed policies
ipcMain.handle("policyAskQuestion", async (event, { question }) => {
  try {
    const result = await askPolicyQuestion(question);
    return { success: true, ...result };
  } catch (err) {
    console.error("policyAskQuestion error:", err);
    return { success: false, error: err.message };
  }
});

// Returns a list of all currently indexed policy documents
ipcMain.handle("policyListPolicies", async () => {
  try {
    const result = listPolicyDocs();
    return result;
  } catch (err) {
    console.error("policyListPolicies error:", err);
    return { success: false, error: err.message };
  }
});

// Removes all chunks belonging to a specific policy document
ipcMain.handle("policyRemovePolicy", async (event, { docName }) => {
  try {
    if (!docName) {
      return { success: false, error: "docName is required" };
    }
    const result = removePolicyByDocName(docName);
    return { success: true, ...result };
  } catch (err) {
    console.error("policyRemovePolicy error:", err);
    return { success: false, error: err.message };
  }
});

// Clears the entire policy index
ipcMain.handle("policyClearIndex", async () => {
  try {
    const result = clearPolicyIndex();
    return { success: true, ...result };
  } catch (err) {
    console.error("policyClearIndex error:", err);
    return { success: false, error: err.message };
  }
});

const SYSTEMPROMPT = `
You are a member of a professional due diligence team. 
Your role is to collaborate with colleagues to evaluate companies, projects, and investments. 
Always respond as a knowledgeable, detail-oriented team member. 

Provide answers ONLY in structured bullet points, grouped into these sections:
- Key Facts  
- Opportunities  
- Risks  
- Open Questions / Assumptions  

After the bullet points, always include a **closing summary line** starting with:  
"Overall Assessment: ..."  

Keep responses concise and professional.  
If a section has no content, include it anyway with “None identified.”  
Maintain a neutral, factual tone suitable for internal team discussions.  
Do not write long paragraphs and do not break character as a team member.
`;

let chatHistory = [];

ipcMain.on('ollamaChatStream', async (event, {id, promptText}) => {

  const responseId = id + 1;

  try {
    const stream = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: SYSTEMPROMPT }, 
                  ...chatHistory,
                  { role: "user", content: promptText }],
      stream: true,
      keep_alive: 300
    });

    let fullResponse = "";
    for await (const part of stream) {
      const chunk = part?.message?.content ?? "";
      fullResponse += chunk;
      event.sender.send('ollamaChatChunk', { id: responseId, chunk: chunk }); // send token-by-token
    }

    // light weight context window
    // Keep only the last 10 messages
    // add prompt and response to context window
    chatHistory = chatHistory.slice(-10);
    chatHistory.push({ role: "user", content: promptText });
    chatHistory.push({ role: "assistant", content: fullResponse });

    // end stream
    event.sender.send("ollamaChatDone", { id: responseId }); 

  } catch (err) {
    console.error("Streaming error:", err);
    event.sender.send("ollamaChatChunk", { id: responseId, chunk: `\n\n[Error: ${err.message}]` });
    event.sender.send("ollamaChatDone", { id: responseId });
  }
});

ipcMain.on('ollamaEmbed', async (event, {promptText}) => {

  try {
    const data = await ollama.embeddings({ 
      model: 'nomic-embed-text', 
      prompt: promptText 
    })
    return { success: true, data };

  } catch (err) {
    console.error("Embedding error:", err);
    return { success: false, err };
  }
});