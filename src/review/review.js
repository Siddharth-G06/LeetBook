import { generateExplanation } from '../services/aiProvider.js';

document.addEventListener('DOMContentLoaded', async () => {
  let allSolutions = [];
  let currentActiveSol = null;

  async function loadData() {
    const { solutions = [] } = await chrome.storage.local.get("solutions");
    allSolutions = solutions;
    renderRail();
    filterAndRender();

    // Check if we navigated here from popup with a selected solution
    chrome.storage.local.get("selectedReviewSolution", (res) => {
        if (res.selectedReviewSolution) {
            const sol = allSolutions.find(s => s.title === res.selectedReviewSolution.title && s.language === res.selectedReviewSolution.language);
            if (sol) openSlidePanel(sol);
            chrome.storage.local.remove("selectedReviewSolution");
        }
    });
  }

  const searchInput = document.getElementById('searchInput');
  const diffFilterList = document.getElementById('diffFilterList');
  const patternFilterList = document.getElementById('patternFilterList');
  const cardGrid = document.getElementById('cardGrid');

  let activeDiff = "";
  let activePatterns = new Set();

  searchInput.addEventListener('input', filterAndRender);

  diffFilterList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    document.querySelectorAll('#diffFilterList li').forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    activeDiff = li.getAttribute('data-val');
    filterAndRender();
  });

  patternFilterList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const val = li.getAttribute('data-val');
    if (val === "") {
        activePatterns.clear();
        document.querySelectorAll('#patternFilterList li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
    } else {
        document.querySelector('#patternFilterList li[data-val=""]').classList.remove('active');
        if (activePatterns.has(val)) {
            activePatterns.delete(val);
            li.classList.remove('active');
            if (activePatterns.size === 0) {
                document.querySelector('#patternFilterList li[data-val=""]').classList.add('active');
            }
        } else {
            activePatterns.add(val);
            li.classList.add('active');
        }
    }
    filterAndRender();
  });

  function renderRail() {
    const uniqueTitles = new Set();
    const problemDifficulties = new Map(); // title -> difficulty
    const patterns = new Map();

    allSolutions.forEach(s => {
        uniqueTitles.add(s.title);
        // Track the difficulty for the problem (assume constant per problem)
        if (!problemDifficulties.has(s.title)) {
            problemDifficulties.set(s.title, s.difficulty);
        }

        if (s.detectedPatterns) {
            s.detectedPatterns.forEach(p => {
                patterns.set(p, (patterns.get(p) || 0) + 1);
            });
        }
    });

    document.getElementById('totalCount').innerText = `${uniqueTitles.size} Problems`;
    
    let easy = 0, med = 0, hard = 0;
    problemDifficulties.forEach((diff) => {
        if (diff === 'Easy') easy++;
        else if (diff === 'Medium') med++;
        else if (diff === 'Hard') hard++;
    });

    document.getElementById('count-all').innerText = uniqueTitles.size;
    document.getElementById('count-easy').innerText = easy;
    document.getElementById('count-medium').innerText = med;
    document.getElementById('count-hard').innerText = hard;

    document.getElementById('patternCount').innerText = `${patterns.size} Patterns`;

    patternFilterList.innerHTML = `<li data-val="" class="${activePatterns.size===0 ? 'active' : ''}">All Patterns</li>`;
    Array.from(patterns.entries()).sort((a,b) => b[1] - a[1]).forEach(([p, count]) => {
        const li = document.createElement('li');
        li.setAttribute('data-val', p);
        if (activePatterns.has(p)) li.classList.add('active');
        li.innerHTML = `${p} <span class="count">${count}</span>`;
        patternFilterList.appendChild(li);
    });
  }

  function getDifficultyClass(difficulty) {
    if (difficulty === "Easy") return "diff-easy border-easy";
    if (difficulty === "Medium") return "diff-medium border-medium";
    if (difficulty === "Hard") return "diff-hard border-hard";
    return "diff-unknown border-unknown";
  }

  function filterAndRender() {
    const q = searchInput.value.toLowerCase();
    
    // First, find all individual solutions that match the filters
    const filteredSols = allSolutions.filter(sol => {
      const matchesQ = sol.title.toLowerCase().includes(q) || (sol.code && sol.code.toLowerCase().includes(q));
      const matchesDiff = activeDiff === "" || sol.difficulty === activeDiff;
      let matchesPat = true;
      if (activePatterns.size > 0) {
          matchesPat = sol.detectedPatterns && sol.detectedPatterns.some(p => activePatterns.has(p));
      }
      return matchesQ && matchesDiff && matchesPat;
    });

    // Group the matching solutions by problem title
    const grouped = new Map();
    filteredSols.forEach(sol => {
        if (!grouped.has(sol.title)) grouped.set(sol.title, []);
        grouped.get(sol.title).push(sol);
    });

    cardGrid.innerHTML = '';
    
    grouped.forEach((solList, title) => {
        // Use the first solution's metadata as representative
        const repSol = solList[0];
        const card = document.createElement('div');
        const badgeClass = getDifficultyClass(repSol.difficulty).split(' ')[0];
        const borderClass = getDifficultyClass(repSol.difficulty).split(' ')[1];
        card.className = `card ${borderClass}`;
        
        let patHtml = '';
        if (repSol.detectedPatterns && repSol.detectedPatterns.length > 0) {
            patHtml = `<div class="pattern-text">${repSol.detectedPatterns.join(', ')}</div>`;
        }

        // Generate language pills
        let pillsHtml = '';
        if (solList.length > 1) {
            pillsHtml = '<div class="lang-pills">';
            solList.forEach((s, idx) => {
                pillsHtml += `<button class="lang-pill ${idx === 0 ? 'active' : ''}" data-idx="${idx}">${s.language}</button>`;
            });
            pillsHtml += '</div>';
        }

        card.innerHTML = `
            <div class="card-top">
                <h4 class="title">${title}</h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${pillsHtml}
                    <span class="difficulty-badge ${badgeClass}">${repSol.difficulty && repSol.difficulty !== 'Unknown' ? repSol.difficulty.charAt(0) : '?'}</span>
                </div>
            </div>
            ${patHtml}
            <pre class="code-preview">${escapeHtml(repSol.code || '')}</pre>
        `;

        // Handle language pill clicks within the card
        if (solList.length > 1) {
            const pills = card.querySelectorAll('.lang-pill');
            const codePreview = card.querySelector('.code-preview');
            pills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    e.stopPropagation(); // Don't trigger card click
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    const idx = parseInt(pill.getAttribute('data-idx'));
                    codePreview.innerHTML = escapeHtml(solList[idx].code || '');
                });
            });
        }

        // Clicking the card opens the slide panel with the full list of solutions
        card.addEventListener('click', () => {
            // Figure out which language index is currently active on the card
            let activeIdx = 0;
            const activePill = card.querySelector('.lang-pill.active');
            if (activePill) {
                activeIdx = parseInt(activePill.getAttribute('data-idx'));
            }
            openSlidePanel(solList, activeIdx);
        });
        
        cardGrid.appendChild(card);
    });
  }

  function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // --- SLIDE PANEL LOGIC ---

  const slidePanel = document.getElementById('slidePanel');
  const slideOverlay = document.getElementById('slideOverlay');
  
  document.getElementById('closeSlideBtn').addEventListener('click', closeSlidePanel);
  slideOverlay.addEventListener('click', closeSlidePanel);

  function closeSlidePanel() {
      slidePanel.classList.add('hidden');
      slideOverlay.classList.add('hidden');
      currentActiveSol = null;
  }

  // solList is an array of solutions for the same problem in different languages
  function openSlidePanel(solList, activeIdx = 0) {
      const repSol = solList[0];
      document.getElementById('slideTitle').innerText = repSol.title;
      document.getElementById('slideDifficulty').innerText = repSol.difficulty && repSol.difficulty !== 'Unknown' ? repSol.difficulty.charAt(0) : '?';
      document.getElementById('slideDifficulty').className = `difficulty-badge ${getDifficultyClass(repSol.difficulty).split(' ')[0]}`;
      
      const tabsContainer = document.getElementById('slideLangTabs');
      tabsContainer.innerHTML = '';
      
      solList.forEach((s, idx) => {
          const btn = document.createElement('button');
          btn.className = `lang-tab ${idx === activeIdx ? 'active' : ''}`;
          btn.innerText = s.language;
          btn.addEventListener('click', () => {
              // Update tab UI
              tabsContainer.querySelectorAll('.lang-tab').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              // Repopulate content
              populateSlideData(solList[idx]);
          });
          tabsContainer.appendChild(btn);
      });

      populateSlideData(solList[activeIdx]);

      slidePanel.classList.remove('hidden');
      slideOverlay.classList.remove('hidden');
  }

  function populateSlideData(sol) {
      currentActiveSol = sol;
      
      const langEl = document.getElementById('codeLangLabel');
      if (langEl) langEl.innerText = sol.language || 'CODE';
      
      const patEl = document.getElementById('slidePatterns');
      patEl.innerText = sol.detectedPatterns ? sol.detectedPatterns.join(', ') : '';
      
      // Use textContent to avoid double-escaping code
      document.getElementById('slideCode').textContent = sol.code || '';

      document.getElementById('timeComp').value = sol.timeComplexity || '';
      document.getElementById('spaceComp').value = sol.spaceComplexity || '';
      document.getElementById('notesArea').value = sol.notes || '';

      renderAiSection();
  }

  function formatAiExplanation(text) {
      // Convert the structured markdown output into styled HTML
      let html = text
        // ## Section headers
        .replace(/^## (.+)$/gm, '<h4 class="ai-section-title">$1</h4>')
        // **Bold text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Bullet points
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="ai-list">${match}</ul>`)
        // --- dividers
        .replace(/^---$/gm, '<hr class="ai-divider">')
        // Backtick inline code
        .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
        // Convert remaining newlines to breaks (but not inside tags)
        .replace(/\n\n/g, '</p><p class="ai-para">')
        .replace(/\n/g, '<br>');
      return `<div class="ai-body"><p class="ai-para">${html}</p></div>`;
  }

  async function renderAiSection(errorMsg = '') {
      const container = document.getElementById('slideAiContent');
      if (currentActiveSol.llmExplanation) {
          container.innerHTML = formatAiExplanation(currentActiveSol.llmExplanation);
      } else {
          // Determine active provider for UI display
          const { aiSettings } = await chrome.storage.local.get("aiSettings");
          const settings = aiSettings || { provider: "ollama", ollama: { model: "llama3.1" }, gemini: { model: "gemini-2.5-flash" } };
          const defaultProvider = settings.provider || 'ollama';
          
          container.innerHTML = `
            <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <label for="aiProviderSelect" style="font-weight: 500;">AI Provider:</label>
              <select id="aiProviderSelect" class="mono" style="background-color: var(--bg-input); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 4px 8px; border-radius: 4px; outline: none; font-size: 11px;">
                <option value="ollama" ${defaultProvider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
                <option value="gemini" ${defaultProvider === 'gemini' ? 'selected' : ''}>Gemini API</option>
              </select>
            </div>
            <button id="genAiBtn" class="action-btn">Generate Explanation</button>
            <div id="aiStatus" class="ai-error">${errorMsg}</div>
          `;

          document.getElementById('genAiBtn').addEventListener('click', async (e) => {
              const btn = e.target;
              const statusEl = document.getElementById('aiStatus');
              const providerSelect = document.getElementById('aiProviderSelect');
              const selectedProvider = providerSelect.value;
              const providerLabel = selectedProvider === 'gemini' ? 'Gemini' : 'Ollama';
              
              btn.disabled = true;
              providerSelect.disabled = true;
              statusEl.innerText = '';

              // ── Animated generating UI ──
              const phrases = [
                `Asking ${providerLabel} to think...`,
                'Analysing the problem constraints...',
                'Deriving brute force approach...',
                'Figuring out the optimal solution...',
                'Reviewing your code logic...',
                'Calculating time & space complexity...',
                'Tagging algorithm patterns...',
                'Almost done, polishing the output...'
              ];
              let phraseIdx = 0;
              const genWrap = document.createElement('div');
              genWrap.className = 'generating-wrap';
              genWrap.innerHTML = `
                <div class="generating-phrase" id="genPhrase">${phrases[0]}</div>
                <div class="generating-dots"><span></span><span></span><span></span></div>
              `;
              // Replace the button area with the animated block
              container.innerHTML = '';
              container.appendChild(genWrap);
              
              const phraseEl = document.getElementById('genPhrase');
              const phraseTimer = setInterval(() => {
                phraseIdx = (phraseIdx + 1) % phrases.length;
                phraseEl.style.animation = 'none';
                void phraseEl.offsetWidth; // force reflow
                phraseEl.style.animation = '';
                phraseEl.innerText = phrases[phraseIdx];
              }, 3500);
              
              // Capture the current sol at the time the button was clicked
              const targetSol = currentActiveSol;
              
              try {
                  // Fetch the absolute latest settings (in case user just saved them in the modal)
                  const { aiSettings: latestSettings } = await chrome.storage.local.get("aiSettings");
                  const currentSettings = latestSettings || { provider: "ollama", ollama: {}, gemini: {} };
                  
                  // Save the selected provider as the new default
                  currentSettings.provider = selectedProvider;
                  await chrome.storage.local.set({ aiSettings: currentSettings });

                  const explanation = await generateExplanation(targetSol, 300000, selectedProvider);
                  clearInterval(phraseTimer);
                  
                  targetSol.llmExplanation = explanation;
                  
                  // Update local arrays
                  const idx = allSolutions.findIndex(s => s.title === targetSol.title && s.language === targetSol.language);
                  if (idx !== -1) allSolutions[idx].llmExplanation = explanation;
                  
                  // Save to storage
                  const { solutions = [] } = await chrome.storage.local.get("solutions");
                  const sIdx = solutions.findIndex(s => s.title === targetSol.title && s.language === targetSol.language);
                  if (sIdx !== -1) {
                      solutions[sIdx].llmExplanation = explanation;
                      await chrome.storage.local.set({ solutions });
                  }
                  
                  // If the user hasn't switched tabs, re-render with the explanation
                  if (currentActiveSol.title === targetSol.title && currentActiveSol.language === targetSol.language) {
                      renderAiSection();
                  }
                  
              } catch (err) {
                  clearInterval(phraseTimer);
                  // Re-render the generate button and show the error below it — no double-render
                  if (currentActiveSol.title === targetSol.title && currentActiveSol.language === targetSol.language) {
                      renderAiSection(err.message);
                  }
              }
          });
      }
  }


  // Save notes on blur
  const saveFields = ['timeComp', 'spaceComp', 'notesArea'];
  saveFields.forEach(id => {
      document.getElementById(id).addEventListener('blur', async (e) => {
          if (!currentActiveSol) return;
          const val = e.target.value.trim();
          
          if (id === 'timeComp') currentActiveSol.timeComplexity = val;
          if (id === 'spaceComp') currentActiveSol.spaceComplexity = val;
          if (id === 'notesArea') currentActiveSol.notes = val;

          const { solutions = [] } = await chrome.storage.local.get("solutions");
          const idx = solutions.findIndex(s => s.title === currentActiveSol.title && s.language === currentActiveSol.language);
          if (idx !== -1) {
              solutions[idx] = { ...solutions[idx], ...currentActiveSol };
              await chrome.storage.local.set({ solutions });
              
              // Update local array
              const localIdx = allSolutions.findIndex(s => s.title === currentActiveSol.title && s.language === currentActiveSol.language);
              if (localIdx !== -1) allSolutions[localIdx] = solutions[idx];
          }
      });
  });

  document.getElementById('deleteBtn').addEventListener('click', async () => {
      if (!currentActiveSol || !confirm(`Delete solution for "${currentActiveSol.title}"?`)) return;
      
      const { solutions = [] } = await chrome.storage.local.get("solutions");
      const newSols = solutions.filter(s => !(s.title === currentActiveSol.title && s.language === currentActiveSol.language));
      await chrome.storage.local.set({ solutions: newSols });
      
      allSolutions = newSols;
      closeSlidePanel();
      renderRail();
      filterAndRender();
  });

  // ── Settings Modal (Review Page) ───────────────────────────────
  const settingsModal      = document.getElementById('settingsModal');
  const settingsToggleBtn  = document.getElementById('settingsToggleReview');
  const closeSettingsBtn   = document.getElementById('closeSettingsModal');
  const settingsBackdrop   = document.getElementById('settingsModalBackdrop');
  const saveSettingsBtn    = document.getElementById('saveSettingsBtn');
  const settingsSaveStatus = document.getElementById('settingsSaveStatus');
  const rOllamaEndpoint    = document.getElementById('rOllamaEndpoint');
  const rOllamaModel       = document.getElementById('rOllamaModel');
  const rGeminiApiKey      = document.getElementById('rGeminiApiKey');
  const rGeminiModel       = document.getElementById('rGeminiModel');
  const rToggleApiKey      = document.getElementById('rToggleApiKey');

  async function openSettingsModal() {
    const { aiSettings } = await chrome.storage.local.get("aiSettings");
    const s = aiSettings || { ollama: { endpoint: '', model: '' }, gemini: { apiKey: '', model: '' } };
    rOllamaEndpoint.value = s.ollama?.endpoint || '';
    rOllamaModel.value    = s.ollama?.model    || '';
    rGeminiApiKey.value   = s.gemini?.apiKey   || '';
    rGeminiModel.value    = s.gemini?.model    || '';
    settingsSaveStatus.textContent = '';
    settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }

  settingsToggleBtn.addEventListener('click', openSettingsModal);
  closeSettingsBtn.addEventListener('click', closeSettingsModal);
  settingsBackdrop.addEventListener('click', closeSettingsModal);

  rToggleApiKey.addEventListener('click', () => {
    if (rGeminiApiKey.type === 'password') {
      rGeminiApiKey.type = 'text';
      rToggleApiKey.innerText = '🙈';
    } else {
      rGeminiApiKey.type = 'password';
      rToggleApiKey.innerText = '👁️';
    }
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const { aiSettings } = await chrome.storage.local.get("aiSettings");
    const current = aiSettings || { provider: 'ollama', ollama: {}, gemini: {} };
    const updated = {
      provider: current.provider || 'ollama',
      ollama: {
        endpoint: rOllamaEndpoint.value.trim(),
        model:    rOllamaModel.value.trim()
      },
      gemini: {
        apiKey: rGeminiApiKey.value.trim(),
        model:  rGeminiModel.value.trim()
      }
    };
    await chrome.storage.local.set({ aiSettings: updated });
    settingsSaveStatus.textContent = '✓ Saved!';
    setTimeout(() => { settingsSaveStatus.textContent = ''; }, 2000);
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettingsModal();
  });

  loadData();
});

