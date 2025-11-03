"use client"

import { useState } from "react"

export default function ReportGenerator() {
  const [reportType, setReportType] = useState("full")
  const [projectName, setProjectName] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      setError("Please enter a project name")
      return
    }

    setLoading(true)
    setError("")
    setSuccess(false)

    // Simulate API call
    setTimeout(() => {
      setSuccess(true)
      setLoading(false)
    }, 2000)
  }

  return (
    <div className="card">
      <h2>Generate Reports</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Create comprehensive due diligence reports based on your analysis.
      </p>

      <div className="form-group">
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          placeholder="Enter project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reportType">Report Type</label>
        <select id="reportType" value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="full">Full Due Diligence Report</option>
          <option value="code">Code Analysis Only</option>
          <option value="documents">Document Summary Only</option>
          <option value="executive">Executive Summary</option>
        </select>
      </div>

      <button className="button" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate Report"}
      </button>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Generating report...</div>}

      {success && !loading && (
        <div className="success">
          <h3 style={{ marginBottom: "10px" }}>Report Generated Successfully!</h3>
          <p style={{ marginBottom: "15px" }}>
            Your {reportType} report for "{projectName}" has been created.
          </p>
          <button className="button">Download PDF</button>
        </div>
      )}

      <div style={{ marginTop: "40px" }}>
        <h3 style={{ marginBottom: "15px" }}>Recent Reports</h3>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-item-info">
              <h4>TechCorp Due Diligence - Full Report</h4>
              <p>Generated on September 15, 2025</p>
            </div>
            <button className="button button-secondary">Download</button>
          </li>
          <li className="report-item">
            <div className="report-item-info">
              <h4>StartupXYZ Code Analysis</h4>
              <p>Generated on September 10, 2025</p>
            </div>
            <button className="button button-secondary">Download</button>
          </li>
        </ul>
      </div>
    </div>
  )
}
