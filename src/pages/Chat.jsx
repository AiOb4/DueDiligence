import { useState, useEffect, useRef } from 'react';
import ChatInput from '../components/ChatInput';
import Message from '../components/Message';
import '../components/chatStyles.css';

export default function Chat() {
  const [responses, setResponses] = useState([]); // array of {id, prompt, answer}
  const streamingRef = useRef(new Set()); // track stream ids

  useEffect(() => {

    // Handle stream chunks
    const handleChunk = ({ id, chunk }) => {
      if (!streamingRef.current.has(id)) return;

      setResponses(prev =>
        prev.map(r => r.id === id ? { ...r, answer: r.answer + chunk } : r)
      );
    };

    // Handle stream completion
    const handleDone = ({ id }) => {
      streamingRef.current.delete(id);
    };

    // declare stream listeners --> return remover functions for unmount
    const removeChunk = window.api.onChunk((data) => {
      if (data) handleChunk(data);
    });

    const removeDone = window.api.onDone((data) => {
      if (data) handleDone(data);
    });

    window.scrollTo(0, document.body.scrollHeight);

    // Cleanup
    return () => {
      streamingRef.current.clear();
      removeChunk();
      removeDone();
    };
  }, []);

  const handleSubmit = (promptText) => {
    const id = Date.now() + Math.random(); // unique id

    // show user's message
    setResponses(prev => [...prev, { id, prompt: promptText, answer: "" }]);
    streamingRef.current.add(id);

    // send prompt to main
    window.api.sendChat(id, promptText);
  };

  return (
    <div className = 'chat'>
      <h1>Chat With Team Member</h1>

      <div className = 'chat-messages'>
        {responses.map(r => (
          <div className = 'messageGroup' key={r.id}>
            <Message sender="You" answer={r.prompt} />
            <Message sender="AI" answer={r.answer} />
          </div>
        ))}
      </div>
      <ChatInput onSubmit={handleSubmit} />
    </div>
  );
}
