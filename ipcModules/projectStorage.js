import { ipcMain, app } from "electron";
import fs from "fs";
import path from "path";

// Get the user data directory (persistent across app sessions)
const getStoragePath = () => {
  const userDataPath = app.getPath("userData");
  const storageDir = path.join(userDataPath, "projects");

  // Create directory if it doesn't exist
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  return storageDir;
};

// Save code analysis results for a project
ipcMain.handle("saveCodeAnalysis", async (event, { projectData }) => {
  try {
    const storagePath = getStoragePath();

    // Create a unique filename based on project name and timestamp
    const timestamp = Date.now();
    const sanitizedName = projectData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedName}_${timestamp}.json`;
    const filePath = path.join(storagePath, filename);

    // Add metadata
    const dataToSave = {
      ...projectData,
      savedAt: new Date().toISOString(),
      fileId: filename
    };

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    console.log(`Project saved: ${filename}`);
    return { success: true, fileId: filename };
  } catch (error) {
    console.error("Error saving project:", error);
    return { success: false, error: error.message };
  }
});

// Get list of all saved projects
ipcMain.handle("getProjectList", async () => {
  try {
    const storagePath = getStoragePath();
    const files = fs.readdirSync(storagePath);

    const projects = files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(storagePath, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        // Return lightweight version for list view
        return {
          fileId: data.fileId,
          name: data.name,
          analyzedDate: data.analyzedDate,
          savedAt: data.savedAt,
          totalFiles: data.totalFiles,
          totalCode: data.totalCode,
          totalLines: data.totalLines,
          url: data.url
        };
      })
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)); // Most recent first

    return { success: true, projects };
  } catch (error) {
    console.error("Error getting project list:", error);
    return { success: false, error: error.message, projects: [] };
  }
});

// Get full project data by name
ipcMain.handle("getProjectData", async (event, { projectName }) => {
  try {
    const storagePath = getStoragePath();
    const files = fs.readdirSync(storagePath);

    // Find the most recent project with matching name
    const matchingFiles = files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(storagePath, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return { file, data, savedAt: new Date(data.savedAt).getTime() };
      })
      .filter(item => item.data.name.toLowerCase() === projectName.toLowerCase())
      .sort((a, b) => b.savedAt - a.savedAt);

    if (matchingFiles.length === 0) {
      return { success: false, error: `Project "${projectName}" not found` };
    }

    // Return the most recent match
    return { success: true, project: matchingFiles[0].data };
  } catch (error) {
    console.error("Error getting project data:", error);
    return { success: false, error: error.message };
  }
});

console.log("Project storage module loaded");
