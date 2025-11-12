import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from "dotenv";
import ollama from "ollama";
import { parseDir } from "./ipcModules/semanticSearch.js";

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
    const { stdout } = await execPromise(`"${sccPath}" --format json --by-file "${dir}"`);

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
    parseDir(dir);
    return true;

  } catch (error) {
    console.error('Index error:', error);
    return false;
  }
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

  try {
    const stream = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: SYSTEMPROMPT }, 
                  ...chatHistory,
                  { role: "user", content: promptText }],
      stream: true,
    });

    let fullResponse = "";
    for await (const part of stream) {
      const chunk = part?.message?.content ?? "";
      fullResponse += chunk;
      event.sender.send('ollamaChatChunk', { id, chunk }); // send token-by-token
    }

    // light weight context window
    // Keep only the last 10 messages
    // add prompt and response to context window
    chatHistory = chatHistory.slice(-10);
    chatHistory.push({ role: "user", content: promptText });
    chatHistory.push({ role: "assistant", content: fullResponse });

    // end stream
    event.sender.send("ollamaChatDone", { id }); 

  } catch (err) {
    console.error("Streaming error:", err);
    event.sender.send("ollamaChatChunk", { id, chunk: `\n\n[Error: ${err.message}]` });
    event.sender.send("ollamaChatDone", { id });
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