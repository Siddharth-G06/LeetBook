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
//
// Strategy: detect a click on any "Submit" button, then poll LeetCode's own
// /api/submissions/ endpoint (the same one the import feature uses) to check
// for a new Accepted submission. This avoids ALL DOM selector fragility,
// MutationObserver issues, and CSP-blocked script injection.

let isPolling = false;
let lastCapturedId = null;

/**
 * Called when the user clicks Submit on a problem page.
 * Polls for a new Accepted submission every 2 seconds for up to 90 seconds.
 */
async function pollForNewAcceptedSubmission(titleSlug) {
  if (isPolling) return;
  isPolling = true;
  console.log("Solution Log: Polling for new accepted submission...");

  const pollStart = Date.now();
  const maxPollMs = 90_000; // 90 seconds — plenty of time for slow judges
  const intervalMs = 2_000;

  while (Date.now() - pollStart < maxPollMs) {
    await new Promise(r => setTimeout(r, intervalMs));

    try {
      const res = await fetch(
        "https://leetcode.com/api/submissions/?offset=0&limit=5",
        { credentials: "include" }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const submissions = json.submissions_dump || [];

      // Find the most recent submission on this problem
      const recent = submissions.find(
        s => !titleSlug || s.title_slug === titleSlug || s.url?.includes(titleSlug)
      ) || submissions[0];

      if (!recent) continue;

      // Skip if this is a submission we already captured
      if (recent.id && recent.id === lastCapturedId) continue;

      // Only fire on Accepted
      if (recent.status_display !== "Accepted") continue;

      // Only fire on truly recent submissions (submitted in the last 3 minutes)
      const submittedAt = (recent.timestamp || 0) * 1000;
      if (Date.now() - submittedAt > 180_000) continue;

      // ── Got a new Accepted submission ─────────────────────────────────────
      lastCapturedId = recent.id;
      console.log("Solution Log: New accepted submission found:", recent.title, recent.lang);

      const language = normalizeLang(recent.lang);
      const title = recent.title || titleSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || "Unknown Problem";
      const slug = recent.title_slug || titleSlug || "";

      // Get code — REST API includes it for recent submissions; fall back to GraphQL.
      let code = (recent.code && recent.code.trim()) ? recent.code : null;
      if (!code && recent.id) {
        code = await fetchSubmissionCode(recent.id);
      }
      // Final fallback: read from Monaco editor model in the page
      if (!code) {
        try {
          code = window.monaco?.editor?.getModels()?.[0]?.getValue?.() || "";
        } catch (_) {}
      }

      if (!code || !code.trim()) {
        console.warn("Solution Log: Accepted but could not get code, skipping.");
        break;
      }

      const qData = await fetchQuestionData(slug);
      const tags = Array.from(document.querySelectorAll('a[href^="/tag/"]')).map(el => el.innerText.trim());

      const payload = {
        title,
        url: `https://leetcode.com/problems/${slug}/`,
        difficulty: qData.difficulty,
        problemText: qData.problemText,
        tags,
        language,
        code,
        dateAdded: new Date(submittedAt).toISOString(),
        llmExplanation: null,
        timeComplexity: null,
        spaceComplexity: null,
        notes: null,
      };

      chrome.runtime.sendMessage({ type: "NEW_SUBMISSION", payload });
      console.log("Solution Log: Sent to background →", title, language);
      break;

    } catch (err) {
      console.warn("Solution Log: Poll error:", err);
    }
  }

  isPolling = false;
}

/**
 * Detect clicks on the Submit button by text content — works regardless of
 * whatever CSS class or attribute LeetCode uses on the button.
 */
document.addEventListener('click', (e) => {
  // Only on problem pages
  const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
  if (!match) return;

  const btn = e.target.closest('button');
  if (!btn) return;

  // Match by visible text — this is the only stable signal
  const txt = btn.textContent.trim().toLowerCase();
  if (txt === 'submit' || txt === 'submit solution' || txt === 'submit code') {
    const slug = match[1];
    console.log("Solution Log: Submit clicked for", slug);
    // Start polling after a short delay (let LeetCode begin processing first)
    setTimeout(() => pollForNewAcceptedSubmission(slug), 3000);
  }
}, true); // useCapture = true to intercept before any stopPropagation

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