import { useState, useEffect, useRef } from 'react';
import ollama from 'ollama';
import ChatInput from '../components/ChatInput';
import Message from '../components/Message';
import '../components/chatStyles.css';

const systemPrompt = `
You are a member of a professional due diligence team. 
Your role is to collaborate with colleagues to evaluate companies, projects, and investments. 
Always respond as a knowledgeable, detail-oriented team member. 

Provide answers ONLY in structured bullet points, grouped into these sections:
- 📌 Key Facts  
- ✅ Opportunities  
- ⚠️ Risks  
- ❓ Open Questions / Assumptions  

After the bullet points, always include a **closing summary line** starting with:  
"🔎 Overall Assessment: ..."  

Keep responses concise and professional.  
If a section has no content, include it anyway with “None identified.”  
Maintain a neutral, factual tone suitable for internal team discussions.  
Do not write long paragraphs and do not break character as a team member.
`;

export default function Chat() {
  const [responses, setResponses] = useState([]); // array of {id, prompt, answer}
  const streamingRef = useRef(new Set()); // track in-flight stream ids
  const chatHistory = useRef([]);

  // cleanup on unmount: cancel all streams
  useEffect(() => () => streamingRef.current.clear(), []);

  const handleSubmit = (promptText) => {

    const id = Date.now() + Math.random(); // unique id
    // show the user's message immediately
    setResponses(prev => [...prev, { id, prompt: promptText, answer: "" }]);

    // light weight context window
    // Keep only the last 10 messages
    chatHistory.current = chatHistory.current.slice(-10);

    // start streaming for this item (fire-and-forget)
    (async () => {
      streamingRef.current.add(id);
      try {
        const stream = await ollama.chat({
          model: "gemma3:4b",
          messages: [{ role: "system", content: systemPrompt }, 
                    ...chatHistory.current,
                    { role: "user", content: promptText }],
          stream: true,
        });
        
        let fullResponse = "";
        for await (const part of stream) {
          if (!streamingRef.current.has(id)) break; // cancelled
          const chunk = part?.message?.content ?? "";
          // append chunk to the matching response's answer
          setResponses(prev =>
            prev.map(r => (r.id === id ? { ...r, answer: r.answer + chunk } : r))
          );
          fullResponse += chunk;
        }
        // add response to context window
        chatHistory.current.push({ role: "assistant", content: fullResponse });
        //chatHistory.current = chatHistoryRef.current.slice(-10);
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
