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

// other 'api' calls exist in firebaseAuth and firebaseConfig files

contextBridge.exposeInMainWorld('env', {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID
});