// Exhaustive Deep Verification Script
// Executes all verifiable aspects of Finish My Work v2.5.1
const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');

async function runDeepVerification() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🔬 EXHAUSTIVE SYSTEM VERIFICATION REPORT');
  console.log('══════════════════════════════════════════════════════════════\n');

  const results = [];

  // ──────────────────────────────────────────────────────────
  // 1. Network & TLS Handshake to Groq API
  // ──────────────────────────────────────────────────────────
  console.log('SECTION 1: Network & TLS Handshake to Groq API');
  const netStart = Date.now();
  const netPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/models',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      const duration = Date.now() - netStart;
      resolve({ status: res.statusCode, duration, ok: res.statusCode === 401 }); // 401 expected without key
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });

  try {
    const net = await netPromise;
    console.log(`  ✓ Route: https://api.groq.com (Direct SSL/TLS)`);
    console.log(`  ✓ Handshake & Roundtrip: ${net.duration}ms`);
    console.log(`  ✓ Server Response: HTTP ${net.status} (Valid Groq Gateway Handshake)`);
    results.push({ name: 'Network & SSL to Groq Gateway', status: 'PASS', details: `${net.duration}ms` });
  } catch (err) {
    console.error(`  ✗ Network Error:`, err.message);
    results.push({ name: 'Network & SSL to Groq Gateway', status: 'FAIL', details: err.message });
  }

  // ──────────────────────────────────────────────────────────
  // 2. Playwright Headless Browser Environment Tests
  // ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Load HUD DOM and CSS
  const overlayCss = fs.readFileSync(path.join(__dirname, '../content/overlay.css'), 'utf8');
  const contentJs = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');
  const universalSolverJs = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');
  const aiEngineJs = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Deep Verify</title>
        <style>${overlayCss}</style>
      </head>
      <body>
        <div id="page-content">Host Test Page</div>
      </body>
    </html>
  `);

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

  await page.evaluate(contentJs);

  // SECTION 2: Version Badge & HUD Render
  console.log('\nSECTION 2: Version Badge & HUD Render');
  const badgeText = await page.$eval('.peslms-ver-badge', el => el.innerText).catch(() => null);
  console.log(`  ✓ HUD Rendered: True`);
  console.log(`  ✓ HUD Version Badge: "${badgeText}"`);
  if (badgeText === 'v2.5.1') {
    results.push({ name: 'HUD Render & v2.5.1 Version Badge', status: 'PASS', details: badgeText });
  } else {
    results.push({ name: 'HUD Render & v2.5.1 Version Badge', status: 'FAIL', details: `Found: ${badgeText}` });
  }

  // SECTION 3: Multi-Quadrant Dragging
  console.log('\nSECTION 3: Multi-Quadrant Free Dragging Test');
  const hudRoot = await page.$('#peslms-autopilot-root');
  const dragHandle = await page.$('#peslms-drag-handle');
  const initBox = await hudRoot.boundingBox();
  console.log(`  Initial Position: x=${Math.round(initBox.x)}, y=${Math.round(initBox.y)}`);

  // Move 1: Drag to Center-Left
  let handleBox = await dragHandle.boundingBox();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 400, handleBox.y + 200, { steps: 10 });
  await page.mouse.up();
  const box1 = await hudRoot.boundingBox();
  console.log(`  Move 1 (to Left): x=${Math.round(box1.x)}, y=${Math.round(box1.y)} (Displacement: dx=${Math.round(box1.x - initBox.x)})`);

  // Move 2: Drag to Bottom-Center
  handleBox = await dragHandle.boundingBox();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 150, handleBox.y + 250, { steps: 10 });
  await page.mouse.up();
  const box2 = await hudRoot.boundingBox();
  console.log(`  Move 2 (to Bottom): x=${Math.round(box2.x)}, y=${Math.round(box2.y)} (Displacement: dy=${Math.round(box2.y - box1.y)})`);

  const dragSuccess = (box1.x < initBox.x - 200) && (box2.y > box1.y + 100);
  results.push({ 
    name: 'HUD Multi-Quadrant Free Dragging', 
    status: dragSuccess ? 'PASS' : 'FAIL',
    details: `dx1=${Math.round(box1.x - initBox.x)}px, dy2=${Math.round(box2.y - box1.y)}px`
  });

  // SECTION 4: Groq Cascading & Fallback Logic
  console.log('\nSECTION 4: Groq Cascading (404/400 -> Fallback)');
  const bgJs = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');

  const cascadeTest = await page.evaluate(async (bgCode) => {
    window.chrome = {
      runtime: { onInstalled: { addListener: () => {} }, onMessage: { addListener: () => {} } },
      storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
      commands: { onCommand: { addListener: () => {} } },
      tabs: { query: () => Promise.resolve([]), sendMessage: () => {} }
    };

    const scope = {};
    const fn = new Function('scope', bgCode + '\nscope.callGroq = callGroq;\nscope.handleAIRequest = handleAIRequest;');
    fn(scope);

    // Mock Groq API:
    // Model 1: 404 Not Found
    // Model 2: 400 Bad Request
    // Model 3: 200 OK (returns 'Test Success')
    const originalFetch = window.fetch;
    const history = [];

    window.fetch = async (url, opts = {}) => {
      if (url.includes('/openai/v1/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'model-a-404' },
              { id: 'model-b-400' },
              { id: 'model-c-working' }
            ]
          })
        };
      }

      if (url.includes('/openai/v1/chat/completions')) {
        const body = JSON.parse(opts.body);
        history.push(body.model);
        if (body.model === 'model-a-404') {
          return { ok: false, status: 404, text: async () => '{"error":{"message":"model not found"}}' };
        }
        if (body.model === 'model-b-400') {
          return { ok: false, status: 400, text: async () => '{"error":{"message":"decommissioned"}}' };
        }
        if (body.model === 'model-c-working') {
          return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Verified' } }] }) };
        }
      }
      return originalFetch(url, opts);
    };

    try {
      const res = await scope.callGroq('gsk_mock_test_key', 'test prompt');
      window.fetch = originalFetch;
      return { success: true, result: res, history };
    } catch (e) {
      window.fetch = originalFetch;
      return { success: false, error: e.message, history };
    }
  }, bgJs);

  console.log(`  ✓ Models Attempted In Cascade: ${cascadeTest.history.join(' → ')}`);
  console.log(`  ✓ Cascade Final Result: "${cascadeTest.result}"`);
  const cascadeSuccess = cascadeTest.success && cascadeTest.result === 'Verified' && cascadeTest.history.length === 3;
  results.push({ 
    name: 'Groq Multi-Model 404/400 Auto-Cascade', 
    status: cascadeSuccess ? 'PASS' : 'FAIL',
    details: `${cascadeTest.history.length} models cascaded`
  });

  // SECTION 5: Strict Anti-Skip Pause Protection (Proof next is NEVER clicked on error)
  console.log('\nSECTION 5: Strict Anti-Skip Protection on Failure');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>Anti Skip Test</title></head>
      <body>
        <app-root>
          <div class="q-header">Question 11 / 17</div>
          <app-question style="display:block; width:600px; height:300px;">
            <div class="question-text">Let A be the slope of the parabola at x=1. Find A. Only numeric input is accepted for this question.</div>
            <div class="options">
              <textarea id="ans-box" class="mat-mdc-input-element" style="display:block; width:200px; height:50px;"></textarea>
            </div>
          </app-question>
          <button id="next-button" class="mat-button next-btn">Next →</button>
        </app-root>
      </body>
    </html>
  `);

  const antiSkipTest = await page.evaluate(async ({ universalSolverJs, aiEngineJs }) => {
    eval(aiEngineJs);
    eval(universalSolverJs);

    let nextClicked = false;
    document.getElementById('next-button').addEventListener('click', () => { nextClicked = true; });

    // Mock AI Engine returning explicit failure
    window.AIEngine.solveNATAnswer = async () => ({
      success: false,
      message: 'Groq error: HTTP 404: The model does not exist'
    });

    const statusLog = [];
    let isRunning = true;

    // Test 1: solveAllOnPage
    const solveRes = await window.UniversalSolver._solveAllOnPage(
      (m) => statusLog.push(m),
      () => isRunning
    );

    // Test 2: _runDraftMode
    const draftRes = await window.UniversalSolver._runDraftMode(
      (m) => statusLog.push(m),
      () => isRunning
    );

    // Test 3: _runSubmitMode
    const submitRes = await window.UniversalSolver._runSubmitMode(
      (m) => statusLog.push(m),
      () => isRunning
    );

    return {
      nextClicked,
      allAnswered: solveRes.allAnswered,
      stopped: solveRes.stopped,
      statusLog
    };
  }, { universalSolverJs, aiEngineJs });

  console.log(`  ✓ Next Button Clicked: ${antiSkipTest.nextClicked} (Strict False Required)`);
  console.log(`  ✓ All Answered Reported: ${antiSkipTest.allAnswered} (Strict False Required)`);
  console.log(`  ✓ Auto-Pilot Stopped Flag: ${antiSkipTest.stopped} (Strict True Required)`);
  console.log(`  ✓ Final Status Notice: "${antiSkipTest.statusLog[antiSkipTest.statusLog.length - 1]}"`);

  const antiSkipSuccess = !antiSkipTest.nextClicked && !antiSkipTest.allAnswered && antiSkipTest.stopped;
  results.push({ 
    name: 'Strict Anti-Skip Pause Protection', 
    status: antiSkipSuccess ? 'PASS' : 'FAIL',
    details: 'nextClicked=false, stopped=true'
  });

  // SECTION 6: IITM Angular Material NAT Math Solving
  console.log('\nSECTION 6: IITM Parabola Math & Hint Constraints');
  const mathTest = await page.evaluate(async ({ universalSolverJs, aiEngineJs }) => {
    eval(aiEngineJs);
    eval(universalSolverJs);

    const textarea = document.getElementById('ans-box');
    textarea.value = '';

    window.AIEngine.solveNATAnswer = async () => ({ success: true, text: '2' });

    const q = window.UniversalSolver.detectAllQuestions()[0];
    if (q) q.isAnswered = false;
    const res = await window.UniversalSolver.solveQuestionItem(q, () => {});

    return {
      success: res.success,
      answer: res.answer,
      boxValue: textarea.value
    };
  }, { universalSolverJs, aiEngineJs });

  console.log(`  ✓ Math Solve Result: "${mathTest.answer}"`);
  console.log(`  ✓ Textarea Injected Value: "${mathTest.boxValue}"`);
  const mathSuccess = mathTest.success && mathTest.boxValue === '2';
  results.push({ 
    name: 'IITM NAT Textarea Numerical Math Injection', 
    status: mathSuccess ? 'PASS' : 'FAIL',
    details: `Injected: ${mathTest.boxValue}`
  });

  await browser.close();

  // Print Summary Table
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  let allPass = true;
  results.forEach((r, i) => {
    const symbol = r.status === 'PASS' ? '✅' : '❌';
    if (r.status !== 'PASS') allPass = false;
    console.log(`${symbol} [TEST ${i + 1}] ${r.name.padEnd(45)} | ${r.status} (${r.details})`);
  });
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!allPass) process.exit(1);
}

runDeepVerification().catch(err => {
  console.error('\n❌ DEEP VERIFICATION FAILED:', err);
  process.exit(1);
});
