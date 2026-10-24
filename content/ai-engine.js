// AI Engine (content script side)
// Proxies AI calls through the background service worker to access Pollinations.ai / Chrome Nano / Gemini Key.
window.AIEngine = {

  async checkNanoAvailability() {
    try {
      return await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'CHECK_AI_STATUS' }, (res) => {
          if (chrome.runtime.lastError) return resolve('hybrid');
          resolve(res?.status || 'hybrid');
        });
      });
    } catch (e) {
      return 'hybrid';
    }
  },

  // Convert an image element or URL to base64 for Vision AI
  async imageToBase64(imgEl) {
    try {
      if (!imgEl) return null;

      // Already a data URL
      if (imgEl.src?.startsWith('data:image')) {
        const [header, data] = imgEl.src.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        return { data, mimeType: mime };
      }

      // Fetch blob if URL
      if (imgEl.src?.startsWith('http')) {
        try {
          const res = await fetch(imgEl.src);
          const blob = await res.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });
          return { data: base64, mimeType: blob.type || 'image/png' };
        } catch (e) {}
      }

      // Canvas fallback
      const canvas = document.createElement('canvas');
      canvas.width  = imgEl.naturalWidth  || imgEl.width  || 400;
      canvas.height = imgEl.naturalHeight || imgEl.height || 300;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      return { data: dataUrl.split(',')[1], mimeType: 'image/png' };
    } catch (e) {
      return null;
    }
  },

  // Core answer generator
  async generateAnswer(prompt, imageBase64 = null, systemInstruction = null) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'CALL_AI',
            prompt,
            imageBase64,
            systemInstruction
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false, error: 'No response from service worker' });
            }
          }
        );
      });

      if (response?.success && response?.text) {
        console.log(`[Autopilot AI] Answer via: ${response.source}`);
        return { 
          success: true, 
          text: response.text.trim(),
          source: response.source,
          warningNotice: response.warningNotice
        };
      }

      console.warn('[Autopilot AI] AI failed:', response?.error);
      return { 
        success: false, 
        rateLimited: !!response?.rateLimited, 
        waitSec: response?.waitSec || 30, 
        error: response?.error || 'Unknown AI error',
        warningNotice: response?.warningNotice
      };
    } catch (err) {
      console.warn('[Autopilot AI] generateAnswer error:', err);
      return { success: false, error: err.message };
    }
  },

  // MCQ solver with Vision & flexible letter/text parsing
  async solveMCQ(questionText, options, imgElement = null) {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    const maxLetter = String.fromCharCode(65 + options.length - 1);
    const formattedOptions = options
      .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.text}`)
      .join('\n');

    let prompt = `Question:\n${questionText}\n\nOptions:\n${formattedOptions}\n\n`;
    if (imageBase64) {
      prompt += `Note: An image or diagram containing mathematical formulas/graphs is attached to this question. Inspect it with extreme precision.\n\n`;
    }
    prompt += `Task: Evaluate the question with rigorous academic and mathematical accuracy. Verify equations, constraints, and domains.\n` +
      `Respond ONLY with the single uppercase option letter (from A to ${maxLetter}). Do not include any explanations or extra words.`;

    const result = await this.generateAnswer(
      prompt,
      imageBase64,
      `You are an expert academic and STEM exam solver. Output ONLY the single option letter from A to ${maxLetter}.`
    );

    if (!result?.success) {
      return { 
        success: false, 
        rateLimited: !!result?.rateLimited, 
        waitSec: result?.waitSec || 30, 
        error: result?.error || 'AI call failed',
        warningNotice: result?.warningNotice
      };
    }

    let answer = result.text;
    if (answer) {
      if (answer.includes('<think>')) {
        answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      if (answer.startsWith('{') && (answer.includes('"answer"') || answer.includes('"letter"') || answer.includes('"content"'))) {
        try {
          const parsed = JSON.parse(answer);
          answer = parsed.letter || parsed.answer || parsed.content || answer;
        } catch (e) {}
      }

      // 1. Strict single letter regex
      const letterRegex = new RegExp(`\\b([A-${maxLetter}])\\b`, 'i');
      const letterMatch = answer.match(letterRegex);
      if (letterMatch) return { success: true, letter: letterMatch[1].toUpperCase(), warningNotice: result.warningNotice };

      // 2. Match answer text against option text
      const cleanAns = answer.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      for (let i = 0; i < options.length; i++) {
        const cleanOpt = options[i].text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
        if (cleanOpt.length > 2 && (cleanAns.includes(cleanOpt) || cleanOpt.includes(cleanAns))) {
          return { success: true, letter: String.fromCharCode(65 + i), warningNotice: result.warningNotice };
        }
      }

      // 3. Fallback: first letter found
      const anyMatch = answer.match(/[A-Z]/i);
      if (anyMatch) return { success: true, letter: anyMatch[0].toUpperCase(), warningNotice: result.warningNotice };
    }
    return { success: false, error: 'Could not extract answer letter', warningNotice: result.warningNotice };
  },

  // Short answer solver for open-ended or fill-in-the-blank questions
  async solveBriefAnswer(questionText, imgElement = null) {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    let prompt = `Question:\n"${questionText}"\n\n`;
    if (imageBase64) {
      prompt += `Note: An image containing the question, diagram, or formula is attached. Inspect all values carefully.\n\n`;
    }
    prompt += `Provide the exact, concise answer (one word, short phrase, or exact numerical/code value). No preamble, no quotes, no JSON markup. Output ONLY the answer directly.`;

    const res = await this.generateAnswer(
      prompt,
      imageBase64,
      'You are a high-scoring academic exam solver. Output ONLY the answer string directly, never JSON, markdown, or reasoning.'
    );

    if (res?.success && res.text) {
      let clean = res.text.trim();
      if (clean.includes('<think>')) {
        clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }

      // If output is raw JSON string like {"role":"assistant", ...}
      if (clean.startsWith('{') && (clean.includes('"role"') || clean.includes('"content"') || clean.includes('"reasoning"'))) {
        try {
          const parsed = JSON.parse(clean);
          if (parsed.content) clean = parsed.content.trim();
          else if (parsed.answer) clean = parsed.answer.trim();
          else if (parsed.result) clean = parsed.result.trim();
          else if (parsed.reasoning) {
            const match = parsed.reasoning.match(/(?:answer(?: is)?|likely)[:\s]*["']?([a-zA-Z0-9_\s-]+)["']?/i);
            if (match) clean = match[1].trim();
            else {
              const words = parsed.reasoning.split(/\s+/).filter(Boolean);
              clean = words[words.length - 1]?.replace(/[^a-zA-Z0-9]/g, '') || clean;
            }
          }
        } catch (e) {}
      }

      // Remove surrounding quotes if model added them
      clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();
      return { success: true, text: clean };
    }

    return res;
  },

  // Numerical Answer Type (NAT) solver for STEM and math problems (IITM NAT format)
  async solveNATAnswer(questionText, imgElement = null, portalHint = '') {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    const prompt = `CRITICAL TASK: NUMERICAL ANSWER TYPE (NAT) QUESTION.\n\n` +
      `Question:\n"${questionText}"\n\n` +
      (portalHint ? `SYSTEM CONSTRAINTS & PORTAL HINTS:\n${portalHint}\nYou MUST strictly adhere to this format!\n\n` : '') +
      (imageBase64 ? `Note: An image containing mathematical equations, matrices, or diagrams is attached. Read all symbols and coefficients carefully.\n\n` : '') +
      `INSTRUCTIONS:\n` +
      `1. Perform rigorous step-by-step mathematical reasoning to solve the problem accurately.\n` +
      `2. Compute the exact final value (algebraic simplification, arithmetic, calculus, geometry, or graph properties).\n` +
      `3. On the very last line, write ONLY the final computed number (e.g., "-2", "4", "0.75", "12"). No words, no units, no variable names on that line.`;

    const result = await this.generateAnswer(
      prompt,
      imageBase64,
      'You are an expert academic STEM exam solver. Solve the math accurately with step-by-step reasoning, then provide ONLY the raw final numerical value on the final line.'
    );

    if (result?.success && result.text) {
      let clean = result.text.trim().replace(/^["'`]+|["'`]+$/g, '');
      if (clean.includes('<think>')) {
        clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      if (clean.startsWith('{') && (clean.includes('"role"') || clean.includes('"content"') || clean.includes('"reasoning"') || clean.includes('"answer"'))) {
        try {
          const parsed = JSON.parse(clean);
          clean = String(parsed.content || parsed.answer || parsed.result || clean).trim();
        } catch (e) {}
      }

      // 1. Check from bottom line up for standalone exact number line
      const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        let stripped = lines[i].replace(/^[a-zA-Z_]\s*=\s*/, '').replace(/^(?:the\s+)?(?:final\s+)?(?:value\s+of\s+[a-zA-Z_]+\s+is|answer\s*is|answer:)\s*/i, '').trim();
        if (/^[-+]?[0-9]+(?:\.[0-9]+)?$/.test(stripped)) {
          return { success: true, text: stripped, warningNotice: result.warningNotice };
        }
      }

      // 2. Extract the last valid number in the text (the final conclusion)
      const allNums = Array.from(clean.matchAll(/[-+]?[0-9]+(?:\.[0-9]+)?/g)).map(m => m[0]);
      if (allNums.length > 0) {
        let lastVal = allNums[allNums.length - 1];
        if (lastVal.endsWith('.')) lastVal = lastVal.slice(0, -1);
        return { success: true, text: lastVal, warningNotice: result.warningNotice };
      }

      return { success: false, message: 'AI did not produce a numerical answer' };
    }
    return result;
  },

  // Multi-choice solver (Select all that apply / checkboxes / MSQ) with Deep Effort & Self-Verification
  async solveMultiChoice(questionText, options, imgElement = null) {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    const formattedOptions = options
      .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.text}`)
      .join('\n');

    // PASS 1: Step-by-Step Mathematical & Logical Evaluation of Each Option
    const pass1Prompt = `CRITICAL TASK: MULTIPLE SELECT QUESTION (MSQ / "Select all that apply").\n\n` +
      `Question Problem Statement:\n"${questionText}"\n\n` +
      `Options:\n${formattedOptions}\n\n` +
      (imageBase64 ? `Note: A diagram or schematic is attached. Inspect all coordinates, curves, conditions, and labels carefully.\n\n` : '') +
      `INSTRUCTIONS FOR MAXIMUM ACADEMIC ACCURACY:\n` +
      `1. In university STEM exams (such as IITM / GATE / JEE), MSQs often have 1, 2, 3, or ALL options (${options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}) correct!\n` +
      `2. You MUST evaluate and calculate EACH option independently. For each option:\n` +
      `   - Calculate the derivative, slope, discriminant, or mathematical definition.\n` +
      `   - Test for potential counterexamples or domain constraints.\n` +
      `   - Conclude whether that individual option is definitively TRUE or FALSE.\n` +
      `3. Provide your conclusion on the final line in this exact format:\n` +
      `FINAL_ANSWERS: <comma-separated uppercase letters of ALL true choices, e.g. A, C, D>`;

    const pass1Result = await this.generateAnswer(
      pass1Prompt,
      imageBase64,
      `You are an expert academic STEM exam solver. In multi-select questions, evaluate every single choice independently with step-by-step reasoning. Conclude with 'FINAL_ANSWERS: <letters>'.`
    );

    if (!pass1Result?.success) {
      return { 
        success: false, 
        rateLimited: !!pass1Result?.rateLimited, 
        waitSec: pass1Result?.waitSec || 30, 
        error: pass1Result?.error || 'AI call failed',
        warningNotice: pass1Result?.warningNotice
      };
    }

    const pass1Letters = this.parseMSQLetters(pass1Result.text || '', options.length);

    // PASS 2: Double-Check / Verification Pass (Auditing the candidate options)
    let finalLetters = pass1Letters;

    try {
      const auditPrompt = `DOUBLE-CHECK & VERIFICATION AUDIT FOR MULTIPLE CHOICE QUESTION:\n\n` +
        `Question:\n"${questionText}"\n\n` +
        `Options:\n${formattedOptions}\n\n` +
        `Initial Proposed Answers: ${pass1Letters.length > 0 ? pass1Letters.join(', ') : 'None'}\n\n` +
        `AUDIT CHECKLIST:\n` +
        `1. Carefully re-verify each proposed option (${pass1Letters.join(', ')}). Are any actually FALSE due to strict domain constraints (e.g., real roots vs complex roots, discriminant signs, vertex formula)?\n` +
        `2. Carefully inspect the omitted options (${options.map((_, i) => String.fromCharCode(65 + i)).filter(l => !pass1Letters.includes(l)).join(', ')}). Were any mistakenly marked false?\n` +
        `3. State your final verified conclusion on the last line:\n` +
        `FINAL_VERIFIED: <comma-separated letters of all true options>`;

      const pass2Result = await this.generateAnswer(
        auditPrompt,
        imageBase64,
        `You are a strict academic exam auditor. Double-check the proposed answers for edge cases and errors. Output ONLY the final verified list on the last line as 'FINAL_VERIFIED: <letters>'.`
      );

      if (pass2Result?.success && pass2Result.text) {
        const pass2Letters = this.parseMSQLetters(pass2Result.text, options.length);
        if (pass2Letters.length > 0) {
          finalLetters = pass2Letters;
        }
      }
    } catch (auditErr) {
      console.warn('[AIEngine] Double-check pass error (falling back to pass 1):', auditErr);
    }

    if (finalLetters.length > 0) {
      return { success: true, letters: finalLetters, warningNotice: pass1Result.warningNotice };
    }

    // Safety fallback: If parsing found 0 letters, run single MCQ solver
    const singleRes = await this.solveMCQ(questionText, options, imgElement);
    if (singleRes?.success && singleRes.letter) {
      return { success: true, letters: [singleRes.letter], warningNotice: pass1Result.warningNotice };
    }

    return { success: false, error: 'Could not extract answer letters from MSQ evaluation', warningNotice: pass1Result.warningNotice };
  },

  // Robust MSQ letter extractor avoiding false positive letter hits from negative explanations
  parseMSQLetters(answer, optionsCount) {
    if (!answer) return [];
    let clean = answer;
    if (clean.includes('<think>')) {
      clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    const validLetters = new Set();
    for (let i = 0; i < optionsCount; i++) validLetters.add(String.fromCharCode(65 + i));

    // 1. JSON parsing (nested safe using indexOf/lastIndexOf)
    try {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
        const list = parsed.final_correct_options || parsed.final_answers || parsed.correct || parsed.answers || parsed.options;
        if (Array.isArray(list) && list.length > 0) {
          const res = list.map(x => String(x).trim().toUpperCase()).filter(l => validLetters.has(l));
          if (res.length > 0) return Array.from(new Set(res)).sort();
        }
        if (parsed.evaluations && typeof parsed.evaluations === 'object') {
          const res = [];
          for (const [k, v] of Object.entries(parsed.evaluations)) {
            const up = k.trim().toUpperCase();
            if (validLetters.has(up) && (v === true || String(v).toLowerCase() === 'true')) res.push(up);
          }
          if (res.length > 0) return Array.from(new Set(res)).sort();
        }
      }
    } catch (e) {}

    // 2. Explicit Final Marker (FINAL_VERIFIED, FINAL_ANSWERS, FINAL_CORRECT_OPTIONS, etc.)
    const markerRegex = /(?:FINAL_VERIFIED|FINAL_ANSWERS|FINAL_CORRECT_OPTIONS|CORRECT\s*OPTIONS?|FINAL\s*ANSWER)\s*[:=\-]\s*([^\n\r]+)/i;
    const markerMatch = clean.match(markerRegex);
    if (markerMatch) {
      const segment = markerMatch[1];
      const letters = (segment.match(/\b([A-Z])\b/g) || []).map(l => l.toUpperCase()).filter(l => validLetters.has(l));
      if (letters.length > 0) return Array.from(new Set(letters)).sort();
    }

    // 3. Scan the last 3 non-empty lines for concluding sentences
    const lines = clean.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (let idx = lines.length - 1; idx >= Math.max(0, lines.length - 3); idx--) {
      const line = lines[idx];
      if (/(?:therefore|hence|correct|answers?|options?|select|choices?)/i.test(line) || /^[A-E\s,\.\[\]\(\)\&]+$/i.test(line)) {
        if (!/(?:are\s+false|is\s+false|are\s+incorrect|is\s+incorrect)/i.test(line)) {
          const letters = (line.match(/\b([A-Z])\b/g) || []).map(l => l.toUpperCase()).filter(l => validLetters.has(l));
          if (letters.length > 0) return Array.from(new Set(letters)).sort();
        }
      }
    }

    // 4. Option-by-option evaluation pattern: "Option A: True", "Option B: False"
    const evalMatches = [];
    for (const letter of validLetters) {
      const reg = new RegExp(`(?:Option|Choice)?\\s*\\(?${letter}\\)?[\\s:\\.-]+(True|Correct|Valid|False|Incorrect|Invalid)`, 'i');
      const m = clean.match(reg);
      if (m && /true|correct|valid/i.test(m[1])) {
        evalMatches.push(letter);
      }
    }
    if (evalMatches.length > 0) return Array.from(new Set(evalMatches)).sort();

    // 5. "All of the above" / "All are correct"
    const lowerAnswer = clean.toLowerCase();
    if (lowerAnswer.includes('all of the above') || lowerAnswer.includes('all are correct') || lowerAnswer.includes('all options are correct')) {
      return Array.from(validLetters).sort();
    }

    return [];
  },

  // Fill-in-the-blanks / Drag-and-drop solver for sentences with blanks and choices
  async solveFillInBlanks(questionText, availableWords) {
    const prompt = `Task: Complete the sentences by choosing the correct word from the available list for each blank [1], [2], etc.\n\n` +
      `Text with blanks:\n${questionText}\n\n` +
      `Available choices:\n${availableWords.join(', ')}\n\n` +
      `Output ONLY a valid JSON object mapping blank numbers (e.g. "1", "2") to the exact chosen word. Example: {"1": "WordA", "2": "WordB"}. No other text.`;

    const res = await this.generateAnswer(
      prompt,
      null,
      'You are an expert academic exam solver. Output ONLY valid JSON mapping blank numbers to chosen words, e.g. {"1":"WordA","2":"WordB"}.'
    );

    if (res?.success && res.text) {
      try {
        let clean = res.text.trim();
        // Remove markdown code fences if present
        clean = clean.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const mapping = JSON.parse(jsonMatch[0]);
          return { success: true, mapping, warningNotice: res.warningNotice };
        }
      } catch (e) {
        console.warn('[Autopilot AI] JSON parse failed for blanks:', e);
      }
    }
    return res;
  }
};
