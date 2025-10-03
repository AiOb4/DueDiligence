import './chatStyles.css';
import ReactMarkdown from "react-markdown";

export default function Message({ sender, answer }) {
  return (
    <div className={`message ${sender === 'AI' ? "ai" : "user"}`}>
      <div className="text-box">
        <strong>{sender}:</strong>
        <ReactMarkdown>{answer}</ReactMarkdown>
      </div>
    </div>
  );
}