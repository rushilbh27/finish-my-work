// Background Service Worker
// Multi-Provider Architecture:
// 1. Default: Free AI (No key needed, Alt 3 with automatic cooldown & retry)
// 2. Groq (Free with Google login, 30 RPM, 300 t/s, Llama 3.3 70B, zero credit card)
// 3. Google Gemini (BYOA with Vision AI for diagrams/images)
// 4. OpenRouter (Free tier with Google login, Llama & DeepSeek)

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Autopilot AI] Service worker active.');
});

// ── Message Router ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_AI') {
    handleAIRequest(request).then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.action === 'CHECK_AI_STATUS') {
    (async () => {
      const stored = await chrome.storage.local.get([
        'aiProvider',
        'groqApiKey',
        'geminiApiKey',
        'openrouterApiKey'
      ]);

      const provider = stored.aiProvider || 'free';
      const hasGroq = !!stored.groqApiKey?.trim();
      const hasGemini = !!stored.geminiApiKey?.trim();
      const hasOpenRouter = !!stored.openrouterApiKey?.trim();

      let activeName = '✦ Free AI';
      if (provider === 'groq' && hasGroq) activeName = '⚡ Groq (Llama 70B)';
      else if (provider === 'gemini' && hasGemini) activeName = '🔑 Gemini Flash';
      else if (provider === 'openrouter' && hasOpenRouter) activeName = '🌐 OpenRouter';
      else if (hasGroq) activeName = '⚡ Groq (Llama 70B)';
      else if (hasGemini) activeName = '🔑 Gemini Flash';
      else if (hasOpenRouter) activeName = '🌐 OpenRouter';

      sendResponse({
        provider,
        activeName,
        hasGroq,
        hasGemini,
        hasOpenRouter
      });
    })();
    return true;
  }

  // Legacy compat
  if (request.action === 'CALL_GEMINI_API') {
    handleAIRequest({ ...request, action: 'CALL_AI' })
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ── Core AI Dispatcher ───────────────────────────────────────────────────────
async function handleAIRequest(request) {
  const { prompt, imageBase64, systemInstruction } = request;
  const system = systemInstruction || 'You are an expert academic exam solver. Output ONLY the answer.';

  const stored = await chrome.storage.local.get([
    'aiProvider',
    'groqApiKey',
    'geminiApiKey',
    'openrouterApiKey'
  ]);

  let provider = stored.aiProvider;
  const groqKey = stored.groqApiKey?.trim();
  const geminiKey = stored.geminiApiKey?.trim();
  const openrouterKey = stored.openrouterApiKey?.trim();

  // If user entered a Groq key and didn't explicitly pick Gemini/OpenRouter,
  // ALWAYS route through Groq (fast, no rate limits, accurate)
  if (groqKey && (provider === 'groq' || !provider || provider === 'free')) {
    provider = 'groq';
  } else if (geminiKey && (provider === 'gemini' || !provider || provider === 'free')) {
    provider = 'gemini';
  } else if (openrouterKey && (provider === 'openrouter' || !provider || provider === 'free')) {
    provider = 'openrouter';
  } else if (!provider) {
    provider = 'free';
  }

  // ── 1. Priority: User Selected Provider ──
  let providerErrorNotice = null;

  // GROQ (Lightning-fast, Free with Google login, 30 RPM, 300 t/s)
  if (provider === 'groq') {
    if (groqKey) {
      try {
        const result = await callGroq(groqKey, prompt, imageBase64, system);
        if (result) return { success: true, text: result, source: 'groq' };
      } catch (e) {
        console.warn('[Autopilot AI] Groq call failed:', e.message);
        if (e.rateLimited) {
          return {
            success: false,
            rateLimited: true,
            waitSec: e.waitSec || 5,
            source: 'groq',
            error: `Groq rate limit: wait ${e.waitSec || 5}s`
          };
        }
        // Return clear Groq error so user knows exact key/network status instead of silently falling back to slow 30s Free AI
        return {
          success: false,
          source: 'groq',
          error: `Groq error: ${e.message.replace(/Groq \[[^\]]+\] /, '')}`
        };
      }
    } else {
      providerErrorNotice = '⚠️ Groq key missing. Continuing with Free AI...';
    }
  }

  // GEMINI (Vision capable, user key)
  if (provider === 'gemini') {
    if (geminiKey) {
      try {
        const result = await callGemini(geminiKey, prompt, imageBase64, system);
        if (result) return { success: true, text: result, source: 'gemini' };
      } catch (e) {
        console.warn('[Autopilot AI] Gemini call failed:', e.message);
        providerErrorNotice = `⚠️ Gemini error: ${e.message.slice(0, 32)}. Continuing with Free AI...`;
      }
    } else {
      providerErrorNotice = '⚠️ Gemini key missing. Continuing with Free AI...';
    }
  }

  // OPENROUTER (Free models, user key)
  if (provider === 'openrouter') {
    if (openrouterKey) {
      try {
        const result = await callOpenRouter(openrouterKey, prompt, system);
        if (result) return { success: true, text: result, source: 'openrouter' };
      } catch (e) {
        console.warn('[Autopilot AI] OpenRouter call failed:', e.message);
        providerErrorNotice = `⚠️ OpenRouter error: ${e.message.slice(0, 32)}. Continuing with Free AI...`;
      }
    } else {
      providerErrorNotice = '⚠️ OpenRouter key missing. Continuing with Free AI...';
    }
  }

  // ── 2. Fallback / Default: Free AI with Cooldown & Retry (Zero Key Needed) ──
  try {
    const freePrompt = imageBase64 
      ? `${prompt}\n\n(Note: An image/diagram is in this question. Based on the question text, provide the best answer.)`
      : prompt;
    const result = await callPollinations(freePrompt, system);
    if (result) {
      return { 
        success: true, 
        text: result, 
        source: 'free-ai',
        warningNotice: providerErrorNotice 
      };
    }
  } catch (e) {
    if (e.rateLimited) {
      return { 
        success: false, 
        rateLimited: true, 
        waitSec: e.waitSec || 28, 
        error: `Free AI rate limit: wait ${e.waitSec || 28}s`,
        warningNotice: providerErrorNotice
      };
    }
    console.warn('[Autopilot AI] Free AI failed:', e.message);
  }

  return { 
    success: false, 
    error: providerErrorNotice || 'All AI engines unavailable. Please check settings.' 
  };
}

// ── PROVIDER 1: Groq Cloud (Free with Google, 30 RPM, 300 t/s) ──────────
async function callGroq(apiKey, prompt, imageBase64 = null, system = '') {
  // Groq production models: Llama 3.3 70B (primary reasoning) -> Llama 3.1 8B (30,000 TPM fallback)
  // Note: Older preview vision models (11b/90b) were decommissioned by Groq.
  // Full question text, math formulas, and LaTeX are preserved in prompt for 100% accurate reasoning.
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  let lastError = null;

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 150
        })
      });

      if (res.status === 429) {
        let waitSec = 5;
        try {
          const errJson = await res.json();
          const errMsg = errJson?.error?.message || '';
          const match = errMsg.match(/try again in ([\d\.]+)\s*s/i);
          if (match) waitSec = Math.ceil(parseFloat(match[1]));
        } catch (e) {
          const retryHeader = res.headers.get('retry-after');
          if (retryHeader) waitSec = Math.ceil(parseFloat(retryHeader));
        }

        console.warn(`[Groq] Rate limit 429 on model ${model} (wait ${waitSec}s). Trying next model in cascade...`);
        lastError = new Error(`Groq [${model}] 429 Rate Limit`);
        lastError.rateLimited = true;
        lastError.waitSec = waitSec;
        // Move immediately to next model in cascade (e.g. llama-3.1-8b-instant with 30k TPM)
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = errText.slice(0, 100);
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) errMsg = parsed.error.message;
        } catch (e) {}
        lastError = new Error(`Groq [${model}] HTTP ${res.status}: ${errMsg}`);
        continue;
      }

      const data = await res.json();
      let content = data?.choices?.[0]?.message?.content?.trim();
      if (content) {
        if (content.startsWith('{') && content.endsWith('}')) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.answer || parsed.response || parsed.content || content;
          } catch (e) {}
        }
        return content;
      }
    } catch (e) {
      lastError = e;
      if (e.rateLimited) continue;
    }
  }

  throw lastError || new Error('Groq failed across all available models');
}

// ── PROVIDER 2: Google Gemini (Vision capable) ────────────────────────────────
async function callGemini(apiKey, prompt, imageBase64, system) {
  const parts = [];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: imageBase64.mimeType || 'image/png',
        data: imageBase64.data
      }
    });
  }
  parts.push({ text: `${system}\n\nTask: ${prompt}` });

  // List of models to try in priority order
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ contents: [{ parts }] })
        }
      );

      const data = await res.json();
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      }
      if (data?.error?.code === 403 || data?.error?.code === 404) {
        continue; // Try next model name
      }
    } catch (e) {}
  }

  throw new Error('Gemini API call failed on all models.');
}

// ── PROVIDER 3: OpenRouter (Free tier models) ─────────────────────────────────
async function callOpenRouter(apiKey, prompt, system) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/autopilot-ai',
      'X-Title': 'Autopilot AI'
    },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 200
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// ── PROVIDER 4 (DEFAULT ALT 3): Pollinations Free AI with Cooldown ────────────
async function callPollinations(prompt, system) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: prompt }
  ];

  let res;
  try {
    res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        messages,
        model: 'openai-fast',
        seed: 42,
        private: true,
        temperature: 0.1
      })
    });
  } catch (err) {
    const e = new Error('RATE_LIMIT:25');
    e.rateLimited = true;
    e.waitSec = 25;
    throw e;
  }

  const text = await res.text();

  if (res.status === 429 || text.includes('Free limit reached') || text.includes('Please wait') || text.includes('rate limit')) {
    const match = text.match(/Please wait (\d+)\s*seconds?/i);
    const waitSec = match ? parseInt(match[1], 10) : 28;
    const err = new Error(`RATE_LIMIT:${waitSec}`);
    err.rateLimited = true;
    err.waitSec = waitSec;
    throw err;
  }

  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);

  if (text && text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.content && typeof parsed.content === 'string') {
        text = parsed.content;
      } else if (parsed.reasoning && typeof parsed.reasoning === 'string') {
        const match = parsed.reasoning.match(/(?:answer(?: is)?|likely)[:\s]*["']?([a-zA-Z0-9_\s-]+)["']?/i);
        if (match) {
          text = match[1].trim();
        } else {
          const words = parsed.reasoning.split(/\s+/).filter(Boolean);
          text = words[words.length - 1]?.replace(/[^a-zA-Z0-9]/g, '') || text;
        }
      }
    } catch (e) {}
  }

  return text?.trim() || null;
}

// ── Keyboard Shortcut Router ──────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'solve-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SOLVE' });
  } else if (command === 'toggle-overlay') {
    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_OVERLAY' });
  }
});
