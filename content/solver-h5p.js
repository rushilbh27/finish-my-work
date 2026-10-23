// H5P Solver: Direct in-memory extraction of Flashcards and Crosswords
window.H5PSolver = {
  // Check if current context has H5P
  hasH5P() {
    return !!(window.H5P && window.H5P.instances && window.H5P.instances.length > 0);
  },

  // Solves any H5P Flashcards or Crosswords in current frame/document
  async solve() {
    if (!this.hasH5P()) return { success: false, message: "No H5P instance found in this frame" };

    const instance = window.H5P.instances[0];
    const library = instance.libraryInfo ? instance.libraryInfo.machineName : '';

    console.log('[PESLMS Autopilot] Detected H5P module:', library);

    // 1. FLASHCARDS
    if (library.includes('Flashcards') || instance.options?.cards) {
      return await this.solveFlashcards(instance);
    }

    // 2. CROSSWORD
    if (library.includes('Crossword') || instance.content?.table?.cells) {
      return await this.solveCrossword(instance);
    }

    return { success: false, message: `H5P type ${library || 'unknown'} is not supported yet` };
  },

  // Flashcards solver
  async solveFlashcards(instance) {
    const cards = instance.options?.cards || [];
    if (!cards.length) return { success: false, message: "No cards found" };

    console.log(`[PESLMS Autopilot] Solving ${cards.length} flashcards in memory...`);
    let solvedCount = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const answer = card.answer || card.answers?.[0];

      // Find the active card input
      const input = document.querySelector('.h5p-current input.h5p-text-input, input.h5p-text-input');
      if (input && answer) {
        input.value = answer;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Click check button
        const checkBtn = document.querySelector('button.h5p-theme-check, button.h5p-check-button, .h5p-theme-check');
        if (checkBtn) checkBtn.click();
        await new Promise(r => setTimeout(r, 150));

        // Click next button
        const nextBtn = document.querySelector('button.h5p-theme-next, button.h5p-next-button, .h5p-theme-next');
        if (nextBtn) nextBtn.click();
        await new Promise(r => setTimeout(r, 150));

        solvedCount++;
      }
    }

    // Finish / Show results
    const showResults = document.querySelector('button.h5p-theme-show-results, button.h5p-show-results, .h5p-show-results');
    if (showResults) {
      showResults.click();
    }

    return { success: true, count: solvedCount, total: cards.length };
  },

  // Crossword solver
  async solveCrossword(instance) {
    const cells = instance.content?.table?.cells?.flat().filter(c => c && c.params?.solution) || [];
    if (!cells.length) return { success: false, message: "No crossword solution cells found" };

    console.log(`[PESLMS Autopilot] Solving crossword with ${cells.length} cells...`);

    // In-memory cell filling
    for (const cell of cells) {
      const solution = cell.params.solution;
      if (typeof cell.setAnswer === 'function') {
        cell.setAnswer(solution);
      }
      if (cell.cellInput) {
        cell.cellInput.value = solution;
        cell.cellInput.dispatchEvent(new Event('input', { bubbles: true }));
        cell.cellInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    await new Promise(r => setTimeout(r, 200));

    // Check answer / submit
    if (typeof instance.checkAnswer === 'function') {
      instance.checkAnswer();
    } else {
      const checkBtn = document.querySelector('button.h5p-crossword-check-button, button.h5p-theme-check, .h5p-theme-check');
      if (checkBtn) checkBtn.click();
    }

    return { success: true, total: cells.length };
  }
};
