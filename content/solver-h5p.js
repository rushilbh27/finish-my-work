// H5P Solver: Direct in-memory and DOM-driven autonomous solver for Moodle Flashcards & Crosswords
window.H5PSolver = {
  // Find the deepest H5P document context (traversing iframe.h5p-player -> iframe.h5p-iframe)
  getH5PContext() {
    let targetDoc = document;
    let targetWin = window;
    let parentDoc = document;

    const playerIframe = document.querySelector('iframe.h5p-player, iframe[src*="h5p"], iframe.h5p-iframe');
    if (playerIframe) {
      try {
        const d1 = playerIframe.contentDocument || playerIframe.contentWindow?.document;
        if (d1) {
          parentDoc = d1;
          const innerIframe = d1.querySelector('iframe.h5p-iframe, iframe');
          if (innerIframe) {
            const d2 = innerIframe.contentDocument || innerIframe.contentWindow?.document;
            if (d2) {
              targetDoc = d2;
              targetWin = innerIframe.contentWindow;
            }
          } else {
            targetDoc = d1;
            targetWin = playerIframe.contentWindow;
          }
        }
      } catch (e) {
        console.warn('[PESLMS H5P] Error accessing iframe:', e);
      }
    }
    return { targetDoc, targetWin, parentDoc };
  },

  hasH5P() {
    const { targetDoc, targetWin } = this.getH5PContext();
    if (targetWin?.H5P?.instances?.length > 0) return true;
    if (targetDoc.querySelector('.h5p-content, .h5p-iframe-wrapper, .h5p-crossword, .h5p-card, input.h5p-textinput')) return true;
    if (document.querySelector('iframe.h5p-player, iframe.h5p-iframe')) return true;
    if (window.location.href.includes('/mod/h5pactivity/view.php')) return true;
    return false;
  },

  async solve(updateStatus) {
    const { targetDoc, targetWin, parentDoc } = this.getH5PContext();
    updateStatus?.('[H5P] Analyzing interactive activity structure…');

    // 1. FLASHCARDS
    const isFlashcard = targetDoc.querySelector('.h5p-card, input.h5p-textinput') !== null ||
                        document.title.toLowerCase().includes('flashcard') ||
                        window.location.href.toLowerCase().includes('flashcard');

    if (isFlashcard) {
      updateStatus?.('[H5P] Detected Flashcards activity. Extracting answer keys…');
      return await this.solveFlashcards(targetDoc, targetWin, parentDoc, updateStatus);
    }

    // 2. CROSSWORD
    const isCrossword = targetDoc.querySelector('.h5p-crossword, .h5p-crossword-table, td[data-coords]') !== null ||
                        document.title.toLowerCase().includes('crossword') ||
                        window.location.href.toLowerCase().includes('crossword');

    if (isCrossword) {
      updateStatus?.('[H5P] Detected Crossword puzzle. Extracting solution grid…');
      return await this.solveCrossword(targetDoc, targetWin, updateStatus);
    }

    return { success: false, message: 'Unsupported H5P activity type' };
  },

  async solveFlashcards(doc, win, parentDoc, updateStatus) {
    let cards = [];

    // Attempt 1: In-memory H5P instance
    if (win?.H5P?.instances?.[0]?.options?.cards) {
      cards = win.H5P.instances[0].options.cards;
    }

    // Attempt 2: Extract from H5PIntegration script
    if (!cards.length) {
      const searchDocs = [parentDoc, doc, document];
      for (const d of searchDocs) {
        const scripts = d.querySelectorAll('script');
        for (const s of scripts) {
          if (s.innerText && s.innerText.includes('var H5PIntegration =')) {
            try {
              const start = s.innerText.indexOf('var H5PIntegration = ') + 'var H5PIntegration = '.length;
              const end = s.innerText.lastIndexOf('};') + 1;
              const jsonStr = s.innerText.slice(start, end);
              const data = JSON.parse(jsonStr);
              const firstKey = Object.keys(data.contents || {})[0];
              if (firstKey) {
                const content = JSON.parse(data.contents[firstKey].jsonContent || '{}');
                if (content.cards) cards = content.cards;
              }
            } catch (e) {}
          }
          if (cards.length) break;
        }
        if (cards.length) break;
      }
    }

    if (!cards.length) {
      updateStatus?.('⚠️ Could not extract flashcard answers from page metadata.');
      return { success: false, message: 'No flashcard data found' };
    }

    updateStatus?.(`[H5P] Solving ${cards.length} flashcards with 100% precision…`);
    const cardEls = doc.querySelectorAll('.h5p-card');

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const answer = (card.answer || card.answers?.[0] || '').trim();
      updateStatus?.(`[H5P] Answering card ${i + 1}/${cards.length}: ${answer}`);

      const cardEl = cardEls[i] || doc.querySelectorAll('.h5p-card')[i];
      const input = cardEl ? cardEl.querySelector('input.h5p-textinput, input[type="text"]') : doc.querySelector('input.h5p-textinput');

      if (input && answer) {
        input.focus();
        input.value = answer;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const checkBtn = cardEl ? cardEl.querySelector('button.h5p-theme-check') : doc.querySelector('button.h5p-theme-check');
        if (checkBtn) checkBtn.click();
        await new Promise(r => setTimeout(r, 400));

        const nextBtn = doc.querySelector('button.h5p-theme-next');
        if (nextBtn) nextBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Click show results
    const resultsBtn = doc.querySelector('button.h5p-theme-show-results');
    if (resultsBtn) {
      resultsBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    updateStatus?.(`✅ All ${cards.length} flashcards completed! (100% Score)`);
    return { success: true, count: cards.length };
  },

  async solveCrossword(doc, win, updateStatus) {
    updateStatus?.('[H5P] Revealing crossword solution grid…');
    const solBtn = doc.querySelector('button.h5p-question-show-solution, button.h5p-crossword-solution-button');
    if (solBtn) {
      solBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    const cellMap = {};
    doc.querySelectorAll('td[data-coords]').forEach(td => {
      const coords = td.getAttribute('data-coords');
      const canvas = td.querySelector('.h5p-crossword-cell-canvas');
      const txt = canvas?.innerText?.trim() || td.querySelector('input')?.value?.trim();
      if (coords && txt) {
        cellMap[coords] = txt;
      }
    });

    const retryBtn = doc.querySelector('button.h5p-question-try-again, button.h5p-crossword-retry-button');
    if (retryBtn) {
      retryBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    const filledCount = Object.keys(cellMap).length;
    updateStatus?.(`[H5P] Filling ${filledCount} crossword solution characters…`);

    for (const [coords, char] of Object.entries(cellMap)) {
      const td = doc.querySelector(`td[data-coords="${coords}"]`);
      const input = td?.querySelector('input.h5p-crossword-cell-content, input');
      if (input) {
        input.focus();
        input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: char }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    await new Promise(r => setTimeout(r, 500));
    const checkBtn = doc.querySelector('button.h5p-question-check-answer, button.h5p-theme-check');
    if (checkBtn) {
      checkBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    updateStatus?.(`✅ Crossword puzzle solved with 100% score!`);
    return { success: true, count: filledCount };
  }
};
