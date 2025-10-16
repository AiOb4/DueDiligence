// Expose safe API methods to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  runCodeCounter: (dir) => ipcRenderer.invoke('runCodeCounter', {dir}),

  sendChat: (id, promptText) => ipcRenderer.send('ollamaChatStream', { id, promptText }),

  // subscribe to chunk events
  onChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('ollamaChatChunk', handler);
    return () => ipcRenderer.removeListener('ollamaChatChunk', handler);
  },

  // subscribe to done events, and unmount when called again
  onDone: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('ollamaChatDone', handler);
    return () => ipcRenderer.removeListener('ollamaChatDone', handler);
  }
});
