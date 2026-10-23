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

    const answer = result.text;
    if (answer) {
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
  async solveNATAnswer(questionText, imgElement = null) {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    const prompt = `CRITICAL TASK: NUMERICAL ANSWER TYPE (NAT) QUESTION.\n\n` +
      `Question:\n"${questionText}"\n\n` +
      (imageBase64 ? `Note: An image containing mathematical equations, matrices, or diagrams is attached. Read all symbols and coefficients carefully.\n\n` : '') +
      `INSTRUCTIONS:\n` +
      `1. Compute the exact mathematical or numerical value required by the question.\n` +
      `2. Respond ONLY with the final numerical value (e.g., "4", "-2.5", "0.75", "12").\n` +
      `3. Do NOT include any variable names (e.g. do NOT write "x = 4", write "4"), units, words, fractions (convert to decimal if needed), or explanations. Output ONLY the pure numerical value.`;

    const result = await this.generateAnswer(
      prompt,
      imageBase64,
      'You are an expert academic STEM exam solver. Output ONLY the raw final numerical value (e.g. 4.5 or -3), nothing else.'
    );

    if (result?.success && result.text) {
      let clean = result.text.trim().replace(/^["'`]+|["'`]+$/g, '');
      const numMatch = clean.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/);
      if (numMatch) {
        return { success: true, text: numMatch[0], warningNotice: result.warningNotice };
      }
      return { success: true, text: clean, warningNotice: result.warningNotice };
    }
    return result;
  },

  // Multi-choice solver (Select all that apply / checkboxes / MSQ)
  async solveMultiChoice(questionText, options, imgElement = null) {
    let imageBase64 = null;
    if (imgElement) {
      imageBase64 = await this.imageToBase64(imgElement);
    }

    const maxLetter = String.fromCharCode(65 + options.length - 1);
    const formattedOptions = options
      .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt.text}`)
      .join('\n');

    let prompt = `CRITICAL TASK: MULTIPLE SELECT QUESTION (MSQ / "Select all that apply").\n\n` +
      `Question:\n"${questionText}"\n\n` +
      `Options:\n${formattedOptions}\n\n` +
      (imageBase64 ? `Note: An image or diagram is attached. Inspect all formulas, conditions, and domains carefully.\n\n` : '') +
      `CRITICAL INSTRUCTIONS FOR MSQ:\n` +
      `1. In IIT / academic exams, MSQs often have 1, 2, 3, or ALL options (${options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}) valid and correct!\n` +
      `2. You MUST evaluate and test EACH option independently against mathematical definitions, edge cases, and domains.\n` +
      `3. Respond ONLY with the comma-separated uppercase option letters of ALL correct choices, e.g. "A, B, C, D" or "A, C" or "B". No explanations or extra text.`;

    const result = await this.generateAnswer(
      prompt,
      imageBase64,
      `You are an expert academic exam solver. In multi-select questions, multiple options are usually correct. Output ONLY uppercase option letters separated by commas, e.g. A, B, C, D.`
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

    const answer = result.text || '';
    const validLetters = new Set();
    for (let i = 0; i < options.length; i++) validLetters.add(String.fromCharCode(65 + i));
    const matchedLetters = new Set();

    // 1. Check for JSON array or object
    try {
      const jsonMatch = answer.match(/(\[[\s\S]*?\]|\{[\s\S]*?\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            const str = String(item).trim().toUpperCase();
            if (validLetters.has(str)) matchedLetters.add(str);
            options.forEach((opt, idx) => {
              const optClean = opt.text.toLowerCase().trim();
              const itemClean = String(item).toLowerCase().trim();
              if (itemClean.includes(optClean) || optClean.includes(itemClean)) {
                matchedLetters.add(String.fromCharCode(65 + idx));
              }
            });
          });
        } else if (typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            const upK = k.trim().toUpperCase();
            if (validLetters.has(upK) && (v === true || String(v).toLowerCase() === 'true')) {
              matchedLetters.add(upK);
            }
          });
        }
      }
    } catch (e) {}

    // 2. Strict letter tokens (e.g. "A, B, C, D" or "A, B and D" or "[A, C]")
    const letterMatches = answer.match(/\b([A-Z])\b/g) || [];
    letterMatches.forEach(l => {
      const up = l.toUpperCase();
      if (validLetters.has(up)) matchedLetters.add(up);
    });

    // 3. Option text matching (if model output names e.g. "Sphinx, Siberian, Burmese, Ragdoll")
    const lowerAnswer = answer.toLowerCase();
    options.forEach((opt, idx) => {
      const cleanOpt = opt.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      if (cleanOpt.length >= 3) {
        const wordRegex = new RegExp(`(?:\\b|[^a-z0-9])${cleanOpt}(?:\\b|[^a-z0-9])`, 'i');
        if (wordRegex.test(lowerAnswer) || lowerAnswer.includes(cleanOpt)) {
          matchedLetters.add(String.fromCharCode(65 + idx));
        }
      }
    });

    // 4. "All of the above" / "All are correct"
    if (lowerAnswer.includes('all of the above') || lowerAnswer.includes('all are correct') || lowerAnswer.includes('all options')) {
      validLetters.forEach(l => matchedLetters.add(l));
    }

    const letters = Array.from(matchedLetters).sort();
    if (letters.length > 0) {
      return { success: true, letters, warningNotice: result.warningNotice };
    }

    return { success: false, error: 'Could not extract answer letters', warningNotice: result.warningNotice };
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
