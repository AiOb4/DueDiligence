"use client"

import { useState, useEffect } from "react"
import { updateUsage } from "../firebase/dbUsage"; 
import { auth } from "../firebase/firebaseConfig";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  onSnapshot 
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

const db = getFirestore();

export default function ReportGenerator() {
  const [reportType, setReportType] = useState("full")
  const [projectName, setProjectName] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [downloadPath, setDownloadPath] = useState("")
  const [recentReports, setRecentReports] = useState<Array<any>>([])
  const [projects, setProjects] = useState<string[]>([])
  const [userId, setUserId] = useState("")

  // Load user data + projects on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
      
      // Load unique project names from analyses + documents
      const loadProjects = async () => {
        try {
          const analysesRef = collection(db, "userStats", user.uid, "analyses");
          const docsRef = collection(db, "userStats", user.uid, "documents");
          
          const [analysesSnap, docsSnap] = await Promise.all([
            getDocs(analysesRef),
            getDocs(docsRef)
          ]);
          
          // ✅ TYPE-SAFE: Explicit string typing
          const projectSet = new Set<string>();
          analysesSnap.docs.forEach((doc) => {
            const data = doc.data() as any;
            if (data.projectName && typeof data.projectName === 'string') {
              projectSet.add(data.projectName);
            }
          });
          docsSnap.docs.forEach((doc) => {
            const data = doc.data() as any;
            if (data.projectName && typeof data.projectName === 'string') {
              projectSet.add(data.projectName);
            }
          });
          
          const projectsList = Array.from(projectSet);
          setProjects(projectsList);
          if (projectsList.length > 0) {
            setProjectName(projectsList[0]);
          }
        } catch (err) {
          console.error("Failed to load projects:", err);
        }
      };

      // Load recent reports
      const reportsRef = collection(db, "userStats", user.uid, "reports");
      const unsubscribe = onSnapshot(reportsRef, (snapshot) => {
        setRecentReports(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()
          }))
        );
      });

      loadProjects();
      return unsubscribe;
    }
  }, []);

  const handleGenerate = async () => {
    await updateUsage("reportGenerator");

    if (!projectName.trim()) {
      setError("Please select a project");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);
    setDownloadPath("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      console.log(`📊 Loading ${projectName} data from FR1+FR2...`);

      // ✅ PULL REAL DATA FROM FIREBASE (FR1 + FR2)
      const [analysesSnap, docsSnap] = await Promise.all([
        getDocs(query(collection(db, "userStats", user.uid, "analyses"), where("projectName", "==", projectName))),
        getDocs(query(collection(db, "userStats", user.uid, "documents"), where("projectName", "==", projectName)))
      ]);

      // Extract real data
      const codeAnalysis = analysesSnap.docs.map(doc => doc.data());
      const docSummaries = docsSnap.docs.map(doc => doc.data());
      
      console.log(`📈 Found: ${codeAnalysis.length} analyses, ${docSummaries.length} summaries`);

      // ✅ SEND REAL DATA TO MAIN.JS
      const response = await (window.api as any).generateReport(
        projectName, 
        reportType, 
        user.uid,
        { codeAnalysis, docSummaries }  // ← REAL FR1+FR2 DATA!
      );
      
      if (response.success) {
        setSuccess(true);
        setDownloadPath(response.filepath);
        setError("");
      } else {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filepath: string) => {
    if (!filepath) {
      alert("No report path available to download.");
      return;
    }
    
    try {
      const result = await (window.api as any).downloadReport(filepath);
      
      if (result.success) {
        alert(` Report downloaded to: ${result.savedAs}`);
      } else {
        alert(` Failed to download: ${result.error}`);
      }
    } catch (err: any) {
      alert(` Download error: ${err.message}`);
    }
  };

  return (
    <div className="card">
      <h2> Generate Reports </h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Pulls <strong>Code Analysis + Document Summaries</strong> into professional reports.
      </p>

      
      <div className="form-group" style={{ marginBottom: "15px" }}>
        <label htmlFor="projectName">Project Name <span style={{color: "#666", fontSize: "12px"}}>(from your analyses)</span></label>
        <select
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="form-control"
          disabled={loading}
        >
          <option value="">Select project...</option>
          {projects.map((proj, i) => (
            <option key={i} value={proj}>{proj}</option>
          ))}
        </select>
        {projects.length === 0 && (
          <p style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>
             Run Code Analysis or Document Summarizer first to populate projects
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="reportType">Report Type</label>
        <select 
          id="reportType" 
          value={reportType} 
          onChange={(e) => setReportType(e.target.value)}
          disabled={loading}
        >
          <option value="full">Full Report (Code + Documents)</option>
          <option value="code">Code Analysis Only</option>
          <option value="documents">Document Summary Only</option>
          <option value="executive">Executive Summary</option>
        </select>
      </div>

      <button 
        className="button" 
        onClick={handleGenerate} 
        disabled={loading || !projectName || projects.length === 0}
      >
        {loading ? " Ollama Generating..." : " Generate & Download Report"}
      </button>

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading"> </div>}

      {success && !loading && (
        <div className="success" style={{ marginTop: "20px" }}>
          <h3 style={{ marginBottom: "10px" }}> Report Generated Successfully!</h3>
          <p style={{ marginBottom: "15px" }}>
            Your <strong>{reportType.toUpperCase()}</strong> report for "<strong>{projectName}</strong>" is ready.
          </p>
          <button 
            className="button" 
            onClick={() => handleDownload(downloadPath)}
            style={{ backgroundColor: "#28a745" }}
          >
             Download Report (.txt)
          </button>
        </div>
      )}

      {/* Recent Reports */}
      <div style={{ marginTop: "40px" }}>
        <h3 style={{ marginBottom: "15px" }}>Recent Reports ({recentReports.length})</h3>
        <ul className="report-list">
          {recentReports.length === 0 && <li>No reports generated yet.</li>}
          {recentReports.map(report => (
            <li key={report.id} className="report-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", border: "1px solid #ddd", marginBottom: "10px", borderRadius: "8px" }}>
              <div className="report-item-info">
                <h4>{report.projectName} - {report.reportType}</h4>
                <p>Generated: {report.createdAt?.toLocaleDateString()}</p>
              </div>
              <button 
                className="button button-secondary"
                onClick={() => handleDownload(report.filepath)}
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                 Download
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: "20px", fontSize: "12px", color: "#666", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
      </div>
    </div>
  )
}
