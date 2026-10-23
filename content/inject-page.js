// Runs directly in page context (shares window.H5P and Vue/Inertia state across main window and all iframes)
(function() {

  // ── Inertia.js & Vue 3 Page State Bridge ──
  function syncInertiaProps() {
    try {
      const app = document.getElementById('app') || document.querySelector('[data-page], [data-inertia-props]');
      const page = app?.__vue_app__?.config?.globalProperties?.$page;
      if (page && page.props && app) {
        window.__PESLMS_INERTIA_PROPS__ = {
          props: page.props,
          url: page.url
        };
        const payload = JSON.stringify({
          props: page.props,
          url: page.url
        });
        if (app.getAttribute('data-inertia-props') !== payload) {
          app.setAttribute('data-inertia-props', payload);
        }
        if (document.documentElement && document.documentElement.getAttribute('data-inertia-props') !== payload) {
          document.documentElement.setAttribute('data-inertia-props', payload);
        }
      }
    } catch (e) {}
  }

  syncInertiaProps();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncInertiaProps);
  }
  // Periodically ensure state stays synced when navigating Vue SPA pages
  const syncTimer = setInterval(syncInertiaProps, 500);

  // Hook into Vue / Inertia router events
  ['inertia:navigate', 'inertia:success', 'inertia:finish', 'popstate', 'hashchange'].forEach(evt => {
    window.addEventListener(evt, () => setTimeout(syncInertiaProps, 50));
    document.addEventListener(evt, () => setTimeout(syncInertiaProps, 50));
  });

  // Observe DOM mutations to catch client-side Vue updates
  try {
    const observer = new MutationObserver(() => syncInertiaProps());
    const target = document.getElementById('app') || document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  } catch (e) {}

  function getH5PContext() {
    // 1. Direct window check
    if (window.H5P && window.H5P.instances && window.H5P.instances.length > 0) {
      return { inst: window.H5P.instances[0], doc: document, win: window };
    }

    // 2. Iterate through all frames recursively
    function searchFrames(win) {
      try {
        if (win.H5P && win.H5P.instances && win.H5P.instances.length > 0) {
          return { inst: win.H5P.instances[0], doc: win.document, win: win };
        }
      } catch (e) {}

      // Check child iframes in this window's document
      try {
        const iframes = win.document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
          try {
            const childWin = iframes[i].contentWindow;
            if (childWin) {
              const found = searchFrames(childWin);
              if (found) return found;
            }
          } catch (e) {}
        }
      } catch (e) {}

      return null;
    }

    return searchFrames(window);
  }

  window.addEventListener('message', async (e) => {
    if (e.data?.source !== 'PESLMS_EXTENSION') return;

    if (e.data.type === 'GET_PAGE_DATA') {
      syncInertiaProps();
      const app = document.getElementById('app') || document.querySelector('[data-page], [data-inertia-props]');
      const page = app?.__vue_app__?.config?.globalProperties?.$page;
      window.postMessage({
        source: 'PESLMS_PAGE',
        type: 'PAGE_DATA_RESULT',
        data: page?.props ? { props: page.props, url: page.url } : null
      }, '*');
      return;
    }

    if (e.data.type === 'EXEC_SOLVE_H5P') {
      let result = { success: false, message: 'No H5P instance found' };
      try {
        const ctx = getH5PContext();
        if (!ctx || !ctx.inst) {
          window.postMessage({ source: 'PESLMS_PAGE', type: 'SOLVE_H5P_RESULT', result: { success: false, message: 'No H5P instance found in page or frames' } }, '*');
          return;
        }

        const h5pInst = ctx.inst;
        const targetDoc = ctx.doc;
        console.log('[PESLMS Autopilot In-Page] Found H5P instance:', h5pInst);

        // Flashcards
        if (h5pInst.options?.cards) {
          const cards = h5pInst.options.cards;
          let solved = 0;
          for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const ans = card.answer || (card.answers ? card.answers[0] : null);
            
            // Try to find current card input
            const inp = targetDoc.querySelector('.h5p-current input.h5p-text-input, input.h5p-text-input');
            if (inp && ans) {
              inp.value = ans;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));

              // Check
              const checkBtn = targetDoc.querySelector('button.h5p-theme-check, button.h5p-check-button, .h5p-theme-check');
              if (checkBtn) checkBtn.click();
              await new Promise(r => setTimeout(r, 200));

              // Next
              const nextBtn = targetDoc.querySelector('button.h5p-theme-next, button.h5p-next-button, .h5p-theme-next');
              if (nextBtn) nextBtn.click();
              await new Promise(r => setTimeout(r, 200));

              solved++;
            }
          }

          // Show results / finish
          const finishBtn = targetDoc.querySelector('button.h5p-theme-show-results, button.h5p-show-results, .h5p-show-results');
          if (finishBtn) finishBtn.click();

          result = { success: true, count: solved, total: cards.length };
        }
        // Crossword
        else if (h5pInst.content?.table?.cells) {
          const cells = h5pInst.content.table.cells.flat().filter(c => c && c.params?.solution);
          for (const cell of cells) {
            const sol = cell.params.solution;
            if (typeof cell.setAnswer === 'function') cell.setAnswer(sol);
            if (cell.cellInput) {
              cell.cellInput.value = sol;
              cell.cellInput.dispatchEvent(new Event('input', { bubbles: true }));
              cell.cellInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          await new Promise(r => setTimeout(r, 250));
          if (typeof h5pInst.checkAnswer === 'function') {
            h5pInst.checkAnswer();
          } else {
            targetDoc.querySelector('button.h5p-crossword-check-button, button.h5p-theme-check')?.click();
          }
          result = { success: true, count: cells.length };
        } else {
          result = { success: false, message: 'Unrecognized H5P module structure' };
        }
      } catch (err) {
        result = { success: false, error: err.message };
      }

      window.postMessage({ source: 'PESLMS_PAGE', type: 'SOLVE_H5P_RESULT', result }, '*');
    }
  });
})();
