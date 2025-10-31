"use client"

import { useState } from "react"

const mockProjects = [
  {
    id: 1,
    name: "E-commerce Platform",
    url: "https://github.com/company/ecommerce",
    analyzedDate: "2024-01-15",
    totalLines: 15420,
    totalFiles: 87,
    complexity: "Medium",
    maintainability: "Good",
  },
  {
    id: 2,
    name: "Mobile Banking App",
    url: "https://github.com/company/banking-app",
    analyzedDate: "2024-01-10",
    totalLines: 28500,
    totalFiles: 142,
    complexity: "High",
    maintainability: "Fair",
  },
  {
    id: 3,
    name: "CRM System",
    url: "https://github.com/company/crm",
    analyzedDate: "2024-01-05",
    totalLines: 9800,
    totalFiles: 56,
    complexity: "Low",
    maintainability: "Excellent",
  },
]

export default function CodeAnalysis() {
  const [repoUrl, setRepoUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [projects, setProjects] = useState(mockProjects)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [showNewProject, setShowNewProject] = useState(false)

  const handleAnalyze = async () => {
    if (!repoUrl) {
      setError("Please enter a repository URL")
      return
    }

    setLoading(true)
    setError("")

    setTimeout(() => {
      const newProject = {
        id: projects.length + 1,
        name: repoUrl.split("/").pop() || "New Project",
        url: repoUrl,
        analyzedDate: new Date().toISOString().split("T")[0],
        totalLines: Math.floor(Math.random() * 30000) + 5000,
        totalFiles: Math.floor(Math.random() * 150) + 30,
        complexity: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
        maintainability: ["Excellent", "Good", "Fair"][Math.floor(Math.random() * 3)],
      }

      setProjects([newProject, ...projects])
      setSelectedProject(newProject)
      setShowNewProject(false)
      setRepoUrl("")
      setLoading(false)
    }, 2000)
  }

  const handleProjectClick = (project: any) => {
    setSelectedProject(project)
    setShowNewProject(false)
  }

  return (
    <div className="card">
      <h2>Code Analysis</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>Manage and analyze your code repositories.</p>

      <button
        className="button"
        onClick={() => {
          setShowNewProject(true)
          setSelectedProject(null)
        }}
        style={{ marginBottom: "20px" }}
      >
        + Add New Project
      </button>

      {showNewProject && (
        <div className="new-project-form">
          <h3>Add New Project</h3>
          <div className="form-group">
            <label htmlFor="repoUrl">Repository URL or Path</label>
            <input
              id="repoUrl"
              type="text"
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="button" onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setShowNewProject(false)
                setRepoUrl("")
                setError("")
              }}
            >
              Cancel
            </button>
          </div>

          {error && <div className="error">{error}</div>}
          {loading && <div className="loading">Analyzing code repository...</div>}
        </div>
      )}

      {!showNewProject && (
        <div className="projects-section">
          <h3 style={{ marginBottom: "15px" }}>Your Projects ({projects.length})</h3>
          <div className="projects-list">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-item ${selectedProject?.id === project.id ? "active" : ""}`}
                onClick={() => handleProjectClick(project)}
              >
                <div className="project-header">
                  <h4>{project.name}</h4>
                  <span className="project-date">{project.analyzedDate}</span>
                </div>
                <div className="project-url">{project.url}</div>
                <div className="project-stats">
                  <span>{project.totalLines.toLocaleString()} lines</span>
                  <span>{project.totalFiles} files</span>
                  <span className={`complexity-badge ${project.complexity.toLowerCase()}`}>{project.complexity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedProject && !showNewProject && (
        <div className="result-box" style={{ marginTop: "20px" }}>
          <h3>Analysis Results: {selectedProject.name}</h3>

          <div className="metrics-grid">
            <div className="metric-card">
              <h4>Total Lines</h4>
              <p>{selectedProject.totalLines.toLocaleString()}</p>
            </div>
            <div className="metric-card">
              <h4>Total Files</h4>
              <p>{selectedProject.totalFiles}</p>
            </div>
            <div className="metric-card">
              <h4>Complexity</h4>
              <p>{selectedProject.complexity}</p>
            </div>
            <div className="metric-card">
              <h4>Maintainability</h4>
              <p>{selectedProject.maintainability}</p>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <h4 style={{ marginBottom: "10px" }}>Language Breakdown</h4>
            <div style={{ marginBottom: "8px" }}>
              <strong>JavaScript:</strong> 8,500 lines
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>Python:</strong> 4,200 lines
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>CSS:</strong> 1,800 lines
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>HTML:</strong> 920 lines
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
