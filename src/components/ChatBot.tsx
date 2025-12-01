"use client"

import React from "react"
import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect, useCallback } from "react"

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

  // ✅ FIX 1: isStreaming computed value (used in disabled checks)
  const isStreaming = streamingRef.current.size > 0

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // ✅ FIX 2: Move handlers OUTSIDE useEffect + useCallback
  const handleChunk = useCallback((data: ChunkEvent) => {
    console.log(`📦 Browser chunk ${data.id}: "${data.chunk}"`)
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
    console.log(`✅ Browser stream done: ${data.id}`)
    streamingRef.current.delete(data.id)
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
      removeListenersRef.current.removeChunk?.()
      removeListenersRef.current.removeDone?.()
    }
  }, [isOpen, handleChunk, handleDone]) // ✅ Add dependencies

  // ✅ FIX 3: handleSend uses isStreaming from ref
  const handleSend = useCallback(() => {
    if (inputValue.trim() === "" || isStreaming) return

    const userMessageId = Date.now() // ✅ Fix ID collision
    const responseId = userMessageId + 1

    const userMessage: Message = {
      id: userMessageId,
      text: inputValue,
      sender: "user" as const,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")

    streamingRef.current.add(responseId)

    setMessages(prev => [...prev, {
      id: responseId,
      text: "Thinking...",
      sender: "agent" as const,
      timestamp: new Date(),
      isThinking: true
    }])

    console.log(`🚀 Send ID=${userMessageId}, expect response ID=${responseId}`)
    window.api.sendChat(userMessageId, inputValue)
  }, [inputValue, isStreaming])

  // ✅ FIX 4: handleKeyPress uses handleSend
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
          onKeyDown={handleKeyPress} // ✅ onKeyDown instead of onKeyPress
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
