import fs from "fs";
import path from "path";
import ollama from "ollama";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import { ipcMain } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Folder + file for saving the policy index
const RESOURCES_DIR = path.join(__dirname, "resources");
const INDEX_FILE = path.join(RESOURCES_DIR, "policyIndex.json");

// In-memory embedding index
// Each entry: { docName, sectionId, text, embedding }
let policyIndex = [];


// Chunk a big text into semi-manageable pieces.
function chunkText(text, maxChars = 1200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) chunks.push(slice);
    start = end;
  }
  return chunks;
}

async function embedText(text) {
  const { embedding } = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: text,
  });
  return embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

//Persist the current policyIndex to disk.
function saveIndexToDisk() {
  try {
    if (!fs.existsSync(RESOURCES_DIR)) {
      fs.mkdirSync(RESOURCES_DIR, { recursive: true });
    }

    const payload = {
      index: policyIndex,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(INDEX_FILE, JSON.stringify(payload), "utf8");
    console.log(
      `[PolicyQA] Saved policy index to ${INDEX_FILE} (${policyIndex.length} chunks).`
    );
  } catch (err) {
    console.error("[PolicyQA] Failed to save policy index to disk:", err);
  }
}

//Load a saved policy index from disk (if present).
export function loadPolicyIndexFromDisk() {
  try {
    if (!fs.existsSync(INDEX_FILE)) {
      console.log(
        "[PolicyQA] No saved policy index file found, skipping reload."
      );
      return { success: false, reason: "missing" };
    }

    const raw = fs.readFileSync(INDEX_FILE, "utf8");
    const payload = JSON.parse(raw);

    if (!payload || !Array.isArray(payload.index)) {
      console.warn(
        "[PolicyQA] Saved index file has unexpected format, ignoring."
      );
      return { success: false, reason: "bad-format" };
    }

    policyIndex = payload.index;
    console.log(
      `[PolicyQA] Loaded policy index from disk: ${policyIndex.length} chunks.`
    );

    return { success: true, chunkCount: policyIndex.length };
  } catch (err) {
    console.error("[PolicyQA] Failed to load policy index from disk:", err);
    return { success: false, error: err.message };
  }
}

//Clear all policy data (in memory + on disk).
export function clearPolicyIndex() {
  policyIndex = [];
  try {
    if (fs.existsSync(INDEX_FILE)) {
      fs.unlinkSync(INDEX_FILE);
      console.log("[PolicyQA] Deleted saved policy index file:", INDEX_FILE);
    }
  } catch (err) {
    console.error("[PolicyQA] Failed to delete policy index file:", err);
  }
  console.log("[PolicyQA] Policy index cleared (in memory and on disk).");
  return { success: true };
}

/**
 * Read and convert policy file to plain text.
 * Supports: .docx (via mammoth) and plain text (.txt, .md, etc).
 */
async function readPolicyFileAsText(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();

  try {
    if (ext === ".docx") {
      const buffer = fs.readFileSync(fullPath);
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || "";
      console.log(
        "[PolicyQA] mammoth text length for",
        fullPath,
        "=",
        text.length
      );
      return text;
    }

    // Fallback: treat as plain text (txt, md, etc.)
    const text = fs.readFileSync(fullPath, "utf8");
    console.log(
      "[PolicyQA] plain-text file length for",
      fullPath,
      "=",
      text.length
    );
    return text;
  } catch (err) {
    console.error("[PolicyQA] Failed to read/convert policy file:", fullPath, err);
    return "";
  }
}

/**
 * Index / re-index policies given a list of file paths.
 * Merge strategy:
 *  - For each uploaded docName, replace old chunks for that docName
 *  - Keep all other docs intact
 */
export async function indexPolicies(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    console.warn("[PolicyQA] indexPolicies called with no file paths.");
    return { indexedDocs: [], chunkCount: policyIndex.length };
  }

  const newEntries = [];
  const newDocNames = new Set();

  for (const fullPath of filePaths) {
    const text = await readPolicyFileAsText(fullPath);

    if (!text || text.trim().length === 0) {
      console.warn("Policy file is empty or unreadable:", fullPath);
      continue;
    }

    const docName = fullPath.split(/[/\\]/).pop() || fullPath;
    newDocNames.add(docName);

    console.log(
      `[PolicyQA] Read policy file "${docName}", length=${text.length}`
    );

    let chunks = chunkText(text);
    if (!chunks || chunks.length === 0) {
      console.warn(
        `[PolicyQA] No chunks produced for "${docName}", using whole file as a single chunk.`
      );
      chunks = [text];
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;

      try {
        const embedding = await embedText(chunk);
        newEntries.push({
          docName,
          sectionId: `${docName}#${i}`,
          text: chunk,
          embedding,
        });
      } catch (err) {
        console.error("Failed to embed policy chunk", docName, i, err);
      }
    }
  }

  // Merge: remove old entries for updated docs, then add new ones
  if (newEntries.length > 0) {
    const docNameSet = new Set(newEntries.map((e) => e.docName));

    policyIndex = policyIndex.filter(
      (entry) => !docNameSet.has(entry.docName)
    );

    policyIndex.push(...newEntries);
  }

  console.log(
    `[PolicyQA] Finished indexing. New files=${newDocNames.size}, total chunks=${policyIndex.length}`
  );

  saveIndexToDisk();

  return {
    indexedDocs: Array.from(newDocNames),
    chunkCount: policyIndex.length,
  };
}

//List distinct policy documents loaded in the index.
export function listPolicyDocs() {
  const docMap = new Map();

  for (const entry of policyIndex) {
    const info = docMap.get(entry.docName) || {
      docName: entry.docName,
      chunkCount: 0,
    };
    info.chunkCount += 1;
    docMap.set(entry.docName, info);
  }

  const policies = Array.from(docMap.values());

  return {
    success: true,
    policies,
    totalDocs: policies.length,
    totalChunks: policyIndex.length,
  };
}

//Remove all chunks belonging to a specific document name.
export function removePolicyByDocName(docName) {
  const before = policyIndex.length;
  policyIndex = policyIndex.filter((entry) => entry.docName !== docName);
  const after = policyIndex.length;

  saveIndexToDisk();

  console.log(
    `[PolicyQA] Removed policy "${docName}" from index. Removed ${
      before - after
    } chunks. Remaining: ${after}.`
  );

  return {
    success: true,
    removedChunks: before - after,
    remainingChunks: after,
  };
}

//Internal: get top-k chunks for a question via cosine similarity.
async function getTopChunks(question, k = 5) {
  if (policyIndex.length === 0) {
    return [];
  }

  const { embedding: qEmbedding } = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: question,
  });

  const scored = policyIndex.map((entry) => ({
    ...entry,
    score: cosineSimilarity(qEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

//Answer a policy question using the current index + Gemma.
export async function askPolicyQuestion(question) {
  const topChunks = await getTopChunks(question, 5);

  if (!topChunks || topChunks.length === 0) {
    return {
      error: "No policies are indexed. Please upload and index policy files first.",
      answer: "",
      citations: [],
    };
  }

  const contextText = topChunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.docName})\n${c.text}\n`
    )
    .join("\n");

  const prompt = `
You are a due diligence policy assistant.

Use ONLY the Context excerpts from company policies below to answer the Question.
If the answer is not clearly in the Context, say:
"I don't know based on the provided policies."

Context:
${contextText}

Question:
${question}

Answer:
`;

  const resp = await ollama.chat({
    model: "gemma3:4b",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  const answer = resp?.message?.content ?? "";

  const citations = topChunks.map((c) => ({
    docName: c.docName,
    sectionId: c.sectionId,
    sectionPreview:
      c.text.slice(0, 150) + (c.text.length > 150 ? "..." : ""),
  }));

  return {
    answer,
    citations,
  };
}


// Let the user choose policy files to upload
ipcMain.handle("policySelectFiles", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Policy files",
        extensions: ["txt", "md", "docx"],
      },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, filePaths: [] };
  }
  return { success: true, filePaths: result.filePaths };
});

// Build / refresh the policy embedding index from selected files
ipcMain.handle("policyIndexPolicies", async (event, { filePaths }) => {
  try {
    const summary = await indexPolicies(filePaths);
    return { success: true, ...summary };
  } catch (err) {
    console.error("policyIndexPolicies error:", err);
    return { success: false, error: err.message };
  }
});

// Answer a policy question using the indexed policies
ipcMain.handle("policyAskQuestion", async (event, { question }) => {
  try {
    const result = await askPolicyQuestion(question);
    return { success: true, ...result };
  } catch (err) {
    console.error("policyAskQuestion error:", err);
    return { success: false, error: err.message };
  }
});

// Returns a list of all currently indexed policy documents
ipcMain.handle("policyListPolicies", async () => {
  try {
    const result = listPolicyDocs();
    return result;
  } catch (err) {
    console.error("policyListPolicies error:", err);
    return { success: false, error: err.message };
  }
});

// Removes all chunks belonging to a specific policy document
ipcMain.handle("policyRemovePolicy", async (event, { docName }) => {
  try {
    if (!docName) {
      return { success: false, error: "docName is required" };
    }
    const result = removePolicyByDocName(docName);
    return { success: true, ...result };
  } catch (err) {
    console.error("policyRemovePolicy error:", err);
    return { success: false, error: err.message };
  }
});

// Clears the entire policy index
ipcMain.handle("policyClearIndex", async () => {
  try {
    const result = clearPolicyIndex();
    return { success: true, ...result };
  } catch (err) {
    console.error("policyClearIndex error:", err);
    return { success: false, error: err.message };
  }
});