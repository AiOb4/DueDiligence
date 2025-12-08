# Due Diligence App

This is the **Due Diligence App**, a tool designed to assist with due diligence tasks efficiently. This guide explains how to set up the app for development.

---

## Prerequisites

Before running the app, make sure you have the following installed:

**Node.js & npm** – [Download here](https://nodejs.org/)

---

## Instalation

    git clone https://github.com/AiOb4/DueDiligence

    cd DueDiligence

    npm install

    npm run dev

An application will open to an Authentication page, which will lead to a dashboard and our features.
**Ollama** will auto-download on first run and install the two neccesary models: gemma3:4b and nomic-embed-text.
Each startup will check for updates and handle the instalation.

---

## File Structure

    Electron starts in main.js, there you will find the necesarry functions to open windows, 
    load file from disk, and auto download the latest models from Ollama.

    preload.js provides the bridge from electron to the renderer, in this case, our React App. 
    Preload contains definitions for all the current api functions that can be called in the frontend.

    /src contains the frontend. Inside, 
        /components hold the small pieces for each of our features
        /pages hold the main place where the components get assembled
        /firebase holds logic for the database
        /types holds the type definitions for the api calls to make typescript happy

    /resources hold the binaries for Sloc Cloc and Code (scc), an open source code counter

    /ipcModules hold the logic for our apis and call the backend from firebase, scc, and ollama

## Features

**Code Counting** - uses scc to provide a fast overview of a directory. Outputs lines of code, number of files, and cyclomatic complexity of each file

**Ollama** - core functionality of the app is interacting with an llm to get things done faster

**Policy Q&A** - based on a few stored policies, ollama is able to answer questions from policy documents

**Report Generation** - sum up all findings and statistics in one place

**Code search** - indexes code to extract function usage. Allows user to reliably search the code with natrual language

## Open Issues

1. Ollama could be optimized more

2. Code search needs to be refined, more languages implemented, and create a new dashboard page for usage

3. A large refactor is probably needed to clean up all of our junk