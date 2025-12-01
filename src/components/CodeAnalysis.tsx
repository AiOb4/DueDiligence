"use client";

import { useState, useEffect } from "react";
import { updateUsage } from "../firebase/dbUsage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

const db = getFirestore();

export default function CodeAnalysis() {
  const [dir, setDir] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingToFirebase, setSavingToFirebase] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // FIXED: Listen to auth changes + load user-specific analyses
  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (!user) {
        setProjects([]);
        setLoadingSaved(false);
        return;
      }

      // Load user-specific analyses when user changes
      loadSavedAnalyses(user.uid);
    });

    return () => unsubscribeAuth();
  }, []);

  const loadSavedAnalyses = (userId: string) => {
    try {
      setLoadingSaved(true);
      const analysesRef = collection(db, "userStats", userId, "analyses");
      const q = query(analysesRef, orderBy("createdAt", "desc"), limit(50));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const savedProjects = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            firebaseId: doc.id,
            name: data.projectName,
            url: data.directory,
            analyzedDate: data.analyzedDate || new Date(data.createdAt?.toDate?.()).toISOString().replace("T", " ").split(".")[0],
            totalFiles: data.codeMetrics?.totalFiles || 0,
            totalCode: data.codeMetrics?.totalCode || 0,
            totalComments: data.codeMetrics?.totalComments || 0,
            totalBlanks: data.codeMetrics?.totalBlanks || 0,
            totalLines: data.codeMetrics?.totalLines || 0,
            languageBreakdown: data.codeMetrics?.languageBreakdown || [],
            fileBreakdown: data.codeMetrics?.fileBreakdown || [],
            isSaved: true
          };
        });

        setProjects(savedProjects);
        if (savedProjects.length > 0) {
          setSelectedProject(savedProjects[0]);
        } else {
          setSelectedProject(null);
        }
        setLoadingSaved(false);
      });

      return unsubscribe;
    } catch (err: any) {
      console.error("Failed to load saved analyses:", err);
      setError("Failed to load saved analyses from cloud.");
      setLoadingSaved(false);
    }
  };

  const chooseFolder = async () => {
    if (!currentUser) {
      setError("Please sign in first.");
      return;
    }
    const selectedDir = await window.api.selectDirectory();
    if (selectedDir) {
      setDir(selectedDir);
      setError("");
      setSaveSuccessMessage(null);
    }
  };

  const saveAnalysisResult = async (projectData: any) => {
    if (!currentUser) {
      setError("Not authenticated. Please sign in.");
      return;
    }

    try {
      setSavingToFirebase(true);
      setSaveSuccessMessage(null);
      setError("");

      const projectName = projectData.name;

      const docRef = await addDoc(collection(db, "userStats", currentUser.uid, "analyses"), {
        projectName,
        codeMetrics: {
          totalFiles: projectData.totalFiles,
          totalCode: projectData.totalCode,
          totalComments: projectData.totalComments,
          totalBlanks: projectData.totalBlanks,
          totalLines: projectData.totalLines,
          languageBreakdown: projectData.languageBreakdown,
          fileBreakdown: projectData.fileBreakdown || []
        },
        directory: projectData.url,
        analyzedDate: projectData.analyzedDate,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });

      const savedProject = { ...projectData, firebaseId: docRef.id, isSaved: true };
      setProjects(prev => [savedProject, ...prev.filter(p => p.firebaseId !== docRef.id)]);
      setSelectedProject(savedProject);

      setSaveSuccessMessage(` "${projectName}" saved successfully!`);
      console.log(" Analysis saved:", projectName);
    } catch (err: any) {
      console.error("Failed to save analysis:", err);
      setError(`Analysis complete but failed to save: ${err.message}`);
    } finally {
      setSavingToFirebase(false);
    }
  };

  const runAnalysis = async () => {
    if (!currentUser) {
      setError("Please sign in first.");
      return;
    }

    await updateUsage("codeAnalysis");

    if (!dir) {
      setError("Please select a folder first.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSaveSuccessMessage(null);
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
          id: Date.now(),
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

        await saveAnalysisResult(newProject);
      } else {
        setError(res.error || "Failed to analyze the code.");
      }
    } catch (err: any) {
      setError(err.message || "Error running code analysis.");
    } finally {
      setLoading(false);
    }
  };

  function pad(str: string | number, length: number, alignLeft = false): string {
    const s = str.toString();
    if (s.length >= length) return s.slice(0, length);
    const padding = " ".repeat(length - s.length);
    return alignLeft ? s + padding : padding + s;
  }

  function generateLanguagesTable(data: any[]) {
    const headers = ["language", "files", "code", "comment", "blank", "total"];
    const colWidths = [12, 12, 12, 12, 12, 12];
    const sep = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
    const headerLine = "|" + headers.map((h, i) => pad(h, colWidths[i], true)).join("|") + "|";
    const rows = data.map((lang) => {
      const total = lang.Code + lang.Comment + lang.Blank;
      return (
        "|" +
        pad(lang.Name || 'N/A', colWidths[0], true) +
        "|" +
        pad(lang.Count || 0, colWidths[1]) +
        "|" +
        pad((lang.Code || 0).toLocaleString(), colWidths[2]) +
        "|" +
        pad(lang.Comment || 0, colWidths[3]) +
        "|" +
        pad(lang.Blank || 0, colWidths[4]) +
        "|" +
        pad(total.toLocaleString(), colWidths[5]) +
        "|"
      );
    });
    return [sep, headerLine, sep, ...rows, sep].join("\n");
  }

  function generateDirectoriesTable(files: any[]) {
    // Group files by directory
    const dirMap = new Map<string, {files: number, code: number, comment: number, blank: number, total: number}>();
    
    files.forEach((file) => {
      const dirPath = file.Location || file.Filename;
      const dirName = dirPath.split(/[/\\]/).slice(0, -1).join('/') || '.';
      const stats = dirMap.get(dirName) || {files: 0, code: 0, comment: 0, blank: 0, total: 0};
      
      stats.files += 1;
      stats.code += file.Code || 0;
      stats.comment += file.Comment || 0;
      stats.blank += file.Blank || 0;
      stats.total += (file.Code || 0) + (file.Comment || 0) + (file.Blank || 0);
      
      dirMap.set(dirName, stats);
    });
    
    const headers = ["path", "files", "code", "comment", "blank", "total"];
    const colWidths = [82, 12, 12, 12, 12, 12];
    const sep = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
    const headerLine = "|" + headers.map((h, i) => pad(h, colWidths[i], i === 0)).join("|") + "|";
    
    const rows = Array.from(dirMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([dirName, stats]) => 
        "|" +
        pad(dirName, colWidths[0], true) +
        "|" +
        pad(stats.files, colWidths[1]) +
        "|" +
        pad(stats.code.toLocaleString(), colWidths[2]) +
        "|" +
        pad(stats.comment, colWidths[3]) +
        "|" +
        pad(stats.blank, colWidths[4]) +
        "|" +
        pad(stats.total.toLocaleString(), colWidths[5]) +
        "|"
      );
      
    // Add total row
    const totalStats = Array.from(dirMap.values()).reduce((acc, stats) => ({
      files: acc.files + stats.files,
      code: acc.code + stats.code,
      comment: acc.comment + stats.comment,
      blank: acc.blank + stats.blank,
      total: acc.total + stats.total
    }), {files: 0, code: 0, comment: 0, blank: 0, total: 0});
    
    const totalRow = 
      "|" +
      pad("Total", colWidths[0], true) +
      "|" +
      pad("", colWidths[1], true) +
      "|" +
      pad(totalStats.code.toLocaleString(), colWidths[2]) +
      "|" +
      pad(totalStats.comment, colWidths[3]) +
      "|" +
      pad(totalStats.blank, colWidths[4]) +
      "|" +
      pad(totalStats.total.toLocaleString(), colWidths[5]) +
      "|";
    
    return [sep, headerLine, sep, ...rows.slice(0, 10), totalRow, sep].join("\n");
  }

  function generateFilesTable(files: any[]) {
    const headers = ["filename", "language", "code", "comment", "blank", "total"];
    const colWidths = [80, 12, 12, 12, 12, 12];
    const sep = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
    const headerLine = "|" + headers.map((h, i) => pad(h, colWidths[i], i === 0)).join("|") + "|";
    const rows = files.map((file) => {
      const total = (file.Code || 0) + (file.Comment || 0) + (file.Blank || 0);
      return (
        "|" +
        pad(file.Location || file.Filename || 'N/A', colWidths[0], true) +
        "|" +
        pad(file.Language || 'N/A', colWidths[1], true) +
        "|" +
        pad((file.Code || 0).toLocaleString(), colWidths[2]) +
        "|" +
        pad(file.Comment || 0, colWidths[3]) +
        "|" +
        pad(file.Blank || 0, colWidths[4]) +
        "|" +
        pad(total.toLocaleString(), colWidths[5]) +
        "|"
      );
    });
    return [sep, headerLine, sep, ...rows.slice(0, 25), sep].join("\n"); // Top 25 files
  }

  function generateReportText(project: any) {
    const header = `Date : ${project.analyzedDate}\nDirectory : ${project.url}\nTotal : ${project.totalFiles} files,  ${project.totalCode} codes, ${project.totalComments} comments, ${project.totalBlanks} blanks, all ${project.totalLines} lines\n\n`;
    const languageSectionTitle = "Languages\n";
    const languagesTable = generateLanguagesTable(project.languageBreakdown);
    const dirSectionTitle = "\nDirectories\n";
    const dirsTable = generateDirectoriesTable(project.fileBreakdown || []);
    const filesSectionTitle = "\nFiles\n";
    const filesTable = generateFilesTable(project.fileBreakdown || []);
    return header + languageSectionTitle + languagesTable + dirSectionTitle + dirsTable + filesSectionTitle + filesTable + "\n";
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
      
      {!currentUser && (
        <div style={{ 
          backgroundColor: "#fff3cd", 
          border: "1px solid #ffeaa7", 
          padding: "15px", 
          borderRadius: "5px", 
          marginBottom: "20px"
        }}>
          <strong>👤 Please sign in</strong> to analyze code and save reports to cloud.
        </div>
      )}

      {currentUser && (
        <p style={{ marginBottom: "20px", color: "#555" }}>
          Please choose a folder to run analysis
        </p>
      )}

      <button 
        className="button" 
        onClick={chooseFolder} 
        disabled={!currentUser || loading || savingToFirebase}
        style={{ marginBottom: "10px" }}
      >
        {currentUser ? "Choose Folder" : "Sign In First"}
      </button>
      
      {dir && (
        <p style={{ marginBottom: "10px", fontFamily: "monospace" }}>
          <b>Selected:</b> {dir}
        </p>
      )}

      <button 
        className="button" 
        onClick={runAnalysis} 
        disabled={loading || !dir || savingToFirebase || !currentUser}
      >
        {loading ? "Analyzing..." : savingToFirebase ? "Saving to Cloud..." : "Run Analysis"}
      </button>

      {saveSuccessMessage && (
        <div 
          className="success" 
          style={{ 
            marginTop: "10px", 
            padding: "10px", 
            backgroundColor: "#d4edda", 
            border: "1px solid #c3e6cb", 
            borderRadius: "4px",
            color: "#155724"
          }}
        >
          {saveSuccessMessage}
        </div>
      )}

      {error && (
        <div 
          className="error" 
          style={{ 
            marginTop: "10px", 
            padding: "10px", 
            backgroundColor: "#f8d7da", 
            border: "1px solid #f5c6cb", 
            borderRadius: "4px",
            color: "#721c24"
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: "30px" }}>
        <h3>Your Projects ({projects.length}) {loadingSaved && "(Loading...)"}</h3>
        {projects.length === 0 && !loadingSaved && currentUser && <p>No projects analyzed yet. Analyze one above!</p>}
        {!currentUser && projects.length === 0 && <p>Please sign in to see your saved projects.</p>}
        {loadingSaved && <p>Loading saved analyses from cloud...</p>}
        {projects.map((project) => (
          <div
            key={project.firebaseId || project.id}
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
              borderLeft: project.isSaved ? "3px solid #28a745" : "3px solid #ffc107"
            }}
          >
            {project.name} {project.isSaved ? "(saved)" : ""}
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
