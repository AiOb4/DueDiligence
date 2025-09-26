import { useState, useEffect, useRef } from 'react';
import ollama from 'ollama';
import ChatInput from '../components/ChatInput';
import Message from '../components/Message';
import '../components/chatStyles.css';

export default function Chat() {
  const [responses, setResponses] = useState([]); // array of {id, prompt, answer}
  const streamingRef = useRef(new Set()); // track in-flight stream ids

  // cleanup on unmount: cancel all streams
  useEffect(() => () => streamingRef.current.clear(), []);

  const handleSubmit = (promptText) => {

    const id = Date.now() + Math.random(); // unique id
    // show the user's message immediately
    setResponses(prev => [...prev, { id, prompt: promptText, answer: "" }]);

    // start streaming for this item (fire-and-forget)
    (async () => {
      streamingRef.current.add(id);
      try {
        const stream = await ollama.chat({
          model: "gemma3:4b",
          messages: [{ role: "user", content: promptText }],
          stream: true,
        });

        for await (const part of stream) {
          if (!streamingRef.current.has(id)) break; // cancelled
          const chunk = part?.message?.content ?? "";
          // append chunk to the matching response's answer
          setResponses(prev =>
            prev.map(r => (r.id === id ? { ...r, answer: r.answer + chunk } : r))
          );
        }
      } catch (err) {
        console.error("Stream error", err);
        setResponses(prev =>
          prev.map(r => (r.id === id ? { ...r, answer: r.answer + `\n\n[Error: ${err.message}]` } : r))
        );
      } finally {
        streamingRef.current.delete(id);
      }
    })();
  };

  return (
    <div>
      <h1>Chat With Team Member</h1>

      <div className = 'chat-messages'>
        {responses.map(r => (
          <div key={r.id}>
            <Message sender="You" answer={r.prompt} />
            <Message sender="AI" answer={r.answer} />
          </div>
        ))}
      </div>

      <ChatInput onSubmit={handleSubmit} />
    </div>
  );
}
