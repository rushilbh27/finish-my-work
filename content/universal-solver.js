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
        const image = q.querySelector('.qtext img, .formulation img:not([src*="theme/image.php"]):not([src*="unflagged"]):not([src*="core"])');

        // Check A: Drag and Drop into text (ddwtos / blanks)
        const isDdwtos = q.classList.contains('ddwtos') || 
                         q.querySelector('.drags, .draghome, .dropzone, input.placeinput') !== null;
        if (isDdwtos) {
          const dropInputs = Array.from(q.querySelectorAll('input.placeinput, input[name*="_p"]'));
          const dropZones = Array.from(q.querySelectorAll('.dropzone, .drop.place, span[class*="place"]')).filter(el => !el.classList.contains('placeinput'));
          const dragEls = Array.from(q.querySelectorAll('.drags .drag, .draghome, [class*="choice"]')).filter(el => {
            return el.innerText && el.innerText.trim().length > 0 && !el.classList.contains('dropzone');
          });

          const choices = [];
          const seen = new Set();
          dragEls.forEach((el, idx) => {
            const txt = el.innerText.trim();
            if (txt && !seen.has(txt)) {
              seen.add(txt);
              const match = el.className.match(/choice(\d+)/);
              const choiceNum = match ? parseInt(match[1], 10) : (idx + 1);
              choices.push({ element: el, text: txt, choiceNum });
            }
          });

          const isAnswered = dropInputs.length > 0 ? dropInputs.every(inp => inp.value && inp.value !== '0') : false;

          list.push({
            container: q,
            type: 'ddwtos',
            text: qText,
            image: image,
            dropInputs: dropInputs,
            dropZones: dropZones,
            choices: choices,
            isAnswered: isAnswered
          });
          continue;
        }

        // Check B: Matching / Dropdowns (.match, .gapselect, or contains <select>)
        const selects = Array.from(q.querySelectorAll('select'));
        if (selects.length > 0) {
          const dropdowns = selects.map((sel, idx) => {
            const row = sel.closest('tr, .r0, .r1, .match-row') || sel.parentElement;
            const rowText = row?.querySelector('td.text, .text, label')?.innerText?.trim() || 
                            row?.innerText?.replace(sel.innerText || '', '').trim() || `Item ${idx + 1}`;
            const rowImg = row?.querySelector('img:not([src*="theme/image.php"]):not([src*="unflagged"])');
            
            const options = Array.from(sel.querySelectorAll('option')).map((opt, oi) => ({
              element: opt,
              value: opt.value,
              text: opt.innerText.trim(),
              index: oi
            })).filter(opt => opt.value !== '' && opt.value !== '0' && !opt.text.toLowerCase().includes('choose') && !opt.text.toLowerCase().includes('select'));

            const isSelected = sel.value !== '' && sel.value !== '0' && sel.selectedIndex > 0;

            return {
              select: sel,
              row: row,
              prompt: rowText,
              image: rowImg,
              options: options,
              isAnswered: isSelected
            };
          });

          const isAnswered = dropdowns.length > 0 && dropdowns.every(d => d.isAnswered);

          list.push({
            container: q,
            type: 'matching',
            text: qText,
            image: image,
            dropdowns: dropdowns,
            isAnswered: isAnswered
          });
          continue;
        }

        // Check C: Essay / TinyMCE
        const isEssay = q.classList.contains('essay') || q.querySelector('iframe[id*="answer"], textarea[name*="answer"]');
        if (isEssay) {
          const textarea = q.querySelector('textarea');
          const iframe = q.querySelector('iframe[id*="answer"]');
          const isAnswered = (textarea && textarea.value.trim().length > 0);
          list.push({
            container: q,
            type: 'essay',
            text: qText,
            image: image,
            textarea: textarea,
            iframe: iframe,
            isAnswered: isAnswered
          });
          continue;
        }

        // Check D: Radios / Checkboxes (MCQ / Multi-Choice)
        const inputs = Array.from(q.querySelectorAll('input[type="radio"], input[type="checkbox"]')).filter(r => {
          const lbl = q.querySelector(`label[for="${r.id}"]`)?.innerText?.trim() || r.parentElement?.innerText?.trim() || '';
          return !lbl.toLowerCase().includes('clear my choice') && r.value !== '-1';
        });

        if (inputs.length >= 2) {
          const isMulti = inputs.some(i => i.type === 'checkbox') || qText.toLowerCase().includes('select one or more');
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

          list.push({
            container: q,
            type: isMulti ? 'multichoice' : 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          });
          continue;
        }

        // Check E: Short Answer / Numerical text input
        const textInput = q.querySelector('input[type="text"]:not([class*="placeinput"]), input[type="number"], textarea');
        if (textInput) {
          list.push({
            container: q,
            type: 'text',
            text: qText,
            image: image,
            textInput: textInput,
            isAnswered: textInput.value.trim().length > 0
          });
          continue;
        }

        // Fallback for generic Moodle question
        list.push({
          container: q,
          type: 'mcq',
          text: qText,
          image: image,
          options: [],
          isAnswered: false
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

        // Check for dropdown matching in Canvas
        const selects = Array.from(q.querySelectorAll('select'));
        if (selects.length > 0) {
          const dropdowns = selects.map((sel, idx) => {
            const row = sel.closest('.answer, .matching_question_answer') || sel.parentElement;
            const prompt = row?.querySelector('.answer_match_left')?.innerText?.trim() || `Item ${idx + 1}`;
            const options = Array.from(sel.querySelectorAll('option')).map((opt, oi) => ({
              element: opt,
              value: opt.value,
              text: opt.innerText.trim(),
              index: oi
            })).filter(o => o.value !== '' && o.value !== '0');
            return { select: sel, row, prompt, options, isAnswered: sel.value !== '' && sel.selectedIndex > 0 };
          });
          list.push({
            container: q,
            type: 'matching',
            text: qText,
            image: image,
            dropdowns: dropdowns,
            isAnswered: dropdowns.every(d => d.isAnswered)
          });
          continue;
        }

        const inputs = Array.from(q.querySelectorAll('.answers input[type="radio"], .answers input[type="checkbox"]'));
        if (inputs.length >= 2) {
          const isMulti = inputs.some(i => i.type === 'checkbox');
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
          list.push({
            container: q,
            type: isMulti ? 'multichoice' : 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          });
          continue;
        }

        const textInput = q.querySelector('input[type="text"], textarea');
        if (textInput) {
          list.push({
            container: q,
            type: 'text',
            text: qText,
            image: image,
            textInput: textInput,
            isAnswered: textInput.value.trim().length > 0
          });
          continue;
        }
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

        // Check for dropdown in Google Forms
        const gSelect = item.querySelector('select, div[role="listbox"]');
        if (gSelect) {
          const opts = Array.from(gSelect.querySelectorAll('option, div[role="option"]')).map((o, oi) => ({
            element: o,
            value: o.value || o.getAttribute('data-value') || oi.toString(),
            text: (o.innerText || o.getAttribute('aria-label') || '').trim()
          })).filter(o => o.text && !o.text.toLowerCase().includes('choose'));
          if (opts.length > 0) {
            list.push({
              container: item,
              type: 'matching',
              text: qText,
              image: image,
              dropdowns: [{ select: gSelect, prompt: qText, options: opts, isAnswered: false }],
              isAnswered: false
            });
            continue;
          }
        }

        // Radios and Checkboxes
        const radios = Array.from(item.querySelectorAll('[role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]'));
        if (radios.length >= 2) {
          const isMulti = radios.some(r => r.getAttribute('role') === 'checkbox' || r.type === 'checkbox');
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
            type: isMulti ? 'multichoice' : 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          });
          continue;
        }

        // Text inputs
        const gText = item.querySelector('input[type="text"], textarea');
        if (gText) {
          list.push({
            container: item,
            type: 'text',
            text: qText,
            image: image,
            textInput: gText,
            isAnswered: gText.value.trim().length > 0
          });
          continue;
        }
      }
      if (list.length > 0) return list;
    }

    // ── 4. Blackboard LMS (.takeQuestionDiv) ──
    const bbQuestions = Array.from(document.querySelectorAll('.takeQuestionDiv, div[id^="question_"]'));
    if (bbQuestions.length > 0) {
      for (const q of bbQuestions) {
        const qText = q.querySelector('.vtbegenerated, .legend-visible')?.innerText?.trim() || '';
        const image = q.querySelector('img');

        // Check for matching selects
        const selects = Array.from(q.querySelectorAll('select'));
        if (selects.length > 0) {
          const dropdowns = selects.map((sel, idx) => {
            const row = sel.closest('tr') || sel.parentElement;
            const prompt = row?.innerText?.replace(sel.innerText || '', '').trim() || `Item ${idx + 1}`;
            const options = Array.from(sel.querySelectorAll('option')).map((opt, oi) => ({
              element: opt,
              value: opt.value,
              text: opt.innerText.trim(),
              index: oi
            })).filter(o => o.value !== '' && o.value !== '-1');
            return { select: sel, row, prompt, options, isAnswered: sel.selectedIndex > 0 };
          });
          list.push({
            container: q,
            type: 'matching',
            text: qText,
            image: image,
            dropdowns: dropdowns,
            isAnswered: dropdowns.every(d => d.isAnswered)
          });
          continue;
        }

        const inputs = Array.from(q.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        if (inputs.length >= 2) {
          const isMulti = inputs.some(i => i.type === 'checkbox');
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
            type: isMulti ? 'multichoice' : 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked)
          });
          continue;
        }

        const textInput = q.querySelector('input[type="text"], textarea');
        if (textInput) {
          list.push({
            container: q,
            type: 'text',
            text: qText,
            image: image,
            textInput: textInput,
            isAnswered: textInput.value.trim().length > 0
          });
          continue;
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
      const selects = Array.from(group.querySelectorAll('select'));
      if (selects.length > 0) {
        const dropdowns = selects.map((sel, idx) => {
          const row = sel.closest('tr') || sel.parentElement;
          const prompt = row?.innerText?.replace(sel.innerText || '', '').trim() || `Item ${idx + 1}`;
          const options = Array.from(sel.querySelectorAll('option')).map((opt, oi) => ({
            element: opt,
            value: opt.value,
            text: opt.innerText.trim(),
            index: oi
          })).filter(o => o.value !== '' && o.value !== '0');
          return { select: sel, row, prompt, options, isAnswered: sel.selectedIndex > 0 };
        });
        list.push({
          container: group,
          type: 'matching',
          text: group.querySelector('legend, h2, h3, h4')?.innerText?.trim() || '',
          image: group.querySelector('img'),
          dropdowns: dropdowns,
          isAnswered: dropdowns.every(d => d.isAnswered)
        });
        continue;
      }

      const radios = Array.from(group.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      if (radios.length >= 2) {
        const isMulti = radios.some(r => r.type === 'checkbox');
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
          type: isMulti ? 'multichoice' : 'mcq',
          text: legend,
          image: group.querySelector('img'),
          options: options,
          isAnswered: options.some(o => o.checked)
        });
        continue;
      }

      const textInput = group.querySelector('input[type="text"], textarea');
      if (textInput) {
        list.push({
          container: group,
          type: 'text',
          text: group.querySelector('legend, h2, h3, h4')?.innerText?.trim() || '',
          image: group.querySelector('img'),
          textInput: textInput,
          isAnswered: textInput.value.trim().length > 0
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

  // Solves a specific question item across all question types
  async solveQuestionItem(q, updateStatus) {
    if (!q || !q.text) return { success: false, message: 'Invalid question' };

    q.container?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateStatus?.(`Thinking: "${q.text.slice(0, 35)}..."`);

    // ── 1. Drag and Drop Words into Text (Moodle ddwtos / Blanks) ──
    if (q.type === 'ddwtos') {
      updateStatus?.('Analyzing blanks and word bank...');

      // Prepare sentence text with numbered blanks [1], [2], etc.
      let promptText = q.text || '';
      const formulation = q.container.querySelector('.formulation, .qtext') || q.container;
      const clone = formulation.cloneNode(true);
      clone.querySelectorAll('.drags, .answercontainer, .dropzone-choice-bank').forEach(el => el.remove());

      const dropSpans = Array.from(clone.querySelectorAll('.dropzone, .drop, span[class*="place"]')).filter(el => !el.classList.contains('placeinput'));
      dropSpans.forEach((dz, idx) => {
        const match = dz.className.match(/place(\d+)/);
        const num = match ? match[1] : (idx + 1);
        dz.replaceWith(` [${num}] `);
      });
      promptText = clone.innerText.replace(/\s+/g, ' ').trim();

      // Collect available choice words
      const words = (q.choices || []).map(c => c.text);
      if (words.length === 0) {
        const dragEls = Array.from(q.container.querySelectorAll('.drags .drag, .draghome, [class*="choice"]'));
        dragEls.forEach(d => {
          const t = d.innerText?.trim();
          if (t && !words.includes(t)) words.push(t);
        });
      }

      if (words.length === 0) {
        return { success: false, message: 'Could not extract choice word bank' };
      }

      const aiRes = await window.AIEngine.solveFillInBlanks(promptText, words);
      if (aiRes?.warningNotice) {
        updateStatus?.(aiRes.warningNotice);
        await new Promise(r => setTimeout(r, 1200));
      }

      if (!aiRes || !aiRes.success || !aiRes.mapping) {
        const err = aiRes?.error || 'AI fill-in-blanks failed';
        return {
          success: false,
          rateLimited: !!aiRes?.rateLimited,
          waitSec: aiRes?.waitSec || 30,
          message: err
        };
      }

      const mapping = aiRes.mapping; // e.g. {"1": "Twitter", "2": "Instagram", "3": "Facetime"}
      let placedCount = 0;

      for (const [blankNum, chosenWord] of Object.entries(mapping)) {
        if (!chosenWord) continue;
        const cleanWord = chosenWord.trim().toLowerCase();

        let matchedChoice = (q.choices || []).find(c => 
          c.text.trim().toLowerCase() === cleanWord ||
          c.text.trim().toLowerCase().includes(cleanWord) ||
          cleanWord.includes(c.text.trim().toLowerCase())
        );

        const choiceNum = matchedChoice ? matchedChoice.choiceNum : blankNum;

        // Hidden input
        const input = q.container.querySelector(`input.placeinput.place${blankNum}, input[name*="_p${blankNum}"]`) || 
                      (q.dropInputs && q.dropInputs[parseInt(blankNum, 10) - 1]);

        if (input) {
          input.value = choiceNum.toString();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Visual dropzone styling
        const dz = q.container.querySelector(`.dropzone.place${blankNum}, .drop.place${blankNum}, span.place${blankNum}`) ||
                   (q.dropZones && q.dropZones[parseInt(blankNum, 10) - 1]);

        if (dz) {
          dz.textContent = matchedChoice ? matchedChoice.text : chosenWord;
          dz.style.background = '#e0e7ff';
          dz.style.border = '2px solid #4f46e5';
          dz.style.borderRadius = '4px';
          dz.style.padding = '2px 10px';
          dz.style.fontWeight = '600';
          dz.style.color = '#1e1b4b';
          dz.style.display = 'inline-block';
          dz.classList.add('placed');
        }

        placedCount++;
      }

      if (placedCount > 0) {
        q.isAnswered = true;
        q.container.style.transition = 'box-shadow 0.3s ease';
        q.container.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
        setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

        const summary = Object.entries(mapping).map(([k, v]) => `[${k}] ${v}`).join(', ');
        updateStatus?.(`Placed: ${summary.slice(0, 35)}`);
        return { success: true, answer: summary };
      }

      return { success: false, message: 'Could not place words into dropzones' };
    }

    // ── 2. Matching / Dropdowns (Moodle match, gapselect, Canvas/Blackboard matching) ──
    if (q.type === 'matching' && q.dropdowns && q.dropdowns.length > 0) {
      updateStatus?.(`Solving ${q.dropdowns.length} dropdown matches...`);
      let solvedCount = 0;

      for (let di = 0; di < q.dropdowns.length; di++) {
        const d = q.dropdowns[di];
        if (d.isAnswered) {
          solvedCount++;
          continue;
        }

        // Direct heuristic 1: image filename / alt text matching option text
        let matchedOpt = null;
        if (d.image) {
          const imgSrc = (d.image.src || '').toLowerCase();
          const imgAlt = (d.image.alt || '').toLowerCase();
          const imgTitle = (d.image.title || '').toLowerCase();

          matchedOpt = d.options.find(opt => {
            const cleanOpt = opt.text.trim().toLowerCase();
            if (cleanOpt.length < 2) return false;
            return imgAlt.includes(cleanOpt) || 
                   imgTitle.includes(cleanOpt) || 
                   imgSrc.includes(cleanOpt.replace(/\s+/g, '')) ||
                   imgSrc.includes(cleanOpt.replace(/\s+/g, '_')) ||
                   imgSrc.includes(cleanOpt.replace(/\s+/g, '-'));
          });
        }

        // Direct heuristic 2: prompt text matching option text
        if (!matchedOpt && d.prompt) {
          const cleanPrompt = d.prompt.toLowerCase();
          matchedOpt = d.options.find(opt => {
            const cleanOpt = opt.text.trim().toLowerCase();
            return cleanPrompt.length > 2 && (cleanPrompt.includes(cleanOpt) || cleanOpt.includes(cleanPrompt));
          });
        }

        // AI Engine resolution
        if (!matchedOpt) {
          let aiRes = null;
          if (d.image) {
            updateStatus?.(`AI matching item ${di + 1} with image...`);
            aiRes = await window.AIEngine.solveMCQ(`Match this icon/image to its correct site. Overall question: "${q.text}"`, d.options, d.image);
          } else {
            updateStatus?.(`AI matching item ${di + 1}: "${d.prompt.slice(0, 25)}"...`);
            aiRes = await window.AIEngine.solveMCQ(`Match the correct answer for: "${d.prompt}". Overall context: "${q.text}"`, d.options);
          }

          if (aiRes?.rateLimited) {
            return {
              success: false,
              rateLimited: true,
              waitSec: aiRes.waitSec || 30,
              message: aiRes.error || 'Rate limited'
            };
          }

          if (aiRes?.success && aiRes.letter) {
            const idx = aiRes.letter.charCodeAt(0) - 65;
            if (d.options[idx]) matchedOpt = d.options[idx];
            if (!matchedOpt) {
              matchedOpt = d.options.find(o => o.letter?.toUpperCase() === aiRes.letter);
            }
          }
        }

        if (!matchedOpt && d.options.length > 0) {
          matchedOpt = d.options[0];
        }

        if (matchedOpt) {
          d.select.focus();
          d.select.value = matchedOpt.value;
          if (matchedOpt.element) matchedOpt.element.selected = true;
          d.select.dispatchEvent(new Event('input', { bubbles: true }));
          d.select.dispatchEvent(new Event('change', { bubbles: true }));

          d.select.style.borderColor = '#10b981';
          d.select.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.4)';
          d.isAnswered = true;
          solvedCount++;
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (solvedCount > 0) {
        q.isAnswered = true;
        q.container.style.transition = 'box-shadow 0.3s ease';
        q.container.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
        setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

        updateStatus?.(`Matched ${solvedCount} dropdown(s) ✓`);
        return { success: true, count: solvedCount };
      }

      return { success: false, message: 'Could not solve dropdown matching items' };
    }

    // ── 3. Multi-Choice (Checkboxes / Select all that apply) ──
    if (q.type === 'multichoice' && q.options && q.options.length >= 2) {
      updateStatus?.(`Solving multi-select: "${q.text.slice(0, 35)}..."`);
      const aiRes = await window.AIEngine.solveMultiChoice(q.text, q.options, q.image);

      if (aiRes?.warningNotice) {
        updateStatus?.(aiRes.warningNotice);
        await new Promise(r => setTimeout(r, 1200));
      }

      if (!aiRes || !aiRes.success || !aiRes.letters || aiRes.letters.length === 0) {
        const err = aiRes?.error || 'AI multi-choice failed';
        if (aiRes?.rateLimited) {
          return { success: false, rateLimited: true, waitSec: aiRes?.waitSec || 30, message: err };
        }
        const singleRes = await window.AIEngine.solveMCQ(q.text, q.options, q.image);
        if (singleRes?.success && singleRes.letter) {
          aiRes.letters = [singleRes.letter];
        } else {
          return { success: false, message: err };
        }
      }

      let checkedCount = 0;
      for (const letter of aiRes.letters) {
        const idx = letter.charCodeAt(0) - 65;
        const target = q.options[idx] || q.options.find(o => o.letter?.toUpperCase() === letter);
        if (target) {
          const clickEl = target.labelEl || target.element;
          ['pointerdown', 'mousedown', 'click', 'mouseup'].forEach(evt => {
            clickEl.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true }));
          });
          if (target.element) {
            target.element.checked = true;
            target.element.dispatchEvent(new Event('input', { bubbles: true }));
            target.element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          checkedCount++;
        }
      }

      q.isAnswered = true;
      q.container.style.transition = 'box-shadow 0.3s ease';
      q.container.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.4)';
      setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

      updateStatus?.(`Checked (${aiRes.letters.join(', ')}): ${checkedCount} options`);
      return { success: true, answer: aiRes.letters.join(', ') };
    }

    // ── 4. MCQ / True-False (Single Select Radios) ──
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

      if (!target && letter) {
        target = q.options.find(o => o.letter?.toUpperCase() === letter);
      }

      if (!target) {
        updateStatus?.(`AI selected ${letter || 'unknown'}, could not match option.`);
        return { success: false, message: `Could not match option ${letter}` };
      }

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

      q.container.style.transition = 'box-shadow 0.3s ease';
      q.container.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.4)';
      setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

      updateStatus?.(`Selected (${target.letter}): ${target.text.slice(0, 22)}`);
      return { success: true, answer: target.text };
    }

    // ── 5. Essay / Long Text / TinyMCE ──
    if (q.type === 'essay') {
      updateStatus?.(`Drafting essay response: "${q.text.slice(0, 35)}..."`);
      let answerText = '';

      if (window.QuizSolver?.verifiedAnswers) {
        const cleanLowerQ = q.text.toLowerCase();
        for (const [key, val] of Object.entries(window.QuizSolver.verifiedAnswers)) {
          if (cleanLowerQ.includes(key)) {
            answerText = val;
            break;
          }
        }
      }

      if (!answerText) {
        const aiRes = await window.AIEngine.solveBriefAnswer(q.text);
        if (aiRes?.success && aiRes.text) {
          answerText = aiRes.text.trim();
        }
      }

      if (!answerText) {
        answerText = 'The response requires structured analysis based on course principles and foundational concepts.';
      }

      if (q.iframe) {
        const doc = q.iframe.contentDocument || q.iframe.contentWindow?.document;
        if (doc && doc.body) {
          doc.body.innerHTML = `<p>${answerText}</p>`;
          doc.body.dispatchEvent(new Event('input', { bubbles: true }));
          doc.body.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      if (q.textarea) {
        q.textarea.focus();
        q.textarea.value = `<p>${answerText}</p>`;
        q.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        q.textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (window.tinyMCE) {
        try { window.tinyMCE.triggerSave(); } catch (e) {}
      }

      q.isAnswered = true;
      q.container.style.transition = 'box-shadow 0.3s ease';
      q.container.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
      setTimeout(() => { q.container.style.boxShadow = ''; }, 2000);

      updateStatus?.(`Drafted essay: ${answerText.slice(0, 30)}...`);
      return { success: true, answer: answerText };
    }

    // ── 6. Short Answer / Numerical / Text ──
    if (q.type === 'text' && q.textInput) {
      const aiRes = await window.AIEngine.solveBriefAnswer(q.text);
      if (aiRes?.warningNotice) {
        updateStatus?.(aiRes.warningNotice);
        await new Promise(r => setTimeout(r, 1200));
      }
      if (aiRes?.success && aiRes?.text) {
        let ans = aiRes.text.trim();
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
          // If unsupported question format or fatal error, DO NOT retry 8 times!
          if (res.message && (res.message.includes('Unsupported') || res.message.includes('Could not match') || attempts >= 2)) {
            updateStatus?.(`⚠️ Q${i + 1}: ${res.message}. Skipping to next question...`);
            q.isAnswered = true;
            q.skipped = true;
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
          updateStatus?.(`Retrying Q${i + 1} in 2s... (${(res.message || 'error').slice(0, 30)})`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!isRunningCallback()) return { questionsFound: true, allAnswered: false, stopped: true };

      // Brief delay between questions
      await new Promise(r => setTimeout(r, 1000));
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
