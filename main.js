import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from "dotenv";
import ollama from "ollama";
import { parseDir, searchCodebase } from "./ipcModules/semanticSearch.js";
import { indexPolicies, askPolicyQuestion, loadPolicyIndexFromDisk, clearPolicyIndex, listPolicyDocs, removePolicyByDocName } from "./ipcModules/policyQA.js";

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

  // ✅ POLICY QA: Load saved policy index on startup
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

// ✅ FIXED: Code counter with --by-file for full breakdown
ipcMain.handle('runCodeCounter', async (event, {dir}) => {
  const sccPath = getSccPath();
  
  try {
    // ✅ Add --by-file for directories + files breakdown like sample
    const { stdout } = await execPromise(`"${sccPath}" --format json --by-file "${dir}"`);
    const data = JSON.parse(stdout);
    return { success: true, data };
  } catch (error) {
    console.error('SCC error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('indexDirectory', async (event, {dir}) => {
  try {
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

// ✅ NEW POLICY QA IPC handlers
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

ipcMain.handle("policyIndexPolicies", async (event, { filePaths }) => {
  try {
    const summary = await indexPolicies(filePaths);
    return { success: true, ...summary };
  } catch (err) {
    console.error("policyIndexPolicies error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("policyAskQuestion", async (event, { question }) => {
  try {
    const result = await askPolicyQuestion(question);
    return { success: true, ...result };
  } catch (err) {
    console.error("policyAskQuestion error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("policyListPolicies", async () => {
  try {
    const result = listPolicyDocs();
    return result;
  } catch (err) {
    console.error("policyListPolicies error:", err);
    return { success: false, error: err.message };
  }
});

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
If a section has no content, include it anyway with "None identified."  
Maintain a neutral, factual tone suitable for internal team discussions.  
Do not write long paragraphs and do not break character as a team member.
`;

let chatHistory = [];

/// ✅ FIXED: Chat Stream - Use NEXT ID for Response
ipcMain.on('ollamaChatStream', async (event, {id, promptText}) => {
  console.log(`🚀 OLLAMA REQUEST: USER_ID=${id}, PROMPT="${promptText.slice(0,100)}..."`);
  
  const responseId = id + 1;
  console.log(`📡 Sending chunks to RESPONSE_ID=${responseId}`);
  
  try {
    const stream = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: SYSTEMPROMPT }, 
                 { role: "user", content: promptText }],
      stream: true,
      keep_alive: 300
    });

    let fullResponse = "";
    let chunkCount = 0;
    for await (const part of stream) {
      const chunk = part?.message?.content ?? "";
      if (chunk) {
        fullResponse += chunk;
        chunkCount++;
        console.log(`📦 Chunk ${chunkCount} [ID=${responseId}]: "${chunk}"`);
        event.sender.send('ollamaChatChunk', { id: responseId, chunk: chunk });
      }
    }

    console.log(`✅ OLLAMA COMPLETE: ${chunkCount} chunks, ${fullResponse.length} chars, ID=${responseId}`);
    
    chatHistory = chatHistory.slice(-10);
    chatHistory.push({ role: "user", content: promptText });
    chatHistory.push({ role: "assistant", content: fullResponse });

    event.sender.send("ollamaChatDone", { id: responseId }); 

  } catch (err) {
    console.error("Streaming error:", err);
    event.sender.send("ollamaChatChunk", { id: responseId, chunk: `\n\n[Error: ${err.message}]` });
    event.sender.send("ollamaChatDone", { id: responseId });
  }
});

ipcMain.handle('ollamaResponse', async (event, {sysPrompt, promptText}) => {
  
  try {
    const response = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: sysPrompt }, 
                 { role: "user", content: promptText }],
      keep_alive: 300
    });

    console.log(response.message);

    return { success: true, data: response.message.content };
  } catch (err) {
    console.error("Response error:", err);
    return { success: false, err };
  }
});

ipcMain.handle('ollamaEmbed', async (event, {promptText}) => {
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

// ✅ UPDATED REPORT GENERATION with full SCC breakdown support
ipcMain.handle('generateReport', async (event, { projectName, reportType, userId, data = {} }) => {
  try {
    if (!projectName || !userId) {
      return { success: false, error: 'Missing project name or user ID' };
    }

    const reportsDir = path.join(app.getPath('userData'), 'reports', userId);
    await fs.promises.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${reportType}_${timestamp}.txt`;
    const filepath = path.join(reportsDir, filename);

    const { rawSccData = [], docSummaries = [], codeSummary = {} } = data;
    
    console.log(`📊 Report: ${rawSccData.length} SCC langs, ${docSummaries.length} docs`);

    let reportContent = `Date : ${new Date().toLocaleString()}\n`;
    reportContent += `Directory : ${projectName}\n`;

    const sum = rawSccData.reduce((acc, lang) => ({
      files: (acc.files || 0) + (lang.Count || 0),
      code: (acc.code || 0) + (lang.Code || 0),
      comment: (acc.comment || 0) + (lang.Comment || 0),
      blank: (acc.blank || 0) + (lang.Blank || 0),
      total: (acc.total || 0) + ((lang.Code || 0) + (lang.Comment || 0) + (lang.Blank || 0))
    }), {});
    
    reportContent += `Total : ${sum.files} files,  ${sum.code} codes, ${sum.comment} comments, ${sum.blank} blanks, all ${sum.total} lines\n\n`;

    // Languages table
    reportContent += `Languages\n`;
    reportContent += `+------------+------------+------------+------------+------------+------------+\n`;
    reportContent += `|language    |files       |code        |comment     |blank       |total       |\n`;
    reportContent += `+------------+------------+------------+------------+------------+------------+\n`;
    
    rawSccData.forEach((lang) => {
      const total = (lang.Code || 0) + (lang.Comment || 0) + (lang.Blank || 0);
      reportContent += `|${pad(lang.Name || 'N/A', 10, true)}|${pad(lang.Count || 0, 10)}|${pad(lang.Code || 0, 10)}|${pad(lang.Comment || 0, 10)}|${pad(lang.Blank || 0, 10)}|${pad(total, 10)}|\n`;
    });
    
    reportContent += `+------------+------------+------------+------------+------------+------------+\n\n`;

    // Document review
    if (docSummaries.length > 0) {
      reportContent += `## 📄 Document Review (${docSummaries.length} docs)\n\n`;
      docSummaries.slice(0, 3).forEach((doc) => {
        reportContent += `**${doc.documentName}**\n${(doc.summary || '').slice(0, 300)}...\n\n`;
      });
    }

    const aiPrompt = `Professional due diligence assessment for ${projectName}:\n\n${JSON.stringify({sum, rawSccData: rawSccData.slice(0,5), docs: docSummaries.length})}\n\nFormat: ## AI Assessment\n### Key Findings\n### Risks\n### Recommendations`;
    
    const response = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: SYSTEMPROMPT }, { role: "user", content: aiPrompt }]
    });

    reportContent += `${response.message?.content || ''}\n\n`;
    reportContent += `---\nGenerated by Due Diligence AI Agent | Fellows Consulting Group`;

    await fs.promises.writeFile(filepath, reportContent, 'utf8');
    console.log(`✅ SCC Report generated: ${filepath}`);

    return { success: true, filename, filepath };
  } catch (err) {
    console.error('Report error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('downloadReport', async (event, { filepath }) => {
  try {
    if (!filepath || !fs.existsSync(filepath)) {
      return { success: false, error: 'Report file not found' };
    }

    const { filePath } = await dialog.showSaveDialog({
      defaultPath: path.basename(filepath),
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    
    if (!filePath) {
      return { success: false, error: 'Download cancelled by user' };
    }
    
    await fs.promises.copyFile(filepath, filePath);
    console.log(`Report downloaded to: ${filePath}`);
    
    return { success: true, savedAs: filePath };
  } catch (err) {
    console.error('Download error:', err);
    return { success: false, error: err.message };
  }
});

function pad(str, length, alignLeft = false) {
  str = String(str);
  if (str.length >= length) return str.slice(0, length);
  const padding = " ".repeat(length - str.length);
  return alignLeft ? str + padding : padding + str;
}
