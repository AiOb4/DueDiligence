// src/types/electron.d.ts
interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  runCodeCounter: (dir: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  indexDir: (dir: string) => Promise<boolean>;
  ollamaEmbed: (promptText: string) => Promise<{ success: boolean; data?: any; err?: any }>;
  ollamaResponse: (sysPrompt: string, promptText: string) => Promise<{ success: boolean; data?: any; err?: any }>;
  sendChat: (id: number, promptText: string) => void;
  onChunk: (callback: (data: { id: number; chunk: string }) => void) => () => void;
  onDone: (callback: (data: { id: number }) => void) => () => void;
  
  // NEW: Report generation methods
  generateReport: (projectName: string, reportType: string, userId: string) => 
    Promise<{ success: boolean; filename?: string; filepath?: string; error?: string }>;
  downloadReport: (filepath: string) => 
    Promise<{ success: boolean; savedAs?: string; error?: string }>;
}

declare global {
  interface Window {
    api: ElectronAPI;
    env: {
      FIREBASE_API_KEY: string;
      FIREBASE_AUTH_DOMAIN: string;
      FIREBASE_PROJECT_ID: string;
      FIREBASE_STORAGE_BUCKET: string;
      FIREBASE_MESSAGING_SENDER_ID: string;
      FIREBASE_APP_ID: string;
      FIREBASE_MEASUREMENT_ID: string;
    };
  }
}

export {};
