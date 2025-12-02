import { getSccPath } from "../main.js";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import { ipcMain } from "electron";

ipcMain.handle('runCodeCounter', async (event , {dir}) => {
  const sccPath = getSccPath();
  
  try {
    // Run SCC command
    const { stdout } = await execPromise(`"${sccPath}" --format json "${dir}"`);

    // Parse JSON
    const data = JSON.parse(stdout);
    return { success: true, data };
  } catch (error) {
    console.error('SCC error:', error);
    return { success: false, error: error.message };
  }
});