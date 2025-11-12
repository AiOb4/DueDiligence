"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

interface Message {
  id: number
  text: string
  sender: "user" | "agent"
  timestamp: Date
  isThinking?: boolean;
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
  const streamingRef = useRef<Set<number>>(new Set()); // track stream ids

  const scrollToBottom = () => {messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })};

  useEffect(() => {

    if (isOpen) {
      // Wait until next tick to ensure textarea is in the DOM
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }

    // Handle stream chunks
    const handleChunk = ({ id, chunk } : ChunkEvent) => {
      if (!streamingRef.current.has(id)) return;

      setMessages(prev =>
        prev.map(r => r.id === id ? { ...r, 
          text: r.isThinking ? chunk : r.text + chunk,
          isThinking: false,
        } : r)
      );

      scrollToBottom();
    };

    // Handle stream completion
    const handleDone = ({ id } : DoneEvent) => {
      streamingRef.current.delete(id);
    };

    // declare stream listeners --> returns remover functions for unmount
    const removeChunk = window.api.onChunk(({id, chunk}) => {
      if (chunk) handleChunk({ id: Number(id), chunk });
    });

    const removeDone = window.api.onDone(({id}) => {
      if (id) handleDone({ id: Number(id) });
    });

    inputRef.current?.focus();

    // Cleanup
    return () => {
      streamingRef.current.clear();
      removeChunk();
      removeDone();
    };
  }, [isOpen]);
  // Do NOT make messages as a depdnancy, 
  // this causes the AI chunk stream to not update.
  // onChunk will only run when messages changes, 
  // but messages only changes from onChunk


  const handleSend = () => {
    if (inputValue.trim() === "") return

    const userMessage: Message = {
      id: messages.length,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    // show user message
    setMessages([...messages, userMessage])
    setInputValue("")

    // listen for stream id
    streamingRef.current.add(userMessage.id + 1);

    // set empty response
    setMessages(prev => [...prev, 
      { id: userMessage.id + 1,
        text: "Thinking...",
        sender: "agent" as const, 
        timestamp: new Date(),
        isThinking: true
      } as Message]);

    // send chat, sends back chunks with given id + 1 (the new responseId)
    window.api.sendChat(userMessage.id, userMessage.text);
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
          ref = {inputRef}
          autoFocus
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
