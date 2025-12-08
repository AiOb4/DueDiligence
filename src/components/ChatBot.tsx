"use client"

import React from "react"
import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect, useCallback } from "react"
import { auth } from "../firebase/firebaseConfig";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const db = getFirestore();

interface Message {
  id: number
  text: string
  sender: "user" | "agent"
  timestamp: Date
  isThinking?: boolean
}

interface ChatBotProps {
  isOpen: boolean
  onClose: () => void
}

type ChunkEvent = { id: number; chunk: string };
type DoneEvent = { id: number };

export default function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      text: "Hello! I'm your Due Diligence AI Assistant. How can I help you today?",
      sender: "agent",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<Set<number>>(new Set())
  const removeListenersRef = useRef<{ removeChunk?: () => void; removeDone?: () => void }>({})
  const [isStreaming, setIsStreaming] = useState(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Fetch user's project data to provide context
  const getUserContext = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return "";

    try {
      let contextParts: string[] = [];

      // Get saved code analyses from local storage
      try {
        const projectsResult = await window.api.getProjectList();
        if (projectsResult.success && projectsResult.projects.length > 0) {
          contextParts.push("=== ANALYZED PROJECTS ===");
          projectsResult.projects.slice(0, 5).forEach((proj: any) => {
            contextParts.push(
              `Project: ${proj.name}\n` +
              `Languages: ${proj.languages?.map((l: any) => l.name).join(", ") || "N/A"}\n` +
              `Total Files: ${proj.totalFiles}, Code Lines: ${proj.totalCode}\n` +
              `Analyzed: ${proj.analyzedDate}`
            );
          });
        }
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      }

      // Get document summaries from Firebase
      try {
        const docsRef = collection(db, "userStats", user.uid, "documents");
        const q = query(docsRef, orderBy("createdAt", "desc"), limit(10));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          contextParts.push("\n=== DOCUMENT SUMMARIES ===");
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            contextParts.push(
              `Document: ${data.documentName}\n` +
              `Project: ${data.projectName}\n` +
              `Summary: ${data.summary?.substring(0, 200)}...`
            );
          });
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      }

      // Get indexed policies
      try {
        const policiesResult = await window.api.policyListPolicies();
        if (policiesResult.success && policiesResult.totalDocs > 0) {
          contextParts.push("\n=== INDEXED POLICIES ===");
          contextParts.push(
            `Total Policy Documents: ${policiesResult.totalDocs}\n` +
            `Total Chunks: ${policiesResult.totalChunks}\n` +
            `Policies: ${policiesResult.policies?.map((p: any) => p.docName).join(", ")}`
          );
        }
      } catch (err) {
        console.error("Failed to fetch policies:", err);
      }

      return contextParts.length > 0
        ? "\n\n--- USER'S PROJECT DATA ---\n" + contextParts.join("\n\n") + "\n--- END USER DATA ---\n\n"
        : "";
    } catch (err) {
      console.error("Error fetching user context:", err);
      return "";
    }
  }, [])

  const handleChunk = useCallback((data: ChunkEvent) => {
    if (!streamingRef.current.has(data.id)) return

    setMessages(prev =>
      prev.map(r =>
        r.id === data.id
          ? {
              ...r,
              text: r.isThinking ? data.chunk : r.text + data.chunk,
              isThinking: false,
            }
          : r
      )
    )
    scrollToBottom()
  }, [scrollToBottom])

  const handleDone = useCallback((data: DoneEvent) => {
    streamingRef.current.delete(data.id)
    if (streamingRef.current.size === 0) {
      setIsStreaming(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }

    if (isOpen) {
      // Clean up previous listeners
      removeListenersRef.current.removeChunk?.()
      removeListenersRef.current.removeDone?.()

      // Set new listeners
      removeListenersRef.current.removeChunk = window.api.onChunk(handleChunk)
      removeListenersRef.current.removeDone = window.api.onDone(handleDone)
    }

    return () => {
      streamingRef.current.clear()
      setIsStreaming(false)
      removeListenersRef.current.removeChunk?.()
      removeListenersRef.current.removeDone?.()
    }
  }, [isOpen, handleChunk, handleDone])

  const handleSend = useCallback(async () => {
    if (inputValue.trim() === "" || isStreaming) return

    const userMessageId = Date.now()
    const responseId = userMessageId + 1

    const userMessage: Message = {
      id: userMessageId,
      text: inputValue,
      sender: "user" as const,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    const originalInput = inputValue;
    setInputValue("")

    streamingRef.current.add(responseId)
    setIsStreaming(true)

    setMessages(prev => [...prev, {
      id: responseId,
      text: "Thinking...",
      sender: "agent" as const,
      timestamp: new Date(),
      isThinking: true
    }])

    // Fetch user's project data to provide context
    const userContext = await getUserContext();

    // Combine user's question with their project data
    const enhancedConext = userContext
      ? `${userContext}User Question: ${originalInput}`
      : originalInput;

    console.log(`Send ID=${userMessageId}, expect response ID=${responseId}`);
    console.log(`Context included: ${userContext ? 'YES' : 'NO'}`);
    window.api.sendChat(userMessageId, originalInput, userContext);
  }, [inputValue, isStreaming, getUserContext])

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className={`chatbot-container ${isOpen ? "open" : ""}`}>
      <div className="chatbot-header">
        <div className="chatbot-header-content">
          <div className="chatbot-avatar">AI</div>
          <div>
            <div className="chatbot-title">Due Diligence Assistant</div>
            <div className="chatbot-status">{isStreaming ? "Typing..." : "Online"}</div>
          </div>
        </div>
        <button className="chatbot-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chatbot-messages" style={{ height: "400px", overflowY: "auto" }}>
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <div className={`message-text ${message.isThinking ? "thinking" : ""}`}>
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-input-container">
        <textarea
          ref={inputRef}
          className="chatbot-input"
          placeholder={isStreaming ? "Please wait..." : "Ask me anything about your projects..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="chatbot-send"
          onClick={handleSend}
          disabled={inputValue.trim() === "" || isStreaming}
        >
          {isStreaming ? "⏳" : "Send"}
        </button>
      </div>
    </div>
  )
}
