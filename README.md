<div align="center">
  <img src="icons/icon128.png" width="128" alt="LeetBook Icon" style="border-radius: 12px; margin-bottom: 20px;">
  <h1>LeetBook</h1>
  <p><b>Your personal LeetCode research journal — automatic capture, pattern detection, and AI-powered explanations.</b></p>
</div>

<hr>

**LeetBook** is a Chrome Extension designed for competitive programmers and software engineers preparing for interviews. Instead of losing your LeetCode progress to the void, LeetBook acts as a beautifully designed "lab notebook" that automatically logs your code, detects algorithmic patterns, groups multi-language solutions, and uses AI (Local Ollama or Google Gemini) to generate deep-dive explanations.

## ✨ Features

- **Live Capture**: Automatically intercepts and logs your successful LeetCode submissions in the background, perfectly preserving your exact code structure.
- **Historical Import**: Pulls your complete history of past accepted submissions (requires an active LeetCode session).
- **Multi-Language Grouping**: Solved the same problem in Python, Java, and C++? LeetBook merges them into a single problem card with seamless language-switching tabs.
- **Rule-Based Pattern Detection**: Automatically scans your code and tags it with standard algorithmic patterns (e.g., Two Pointers, Dynamic Programming, Sliding Window, Backtracking).
- **Dual AI Explanations**: 
  - **Local Privacy (Ollama)**: Run models locally (like `llama3.1` or `qwen3-coder`) for completely private, offline code analysis.
  - **Cloud Speed (Google Gemini)**: Use Google's Gemini API for lighting-fast, highly accurate explanations.
- **Lab Notebook Aesthetic**: A distinctive, non-generic dark mode interface mimicking an index card catalog, built completely without heavy frameworks.

---

## 🚀 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `solution-log-extension` folder.
5. The extension will now be active. Pin the LeetBook icon to your toolbar for easy access!

---

## 🤖 Setting Up AI Providers (Optional)

LeetBook features an advanced 2-phase prompt system that acts as a senior programming coach. If you don't configure AI, the extension still works perfectly as a local code repository.

To configure AI, open the LeetBook Review Page and click the **Settings ⚙️ gear** in the top right corner.

### Option A: Google Gemini API (Recommended)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and generate a free API key.
2. Open LeetBook Settings.
3. Paste the key into the **API Key** field under the Gemini section.
4. The default model is `gemini-2.5-flash` (or use `gemini-1.5-flash` / `gemini-2.0-flash`).
5. Click **Save Settings**.

### Option B: Local Ollama
1. Install [Ollama](https://ollama.com/) on your machine.
2. Run `ollama pull llama3.1` (or your preferred coding model) in your terminal.
3. **CRITICAL — Fix CORS:** Ollama blocks cross-origin requests by default. You must start Ollama with the allowed origins environment variable for the Chrome Extension to communicate with it.

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
4. Open LeetBook Settings.
5. Ensure the endpoint is `http://localhost:11434` and the model name matches what you pulled.
6. Click **Save Settings**.

---

## 🛠️ Developer Notes

### Architecture
- **Vanilla Tech Stack**: Built entirely with Vanilla JavaScript, HTML, and CSS (no React/Vue/Tailwind) for absolute maximum performance and zero build-step overhead.
- **Background Service Worker**: Handles long-running imports and listens for `chrome.webRequest` events to intercept live submissions.
- **Content Scripts**: Injected into `leetcode.com` to scrape problem constraints, titles, and exact DOM-ordered code lines via Monaco Editor coordinates.

### Importing History
The "Import History" feature uses LeetCode's undocumented REST API (`https://leetcode.com/api/submissions/`) coupled with GraphQL queries (`submissionDetails`). It gracefully handles pagination, avoids rate-limiting with intentional delays, and caches question details to minimize duplicate requests.
