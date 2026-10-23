// Precision Universal Solver for Any LMS, Quiz, and Exam Platform
window.UniversalSolver = {

  // Detect all questions on the current page across multiple LMS platforms
  detectAllQuestions() {
    const list = [];

    // ── 1. Moodle LMS (.que) ──
    const moodleQuestions = Array.from(document.querySelectorAll('.que'));
    if (moodleQuestions.length > 0) {
      for (const q of moodleQuestions) {
        if (q.offsetWidth === 0 && q.offsetHeight === 0) continue;
        const qText = q.querySelector('.qtext')?.innerText?.trim() || '';
        const image = q.querySelector('.qtext img, .formulation img:not([src*="theme/image.php"]):not([src*="unflagged"])');
        
        // Find radio/checkbox options, filtering out "Clear my choice"
        const inputs = Array.from(q.querySelectorAll('input[type="radio"], input[type="checkbox"]')).filter(r => {
          const lbl = q.querySelector(`label[for="${r.id}"]`)?.innerText?.trim() || r.parentElement?.innerText?.trim() || '';
          return !lbl.toLowerCase().includes('clear my choice') && r.value !== '-1';
        });

        const options = inputs.map((r, i) => {
          const lbl = q.querySelector(`label[for="${r.id}"]`) || r.parentElement;
          const cleanText = (lbl?.innerText || '').replace(/^[a-z0-9][\.\)\:\-]\s*/i, '').trim();
          return {
            element: r,
            labelEl: lbl,
            letter: String.fromCharCode(65 + i),
            text: cleanText,
            checked: r.checked
          };
        });

        const textInput = q.querySelector('input[type="text"], textarea');
        const isAnswered = options.some(o => o.checked) || (textInput && textInput.value.trim().length > 0);

        list.push({
          container: q,
          type: textInput ? 'text' : 'mcq',
          text: qText,
          image: image,
          options: options,
          textInput: textInput,
          isAnswered: isAnswered
        });
      }
      if (list.length > 0) return list;
    }

    // ── 2. Canvas LMS (.display_question) ──
    const canvasQuestions = Array.from(document.querySelectorAll('.display_question, .question_holder, .quiz_sortable .question'));
    if (canvasQuestions.length > 0) {
      for (const q of canvasQuestions) {
        if (q.offsetWidth === 0 && q.offsetHeight === 0) continue;
        const qText = q.querySelector('.question_text')?.innerText?.trim() || '';
        const image = q.querySelector('.question_text img');
        const inputs = Array.from(q.querySelectorAll('.answers input[type="radio"], .answers input[type="checkbox"]'));
        const options = inputs.map((r, i) => {
          const lbl = q.querySelector(`label[for="${r.id}"]`) || r.closest('.answer') || r.parentElement;
          const cleanText = (lbl?.innerText || '').replace(/^[a-z0-9][\.\)\:\-]\s*/i, '').trim();
          return {
            element: r,
            labelEl: lbl,
            letter: String.fromCharCode(65 + i),
            text: cleanText,
            checked: r.checked
          };
        });
        const textInput = q.querySelector('input[type="text"], textarea');
        const isAnswered = options.some(o => o.checked) || (textInput && textInput.value.trim().length > 0);

        list.push({
          container: q,
          type: textInput ? 'text' : 'mcq',
          text: qText,
          image: image,
          options: options,
          textInput: textInput,
          isAnswered: isAnswered
        });
      }
      if (list.length > 0) return list;
    }

    // ── 3. Google Forms (div[role="listitem"]) ──
    const gFormsItems = Array.from(document.querySelectorAll('div[role="listitem"]'));
    if (gFormsItems.length > 0) {
      for (const item of gFormsItems) {
        const titleEl = item.querySelector('[role="heading"], .M7eMe');
        if (!titleEl) continue;
        const qText = titleEl.innerText.trim();
        const image = item.querySelector('img:not([aria-hidden="true"])');
        const radios = Array.from(item.querySelectorAll('[role="radio"], [role="checkbox"], input[type="radio"]'));
        if (radios.length >= 2) {
          const options = radios.map((r, i) => {
            const cleanText = (r.getAttribute('aria-label') || r.innerText || '').trim();
            const checked = r.getAttribute('aria-checked') === 'true' || r.checked === true;
            return {
              element: r,
              labelEl: r,
              letter: String.fromCharCode(65 + i),
              text: cleanText,
              checked: checked
            };
          });
          list.push({
            container: item,
            type: 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          });
        }
      }
      if (list.length > 0) return list;
    }

    // ── 4. Blackboard LMS (.takeQuestionDiv) ──
    const bbQuestions = Array.from(document.querySelectorAll('.takeQuestionDiv, div[id^="question_"]'));
    if (bbQuestions.length > 0) {
      for (const q of bbQuestions) {
        const qText = q.querySelector('.vtbegenerated, .legend-visible')?.innerText?.trim() || '';
        const inputs = Array.from(q.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        if (inputs.length >= 2) {
          const options = inputs.map((r, i) => {
            const lbl = q.querySelector(`label[for="${r.id}"]`) || r.parentElement;
            return {
              element: r,
              labelEl: lbl,
              letter: String.fromCharCode(65 + i),
              text: (lbl?.innerText || '').trim(),
              checked: r.checked
            };
          });
          list.push({
            container: q,
            type: 'mcq',
            text: qText,
            image: q.querySelector('img'),
            options: options,
            isAnswered: options.some(o => o.checked)
          });
        }
      }
      if (list.length > 0) return list;
    }

    // ── 5. PES LMS / Customized EdTech Single-Step Quizzes ──
    const visibleHead = Array.from(document.querySelectorAll('.quiz-question, .mx-q-question, [class*="question-head"]')).find(q => {
      return q.offsetWidth > 0 && q.offsetHeight > 0 && q.style.display !== 'none' && !q.classList.contains('hidden');
    });
    if (visibleHead) {
      const qText = visibleHead.querySelector('h2, h3, .qtext')?.innerText?.trim() || visibleHead.innerText.trim();
      const image = visibleHead.querySelector('img:not([src*="logo"]):not([src*="avatar"]):not([src*="icon"])');
      const parent = visibleHead.parentElement;
      const optsUl = parent?.querySelector('.quiz-options:not([style*="display: none"]), .mx-q-options:not([style*="display: none"])') ||
                     Array.from(document.querySelectorAll('.quiz-options, .mx-q-options')).find(ul => ul.offsetWidth > 0 && ul.offsetHeight > 0);
      if (optsUl) {
        const optionItems = Array.from(optsUl.querySelectorAll('li, div.quiz-question-block, div.mx-q-block, label')).filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        const uniqueItems = optionItems.filter(item => !optionItems.some(other => other !== item && other.contains(item)));
        if (uniqueItems.length >= 2) {
          const options = uniqueItems.map((item, i) => {
            const letter = item.querySelector('.mx-q-opt-letter, [class*="letter"]')?.innerText?.trim();
            const labelText = item.querySelector('label')?.innerText?.trim() || item.innerText.replace(/^[A-D]\s*/, '').trim();
            const radio = item.querySelector('input[type="radio"]');
            return {
              element: radio || item,
              labelEl: item,
              letter: letter || String.fromCharCode(65 + i),
              text: labelText,
              checked: radio?.checked || item.classList.contains('selected') || item.classList.contains('active')
            };
          });
          return [{
            container: parent || visibleHead,
            type: 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          }];
        }
      }
    }

    // ── 6. Generic HTML Forms Fallback (fieldset, radiogroup, form-groups) ──
    const groups = Array.from(document.querySelectorAll('fieldset, [role="radiogroup"], .form-group, .question-block'));
    for (const group of groups) {
      const radios = Array.from(group.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      if (radios.length >= 2) {
        const legend = group.querySelector('legend, h2, h3, h4, .question-title, p')?.innerText?.trim() || '';
        const options = radios.map((r, i) => {
          const lbl = group.querySelector(`label[for="${r.id}"]`) || r.parentElement;
          return {
            element: r,
            labelEl: lbl,
            letter: String.fromCharCode(65 + i),
            text: (lbl?.innerText || '').trim(),
            checked: r.checked
          };
        });
        list.push({
          container: group,
          type: 'mcq',
          text: legend,
          image: group.querySelector('img'),
          options: options,
          isAnswered: options.some(o => o.checked)
        });
      }
    }

    return list;
  },

  // Returns question in view or first unanswered
  detectCurrentQuestion() {
    const all = this.detectAllQuestions();
    if (!all.length) return null;

    // First try: UNANSWERED question currently in viewport
    const inViewUnanswered = all.find(q => {
      if (q.isAnswered) return false;
      const rect = q.container.getBoundingClientRect();
      return rect.top >= -100 && rect.bottom <= (window.innerHeight + 150);
    });
    if (inViewUnanswered) return inViewUnanswered;

    // Second try: first unanswered question anywhere on the page
    const unanswered = all.find(q => !q.isAnswered);
    if (unanswered) return unanswered;

    // Fallback: question currently in viewport or first question
    const inView = all.find(q => {
      const rect = q.container.getBoundingClientRect();
      return rect.top >= -100 && rect.bottom <= (window.innerHeight + 150);
    });
    return inView || all[0];
  },

  // Locates the Next / Continue button (NOT submit/finish)
  findNextButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"]'));
    return candidates.find(b => {
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return (
        txt === 'next' ||
        txt.includes('next page') ||
        txt.includes('next question') ||
        txt.includes('continue')
      ) && !txt.includes('previous') && !txt.includes('prev') && !txt.includes('submit') && !txt.includes('finish');
    });
  },

  // Locates submit / finish attempt buttons specifically
  findSubmitButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"]'));
    return candidates.find(b => {
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return (
        txt.includes('finish attempt') ||
        txt.includes('submit all') ||
        txt.includes('submit quiz') ||
        txt.includes('submit answers') ||
        txt.includes('submit test') ||
        txt.includes('submit exam') ||
        (txt === 'submit') ||
        txt.includes('finish quiz')
      );
    });
  },

  // Find any navigation button (next OR submit) for advancing
  findAnyAdvanceButton() {
    // Prefer "Next" over "Submit"
    return this.findNextButton() || this.findSubmitButton();
  },

  // Detect if page shows a completion/thank-you/submitted state
  isQuizComplete() {
    const body = document.body?.innerText?.toLowerCase() || '';
    const completionPhrases = [
      'your attempt has been submitted',
      'your response has been recorded',
      'quiz has been submitted',
      'test submitted',
      'thank you for completing',
      'attempt finished',
      'your answers have been submitted',
      'submission successful',
      'you have completed'
    ];
    return completionPhrases.some(phrase => body.includes(phrase));
  },

  // Find Moodle-style confirmation submit button (the second "Submit all and finish" on the confirmation page)
  findConfirmSubmitButton() {
    const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
    return candidates.find(b => {
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      const txt = (b.innerText || b.value || '').trim().toLowerCase();
      return txt.includes('submit all and finish') || txt.includes('confirm submit');
    });
  },

  // Find assignment links in course page (Moodle, Canvas, etc.)
  findAssignmentLinks() {
    const links = [];
    // Moodle activity links
    const moodleActivities = document.querySelectorAll('.activity a.aalink, .activityinstance a, .activity-item a[href*="mod/quiz"], .activity-item a[href*="mod/assign"]');
    moodleActivities.forEach(a => {
      if (a.href && (a.href.includes('mod/quiz') || a.href.includes('mod/assign') || a.href.includes('mod/workshop'))) {
        links.push({ url: a.href, title: a.innerText?.trim() || 'Assignment' });
      }
    });
    // Canvas assignment links
    const canvasActivities = document.querySelectorAll('.assignment a, .ig-title a, .module-item-title a');
    canvasActivities.forEach(a => {
      if (a.href && (a.href.includes('/assignments/') || a.href.includes('/quizzes/'))) {
        links.push({ url: a.href, title: a.innerText?.trim() || 'Assignment' });
      }
    });
    // Google Classroom
    const classroomLinks = document.querySelectorAll('a[href*="courseWork"], a[href*="coursework"]');
    classroomLinks.forEach(a => {
      if (a.href) links.push({ url: a.href, title: a.innerText?.trim() || 'Assignment' });
    });
    return links;
  },

  // Find course links on a dashboard/home page
  findCourseLinks() {
    const links = [];
    // Moodle dashboard course list
    const moodleCourses = document.querySelectorAll('.course-listitem a, .coursename a, .course_title a, a[href*="course/view"]');
    moodleCourses.forEach(a => {
      if (a.href && a.href.includes('course/view')) {
        links.push({ url: a.href, title: a.innerText?.trim() || 'Course' });
      }
    });
    // Canvas dashboard
    const canvasCourses = document.querySelectorAll('.ic-DashboardCard__link, a[href*="/courses/"]');
    canvasCourses.forEach(a => {
      if (a.href && a.href.match(/\/courses\/\d+$/)) {
        links.push({ url: a.href, title: a.innerText?.trim() || 'Course' });
      }
    });
    return links;
  },

  // Solves a specific question item
  async solveQuestionItem(q, updateStatus) {
    if (!q || !q.text) return { success: false, message: 'Invalid question' };

    q.container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateStatus?.(`Thinking: "${q.text.slice(0, 35)}..."`);

    // ── MCQ / True-False ──
    if (q.type === 'mcq' && q.options && q.options.length >= 2) {
      const aiRes = await window.AIEngine.solveMCQ(q.text, q.options, q.image);
      if (aiRes?.warningNotice) {
        updateStatus?.(aiRes.warningNotice);
        await new Promise(r => setTimeout(r, 1200));
      }
      if (!aiRes || !aiRes.success) {
        const err = aiRes?.error || 'AI call failed';
        if (aiRes?.rateLimited) {
          updateStatus?.('⚠️ Free AI limit (1 req/30s). Enter Groq key in popup for instant speed!');
        } else {
          updateStatus?.(`AI Error: ${err.slice(0, 45)}`);
        }
        return { 
          success: false, 
          rateLimited: !!aiRes?.rateLimited, 
          waitSec: aiRes?.waitSec || 30, 
          message: err 
        };
      }

      const letter = aiRes.letter;
      let target = null;
      if (letter) {
        const idx = letter.charCodeAt(0) - 65;
        if (q.options[idx]) target = q.options[idx];
      }

      // Fallback matching by letter
      if (!target && letter) {
        target = q.options.find(o => o.letter?.toUpperCase() === letter);
      }

      if (!target) {
        updateStatus?.(`AI selected ${letter || 'unknown'}, could not match option.`);
        return { success: false, message: `Could not match option ${letter}` };
      }

      // Execute robust clicks
      const clickEl = target.labelEl || target.element;
      clickEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ['pointerdown', 'mousedown', 'click', 'mouseup'].forEach(evt => {
        clickEl.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true }));
      });

      if (target.element) {
        target.element.checked = true;
        target.element.dispatchEvent(new Event('input', { bubbles: true }));
        target.element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      q.isAnswered = true;

      // Visual indicator
      q.container.style.transition = 'box-shadow 0.3s ease';
      q.container.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.4)';
      setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

      updateStatus?.(`Selected (${target.letter}): ${target.text.slice(0, 22)}`);
      return { success: true, answer: target.text };
    }

    // ── Short Answer / Text ──
    if (q.type === 'text' && q.textInput) {
      const aiRes = await window.AIEngine.solveBriefAnswer(q.text);
      if (aiRes?.warningNotice) {
        updateStatus?.(aiRes.warningNotice);
        await new Promise(r => setTimeout(r, 1200));
      }
      if (aiRes?.success && aiRes?.text) {
        let ans = aiRes.text.trim();
        // HARD FAILSAFE: Never type JSON, prompts, or reasoning tokens into a student's answer input
        if (ans.startsWith('{') || ans.includes('"role"') || ans.includes('"reasoning"') || ans.includes('"assistant"')) {
          try {
            const parsed = JSON.parse(ans);
            ans = parsed.content || parsed.answer || parsed.result || '';
          } catch (e) {
            ans = '';
          }
        }
        ans = ans.replace(/^["'`]+|["'`]+$/g, '').trim();
        if (!ans) {
          updateStatus?.('AI returned non-answer, skipping.');
          return { success: false, message: 'Invalid AI answer format' };
        }
        q.textInput.focus();
        q.textInput.value = ans;
        q.textInput.dispatchEvent(new Event('input', { bubbles: true }));
        q.textInput.dispatchEvent(new Event('change', { bubbles: true }));
        q.isAnswered = true;
        updateStatus?.(`Answered: ${ans.slice(0, 25)}`);
        return { success: true, answer: ans };
      } else {
        return { 
          success: false, 
          rateLimited: !!aiRes?.rateLimited, 
          waitSec: aiRes?.waitSec || 30, 
          message: aiRes?.error || 'AI call failed' 
        };
      }
    }

    return { success: false, message: 'Unsupported question format' };
  },

  // Solves current/active question (Single click mode)
  async solve(updateStatus) {
    const currentQ = this.detectCurrentQuestion();
    if (!currentQ) {
      updateStatus?.('Could not detect question.');
      return { success: false, message: 'Could not detect question.' };
    }
    return await this.solveQuestionItem(currentQ, updateStatus);
  },

  // ══════════════════════════════════════════════════════════════
  //  CORE: Solve all questions on the current page (shared logic)
  // ══════════════════════════════════════════════════════════════
  async _solveAllOnPage(updateStatus, isRunningCallback) {
    const questions = this.detectAllQuestions();
    if (!questions.length) {
      updateStatus?.('No questions found on this page.');
      return { questionsFound: false, allAnswered: false };
    }

    for (let i = 0; i < questions.length; i++) {
      if (!isRunningCallback()) return { questionsFound: true, allAnswered: false, stopped: true };
      const q = questions[i];
      if (q.isAnswered) continue;

      let answered = false;
      let attempts = 0;

      while (!answered && isRunningCallback() && attempts < 8) {
        attempts++;
        updateStatus?.(`Solving question ${i + 1} of ${questions.length}...`);
        const res = await this.solveQuestionItem(q, updateStatus);

        if (res.success) {
          answered = true;
          q.isAnswered = true;
          break;
        }

        if (res.rateLimited) {
          let waitTime = (res.waitSec || 30) + 1;
          while (waitTime > 0 && isRunningCallback()) {
            updateStatus?.(`⏳ Free AI limit: waiting ${waitTime}s to solve Q${i + 1}... (Add Groq or Gemini key to skip)`);
            await new Promise(r => setTimeout(r, 1000));
            waitTime--;
          }
        } else {
          updateStatus?.(`Retrying Q${i + 1} in 2s... (${(res.message || 'error').slice(0, 30)})`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!isRunningCallback()) return { questionsFound: true, allAnswered: false, stopped: true };

      // Brief delay between questions
      await new Promise(r => setTimeout(r, 1200));
    }

    // Verify
    const unanswered = this.detectAllQuestions().filter(q => !q.isAnswered);
    return { questionsFound: true, allAnswered: unanswered.length === 0, unansweredCount: unanswered.length };
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: DRAFT ONLY — Solve questions, never submit/navigate
  // ══════════════════════════════════════════════════════════════
  async _runDraftMode(updateStatus, isRunningCallback) {
    updateStatus?.('[Draft] Solving all visible questions…');
    const result = await this._solveAllOnPage(updateStatus, isRunningCallback);

    if (result.allAnswered) {
      updateStatus?.('✅ All questions drafted! Review and submit manually.');
    } else if (result.unansweredCount > 0) {
      updateStatus?.(`⚠️ ${result.unansweredCount} question(s) could not be solved.`);
    } else if (!result.questionsFound) {
      updateStatus?.('No questions detected on this page.');
    }
    // Draft mode: NEVER clicks next/submit. Done.
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: FULL SUBMIT — Solve + navigate + submit with confirm
  // ══════════════════════════════════════════════════════════════
  async _runSubmitMode(updateStatus, isRunningCallback) {
    let pagesProcessed = 0;

    while (isRunningCallback() && pagesProcessed < 50) {
      pagesProcessed++;

      // Check if quiz is already complete
      if (this.isQuizComplete()) {
        updateStatus?.('✅ Quiz submitted and complete! 🎉');
        return;
      }

      const result = await this._solveAllOnPage(updateStatus, isRunningCallback);
      if (!isRunningCallback()) return;

      if (!result.questionsFound) {
        // Maybe we're on a review/summary page — look for submit
        const submitBtn = this.findSubmitButton() || this.findConfirmSubmitButton();
        if (submitBtn) {
          updateStatus?.('[Submit] Found submit button on summary page. Submitting…');
          submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 600));
          submitBtn.click();
          await new Promise(r => setTimeout(r, 3000));

          // Check for confirmation dialog (Moodle asks twice)
          const confirmBtn = this.findConfirmSubmitButton();
          if (confirmBtn) {
            updateStatus?.('[Submit] Confirming final submission…');
            await new Promise(r => setTimeout(r, 500));
            confirmBtn.click();
            await new Promise(r => setTimeout(r, 3000));
          }

          if (this.isQuizComplete()) {
            updateStatus?.('✅ Quiz submitted and complete! 🎉');
            return;
          }
          continue;
        }
        updateStatus?.('No questions found. Quiz may already be complete.');
        return;
      }

      if (!result.allAnswered) {
        updateStatus?.(`⚠️ ${result.unansweredCount} question(s) pending. Cannot submit incomplete.`);
        return;
      }

      // All answered on this page — try Next first, then Submit
      const nextBtn = this.findNextButton();
      if (nextBtn) {
        updateStatus?.('[Submit] All answered. Going to next page…');
        nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 800));
        nextBtn.click();
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }

      // No "Next" → Look for submit/finish
      const submitBtn = this.findSubmitButton();
      if (submitBtn) {
        updateStatus?.('[Submit] All questions answered. Submitting quiz…');
        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 800));
        submitBtn.click();
        await new Promise(r => setTimeout(r, 3000));

        // Moodle double-confirm pattern
        const confirmBtn = this.findConfirmSubmitButton();
        if (confirmBtn) {
          updateStatus?.('[Submit] Confirming final submission…');
          await new Promise(r => setTimeout(r, 500));
          confirmBtn.click();
          await new Promise(r => setTimeout(r, 3000));
        }

        if (this.isQuizComplete()) {
          updateStatus?.('✅ Quiz submitted and complete! 🎉');
          return;
        }
        continue;
      }

      // Nothing to click — we're done
      updateStatus?.('✅ All questions answered! No submit button found — review manually.');
      return;
    }
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: COURSE BATCH — Loop through all assignments in course
  // ══════════════════════════════════════════════════════════════
  async _runCourseBatchMode(updateStatus, isRunningCallback) {
    const assignments = this.findAssignmentLinks();
    if (assignments.length === 0) {
      // Maybe we're already on a quiz page — just do Submit mode
      updateStatus?.('[Course] No assignment list found. Running Submit mode on current page…');
      await this._runSubmitMode(updateStatus, isRunningCallback);
      return;
    }

    updateStatus?.(`[Course] Found ${assignments.length} assignments. Starting batch…`);

    for (let i = 0; i < assignments.length; i++) {
      if (!isRunningCallback()) return;
      const asgn = assignments[i];
      updateStatus?.(`[Course] Assignment ${i + 1}/${assignments.length}: ${asgn.title.slice(0, 30)}…`);

      // Navigate to the assignment
      window.location.href = asgn.url;

      // Wait for page load
      await new Promise(r => setTimeout(r, 4000));

      // Run submit mode on this assignment
      await this._runSubmitMode(updateStatus, isRunningCallback);
      if (!isRunningCallback()) return;

      await new Promise(r => setTimeout(r, 2000));
    }

    updateStatus?.(`✅ Course batch complete! ${assignments.length} assignments processed. 🎉`);
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: ALL COURSES — Loop through every course + assignments
  // ══════════════════════════════════════════════════════════════
  async _runAllCoursesMode(updateStatus, isRunningCallback) {
    const courses = this.findCourseLinks();
    if (courses.length === 0) {
      // Maybe we're already on a course page
      updateStatus?.('[All Courses] No course list found. Trying Course Batch on current page…');
      await this._runCourseBatchMode(updateStatus, isRunningCallback);
      return;
    }

    updateStatus?.(`[All Courses] Found ${courses.length} courses. Starting full sweep…`);

    for (let i = 0; i < courses.length; i++) {
      if (!isRunningCallback()) return;
      const course = courses[i];
      updateStatus?.(`[All Courses] Course ${i + 1}/${courses.length}: ${course.title.slice(0, 30)}…`);

      // Navigate to course
      window.location.href = course.url;
      await new Promise(r => setTimeout(r, 4000));

      // Run course batch on this course
      await this._runCourseBatchMode(updateStatus, isRunningCallback);
      if (!isRunningCallback()) return;

      await new Promise(r => setTimeout(r, 2000));
    }

    updateStatus?.(`✅ All courses complete! ${courses.length} courses processed. 🎉`);
  },

  // ══════════════════════════════════════════════════════════════
  //  MAIN ENTRY: Mode-Aware Auto-Pilot Dispatcher
  // ══════════════════════════════════════════════════════════════
  async startAutoPilot(updateStatus, isRunningCallback, mode = 'draft') {
    console.log(`[Autopilot AI] Starting in mode: ${mode}`);

    switch (mode) {
      case 'draft':
        await this._runDraftMode(updateStatus, isRunningCallback);
        break;
      case 'submit':
        await this._runSubmitMode(updateStatus, isRunningCallback);
        break;
      case 'course':
        await this._runCourseBatchMode(updateStatus, isRunningCallback);
        break;
      case 'allcourses':
        await this._runAllCoursesMode(updateStatus, isRunningCallback);
        break;
      default:
        updateStatus?.(`Unknown mode: ${mode}. Running Draft mode.`);
        await this._runDraftMode(updateStatus, isRunningCallback);
    }
  }
};
