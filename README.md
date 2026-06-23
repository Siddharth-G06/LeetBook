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
## 📸 Screenshots

#### The review page
*Your full catalog — filter by difficulty or pattern, search by title, scan everything at once.*

<img width="959" height="499" alt="Screenshot 2026-06-23 154205" src="https://github.com/user-attachments/assets/6f5e16d2-b37f-489f-9a86-b9345019cb3c" />

#### Quick popup
*A glance at your most recent solves without leaving LeetCode.*


<img width="341" height="365" alt="Screenshot 2026-06-23 152148" src="https://github.com/user-attachments/assets/cec7778f-da55-48c4-a175-791b7fdba830" />
<img width="293" height="405" alt="Screenshot 2026-06-23 154132" src="https://github.com/user-attachments/assets/4f75f95a-5c4d-4559-9933-f408b6154b4c" />
<img width="861" height="204" alt="Screenshot 2026-06-23 153309" src="https://github.com/user-attachments/assets/44f6e0dc-3389-4f07-8e36-3259cded88c0" />

#### Filtered by pattern
*Instantly pull every problem you've solved with Dynamic Programming, Two Pointers, or any other tag.*

<img width="959" height="502" alt="Screenshot 2026-06-23 154339" src="https://github.com/user-attachments/assets/dc33c0a4-09bc-47cc-964d-824dc0165e8b" />

#### Expanded solution card
*Full code, detected patterns, and the AI-generated explanation side by side.*

<img width="454" height="284" alt="Screenshot 2026-06-23 151957" src="https://github.com/user-attachments/assets/1a93a111-e5c9-4d27-83dc-462e16978a13" />

<img width="402" height="103" alt="Screenshot 2026-06-23 152134" src="https://github.com/user-attachments/assets/7794ac32-ad0b-4f50-8580-1ed8234fae5f" />

<img width="404" height="336" alt="Screenshot 2026-06-23 153050" src="https://github.com/user-attachments/assets/8d0e644e-5b79-4d01-9c04-1518a86d8751" />

<img width="394" height="293" alt="Screenshot 2026-06-23 153044" src="https://github.com/user-attachments/assets/521a1987-8f0c-452c-b102-73eac7cc3a5f" />

<img width="400" height="370" alt="Screenshot 2026-06-23 153037" src="https://github.com/user-attachments/assets/1ac35fe6-b255-453f-b5be-2383600d7acb" />

---
## 🚀 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
   <img width="959" height="113" alt="Screenshot 2026-06-23 152642" src="https://github.com/user-attachments/assets/8a1b17f7-fa7d-4b58-94d2-f041b01e3f28" />

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

<img width="293" height="405" alt="Screenshot 2026-06-23 154132" src="https://github.com/user-attachments/assets/10d4b934-6132-40c1-9c54-ae4e4191c6a4" />

<img width="812" height="83" alt="Screenshot 2026-06-23 154657" src="https://github.com/user-attachments/assets/d4ec7983-d6dd-406e-a843-3b83451a506e" />


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
- **Manifest V3**: Fully compliant with Chrome's modern Manifest V3 standard.
- **Vanilla Tech Stack**: Built entirely with Vanilla JavaScript, HTML, and CSS (no React/Vue/Tailwind) for absolute maximum performance and zero build-step overhead.
- **Background Service Worker**: Handles long-running imports and listens to browser events to orchestrate data flow efficiently under MV3 constraints.
- **Content Scripts**: Injected into `leetcode.com` to scrape problem constraints, titles, and exact DOM-ordered code lines via Monaco Editor coordinates.

### Importing History
The "Import History" feature uses LeetCode's undocumented REST API (`https://leetcode.com/api/submissions/`) coupled with GraphQL queries (`submissionDetails`). It gracefully handles pagination, avoids rate-limiting with intentional delays, and caches question details to minimize duplicate requests.
