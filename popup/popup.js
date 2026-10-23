document.addEventListener('DOMContentLoaded', async () => {
  const togglePower        = document.getElementById('toggle-power');
  const btnToggleSettings  = document.getElementById('btn-toggle-settings');
  const btnCloseSettings   = document.getElementById('btn-close-settings');
  const viewMain           = document.getElementById('view-main');
  const viewSettings       = document.getElementById('view-settings');

  const statusDot          = document.getElementById('status-dot');
  const statusText         = document.getElementById('status-text');
  const activeBadge        = document.getElementById('active-provider-badge');
  const notifyBanner       = document.getElementById('notify-banner');

  const tabBtns            = Array.from(document.querySelectorAll('.provider-tabs .tech-tab-btn'));
  const providerCards      = Array.from(document.querySelectorAll('.provider-card'));
  const btnSave            = document.getElementById('btn-save-key');
  
  const groqInput          = document.getElementById('groq-key');
  const geminiInput        = document.getElementById('gemini-key');
  const openrouterInput    = document.getElementById('openrouter-key');

  const groqError          = document.getElementById('groq-error');
  const geminiError        = document.getElementById('gemini-error');
  const openrouterError    = document.getElementById('openrouter-error');

  const toggleWidget       = document.getElementById('toggle-floating-widget');
  const btnPopupSolve      = document.getElementById('btn-popup-solve');
  const btnPopupAuto       = document.getElementById('btn-popup-auto');
  const modeSelect         = document.getElementById('agent-mode-select');
  const modeDisplayVal     = document.getElementById('mode-display-val');

  // ── Helper: Show Banner Message ──
  let notifyTimer = null;
  function showNotification(msg, type = 'warn') {
    if (!notifyBanner) return;
    notifyBanner.textContent = msg;
    notifyBanner.className = `notify-banner ${type}`;
    notifyBanner.classList.remove('hidden');
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      notifyBanner.classList.add('hidden');
    }, 3500);
  }

  // ── Load saved state ──
  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const stored = hasStorage ? await chrome.storage.local.get([
    'aiProvider',
    'groqApiKey',
    'geminiApiKey',
    'openrouterApiKey',
    'extensionEnabled',
    'showFloatingWidget',
    'agentMode'
  ]) : {};

  let isEnabled = stored.extensionEnabled !== false; // default true
  let currentProvider = stored.aiProvider;
  if (stored.groqApiKey) groqInput.value = stored.groqApiKey;
  if (stored.geminiApiKey) geminiInput.value = stored.geminiApiKey;
  if (stored.openrouterApiKey) openrouterInput.value = stored.openrouterApiKey;

  // If user entered a Groq key and hasn't chosen another paid provider, default to Groq
  if (stored.groqApiKey?.trim() && (!currentProvider || currentProvider === 'free')) {
    currentProvider = 'groq';
    chrome?.storage?.local?.set({ aiProvider: 'groq' });
  } else if (!currentProvider) {
    currentProvider = 'free';
  }
  
  // Default: Keep floating widget OFF so page has no intrusive overlay
  toggleWidget.checked = stored.showFloatingWidget === true;

  // Load saved agent mode
  const modeLabels = {
    draft: 'Draft Only',
    submit: 'Full Submit',
    course: 'Course Batch',
    allcourses: 'All Courses'
  };

  function updateModeDisplay() {
    if (modeDisplayVal && modeSelect) {
      modeDisplayVal.textContent = modeLabels[modeSelect.value] || 'Draft Only';
    }
  }

  const validModes = ['draft', 'submit', 'course', 'allcourses'];
  if (stored.agentMode && validModes.includes(stored.agentMode)) {
    modeSelect.value = stored.agentMode;
  }
  updateModeDisplay();

  // Auto-save mode on change
  modeSelect.addEventListener('change', () => {
    updateModeDisplay();
    chrome.storage.local.set({ agentMode: modeSelect.value });
  });

  // ── Power Switch ──
  function updatePowerUI(active) {
    isEnabled = active;
    togglePower.checked = active;
    if (active) {
      statusDot.className = 'status-dot';
      updateStatusBadge();
    } else {
      statusDot.className = 'status-dot off';
      statusText.textContent = 'Extension Paused';
      activeBadge.textContent = 'OFF';
    }
  }

  updatePowerUI(isEnabled);

  togglePower.addEventListener('change', async () => {
    const active = togglePower.checked;
    updatePowerUI(active);
    await chrome.storage.local.set({ extensionEnabled: active });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'SET_EXTENSION_ENABLED', enabled: active });
    }
  });

  // Auto-save key on paste/input
  groqInput.addEventListener('input', () => {
    const val = groqInput.value.trim();
    if (val.startsWith('gsk_')) {
      chrome.storage.local.set({ groqApiKey: val, aiProvider: 'groq' });
      currentProvider = 'groq';
      clearErrors();
      updateStatusBadge();
    }
  });

  // ── Settings Drawer Toggle ──
  btnToggleSettings.addEventListener('click', () => {
    viewMain.classList.toggle('hidden');
    viewSettings.classList.toggle('hidden');
    clearErrors();
  });

  function autoPersistKeys() {
    const groqKey = groqInput.value.trim();
    const geminiKey = geminiInput.value.trim();
    const openrouterKey = openrouterInput.value.trim();
    const data = {
      groqApiKey: groqKey,
      geminiApiKey: geminiKey,
      openrouterApiKey: openrouterKey
    };
    if (groqKey.startsWith('gsk_') && (!currentProvider || currentProvider === 'free')) {
      data.aiProvider = 'groq';
      currentProvider = 'groq';
    }
    chrome.storage.local.set(data);
    updateStatusBadge();
  }

  [groqInput, geminiInput, openrouterInput].forEach(inp => {
    inp.addEventListener('input', autoPersistKeys);
    inp.addEventListener('change', autoPersistKeys);
  });

  btnCloseSettings.addEventListener('click', () => {
    autoPersistKeys();
    viewSettings.classList.add('hidden');
    viewMain.classList.remove('hidden');
    clearErrors();
  });

  function clearErrors() {
    [groqError, geminiError, openrouterError].forEach(el => el?.classList.add('hidden'));
    [groqInput, geminiInput, openrouterInput].forEach(el => el?.classList.remove('input-error'));
  }

  // ── Provider Tab Switching (Strict 1-at-a-time) ──
  function selectTab(provider) {
    if (!provider || !['free', 'groq', 'gemini', 'openrouter'].includes(provider)) {
      provider = currentProvider || 'groq';
    }
    currentProvider = provider;
    clearErrors();

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.provider === provider);
    });

    providerCards.forEach(card => {
      card.classList.toggle('hidden', card.id !== `card-${provider}`);
    });

    updateStatusBadge();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTab(btn.dataset.provider));
  });

  // Open external links reliably in standard browser tabs
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.href) {
        chrome.tabs.create({ url: link.href });
      }
    });
  });

  selectTab(currentProvider);

  function updateStatusBadge() {
    if (!isEnabled) return;
    const hasGroq = !!groqInput.value.trim().startsWith('gsk_');
    const hasGemini = !!geminiInput.value.trim();
    const hasOpenRouter = !!openrouterInput.value.trim();

    if (currentProvider === 'groq' && hasGroq) {
      statusText.textContent = 'Groq Cloud Active';
      activeBadge.textContent = 'GROQ';
    } else if (hasGroq && currentProvider === 'free') {
      statusText.textContent = 'Groq Cloud Active';
      activeBadge.textContent = 'GROQ';
    } else if (currentProvider === 'gemini' && hasGemini) {
      statusText.textContent = 'Gemini Vision Active';
      activeBadge.textContent = 'GEMINI';
    } else if (currentProvider === 'openrouter' && hasOpenRouter) {
      statusText.textContent = 'OpenRouter Active';
      activeBadge.textContent = 'OPENROUTER';
    } else {
      statusText.textContent = 'Built-in Free AI';
      activeBadge.textContent = 'FREE';
    }
  }

  // ── Reveal / Hide Key ──
  document.querySelectorAll('.reveal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.textContent = isPass ? '🙈' : '👁';
      }
    });
  });

  // ── Floating HUD Toggle ──
  toggleWidget.addEventListener('change', async () => {
    const isVisible = toggleWidget.checked;
    await chrome.storage.local.set({ showFloatingWidget: isVisible });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'SET_WIDGET_VISIBLE', visible: isVisible });
    }
  });

  // ── Direct Actions & Failure Checks ──
  btnPopupSolve.addEventListener('click', async () => {
    if (!isEnabled) {
      showNotification('Extension is OFF. Switch top toggle to ON.', 'warn');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showNotification('Open any LMS, quiz, or test page first.', 'warn');
      return;
    }

    btnPopupSolve.disabled = true;
    statusText.textContent = 'Scanning visible question…';

    try {
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SOLVE' }, (res) => {
        if (chrome.runtime.lastError) {
          showNotification('Could not connect. Refresh the quiz page once.', 'error');
          statusText.textContent = 'Refresh page';
        } else {
          statusText.textContent = 'Solving in progress…';
          setTimeout(() => { updateStatusBadge(); }, 2000);
        }
        btnPopupSolve.disabled = false;
      });
    } catch (e) {
      showNotification('Error: ' + e.message, 'error');
      btnPopupSolve.disabled = false;
    }
  });

  function updateAutoButton(running) {
    if (running) {
      btnPopupAuto.classList.add('running');
      btnPopupAuto.innerHTML = '■ Stop Auto-Pilot';
    } else {
      btnPopupAuto.classList.remove('running');
      btnPopupAuto.innerHTML = '▶ Auto-Pilot';
    }
  }

  // Sync real-time state when popup opens
  (async () => {
    try {
      if (window.chrome?.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'GET_SOLVER_STATE' }, (res) => {
            if (!chrome.runtime.lastError && res) {
              if (res.statusText && res.statusText !== 'Ready') {
                statusText.textContent = res.statusText;
              }
              if (res.isWarning) {
                statusDot.className = 'status-dot warn';
              }
              updateAutoButton(res.isRunning);
            }
          });
        }
      }
    } catch (e) {}
  })();

  // Listen for live updates from content script
  chrome?.runtime?.onMessage?.addListener((msg) => {
    if (msg.action === 'SOLVER_STATUS_UPDATE') {
      if (msg.text) {
        statusText.textContent = msg.text;
        if (msg.isWarning) {
          statusDot.className = 'status-dot warn';
        } else {
          statusDot.className = 'status-dot';
        }
      }
      if (typeof msg.isRunning === 'boolean') {
        updateAutoButton(msg.isRunning);
      }
    }
  });

  btnPopupAuto.addEventListener('click', async () => {
    if (!isEnabled) {
      showNotification('Extension is OFF. Switch top toggle to ON.', 'warn');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showNotification('Open any LMS, quiz, or test page first.', 'warn');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTOPILOT', mode: modeSelect.value }, (res) => {
      if (chrome.runtime.lastError) {
        showNotification('Could not connect. Refresh the quiz page once.', 'error');
      } else if (res && typeof res.isRunning === 'boolean') {
        updateAutoButton(res.isRunning);
      }
    });
  });

  // ── Save Settings with STRICT VALIDATION ──
  btnSave.addEventListener('click', async () => {
    clearErrors();

    const groqKey = groqInput.value.trim();
    const geminiKey = geminiInput.value.trim();
    const openrouterKey = openrouterInput.value.trim();

    // 1. Validation for Groq
    if (currentProvider === 'groq') {
      if (!groqKey) {
        groqError.textContent = '⚠️ Groq key required. Paste your gsk_... key or switch to Free AI.';
        groqError.classList.remove('hidden');
        groqInput.classList.add('input-error');
        groqInput.focus();
        return;
      }
      if (!groqKey.startsWith('gsk_')) {
        groqError.textContent = '⚠️ Invalid Groq key format. Must start with "gsk_".';
        groqError.classList.remove('hidden');
        groqInput.classList.add('input-error');
        groqInput.focus();
        return;
      }
    }

    // 2. Validation for Gemini
    if (currentProvider === 'gemini') {
      if (!geminiKey) {
        geminiError.textContent = '⚠️ Gemini key required. Paste your key from Google AI Studio or switch to Free AI.';
        geminiError.classList.remove('hidden');
        geminiInput.classList.add('input-error');
        geminiInput.focus();
        return;
      }
    }

    // 3. Validation for OpenRouter
    if (currentProvider === 'openrouter') {
      if (!openrouterKey) {
        openrouterError.textContent = '⚠️ OpenRouter key required (starts with sk-or-...). Paste key or switch to Free AI.';
        openrouterError.classList.remove('hidden');
        openrouterInput.classList.add('input-error');
        openrouterInput.focus();
        return;
      }
    }

    // Save valid configuration
    await chrome.storage.local.set({
      aiProvider: currentProvider,
      groqApiKey: groqKey,
      geminiApiKey: geminiKey,
      openrouterApiKey: openrouterKey,
      extensionEnabled: togglePower.checked,
      showFloatingWidget: toggleWidget.checked
    });

    btnSave.textContent = '✓ CONFIGURATION SAVED!';
    btnSave.classList.add('saved');
    updateStatusBadge();

    setTimeout(() => {
      btnSave.textContent = 'SAVE CONFIGURATION';
      btnSave.classList.remove('saved');
      viewSettings.classList.add('hidden');
      viewMain.classList.remove('hidden');
      showNotification('Settings saved successfully.', 'success');
    }, 700);
  });

  const btnReloadExt = document.getElementById('btn-reload-ext');
  btnReloadExt?.addEventListener('click', (e) => {
    e?.stopPropagation?.();
    btnReloadExt.textContent = '↻ Reloading…';
    if (chrome?.runtime?.reload) {
      chrome.runtime.reload();
    } else {
      location.reload();
    }
  });

  // ── Live Groq Key & Network Verification ──
  const btnTestGroq = document.getElementById('btn-test-groq');
  const groqTestStatus = document.getElementById('groq-test-status');

  btnTestGroq?.addEventListener('click', async (e) => {
    e?.stopPropagation?.();
    selectTab('groq');

    const key = groqInput.value.trim();
    if (!key) {
      groqTestStatus.classList.remove('hidden');
      groqTestStatus.style.color = '#dc2626';
      groqTestStatus.innerHTML = '❌ Paste your gsk_... key first.';
      return;
    }

    btnTestGroq.disabled = true;
    btnTestGroq.textContent = '⏳ Testing live connection…';
    groqTestStatus.classList.remove('hidden');
    groqTestStatus.style.color = '#0f172a';
    groqTestStatus.innerHTML = 'Connecting to api.groq.com…';

    const t0 = performance.now();
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      const latency = Math.round(performance.now() - t0);

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = errText.slice(0, 80);
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) errMsg = parsed.error.message;
        } catch (e) {}
        groqTestStatus.style.color = '#dc2626';
        groqTestStatus.innerHTML = `❌ Groq rejected key (HTTP ${res.status}):<br><b>${errMsg}</b>`;
        btnTestGroq.disabled = false;
        btnTestGroq.textContent = '⚡ Test Groq Key & Network Now';
        selectTab('groq');
        return;
      }

      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(id => !id.includes('whisper') && !id.includes('guard'));
      
      // Auto-save key since it is verified valid!
      await chrome.storage.local.set({ groqApiKey: key, aiProvider: 'groq' });
      currentProvider = 'groq';
      selectTab('groq');
      updateStatusBadge();

      groqTestStatus.style.color = '#15803d';
      groqTestStatus.innerHTML = `✅ <b>Connection verified in ${latency}ms!</b><br>` +
        `• Status: Valid & Active<br>` +
        `• Models: ${models.slice(0, 3).join(', ')}...<br>` +
        `• Key auto-saved & ready!`;
    } catch (err) {
      groqTestStatus.style.color = '#dc2626';
      groqTestStatus.innerHTML = `❌ Network Error: Could not reach Groq servers (${err.message}).`;
    }

    btnTestGroq.disabled = false;
    btnTestGroq.textContent = '⚡ Test Groq Key & Network Now';
    selectTab('groq');
  });
});
