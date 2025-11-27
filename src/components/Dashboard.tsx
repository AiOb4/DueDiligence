"use client"

import { db, auth } from "../firebase/firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import CodeAnalysis from "./CodeAnalysis";
import DocumentSummarizer from "./DocumentSummarizer";
import PolicyQA from "./PolicyQA";
import ReportGenerator from "./ReportGenerator";

interface DashboardProps {
  onNavigate: (view: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showCost, setShowCost] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Dashboard: User authenticated", user.uid);
        const ref = doc(db, "userStats", user.uid);
        
        const unsubscribeSnapshot = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            console.log("Dashboard: Data reception", snap.data());
            setUsage(snap.data());
          } else {
            console.log("Dashboard: No data (initialized to 0)");
            setUsage({});
          }
        });

        return () => unsubscribeSnapshot();
      } else {
        console.log("Dashboard: Logged out status");
        setUsage(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const safe = (value: number | undefined) => value || 0;
  
  const realTotalUsage = usage?.totalUsage || 0;
  const usageDivisor = realTotalUsage === 0 ? 1 : realTotalUsage;

  const usagePercent = {
    codeAnalysis: ((safe(usage?.codeAnalysis) / usageDivisor) * 100).toFixed(0),
    documentSummarizer: ((safe(usage?.documentSummarizer) / usageDivisor) * 100).toFixed(0),
    policyQA: ((safe(usage?.policyQA) / usageDivisor) * 100).toFixed(0),
    reportGenerator: ((safe(usage?.reportGenerator) / usageDivisor) * 100).toFixed(0),
  };

  const timeSavedPerAction = {
    codeAnalysis: 60,       // 60 min saved per analysis
    documentSummarizer: 30, // 30 min saved per summary
    policyQA: 15,           // 15 min saved per question
    reportGenerator: 45     // 45 min saved per report
  };
  
  const totalMinutesSaved = 
    (safe(usage?.codeAnalysis) * timeSavedPerAction.codeAnalysis) +
    (safe(usage?.documentSummarizer) * timeSavedPerAction.documentSummarizer) +
    (safe(usage?.policyQA) * timeSavedPerAction.policyQA) +
    (safe(usage?.reportGenerator) * timeSavedPerAction.reportGenerator);
  
  const hoursSaved = (totalMinutesSaved / 60).toFixed(1);
  
  const costSaved = (Number(hoursSaved) * 250).toLocaleString(); // Assuming $250/hr consultant rate
  
  const efficiencyScore = Math.min(realTotalUsage * 5, 100);

  const stats = {
  totalProjects: safe(usage?.codeAnalysis),
  documentsProcessed: safe(usage?.documentSummarizer),
  questionsAnswered: safe(usage?.policyQA),
  reportsGenerated: safe(usage?.reportGenerator),
  };

  const usageData = [
    { label: "Code Analysis", percentage: usagePercent.codeAnalysis, color: "#2563eb" },
    { label: "documentSummarizer", percentage: usagePercent.documentSummarizer, color: "#10b981" },
    { label: "policyQA", percentage: usagePercent.policyQA, color: "#f59e0b" },
    { label: "reportGenerator", percentage: usagePercent.reportGenerator, color: "#8b5cf6" },
  ];

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
            <h4>Efficiency Score</h4>
            <div className="score-circle">
              <div className="score-value">{efficiencyScore}</div>
              <div className="score-label">Productivity Boost</div>
            </div>
            <p style={{textAlign: 'center', marginTop: '10px', fontSize: '14px', color: '#555'}}>
              Based on usage frequency & task completion
            </p>
          </div>

          <div className="performance-card">
            <h4>Feature Usage Distribution</h4>
            <div className="usage-chart">
              {usageData.map((item) => (
                <div key={item.label} className="usage-item">
                  <div className="usage-label">{item.label}</div>
                  <div className="usage-bar-container">
                    <div
                      className="usage-bar"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                  <div className="usage-percentage">{item.percentage}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div 
          onClick={() => setShowCost(!showCost)}
          style={{ 
            backgroundColor: "#f8f9fa", 
            border: "1px solid #e9ecef",
            borderRadius: "8px", 
            padding: "25px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}
        >
          <div>
            <h4 style={{ margin: "0 0 5px 0", color: "#2c3e50", fontSize: "18px" }}>
              {showCost ? "💰 Estimated Cost Savings" : "⏱️ Total Time Saved"}
            </h4>
            <p style={{ margin: 0, color: "#7f8c8d", fontSize: "14px" }}>
              {showCost 
                ? "Based on average consultant rate ($250/hr)" 
                : "Man-hours saved by using AI automation tools"}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ 
              fontSize: "36px", 
              fontWeight: "bold", 
              color: showCost ? "#059669" : "#2563eb", // Green for money, Blue for time
              display: "block",
              lineHeight: "1"
            }}>
              {showCost ? `$${costSaved}` : `${hoursSaved} hrs`}
            </span>
            <span style={{ fontSize: "12px", color: "#999" }}>
              (Click to toggle view)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
