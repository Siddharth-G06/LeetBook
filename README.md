# Solution Log

A researcher's lab notebook for LeetCode submissions, featuring automatic capture, pattern detection, and local AI explanations.

## Features
- **Live Capture**: Automatically logs your successful LeetCode submissions in the background.
- **Import History**: Pulls your complete history of past accepted submissions (requires active LeetCode session).
- **Rule-Based Pattern Detection**: Automatically tags your code with standard algorithmic patterns (Two Pointers, DP, Sliding Window, etc.).
- **Local AI Explanations**: Uses [Ollama](https://ollama.com/) running locally to generate concise explanations of your code without sending data to a third party.
- **Lab Notebook Aesthetic**: A distinctive, non-generic dark mode interface mimicking an index card catalog.

## Installation for Testing
1. Download or clone this folder.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `solution-log-extension` folder.
5. The extension will now be active. Pin the extension to your toolbar for easy access.

## Setting Up Local AI (Optional)
This extension features completely private AI explanations. If you don't set this up, the extension will gracefully fall back to just storing your code.
1. Install [Ollama](https://ollama.com/).
2. Run `ollama pull llama3.1` in your terminal to download the model.
3. **CRITICAL — Fix CORS (required for browser extensions):** Ollama blocks cross-origin requests by default, which causes a `403 Forbidden` error. You must always start Ollama with the env var below:

   **Mac/Linux:**
   ```bash
   OLLAMA_ORIGINS="*" ollama serve
   ```
   **Windows (Command Prompt):**
   ```cmd
   set OLLAMA_ORIGINS=* && ollama serve
   ```
   **Windows (PowerShell):**
   ```powershell
   $env:OLLAMA_ORIGINS="*"; ollama serve
   ```

4. Open the extension popup, click the ⚙️ icon, and check **"Enable local AI Explanations"**.
5. If you see a 403 error in the extension, it means Ollama is running without the env var — restart it with the command above.

## Developer Notes: Importing History
The "Import History" feature uses LeetCode's undocumented REST API (`https://leetcode.com/api/submissions/`). It requires you to be logged into LeetCode on your browser. This endpoint returns the submission metadata and the raw source code seamlessly in JSON format.
