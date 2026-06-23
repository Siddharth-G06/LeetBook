import { detectPatterns } from './analyzer.js';
import { generateExplanation } from './services/aiProvider.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_SUBMISSION") {
    handleNewSubmission(message.payload);
  } else if (message.type === "START_IMPORT") {
    startImportOrchestration();
  } else if (message.type === "IMPORT_BATCH") {
    handleImportBatch(message.payload);
  } else if (message.type === "GENERATE_ON_DEMAND") {
    handleGenerateOnDemand(message.payload);
  }
});

// ─── Live capture ─────────────────────────────────────────────────────────────

async function handleNewSubmission(data) {
  try {
    const patterns = detectPatterns(data.code, data.language);
    data.detectedPatterns = patterns;

    const { aiSettings } = await chrome.storage.local.get("aiSettings");
    const aiExplanationsEnabled = !!aiSettings; // Or any logic to check if they want live AI enabled. Wait, we removed the aiToggle checkbox!

    // Let's assume live AI is enabled if aiSettings exists, or we could just skip it since the checkbox is gone.
    // The user's prompt removed the checkbox and replaced it with provider selection.
    // Let's just always generate it if settings exist, or we can check if they have configured it.
    if (aiSettings) {
      try {
        const explanation = await generateExplanation(data, 3000);
        data.llmExplanation = explanation;
      } catch (e) {
        console.warn("Solution Log: Skipping AI explanation during live capture:", e);
        data.llmExplanation = null;
      }
    }

    await saveSubmission(data);
  } catch (error) {
    console.error("Solution Log: Error handling new submission:", error);
  }
}

async function saveSubmission(newSubmission) {
  const { solutions = [] } = await chrome.storage.local.get("solutions");

  const existingIndex = solutions.findIndex(
    s => s.title === newSubmission.title && s.language === newSubmission.language
  );

  if (existingIndex !== -1) {
    solutions[existingIndex] = { ...solutions[existingIndex], ...newSubmission };
  } else {
    solutions.unshift(newSubmission);
  }

  await chrome.storage.local.set({ solutions });
}

// ─── Import orchestration ─────────────────────────────────────────────────────

let importStats = { newCount: 0, skippedCount: 0 };

/**
 * Sends a message to a tab, retrying up to maxRetries times with a delay.
 * This is needed because MV3 service workers can't reliably wait for a tab
 * to fully load its content script using setTimeout alone.
 */
function sendMessageWithRetry(tabId, message, maxRetries = 5, delayMs = 1500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt() {
      attempts++;
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          if (attempts < maxRetries) {
            setTimeout(attempt, delayMs);
          } else {
            reject(new Error(
              "Cannot reach the LeetCode content script after multiple attempts. " +
              "Please make sure you are logged into leetcode.com, then click 'Import' again."
            ));
          }
        } else {
          resolve(response);
        }
      });
    }

    attempt();
  });
}

async function startImportOrchestration() {
  importStats = { newCount: 0, skippedCount: 0 };

  try {
    const { solutions = [] } = await chrome.storage.local.get("solutions");
    const existingKeys = solutions.map(s => `${s.title}|${s.language}`);

    // Query ALL open LeetCode tabs — the content script runs on all of them
    const tabs = await chrome.tabs.query({ url: "https://leetcode.com/*" });

    // Try each tab one-by-one; use the first one whose content script is alive.
    // This handles the case where the user has multiple LeetCode tabs open
    // (problems page, submissions page, profile, etc.) and one of them may have
    // an orphaned content script from a previous extension reload.
    let dispatched = false;
    for (const tab of tabs) {
      const success = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "BEGIN_IMPORT", existingKeys }, () => {
          resolve(!chrome.runtime.lastError);
        });
      });
      if (success) {
        dispatched = true;
        break;
      }
    }

    if (!dispatched) {
      // No live LeetCode tab found — open one and wait for the content script to load.
      const newTab = await new Promise((resolve) => {
        chrome.tabs.create({ url: "https://leetcode.com/problemset/", active: false }, (tab) => {
          function onUpdated(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(onUpdated);
              setTimeout(() => resolve(tab), 1000); // allow content script to initialise
            }
          }
          chrome.tabs.onUpdated.addListener(onUpdated);
        });
      });

      // One retry on the freshly created tab
      await sendMessageWithRetry(newTab.id, { type: "BEGIN_IMPORT", existingKeys }, 3, 1500);
    }

  } catch (error) {
    chrome.runtime.sendMessage({ type: "IMPORT_ERROR", message: error.message });
  }
}

async function handleImportBatch(payload) {
  if (payload.status === "progress") {
    // Write directly to storage — survives service worker restarts.
    // The popup watches storage.onChanged so it never misses an update.
    await chrome.storage.local.set({
      importState: { status: "running", current: payload.current }
    });
    return;
  }

  if (payload.status === "error") {
    await chrome.storage.local.set({
      importState: { status: "error", message: payload.message }
    });
    return;
  }

  if (payload.status === "complete") {
    await chrome.storage.local.set({
      importState: {
        status: "complete",
        newCount: importStats.newCount,
        skippedCount: importStats.skippedCount
      }
    });
    return;
  }

  // status === "batch" — persist the new solutions
  const { solutions = [] } = await chrome.storage.local.get("solutions");
  let modified = false;

  for (const item of payload.batch) {
    const exists = solutions.some(s => s.title === item.title && s.language === item.language);
    if (!exists) {
      item.detectedPatterns = detectPatterns(item.code, item.language);
      solutions.unshift(item);
      importStats.newCount++;
      modified = true;
    } else {
      importStats.skippedCount++;
    }
  }

  if (modified) {
    await chrome.storage.local.set({ solutions });
  }

  // Also update the running progress counter after saving the batch
  await chrome.storage.local.set({
    importState: { status: "running", current: payload.currentTotal }
  });
}

// ─── On-demand AI explanation ─────────────────────────────────────────────────

async function handleGenerateOnDemand({ title, language }) {
  try {
    const { solutions = [] } = await chrome.storage.local.get("solutions");
    const index = solutions.findIndex(s => s.title === title && s.language === language);

    if (index === -1) {
      throw new Error("Solution not found in storage.");
    }

    const sol = solutions[index];
    const explanation = await generateExplanation(
      sol.code, sol.title, sol.detectedPatterns || [], sol.language, sol.problemText || "", 300000
    );

    sol.llmExplanation = explanation;
    await chrome.storage.local.set({ solutions });

    chrome.runtime.sendMessage({
      type: "EXPLANATION_GENERATED",
      payload: { title, language, explanation },
    });
  } catch (error) {
    console.error("Solution Log: On-demand generation failed:", error);
    chrome.runtime.sendMessage({
      type: "EXPLANATION_ERROR",
      payload: { title, language, error: error.message },
    });
  }
}