"use client"

import type React from "react"

import { useState } from "react"
import { updateUsage } from "../firebase/dbUsage"; 
import { auth } from "../firebase/firebaseConfig";


export default function DocumentSummarizer() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState("")
  const [error, setError] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError("")
    }
  }

  const handleSummarize = async () => {

    const user = auth.currentUser; 
  
    if (user) {
      try {
        console.log("Updating usage for user:", user.uid);
        await updateUsage("documentSummarizer");
      } catch (e) {
        console.error("Failed to update usage:", e);
      }
    } else {
      console.warn("User not logged in, skipping usage update");
    }

    if (!file) {
      setError("Please select a file to summarize")
      return
    }

    setLoading(true)
    setError("")

    setTimeout(() => {
      setSummary(
        `Summary of ${file.name}:\n\nThis document outlines the key findings from the due diligence process. The main points include:\n\n1. Financial Performance: The company has shown consistent growth over the past 3 years with revenue increasing by 25% annually.\n\n2. Risk Assessment: Several moderate risks were identified in the supply chain management area, particularly regarding vendor dependencies.\n\n3. Compliance: All regulatory requirements are being met, with proper documentation maintained.\n\n4. Recommendations: Consider diversifying supplier base and implementing additional quality control measures.`,
      )
      setLoading(false)
    }, 2000)
  }

  return (
    <div className="card">
      <h2>Document Summarizer</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Upload documents (PDF, DOCX, TXT) to get AI-powered summaries.
      </p>

      <div className="form-group">
        <label htmlFor="fileUpload">Select Document</label>
        <div className="file-upload-area" onClick={() => document.getElementById("fileUpload")?.click()}>
          <input id="fileUpload" type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
          <p>{file ? file.name : "Click to select a file or drag and drop"}</p>
          <p style={{ fontSize: "12px", color: "#6c757d", marginTop: "10px" }}>Supported formats: PDF, DOCX, TXT</p>
        </div>
      </div>

      <button className="button" onClick={handleSummarize} disabled={loading || !file}>
        {loading ? "Summarizing..." : "Generate Summary"}
      </button>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Processing document...</div>}

      {summary && !loading && (
        <div className="result-box">
          <h3>Document Summary</h3>
          <p style={{ whiteSpace: "pre-line" }}>{summary}</p>
        </div>
      )}
    </div>
  )
}
