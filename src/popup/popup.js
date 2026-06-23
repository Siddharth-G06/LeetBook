document.addEventListener('DOMContentLoaded', async () => {
  const { solutions = [], aiSettings } = await chrome.storage.local.get(["solutions", "aiSettings"]);
  let currentSolutions = [...solutions];

  // Default settings
  const settings = aiSettings || {
    ollama: { endpoint: "http://localhost:11434", model: "llama3.1" },
    gemini: { apiKey: "", model: "gemini-2.5-flash" }
  };

  // Bind UI elements
  const ollamaConfig = document.getElementById('ollamaConfig');
  const geminiConfig = document.getElementById('geminiConfig');
  const ollamaEndpoint = document.getElementById('ollamaEndpoint');
  const ollamaModel = document.getElementById('ollamaModel');
  const geminiApiKey = document.getElementById('geminiApiKey');
  const geminiModel = document.getElementById('geminiModel');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');

  // Load state to UI
  if (settings.ollama) {
    ollamaEndpoint.value = settings.ollama.endpoint || "";
    ollamaModel.value = settings.ollama.model || "";
  }
  if (settings.gemini) {
    geminiApiKey.value = settings.gemini.apiKey || "";
    geminiModel.value = settings.gemini.model || "";
  }

  async function saveSettings() {
    const newSettings = {
      // Preserve provider choice if it exists (set by Review page)
      provider: aiSettings?.provider || 'ollama', 
      ollama: {
        endpoint: ollamaEndpoint.value.trim(),
        model: ollamaModel.value.trim()
      },
      gemini: {
        apiKey: geminiApiKey.value.trim(),
        model: geminiModel.value.trim()
      }
    };
    await chrome.storage.local.set({ aiSettings: newSettings });
  }

  // Event Listeners for auto-save
  [ollamaEndpoint, ollamaModel, geminiApiKey, geminiModel].forEach(input => {
    input.addEventListener('input', saveSettings);
  });

  // Toggle API Key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    if (geminiApiKey.type === 'password') {
      geminiApiKey.type = 'text';
      toggleApiKeyBtn.innerText = '🙈';
    } else {
      geminiApiKey.type = 'password';
      toggleApiKeyBtn.innerText = '👁️';
    }
  });

  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  const importBtn = document.getElementById('importBtn');
  const importStatus = document.getElementById('importStatus');

  // Clear any stale import state from a previous run before starting
  importBtn.addEventListener('click', async () => {
    importBtn.disabled = true;
    importStatus.className = 'status-text mono status-running';
    importStatus.innerText = "Starting import...";
    await chrome.storage.local.set({ importState: { status: "starting" } });
    chrome.runtime.sendMessage({ type: "START_IMPORT" });
  });

  // Watch chrome.storage directly — this works even when the background
  // service worker is killed and restarted mid-import.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.importState) return;
    const state = changes.importState.newValue;
    if (!state) return;

    if (state.status === 'running') {
      importStatus.className = 'status-text mono status-running';
      importStatus.innerText = `Importing... ${state.current} processed`;

    } else if (state.status === 'complete') {
      importStatus.className = 'status-text mono status-done';
      importStatus.innerText = `✓ Done! ${state.newCount} new solution${state.newCount !== 1 ? 's' : ''} added.`;
      importBtn.disabled = false;
      // Refresh the popup list
      chrome.storage.local.get("solutions").then(res => {
        currentSolutions = [...(res.solutions || [])];
        populatePatternFilter();
        renderList(currentSolutions);
      });

    } else if (state.status === 'error') {
      importStatus.className = 'status-text mono status-error';
      importStatus.innerText = `✗ ${state.message}`;
      importBtn.disabled = false;
    }
  });

  document.getElementById('openReviewBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/review/review.html") });
  });

  const searchInput = document.getElementById('searchInput');
  const diffFilter = document.getElementById('diffFilter');
  const patternFilter = document.getElementById('patternFilter');

  function populatePatternFilter() {
    const patterns = new Set();
    currentSolutions.forEach(sol => {
      if (sol.detectedPatterns) {
        sol.detectedPatterns.forEach(p => patterns.add(p));
      }
    });
    
    // Keep the "All Patterns" option
    patternFilter.innerHTML = '<option value="">All Patterns</option>';
    Array.from(patterns).sort().forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.innerText = p;
      patternFilter.appendChild(opt);
    });
  }

  function filterSolutions() {
    const q = searchInput.value.toLowerCase();
    const diff = diffFilter.value;
    const pat = patternFilter.value;

    const filtered = currentSolutions.filter(sol => {
      const matchesQ = sol.title.toLowerCase().includes(q);
      const matchesDiff = diff === "" || sol.difficulty === diff;
      const matchesPat = pat === "" || (sol.detectedPatterns && sol.detectedPatterns.includes(pat));
      return matchesQ && matchesDiff && matchesPat;
    });

    renderList(filtered);
  }

  searchInput.addEventListener('input', filterSolutions);
  diffFilter.addEventListener('change', filterSolutions);
  patternFilter.addEventListener('change', filterSolutions);

  function getDifficultyClass(difficulty) {
    if (difficulty === "Easy") return "diff-easy border-easy";
    if (difficulty === "Medium") return "diff-medium border-medium";
    if (difficulty === "Hard") return "diff-hard border-hard";
    return "diff-unknown border-unknown";
  }

  function renderList(list) {
    const container = document.getElementById('solutionList');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div style="padding: 12px; color: var(--text-secondary); text-align: center;">No solutions found.</div>`;
      return;
    }

    // Group the list by title
    const grouped = new Map();
    list.forEach(sol => {
      if (!grouped.has(sol.title)) grouped.set(sol.title, []);
      grouped.get(sol.title).push(sol);
    });

    grouped.forEach((sols, title) => {
      const repSol = sols[0]; // representative solution for metadata
      const row = document.createElement('div');
      row.className = `solution-row ${getDifficultyClass(repSol.difficulty).split(' ')[1]}`;
      
      const badgeClass = getDifficultyClass(repSol.difficulty).split(' ')[0];
      const diffInitial = repSol.difficulty && repSol.difficulty !== "Unknown" ? repSol.difficulty.charAt(0) : "?";
      
      let patternsHtml = '';
      if (repSol.detectedPatterns && repSol.detectedPatterns.length > 0) {
        patternsHtml = `<div class="pattern-text" style="margin-top: 4px;">${repSol.detectedPatterns.join(', ')}</div>`;
      }

      // Small inline language indicators for the popup
      let langHtml = '';
      if (sols.length > 1) {
        langHtml = `<div style="display:flex; gap:4px; margin-top:2px;">`;
        sols.forEach(s => {
          langHtml += `<span style="font-size:9px; background:var(--bg-input); padding:2px 4px; border-radius:4px; color:var(--text-secondary);">${s.language}</span>`;
        });
        langHtml += `</div>`;
      } else {
        langHtml = `<div style="font-size:9px; color:var(--text-secondary); margin-top:2px;">${repSol.language}</div>`;
      }

      row.innerHTML = `
        <div class="row-main">
          <div class="row-top">
            <span class="difficulty-badge ${badgeClass}">${diffInitial}</span>
            <span class="title" style="font-weight: 500;">${title}</span>
          </div>
          ${langHtml}
          ${patternsHtml}
        </div>
        <div class="chevron">›</div>
      `;

      row.addEventListener('click', () => {
        chrome.storage.local.set({ selectedReviewSolution: { title: repSol.title, language: repSol.language } }, () => {
           chrome.tabs.create({ url: chrome.runtime.getURL("src/review/review.html") });
        });
      });

      container.appendChild(row);
    });
  }

  populatePatternFilter();
  renderList(currentSolutions);
});
