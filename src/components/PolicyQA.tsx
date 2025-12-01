"use client";

import { useEffect, useState } from "react";
import { updateUsage } from "../firebase/dbUsage";
import { getAuth } from "firebase/auth";

type PolicyInfo = {
  docName: string;
  chunkCount: number;
  lastUpdated?: string;
};

export default function PolicyQA() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");

  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Load current policy summary on mount
  useEffect(() => {
    const api = (window as any).api;
    if (!api || !api.policyListPolicies) return;

    api.policyListPolicies().then((res: any) => {
      if (res?.success) {
        setPolicies(res.policies || []);
        setTotalDocs(res.totalDocs || 0);
        setTotalChunks(res.totalChunks || 0);
        if ((res.totalDocs || 0) > 0) {
          setPolicyStatus(
            `Loaded ${res.totalDocs} policies, ${res.totalChunks} chunks from saved index.`
          );
        } else {
          setPolicyStatus("No policies loaded yet. Upload policy files to begin.");
        }
      } else if (res?.reason === "missing") {
        setPolicyStatus("No saved policy index found. Upload policy files to begin.");
      }
    });
  }, []);

  const refreshPolicyList = async () => {
    const api = (window as any).api;
    if (!api || !api.policyListPolicies) return;

    const res = await api.policyListPolicies();
    if (res?.success) {
      setPolicies(res.policies || []);
      setTotalDocs(res.totalDocs || 0);
      setTotalChunks(res.totalChunks || 0);
    }
  };

  // Question / Answer handlers
  const handleAsk = async () => {
    // Hosung - Record feature usage in Firestore
    await updateUsage("policyQA");

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    const api = (window as any).api;
    if (!api || !api.policyAskQuestion) {
      setError("Policy Q&A backend not available. Check preload.js / main.js.");
      setLoading(false);
      return;
    }

    try {
      const res = await api.policyAskQuestion(question);

      if (!res?.success) {
        setError(
          res?.error ||
            "Error answering question. Make sure policies have been uploaded and indexed."
        );
      } else {
        setAnswer(res.answer || "");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unexpected error while answering question.");
    } finally {
      setLoading(false);
    }
  };

  // Policy management handlers
  const handleUploadPolicies = async () => {
    setError("");
    setPolicyStatus("");

    const api = (window as any).api;
    if (!api || !api.selectPolicyFiles || !api.policyIndexPolicies) {
      setError("Policy upload not available. Check preload.js / main.js.");
      return;
    }

    const selection = await api.selectPolicyFiles();
    if (!selection?.success || !selection.filePaths?.length) {
      setPolicyStatus("No policy files selected.");
      return;
    }

    setPolicyStatus("Indexing selected policies...");
    try {
      const result = await api.policyIndexPolicies(selection.filePaths);
      if (!result.success) {
        setError(result.error || "Failed to index policies.");
      } else {
        setPolicyStatus(
          `Indexed ${result.indexedDocs?.length ?? 0} new file(s). Total chunks: ${
            result.chunkCount ?? 0
          }.`
        );
        await refreshPolicyList();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unexpected error while indexing policies.");
    }
  };

  const handleClearPolicies = async () => {
  setError("");

  // Add confirmation popup BEFORE clearing
  const ok = window.confirm(
    "Are you sure you want to clear ALL policies?\n\nThis will remove all indexed files and erase the saved index."
  );
  if (!ok) return;

  const api = (window as any).api;
  if (!api || !api.policyClearIndex) {
    setError("Policy clear backend not available. Check preload.js / main.js.");
    return;
  }

  try {
    const res = await api.policyClearIndex();
    if (!res?.success) {
      setError(res?.error || "Failed to clear policy index.");
    } else {
      setPolicyStatus("Policy index cleared. No policies are currently loaded.");
      setPolicies([]);
      setTotalDocs(0);
      setTotalChunks(0);
      setAnswer("");
    }
  } catch (err: any) {
    console.error(err);
    setError(err.message || "Unexpected error while clearing policy index.");
  }
};

  const handleRemovePolicy = async (docName: string) => {
    setError("");
    const api = (window as any).api;

    if (!api || !api.policyRemovePolicy) {
      setError("Policy remove backend not available. Check preload.js / main.js.");
      return;
    }

    const ok = window.confirm(
      `Remove "${docName}" from the policy index? This will stop it from being used to answer questions.`
    );
    if (!ok) return;

    try {
      const res = await api.policyRemovePolicy(docName);
      if (!res?.success) {
        setError(res?.error || `Failed to remove policy: ${docName}`);
      } else {
        setPolicyStatus(`Removed ${docName} from index.`);
        await refreshPolicyList();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unexpected error while removing policy.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Policy Q&amp;A</h1>
        <p>
          Ask questions about company policies and get answers based only on the
          documents you’ve uploaded.
        </p>
      </div>

      {/*TOP: Question / Answer Section*/}
      <section className="section">
        <h2>Ask a Question</h2>

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

        {error && (
          <div className="error" style={{ marginTop: "12px" }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="loading" style={{ marginTop: "12px" }}>
            Searching policy documents...
          </div>
        )}

        {answer && !loading && (
          <div className="result-box" style={{ marginTop: "16px" }}>
            <h3>Answer</h3>
            <p style={{ whiteSpace: "pre-line" }}>{answer}</p>
          </div>
        )}
      </section>

      {/*BOTTOM: Policy Management Section*/}
      <section className="section">
        <h2>Policy Management</h2>

        <p>
          Loaded policies: {totalDocs} document{totalDocs === 1 ? "" : "s"},{" "}
          {totalChunks} chunk{totalChunks === 1 ? "" : "s"}.
        </p>

        <div style={{ marginBottom: "12px", display: "flex", gap: "8px" }}>
          <button
            className="button secondary"
            type="button"
            onClick={handleUploadPolicies}
            disabled={loading}
          >
            Upload / Index Policy Files
          </button>

          <button
            className="button danger"
            type="button"
            onClick={handleClearPolicies}
            disabled={loading}
          >
            Clear Policy Index
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={() => setShowPolicyModal(true)}
            disabled={loading || totalDocs === 0}
          >
            Manage / Remove Policies
          </button>
        </div>

        {policyStatus && (
          <div
            style={{
              marginTop: "4px",
              marginBottom: "4px",
              fontSize: "0.9rem",
              color: "#555",
            }}
          >
            {policyStatus}
          </div>
        )}
      </section>

      {/*Modal: Policy List*/}
      {showPolicyModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "16px",
              minWidth: "420px",
              maxWidth: "640px",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h3 style={{ margin: 0 }}>Policy List</h3>
              <button
                className="button small"
                type="button"
                onClick={() => setShowPolicyModal(false)}
              >
                Close
              </button>
            </div>

            <p style={{ marginBottom: "8px", fontSize: "0.9rem" }}>
              These are the policies currently in the index. Removing one will stop
              it from being used to answer questions.
            </p>

            <div className="policy-table-wrapper">
              <table className="policy-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>
                      Policy Name
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {policies.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        style={{ textAlign: "center", padding: "8px" }}
                      >
                        No policies loaded.
                      </td>
                    </tr>
                  )}
                  {policies.map((p) => (
                    <tr key={p.docName}>
                      <td style={{ padding: "4px 8px" }}>{p.docName}</td>
                      <td style={{ padding: "4px 8px" }}>
                        {/* View is optional; keeping simple */}
                        <button
                          className="button small danger"
                          type="button"
                          onClick={() => handleRemovePolicy(p.docName)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "#555" }}>
              Total: {totalDocs} policy file{totalDocs === 1 ? "" : "s"}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}