// Quiz Solver: Automatically handles Moodle MCQs and Brief Answers / Essays
window.QuizSolver = {
  // Built-in verified answer database for standard PESLMS courses
  verifiedAnswers: {
    "effective communication": "The 7 Cs of effective communication are: Clarity, Conciseness, Concreteness, Correctness, Coherence, Completeness, and Courtesy.",
    "four types of business communication": "Verbal (Oral), Written, Non-Verbal, and Visual Communication.",
    "four directions of organizational communication": "Downward, Upward, Horizontal, and Diagonal Communication.",
    "five elements of the communication cycle": "Sender, Encoding, Message, Channel, Receiver (Decoding), and Feedback.",
    "why is feedback important": "Feedback confirms that the receiver has understood the message correctly and helps prevent misunderstandings.",
    "professional telephone call": "Speak clearly and politely, and confirm important information before ending the call.",
    "barriers to communication": "Physical, Language, Psychological, and Cultural barriers.",
    "parts of a professional email": "Subject Line, Greeting, Body, and Professional Sign-off.",
    "what is business communication": "Business communication is the exchange of information, ideas, and instructions within or outside an organization to achieve business objectives.",
    "what is communication": "Communication is the process of sharing information, ideas, or feelings between two or more people to achieve a common understanding."
  },

  // Check if current page is an active Moodle quiz attempt
  isQuizAttemptPage() {
    return window.location.href.includes('/mod/quiz/attempt.php');
  },

  isQuizSummaryPage() {
    return window.location.href.includes('/mod/quiz/summary.php');
  },

  isQuizViewPage() {
    return window.location.href.includes('/mod/quiz/view.php');
  },

  // Solves whatever question is present on the current attempt page
  async solveCurrentPage() {
    if (window.UniversalSolver) {
      const res = await window.UniversalSolver._solveAllOnPage(() => {}, () => true);
      window.onbeforeunload = null;
      return { success: true, allAnswered: res.allAnswered };
    }

    const questions = Array.from(document.querySelectorAll('.que'));
    if (!questions.length) return { success: false, message: "No question containers found on this page" };

    console.log(`[PESLMS Autopilot] Processing ${questions.length} questions on page...`);

    for (const q of questions) {
      const qText = q.querySelector('.qtext')?.innerText?.trim() || "";

      // 1. Multiple Choice Question (multichoice)
      if (q.classList.contains('multichoice')) {
        await this.solveMCQQuestion(q, qText);
      }
      // 2. Essay / Brief Answer Question (essay)
      else if (q.classList.contains('essay')) {
        await this.solveEssayQuestion(q, qText);
      }
    }

    // Bypass unsaved changes warning
    window.onbeforeunload = null;

    return { success: true, count: questions.length };
  },

  // Solve MCQ
  async solveMCQQuestion(qContainer, qText) {
    const answerDivs = Array.from(qContainer.querySelectorAll('.answer div[class^="r"], .answer label'));
    const options = answerDivs.map(div => {
      const input = div.querySelector('input[type="radio"]');
      const text = div.innerText.replace(/^[a-d]\.\s*/i, '').trim();
      return { input, text };
    }).filter(opt => opt.input);

    if (!options.length) return;

    // Ask AI engine
    const selectedLetter = await window.AIEngine.solveMCQ(qText, options);
    let chosenOption = null;

    if (selectedLetter) {
      const idx = selectedLetter.charCodeAt(0) - 65;
      if (options[idx]) chosenOption = options[idx];
    }

    // Default to first option if AI is unavailable
    if (!chosenOption && options.length > 0) {
      chosenOption = options[0];
    }

    if (chosenOption && chosenOption.input) {
      chosenOption.input.checked = true;
      chosenOption.input.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[PESLMS Autopilot] Selected option: ${chosenOption.text}`);
    }
  },

  // Solve Essay / Brief Answer
  async solveEssayQuestion(qContainer, qText) {
    let answerText = "";
    const cleanLowerQ = qText.toLowerCase();

    // 1. First check our verified local database
    for (const [key, val] of Object.entries(this.verifiedAnswers)) {
      if (cleanLowerQ.includes(key)) {
        answerText = val;
        break;
      }
    }

    // 2. If not in DB, generate via Gemini Nano / API
    if (!answerText) {
      answerText = await window.AIEngine.solveBriefAnswer(qText);
    }

    // 3. Fallback generic answer
    if (!answerText) {
      answerText = "Communication is the core exchange of structured knowledge, clear understanding, and feedback between stakeholders to fulfill organizational objectives.";
    }

    // Inject into TinyMCE and textarea
    const ta = qContainer.querySelector('textarea[name$="_answer"]');
    const ifr = qContainer.querySelector('iframe[id*="_answer_id_ifr"]');
    const doc = ifr?.contentDocument || ifr?.contentWindow?.document;

    if (doc && doc.body) {
      doc.body.innerHTML = `<p>${answerText}</p>`;
      doc.body.dispatchEvent(new Event('input', { bubbles: true }));
      doc.body.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (ta) {
      ta.value = `<p>${answerText}</p>`;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (window.tinyMCE) {
      window.tinyMCE.triggerSave();
    }

    console.log(`[PESLMS Autopilot] Injected answer for: "${qText.slice(0, 35)}..."`);
  },

  // Click Next page or Finish Attempt
  advancePage() {
    window.onbeforeunload = null;
    const nextBtn = document.querySelector('input#mod_quiz-next-nav, input[name="next"], button[name="next"]');
    if (nextBtn) {
      nextBtn.click();
      return true;
    }
    return false;
  },

  // Submit attempt on summary page
  submitAttempt() {
    window.onbeforeunload = null;
    const submitBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b => 
      b.innerText?.includes('Submit all and finish') || b.value?.includes('Submit all and finish')
    );
    if (submitBtn) {
      submitBtn.click();
      // Confirm dialog in Moodle modal
      setTimeout(() => {
        const confirmBtn = document.querySelector('.moodle-dialogue-confirm button.btn-primary, .modal-dialog button.btn-primary');
        if (confirmBtn) confirmBtn.click();
      }, 300);
      return true;
    }
    return false;
  }
};
