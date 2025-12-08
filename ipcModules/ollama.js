import ollama from "ollama";
import { ipcMain } from "electron";

const SYSTEMPROMPT = `
You are a member of a professional due diligence team with access to the user's project data.
Your role is to collaborate with colleagues to evaluate companies, projects, and investments.
Always respond as a knowledgeable, detail-oriented team member.

IMPORTANT: When the user's question relates to their analyzed projects, document summaries, or indexed policies,
USE THE PROVIDED PROJECT DATA in your response. The data will be included in the prompt under "USER'S PROJECT DATA".
Reference specific projects, documents, or metrics when answering questions about the user's work.

Provide answers ONLY in structured bullet points, grouped into these sections:
- Key Facts
- Opportunities
- Risks
- Open Questions / Assumptions

After the bullet points, always include a **closing summary line** starting with:
"Overall Assessment: ..."

Keep responses concise and professional.
If a section has no content, include it anyway with "None identified."
Maintain a neutral, factual tone suitable for internal team discussions.
Do not write long paragraphs and do not break character as a team member.
`;

let chatHistory = [];

ipcMain.on('ollamaChatStream', async (event, {id, promptText}) => {

  const responseId = id + 1;

  try {
    const stream = await ollama.chat({
      model: "gemma3:4b",
      messages: [{ role: "system", content: SYSTEMPROMPT }, 
                  ...chatHistory,
                  { role: "user", content: promptText }],
      stream: true,
      keep_alive: 300
    });

    let fullResponse = "";
    for await (const part of stream) {
      const chunk = part?.message?.content ?? "";
      fullResponse += chunk;
      event.sender.send('ollamaChatChunk', { id: responseId, chunk: chunk }); // send token-by-token
    }

    // light weight context window
    // Keep only the last 10 messages
    // add prompt and response to context window
    chatHistory = chatHistory.slice(-10);
    chatHistory.push({ role: "user", content: promptText });
    chatHistory.push({ role: "assistant", content: fullResponse });

    // end stream
    event.sender.send("ollamaChatDone", { id: responseId }); 

  } catch (err) {
    console.error("Streaming error:", err);
    event.sender.send("ollamaChatChunk", { id: responseId, chunk: `\n\n[Error: ${err.message}]` });
    event.sender.send("ollamaChatDone", { id: responseId });
  }
});

ipcMain.on('ollamaEmbed', async (event, {promptText}) => {

  try {
    const data = await ollama.embeddings({ 
      model: 'nomic-embed-text', 
      prompt: promptText 
    })
    return { success: true, data };

  } catch (err) {
    console.error("Embedding error:", err);
    return { success: false, err };
  }
});