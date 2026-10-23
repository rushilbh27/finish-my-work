// Rigorous Battle Test for Finish My Work Extension
// Tests:
// 1. HUD Dragging with PointerEvents & setPointerCapture (verifies DOM move)
// 2. Groq Dynamic Model Discovery & 404 Cascade Fallback
// 3. Strict Anti-Skip Pause Protection (proves it never advances on failed AI)
// 4. IITM Question 11 Parabola Math Solve ($A = 2$)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function battleTest() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🛡️  BATTLE-TESTING FINISH MY WORK EXTENSION');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // ──────────────────────────────────────────────────────────
  // TEST 1: HUD Dragging Verification
  // ──────────────────────────────────────────────────────────
  console.log('[TEST 1] Testing HUD Free Dragging with PointerEvents...');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>HUD Drag Test</title>
        <style>body { width: 100vw; height: 100vh; margin: 0; background: #0f172a; }</style>
        <style>${fs.readFileSync(path.join(__dirname, '../content/overlay.css'), 'utf8')}</style>
      </head>
      <body>
        <div id="target-page">Host page content</div>
      </body>
    </html>
  `);

  // Inject content.js logic
  await page.evaluate(() => {
    window.chrome = {
      storage: {
        local: {
          get: () => Promise.resolve({ extensionEnabled: true, showFloatingWidget: true }),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve()
        }
      },
      runtime: {
        getURL: (p) => p,
        sendMessage: () => {},
        onMessage: { addListener: () => {} }
      }
    };
  });

  const contentJs = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');
  await page.evaluate(contentJs);

  const hudRoot = await page.$('#peslms-autopilot-root');
  if (!hudRoot) throw new Error('HUD root not found in DOM');

  // Verify HUD is visible
  const initialBox = await hudRoot.boundingBox();
  console.log(`  Initial HUD position: x=${Math.round(initialBox.x)}, y=${Math.round(initialBox.y)}`);

  // Locate the drag handle
  const dragHandle = await page.$('#peslms-drag-handle');
  if (!dragHandle) throw new Error('Drag handle #peslms-drag-handle not found');

  const handleBox = await dragHandle.boundingBox();
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  // Perform smooth drag: Move left by -300px, move down by +150px
  console.log('  Dragging HUD across screen (-300px horizontally, +150px vertically)...');
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(startX - (300 * i) / 10, startY + (150 * i) / 10);
    await new Promise(r => setTimeout(r, 20));
  }
  await page.mouse.up();

  const newBox = await hudRoot.boundingBox();
  console.log(`  New HUD position: x=${Math.round(newBox.x)}, y=${Math.round(newBox.y)}`);

  const deltaX = newBox.x - initialBox.x;
  const deltaY = newBox.y - initialBox.y;
  console.log(`  Actual displacement: deltaX=${Math.round(deltaX)}px, deltaY=${Math.round(deltaY)}px`);

  if (Math.abs(deltaX) < 100 || Math.abs(deltaY) < 50) {
    throw new Error(`HUD failed to drag freely! deltaX=${deltaX}, deltaY=${deltaY}`);
  }
  console.log('  ✅ TEST 1 PASSED: HUD is 100% freely draggable with PointerEvents!\n');

  // ──────────────────────────────────────────────────────────
  // TEST 2: Groq Dynamic Models & 404 Cascade Fallback
  // ──────────────────────────────────────────────────────────
  console.log('[TEST 2] Testing Groq Dynamic Models & 404 Cascade Fallback...');

  const bgJs = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');

  // Evaluate background script in a Node VM or page context
  const testGroqCascade = await page.evaluate(async (bgJsCode) => {
    // Isolate scope and mock chrome
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {};
    window.chrome.runtime.onInstalled = { addListener: () => {} };
    window.chrome.runtime.onMessage = { addListener: () => {} };
    window.chrome.storage = { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } };
    window.chrome.commands = { onCommand: { addListener: () => {} } };
    window.chrome.tabs = { query: () => Promise.resolve([]), sendMessage: () => {} };

    const scope = {};
    const fn = new Function('scope', bgJsCode + '\nscope.callGroq = callGroq;\nscope.getAvailableGroqModels = getAvailableGroqModels;');
    fn(scope);

    // Mock fetch to simulate Groq /models returning active models
    // and first model returning 404, second model returning 200
    const originalFetch = window.fetch;
    let callLog = [];

    window.fetch = async (url, opts = {}) => {
      callLog.push({ url, body: opts.body ? JSON.parse(opts.body) : null });

      // 1. Models endpoint
      if (url.includes('/openai/v1/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'whisper-large-v3' }, // should be filtered out
              { id: 'llama-guard-3-8b' }, // should be filtered out
              { id: 'openai/gpt-oss-120b' },
              { id: 'openai/gpt-oss-20b' }
            ]
          })
        };
      }

      // 2. Chat completions endpoint
      if (url.includes('/openai/v1/chat/completions')) {
        const body = JSON.parse(opts.body);
        if (body.model === 'openai/gpt-oss-120b') {
          // Simulate 404 on model 1
          return {
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ error: { message: 'The model openai/gpt-oss-120b does not exist' } })
          };
        }
        if (body.model === 'openai/gpt-oss-20b') {
          // Model 2 succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: '2' } }]
            })
          };
        }
      }

      return originalFetch(url, opts);
    };

    try {
      const res = await scope.callGroq('gsk_test_mock_key', 'Calculate 1 + 1');
      window.fetch = originalFetch;
      return { success: true, result: res, callLog };
    } catch (e) {
      window.fetch = originalFetch;
      return { success: false, error: e.message, callLog };
    }
  }, bgJs);

  console.log(`  Cascade Result: ${JSON.stringify(testGroqCascade.result)}`);
  console.log(`  Calls made in cascade: ${testGroqCascade.callLog.length} calls`);
  testGroqCascade.callLog.forEach((c, idx) => {
    console.log(`    Call #${idx + 1}: ${c.url} ${c.body?.model ? `(model: ${c.body.model})` : ''}`);
  });

  if (!testGroqCascade.success || testGroqCascade.result !== '2') {
    throw new Error('Groq 404 cascade failed!');
  }
  console.log('  ✅ TEST 2 PASSED: Groq 404 on model 1 immediately cascaded to model 2 and succeeded!\n');

  // ──────────────────────────────────────────────────────────
  // TEST 3: Strict Anti-Skip Pause Protection
  // ──────────────────────────────────────────────────────────
  console.log('[TEST 3] Testing Strict Anti-Skip Protection on API Errors...');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>Anti-Skip Test</title></head>
      <body>
        <app-root>
          <div class="q-header">Question 11 / 17</div>
          <app-question>
            <div class="question-text">If the slope of parabola y = Ax^2 + Bx + C at points (3, 2) and (2, 3) are 16 and 12 respectively. Calculate the value of A.</div>
            <div class="options">
              <label>Your answer</label>
              <mat-form-field>
                <textarea id="ans-input" matinput class="mat-mdc-input-element" placeholder="Enter your answer"></textarea>
              </mat-form-field>
              <span class="instruction">Only numeric input is accepted for this question.</span>
            </div>
          </app-question>
          <button id="next-btn" class="mat-button next-btn">Next →</button>
        </app-root>
      </body>
    </html>
  `);

  const solverCode = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');
  const aiEngineCode = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');

  const antiSkipResult = await page.evaluate(async ({ solverCode, aiEngineCode }) => {
    eval(aiEngineCode);
    eval(solverCode);

    let nextButtonClicked = false;
    document.getElementById('next-btn').addEventListener('click', () => {
      nextButtonClicked = true;
    });

    // Mock AI Engine to return an API Error (e.g. Groq 404 error)
    window.AIEngine.solveNATAnswer = async () => ({
      success: false,
      message: 'Groq error: HTTP 404: The model does not exist'
    });

    const statusUpdates = [];
    let isRunning = true;

    // Run solveAllOnPage
    const res = await window.UniversalSolver._solveAllOnPage(
      (msg) => statusUpdates.push(msg),
      () => isRunning
    );

    // Also run _runDraftMode
    const draftRes = await window.UniversalSolver._runDraftMode(
      (msg) => statusUpdates.push(msg),
      () => isRunning
    );

    const inputVal = document.getElementById('ans-input').value;

    return {
      _solveAllOnPageResult: res,
      nextButtonClicked,
      inputVal,
      statusUpdates
    };
  }, { solverCode, aiEngineCode });

  console.log(`  Auto-Pilot nextButtonClicked: ${antiSkipResult.nextButtonClicked}`);
  console.log(`  Solve Result: allAnswered=${antiSkipResult._solveAllOnPageResult.allAnswered}, stopped=${antiSkipResult._solveAllOnPageResult.stopped}`);
  console.log(`  Status Updates:`);
  antiSkipResult.statusUpdates.slice(-3).forEach(s => console.log(`    - ${s}`));

  if (antiSkipResult.nextButtonClicked) {
    throw new Error('FAIL: Auto-Pilot clicked Next on an unresolved question!');
  }
  if (antiSkipResult._solveAllOnPageResult.allAnswered) {
    throw new Error('FAIL: Auto-Pilot falsely reported question as answered!');
  }
  if (!antiSkipResult._solveAllOnPageResult.stopped) {
    throw new Error('FAIL: Auto-Pilot did not stop cleanly on API error!');
  }
  console.log('  ✅ TEST 3 PASSED: Auto-Pilot NEVER skips questions on API errors! Halted safely.\n');

  // ──────────────────────────────────────────────────────────
  // TEST 4: IITM Question 11 Parabola Math Solve ($A = 2$)
  // ──────────────────────────────────────────────────────────
  console.log('[TEST 4] Testing IITM Question 11 Parabola Problem ($A = 2$)...');

  const q11Result = await page.evaluate(async ({ solverCode, aiEngineCode }) => {
    eval(aiEngineCode);
    eval(solverCode);

    const textarea = document.getElementById('ans-input');
    textarea.value = '';

    // Mock AI Engine returning the mathematically correct calculation: 2
    window.AIEngine.solveNATAnswer = async () => ({
      success: true,
      text: '2'
    });

    const statusUpdates = [];
    const res = await window.UniversalSolver.solveQuestionItem(
      window.UniversalSolver.detectAllQuestions()[0],
      (msg) => statusUpdates.push(msg)
    );

    return {
      success: res.success,
      answer: res.answer,
      textareaValue: textarea.value
    };
  }, { solverCode, aiEngineCode });

  console.log(`  Question 11 Result: success=${q11Result.success}, answer="${q11Result.answer}", textareaValue="${q11Result.textareaValue}"`);

  if (!q11Result.success || q11Result.textareaValue !== '2') {
    throw new Error(`FAIL: Question 11 textarea was not filled with 2! Got: "${q11Result.textareaValue}"`);
  }
  console.log('  ✅ TEST 4 PASSED: Question 11 entered raw "2" into textarea perfectly!\n');

  await browser.close();

  console.log('══════════════════════════════════════════════════════════════');
  console.log('🎉 ALL 4 BATTLE TESTS PASSED WITH 100% OPERATIONAL INTEGRITY!');
  console.log('   1. HUD Draggable: Confirmed with live displacement');
  console.log('   2. Groq 404 Cascade: Confirmed model 1 -> model 2 fallback');
  console.log('   3. Zero Skipping: Confirmed Auto-Pilot never advances on errors');
  console.log('   4. IITM NAT Math: Confirmed raw 2 entered into textarea');
  console.log('══════════════════════════════════════════════════════════════');
}

battleTest().catch(err => {
  console.error('\n❌ BATTLE TEST FAILED:', err);
  process.exit(1);
});
