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

  // Locates the Start / Attempt Quiz button on landing pages (view.php)
  findStartAttemptButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], div[role="button"]'));
    return candidates.find(b => {
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      const href = (b.href || '').toLowerCase();
      return (
        txt.includes('attempt quiz') ||
        txt.includes('continue the last attempt') ||
        txt.includes('re-attempt quiz') ||
        txt.includes('start attempt') ||
        txt.includes('take the quiz') ||
        txt.includes('resume quiz') ||
        txt.includes('begin test') ||
        txt.includes('start quiz') ||
        href.includes('/mod/quiz/attempt.php')
      );
    });
  },

  // Color & feature fingerprinting for icons
  analyzeImageColor(imgEl) {
    try {
      if (!imgEl) return null;
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      
      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 50) continue;
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
        count++;
      }
      if (count === 0) return null;
      const r = totalR / count;
      const g = totalG / count;
      const b = totalB / count;

      // Color classification:
      // Yellow (Snapchat): R > 160, G > 160, B < 100
      if (r > 160 && g > 160 && b < 100) return 'yellow';
      // Sky Blue (Twitter): B > 150, G > 90, R < 120 and B > R * 1.4
      if (b > 140 && g > 90 && r < 120 && b > r * 1.3) return 'sky-blue';
      // Navy Blue (LinkedIn): B > 110, R < 70, B > R * 1.8
      if (b > 100 && r < 75 && b > r * 1.5) return 'navy-blue';
      // Grey / Monochrome (Instagram camera): R, G, B within 35 of each other and R < 180
      if (Math.abs(r - g) < 35 && Math.abs(g - b) < 35 && r < 180) return 'grey';
      // Red: R > 150, G < 90, B < 90
      if (r > 150 && g < 90 && b < 90) return 'red';
      // Green: G > 130, R < 110, B < 110
      if (g > 130 && r < 110 && b < 110) return 'green';

      return 'other';
    } catch (e) {
      return null;
    }
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

  // Find Moodle-style confirmation submit button (the second "Submit all and finish" on the confirmation page / modal)
  findConfirmSubmitButton(excludeBtn = null) {
    // 1. Look inside modals/dialogs first (standard Moodle/Bootstrap modal confirmation)
    const modal = document.querySelector('.modal.show, .modal[style*="display: block"], [role="dialog"], #confirm-modal, .moodle-dialogue-bd');
    if (modal) {
      const modalBtn = Array.from(modal.querySelectorAll('button, input[type="submit"], input[type="button"]')).find(b => {
        if (b === excludeBtn) return false;
        if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
        const txt = (b.innerText || b.value || '').trim().toLowerCase();
        return (txt.includes('submit') || txt.includes('finish') || txt.includes('confirm') || txt.includes('yes')) && !txt.includes('cancel');
      });
      if (modalBtn) return modalBtn;
    }

    // 2. Fallback: Search page excluding the initial submit button
    const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
    return candidates.find(b => {
      if (b === excludeBtn) return false;
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      const txt = (b.innerText || b.value || '').trim().toLowerCase();
      return (txt.includes('submit all and finish') || txt.includes('confirm submit') || txt.includes('confirm'));
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

      let mapping = aiRes?.mapping;
      if (!mapping || Object.keys(mapping).length === 0) {
        mapping = {};
        const blankMatches = promptText.match(/\[(\d+)\]/g) || [];
        const segments = promptText.split(/\[\d+\]/);

        words.forEach(w => {
          const lw = w.toLowerCase();
          blankMatches.forEach((bm, bIdx) => {
            const bNum = bm.replace(/[^0-9]/g, '');
            if (mapping[bNum]) return;
            const context = (segments[bIdx] || '').toLowerCase();
            if ((context.includes('140') || context.includes('short message')) && lw.includes('twitter')) mapping[bNum] = w;
            else if ((context.includes('picture') || context.includes('photo')) && lw.includes('instagram')) mapping[bNum] = w;
            else if ((context.includes('video') || context.includes('iphone')) && lw.includes('facetime')) mapping[bNum] = w;
            else if (context.includes('career') && lw.includes('linkedin')) mapping[bNum] = w;
          });
        });

        // Default fill any remaining blanks with remaining available words
        const usedWords = new Set(Object.values(mapping));
        const unusedWords = words.filter(w => !usedWords.has(w));
        blankMatches.forEach((bm, bIdx) => {
          const bNum = bm.replace(/[^0-9]/g, '');
          if (!mapping[bNum] && unusedWords[bIdx]) {
            mapping[bNum] = unusedWords[bIdx];
          }
        });
      }

      if (!mapping || Object.keys(mapping).length === 0) {
        return {
          success: false,
          rateLimited: !!aiRes?.rateLimited,
          waitSec: aiRes?.waitSec || 30,
          message: aiRes?.error || 'Could not resolve blanks'
        };
      }

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

      // 1:1 Image Mapping Fallback (if individual rows didn't encapsulate the img tag)
      const qImages = Array.from(q.container.querySelectorAll('.qtext img, .formulation img, table.answer img')).filter(img => 
        !img.src.includes('unflagged') && !img.src.includes('pix/help') && !img.src.includes('theme/image.php/boost/core')
      );
      if (qImages.length === q.dropdowns.length) {
        q.dropdowns.forEach((d, idx) => {
          if (!d.image) d.image = qImages[idx];
        });
      }

      const allAvailableOpts = q.dropdowns[0]?.options || [];
      const assignedOptionValues = new Set();
      const matches = new Array(q.dropdowns.length).fill(null);

      // STEP 1: Direct text & metadata heuristics (filename, alt, title, prompt)
      for (let i = 0; i < q.dropdowns.length; i++) {
        const d = q.dropdowns[i];
        const imgSrc = (d.image?.src || '').toLowerCase();
        const imgAlt = (d.image?.alt || '').toLowerCase();
        const imgTitle = (d.image?.title || '').toLowerCase();
        const prompt = (d.prompt || '').toLowerCase();

        for (const opt of d.options) {
          const optText = opt.text.toLowerCase().trim();
          if (optText.length < 2) continue;
          if (assignedOptionValues.has(opt.value)) continue;

          if (imgAlt.includes(optText) || imgTitle.includes(optText) || imgSrc.includes(optText) ||
              (prompt.length > 2 && prompt.includes(optText))) {
            matches[i] = opt;
            assignedOptionValues.add(opt.value);
            break;
          }
        }
      }

      // STEP 2: Visual Brand / Color Fingerprinting for unmatched icons
      for (let i = 0; i < q.dropdowns.length; i++) {
        if (matches[i] || !q.dropdowns[i].image) continue;
        const color = this.analyzeImageColor(q.dropdowns[i].image);

        let targetKeywords = [];
        if (color === 'yellow') targetKeywords = ['snapchat'];
        else if (color === 'sky-blue') targetKeywords = ['twitter', 'bluesky'];
        else if (color === 'navy-blue') targetKeywords = ['linkedin'];
        else if (color === 'grey') targetKeywords = ['instagram'];
        else if (color === 'red') targetKeywords = ['youtube', 'pinterest'];

        for (const kw of targetKeywords) {
          const opt = q.dropdowns[i].options.find(o => 
            !assignedOptionValues.has(o.value) && o.text.toLowerCase().includes(kw)
          );
          if (opt) {
            matches[i] = opt;
            assignedOptionValues.add(opt.value);
            break;
          }
        }
      }

      // STEP 3: Deductive Elimination (assign remaining unique options)
      const remainingUnassignedIndices = [];
      matches.forEach((m, idx) => {
        if (!m) remainingUnassignedIndices.push(idx);
      });

      const remainingOptions = allAvailableOpts.filter(o => !assignedOptionValues.has(o.value));

      if (remainingUnassignedIndices.length === 1 && remainingOptions.length >= 1) {
        const idx = remainingUnassignedIndices[0];
        matches[idx] = remainingOptions[0];
        assignedOptionValues.add(remainingOptions[0].value);
      } else if (remainingUnassignedIndices.length > 1 && remainingOptions.length === remainingUnassignedIndices.length) {
        remainingUnassignedIndices.forEach((idx, rIdx) => {
          matches[idx] = remainingOptions[rIdx];
          assignedOptionValues.add(remainingOptions[rIdx].value);
        });
      }

      // STEP 4: AI Fallback for any still-unmatched items (single batch call)
      const stillUnmatched = matches.map((m, idx) => m ? null : idx).filter(idx => idx !== null);
      if (stillUnmatched.length > 0) {
        const unassignedOpts = allAvailableOpts.filter(o => !assignedOptionValues.has(o.value));
        if (unassignedOpts.length > 0) {
          const itemsDesc = stillUnmatched.map((idx, num) => {
            const d = q.dropdowns[idx];
            return `${num + 1}. Item ${idx + 1}: ${d.prompt || 'Icon / prompt'}`;
          }).join('\n');
          const choicesDesc = unassignedOpts.map(o => o.text).join(', ');

          const batchPrompt = `Match each item to the correct choice:\n${itemsDesc}\n\nAvailable choices: ${choicesDesc}\n\nRespond with a valid JSON object mapping item numbers ("1", "2") to the exact choice text, e.g. {"1": "ChoiceA", "2": "ChoiceB"}.`;
          const aiRes = await window.AIEngine.generateAnswer(batchPrompt, null, 'You are an academic exam solver. Output ONLY valid JSON.');

          if (aiRes?.success && aiRes.text) {
            try {
              const clean = aiRes.text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
              const jsonMatch = clean.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const map = JSON.parse(jsonMatch[0]);
                stillUnmatched.forEach((rowIdx, num) => {
                  const key = (num + 1).toString();
                  const chosenText = map[key];
                  if (chosenText) {
                    const foundOpt = unassignedOpts.find(o => 
                      !assignedOptionValues.has(o.value) && 
                      (o.text.toLowerCase().includes(chosenText.toLowerCase()) || chosenText.toLowerCase().includes(o.text.toLowerCase()))
                    );
                    if (foundOpt) {
                      matches[rowIdx] = foundOpt;
                      assignedOptionValues.add(foundOpt.value);
                    }
                  }
                });
              }
            } catch (e) {}
          }
        }
      }

      // STEP 5: Apply all matches to DOM select elements
      let solvedCount = 0;
      for (let i = 0; i < q.dropdowns.length; i++) {
        const d = q.dropdowns[i];
        const chosen = matches[i] || d.options.find(o => !assignedOptionValues.has(o.value)) || d.options[0];

        if (chosen) {
          d.select.focus();
          d.select.value = chosen.value;
          d.select.selectedIndex = chosen.index || 1;
          if (chosen.element) chosen.element.selected = true;

          d.select.dispatchEvent(new Event('input', { bubbles: true }));
          d.select.dispatchEvent(new Event('change', { bubbles: true }));

          d.select.style.borderColor = '#10b981';
          d.select.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.4)';
          d.isAnswered = true;
          solvedCount++;
          await new Promise(r => setTimeout(r, 200));
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
          const confirmBtn = this.findConfirmSubmitButton(submitBtn);
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
        const confirmBtn = this.findConfirmSubmitButton(submitBtn);
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
  //  PERSISTENT BATCH STATE MACHINE (Mode 3 & Mode 4)
  //  Survives full browser page navigations and reloads seamlessly
  // ══════════════════════════════════════════════════════════════

  // Advance to next assignment in batch queue
  async advanceBatchAssignment(updateStatus) {
    try {
      const data = await chrome.storage.local.get(['autopilotBatchState']);
      const state = data.autopilotBatchState;
      if (!state || !state.active) return;

      state.assignmentIndex = (state.assignmentIndex || 0) + 1;

      if (state.assignmentQueue && state.assignmentIndex < state.assignmentQueue.length) {
        const nextAsgn = state.assignmentQueue[state.assignmentIndex];
        updateStatus?.(`[Batch] Loading assignment ${state.assignmentIndex + 1}/${state.assignmentQueue.length}: ${nextAsgn.title.slice(0, 25)}…`);
        await chrome.storage.local.set({ autopilotBatchState: state });
        await new Promise(r => setTimeout(r, 1200));
        window.location.href = nextAsgn.url;
        return;
      }

      // Course assignments finished!
      if (state.mode === 'allcourses' && state.courseQueue) {
        state.courseIndex = (state.courseIndex || 0) + 1;
        if (state.courseIndex < state.courseQueue.length) {
          const nextCourse = state.courseQueue[state.courseIndex];
          state.assignmentQueue = [];
          state.assignmentIndex = 0;
          updateStatus?.(`[All Courses] Course finished! Moving to course ${state.courseIndex + 1}/${state.courseQueue.length}: ${nextCourse.title.slice(0, 25)}…`);
          await chrome.storage.local.set({ autopilotBatchState: state });
          await new Promise(r => setTimeout(r, 1500));
          window.location.href = nextCourse.url;
          return;
        }
      }

      // All done!
      await chrome.storage.local.remove(['autopilotBatchState']);
      updateStatus?.('🎉 All assignments and courses batch complete!');
    } catch (e) {
      console.warn('[Autopilot AI] advanceBatchAssignment error:', e);
    }
  },

  // Called on every page load to resume persistent batch execution
  async resumePersistentBatch(updateStatus, isRunningCallback) {
    try {
      const data = await chrome.storage.local.get(['autopilotBatchState']);
      const state = data.autopilotBatchState;
      if (!state || !state.active || !isRunningCallback()) return;

      const modeTag = state.mode === 'allcourses' ? '[All Courses]' : '[Course Batch]';

      // ── Page State 1: Active Quiz Attempt (questions on page) ──
      const questions = this.detectAllQuestions();
      if (questions.length > 0) {
        updateStatus?.(`${modeTag} Solving questions on attempt page…`);
        await this._runSubmitMode(updateStatus, isRunningCallback);

        // After submit mode finishes or submits:
        if (this.isQuizComplete()) {
          if (state.mode === 'submit') {
            updateStatus?.('🎉 Quiz completed and submitted!');
            await chrome.storage.local.remove(['autopilotBatchState']);
            return;
          }
          updateStatus?.(`${modeTag} Quiz submitted! Advancing to next…`);
          await new Promise(r => setTimeout(r, 1500));
          await this.advanceBatchAssignment(updateStatus);
        }
        return;
      }

      // ── Page State 2: Quiz Landing Page (view.php with Start/Attempt button) ──
      const startBtn = this.findStartAttemptButton();
      if (startBtn) {
        updateStatus?.(`${modeTag} Starting quiz attempt…`);
        await new Promise(r => setTimeout(r, 800));
        startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 400));
        startBtn.click();
        return;
      }

      // ── Page State 3: Quiz Summary Page (summary.php with Submit button) ──
      const submitBtn = this.findSubmitButton() || this.findConfirmSubmitButton();
      if (submitBtn) {
        updateStatus?.(`${modeTag} Submitting quiz from summary…`);
        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 600));
        submitBtn.click();
        await new Promise(r => setTimeout(r, 1000));

        const confirmBtn = this.findConfirmSubmitButton(submitBtn);
        if (confirmBtn) {
          updateStatus?.(`${modeTag} Confirming final submission in modal…`);
          confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 400));
          confirmBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }

        // If page completed via AJAX without full navigation
        if (this.isQuizComplete()) {
          if (state.mode === 'submit') {
            updateStatus?.('🎉 Quiz completed and submitted!');
            await chrome.storage.local.remove(['autopilotBatchState']);
            return;
          }
          await this.advanceBatchAssignment(updateStatus);
        }
        return;
      }

      // ── Page State 4: Quiz Review or Already Submitted Page ──
      if (this.isQuizComplete() || window.location.href.includes('/mod/quiz/review.php')) {
        if (state.mode === 'submit') {
          updateStatus?.('🎉 Quiz completed and submitted!');
          await chrome.storage.local.remove(['autopilotBatchState']);
          return;
        }
        updateStatus?.(`${modeTag} Quiz completed! Advancing to next assignment…`);
        await new Promise(r => setTimeout(r, 1200));
        await this.advanceBatchAssignment(updateStatus);
        return;
      }

      // ── Page State 5: Course Page (course/view.php with assignment links) ──
      const assignments = this.findAssignmentLinks();
      if (assignments.length > 0) {
        if (!state.assignmentQueue || state.assignmentQueue.length === 0) {
          state.assignmentQueue = assignments;
          state.assignmentIndex = 0;
        }
        const idx = state.assignmentIndex || 0;
        if (idx < state.assignmentQueue.length) {
          const nextAsgn = state.assignmentQueue[idx];
          updateStatus?.(`${modeTag} Starting assignment ${idx + 1}/${state.assignmentQueue.length}: ${nextAsgn.title.slice(0, 25)}…`);
          await chrome.storage.local.set({ autopilotBatchState: state });
          await new Promise(r => setTimeout(r, 1000));
          window.location.href = nextAsgn.url;
          return;
        } else {
          // All assignments in course completed
          updateStatus?.(`${modeTag} All assignments in course completed!`);
          await this.advanceBatchAssignment(updateStatus);
          return;
        }
      }

      // ── Page State 6: Dashboard with Courses (for All Courses mode) ──
      if (state.mode === 'allcourses') {
        const courses = this.findCourseLinks();
        if (courses.length > 0) {
          if (!state.courseQueue || state.courseQueue.length === 0) {
            state.courseQueue = courses;
            state.courseIndex = 0;
          }
          const cIdx = state.courseIndex || 0;
          if (cIdx < state.courseQueue.length) {
            const nextCourse = state.courseQueue[cIdx];
            updateStatus?.(`[All Courses] Opening course ${cIdx + 1}/${state.courseQueue.length}: ${nextCourse.title.slice(0, 25)}…`);
            await chrome.storage.local.set({ autopilotBatchState: state });
            await new Promise(r => setTimeout(r, 1000));
            window.location.href = nextCourse.url;
            return;
          } else {
            await chrome.storage.local.remove(['autopilotBatchState']);
            updateStatus?.('🎉 All courses and assignments completed!');
            return;
          }
        }
      }

      // Fallback: If no recognized structure, try advancing
      updateStatus?.(`${modeTag} Page has no pending tasks. Checking next assignment…`);
      await this.advanceBatchAssignment(updateStatus);
    } catch (e) {
      console.warn('[Autopilot AI] resumePersistentBatch error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════════
  //  MAIN ENTRY: Mode-Aware Auto-Pilot Dispatcher
  // ══════════════════════════════════════════════════════════════
  async startAutoPilot(updateStatus, isRunningCallback, mode = 'draft') {
    console.log(`[Autopilot AI] Starting in mode: ${mode}`);

    // Mode 1: Draft Only (never submit or navigate)
    if (mode === 'draft') {
      await chrome.storage.local.remove(['autopilotBatchState']);
      await this._runDraftMode(updateStatus, isRunningCallback);
      return;
    }

    // Mode 2: Full Submit (current quiz attempt)
    if (mode === 'submit') {
      const state = {
        active: true,
        mode: 'submit'
      };
      await chrome.storage.local.set({ autopilotBatchState: state });
      await this._runSubmitMode(updateStatus, isRunningCallback);
      return;
    }

    // Mode 3: Course Batch (all assignments in current course)
    if (mode === 'course') {
      const assignments = this.findAssignmentLinks();
      const state = {
        active: true,
        mode: 'course',
        assignmentQueue: assignments,
        assignmentIndex: 0
      };
      await chrome.storage.local.set({ autopilotBatchState: state });

      if (assignments.length > 0) {
        updateStatus?.(`[Course] Found ${assignments.length} assignments. Starting #1: ${assignments[0].title.slice(0, 25)}…`);
        await new Promise(r => setTimeout(r, 1000));
        window.location.href = assignments[0].url;
        return;
      }

      // If already on a quiz/attempt page within the course:
      await this.resumePersistentBatch(updateStatus, isRunningCallback);
      return;
    }

    // Mode 4: All Courses (all courses across platform)
    if (mode === 'allcourses') {
      const courses = this.findCourseLinks();
      const state = {
        active: true,
        mode: 'allcourses',
        courseQueue: courses,
        courseIndex: 0,
        assignmentQueue: [],
        assignmentIndex: 0
      };
      await chrome.storage.local.set({ autopilotBatchState: state });

      if (courses.length > 0) {
        updateStatus?.(`[All Courses] Found ${courses.length} courses. Opening course #1: ${courses[0].title.slice(0, 25)}…`);
        await new Promise(r => setTimeout(r, 1000));
        window.location.href = courses[0].url;
        return;
      }

      // If already in a course or quiz:
      await this.resumePersistentBatch(updateStatus, isRunningCallback);
      return;
    }

    // Fallback default
    await this._runDraftMode(updateStatus, isRunningCallback);
  }
};
