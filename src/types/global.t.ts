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

      /**
       * Save code analysis results to local storage
       * @param projectData The project analysis data to save
       */
      saveCodeAnalysis: (projectData: any) => Promise<{ success: boolean; fileId?: string; error?: string }>;

      /**
       * Get list of all saved projects
       */
      getProjectList: () => Promise<{ success: boolean; projects: any[]; error?: string }>;

      /**
       * Get full project data by name
       * @param projectName The name of the project to retrieve
       */
      getProjectData: (projectName: string) => Promise<{ success: boolean; project?: any; error?: string }>;

      /**
       * Generate a due diligence report for a project
       * @param projectName The name of the project
       * @param reportType The type of report (full, executive, etc.)
       */
      generateReport: (projectName: string, reportType: string) => Promise<{
        success: boolean;
        reportContent?: string;
        reportId?: string;
        projectData?: any;
        error?: string
      }>;

      /**
       * Get list of recent reports
       */
      getRecentReports: () => Promise<{ success: boolean; reports: any[]; error?: string }>;

      /**
       * Get full report by ID
       * @param reportId The ID of the report to retrieve
       */
      getReport: (reportId: string) => Promise<{ success: boolean; report?: any; error?: string }>;

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

      /**
       * Select policy files to upload
       */
      policySelectFiles: () => Promise<{ success: boolean; filePaths: string[] }>;

      /**
       * Index selected policy files
       * @param filePaths Array of file paths to index
       */
      policyIndexPolicies: (filePaths: string[]) => Promise<{
        success: boolean;
        indexedDocs?: string[];
        chunkCount?: number;
        error?: string;
      }>;

      /**
       * Ask a question about indexed policies
       * @param question The question to ask
       */
      policyAskQuestion: (question: string) => Promise<{
        success: boolean;
        answer?: string;
        citations?: any[];
        error?: string;
      }>;

      /**
       * List all indexed policy documents
       */
      policyListPolicies: () => Promise<{
        success: boolean;
        policies?: any[];
        totalDocs?: number;
        totalChunks?: number;
        error?: string;
      }>;

      /**
       * Remove a policy document by name
       * @param docName The document name to remove
       */
      policyRemovePolicy: (docName: string) => Promise<{
        success: boolean;
        removedChunks?: number;
        remainingChunks?: number;
        error?: string;
      }>;

      /**
       * Clear the entire policy index
       */
      policyClearIndex: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}