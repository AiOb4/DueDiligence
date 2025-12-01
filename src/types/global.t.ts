export {};

declare global {
  interface Window {
    env: {
      FIREBASE_API_KEY: string;
      FIREBASE_AUTH_DOMAIN: string;
      FIREBASE_PROJECT_ID: string;
      FIREBASE_STORAGE_BUCKET: string;
      FIREBASE_MESSAGING_SENDER_ID: string;
      FIREBASE_APP_ID: string;
      FIREBASE_MEASUREMENT_ID: string;
    };
    api: {
      selectDirectory: () => Promise<string | null>;
      runCodeCounter: (dir: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      ollamaResponse: (sysPrompt: string, promptText: string) => Promise<{ success: boolean; data?: any; err?: any }>;
      
      /**
       * Send a message to start a streamed chat with Ollama
       * @param id Unique identifier for the chat
       * @param promptText The user input for the chat
       */
      sendChat: (id: number, promptText: string) => void;

      /**
       * Subscribe to chunked responses from the chat stream.
       * Returns an unsubscribe function to remove the listener.
       * @param callback Receives each chunk of chat output
       */
      onChunk: (callback: (data: {id: number, chunk: string}) => void) => () => void;

      /**
       * Subscribe to the 'done' event from the chat stream.
       * Returns an unsubscribe function to remove the listener.
       * @param callback Called when the chat finishes streaming
       */
      onDone: (callback: (data: {id: number}) => void) => () => void;
    };
  }
}