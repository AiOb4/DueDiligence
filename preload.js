// Expose safe API methods to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ollama: () => ipcRenderer.invoke('ollama'),
});
