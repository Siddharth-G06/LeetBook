import { generateWithOllama } from './ollamaProvider.js';
import { generateWithGemini } from './geminiProvider.js';

export async function generateExplanation(solution, timeoutMs = 300000, providerOverride = null) {
  // 1. Caching Check
  if (solution.llmExplanation) {
    return solution.llmExplanation;
  }

  // 2. Read Provider Settings
  const { aiSettings } = await chrome.storage.local.get("aiSettings");
  
  // Safe defaults if settings don't exist yet
  const settings = aiSettings || {
    provider: "ollama",
    ollama: { endpoint: "http://localhost:11434", model: "llama3.1" },
    gemini: { apiKey: "", model: "gemini-2.5-flash" }
  };

  const provider = providerOverride || settings.provider || "ollama";
  const prompt = getPromptTemplate(solution);

  // 3. Route Request
  try {
    if (provider === "gemini") {
      return await generateWithGemini(prompt, settings.gemini || {}, timeoutMs);
    } else {
      return await generateWithOllama(prompt, settings.ollama || {}, timeoutMs);
    }
  } catch (err) {
    throw err;
  }
}

// Keeping the highly-tuned 2-Phase Prompt that works excellently for LeetCode
function getPromptTemplate(solution) {
  const title = solution.title || "Unknown Problem";
  const problemText = solution.problemText || "";
  const language = solution.language || "Unknown Language";
  const code = solution.code || "";

  return `You are a senior competitive programming coach and algorithm expert.

═══════════════════════════════════════════════════
PHASE 1 — PROBLEM ANALYSIS (read this first, BEFORE looking at any code)
═══════════════════════════════════════════════════

LeetCode Problem: "${title}"

Problem Description:
${problemText ? problemText.substring(0, 3000) : "(Not available — infer from the title)"}

Based ONLY on the problem description above (ignore any code for now):
- What is the simplest brute-force approach?
- What is the true optimal approach (best time/space complexity), considering ALL constraints stated in the problem?
- Are there any important constraints (e.g., "must not convert to integer", "must use O(1) space") that restrict which approaches are valid?

═══════════════════════════════════════════════════
PHASE 2 — STUDENT'S SUBMISSION
═══════════════════════════════════════════════════

The student solved this problem in ${language}. Here is their code:
\`\`\`${language}
${code}
\`\`\`

Now produce your response in EXACTLY this format. Do NOT skip any section:

---
## 1. Your Solution
**Idea:** One sentence describing what the student's code does (based on the code, not the problem).
**Steps:**
- Step-by-step walkthrough of the student's actual logic (2-5 bullet points)
**Time Complexity:** O(...)
**Space Complexity:** O(...)
**Note:** If the student's approach violates any problem constraints (e.g., they converted strings to integers when forbidden), or is suboptimal compared to the best known solution, clearly state that here in 1-2 sentences.

## 2. Brute Force Approach
*(Derived from the problem description — independent of the student's code)*
**Idea:** The simplest valid approach to solve this problem.
**Steps:**
- Step-by-step (2-4 bullet points)
**Time Complexity:** O(...)
**Space Complexity:** O(...)

## 3. Optimal Approach
*(Derived from the problem description — independent of the student's code)*
**Idea:** The best known approach, respecting ALL problem constraints.
**Steps:**
- Step-by-step (2-5 bullet points)
**Time Complexity:** O(...)
**Space Complexity:** O(...)

## 4. Pattern Tag
State the core algorithmic pattern in 2-6 words (e.g., "Two Pointers with Carry", "Sliding Window", "Bottom-Up DP").
---

Be precise and educational. If the student's solution and the optimal solution are the same, say so explicitly.`;
}
