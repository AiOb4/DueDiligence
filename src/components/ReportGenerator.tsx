"use client"

import { useState, useEffect } from "react"
import { updateUsage } from "../firebase/dbUsage"
import ReactMarkdown from "react-markdown"
import jsPDF from "jspdf"

export default function ReportGenerator() {
  const [reportType, setReportType] = useState("full")
  const [projectName, setProjectName] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [generatedReport, setGeneratedReport] = useState("")
  const [reportId, setReportId] = useState("")
  const [recentReports, setRecentReports] = useState<any[]>([])
  const [availableProjects, setAvailableProjects] = useState<any[]>([])
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Load available projects and recent reports on mount
  useEffect(() => {
    loadAvailableProjects()
    loadRecentReports()
  }, [])

  const loadAvailableProjects = async () => {
    try {
      const result = await window.api.getProjectList()
      if (result.success) {
        setAvailableProjects(result.projects)
      }
    } catch (err) {
      console.error("Failed to load projects:", err)
    }
  }

  const loadRecentReports = async () => {
    try {
      const result = await window.api.getRecentReports()
      if (result.success) {
        setRecentReports(result.reports)
      }
    } catch (err) {
      console.error("Failed to load reports:", err)
    }
  }

  const handleGenerate = async () => {
    await updateUsage("reportGenerator")

    if (!projectName.trim()) {
      setError("Please enter a project name")
      return
    }

    setLoading(true)
    setError("")
    setSuccess(false)
    setGeneratedReport("")

    try {
      const result = await window.api.generateReport(projectName, reportType)

      if (result.success) {
        setGeneratedReport(result.reportContent)
        setReportId(result.reportId)
        setSuccess(true)
        // Refresh recent reports
        await loadRecentReports()
      } else {
        setError(result.error || "Failed to generate report")
      }
    } catch (err: any) {
      setError(err.message || "Error generating report")
    } finally {
      setLoading(false)
    }
  }

  const downloadAsMarkdown = () => {
    if (!generatedReport) return

    const blob = new Blob([generatedReport], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${projectName.replace(/\s+/g, "_")}_report.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAsPDF = () => {
    if (!generatedReport) return

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    let yPosition = margin

    // Helper function to add new page if needed
    const checkPageBreak = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    // Helper function to add text with word wrap
    const addText = (text: string, fontSize: number, fontStyle: "normal" | "bold" | "italic" = "normal", color: number[] = [0, 0, 0]) => {
      pdf.setFontSize(fontSize)
      pdf.setFont("helvetica", fontStyle)
      pdf.setTextColor(color[0], color[1], color[2])

      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        checkPageBreak(fontSize * 0.5)
        pdf.text(line, margin, yPosition)
        yPosition += fontSize * 0.5
      })
    }

    // Title Page Background
    pdf.setFillColor(52, 73, 94) // Dark blue-gray
    pdf.rect(0, 0, pageWidth, 60, 'F')

    // Title
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(255, 255, 255)
    pdf.text("DUE DILIGENCE REPORT", margin, 30)

    // Project Name
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "normal")
    pdf.text(projectName, margin, 45)

    // Reset text color
    pdf.setTextColor(0, 0, 0)
    yPosition = 70

    // Metadata Box
    pdf.setFillColor(236, 240, 241)
    pdf.rect(margin, yPosition, maxWidth, 20, 'F')

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin + 5, yPosition + 8)
    pdf.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, margin + 5, yPosition + 15)

    yPosition += 30

    // Parse markdown content
    const lines = generatedReport.split('\n')

    // Track which major section we're in for smart page breaks
    const majorSections = [
      'EXECUTIVE SUMMARY',
      'CODEBASE OVERVIEW',
      'TECHNICAL ANALYSIS',
      'RISK ASSESSMENT',
      'OPPORTUNITIES',
      'RECOMMENDATIONS'
    ]

    let currentSectionIndex = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines but add spacing
      if (line === '') {
        yPosition += 4
        continue
      }

      // Skip horizontal rules (---)
      if (line.match(/^-{3,}$/) || line.match(/^={3,}$/)) {
        continue
      }

      // Headers (## Header)
      if (line.match(/^#{1,6}\s/)) {
        const level = line.match(/^#{1,6}/)?.[0].length || 1
        const text = line.replace(/^#{1,6}\s/, '').toUpperCase()

        // Check if this is a major section that should start on a new page
        const sectionIndex = majorSections.findIndex(section => text.includes(section))

        if (level === 2 && sectionIndex !== -1 && currentSectionIndex !== sectionIndex) {
          // Force new page for major sections (except first one)
          if (currentSectionIndex !== -1) {
            // Specific page break rules:
            // Executive Summary stays on page 1
            // Codebase Overview + Technical Analysis on page 2
            // Risk Assessment + Opportunities on page 3
            // Recommendations on page 4

            if (sectionIndex === 1 || // Codebase Overview
                sectionIndex === 3 || // Risk Assessment
                sectionIndex === 5) { // Recommendations
              pdf.addPage()
              yPosition = margin
            }
          }
          currentSectionIndex = sectionIndex
        }

        checkPageBreak(20)
        yPosition += 8

        if (level === 1) {
          // H1 - Major section
          pdf.setFillColor(52, 152, 219)
          pdf.rect(margin, yPosition - 5, maxWidth, 12, 'F')
          pdf.setFontSize(16)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(255, 255, 255)
          pdf.text(text, margin + 3, yPosition + 3)
          pdf.setTextColor(0, 0, 0)
          yPosition += 18
        } else if (level === 2) {
          // H2 - Section header
          pdf.setFontSize(15)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(41, 128, 185)
          const wrapped = pdf.splitTextToSize(text, maxWidth)
          wrapped.forEach((line: string) => {
            checkPageBreak(10)
            pdf.text(line, margin, yPosition)
            yPosition += 7
          })
          pdf.setDrawColor(41, 128, 185)
          pdf.setLineWidth(0.7)
          pdf.line(margin, yPosition + 1, margin + 60, yPosition + 1)
          pdf.setTextColor(0, 0, 0)
          yPosition += 5
        } else {
          // H3+ - Subsection
          pdf.setFontSize(12)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(52, 73, 94)
          const wrapped = pdf.splitTextToSize(text, maxWidth)
          wrapped.forEach((line: string) => {
            checkPageBreak(8)
            pdf.text(line, margin, yPosition)
            yPosition += 6
          })
          pdf.setTextColor(0, 0, 0)
          yPosition += 4
        }
        continue
      }

      // Bullet points (- or * at start)
      if (line.match(/^[\*\-]\s/)) {
        const text = line.replace(/^[\*\-]\s/, '')
        const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '')

        // Check if this looks like a subheading (ends with : or is short and bold-like)
        const isSubheading = cleanText.endsWith(':') || (cleanText.length < 60 && !cleanText.includes('.'))

        if (isSubheading) {
          // Render as bold subheading without bullet
          pdf.setFontSize(11)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(52, 73, 94)

          checkPageBreak(8)
          yPosition += 3
          const wrapped = pdf.splitTextToSize(cleanText, maxWidth)
          wrapped.forEach((line: string) => {
            checkPageBreak(7)
            pdf.text(line, margin, yPosition)
            yPosition += 6
          })
          pdf.setTextColor(0, 0, 0)
          yPosition += 2
        } else {
          // Regular bullet point
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "normal")

          // Add bullet point
          pdf.circle(margin + 2, yPosition - 1.5, 0.8, 'F')

          const wrapped = pdf.splitTextToSize(cleanText, maxWidth - 8)
          wrapped.forEach((line: string, idx: number) => {
            checkPageBreak(6)
            pdf.text(line, margin + 6, yPosition)
            yPosition += 5
          })
          yPosition += 1
        }
        continue
      }

      // Bold text (**text**)
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/)
        pdf.setFontSize(10)
        let xPos = margin

        parts.forEach(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.replace(/\*\*/g, '')
            pdf.setFont("helvetica", "bold")
            pdf.text(text, xPos, yPosition)
            xPos += pdf.getTextWidth(text)
          } else if (part) {
            pdf.setFont("helvetica", "normal")
            const wrapped = pdf.splitTextToSize(part, maxWidth - (xPos - margin))
            wrapped.forEach((line: string, idx: number) => {
              if (idx > 0) {
                checkPageBreak(6)
                yPosition += 5
                xPos = margin
              }
              pdf.text(line, xPos, yPosition)
              xPos += pdf.getTextWidth(line)
            })
          }
        })
        yPosition += 6
        continue
      }

      // Regular paragraph text
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      const cleanText = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '')
      const wrapped = pdf.splitTextToSize(cleanText, maxWidth)

      wrapped.forEach((line: string) => {
        checkPageBreak(6)
        pdf.text(line, margin, yPosition)
        yPosition += 5
      })
      yPosition += 2
    }

    // Footer on each page
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(128, 128, 128)
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
      pdf.text(
        `${projectName} - Due Diligence Report`,
        margin,
        pageHeight - 10
      )
    }

    pdf.save(`${projectName.replace(/\s+/g, "_")}_report.pdf`)
  }

  const downloadReport = async (reportId: string) => {
    try {
      const result = await window.api.getReport(reportId)
      if (result.success) {
        const content = result.report.content
        const projectName = result.report.projectName

        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${projectName.replace(/\s+/g, "_")}_report.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to download report:", err)
    }
  }

  const selectProject = (project: any) => {
    setProjectName(project.name)
    setShowProjectDropdown(false)
  }

  const filteredProjects = availableProjects.filter(p =>
    p.name.toLowerCase().includes(projectName.toLowerCase())
  )

  return (
    <div className="card">
      <h2>Generate Reports</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Create comprehensive due diligence reports based on your code analysis.
      </p>

      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          placeholder="Enter or select project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onFocus={() => setShowProjectDropdown(true)}
          onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
        />

        {showProjectDropdown && filteredProjects.length > 0 && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "4px",
            marginTop: "4px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}>
            {filteredProjects.map((project, idx) => (
              <div
                key={idx}
                onClick={() => selectProject(project)}
                style={{
                  padding: "10px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  fontSize: "14px"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
              >
                <strong>{project.name}</strong>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  {project.totalFiles} files • {project.totalCode.toLocaleString()} lines • {new Date(project.analyzedDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
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

      {loading && (
        <div className="loading">
          <p>Generating report with AI... This may take 30-60 seconds.</p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
            Analyzing codebase metrics and creating professional assessment...
          </p>
        </div>
      )}

      {success && !loading && generatedReport && (
        <div className="success">
          <h3 style={{ marginBottom: "10px" }}>Report Generated Successfully!</h3>
          <p style={{ marginBottom: "15px" }}>
            Your {reportType} report for "{projectName}" has been created.
          </p>
          <button className="button" onClick={downloadAsMarkdown} style={{ marginRight: "10px" }}>
            Download Markdown
          </button>
          <button className="button" onClick={downloadAsPDF}>
            Download PDF
          </button>

          <div style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            maxHeight: "500px",
            overflowY: "auto",
            border: "1px solid #ddd"
          }}>
            <h4 style={{ marginBottom: "15px", color: "#333" }}>Generated Report Preview:</h4>
            <div className="markdown-preview" style={{
              lineHeight: "1.6",
              color: "#333",
              fontSize: "14px"
            }}>
              <ReactMarkdown>{generatedReport}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "40px" }}>
        <h3 style={{ marginBottom: "15px" }}>Recent Reports</h3>
        {recentReports.length === 0 ? (
          <p style={{ color: "#666" }}>No reports generated yet. Run a code analysis and generate your first report!</p>
        ) : (
          <ul className="report-list">
            {recentReports.map((report, idx) => (
              <li key={idx} className="report-item">
                <div className="report-item-info">
                  <h4>{report.projectName} - {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report</h4>
                  <p>Generated on {new Date(report.generatedAt).toLocaleString()}</p>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => downloadReport(report.reportId)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
