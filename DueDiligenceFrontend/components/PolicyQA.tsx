"use client"

import { useState } from "react"

export default function PolicyQA() {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState("")

  const handleAsk = async () => {
    if (!question.trim()) {
      setError("Please enter a question")
      return
    }

    setLoading(true)
    setError("")

    // Simulate API call
    setTimeout(() => {
      setAnswer(
        `Based on the policy documentation:\n\n${question}\n\nAnswer: According to Section 4.2 of the company's data privacy policy, all customer data must be encrypted both at rest and in transit using industry-standard encryption protocols (AES-256 for data at rest, TLS 1.3 for data in transit). Additionally, access to customer data is restricted to authorized personnel only and requires multi-factor authentication.\n\nSource: Data Privacy Policy v2.3, Section 4.2 - Data Protection Standards`,
      )
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="card">
      <h2>Policy Q&A</h2>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Ask questions about company policies and get instant, cited answers.
      </p>

      <div className="form-group">
        <label htmlFor="question">Your Question</label>
        <textarea
          id="question"
          placeholder="e.g., What are the data encryption requirements?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      <button className="button" onClick={handleAsk} disabled={loading}>
        {loading ? "Searching..." : "Ask Question"}
      </button>

      {error && <div className="error">{error}</div>}

      {loading && <div className="loading">Searching policy documents...</div>}

      {answer && !loading && (
        <div className="result-box">
          <h3>Answer</h3>
          <p style={{ whiteSpace: "pre-line" }}>{answer}</p>
        </div>
      )}
    </div>
  )
}
