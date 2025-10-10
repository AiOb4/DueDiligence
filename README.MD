# Due Diligence App

This is the **Due Diligence App**, a tool designed to assist with due diligence tasks efficiently. This guide explains how to set up the app for development.

---

## Prerequisites

Before running the app, make sure you have the following installed:

1. **Node.js & npm** – [Download here](https://nodejs.org/)  
2. **Ollama** – Install from the [Ollama website](https://ollama.com/)  
3. **Gemma3:4b model** – Download via Ollama

Ollama will be bundled or put in the cloud somewhere in production

---

## Instalation

    git clone https://github.com/AiOb4/DueDiligence

    cd DueDiligence

    npm install

    npm run dev

This should open an electron application with a chat window to talk with ollama, and a page to run the scc (code counter)