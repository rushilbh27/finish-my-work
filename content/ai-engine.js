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

    let prompt = `Question: ${questionText}\n\nOptions:\n${formattedOptions}\n\n`;
    if (imageBase64) {
      prompt += `Note: An image or diagram is attached to this question. Please inspect it carefully.\n\n`;
    }
    prompt += `Task: Choose the correct option. Respond ONLY with the single uppercase option letter (from A to ${maxLetter}). Do not include any explanations or extra words.`;

    const result = await this.generateAnswer(
      prompt,
      imageBase64,
      `You are an expert academic exam solver. Output ONLY the single option letter from A to ${maxLetter}.`
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
  async solveBriefAnswer(questionText) {
    const prompt = `Question: "${questionText}"\n\nProvide the exact, concise answer (one word or short phrase if asked, otherwise 1 brief sentence). No preamble, no quotes, no JSON markup.`;
    const res = await this.generateAnswer(
      prompt,
      null,
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
  }
};
