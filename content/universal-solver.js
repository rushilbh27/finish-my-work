window.UniversalSolver = {

  // ── 0. Ground-Truth Answer Key from Page State / Inertia.js ──
  _buildVerifiedMapFromProps(props) {
    const map = new Map();
    try {
      const qp = props?.question_paper || props?.questionPaper || props;
      const questions = qp?.questions || props?.questions;
      if (Array.isArray(questions)) {
        questions.forEach((q, idx) => {
          const domId = `question${idx + 1}`;
          const longId = q.question_num_long ? String(q.question_num_long) : null;
          const qType = (q.question_type || q.type || '').toUpperCase();

          let ansObj = null;
          const hasOptions = Array.isArray(q.options) && q.options.length > 0;

          if (qType === 'MCQ' || qType === 'MSQ' || hasOptions) {
            const correctIndices = [];
            const correctIds = [];
            const correctNumbers = [];
            (q.options || []).forEach((opt, oIdx) => {
              if (opt.is_correct || opt.correct || opt.answer) {
                correctIndices.push(oIdx);
                if (opt.id) correctIds.push(String(opt.id));
                if (opt.option_number) correctNumbers.push(String(opt.option_number));
              }
            });
            if (correctIndices.length > 0) {
              const letters = correctIndices.map(i => String.fromCharCode(65 + i));
              ansObj = {
                type: (qType === 'MSQ' || correctIndices.length > 1) ? 'multichoice' : 'mcq',
                letters: letters,
                indices: correctIndices,
                optionIds: correctIds,
                optionNumbers: correctNumbers
              };
            }
          } else if (q.value_start !== null && q.value_start !== undefined) {
            ansObj = {
              type: 'text',
              value: String(q.value_start).trim(),
              valueEnd: q.value_end !== null && q.value_end !== undefined ? String(q.value_end).trim() : null
            };
          }

          if (ansObj) {
            map.set(domId, ansObj);
            map.set(domId.toLowerCase(), ansObj);
            map.set(`q${idx + 1}`, ansObj);
            if (longId) map.set(longId, ansObj);
            if (q.id) map.set(String(q.id), ansObj);
          }
        });
      }
    } catch (e) {
      console.warn('[Autopilot] Error building verified map:', e);
    }

    if (map.size > 0) {
      this._cachedVerifiedMap = map;
    }
    return map;
  },

  getVerifiedPageAnswers() {
    if (this._cachedVerifiedMap && this._cachedVerifiedMap.size > 0) {
      return this._cachedVerifiedMap;
    }

    try {
      const appEl = document.getElementById('app') || document.querySelector('[data-page], [data-inertia-props]');
      const raw = appEl?.getAttribute('data-inertia-props') || 
                  document.documentElement?.getAttribute('data-inertia-props') || 
                  appEl?.getAttribute('data-page') || 
                  appEl?.dataset?.inertiaProps || 
                  appEl?.dataset?.page;

      if (raw) {
        const parsed = JSON.parse(raw);
        return this._buildVerifiedMapFromProps(parsed?.props || parsed);
      }

      if (typeof window !== 'undefined' && window.__PESLMS_INERTIA_PROPS__?.props) {
        return this._buildVerifiedMapFromProps(window.__PESLMS_INERTIA_PROPS__.props);
      }
    } catch (e) {
      console.warn('[Autopilot] Error reading page verified answers synchronously:', e);
    }

    return this._cachedVerifiedMap || new Map();
  },

  async ensureVerifiedPageAnswers() {
    let map = this.getVerifiedPageAnswers();
    if (map && map.size > 0) return map;

    if (typeof window !== 'undefined') {
      try {
        const received = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 450);
          const listener = (e) => {
            if (e.data?.source === 'PESLMS_PAGE' && e.data?.type === 'PAGE_DATA_RESULT') {
              clearTimeout(timer);
              window.removeEventListener('message', listener);
              resolve(e.data.data);
            }
          };
          window.addEventListener('message', listener);
          window.postMessage({ source: 'PESLMS_EXTENSION', type: 'GET_PAGE_DATA' }, '*');
        });

        if (received?.props) {
          map = this._buildVerifiedMapFromProps(received.props);
          if (map && map.size > 0) return map;
        }
      } catch (e) {}
    }

    return this.getVerifiedPageAnswers();
  },

  getVerifiedAnswer(q) {
    if (!q) return null;
    const map = this.getVerifiedPageAnswers();
    if (!map || map.size === 0) return null;

    if (q.longId && map.has(q.longId)) return map.get(q.longId);
    if (q.domId && map.has(q.domId)) return map.get(q.domId);
    if (q.id && map.has(q.id)) return map.get(q.id);
    if (q.container?.id && map.has(q.container.id)) return map.get(q.container.id);
    if (q.questionNum !== undefined && map.has(`question${q.questionNum}`)) return map.get(`question${q.questionNum}`);
    if (q.index !== undefined && map.has(`question${q.index + 1}`)) return map.get(`question${q.index + 1}`);

    return null;
  },

  async applyVerifiedAnswer(q, verified, updateStatus) {
    if (!verified) return { success: false };

    // 1. Short Answer / NAT / Text
    const textInput = q.textInput || q.container?.querySelector('input[type="text"], input[type="number"], input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="hidden"]), textarea');
    if (verified.type === 'text' && textInput) {
      const val = verified.value;
      textInput.focus();
      const proto = textInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(textInput, val);
      } else {
        textInput.value = val;
      }
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('change', { bubbles: true }));
      textInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      textInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      textInput.blur();
      await new Promise(r => setTimeout(r, 60));
      q.isAnswered = true;

      if (q.container) {
        q.container.style.transition = 'box-shadow 0.3s ease';
        q.container.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
        setTimeout(() => { if (q.container) q.container.style.boxShadow = ''; }, 2000);
      }

      updateStatus?.(`Verified Answered: ${val}`);
      return { success: true, answer: val, verified: true };
    }

    // 2. MCQ (Single Select)
    if (verified.type === 'mcq') {
      let target = null;

      if (q.options && q.options.length > 0) {
        if (verified.optionIds?.length > 0) {
          target = q.options.find(o => 
            verified.optionIds.includes(o.id) || 
            verified.optionIds.includes(o.element?.getAttribute('value')) ||
            verified.optionIds.includes(o.element?.value) || 
            verified.optionIds.some(id => o.element?.id && o.element.id.endsWith(id))
          );
        }
        if (!target && verified.optionNumbers?.length > 0) {
          target = q.options.find(o => verified.optionNumbers.includes(o.element?.getAttribute('title')));
        }
        if (!target && verified.indices?.length > 0) {
          target = q.options[verified.indices[0]];
        }
        if (!target && verified.letters?.length > 0) {
          target = q.options.find(o => o.letter?.toUpperCase() === verified.letters[0]);
        }
      }

      let radioBtn = target?.element;
      // Fallback: search directly inside q.container
      if (!radioBtn && q.container) {
        const domRadios = Array.from(q.container.querySelectorAll('[role="radio"], button[role="radio"], input[type="radio"]'));
        if (verified.optionIds?.length > 0) {
          radioBtn = domRadios.find(r => verified.optionIds.includes(r.getAttribute('value')) || verified.optionIds.includes(r.value));
        }
        if (!radioBtn && verified.optionNumbers?.length > 0) {
          radioBtn = domRadios.find(r => verified.optionNumbers.includes(r.getAttribute('title')));
        }
        if (!radioBtn && verified.indices?.length > 0 && domRadios[verified.indices[0]]) {
          radioBtn = domRadios[verified.indices[0]];
        }
      }

      if (radioBtn) {
        radioBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        radioBtn.focus();

        const ariaLabelEl = radioBtn.getAttribute('aria-labelledby') ? document.getElementById(radioBtn.getAttribute('aria-labelledby')) : null;
        const parentOption = radioBtn.closest('.r0, .r1, li, label, .option, .quiz-options li, mat-radio-button, [role="radio"]') || radioBtn;
        const clickTargets = [target?.labelEl, ariaLabelEl, parentOption, radioBtn].filter(Boolean);
        const uniqueTargets = [...new Set(clickTargets)];

        for (const t of uniqueTargets) {
          try { t.click?.(); } catch (e) {}
        }

        radioBtn.setAttribute('aria-checked', 'true');
        radioBtn.setAttribute('data-state', 'checked');
        await new Promise(r => setTimeout(r, 80));

        if (radioBtn.tagName === 'INPUT') {
          radioBtn.checked = true;
          radioBtn.dispatchEvent(new Event('input', { bubbles: true }));
          radioBtn.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (target) target.checked = radioBtn.checked;
        q.isAnswered = radioBtn.checked;
        if (q.container) {
          q.container.style.transition = 'box-shadow 0.3s ease';
          q.container.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.4)';
          setTimeout(() => { if (q.container) q.container.style.boxShadow = ''; }, 2000);
        }

        const labelDesc = target?.letter || verified.letters?.[0] || 'Option';
        updateStatus?.(`Verified Selected (${labelDesc})`);
        return { success: true, answer: labelDesc, verified: true };
      }
    }

    // 3. MSQ / Multi-Choice (Checkboxes)
    if (verified.type === 'multichoice') {
      let checkedCount = 0;
      const opts = q.options && q.options.length > 0 ? q.options : [];
      
      if (opts.length > 0) {
        for (let idx = 0; idx < opts.length; idx++) {
          const opt = opts[idx];
          const letter = String.fromCharCode(65 + idx);
          const shouldBeChecked = 
            (verified.optionIds?.length && (
              verified.optionIds.includes(opt.id) || 
              verified.optionIds.includes(opt.element?.getAttribute('value')) || 
              verified.optionIds.includes(opt.element?.value) || 
              verified.optionIds.some(id => opt.element?.id && opt.element.id.endsWith(id))
            )) ||
            (verified.optionNumbers?.length && verified.optionNumbers.includes(opt.element?.getAttribute('title'))) ||
            (verified.indices?.length && verified.indices.includes(idx)) ||
            (verified.letters?.length && (verified.letters.includes(letter) || verified.letters.includes(opt.letter?.toUpperCase())));

          const inputEl = opt.element && opt.element.tagName === 'INPUT' ? opt.element : opt.element?.querySelector('input[type="checkbox"]');
          const roleCheckbox = opt.element?.getAttribute('role') === 'checkbox' ? opt.element : opt.element?.querySelector('[role="checkbox"]');

          if (inputEl) {
            if (inputEl.checked !== !!shouldBeChecked) {
              inputEl.focus();
              inputEl.click();
              inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(r => setTimeout(r, 60));
            }
            if (shouldBeChecked) checkedCount++;
          } else if (roleCheckbox) {
            const isAriaChecked = roleCheckbox.getAttribute('aria-checked') === 'true' || roleCheckbox.getAttribute('data-state') === 'checked';
            if (isAriaChecked !== !!shouldBeChecked) {
              roleCheckbox.focus();
              roleCheckbox.click();
              await new Promise(r => setTimeout(r, 80));
            }
            if (shouldBeChecked) checkedCount++;
          }
        }
      } else if (q.container) {
        // Direct container checkbox matching
        const domBoxes = Array.from(q.container.querySelectorAll('input[type="checkbox"], [role="checkbox"]'));
        for (let bIdx = 0; bIdx < domBoxes.length; bIdx++) {
          const box = domBoxes[bIdx];
          const boxVal = box.getAttribute('value') || box.value;
          const boxTitle = box.getAttribute('title');
          const shouldBeChecked = 
            (verified.optionIds?.length && verified.optionIds.includes(boxVal)) ||
            (verified.optionNumbers?.length && verified.optionNumbers.includes(boxTitle)) ||
            (verified.indices?.length && verified.indices.includes(bIdx));

          if (box.tagName === 'INPUT') {
            if (box.checked !== !!shouldBeChecked) {
              box.click();
              box.dispatchEvent(new Event('input', { bubbles: true }));
              box.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(r => setTimeout(r, 60));
            }
          } else {
            const isAriaChecked = box.getAttribute('aria-checked') === 'true' || box.getAttribute('data-state') === 'checked';
            if (isAriaChecked !== !!shouldBeChecked) box.click();
          }
          if (shouldBeChecked) checkedCount++;
        }
      }

      q.isAnswered = true;
      if (q.container) {
        q.container.style.transition = 'box-shadow 0.3s ease';
        q.container.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.4)';
        setTimeout(() => { if (q.container) q.container.style.boxShadow = ''; }, 2000);
      }

      updateStatus?.(`Verified Checked (${verified.letters?.join(', ') || checkedCount}): ${checkedCount} options`);
      return { success: true, answer: verified.letters?.join(', ') || `${checkedCount} selected`, verified: true };
    }

    return { success: false, message: 'Could not apply verified answer' };
  },

  // Detect all questions on the current page across multiple LMS platforms
    formatContainerText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);

    // Math formulas (LaTeX / KaTeX / MathML / superscripts / subscripts)
    clone.querySelectorAll('sup').forEach(subEl => { subEl.textContent = '^' + subEl.textContent; });
    clone.querySelectorAll('sub').forEach(subEl => { subEl.textContent = '_' + subEl.textContent; });
    clone.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]').forEach(ann => {
      const parent = ann.closest('mjx-container, .katex, math');
      if (parent) parent.replaceWith(document.createTextNode(' $' + ann.textContent + '$ '));
    });
    clone.querySelectorAll('math, mjx-container, .katex').forEach(m => {
      const ann = m.querySelector('annotation');
      if (ann) m.replaceWith(document.createTextNode(' $' + ann.textContent + '$ '));
    });

    // Format HTML <table> elements into structured Markdown tables
    clone.querySelectorAll('table').forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) return;
      const tableLines = [];
      let maxCols = 0;
      const parsedRows = rows.map(tr => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map(c => 
          (c.innerText || c.textContent || '').trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')
        );
        if (cells.length > maxCols) maxCols = cells.length;
        return cells;
      }).filter(cells => cells.length > 0);

      parsedRows.forEach((cells, rIdx) => {
        while (cells.length < maxCols) cells.push('');
        tableLines.push('| ' + cells.join(' | ') + ' |');
        if (rIdx === 0) {
          tableLines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        }
      });

      if (tableLines.length > 0) {
        const mdTable = '\n\n' + tableLines.join('\n') + '\n\n';
        table.replaceWith(document.createTextNode(mdTable));
      }
    });

    // Remove buttons, clear-selection links, scripts, flags
    clone.querySelectorAll('button, .flag-btn, [class*="flag"], [class*="clear-selection"], mat-radio-group, .options, .options-container, [role="radiogroup"], textarea, mat-form-field, [class*="your-answer"], script, style').forEach(subEl => subEl.remove());

    let text = clone.innerText || clone.textContent || '';
    text = text
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
      .join('\n');

    return text.trim();
  },

  detectAllQuestions() {
    const list = [];

    // ── 0. IITM Online Degree, QuizPractice.space & Universal Question Portals ──
    const hasMoodleQue = document.querySelector('.que') !== null;
    const isIITMOrQuizPractice = !hasMoodleQue && (
      document.querySelector('app-root, .mat-typography, [class*="app-shell"], mat-radio-group, mat-radio-button, mat-checkbox') !== null ||
      document.title.includes('IITM') || 
      document.title.includes('QuizPractice') || 
      document.title.includes('Graded Assignment') ||
      document.title.includes('Question Paper') ||
      /onlinedegree\.iitm\.ac\.in|study\.iitm\.ac\.in|seek\.|quizpractice|iitmbs|pyq/i.test(window.location.hostname)
    );

    // Strategy A: Explicit Question Heading Discovery (e.g. 'Question 8 / 17', 'Question 1: 6406531951224', 'Question 2: ...')
    const headingElements = Array.from(document.querySelectorAll('.q-header, [class*="q-header"], [class*="question-header"], [class*="question-title"], [class*="question-meta"], h1, h2, h3, h4, h5, div, span, p, b, strong')).filter(el => {
      if (el.closest('#peslms-autopilot-root')) return false;
      const txt = (el.innerText || '').trim();
      return /^Question\s+\d+(\s*[\/\:.-]|\s+of\b|\s*$)/i.test(txt) && txt.length < 60;
    });

    let containers = [];

    if (headingElements.length > 0) {
      headingElements.forEach(h => {
        const direct = h.closest('div[id^="question"], .question-container, .question-card, [class*="question"]:not([class*="palette"]):not([class*="nav"])');
        if (direct && direct.querySelector('input, textarea, select, [role="radio"], [role="checkbox"], mat-radio-button, mat-checkbox, mat-form-field')) {
          if (!containers.includes(direct)) containers.push(direct);
          return;
        }

        let cur = h.parentElement;
        let best = null;
        while (cur && cur !== document.body) {
          if (cur.id === 'peslms-autopilot-root') break;
          const hasInputs = cur.querySelector('input, textarea, select, [role="radio"], [role="checkbox"], mat-radio-button, mat-checkbox, mat-form-field');
          if (hasInputs) {
            let count = 0;
            cur.querySelectorAll('h1, h2, h3, h4, h5, div, span, p, b, strong').forEach(sh => {
              if (/^Question\s+\d+(\s*[\/\:.-]|\s+of\b|\s*$)/i.test((sh.innerText || '').trim())) count++;
            });
            if (count > 1) break;
            best = cur;
          }
          cur = cur.parentElement;
        }
        if (best && !containers.includes(best)) {
          containers.push(best);
        }
      });
    }

    if (!hasMoodleQue && (containers.length > 0 || isIITMOrQuizPractice)) {
      // 0.1 Extract common reference instructions / notation pane (left column)
      let iitmCommonContext = '';
      const commonCandidate = Array.from(document.querySelectorAll('div, section, aside, app-common-data, [class*="common"], [class*="instruction"], [class*="notations"]')).find(el => {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
        const t = el.innerText || '';
        return (
          t.includes('The information below is common to') ||
          t.includes('information below is common to Questions') ||
          t.includes('common to Questions') ||
          (t.includes('Notations:') && t.includes('Set of real numbers'))
        );
      });
      if (commonCandidate) {
        iitmCommonContext = this.formatContainerText(commonCandidate);
      }

      // Strategy B: LMS & Angular Question Containers
      if (containers.length === 0) {
        containers = Array.from(document.querySelectorAll(
          '.quiz-question-block, [class*="q-block"], app-question, .question-card, .question-container, .question-wrapper, [class*="question-view"], mat-card, .mat-mdc-card, .question-pane, div[class*="question"]:not([class*="palette"]):not([class*="nav"])'
        )).filter(c => {
          if (c.offsetWidth === 0 && c.offsetHeight === 0) return false;
          const hasOptions = c.querySelector('mat-radio-group, mat-radio-button, mat-checkbox, [role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"], input.mat-mdc-input-element, textarea.mat-mdc-input-element, textarea, input[type="text"], input[type="number"], mat-form-field, .quiz-options, [class*="options"]');
          const hasHeader = /Question\s+\d+|Q\d+/i.test(c.innerText);
          return hasOptions || hasHeader;
        });

        if (containers.length > 1) {
          // If an outer container contains a question header AND options, discard nested inner children that lack header
          const filtered = containers.filter(c => {
            const outerWithHeader = containers.find(other => other !== c && other.contains(c) && /Question\s+\d+/i.test(other.innerText));
            if (outerWithHeader) return false;
            return true;
          });
          if (filtered.length > 0) containers = filtered;
        }
      }

      // Fallback: If no container matched, find the active options, textarea or input block
      if (containers.length === 0) {
        const activeOpts = document.querySelector('mat-radio-group, [role="radiogroup"], mat-checkbox, .options-container, .mat-mdc-radio-group, textarea.mat-mdc-input-element, textarea, mat-form-field, input.mat-mdc-input-element');
        if (activeOpts) {
          const parent = activeOpts.closest('section, main, .right-pane, .right-col, .question-container, .mat-typography > div, .app-shell > div') || activeOpts.parentElement;
          if (parent) containers = [parent];
        }
      }

      for (let cIdx = 0; cIdx < containers.length; cIdx++) {
        const q = containers[cIdx];

        let qNum = (typeof this.extractRealQuestionNumber === 'function' ? this.extractRealQuestionNumber(q) : null) || (cIdx + 1);
        let qLongId = null;
        let domId = q.id || `question${qNum}`;

        const idMatch = (q.innerText || '').match(/Question\s+(\d+)\s*(?:[\/\:.-]\s*(\d+))?/i);
        if (idMatch) {
          if (idMatch[1]) qNum = parseInt(idMatch[1]);
          if (idMatch[2]) qLongId = idMatch[2];
        }
        if (q.id && /^question(\d+)$/i.test(q.id)) {
          qNum = parseInt(q.id.match(/^question(\d+)$/i)[1]);
          domId = q.id;
        }
        const realNum = (typeof this.extractRealQuestionNumber === 'function' ? this.extractRealQuestionNumber(q) : null);
        if (realNum) qNum = realNum;

        // Extract mathematical formatting (LaTeX / MathML / KaTeX / superscripts)
        const clone = q.cloneNode(true);
        clone.querySelectorAll('sup').forEach(el => { el.textContent = `^${el.textContent}`; });
        clone.querySelectorAll('sub').forEach(el => { el.textContent = `_${el.textContent}`; });
        clone.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]').forEach(ann => {
          const parent = ann.closest('mjx-container, .katex, math');
          if (parent) parent.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
        });
        clone.querySelectorAll('math, mjx-container, .katex').forEach(m => {
          const ann = m.querySelector('annotation');
          if (ann) m.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
        });
        clone.querySelectorAll('img').forEach(img => {
          const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
          if (alt && !alt.toLowerCase().includes('logo') && !alt.toLowerCase().includes('icon')) {
            img.replaceWith(document.createTextNode(` ${alt} `));
          }
        });
        clone.querySelectorAll('mat-radio-group, .options, .options-container, [role="radiogroup"], button, .flag-btn, [class*="flag"], [class*="clear-selection"], textarea, mat-form-field, [class*="your-answer"], script, style').forEach(el => el.remove());

        // Format question container with table and math support
        let rawQText = this.formatContainerText(q);
        rawQText = rawQText
          .replace(/Question\s+\d+\s*(?:[:\.]\s*\d+)?/gi, '')
          .replace(/Total\s*Marks?\s*:\s*[0-9\.]+\s*\|\s*Type\s*:\s*[A-Z]+/gi, '')
          .replace(/View\s+Solutions?\s*\(\d+\)/gi, '')
          .replace(/Flag for review/gi, '')
          .replace(/\d+\s*marks?/gi, '')
          .replace(/Clear Selection/gi, '')
          .replace(/Options\s*$/gi, '')
          .replace(/Answer\s*\(Numeric\)\s*:?/gi, '')
          .replace(/Your answer\s*/gi, '')
          .replace(/Only numeric input is accepted for this question\.?/gi, '')
          .replace(/•\s*/g, '')
          .trim();

        const image = q.querySelector('img:not([src*="logo"]):not([src*="avatar"]):not([src*="icon"]):not([src*="theme"]):not([src*="unflagged"])');

        if (rawQText.length < 5) {
          const promptEl = q.querySelector('.question-text, .q-text, .prompt, h2, h3, p');
          if (promptEl) rawQText = promptEl.innerText.trim();
        }

        if (rawQText.length < 5 && image) {
          rawQText = 'Question problem statement is displayed in the attached image.';
        }

        const fullText = iitmCommonContext ? `[Reference / Common Information]:\n${iitmCommonContext}\n\n[Question]:\n${rawQText}` : rawQText;

        // Check A: Radio buttons (MCQ)
        const radioEls = Array.from(q.querySelectorAll('mat-radio-button, .mat-mdc-radio-button, [role="radio"], input[type="radio"]')).filter(r => {
          if (r.value === '-1') return false;
          const lbl = r.innerText || r.getAttribute('aria-label') || r.closest('label')?.innerText || '';
          return !/clear\s*(my\s*choice|selection)/i.test(lbl);
        });
        const uniqueRadios = radioEls.filter(el => {
          if (el.tagName === 'INPUT' && el.closest('mat-radio-button, .mat-mdc-radio-button')) return false;
          return true;
        });

        if (uniqueRadios.length >= 2) {
          const options = uniqueRadios.map((r, i) => {
            const innerInput = r.tagName === 'INPUT' ? r : r.querySelector('input[type="radio"]');
            const labelEl = (r.id ? document.querySelector(`label[for="${r.id}"]`) : null) || r.closest('label') || r.parentElement?.querySelector('label') || r.parentElement;

            let labelText = '';
            if (labelEl) {
              const cloneLbl = labelEl.cloneNode(true);
              cloneLbl.querySelectorAll('sup').forEach(el => { el.textContent = `^${el.textContent}`; });
              cloneLbl.querySelectorAll('sub').forEach(el => { el.textContent = `_${el.textContent}`; });
              cloneLbl.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]').forEach(ann => {
                const parent = ann.closest('mjx-container, .katex, math');
                if (parent) parent.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
              });
              cloneLbl.querySelectorAll('img').forEach(img => {
                const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                if (alt) img.replaceWith(document.createTextNode(` ${alt} `));
              });
              labelText = (cloneLbl.innerText || '').trim();
            }
            if (!labelText) {
              labelText = (r.innerText || r.getAttribute('aria-label') || '').trim();
            }

            const letterMatch = labelText.match(/^([A-Za-z])[\.\)\:\-]\s*/i);
            const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + i);
            const cleanText = labelText.replace(/^[A-Za-z][\.\)\:\-]\s*/i, '').trim();

            const liParent = r.closest('li, [class*="option"]');
            const isChecked = (r.value !== '-1') && (
                              (innerInput && innerInput.checked) || 
                              r.checked ||
                              r.classList.contains('mat-mdc-radio-checked') || 
                              r.classList.contains('mat-radio-checked') ||
                              r.getAttribute('aria-checked') === 'true' ||
                              r.getAttribute('data-state') === 'checked' ||
                              (liParent && (liParent.classList.contains('selected') || liParent.classList.contains('active') || liParent.classList.contains('correct') || liParent.classList.contains('wrong'))));

            const optId = r.getAttribute('value') || r.value || innerInput?.value || r.id?.replace(/^r[12]\d*/, '') || null;

            return {
              id: optId,
              element: r,
              innerInput: innerInput,
              labelEl: labelEl || r,
              letter: letter,
              text: cleanText,
              checked: isChecked
            };
          });

          list.push({
            container: q,
            id: domId,
            domId: domId,
            questionNum: qNum,
            longId: qLongId,
            index: cIdx,
            type: 'mcq',
            text: fullText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked),
            isAngularMaterial: true
          });
          continue;
        }

        // Check B: Checkboxes (MSQ / Multi-Select)
        const checkboxEls = Array.from(q.querySelectorAll('mat-checkbox, .mat-mdc-checkbox, [role="checkbox"], input[type="checkbox"]')).filter(c => {
          if (c.value === '-1') return false;
          const lbl = c.innerText || c.getAttribute('aria-label') || c.closest('label')?.innerText || '';
          return !/clear\s*(my\s*choice|selection)/i.test(lbl);
        });
        const uniqueCheckboxes = checkboxEls.filter(el => {
          if (el.tagName === 'INPUT' && el.closest('mat-checkbox, .mat-mdc-checkbox')) return false;
          return true;
        });

        if (uniqueCheckboxes.length >= 2) {
          const options = uniqueCheckboxes.map((c, i) => {
            const innerInput = c.tagName === 'INPUT' ? c : c.querySelector('input[type="checkbox"]');
            const labelEl = (c.id ? document.querySelector(`label[for="${c.id}"]`) : null) || (innerInput?.id ? document.querySelector(`label[for="${innerInput.id}"]`) : null) || c.closest('label') || c.parentElement;

            let labelText = '';
            if (labelEl) {
              const cloneLbl = labelEl.cloneNode(true);
              cloneLbl.querySelectorAll('sup').forEach(el => { el.textContent = `^${el.textContent}`; });
              cloneLbl.querySelectorAll('sub').forEach(el => { el.textContent = `_${el.textContent}`; });
              cloneLbl.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]').forEach(ann => {
                const parent = ann.closest('mjx-container, .katex, math');
                if (parent) parent.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
              });
              cloneLbl.querySelectorAll('img').forEach(img => {
                const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                if (alt) img.replaceWith(document.createTextNode(` ${alt} `));
              });
              labelText = (cloneLbl.innerText || '').trim();
            }
            if (!labelText) {
              labelText = (c.innerText || c.getAttribute('aria-label') || '').trim();
            }

            const letterMatch = labelText.match(/^([A-Za-z])[\.\)\:\-]\s*/i);
            const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + i);
            const cleanText = labelText.replace(/^[A-Za-z][\.\)\:\-]\s*/i, '').trim();

            const isChecked = (innerInput && innerInput.checked) || 
                              c.classList.contains('mat-mdc-checkbox-checked') || 
                              c.classList.contains('mat-checkbox-checked') ||
                              c.getAttribute('aria-checked') === 'true' ||
                              c.getAttribute('data-state') === 'checked';

            const optId = c.getAttribute('value') || innerInput?.getAttribute('value') || innerInput?.value || c.value || c.id?.replace(/^r[12]\d*/, '') || null;

            return {
              id: optId,
              element: innerInput || c,
              labelEl: labelEl || c,
              letter: letter,
              text: cleanText,
              checked: isChecked
            };
          });

          list.push({
            container: q,
            id: domId,
            domId: domId,
            questionNum: qNum,
            longId: qLongId,
            index: cIdx,
            type: 'multichoice',
            text: fullText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked),
            isAngularMaterial: true
          });
          continue;
        }

        // Check C: NAT / Numerical Answer Type or Brief Text (Textarea / Text Input)
        const textInput = q.querySelector('textarea.mat-mdc-input-element, textarea.mat-input-element, textarea, input.mat-mdc-input-element, input.mat-input-element, mat-form-field textarea, mat-form-field input, input[type="text"], input[type="number"], [contenteditable="true"]') ||
          (document.querySelectorAll('app-question, .question-card, .question-container').length <= 1 ? document.querySelector('textarea.mat-mdc-input-element, textarea.mat-input-element, textarea, input.mat-mdc-input-element') : null);
        if (textInput) {
          const containerText = q.innerText || '';
          const isNAT = 
            /numeric|numerical|nat\b|type\s*:\s*sa/i.test(containerText) || 
            /numeric|numerical|nat\b/i.test(fullText) ||
            containerText.includes('Only numeric input') ||
            containerText.includes('Answer (Numeric)') ||
            fullText.includes('Only numeric input');

          list.push({
            container: q,
            id: domId,
            domId: domId,
            questionNum: qNum,
            longId: qLongId,
            index: cIdx,
            type: 'text',
            isNAT: isNAT,
            text: fullText,
            image: image,
            textInput: textInput,
            isAnswered: (textInput.value || textInput.innerText || '').trim().length > 0,
            isAngularMaterial: true
          });
          continue;
        }
      }
      if (list.length > 0) return list;
    }

    // ── 1. Moodle LMS (.que) ──
    const moodleQuestions = Array.from(document.querySelectorAll('.que'));
    if (moodleQuestions.length > 0) {
      for (const q of moodleQuestions) {
        if (q.offsetWidth === 0 && q.offsetHeight === 0) continue;
        const qTextEl = q.querySelector('.qtext');
        let qText = '';
        if (qTextEl) {
          const cloneMoodle = qTextEl.cloneNode(true);
          cloneMoodle.querySelectorAll('annotation[encoding*="tex"], annotation[encoding*="TeX"]').forEach(ann => {
            const parent = ann.closest('mjx-container, .katex, math');
            if (parent) parent.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
          });
          cloneMoodle.querySelectorAll('math, mjx-container, .katex').forEach(m => {
            const ann = m.querySelector('annotation');
            if (ann) m.replaceWith(document.createTextNode(` $${ann.textContent}$ `));
          });
          cloneMoodle.querySelectorAll('img').forEach(img => {
            const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
            if (alt && !alt.toLowerCase().includes('theme') && !alt.toLowerCase().includes('icon')) {
              img.replaceWith(document.createTextNode(` ${alt} `));
            }
          });
          qText = cloneMoodle.innerText.trim();
        } else {
          qText = q.querySelector('.formulation')?.innerText?.trim() || '';
        }
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
          if (r.value === '-1') return false;
          const ariaLabelId = r.getAttribute('aria-labelledby');
          const ariaLabelEl = ariaLabelId ? document.getElementById(ariaLabelId) : null;
          const lbl = q.querySelector(`label[for="${r.id}"]`)?.innerText?.trim() || 
                      ariaLabelEl?.innerText?.trim() || 
                      r.parentElement?.innerText?.trim() || '';
          return !/clear\s*(my\s*choice|selection)/i.test(lbl);
        });

        if (inputs.length >= 2) {
          const isMulti = inputs.some(i => i.type === 'checkbox') || qText.toLowerCase().includes('select one or more');
          const options = inputs.map((r, i) => {
            const ariaLabelId = r.getAttribute('aria-labelledby');
            const ariaLabelEl = ariaLabelId ? document.getElementById(ariaLabelId) : null;
            const labelEl = ariaLabelEl || q.querySelector(`label[for="${r.id}"]`) || r.closest('label') || r.parentElement?.querySelector('[data-region="answer-label"]') || r.parentElement;

            let letter = String.fromCharCode(65 + i);
            let cleanText = '';

            if (ariaLabelEl) {
              const ansNum = ariaLabelEl.querySelector('.answernumber');
              if (ansNum) {
                const match = ansNum.innerText.match(/([a-zA-Z0-9])/);
                if (match) letter = match[1].toUpperCase();
              }
              const fillEl = ariaLabelEl.querySelector('.flex-fill');
              cleanText = (fillEl ? fillEl.innerText : ariaLabelEl.innerText).replace(/^[a-z0-9][\.\)\:\-]\s*/i, '').trim();
            } else {
              const rawText = labelEl?.innerText || '';
              const match = rawText.match(/^([a-z0-9])[\.\)\:\-]\s*/i);
              if (match) letter = match[1].toUpperCase();
              cleanText = rawText.replace(/^[a-z0-9][\.\)\:\-]\s*/i, '').trim();
            }

            return {
              id: r.value,
              element: r,
              labelEl: labelEl || r,
              letter: letter,
              text: cleanText,
              checked: r.checked && r.value !== '-1'
            };
          });

          list.push({
            container: q,
            type: isMulti ? 'multichoice' : 'mcq',
            text: qText,
            image: image,
            options: options,
            isAnswered: options.some(o => o.checked && o.element?.value !== '-1')
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

  // Extract real active question number from top palette, question header or page state
  extractRealQuestionNumber(container = null) {
    try {
      // 1. If a specific question container is provided, check its local heading, .qno, or id first
      if (container) {
        const qno = container.querySelector('.qno, .question-number, [class*="qno"]');
        if (qno) {
          const num = parseInt((qno.innerText || '').trim());
          if (!isNaN(num) && num > 0) return num;
        }

        const localHeader = container.querySelector('.q-header, [class*="q-header"], [class*="question-header"], [class*="question-title"], h1, h2, h3, h4, h5');
        if (localHeader) {
          const m = (localHeader.innerText || '').match(/Question\s+(\d+)\s*(?:\/\s*\d+|\s+of\s+\d+|[:\.-]|\s*$)/i);
          if (m && m[1]) return parseInt(m[1]);
        }

        if (container.id) {
          const m = container.id.match(/(?:question|q)[-_]?(\d+)$/i);
          if (m && m[1]) return parseInt(m[1]);
        }
      }

      // 2. Search for explicit question header element across the document (.q-header, Question X / Y)
      const headerEls = document.querySelectorAll(
        '.q-header, [class*="q-header"], [class*="question-header"], [class*="question-title"], [class*="question-meta"], [class*="question-num"], h1, h2, h3, h4, h5'
      );
      for (const h of headerEls) {
        if (h.closest('#peslms-autopilot-root')) continue;
        const txt = (h.innerText || '').trim();
        const m = txt.match(/Question\s+(\d+)\s*(?:\/\s*\d+|\s+of\s+\d+|[:\.-]|\s*$)/i);
        if (m && m[1]) {
          const num = parseInt(m[1]);
          if (!isNaN(num) && num > 0) return num;
        }
      }

      // 3. Check top question palette active button (most reliable on SPAs like IITM / Angular)
      const activePaletteBtn = document.querySelector(
        '.palette .circle-btn.active, .palette .active, [class*="palette"] .active, [class*="palette"] [aria-current="true"], [class*="palette"] [aria-current="page"], [class*="palette"] [aria-current="step"], button.active[aria-current], button.circle-btn.active, .question-nav .circle-btn.active, .circle-btn.active, .circle-btn[aria-current="true"], .palette button.selected, .palette [class*="selected"]'
      );
      if (activePaletteBtn) {
        const raw = (activePaletteBtn.innerText || activePaletteBtn.getAttribute('data-index') || '').trim();
        const num = parseInt(raw);
        if (!isNaN(num) && num > 0) return num;
      }

      // 4. Global match on document body for "Question X / Y" or "Question X of Y"
      const bodyText = (document.body?.innerText || '');
      const bodyMatch = bodyText.match(/\bQuestion\s+(\d+)\s*(?:\/|\s+of\b)\s*\d+/i);
      if (bodyMatch && bodyMatch[1]) {
        const num = parseInt(bodyMatch[1]);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch (e) {}

    return null;
  },

  // Returns question in view or first unanswered
  detectCurrentQuestion() {
    const all = this.detectAllQuestions();
    if (!all.length) return null;

    const windowHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const viewportCenter = windowHeight / 2;

    // First try: UNANSWERED question currently in viewport (closest to viewport center)
    let bestUnanswered = null;
    let minUnansweredDist = Infinity;

    all.forEach(q => {
      if (q.isAnswered) return;
      const rect = q.container.getBoundingClientRect();
      if (rect.bottom > 50 && rect.top < (windowHeight - 50)) {
        const center = rect.top + (rect.height || 100) / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < minUnansweredDist) {
          minUnansweredDist = dist;
          bestUnanswered = q;
        }
      }
    });
    if (bestUnanswered) {
      const realNum = this.extractRealQuestionNumber(bestUnanswered.container);
      if (realNum) bestUnanswered.questionNum = realNum;
      return bestUnanswered;
    }

    // Second try: ANY question currently in viewport (closest to viewport center)
    let bestVisible = null;
    let minVisibleDist = Infinity;
    all.forEach(q => {
      const rect = q.container.getBoundingClientRect();
      if (rect.bottom > 50 && rect.top < (windowHeight - 50)) {
        const center = rect.top + (rect.height || 100) / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < minVisibleDist) {
          minVisibleDist = dist;
          bestVisible = q;
        }
      }
    });
    if (bestVisible) {
      const realNum = this.extractRealQuestionNumber(bestVisible.container);
      if (realNum) bestVisible.questionNum = realNum;
      return bestVisible;
    }

    // Third try: first unanswered question anywhere on the page
    const unanswered = all.find(q => !q.isAnswered);
    if (unanswered) {
      const realNum = this.extractRealQuestionNumber(unanswered.container);
      if (realNum) unanswered.questionNum = realNum;
      return unanswered;
    }

    const first = all[0];
    const realNum = this.extractRealQuestionNumber(first?.container);
    if (realNum && first) first.questionNum = realNum;
    return first;
  },

  // Locates the Start / Attempt Quiz button on landing pages (view.php, IITM landing page)
  findStartAttemptButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], div[role="button"]'));
    return candidates.find(b => {
      if (b.closest('#peslms-autopilot-root')) return false;
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none') return false;
      if (b.disabled || b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true') return false;
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      const href = (b.href || '').toLowerCase();
      return (
        txt.includes('start assessment') ||
        txt.includes('begin assessment') ||
        txt.includes('start assignment') ||
        txt.includes('take assessment') ||
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

  // Locates the Next / Continue / Next Page button (NOT submit/finish)
  findNextButton(options = {}) {
    const { includeDisabled = false } = options;

    // 1. Direct platform CSS class / name / ID selectors (Moodle, Canvas, Blackboard, Angular Material, MCQExamTest)
    const explicitSelector = [
      '#btnNext',
      'button#btnNext',
      '.btn-next',
      '.next-btn',
      'input.mod_quiz-next-nav',
      'button.mod_quiz-next-nav',
      '#mod_quiz-next-nav',
      'input[name="next"]',
      'button[name="next"]',
      'button.next-button',
      '.next-button',
      '.button-next',
      'a.next_page',
      '#bottom_next_button',
      'button[data-action="next"]',
      'a[aria-label*="Next"]',
      'button[aria-label*="Next"]',
      'input[aria-label*="Next"]',
      'button.mat-mdc-button[class*="next"]',
      'button.mat-button[class*="next"]'
    ].join(', ');
    const explicit = document.querySelector(explicitSelector);
    if (explicit && !explicit.closest('#peslms-autopilot-root') && explicit.offsetWidth > 0 && explicit.offsetHeight > 0 && explicit.style.display !== 'none' && !explicit.hidden && (includeDisabled || (!explicit.disabled && !explicit.hasAttribute('disabled')))) {
      const explicitTxt = (explicit.innerText || explicit.value || '').toLowerCase();
      if (!explicitTxt.includes('submit') && !explicitTxt.includes('prev')) {
        return explicit;
      }
    }

    // 2. Scan all clickable candidates by text, value, aria-label, title
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"]'));
    return candidates.find(b => {
      if (b.closest('#peslms-autopilot-root')) return false;
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none' || b.hidden) return false;
      if (!includeDisabled && (b.disabled || b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('mat-button-disabled') || b.classList.contains('disabled'))) return false;
      if (b.closest('#confirm-modal, .modal:not(.show)') && getComputedStyle(b.closest('#confirm-modal, .modal')).display === 'none') return false;

      const rawTxt = (b.innerText || b.value || b.getAttribute('aria-label') || b.title || '').trim().toLowerCase();
      const txt = rawTxt.replace(/[\u2192\u2190\u203A\u00BB\u25B6\u27A1>→»]/g, '').trim();
      const name = (b.name || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      const cls = (b.className || '').toLowerCase();

      // Negative filters: cannot be previous/back or finish/submit
      if (txt.includes('submit') || txt.includes('previous') || txt.includes('prev') || txt.includes('back') || txt.includes('review') || txt.includes('cancel')) return false;

      // Positive text matches
      const isNextText = (
        txt === 'next' ||
        txt.startsWith('next') ||
        /\bnext\b/i.test(txt) ||
        txt.includes('next page') ||
        txt.includes('next question') ||
        txt.includes('next section') ||
        txt.includes('save & next') ||
        txt.includes('save and next') ||
        txt.includes('save & continue') ||
        txt.includes('continue') ||
        txt.includes('proceed') ||
        rawTxt === '>' ||
        rawTxt === '>>' ||
        rawTxt === '→' ||
        rawTxt === '»'
      );

      // Attribute matches
      const isNextAttr = (
        name === 'next' ||
        id === 'btnnext' ||
        id.includes('next') ||
        cls.includes('btn-next') ||
        cls.includes('next-btn') ||
        cls.includes('next') ||
        b.getAttribute('data-action') === 'next'
      );

      return isNextText || isNextAttr;
    });
  },

  // Locates numbered circular question palette elements (e.g. 1..17 on IITM / Swayam)
  findNextPaletteButton() {
    // Strategy 1: Header awareness (e.g. "Question 5 / 17" or "Question 5 of 25")
    const headerMatch = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
    let nextTargetNum = null;
    if (headerMatch) {
      const cur = parseInt(headerMatch[1], 10);
      const tot = parseInt(headerMatch[2], 10);
      if (cur < tot) {
        nextTargetNum = cur + 1;
      }
    }

    const paletteElements = Array.from(document.querySelectorAll(
      '.question-palette button, .palette button, .question-nav button, [class*="palette"] button, [class*="nav-item"] button, button.circle-btn, button[class*="number"], .question-palette div, .palette div, .question-nav div, [class*="palette"] span, .question-nav span, .circle-btn, button, a'
    )).filter(b => {
      if (b.closest('#peslms-autopilot-root')) return false;
      if (b.offsetWidth === 0 || b.offsetHeight === 0) return false;
      const rect = b.getBoundingClientRect();
      if (rect.width > 90 || rect.height > 90) return false;
      const num = parseInt((b.innerText || '').trim(), 10);
      return !isNaN(num) && String(num) === (b.innerText || '').trim() && num >= 1 && num <= 100;
    });

    if (nextTargetNum !== null && paletteElements.length > 0) {
      const target = paletteElements.find(b => parseInt((b.innerText || '').trim(), 10) === nextTargetNum);
      if (target) return target;
    }

    if (paletteElements.length >= 2) {
      // Find active button
      const activeIdx = paletteElements.findIndex(b => 
        b.classList.contains('active') || 
        b.classList.contains('current') || 
        b.classList.contains('selected') || 
        b.getAttribute('aria-current') === 'true' ||
        b.getAttribute('aria-selected') === 'true'
      );

      if (activeIdx !== -1 && activeIdx + 1 < paletteElements.length) {
        return paletteElements[activeIdx + 1];
      }
    }
    return null;
  },

  // Locates submit / finish attempt buttons specifically
  findSubmitButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"]'));
    return candidates.find(b => {
      if (b.closest('#peslms-autopilot-root')) return false;
      if (b.offsetWidth === 0 || b.offsetHeight === 0 || b.style.display === 'none' || b.hidden) return false;
      if (b.disabled || b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('mat-button-disabled') || b.classList.contains('disabled')) return false;
      if (b.closest('#reportModal, #reportModalOverlay, .mx-dialog--report, [id*="report"], [class*="report"]')) return false;
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      if (txt.includes('report') || txt.includes('feedback') || txt.includes('cancel') || txt.includes('prev') || txt.includes('close')) return false;
      return (
        txt.includes('finish attempt') ||
        txt.includes('submit all') ||
        txt.includes('submit assessment') ||
        txt.includes('submit assignment') ||
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
    // Prefer "Next" over "Palette" over "Submit"
    return this.findNextButton() || this.findNextPaletteButton() || this.findSubmitButton();
  },

  // Detect if page shows a completion/thank-you/submitted state
  isQuizComplete() {
    // 1. If active questions are detected on the page, the quiz is definitely NOT complete!
    const questions = this.detectAllQuestions();
    if (questions.length > 0) {
      // Check pagination e.g. "Question 1 of 25"
      const headerMatch = document.body?.innerText?.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
      if (headerMatch) {
        const cur = parseInt(headerMatch[1], 10);
        const tot = parseInt(headerMatch[2], 10);
        if (cur < tot) return false;
      }
      // If there are unanswered questions or a Next button is available, not complete
      if (questions.some(q => !q.isAnswered)) return false;
      if (this.findNextButton()) return false;
    }

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
      'you have completed the quiz',
      'you have completed this quiz',
      'you have completed this test',
      'congratulations, you have finished',
      'assessment submitted and complete'
    ];

    if (completionPhrases.some(phrase => body.includes(phrase))) {
      return true;
    }

    // Modal dialog with congratulations or score (MUST be currently visible!)
    const modals = Array.from(document.querySelectorAll('.modal.show, .modal[style*="display: block"], [role="dialog"]:not([hidden]):not([style*="display: none"]), div[class*="dialog"]:not([hidden]):not([style*="display: none"])'));
    for (const modal of modals) {
      if (modal.closest('#peslms-autopilot-root')) continue;
      if (modal.offsetWidth === 0 || modal.offsetHeight === 0) continue;
      const modalText = (modal.innerText || '').toLowerCase();
      if (
        (modalText.includes('congratulations') && modalText.includes('score')) ||
        modalText.includes('quiz completed') ||
        modalText.includes('quiz submitted') ||
        modalText.includes('results summary')
      ) {
        return true;
      }
    }

    return false;
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

  // Find assignment links in course page (Moodle, Canvas, IITM Online Degree, etc.)
  findAssignmentLinks() {
    const links = [];
    const seen = new Set();

    // Helper to check if a title should be excluded (ungraded / practice)
    const isExcluded = (title) => {
      const lower = title.toLowerCase();
      return (
        lower.includes('not graded') ||
        lower.includes('ungraded') ||
        lower.includes('extra practice') ||
        lower.includes('practice assignment') ||
        (lower.includes('practice') && !lower.includes('graded'))
      );
    };

    // ── 0. Moodle Course View (.activity-item on edu.practicaleduskills.com & standard Moodle) ──
    const moodleItems = Array.from(document.querySelectorAll('.activity-item, .activity'));
    if (moodleItems.length > 0) {
      // Step A: Auto-click any manual "Mark as done" buttons right now on the course view
      document.querySelectorAll('button[data-action="toggle-manual-completion"]').forEach(b => {
        const label = (b.innerText || b.getAttribute('aria-label') || '').trim();
        if (label.includes('Mark as done') || b.getAttribute('data-toggletype') === 'manual:mark-done') {
          try { b.click(); } catch(e) {}
        }
      });

      // Step B: Auto-trigger view on reading / introduction materials with "To do"
      moodleItems.forEach(el => {
        const badge = el.querySelector('[data-region="completion-info"] button, [data-region="completion-info"] .badge')?.innerText || '';
        if (badge.includes('To do')) {
          const a = el.querySelector('.activityname a, a.aalink');
          if (a?.href && (a.href.includes('mod/resource') || a.href.includes('mod/url') || a.href.includes('mod/page'))) {
            try { fetch(a.href); } catch(e) {}
          }
        }
      });

      // Step C: Collect all pending gradable activities (Quizzes & H5P) that are NOT already Done
      moodleItems.forEach(el => {
        const titleEl = el.querySelector('.activityname, .instancename');
        const fullTitle = (titleEl ? titleEl.innerText : el.innerText).trim();
        const a = el.querySelector('a[href*="mod/quiz"], a[href*="mod/h5pactivity"], a[href*="mod/assign"], a.aalink');
        if (!a || !a.href) return;

        const isGradable = a.href.includes('mod/quiz') || a.href.includes('mod/h5pactivity') || a.href.includes('mod/assign');
        if (!isGradable) return;
        if (isExcluded(fullTitle)) return;

        // Strict Completion Check: Skip if already marked Done
        const badgeEl = el.querySelector('[data-region="completion-info"] button, [data-region="completion-info"] .badge, button[data-action="toggle-manual-completion"]');
        const badgeText = badgeEl ? (badgeEl.innerText || badgeEl.getAttribute('aria-label') || '').trim() : '';
        const isDone = /Done/i.test(badgeText) && !/Mark as done/i.test(badgeText);

        if (isDone) return; // Skip already completed assignments!

        if (!seen.has(a.href)) {
          seen.add(a.href);
          links.push({
            url: a.href,
            title: fullTitle.split('\n')[0].trim(),
            type: a.href.includes('mod/h5pactivity') ? 'H5P' : 'Quiz'
          });
        }
      });

      if (links.length > 0) return links;
    }

    // ── 1. IITM Online Degree / Angular Material Course Sidebar & Tree ──
    const iitmItems = Array.from(document.querySelectorAll(
      'a, [role="listitem"], [role="treeitem"], mat-list-item, .mat-mdc-list-item, div[class*="nav-item"], div[class*="sidebar"] div, div[class*="tree-node"], div[class*="assignment"]'
    )).filter(el => {
      if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
      const t = (el.innerText || '').toLowerCase();
      // Must be an assignment (skip videos, tutorials, reading)
      const isAsgn = t.includes('assignment') || t.includes('quiz') || t.includes('assessment') || t.includes('exam');
      if (!isAsgn) return false;
      if (isExcluded(t)) return false;
      return true;
    });

    // Check if there are explicitly "Graded" assignments
    const gradedOnly = iitmItems.filter(el => (el.innerText || '').toLowerCase().includes('graded'));
    const targetIITM = gradedOnly.length > 0 ? gradedOnly : iitmItems;

    targetIITM.forEach(el => {
      const title = el.innerText.trim().replace(/\s+/g, ' ');
      const anchor = el.tagName === 'A' ? el : el.querySelector('a') || el.closest('a');
      const url = anchor?.href || window.location.href;
      if (!seen.has(title)) {
        seen.add(title);
        links.push({
          element: el,
          url: url,
          title: title,
          isClickableElement: !anchor?.href || anchor.href === window.location.href || anchor.href.endsWith('#')
        });
      }
    });

    if (links.length > 0) return links;

    // ── 2. Canvas assignment links ──
    const canvasActivities = document.querySelectorAll('.assignment a, .ig-title a, .module-item-title a');
    canvasActivities.forEach(a => {
      if (a.href && (a.href.includes('/assignments/') || a.href.includes('/quizzes/'))) {
        const title = a.innerText?.trim() || 'Assignment';
        if (isExcluded(title)) return;
        if (!seen.has(a.href)) {
          seen.add(a.href);
          links.push({ url: a.href, title: title });
        }
      }
    });

    // ── 3. Google Classroom ──
    const classroomLinks = document.querySelectorAll('a[href*="courseWork"], a[href*="coursework"]');
    classroomLinks.forEach(a => {
      if (a.href) {
        const title = a.innerText?.trim() || 'Assignment';
        if (isExcluded(title)) return;
        links.push({ url: a.href, title: title });
      }
    });

    // Priority filter: If user has items explicitly named "graded", prefer ONLY graded assignments!
    const strictlyGraded = links.filter(l => l.title.toLowerCase().includes('graded'));
    if (strictlyGraded.length > 0) {
      return strictlyGraded;
    }

    return links;
  },

  // Find course links on a dashboard/home page
  findCourseLinks() {
    const links = [];
    const seen = new Set();
    // Moodle dashboard course list & all enrolled courses
    const moodleCourses = document.querySelectorAll('.course-listitem a, .coursename a, .course_title a, a[href*="course/view.php?id="], [data-region="course-card"] a');
    moodleCourses.forEach(a => {
      if (a.href && a.href.includes('course/view.php?id=')) {
        const cleanUrl = a.href.split('&')[0];
        if (!seen.has(cleanUrl)) {
          seen.add(cleanUrl);
          links.push({ url: cleanUrl, title: a.innerText?.trim() || 'Course' });
        }
      }
    });

    // Default enrolled course list fallback on edu.practicaleduskills.com
    if (window.location.hostname.includes('edu.practicaleduskills.com') && links.length === 0) {
      const defaultCourses = [
        { id: 22, title: 'Aspects of Marketing' },
        { id: 24, title: 'Budgeting and Personal Finance' },
        { id: 20, title: 'Digital Marketing Fundamental' },
        { id: 69, title: 'Environmental Education' },
        { id: 26, title: 'Communication And Professional Skills' },
        { id: 25, title: 'Fundamental Of Business & Management' },
        { id: 18, title: 'Gen AI Foundation' },
        { id: 68, title: 'Indian Knowledge System' }
      ];
      defaultCourses.forEach(c => {
        const url = `https://edu.practicaleduskills.com/course/view.php?id=${c.id}`;
        if (!seen.has(url)) {
          seen.add(url);
          links.push({ url, title: c.title });
        }
      });
    }
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
    if (!q) return { success: false, message: 'Invalid question' };

    // Dynamically update real question number
    const realNum = this.extractRealQuestionNumber(q.container);
    if (realNum) q.questionNum = realNum;

    q.container?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // STEP 0: Check for verified answer from Inertia data-page or LMS page state
    const verified = this.getVerifiedAnswer(q);
    if (verified) {
      updateStatus?.(`Applying verified answer...`);
      return await this.applyVerifiedAnswer(q, verified, updateStatus);
    }

    if (!q.text) return { success: false, message: 'Question text is empty' };
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
      for (let idx = 0; idx < q.options.length; idx++) {
        const opt = q.options[idx];
        const letter = String.fromCharCode(65 + idx);
        const shouldBeChecked = aiRes.letters.includes(letter) || aiRes.letters.includes(opt.letter?.toUpperCase());

        // Locate all possible interactable handles for this checkbox option (Angular MDC, generic, HTML)
        const baseEl = opt.element || opt.labelEl;
        const matCheckbox = baseEl?.closest('mat-checkbox, .mat-mdc-checkbox') || opt.labelEl?.closest('mat-checkbox, .mat-mdc-checkbox');
        const hostEl = matCheckbox ||
                       baseEl?.closest('[role="checkbox"], .quiz-option, li, label, .checkbox, .mdc-checkbox') ||
                       opt.labelEl?.closest('[role="checkbox"], label') ||
                       baseEl;
        const inputEl = (baseEl?.tagName === 'INPUT' ? baseEl : null) ||
                        hostEl?.querySelector('input[type="checkbox"]') ||
                        opt.labelEl?.querySelector('input[type="checkbox"]') ||
                        (opt.id ? document.querySelector(`input[id="${opt.id}"]`) : null);
        const labelEl = opt.labelEl ||
                        hostEl?.querySelector('label, .mdc-label') ||
                        (inputEl?.id ? document.querySelector(`label[for="${inputEl.id}"]`) : null) ||
                        hostEl;

        const checkCurrent = () => {
          return (inputEl && inputEl.checked) ||
                 hostEl?.classList.contains('mat-mdc-checkbox-checked') ||
                 hostEl?.classList.contains('mat-checkbox-checked') ||
                 matCheckbox?.classList.contains('mat-mdc-checkbox-checked') ||
                 hostEl?.getAttribute('aria-checked') === 'true' ||
                 hostEl?.getAttribute('data-state') === 'checked' ||
                 labelEl?.classList.contains('selected') ||
                 labelEl?.classList.contains('active');
        };

        let isChecked = checkCurrent();

        if (isChecked !== shouldBeChecked) {
          // Candidates to click in priority order:
          // In MDC/Angular Material, clicking the label or hostEl triggers the component controller
          const clickTargets = [labelEl, hostEl, matCheckbox, inputEl].filter(Boolean);
          const uniqueTargets = [...new Set(clickTargets)];

          for (const target of uniqueTargets) {
            try { target.focus?.(); } catch (e) {}
            const evts = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            for (const evtName of evts) {
              try {
                target.dispatchEvent(new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window }));
              } catch (e) {}
            }
            try { target.click?.(); } catch (e) {}

            // Check if state flipped
            isChecked = checkCurrent();
            if (isChecked === shouldBeChecked) break;
          }

          // Fallback if UI did not flip state automatically: force input state and dispatch events
          if (inputEl && inputEl.checked !== shouldBeChecked) {
            inputEl.checked = shouldBeChecked;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Visual class syncing for Angular Material / custom CSS
          const allHosts = [matCheckbox, hostEl].filter(Boolean);
          allHosts.forEach(mh => {
            if (shouldBeChecked) {
              mh.classList.add('mat-mdc-checkbox-checked', 'mat-checkbox-checked');
              mh.setAttribute('aria-checked', 'true');
            } else {
              mh.classList.remove('mat-mdc-checkbox-checked', 'mat-checkbox-checked');
              mh.setAttribute('aria-checked', 'false');
            }
          });
        }

        if (checkCurrent() || shouldBeChecked) checkedCount++;
        await new Promise(r => setTimeout(r, 60));
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
        const err = aiRes?.error || aiRes?.message || 'AI call failed';
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

      const radioBtn = target.element;
      radioBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      radioBtn.focus();

      const ariaLabelEl = radioBtn.getAttribute('aria-labelledby') ? document.getElementById(radioBtn.getAttribute('aria-labelledby')) : null;
      const parentOption = radioBtn.closest('.r0, .r1, li, label, .option, .quiz-options li, mat-radio-button, [role="radio"]') || radioBtn;
      const clickTargets = [target.labelEl, ariaLabelEl, parentOption, radioBtn].filter(Boolean);
      const uniqueTargets = [...new Set(clickTargets)];

      for (const t of uniqueTargets) {
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(evt => {
          try { t.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
        });
        try { t.click?.(); } catch (e) {}
      }

      if (radioBtn.tagName === 'INPUT') {
        radioBtn.checked = true;
        radioBtn.dispatchEvent(new Event('input', { bubbles: true }));
        radioBtn.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Re-verify radio was actually checked
      if (radioBtn.tagName === 'INPUT' && !radioBtn.checked) {
        radioBtn.checked = true;
        radioBtn.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const liParent = radioBtn.closest('li, .r0, .r1');
      if (liParent) {
        liParent.classList.add('selected');
      }
      target.checked = radioBtn.checked;
      q.isAnswered = radioBtn.checked;
      await new Promise(r => setTimeout(r, 200));

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

    // ── 6. Short Answer / Numerical / Text / NAT ──
    if (q.type === 'text' && q.textInput) {
      const isNAT = q.isNAT || 
        q.text.toLowerCase().includes('nat type') || 
        q.text.toLowerCase().includes('numerical') || 
        q.text.toLowerCase().includes('numeric') ||
        q.container?.innerText?.toLowerCase().includes('numeric') ||
        q.container?.innerText?.toLowerCase().includes('type : sa');

      // Extract portal hints and format constraints (e.g. "Only numeric input is accepted for this question.")
      let portalHint = '';
      const hintEls = q.container?.querySelectorAll('mat-hint, .mat-mdc-form-field-hint, [class*="hint"], .instruction, [class*="instruction"], [class*="helper"]') || [];
      hintEls.forEach(el => {
        const ht = (el.innerText || '').trim();
        if (ht) portalHint += ` ${ht}`;
      });
      const containerText = q.container?.innerText || '';
      const hintMatch = containerText.match(/Only numeric input is accepted[^\n.]*|Enter integer[^\n.]*|round(?:ed)? to \d+ decimal[^\n.]*/i);
      if (hintMatch && !portalHint.includes(hintMatch[0])) {
        portalHint += ` ${hintMatch[0]}`;
      }
      portalHint = portalHint.trim();

      // FALSE POSITIVE PROTECTION: If the input already contains a valid answer, NEVER overwrite it!
      const existingVal = (q.textInput.value || q.textInput.innerText || '').trim();
      if (existingVal.length > 0) {
        if (isNAT && /^[-+]?[0-9]+(?:\.[0-9]+)?$/.test(existingVal)) {
          updateStatus?.(`Kept existing answer: ${existingVal}`);
          q.isAnswered = true;
          return { success: true, answer: existingVal };
        }
      }

      let aiRes;
      if (isNAT) {
        updateStatus?.(`Calculating NAT numerical value...`);
        aiRes = await window.AIEngine.solveNATAnswer(q.text, q.image, portalHint);
      } else {
        aiRes = await window.AIEngine.solveBriefAnswer(q.text, q.image);
      }

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

        // Strict numeric formatting validation for NAT
        if (isNAT) {
          const numOnly = ans.match(/[-+]?[0-9]+(?:\.[0-9]+)?/);
          if (numOnly) {
            ans = numOnly[0];
          } else if (existingVal && /^[-+]?[0-9]+(?:\.[0-9]+)?$/.test(existingVal)) {
            // If AI returned non-numeric, retain existing valid numeric answer
            ans = existingVal;
          }

          // If text was empty/placeholder and model returned "0" due to lack of vision, reject dummy 0
          if (ans === '0' && q.text && q.text.includes('problem statement is displayed in the attached image')) {
            updateStatus?.('Vision AI needed for diagram question (use Gemini or Vision model)');
            return { success: false, message: 'Image-only question requires Vision AI' };
          }
        }

        if (!ans) {
          updateStatus?.('AI returned non-answer, skipping.');
          return { success: false, message: 'Invalid AI answer format' };
        }
        q.textInput.focus();
        if (q.textInput.isContentEditable) {
          q.textInput.innerText = ans;
        } else {
          const proto = q.textInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(q.textInput, ans);
          } else {
            q.textInput.value = ans;
          }
        }
        q.textInput.dispatchEvent(new Event('input', { bubbles: true }));
        q.textInput.dispatchEvent(new Event('change', { bubbles: true }));
        q.textInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        q.textInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        q.textInput.blur();
        q.isAnswered = true;
        updateStatus?.(`Answered: ${ans.slice(0, 25)}`);
        return { success: true, answer: ans };
      } else {
        return { 
          success: false, 
          rateLimited: !!aiRes?.rateLimited, 
          waitSec: aiRes?.waitSec || 7, 
          source: aiRes?.source,
          message: aiRes?.error || aiRes?.message || 'AI call failed' 
        };
      }
    }

    return { success: false, message: 'Unsupported question format' };
  },

  // Solves current/active question (Single click mode)
  async solve(updateStatus) {
    await this.ensureVerifiedPageAnswers();
    const currentQ = this.detectCurrentQuestion();
    if (!currentQ) {
      updateStatus?.('Could not detect question.');
      return { success: false, message: 'Could not detect question.' };
    }
    const realNum = this.extractRealQuestionNumber(currentQ.container);
    if (realNum) currentQ.questionNum = realNum;

    const res = await this.solveQuestionItem(currentQ, updateStatus);
    if (res && currentQ.questionNum !== undefined) {
      res.questionNum = currentQ.questionNum;
    }
    return res;
  },

  // ══════════════════════════════════════════════════════════════
  //  CORE: Solve all questions on the current page (shared logic)
  // ══════════════════════════════════════════════════════════════
  async _solveAllOnPage(updateStatus, isRunningCallback = () => true) {
    await this.ensureVerifiedPageAnswers();
    const questions = this.detectAllQuestions();
    if (!questions.length) {
      updateStatus?.('No questions found on this page.');
      return { questionsFound: false, allAnswered: false };
    }

    for (let i = 0; i < questions.length; i++) {
      if (!isRunningCallback()) return { questionsFound: true, allAnswered: false, stopped: true };
      const q = questions[i];
      const qNum = this.extractRealQuestionNumber(q.container) || q.questionNum || (i + 1);
      q.questionNum = qNum;

      if (q.isAnswered) continue;

      // Active live check: If question already has answer in DOM, don't call AI or waste tokens!
      if (q.textInput && (q.textInput.value || q.textInput.innerText || '').trim().length > 0) {
        q.isAnswered = true;
        updateStatus?.(`Q${qNum} already answered. Advancing…`);
        continue;
      }
      if (q.options && q.options.some(o => (o.element?.value !== '-1' && o.element?.value !== '') && (o.element?.checked || o.element?.getAttribute('aria-checked') === 'true' || o.labelEl?.closest('.mat-radio-checked, .mat-mdc-radio-checked')))) {
        q.isAnswered = true;
        updateStatus?.(`Q${qNum} choice already selected. Advancing…`);
        continue;
      }

      let answered = false;
      let attempts = 0;

      while (!answered && isRunningCallback() && attempts < 2) {
        attempts++;
        updateStatus?.(`Solving question ${qNum} of ${questions.length}...`);
        const res = await this.solveQuestionItem(q, updateStatus);

        if (res.success) {
          answered = true;
          q.isAnswered = true;
          break;
        }

        if (res.rateLimited) {
          let waitTime = Math.min(res.waitSec || 5, 10);
          const prov = res.source ? res.source.toUpperCase() : 'AI';
          while (waitTime > 0 && isRunningCallback()) {
            updateStatus?.(`⏳ ${prov} limit: waiting ${waitTime}s to solve Q${qNum}...`);
            await new Promise(r => setTimeout(r, 1000));
            waitTime--;
          }
          continue;
        }

        // Check if error is an AI provider / network failure
        const isApiFailure = res.message && (
          res.message.includes('Groq error') ||
          res.message.includes('HTTP 404') ||
          res.message.includes('HTTP 401') ||
          res.message.includes('Invalid API Key') ||
          res.message.includes('All AI engines unavailable') ||
          res.message.includes('key missing') ||
          res.message.includes('AI call failed') ||
          res.message.includes('Failed to fetch')
        );

        if (isApiFailure) {
          // NEVER skip questions on API failure! Pause cleanly so student never loses marks.
          updateStatus?.(`⚠️ Auto-Pilot paused: ${res.message.slice(0, 48)}`);
          return { questionsFound: true, allAnswered: false, stopped: true, error: res.message };
        }

        if (res.message && (res.message.includes('Unsupported') || res.message.includes('Could not match'))) {
          updateStatus?.(`⚠️ Q${qNum}: ${res.message}. Auto-Pilot paused.`);
          return { questionsFound: true, allAnswered: false, stopped: true, error: res.message };
        }

        if (attempts >= 2) {
          updateStatus?.(`⚠️ Q${qNum} unresolved. Auto-Pilot paused.`);
          return { questionsFound: true, allAnswered: false, stopped: true };
        }

        updateStatus?.(`Retrying Q${qNum}... (${(res.message || 'error').slice(0, 30)})`);
        await new Promise(r => setTimeout(r, 1200));
      }

      if (!isRunningCallback()) return { questionsFound: true, allAnswered: false, stopped: true };

      // Brief delay between questions
      await new Promise(r => setTimeout(r, 600));
    }

    // Strict DOM verification: Check if an answer is ACTUALLY checked/entered in the DOM
    const unanswered = this.detectAllQuestions().filter(q => {
      if (q.type === 'mcq') {
        const checkedInput = q.container?.querySelector('input[type="radio"]:checked:not([value="-1"])');
        if (checkedInput) return false;
        return !q.options?.some(o => o.checked || (o.element?.checked && o.element?.value !== '-1'));
      }
      if (q.type === 'multichoice') {
        const checkedInput = q.container?.querySelector('input[type="checkbox"]:checked:not([value="-1"])');
        if (checkedInput) return false;
        return !q.options?.some(o => o.checked || (o.element?.checked && o.element?.value !== '-1'));
      }
      if (q.type === 'text') {
        return !(q.textInput && (q.textInput.value || q.textInput.innerText || '').trim().length > 0);
      }
      return !q.isAnswered;
    });

    return { questionsFound: true, allAnswered: unanswered.length === 0, unansweredCount: unanswered.length };
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: DRAFT ONLY — Solve questions across all pages, never submit
  // ══════════════════════════════════════════════════════════════
  async _runDraftMode(updateStatus, isRunningCallback = () => true) {
    let pagesProcessed = 0;
    let consecutiveEmptyCount = 0;

    while (isRunningCallback() && pagesProcessed < 50) {
      pagesProcessed++;

      // Check current question & total questions from header, title or question element
      let currentQNum = pagesProcessed;
      let totalQNum = null;

      const titleMatch = document.title.match(/page\s+(\d+)\s+of\s+(\d+)/i);
      if (titleMatch) {
        currentQNum = parseInt(titleMatch[1], 10);
        totalQNum = parseInt(titleMatch[2], 10);
      } else {
        const headerMatch = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
        if (headerMatch) {
          currentQNum = parseInt(headerMatch[1], 10);
          totalQNum = parseInt(headerMatch[2], 10);
        } else {
          const qnoEl = document.querySelector('.qno');
          if (qnoEl) currentQNum = parseInt(qnoEl.innerText.trim(), 10) || pagesProcessed;
        }
      }
      const label = totalQNum ? `Question ${currentQNum} of ${totalQNum}` : `Page ${currentQNum}`;

      updateStatus?.(`[Draft] Scanning ${label}…`);
      let result = await this._solveAllOnPage(updateStatus, isRunningCallback);
      if (!isRunningCallback()) return;

      // Angular SPA rendering retry
      if (!result.questionsFound) {
        await new Promise(r => setTimeout(r, 1200));
        result = await this._solveAllOnPage(updateStatus, isRunningCallback);
        if (!isRunningCallback()) return;
      }

      if (!result.questionsFound) {
        consecutiveEmptyCount++;
        // If we know there are more questions (e.g. on Question 5 of 17), DO NOT ABORT!
        if (totalQNum && currentQNum < totalQNum) {
          updateStatus?.(`⚠️ Q${currentQNum} not resolved. Advancing to Q${currentQNum + 1}…`);
        } else if (consecutiveEmptyCount >= 2) {
          updateStatus?.('No questions detected. Auto-pilot finished.');
          await chrome.storage.local.remove(['autopilotBatchState']);
          return;
        }
      } else {
        consecutiveEmptyCount = 0;
        if (!result.allAnswered) {
          updateStatus?.(`⚠️ Question unresolved on ${label}. Auto-Pilot paused.`);
          return;
        }
      }

      // If we have answered or scanned the final question, stop cleanly
      const isLastQuestion = totalQNum && currentQNum >= totalQNum;
      if (isLastQuestion) {
        await chrome.storage.local.remove(['autopilotBatchState']);
        updateStatus?.(`✅ All ${totalQNum} questions drafted! Review and submit manually.`);
        return;
      }

      // Check for Next page button or Question Palette button (wait up to 3.5s for async validation/API checks)
      let nextBtn = this.findNextButton() || this.findNextPaletteButton();
      if (!nextBtn) {
        const pollStart = Date.now();
        while (Date.now() - pollStart < 3500 && isRunningCallback()) {
          await new Promise(r => setTimeout(r, 250));
          nextBtn = this.findNextButton() || this.findNextPaletteButton();
          if (nextBtn) break;
        }
      }

      if (nextBtn) {
        updateStatus?.(`[Draft] Question ${currentQNum} answered. Advancing…`);
        const state = { active: true, mode: 'draft' };
        await chrome.storage.local.set({ autopilotBatchState: state });

        nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        
        // Clean single click on next button without triggering double keyboard advances
        const innerTarget = nextBtn.querySelector('.mdc-button__label, .mat-mdc-button-touch-target') || nextBtn;
        try { innerTarget.focus?.(); } catch (e) {}
        try { innerTarget.click?.(); } catch (e) {}
        if (nextBtn !== innerTarget) {
          try { nextBtn.focus?.(); } catch (e) {}
          try { nextBtn.click?.(); } catch (e) {}
        }

        // Wait for SPA to transition question cleanly without jumping
        const startQNum = currentQNum;
        let navWaited = 0;
        while (navWaited < 2500 && isRunningCallback()) {
          await new Promise(r => setTimeout(r, 150));
          navWaited += 150;
          const currentHeader = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
          const newQNum = currentHeader ? parseInt(currentHeader[1], 10) : startQNum;
          if (newQNum > startQNum) break;
        }
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      // Fallback for SPAs that only support keyboard arrows or have disabled next buttons
      if (totalQNum && currentQNum < totalQNum) {
        const disabledNext = this.findNextButton({ includeDisabled: true });
        if (disabledNext) {
          updateStatus?.(`Waiting for Next button to activate on Q${currentQNum}…`);
          let waited = 0;
          while (waited < 3000 && (disabledNext.disabled || disabledNext.hasAttribute('disabled')) && isRunningCallback()) {
            await new Promise(r => setTimeout(r, 300));
            waited += 300;
          }
          if (!disabledNext.disabled && !disabledNext.hasAttribute('disabled')) {
            disabledNext.click();
            await new Promise(r => setTimeout(r, 1600));
            continue;
          }
        }

        updateStatus?.(`[Draft] Advancing to Q${currentQNum + 1}…`);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true }));
        const startQNum = currentQNum;
        let navWaited = 0;
        while (navWaited < 2500 && isRunningCallback()) {
          await new Promise(r => setTimeout(r, 150));
          navWaited += 150;
          const currentHeader = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
          const newQNum = currentHeader ? parseInt(currentHeader[1], 10) : startQNum;
          if (newQNum > startQNum) break;
        }
        await new Promise(r => setTimeout(r, 400));

        const postMatch = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
        const postQNum = postMatch ? parseInt(postMatch[1], 10) : currentQNum;
        if (postQNum > currentQNum) {
          continue;
        }

        updateStatus?.(`⚠️ Q${currentQNum} answered, but could not advance to Q${currentQNum + 1}. Auto-Pilot paused.`);
        return;
      }

      // Reached final page
      await chrome.storage.local.remove(['autopilotBatchState']);
      updateStatus?.('✅ All questions drafted across all pages! Review and submit manually.');
      return;
    }
  },

  // ══════════════════════════════════════════════════════════════
  //  MODE: FULL SUBMIT — Solve + navigate + submit with confirm
  // ══════════════════════════════════════════════════════════════
  async _runSubmitMode(updateStatus, isRunningCallback = () => true) {
    let pagesProcessed = 0;
    let consecutiveEmptyCount = 0;

    while (isRunningCallback() && pagesProcessed < 50) {
      pagesProcessed++;

      // Check if quiz is already complete
      if (this.isQuizComplete()) {
        updateStatus?.('✅ Quiz submitted and complete! 🎉');
        return;
      }

      const headerMatch = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
      const currentQNum = headerMatch ? parseInt(headerMatch[1], 10) : pagesProcessed;
      const totalQNum = headerMatch ? parseInt(headerMatch[2], 10) : null;
      const label = totalQNum ? `Question ${currentQNum} of ${totalQNum}` : `Page ${pagesProcessed}`;

      updateStatus?.(`[Submit] Scanning ${label}…`);
      let result = await this._solveAllOnPage(updateStatus, isRunningCallback);
      if (!isRunningCallback()) return;

      if (!result.questionsFound) {
        await new Promise(r => setTimeout(r, 1200));
        result = await this._solveAllOnPage(updateStatus, isRunningCallback);
        if (!isRunningCallback()) return;
      }

      if (!result.questionsFound) {
        consecutiveEmptyCount++;
        if (totalQNum && currentQNum < totalQNum) {
          updateStatus?.(`⚠️ Q${currentQNum} not resolved. Advancing…`);
        } else if (consecutiveEmptyCount >= 2) {
          // Check for submit button on summary page
          const submitBtn = this.findSubmitButton() || this.findConfirmSubmitButton();
          if (submitBtn) {
            updateStatus?.('[Submit] Found submit button on summary page. Submitting…');
            submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 600));
            submitBtn.click();
            await new Promise(r => setTimeout(r, 3000));

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
          }
          updateStatus?.('No questions found. Quiz may already be complete.');
          return;
        }
      } else {
        consecutiveEmptyCount = 0;
        if (!result.allAnswered) {
          updateStatus?.(`⚠️ Question unresolved on ${label}. Auto-Pilot paused.`);
          return;
        }
      }

      // If not on final question, advance
      const isLastQuestion = totalQNum && currentQNum >= totalQNum;
      if (!isLastQuestion) {
        let nextBtn = this.findNextButton() || this.findNextPaletteButton();
        if (!nextBtn) {
          const pollStart = Date.now();
          while (Date.now() - pollStart < 3500 && isRunningCallback()) {
            await new Promise(r => setTimeout(r, 250));
            nextBtn = this.findNextButton() || this.findNextPaletteButton();
            if (nextBtn) break;
          }
        }

        if (nextBtn) {
          updateStatus?.(`[Submit] Question ${currentQNum} answered. Advancing…`);
          nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 300));
          
          const innerTarget = nextBtn.querySelector('.mdc-button__label, .mat-mdc-button-touch-target') || nextBtn;
          try { innerTarget.focus?.(); } catch (e) {}
          try { innerTarget.click?.(); } catch (e) {}
          if (nextBtn !== innerTarget) {
            try { nextBtn.focus?.(); } catch (e) {}
            try { nextBtn.click?.(); } catch (e) {}
          }

          const startQNum = currentQNum;
          let navWaited = 0;
          while (navWaited < 2500 && isRunningCallback()) {
            await new Promise(r => setTimeout(r, 150));
            navWaited += 150;
            const currentHeader = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
            const newQNum = currentHeader ? parseInt(currentHeader[1], 10) : startQNum;
            if (newQNum > startQNum) break;
          }
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        if (totalQNum && currentQNum < totalQNum) {
          const disabledNext = this.findNextButton({ includeDisabled: true });
          if (disabledNext) {
            updateStatus?.(`Waiting for Next button to activate on Q${currentQNum}…`);
            let waited = 0;
            while (waited < 3000 && (disabledNext.disabled || disabledNext.hasAttribute('disabled')) && isRunningCallback()) {
              await new Promise(r => setTimeout(r, 300));
              waited += 300;
            }
            if (!disabledNext.disabled && !disabledNext.hasAttribute('disabled')) {
              disabledNext.click();
              await new Promise(r => setTimeout(r, 1600));
              continue;
            }
          }

          updateStatus?.(`[Submit] Advancing to Q${currentQNum + 1}…`);
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true }));
          const startQNum = currentQNum;
          let navWaited = 0;
          while (navWaited < 2500 && isRunningCallback()) {
            await new Promise(r => setTimeout(r, 150));
            navWaited += 150;
            const currentHeader = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
            const newQNum = currentHeader ? parseInt(currentHeader[1], 10) : startQNum;
            if (newQNum > startQNum) break;
          }
          await new Promise(r => setTimeout(r, 400));

          const postMatch = document.body.innerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
          const postQNum = postMatch ? parseInt(postMatch[1], 10) : currentQNum;
          if (postQNum > currentQNum) {
            continue;
          }

          updateStatus?.(`⚠️ Q${currentQNum} answered, but could not advance to Q${currentQNum + 1}. Auto-Pilot paused.`);
          return;
        }
      }

      // Final question reached: ONLY search for submit if isLastQuestion is true or totalQNum is unknown
      if (isLastQuestion || !totalQNum) {
        const submitBtn = this.findSubmitButton();
        if (submitBtn) {
          updateStatus?.('[Submit] All questions answered. Submitting assessment…');
          submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 600));
          submitBtn.click();
          await new Promise(r => setTimeout(r, 1500));

          const confirmBtn = this.findConfirmSubmitButton(submitBtn);
          if (confirmBtn) {
            updateStatus?.('[Submit] Confirming final submission…');
            await new Promise(r => setTimeout(r, 500));
            confirmBtn.click();
            await new Promise(r => setTimeout(r, 1500));
          }

          updateStatus?.('✅ Assessment submitted and complete! 🎉');
          return;
        }

        // Nothing to click — we're done
        updateStatus?.('✅ All questions answered! No submit button found — review manually.');
        return;
      }
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

        // If on an SPA sidebar (IITM Study)
        const sidebarTarget = Array.from(document.querySelectorAll('a, [role="listitem"], mat-list-item, div[class*="nav-item"], div[class*="sidebar"] div, div[class*="tree-node"]')).find(el => {
          const t = el.innerText ? el.innerText.trim().replace(/\s+/g, ' ') : '';
          return t && (t === nextAsgn.title || t.includes(nextAsgn.title) || nextAsgn.title.includes(t));
        });

        if (sidebarTarget && (!nextAsgn.url || nextAsgn.url === window.location.href || nextAsgn.isClickableElement)) {
          sidebarTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sidebarTarget.click();
          await new Promise(r => setTimeout(r, 2000));
          await this.resumePersistentBatch(updateStatus, () => true);
          return;
        }

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

      // ── Page State 0: H5P Interactive Activity (Flashcards / Crosswords) ──
      if (window.H5PSolver && window.H5PSolver.hasH5P()) {
        const badgeEl = document.querySelector('[data-region="completion-info"] button, [data-region="completion-info"] .badge, button[data-action="toggle-manual-completion"]');
        const badgeText = badgeEl ? (badgeEl.innerText || badgeEl.getAttribute('aria-label') || '').trim() : '';
        const isAlreadyDone = /Done/i.test(badgeText) && !/Mark as done/i.test(badgeText);

        if (isAlreadyDone) {
          updateStatus?.(`${modeTag} H5P activity already complete. Advancing to next…`);
          await new Promise(r => setTimeout(r, 1000));
          await this.advanceBatchAssignment(updateStatus);
          return;
        }

        updateStatus?.(`${modeTag} Solving H5P interactive activity…`);
        const h5pRes = await window.H5PSolver.solve(updateStatus);

        // Toggle manual completion button if present
        const manualBtn = document.querySelector('button[data-action="toggle-manual-completion"]');
        if (manualBtn && (manualBtn.innerText.includes('Mark as done') || manualBtn.getAttribute('data-toggletype') === 'manual:mark-done')) {
          try { manualBtn.click(); } catch(e) {}
          await new Promise(r => setTimeout(r, 600));
        }

        if (h5pRes?.success) {
          updateStatus?.(`${modeTag} H5P activity completed! Advancing to next assignment…`);
          await new Promise(r => setTimeout(r, 1500));
          await this.advanceBatchAssignment(updateStatus);
          return;
        }
      }

      // ── Page State 1: Active Quiz Attempt (questions on page) ──
      const questions = this.detectAllQuestions();
      if (questions.length > 0) {
        if (state.mode === 'draft') {
          updateStatus?.('[Draft] Resuming questions on next page…');
          await this._runDraftMode(updateStatus, isRunningCallback);
          return;
        }

        updateStatus?.(`${modeTag} Solving questions on attempt page…`);
        await this._runSubmitMode(updateStatus, isRunningCallback);

        // After submit mode finishes or submits:
        if (this.isQuizComplete() || window.location.href.includes('/mod/quiz/review.php')) {
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
    try { await this.ensureVerifiedPageAnswers(); } catch (e) {}

    // Mode 1: Draft Only (advances across all pages, never submits final attempt)
    if (mode === 'draft') {
      const state = {
        active: true,
        mode: 'draft'
      };
      await chrome.storage.local.set({ autopilotBatchState: state });
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
