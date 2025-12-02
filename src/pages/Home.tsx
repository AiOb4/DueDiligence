import { useState } from "react"
import Dashboard from "../components/Dashboard"
import CodeAnalysis from "../components/CodeAnalysis"
import DocumentSummarizer from "../components/DocumentSummarizer"
import PolicyQA from "../components/PolicyQA"
import ReportGenerator from "../components/ReportGenerator"
import Authentication from "../components/Authentication"
import Account from "../components/Account"
import ChatBot from "../components/ChatBot"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeView, setActiveView] = useState("dashboard")
  const [isChatOpen, setIsChatOpen] = useState(false)

  if (!isAuthenticated) {
    return <Authentication onAuthSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div>
      <div className="header">
        <div className="container">
          <h1>Due Diligence AI Agent</h1>
          <p>Fellows Consulting Group - Intelligent Due Diligence Assistant</p>
        </div>
      </div>

      <div className="container">
        <div className="nav">
          <button
            className={`nav-button ${activeView === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`nav-button ${activeView === "code" ? "active" : ""}`}
            onClick={() => setActiveView("code")}
          >
            Code Analysis
          </button>
          <button
            className={`nav-button ${activeView === "documents" ? "active" : ""}`}
            onClick={() => setActiveView("documents")}
          >
            Document Summarizer
          </button>
          <button
            className={`nav-button ${activeView === "policy" ? "active" : ""}`}
            onClick={() => setActiveView("policy")}
          >
            Policy Q&A
          </button>
          <button
            className={`nav-button ${activeView === "reports" ? "active" : ""}`}
            onClick={() => setActiveView("reports")}
          >
            Generate Reports
          </button>
          <button
            className={`nav-button ${activeView === "account" ? "active" : ""}`}
            onClick={() => setActiveView("account")}
          >
            Account
          </button>
          <button
            className="nav-button-logout"
            onClick={() => setIsAuthenticated(false)}
          >
            Logout
          </button>
        </div>

        {activeView === "dashboard" && <Dashboard onNavigate={setActiveView} />}
        {activeView === "code" && <CodeAnalysis />}
        {activeView === "documents" && <DocumentSummarizer />}
        {activeView === "policy" && <PolicyQA />}
        {activeView === "reports" && <ReportGenerator />}
        {activeView === "account" && <Account />}
      </div>

      <button className="chatbot-toggle" onClick={() => setIsChatOpen(!isChatOpen)}>
        <span className="chatbot-toggle-icon">💬</span>
      </button>

      <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}
