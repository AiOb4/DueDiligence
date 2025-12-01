import ollama from "ollama";
import { ipcMain, app } from "electron";
import fs from "fs";
import path from "path";

// System prompt for the AI to generate professional due diligence reports
const REPORT_SYSTEM_PROMPT = `You are a senior technical due diligence analyst with expertise in software engineering, code quality assessment, and technology evaluation.

Your task is to generate comprehensive, professional due diligence reports based on codebase analysis data.

Report Structure:
1. EXECUTIVE SUMMARY - High-level overview, key findings, overall assessment (2-3 paragraphs)
2. CODEBASE OVERVIEW - Project size, languages, file organization
3. TECHNICAL ANALYSIS - Technology stack, architecture insights, code quality indicators
4. RISK ASSESSMENT - Technical debt signals, potential issues, security considerations
5. OPPORTUNITIES - Strengths, positive findings, areas of excellence
6. RECOMMENDATIONS - Actionable next steps, improvements, best practices

Tone: Professional, objective, data-driven
Format: Use markdown with clear headers (##), bullet points, and emphasis where appropriate
Be specific: Reference actual numbers from the data provided
Be balanced: Highlight both strengths and concerns`;

// Get the reports storage directory
const getReportsPath = () => {
  const userDataPath = app.getPath("userData");
  const reportsDir = path.join(userDataPath, "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  return reportsDir;
};

// Format project data into a prompt for the AI
function formatReportPrompt(projectData, reportType) {
  const { name, url, analyzedDate, totalFiles, totalCode, totalComments, totalBlanks, totalLines, languageBreakdown } = projectData;

  // Calculate some metrics
  const commentRatio = totalCode > 0 ? ((totalComments / totalCode) * 100).toFixed(1) : 0;
  const avgLinesPerFile = totalFiles > 0 ? (totalLines / totalFiles).toFixed(0) : 0;

  // Get top languages
  const topLanguages = languageBreakdown
    .sort((a, b) => b.Code - a.Code)
    .slice(0, 5)
    .map(lang => `- ${lang.Name}: ${lang.Code.toLocaleString()} lines (${lang.Count} files)`)
    .join("\n");

  const prompt = `Generate a comprehensive technical due diligence report for the following project:

PROJECT INFORMATION:
- Project Name: ${name}
- Directory: ${url}
- Analysis Date: ${analyzedDate}

CODEBASE METRICS:
- Total Files: ${totalFiles}
- Total Lines of Code: ${totalCode.toLocaleString()}
- Comments: ${totalComments.toLocaleString()} lines (${commentRatio}% comment-to-code ratio)
- Blank Lines: ${totalBlanks.toLocaleString()}
- Total Lines: ${totalLines.toLocaleString()}
- Average Lines per File: ${avgLinesPerFile}

TOP LANGUAGES:
${topLanguages}

ALL LANGUAGES:
${languageBreakdown.map(lang => `- ${lang.Name}: ${lang.Code.toLocaleString()} lines`).join("\n")}

Please generate a detailed ${reportType === "executive" ? "executive summary" : "full due diligence"} report based on this data.
${reportType === "executive" ? "Focus on high-level insights and keep it concise (3-4 paragraphs)." : "Include all sections with detailed analysis."}`;

  return prompt;
}

// Save generated report to local storage
function saveReport(projectName, reportType, content) {
  try {
    const reportsPath = getReportsPath();
    const timestamp = Date.now();
    const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedName}_${reportType}_${timestamp}.json`;
    const filePath = path.join(reportsPath, filename);

    const reportData = {
      projectName,
      reportType,
      content,
      generatedAt: new Date().toISOString(),
      reportId: filename
    };

    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
    console.log(`✅ Report saved: ${filename}`);

    return { success: true, reportId: filename };
  } catch (error) {
    console.error("Error saving report:", error);
    return { success: false, error: error.message };
  }
}

// Main handler: Generate a report
ipcMain.handle("generateReport", async (event, { projectName, reportType }) => {
  try {
    console.log(`📊 Generating ${reportType} report for project: ${projectName}`);

    // Step 1: Get project data from storage
    const projectDataPath = path.join(app.getPath("userData"), "projects");
    const files = fs.readdirSync(projectDataPath);

    const matchingFiles = files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(projectDataPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return { data, savedAt: new Date(data.savedAt).getTime() };
      })
      .filter(item => item.data.name.toLowerCase() === projectName.toLowerCase())
      .sort((a, b) => b.savedAt - a.savedAt);

    if (matchingFiles.length === 0) {
      return {
        success: false,
        error: `Project "${projectName}" not found. Please run a code analysis first.`
      };
    }

    const projectData = matchingFiles[0].data;
    console.log(`✅ Found project data: ${projectData.totalFiles} files, ${projectData.totalCode} lines`);

    // Step 2: Format the prompt
    const prompt = formatReportPrompt(projectData, reportType);

    // Step 3: Generate report using Ollama
    console.log("🤖 Generating report with AI...");
    const response = await ollama.chat({
      model: "gemma3:4b",
      messages: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      stream: false,
      keep_alive: 300
    });

    const reportContent = response.message.content;
    console.log(`✅ Report generated: ${reportContent.length} characters`);

    // Step 4: Save the report
    const saveResult = saveReport(projectName, reportType, reportContent);

    if (!saveResult.success) {
      console.warn("⚠️ Failed to save report, but returning content anyway");
    }

    return {
      success: true,
      reportContent,
      reportId: saveResult.reportId,
      projectData: {
        name: projectData.name,
        totalFiles: projectData.totalFiles,
        totalCode: projectData.totalCode,
        analyzedDate: projectData.analyzedDate
      }
    };

  } catch (error) {
    console.error("❌ Error generating report:", error);
    return {
      success: false,
      error: error.message || "Failed to generate report"
    };
  }
});

// Get list of recent reports
ipcMain.handle("getRecentReports", async () => {
  try {
    const reportsPath = getReportsPath();

    if (!fs.existsSync(reportsPath)) {
      return { success: true, reports: [] };
    }

    const files = fs.readdirSync(reportsPath);

    const reports = files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(reportsPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return {
          reportId: data.reportId,
          projectName: data.projectName,
          reportType: data.reportType,
          generatedAt: data.generatedAt,
          preview: data.content.substring(0, 200) + "..."
        };
      })
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
      .slice(0, 10); // Return last 10 reports

    return { success: true, reports };
  } catch (error) {
    console.error("Error getting recent reports:", error);
    return { success: false, error: error.message, reports: [] };
  }
});

// Get full report by ID
ipcMain.handle("getReport", async (event, { reportId }) => {
  try {
    const reportsPath = getReportsPath();
    const filePath = path.join(reportsPath, reportId);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Report not found" };
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { success: true, report: data };
  } catch (error) {
    console.error("Error getting report:", error);
    return { success: false, error: error.message };
  }
});

console.log("📄 Report generator module loaded");
