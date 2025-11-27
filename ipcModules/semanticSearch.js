import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import path from "path";
import fs from "fs";
import ollama from "ollama";
import dotenv from 'dotenv';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query,
  limit
} from "firebase/firestore";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const parser = new Parser();
parser.setLanguage(JavaScript);

const SUMMARYSYSTEMPROMPT = `
Summarize these code snippets in 7 words or less each.
Start with the first summary.
Be precise and incomplete sentences are encouraged.
Number each summary to match its snippet.
Separate summaries with a new line.
`;

export const parseDir = async (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath, {recursive : true});

        for (const file of files) {
            const fullPath = path.join(folderPath, file);
            await parseFile(fullPath);
        }
        return true;
    } catch (e) {
        console.error("Directory parse error:", e);
        return false;
    }
}

export const parseFile = async (filePath) => {

    if (filePath.includes('node_modules') || filePath.includes('.git')) return;
    try {
        if (fs.statSync(filePath).isDirectory()) return;
    } catch (e) {
        return; 
    }

    let root;
    const snippets = [];

    try {
        const code = fs.readFileSync(filePath, "utf8");
        const tree = parser.parse(code);
        root = tree.rootNode;
    }
    catch (error) {
        console.log("Parse error");
        return;
    }

    async function visit(node, depth) {
        if (depth < 1 || 8 < depth) return;

        if (node.nodeType === "expression_statement") {
            snippets.push(node.nodeText);
        }
    }

    function walkTree(cursor) {
        function traverse(c, depth) {
            visit(c, depth);
            if (c.gotoFirstChild()) {
                do {
                    traverse(c, depth + 1);
                } while (c.gotoNextSibling());
                c.gotoParent();
            }
        }
        traverse(cursor, 0);
    }

    try {
        walkTree(root.walk());
    }
    catch (error) {
        console.log("Walk error");
        console.error(error);
        return;
    }

    if (snippets.length === 0) return;

    try {
        const joinedSnippets = snippets.map((s, i) => `(${i + 1}) ${s}`).join("\n\n");

        const summaryResponse = await ollama.chat({
            model: "gemma3:4b",
            messages: [{ role: "system", content: SUMMARYSYSTEMPROMPT }, 
                        { role: "user", content: joinedSnippets }],
            keep_alive: 300
        });

        const summary = summaryResponse.message?.content || summaryResponse.output || "";
        const summaries = summary.split(/\n+/).map(line => line.replace(/^\(\d+\)\s*/, "").trim());

        console.log(`[RAG] Summarized ${summaries.length} snippets from ${path.basename(filePath)}`);

        const embeddingResponse = await ollama.embed({
            model: 'nomic-embed-text', 
            input: summaries,
            keep_alive: 300
        });

        const embeddings = embeddingResponse.embeddings;

        const results = snippets.map((snippet, i) => ({
            snippet,
            summary: summaries[i] || "",
            embedding: embeddings[i]
        }));

        const chunksCollection = collection(db, "code_chunks");

        for (const result of results) {
            if (!result.embedding) continue;
            console.log("\n" + result.snippet + "\n" + result.summary + "\n");

            await addDoc(chunksCollection, {
                filePath: filePath,
                content: result.snippet,
                summary: result.summary,
                embedding: result.embedding,
                createdAt: new Date()
            });
        }
        console.log(`[RAG] Indexed ${results.length} chunks from ${path.basename(filePath)}`);
    }
    catch (error) {
        console.error(error);
        console.log("Content generation error");
    }
};

export async function searchCodebase(userQuery) {
  console.log(`[RAG] Searching for: ${userQuery}`);

  try {
    const embeddingResponse = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: userQuery,
    });
    
    const chunksCollection = collection(db, "code_chunks");
    const q = query(chunksCollection, limit(10));

    const snapshot = await getDocs(q);
    
    const results = snapshot.docs.map(doc => ({
      content: doc.data().content,
      summary: doc.data().summary,
      filePath: doc.data().filePath,
      score: 0 
    }));

    console.log(`[RAG] Found ${results.length} relevant chunks.`);
    return results;

  } catch (error) {
    console.error("[RAG] Search error:", error);
    return [];
  }
}