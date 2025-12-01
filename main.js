import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { exec } from "child_process";
import dotenv from "dotenv";
import "./ipcModules/codeCounter.js";
import "./ipcModules/ollama.js";
import "./ipcModules/policyQA.js";
import "./ipcModules/semanticSearch.js";
import { fileURLToPath } from "url";
import { loadPolicyIndexFromDisk } from "./ipcModules/policyQA.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const isDev = !app.isPackaged;

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