import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import path from "path";
import fs from "fs";
import ollama from "ollama";

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

    const files = fs.readdirSync(folderPath, {recursive : true});

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        parseFile(fullPath);
    }
}

export const parseFile = async (filePath) => {

    let root;
    const snippets = [];

    try {
        const code = fs.readFileSync(filePath, "utf8");
        const tree = parser.parse(code);
        root = tree.rootNode;
    }
    catch (error) {
        console.log("Parse error");
    }

    async function visit(node, depth) {

        // ignore the root node (its the entire file) and ignore deep nests
        if (depth < 1 || 8 < depth) return;

        // if a function, process
        if (node.nodeType === "expression_statement") {

            //const name = node.nodeType;
            snippets.push(node.nodeText);
        }
    }

    function walkTree(cursor) {
        // recursive function
        function traverse(c, depth) {

            // Run the callback for the current node
            visit(c, depth);

            // If this node has children, descend into them
            if (c.gotoFirstChild()) {
                do {
                    traverse(c, depth + 1);
                } while (c.gotoNextSibling());

                // Return to parent when done exploring children
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
    }

    try {
        // summarize snippets

        const joinedSnippets = snippets.map((s, i) => `(${i + 1}) ${s}`).join("\n\n");

        const summaryResponse = await ollama.chat({
            model: "gemma3:4b",
            messages: [{ role: "system", content: SUMMARYSYSTEMPROMPT }, 
                        { role: "user", content: joinedSnippets }],
            keep_alive: 300
        });

        const summary = summaryResponse.message?.content || summaryResponse.output || "";
        const summaries = summary.split(/\n+/).map(line => line.replace(/^\(\d+\)\s*/, "").trim());

        console.log("Summaries:", summaries);

        // embed snippet
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

        for (const result of results) {
            console.log("\n" + result.snippet + "\n" + result.summary + "\n");
        }
    }
    catch (error) {
        console.error(error);
        console.log("Content generation error");
    }
};

