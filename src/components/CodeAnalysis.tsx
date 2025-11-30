"use client";

import { useState } from "react";
import { updateUsage } from "../firebase/dbUsage";
import { onAuthStateChanged, getAuth } from "firebase/auth";

export default function CodeAnalysis() {
  const [dir, setDir] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const chooseFolder = async () => {
    const selectedDir = await window.api.selectDirectory();
    if (selectedDir) {
      setDir(selectedDir);
      setError("");
    }
  };

  const runAnalysis = async () => {

    await updateUsage("codeAnalysis");

    if (!dir) {
      setError("Please select a folder first.");
      return;
    }
    setLoading(true);
    setError("");
    setSelectedProject(null);

    try {
      const res = await window.api.runCodeCounter(dir);
      if (res.success) {
        const data = res.data;

        const totalFiles = data.reduce((acc: number, lang: any) => acc + lang.Count, 0);
        const totalCode = data.reduce((acc: number, lang: any) => acc + lang.Code, 0);
        const totalComments = data.reduce((acc: number, lang: any) => acc + lang.Comment, 0);
        const totalBlanks = data.reduce((acc: number, lang: any) => acc + lang.Blank, 0);
        const totalLines = totalCode + totalComments + totalBlanks;

        const files = data.flatMap((lang: any) => lang.Files || []);

        const analyzedDate = new Date().toISOString().replace("T", " ").split(".")[0];

        const projectName = dir.split(/[\\/]/).pop() || "Scanned Project";

        const newProject = {
          id: projects.length + 1,
          name: projectName,
          url: dir,
          analyzedDate,
          totalFiles,
          totalCode,
          totalComments,
          totalBlanks,
          totalLines,
          languageBreakdown: data,
          fileBreakdown: files,
        };

        setProjects([newProject, ...projects]);
        setSelectedProject(newProject);
        setLoading(false);
      } else {
        setError(res.error || "Failed to analyze the code.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Error running code analysis.");
      setLoading(false);
    }
  };

  function pad(str: string | number, length: number, alignLeft = false): string {
    const s = str.toString();
    if (s.length >= length) return s;
    const padding = " ".repeat(length - s.length);
    return alignLeft ? s + padding : padding + s;
  }

  function generateLanguagesTable(data: any[]) {
    const headers = ["language", "files", "code", "comment", "blank", "total"];
    const colWidths = [12, 12, 12, 12, 12, 12];
    const sep = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
    const headerLine =
      "|" + headers.map((h, i) => pad(h, colWidths[i], true)).join("|") + "|";
    const rows = data.map((lang) => {
      const total = lang.Code + lang.Comment + lang.Blank;
      return (
        "|" +
        pad(lang.Name, colWidths[0], true) +
        "|" +
        pad(lang.Count, colWidths[1]) +
        "|" +
        pad(lang.Code.toLocaleString(), colWidths[2]) +
        "|" +
        pad(lang.Comment, colWidths[3]) +
        "|" +
        pad(lang.Blank, colWidths[4]) +
        "|" +
        pad(total.toLocaleString(), colWidths[5]) +
        "|"
      );
    });
    return [sep, headerLine, sep, ...rows, sep].join("\n");
  }

  function generateFilesTable(files: any[]) {
    const headers = ["filename", "language", "code", "comment", "blank", "total"];
    const colWidths = [80, 12, 12, 12, 12, 12];
    const sep = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
    const headerLine =
      "|" + headers.map((h, i) => pad(h, colWidths[i], i === 0)).join("|") + "|";
    const rows = files.map((file) => {
      const total = file.Code + file.Comment + file.Blank;
      return (
        "|" +
        pad(file.Location || file.Filename, colWidths[0], true) +
        "|" +
        pad(file.Language, colWidths[1], true) +
        "|" +
        pad(file.Code.toLocaleString(), colWidths[2]) +
        "|" +
        pad(file.Comment, colWidths[3]) +
        "|" +
        pad(file.Blank, colWidths[4]) +
        "|" +
        pad(total.toLocaleString(), colWidths[5]) +
        "|"
      );
    });
    return [sep, headerLine, sep, ...rows, sep].join("\n");
  }

  function generateReportText(project: any) {
    const header = `Date : ${project.analyzedDate}\nDirectory : ${project.url}\nTotal : ${project.totalFiles} files,  ${project.totalCode} codes, ${project.totalComments} comments, ${project.totalBlanks} blanks, all ${project.totalLines} lines\n`;
    const languageSectionTitle = "\nLanguages\n";
    const languagesTable = generateLanguagesTable(project.languageBreakdown);
    const filesSectionTitle = "\nFiles\n";
    const filesTable = generateFilesTable(project.fileBreakdown || []);
    return header + languageSectionTitle + languagesTable + filesSectionTitle + filesTable + "\n";
  }

  const downloadReport = () => {
    if (!selectedProject) return;
    const reportText = generateReportText(selectedProject);
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject.name.replace(/\s+/g, "_")}_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{ maxWidth: "900px", margin: "auto", color: "#333" }}>
      <h2>Code Analysis</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Select a folder and run code analysis using the SCC tool.
      </p>

      <button className="button" onClick={chooseFolder} style={{ marginBottom: "10px" }}>
        Choose Folder
      </button>
      {dir && (
        <p style={{ marginBottom: "10px", fontFamily: "monospace" }}>
          <b>Selected:</b> {dir}
        </p>
      )}

      <button className="button" onClick={runAnalysis} disabled={loading || !dir}>
        {loading ? "Analyzing..." : "Run Analysis"}
      </button>

      {error && <div className="error" style={{ marginTop: "10px" }}>{error}</div>}

      <div style={{ marginTop: "30px" }}>
        <h3>Your Projects ({projects.length})</h3>
        {projects.length === 0 && <p>No projects analyzed yet.</p>}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-item ${selectedProject?.id === project.id ? "active" : ""}`}
            onClick={() => setSelectedProject(project)}
            style={{
              cursor: "pointer",
              padding: "10px",
              backgroundColor: selectedProject?.id === project.id ? "#f0f0f0" : "#fff",
              marginBottom: "8px",
              borderRadius: "5px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              color: "#333",
            }}
          >
            {project.name}
            {"\n"}
            {project.analyzedDate}
            {"\n"}
            {project.url}
            {"\n"}
            {project.totalFiles} files {project.totalCode.toLocaleString()} codes {project.totalComments} comments {project.totalBlanks} blanks all {project.totalLines.toLocaleString()} lines
          </div>
        ))}
      </div>

      {selectedProject && (
        <div className="result-box" style={{ marginTop: "20px" }}>
          <button onClick={downloadReport} className="button" style={{ marginTop: "15px" }}>
            Download Full Report
          </button>
        </div>
      )}
    </div>
  );
}
