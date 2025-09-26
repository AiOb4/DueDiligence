import { useState } from "react";
import './chatStyles.css';

export default function ChatInput({ onSubmit }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
    setValue(""); // clear input after sending
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input">
      <div className="input-container">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your message..."
          className="input"
        />
        <button type="submit" className="chat-send-btn">Send</button>
      </div>
    </form>
  );
}
