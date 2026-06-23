console.log("Solution Log: Content script loaded.");

// ─── Language normalisation ───────────────────────────────────────────────────
const LANG_MAP = {
  python: "Python",
  python3: "Python3",
  c: "C",
  cpp: "C++",
  java: "Java",
  javascript: "JavaScript",
  typescript: "TypeScript",
  csharp: "C#",
  golang: "Go",
  go: "Go",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  rust: "Rust",
  php: "PHP",
  mysql: "MySQL",
  mssql: "MS SQL",
  oraclesql: "Oracle SQL",
  bash: "Bash",
  r: "R",
  racket: "Racket",
  erlang: "Erlang",
  elixir: "Elixir",
};

function normalizeLang(lang) {
  if (!lang) return "Unknown";
  return LANG_MAP[lang.toLowerCase()] || (lang.charAt(0).toUpperCase() + lang.slice(1));
}

// ─── Live Submission Capture ──────────────────────────────────────────────────

async function extractSubmissionData() {
  try {
    let title = "Unknown Problem";
    const path = window.location.pathname;
    const match = path.match(/\/problems\/([^\/]+)/);
    let titleSlug = "";
    if (match && match[1]) {
      titleSlug = match[1];
      title = titleSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Extract code synchronously FIRST — LeetCode unmounts the editor quickly.
    let code = "";
    const codeLines = document.querySelectorAll('.view-lines .view-line');
    if (codeLines.length > 0) {
      code = Array.from(codeLines)
        .map(line => ({
          text: line.innerText,
          top: parseFloat(line.style.top) || 0
        }))
        .sort((a, b) => a.top - b.top)
        .map(item => item.text)
        .join('\n');
    } else {
      const codeBlock = document.querySelector('code');
      if (codeBlock) code = codeBlock.innerText;
    }

    const tagElements = document.querySelectorAll('a[href^="/tag/"]');
    const tags = Array.from(tagElements).map(el => el.innerText.trim());

    const langElement =
      document.querySelector('[data-cy="lang-select"]') ||
      document.querySelector('.ant-select-selection-item');
    const language = langElement ? langElement.innerText.trim() : "Unknown";

    const qData = await fetchQuestionData(titleSlug);

    return {
      title,
      url: window.location.href.split('/submissions/')[0],
      difficulty: qData.difficulty,
      problemText: qData.problemText,
      tags,
      code,
      language,
      dateAdded: new Date().toISOString(),
      llmExplanation: null,
      timeComplexity: null,
      spaceComplexity: null,
      notes: null,
    };
  } catch (error) {
    console.warn("Solution Log: Failed to extract submission data.", error);
    return null;
  }
}

let recentlyProcessed = false;

const observer = new MutationObserver(async (mutations) => {
  if (recentlyProcessed) return;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      const successHeader =
        document.querySelector('[data-e2e-locator="submission-result"]') ||
        document.querySelector('.text-success');
      if (successHeader && successHeader.innerText.includes("Accepted")) {
        recentlyProcessed = true;
        const data = await extractSubmissionData();
        if (data && data.code && data.code.trim().length > 0) {
          chrome.runtime.sendMessage({ type: "NEW_SUBMISSION", payload: data });
        }
        setTimeout(() => { recentlyProcessed = false; }, 5000);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── Import Logic ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "BEGIN_IMPORT") {
    importSubmissionHistory(message.existingKeys);
  }
});

const questionCache = new Map();
const codeCache = new Map(); // submissionId → code string

function stripHtml(html) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

async function fetchQuestionData(titleSlug) {
  if (!titleSlug) return { difficulty: 'Unknown', problemText: '' };
  if (questionCache.has(titleSlug)) return questionCache.get(titleSlug);
  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: `query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) { difficulty, content }
        }`,
        variables: { titleSlug },
      }),
    });
    if (!res.ok) return { difficulty: 'Unknown', problemText: '' };
    const j = await res.json();
    const q = j?.data?.question;
    const result = {
      difficulty: q?.difficulty || 'Unknown',
      problemText: q?.content ? stripHtml(q.content) : '',
    };
    questionCache.set(titleSlug, result);
    return result;
  } catch {
    return { difficulty: 'Unknown', problemText: '' };
  }
}

/**
 * Fetches the actual source code for a submission using LeetCode's
 * submissionDetails GraphQL query.
 *
 * The older REST API (/api/submissions/) only returns `code` for very
 * recent submissions and omits it (or returns "") for older ones.
 * The submissionDetails query is the reliable way to get code by ID.
 */
async function fetchSubmissionCode(submissionId) {
  if (codeCache.has(submissionId)) return codeCache.get(submissionId);
  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        operationName: 'submissionDetails',
        query: `query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            code
          }
        }`,
        variables: { submissionId: parseInt(submissionId, 10) },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const code = j?.data?.submissionDetails?.code || null;
    if (code) codeCache.set(submissionId, code);
    return code;
  } catch {
    return null;
  }
}

/**
 * Extracts the numeric submission ID from a LeetCode submission URL.
 * URL forms seen in the wild:
 *   /submissions/detail/1234567890/
 *   /submissions/1234567890/
 */
function extractSubmissionId(url) {
  if (!url) return null;
  const m = url.match(/\/(?:detail\/)?(\d+)\/?$/);
  return m ? m[1] : null;
}

async function importSubmissionHistory(existingKeys) {
  try {
    let offset = 0;
    const limit = 20;
    let processed = 0;

    while (true) {
      chrome.runtime.sendMessage({
        type: "IMPORT_BATCH",
        payload: { status: "progress", current: processed },
      });

      let json;
      try {
        const res = await fetch(
          `https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`,
          { credentials: 'include' }
        );
        if (res.status === 403 || res.status === 401) {
          throw new Error("Not logged in to LeetCode, or session expired. Please log in and try again.");
        }
        if (!res.ok) throw new Error(`LeetCode API error: HTTP ${res.status}`);
        json = await res.json();
      } catch (fetchErr) {
        throw fetchErr;
      }

      if (!json || typeof json !== 'object') {
        throw new Error("Unexpected response from LeetCode API. Are you logged in?");
      }

      if (!json.submissions_dump) {
        if (offset === 0) {
          throw new Error("Could not read submissions. Make sure you are logged into LeetCode.");
        }
        break; // past the last page
      }

      const submissions = json.submissions_dump;
      if (submissions.length === 0) break;

      const batch = [];

      for (const sub of submissions) {
        if (sub.status_display !== "Accepted") {
          processed++;
          continue;
        }

        const language = normalizeLang(sub.lang);
        const title = sub.title || "Unknown Problem";
        const key = `${title}|${language}`;

        if (existingKeys.includes(key)) {
          processed++;
          continue;
        }

        const titleSlug =
          sub.title_slug ||
          title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // ── Fetch code ──────────────────────────────────────────────────────
        // The REST API returns `sub.code` for very recent submissions only.
        // For all others we fall back to the submissionDetails GraphQL query.
        let code = (sub.code && sub.code.trim()) ? sub.code : null;

        if (!code) {
          const subId = sub.id || extractSubmissionId(sub.url);
          if (subId) {
            code = await fetchSubmissionCode(subId);
            await new Promise(r => setTimeout(r, 300)); // rate-limit courtesy
          }
        }

        if (!code) {
          // Truly can't get the code — skip rather than save an empty record
          console.warn(`Solution Log: Could not fetch code for "${title}" (${language}), skipping.`);
          processed++;
          continue;
        }

        // ── Fetch problem metadata ──────────────────────────────────────────
        const qData = await fetchQuestionData(titleSlug);
        await new Promise(r => setTimeout(r, 300));

        batch.push({
          title,
          url: "https://leetcode.com" + (sub.url || ''),
          difficulty: qData.difficulty,
          problemText: qData.problemText,
          tags: [],
          language,
          code,
          dateAdded: new Date((sub.timestamp || 0) * 1000).toISOString(),
          llmExplanation: null,
          timeComplexity: null,
          spaceComplexity: null,
          notes: null,
        });

        existingKeys.push(key);
        processed++;
      }

      if (batch.length > 0) {
        chrome.runtime.sendMessage({
          type: "IMPORT_BATCH",
          payload: { status: "batch", batch, currentTotal: processed },
        });
      }

      if (!json.has_next) break;

      offset += limit;
      await new Promise(r => setTimeout(r, 1000));
    }

    chrome.runtime.sendMessage({
      type: "IMPORT_BATCH",
      payload: { status: "complete" },
    });

  } catch (err) {
    console.error("Solution Log: Import failed:", err);
    chrome.runtime.sendMessage({
      type: "IMPORT_BATCH",
      payload: { status: "error", message: err.message },
    });
  }
}