// Expose safe API methods to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  runCodeCounter: (dir) => ipcRenderer.invoke('runCodeCounter', {dir}),

  indexDir: (dir) => ipcRenderer.invoke('indexDir', (dir)),
  ollamaEmbed: (promptText) => ipcRenderer.invoke('ollamaEmbed', {promptText}),
  ollamaResponse: (sysPrompt, promptText) => ipcRenderer.invoke('ollamaResponse', {sysPrompt, promptText}),

  sendChat: (id, promptText) => ipcRenderer.send('ollamaChatStream', { id, promptText }),

  // subscribe to chunk events, unmount when called again
  onChunk: (callback) => {
    const handler = (event, { id, chunk }) => callback({ id, chunk });
    ipcRenderer.on('ollamaChatChunk', handler);
    return () => ipcRenderer.removeListener('ollamaChatChunk', handler);
  },

  // subscribe to done events, and unmount when called again
  onDone: (callback) => {
    const handler = (event, { id }) => callback({ id });
    ipcRenderer.on('ollamaChatDone', handler);
    return () => ipcRenderer.removeListener('ollamaChatDone', handler);
  },

  generateReport: (projectName, reportType, userId) => 
    ipcRenderer.invoke('generateReport', { projectName, reportType, userId }),

  downloadReport: (filepath) => 
    ipcRenderer.invoke('downloadReport', { filepath }),

  // ✅ POLICY QA HANDLERS (MOVED FROM 'env')
  policySelectFiles: () => ipcRenderer.invoke('policySelectFiles'),
  policyIndexPolicies: (filePaths) => ipcRenderer.invoke('policyIndexPolicies', { filePaths }),
  policyAskQuestion: (question) => ipcRenderer.invoke('policyAskQuestion', { question }),
  policyListPolicies: () => ipcRenderer.invoke('policyListPolicies'),
  policyRemovePolicy: (docName) => ipcRenderer.invoke('policyRemovePolicy', { docName }),
  policyClearIndex: () => ipcRenderer.invoke('policyClearIndex'),

  // ✅ Cancel chat (moved from env)
  cancelChat: () => ipcRenderer.send('cancelChatStream'),
});

// ✅ FIXED: Only Firebase env vars (no API methods)
contextBridge.exposeInMainWorld('env', {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
});
