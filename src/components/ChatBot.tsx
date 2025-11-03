"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

interface Message {
  id: number
  text: string
  sender: "user" | "agent"
  timestamp: Date
}

interface ChatBotProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your Due Diligence AI Assistant. How can I help you today?",
      sender: "agent",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (inputValue.trim() === "") return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages([...messages, userMessage])
    setInputValue("")

    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        id: messages.length + 2,
        text: getAgentResponse(inputValue),
        sender: "agent",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, agentMessage])
    }, 1000)
  }

  const getAgentResponse = (userInput: string): string => {
    const input = userInput.toLowerCase()

    if (input.includes("code") || input.includes("analysis")) {
      return "I can help you analyze code repositories. Would you like to start a code analysis? Just provide the repository URL and I'll analyze the codebase for you."
    } else if (input.includes("document") || input.includes("summarize")) {
      return "I can summarize documents for you. Upload a document and I'll provide a comprehensive summary with key insights."
    } else if (input.includes("policy") || input.includes("question")) {
      return "I can answer questions about your policies and documentation. What would you like to know?"
    } else if (input.includes("report")) {
      return "I can generate detailed due diligence reports. What type of report would you like to create?"
    } else if (input.includes("help")) {
      return "I can assist you with: Code Analysis, Document Summarization, Policy Q&A, and Report Generation. What would you like to do?"
    } else {
      return (
        "I understand you're asking about: '" +
        userInput +
        "'. Could you provide more details so I can assist you better?"
      )
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`chatbot-container ${isOpen ? "open" : ""}`}>
      <div className="chatbot-header">
        <div className="chatbot-header-content">
          <div className="chatbot-avatar">AI</div>
          <div>
            <div className="chatbot-title">Due Diligence Assistant</div>
            <div className="chatbot-status">Online</div>
          </div>
        </div>
        <button className="chatbot-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chatbot-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <div className="message-text">{message.text}</div>
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
          className="chatbot-input"
          placeholder="Ask me anything..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
        />
        <button className="chatbot-send" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  )
}
