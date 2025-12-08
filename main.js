import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from 'fs';
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";
import ollama from "ollama";
import "./ipcModules/codeCounter.js";
import "./ipcModules/ollama.js";
import "./ipcModules/policyQA.js";
import "./ipcModules/semanticSearch.js";
import { loadPolicyIndexFromDisk } from "./ipcModules/policyQA.js";
import "./ipcModules/projectStorage.js";
import "./ipcModules/reportGenerator.js";
import { fileURLToPath } from "url";
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import unzipper from 'unzipper';

dotenv.config();
const isDev = !app.isPackaged;
let downloadWindow = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let ollamaExePath = null;

async function checkOllamaInstalled() {
  const installPath = path.join(app.getPath('userData'), 'ollama');
  ollamaExePath = path.join(installPath, 'ollama.exe');

  if (fs.existsSync(ollamaExePath)) {
    return ollamaExePath;
  }

  console.log("Downloading latest Ollama...");

  const url = process.platform === 'win32' ? "https://ollama.com/download/ollama-windows-amd64.zip" : "https://ollama.com/download/ollama-darwin.zip";
  const response = await fetch(url);

  const total = Number(response.headers.get("content-length"));
  let downloaded = 0;

  await pipeline(
    response.body.on("data", (chunk) => {
      downloaded += chunk.length;
      const percent = Math.floor((downloaded / total) * 100);
      sendProgress(`Downloading Ollama… ${percent}%`, percent);
    }),
    unzipper.Extract({ path: installPath })
  );

  console.log("Ollama installed.");
  return ollamaExePath;
}

async function pullModel(ollamaExePath, model) {
  return new Promise((resolve, reject) => {
    const child = spawn(ollamaExePath, ["pull", model], { cwd: path.dirname(ollamaExePath) });

    child.stdout.on("data", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.status) {
          sendProgress(`Downloading ${model} – ${msg.status}`, msg.percent || 0);
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    child.on("close", () => resolve());
    child.on("error", reject);
  });
}

async function startOllama(ollamaExePath) {
  const child0 = spawn(ollamaExePath, ["serve"], {
    cwd: path.dirname(ollamaExePath),
    detached: true,
    stdio: "ignore"
  });
  child0.unref();

  await waitForOllamaReady();

  // Download models one-by-one with GUI progress
  sendProgress("Pulling gemma3:4b…", 0);
  await pullModel(ollamaExePath, "gemma3:4b");

  sendProgress("Pulling nomic-embed-text…", 0);
  await pullModel(ollamaExePath, "nomic-embed-text");

  sendProgress("All downloads complete!", 100);
  closeDownloadWindow();
}

function waitForOllamaReady() {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        await fetch("http://127.0.0.1:11434/api/version");
        resolve();
      } catch {
        setTimeout(check, 250);
      }
    };
    check();
  });
}

function openDownloadWindow() {
  downloadWindow = new BrowserWindow({
    width: 350,
    height: 140,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  if (isDev) {
    downloadWindow.loadURL("http://localhost:5173/download");
  } else {
    downloadWindow.loadFile(path.join(__dirname, "../dist/download.html"));
  }
}

function sendProgress(message, percent) {
  if (downloadWindow) {
    downloadWindow.webContents.send("ollama-progress", { message, percent });
  }
}

function closeDownloadWindow() {
  if (downloadWindow) {
    downloadWindow.webContents.send("ollama-done");
    setTimeout(() => {
      downloadWindow.close();
    }, 500);
  }
}

export function getSccPath() {
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

app.whenReady().then(async () => {
  
  openDownloadWindow();
  sendProgress("Checking for existing Ollama installation…");
  const exe = await checkOllamaInstalled();
  await startOllama(exe);
  
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

  spawn(ollamaExePath, ["stop", "gemma3:4b"], {
    cwd: path.dirname(ollamaExePath),
    detached: true,
    stdio: "ignore"
  }).unref();
  spawn(ollamaExePath, ["stop", "nomic-embed-text"], {
    cwd: path.dirname(ollamaExePath),
    detached: true,
    stdio: "ignore"
  }).unref();

  if (process.platform !== 'darwin') app.quit();
});

// selectDirectory handler - used for directory selection in UI
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

// ollamaResponse handler - used by DocumentSummarizer
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
