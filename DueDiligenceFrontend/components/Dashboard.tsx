"use client"

interface DashboardProps {
  onNavigate: (view: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const stats = {
    totalProjects: 12,
    documentsProcessed: 47,
    questionsAnswered: 156,
    reportsGenerated: 8,
    avgResponseTime: "1.2s",
    successRate: 98.5,
  }

  const activityData = [
    { feature: "Code Analysis", usage: 35, color: "#2563eb" },
    { feature: "Document Summarizer", usage: 28, color: "#10b981" },
    { feature: "Policy Q&A", usage: 25, color: "#f59e0b" },
    { feature: "Report Generator", usage: 12, color: "#8b5cf6" },
  ]

  return (
    <div className="card">
      <h2>Welcome to Due Diligence AI Agent</h2>
      <p style={{ marginBottom: "30px", color: "#555" }}>
        Your AI-powered assistant for comprehensive due diligence tasks.
      </p>

      <div className="stats-section">
        <h3 style={{ marginBottom: "20px", color: "#333" }}>Your Activity Overview</h3>

        <div className="stats-grid">
          <div
            className="stat-card"
            style={{ backgroundColor: "#2563eb", color: "white", borderRadius: "8px", padding: "16px" }}
          >
            <div className="stat-value">{stats.totalProjects}</div>
            <div className="stat-label">Projects Analyzed</div>
          </div>

          <div
            className="stat-card"
            style={{ backgroundColor: "#2563eb", color: "white", borderRadius: "8px", padding: "16px" }}
          >
            <div className="stat-value">{stats.documentsProcessed}</div>
            <div className="stat-label">Documents Processed</div>
          </div>

          <div
            className="stat-card"
            style={{ backgroundColor: "#2563eb", color: "white", borderRadius: "8px", padding: "16px" }}
          >
            <div className="stat-value">{stats.questionsAnswered}</div>
            <div className="stat-label">Questions Answered</div>
          </div>

          <div
            className="stat-card"
            style={{ backgroundColor: "#2563eb", color: "white", borderRadius: "8px", padding: "16px" }}
          >
            <div className="stat-value">{stats.reportsGenerated}</div>
            <div className="stat-label">Reports Generated</div>
          </div>
        </div>

        <div className="performance-section">
          <div className="performance-card">
            <h4>Performance Score</h4>
            <div className="score-circle">
              <div className="score-value">{stats.successRate}%</div>
              <div className="score-label">Success Rate</div>
            </div>
          </div>

          <div className="performance-card">
            <h4>Feature Usage Distribution</h4>
            <div className="usage-chart">
              {activityData.map((item) => (
                <div key={item.feature} className="usage-item">
                  <div className="usage-label">{item.feature}</div>
                  <div className="usage-bar-container">
                    <div
                      className="usage-bar"
                      style={{
                        width: `${item.usage}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                  <div className="usage-percentage">{item.usage}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="quick-stat">
          <span style={{ fontWeight: "600", color: "#2563eb" }}>Average Response Time:</span> {stats.avgResponseTime}
        </div>
      </div>
    </div>
  )
}
