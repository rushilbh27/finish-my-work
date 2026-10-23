// Main Content Script: Injects the refined technical HUD and handles master ON/OFF states
(async function initAutopilot() {
  const oldRoot = document.getElementById('peslms-autopilot-root');
  if (oldRoot) oldRoot.remove();

  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/inject-page.js');
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {}

  if (window.self !== window.top) return;

  // ── Read user settings ──
  let isExtensionEnabled = true;
  let showWidget = true;

  try {
    const stored = await chrome.storage.local.get(['extensionEnabled', 'showFloatingWidget']);
    if (stored.extensionEnabled === false) isExtensionEnabled = false;
    if (stored.showFloatingWidget !== true) showWidget = false; // Default: OFF (no floating box on page!)
  } catch (e) {}

  // ── Build the widget DOM ──
  const container = document.createElement('div');
  container.id = 'peslms-autopilot-root';
  if (!isExtensionEnabled || !showWidget) {
    container.style.display = 'none';
  }

  container.innerHTML = `
    <!-- Minimized Docked Tab (High Visibility Neo-Brutalist Sticker) -->
    <button class="peslms-dock-tab" id="peslms-dock-tab" style="display: none;" title="Expand Finish My Work HUD" aria-label="Expand Finish My Work HUD">
      <span class="peslms-dock-dash">—</span>
      <span class="peslms-dock-title">FMW</span>
      <span class="peslms-dock-dot" id="peslms-dock-dot"></span>
    </button>

    <!-- Compact Neo-Brutalist HUD Card -->
    <div class="peslms-widget" id="peslms-main-widget">
      <!-- Header -->
      <div class="peslms-header" id="peslms-drag-handle">
        <div class="peslms-logo">
          <span class="peslms-dash">—</span>
          <div class="peslms-title">Finish My Work</div>
        </div>
        <div class="peslms-header-ctrls">
          <button class="peslms-ctrl-btn" id="peslms-btn-minimize" title="Collapse to dock tab" aria-label="Minimize HUD">—</button>
          <button class="peslms-ctrl-btn" id="peslms-btn-close" title="Hide HUD (⌘⇧H)" aria-label="Close HUD">✕</button>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="peslms-status-wrap" id="peslms-status-wrap">
        <div class="peslms-status-icon" id="peslms-status-icon"></div>
        <div class="peslms-status" id="peslms-status-text">Ready</div>
      </div>

      <!-- Actions Stack -->
      <div class="peslms-actions">
        <button class="peslms-btn" id="peslms-btn-auto-pilot" type="button">
          ▶ &nbsp;Run Auto-Pilot
        </button>
        <button class="peslms-btn-secondary" id="peslms-btn-solve-once" type="button">
          ⚡ &nbsp;Solve Visible Question
        </button>
      </div>

      <!-- Shortcuts footer -->
      <div class="peslms-shortcuts">
        <span><kbd>⌘⇧S</kbd> Solve</span>
        <span><kbd>⌘⇧A</kbd> Auto</span>
        <span><kbd>⌘⇧H</kbd> Hide</span>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const mainWidget = document.getElementById('peslms-main-widget');
  const statusWrap = document.getElementById('peslms-status-wrap');
  const statusText = document.getElementById('peslms-status-text');
  const statusIcon = document.getElementById('peslms-status-icon');
  const btnAutoPilot = document.getElementById('peslms-btn-auto-pilot');
  const btnSolveOnce = document.getElementById('peslms-btn-solve-once');
  const btnClose = document.getElementById('peslms-btn-close');
  const btnMinimize = document.getElementById('peslms-btn-minimize');
  const dockTab = document.getElementById('peslms-dock-tab');
  const dockDot = document.getElementById('peslms-dock-dot');

  let isAutoPilotRunning = false;
  let currentAgentMode = 'draft'; // default mode

  btnMinimize?.addEventListener('click', (e) => {
    e.stopPropagation();
    mainWidget.style.display = 'none';
    dockTab.style.display = 'flex';
  });

  dockTab?.addEventListener('click', (e) => {
    e.stopPropagation();
    dockTab.style.display = 'none';
    mainWidget.style.display = 'flex';
  });

  // Load saved agent mode
  try {
    const modeStore = await chrome.storage.local.get(['agentMode']);
    if (modeStore.agentMode) currentAgentMode = modeStore.agentMode;
  } catch (e) {}

  // ── Auto-Resume Persistent Batch Mode across page reloads (Mode 3 & 4) ──
  try {
    const batchStore = await chrome.storage.local.get(['autopilotBatchState']);
    const batchState = batchStore.autopilotBatchState;
    if (batchState && batchState.active && isExtensionEnabled) {
      isAutoPilotRunning = true;
      btnAutoPilot.classList.add('running');
      btnAutoPilot.innerHTML = '⏹ &nbsp;Stop Auto-Pilot';
      const modeLabels = { draft: 'Draft Only', submit: 'Full Submit', course: 'Course Batch', allcourses: 'All Courses' };
      setStatus(`Auto-pilot [${modeLabels[batchState.mode] || batchState.mode}] resuming…`, true);

      setTimeout(async () => {
        if (!isAutoPilotRunning || !isExtensionEnabled) return;
        await window.UniversalSolver.resumePersistentBatch(
          (msg) => {
            const isWarn = msg.includes('limit') || msg.includes('waiting') || msg.includes('Error') || msg.includes('warning');
            setStatus(msg, isAutoPilotRunning, isWarn);
          },
          () => isAutoPilotRunning && isExtensionEnabled
        );
      }, 1000);
    }
  } catch (e) {}

  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });

  // ── Status helper ──
  function setStatus(msg, spinning = false, isWarning = false) {
    if (statusText) statusText.textContent = msg;
    if (statusWrap) {
      if (isWarning) statusWrap.classList.add('warning');
      else statusWrap.classList.remove('warning');
    }
    if (spinning) {
      statusIcon?.classList.add('spinning');
    } else {
      statusIcon?.classList.remove('spinning');
    }

    if (dockDot) {
      if (isWarning) dockDot.className = 'peslms-dock-dot warn';
      else if (spinning) dockDot.className = 'peslms-dock-dot active';
      else dockDot.className = 'peslms-dock-dot';
    }

    // Broadcast in real-time to popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'SOLVER_STATUS_UPDATE',
        text: msg,
        spinning,
        isWarning,
        isRunning: isAutoPilotRunning
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }

  // ── Auto-Pilot Button ──
  btnAutoPilot.addEventListener('click', async () => {
    if (!isExtensionEnabled) return;

    if (isAutoPilotRunning) {
      isAutoPilotRunning = false;
      try {
        await chrome.storage.local.remove(['autopilotBatchState']);
      } catch (e) {}
      btnAutoPilot.classList.remove('running');
      btnAutoPilot.innerHTML = '▶ &nbsp;Run Auto-Pilot';
      setStatus('Auto-pilot paused.', false);
      return;
    }

    // Re-read mode from storage in case popup changed it
    try {
      const ms = await chrome.storage.local.get(['agentMode']);
      if (ms.agentMode) currentAgentMode = ms.agentMode;
    } catch (e) {}

    isAutoPilotRunning = true;
    btnAutoPilot.classList.add('running');
    btnAutoPilot.innerHTML = '⏹ &nbsp;Stop Auto-Pilot';
    const modeLabels = { draft: 'Draft Only', submit: 'Full Submit', course: 'Course Batch', allcourses: 'All Courses' };
    setStatus(`Auto-pilot [${modeLabels[currentAgentMode] || currentAgentMode}] running…`, true);

    await window.UniversalSolver.startAutoPilot(
      (msg) => {
        const isWarn = msg.includes('limit') || msg.includes('waiting') || msg.includes('Error') || msg.includes('warning');
        setStatus(msg, isAutoPilotRunning, isWarn);
      },
      () => isAutoPilotRunning && isExtensionEnabled,
      currentAgentMode
    );

    isAutoPilotRunning = false;
    btnAutoPilot.classList.remove('running');
    btnAutoPilot.innerHTML = '▶ &nbsp;Run Auto-Pilot';
    setStatus('Auto-pilot finished.', false);
  });

  // ── Solve Once Button ──
  btnSolveOnce.addEventListener('click', async () => {
    if (!isExtensionEnabled) return;

    btnSolveOnce.disabled = true;
    setStatus('Scanning visible question…', true);
    let res = await window.UniversalSolver.solve((msg) => setStatus(msg, true));

    if (res?.rateLimited) {
      let waitTime = (res.waitSec || 30) + 1;
      while (waitTime > 0 && isExtensionEnabled) {
        setStatus(`⏳ Limit: waiting ${waitTime}s...`, true, true);
        await new Promise(r => setTimeout(r, 1000));
        waitTime--;
      }
      if (isExtensionEnabled) {
        setStatus('Retrying question now…', true);
        res = await window.UniversalSolver.solve((msg) => setStatus(msg, true));
      }
    }

    if (res?.success) {
      setStatus(`Answer applied ✓`, false);
    } else {
      setStatus(res?.message || 'Could not resolve question.', false, true);
    }
    btnSolveOnce.disabled = false;
  });

  // ── Drag & Drop (Freely draggable across screen with PointerEvents) ──
  const dragHandle = document.getElementById('peslms-drag-handle');
  let isDragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  if (dragHandle) {
    dragHandle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;

      try {
        dragHandle.setPointerCapture(e.pointerId);
      } catch (err) {}

      dragHandle.addEventListener('pointermove', onPointerMove);
      dragHandle.addEventListener('pointerup', onPointerUp);
      dragHandle.addEventListener('pointercancel', onPointerUp);
      e.preventDefault();
    });

    function onPointerMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(10, Math.min(window.innerWidth - 280, origX + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - 150, origY + dy));
      container.style.setProperty('right', 'auto', 'important');
      container.style.setProperty('bottom', 'auto', 'important');
      container.style.setProperty('left', `${newLeft}px`, 'important');
      container.style.setProperty('top', `${newTop}px`, 'important');
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        dragHandle.releasePointerCapture(e.pointerId);
      } catch (err) {}
      dragHandle.removeEventListener('pointermove', onPointerMove);
      dragHandle.removeEventListener('pointerup', onPointerUp);
      dragHandle.removeEventListener('pointercancel', onPointerUp);
    }
  }

  // ── Runtime Messages ──
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SET_EXTENSION_ENABLED') {
      isExtensionEnabled = request.enabled;
      if (!isExtensionEnabled) {
        container.style.display = 'none';
        if (isAutoPilotRunning) {
          isAutoPilotRunning = false;
          btnAutoPilot.classList.remove('running');
          btnAutoPilot.innerHTML = '▶ &nbsp;Run Auto-Pilot';
        }
      } else {
        if (showWidget) container.style.display = 'block';
      }
      sendResponse({ status: 'ok', enabled: isExtensionEnabled });
    } else if (request.action === 'SET_WIDGET_VISIBLE') {
      showWidget = request.visible;
      if (isExtensionEnabled) {
        container.style.display = showWidget ? 'block' : 'none';
      }
      sendResponse({ status: 'ok' });
    } else if (request.action === 'TRIGGER_SOLVE') {
      if (isExtensionEnabled) btnSolveOnce.click();
      sendResponse({ status: isExtensionEnabled ? 'started' : 'disabled' });
    } else if (request.action === 'TRIGGER_AUTOPILOT') {
      if (isExtensionEnabled) {
        // Accept mode from popup message
        if (request.mode) currentAgentMode = request.mode;
        btnAutoPilot.click();
        sendResponse({ status: 'started', isRunning: isAutoPilotRunning });
      } else {
        sendResponse({ status: 'disabled', isRunning: false });
      }
    } else if (request.action === 'GET_SOLVER_STATE') {
      sendResponse({
        isRunning: isAutoPilotRunning,
        statusText: statusText?.textContent || 'Ready',
        isWarning: statusWrap?.classList.contains('warning'),
        enabled: isExtensionEnabled
      });
    } else if (request.action === 'TOGGLE_OVERLAY') {
      if (!isExtensionEnabled) return;
      const isHidden = container.style.display === 'none';
      container.style.display = isHidden ? 'block' : 'none';
      sendResponse({ status: isHidden ? 'visible' : 'hidden' });
    }
    return true;
  });

  // ── Keyboard Shortcuts ──
  window.addEventListener('keydown', (e) => {
    if (!isExtensionEnabled) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      btnSolveOnce.click();
    }
    if (mod && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      btnAutoPilot.click();
    }
    if (mod && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
      e.preventDefault();
      const isHidden = container.style.display === 'none';
      container.style.display = isHidden ? 'block' : 'none';
    }
    if (e.key === 'Escape' && container.style.display !== 'none') {
      if (dockTab && dockTab.style.display === 'none') {
        mainWidget.style.display = 'none';
        dockTab.style.display = 'flex';
      }
    }
  });
})();
