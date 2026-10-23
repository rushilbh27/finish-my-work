// tests/test-mcqexamtest-autopilot.js
// Tests Auto-Pilot navigation, header regex, next button detection, and completion guards
// using real Playwright browser context simulating mcqexamtest.com.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

async function runTests() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING AUTO-PILOT ON MCQEXAMTEST.COM & PAGINATED QUIZZES');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const solverCode = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Flight Mechanics Control - Part 6</title></head>
    <body class="user-site">
      <div id="quizContainer" data-total="25">
        <div class="header">
          <span class="mx-q-count">Question <span id="qCurrentNum">1</span> of 25</span>
          <div id="qProgressBar" style="width: 4%;"></div>
        </div>

        <div class="quiz-question-block mx-q-block" data-index="0" data-question-id="16010">
          <div class="quiz-question mx-q-question">
            <div class="mx-q-question-head">
              <span class="mx-q-qnum">Q1</span>
              <h2>What is the purpose of "ailerons" on an aircraft?</h2>
            </div>
          </div>
          <ul class="quiz-options mx-q-options" aria-label="Answer options">
            <li data-option-index="1">
              <input type="radio" name="q_16010_choice">
              <span class="mx-q-opt-letter">A</span>
              <label>Increase thrust</label>
            </li>
            <li data-option-index="2">
              <input type="radio" name="q_16010_choice">
              <span class="mx-q-opt-letter">B</span>
              <label>Increase lift</label>
            </li>
            <li data-option-index="3">
              <input type="radio" name="q_16010_choice">
              <span class="mx-q-opt-letter">C</span>
              <label>Reduce drag</label>
            </li>
            <li data-option-index="4">
              <input type="radio" name="q_16010_choice">
              <span class="mx-q-opt-letter">D</span>
              <label>Control roll</label>
            </li>
          </ul>
        </div>

        <div class="quiz-controls mx-q-controls">
          <button type="button" class="btn btn-prev mx-q-btn mx-q-btn-ghost" id="btnPrev" disabled>Previous</button>
          <button type="button" class="btn btn-next mx-q-btn mx-q-btn-primary" id="btnNext" disabled>
            Next
            <i class="fas fa-arrow-right"></i>
          </button>
          <button type="button" class="btn btn-submit mx-q-btn mx-q-btn-success" id="btnSubmit" hidden disabled>
            Submit Quiz
          </button>
        </div>

        <!-- Hidden dialogs present on mcqexamtest.com that previously caused false completion -->
        <div class="mx-dialog-overlay" id="imageModalOverlay" hidden role="dialog" aria-modal="true">
          <button id="imageModalClose" aria-label="Close image">Close</button>
          <figcaption>Click outside or press Esc to close</figcaption>
        </div>

        <div class="mx-dialog-overlay" id="reportModalOverlay" hidden role="dialog" aria-modal="true">
          <button id="reportModalClose" aria-label="Close">Close</button>
          <form id="reportForm">
            <button type="submit" id="reportSubmitBtn">Submit report</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);

  // Initialize chrome mock and load solver
  await page.evaluate((code) => {
    window.chrome = {
      storage: {
        local: {
          get: async () => ({ agentMode: 'draft', autopilotBatchState: { active: true, mode: 'draft' } }),
          set: async () => {},
          remove: async () => {}
        }
      },
      runtime: { sendMessage: () => {} }
    };
    eval(code);
  }, solverCode);

  // ── TEST 1: False Completion Guard ──
  console.log('[TEST 1] Verifying isQuizComplete() does NOT trigger false completion on Question 1...');
  const isComplete = await page.evaluate(() => window.UniversalSolver.isQuizComplete());
  console.log('  isQuizComplete() result on Q1:', isComplete);
  assert.strictEqual(isComplete, false, 'isQuizComplete() must be FALSE when questions are active on Q1 of 25!');
  console.log('  ✅ TEST 1 PASSED: False positive eliminated.\n');

  // ── TEST 2: Header Match Regex ("Question 1 of 25") ──
  console.log('[TEST 2] Verifying header match regex parses "Question 1 of 25"...');
  const headerResult = await page.evaluate(() => {
    const headerText = document.body.innerText;
    const headerMatch = headerText.match(/Question\s+(\d+)\s*(?:\/|\bof\b)\s*(\d+)/i);
    return {
      matched: !!headerMatch,
      currentQNum: headerMatch ? parseInt(headerMatch[1], 10) : null,
      totalQNum: headerMatch ? parseInt(headerMatch[2], 10) : null
    };
  });
  console.log(`  Parsed: Question ${headerResult.currentQNum} of ${headerResult.totalQNum}`);
  assert.strictEqual(headerResult.matched, true);
  assert.strictEqual(headerResult.currentQNum, 1);
  assert.strictEqual(headerResult.totalQNum, 25);
  console.log('  ✅ TEST 2 PASSED: Header parsed accurately (1 of 25).\n');

  // ── TEST 3: Next Button & Submit Button Discrimination ──
  console.log('[TEST 3] Testing Next Button detection & Submit Button safety...');
  const btnChecks = await page.evaluate(() => {
    const solver = window.UniversalSolver;
    const nextDisabled = solver.findNextButton({ includeDisabled: true });
    const nextBeforeEnabled = solver.findNextButton();
    const submitBeforeEnabled = solver.findSubmitButton();

    // Now enable #btnNext
    document.getElementById('btnNext').disabled = false;
    const nextAfterEnabled = solver.findNextButton();
    const submitAfterEnabled = solver.findSubmitButton();

    return {
      nextDisabledFound: !!nextDisabled && nextDisabled.id === 'btnNext',
      nextBeforeEnabledFound: !!nextBeforeEnabled,
      submitBeforeEnabledFound: !!submitBeforeEnabled,
      nextAfterEnabledFound: !!nextAfterEnabled && nextAfterEnabled.id === 'btnNext',
      submitAfterEnabledFound: !!submitAfterEnabled
    };
  });

  assert.strictEqual(btnChecks.nextDisabledFound, true, 'findNextButton({ includeDisabled: true }) should locate #btnNext');
  assert.strictEqual(btnChecks.nextBeforeEnabledFound, false, 'findNextButton() should not match while disabled');
  assert.strictEqual(btnChecks.submitBeforeEnabledFound, false, 'findSubmitButton() must not match report or hidden buttons on Q1');
  assert.strictEqual(btnChecks.nextAfterEnabledFound, true, 'findNextButton() must locate enabled #btnNext');
  assert.strictEqual(btnChecks.submitAfterEnabledFound, false, 'findSubmitButton() must still be false on Q1 after answering');
  console.log('  ✅ TEST 3 PASSED: Next button accurately detected and submit safely guarded.\n');

  // ── TEST 4: Question Detection & Option Resolution ──
  console.log('[TEST 4] Testing question and options detection on mcqexamtest.com...');
  const qData = await page.evaluate(() => {
    const qs = window.UniversalSolver.detectAllQuestions();
    return {
      count: qs.length,
      text: qs[0]?.text,
      optionsCount: qs[0]?.options?.length,
      optA: qs[0]?.options[0]?.text,
      optD: qs[0]?.options[3]?.text
    };
  });
  assert.strictEqual(qData.count, 1);
  assert.strictEqual(qData.optionsCount, 4);
  assert.strictEqual(qData.optA, 'Increase thrust');
  assert.strictEqual(qData.optD, 'Control roll');
  console.log(`  Detected Q: "${qData.text.slice(0, 30)}..." with ${qData.optionsCount} options.`);
  console.log('  ✅ TEST 4 PASSED: Question & options extracted cleanly.\n');

  // ── TEST 5: Auto-Pilot Step-Through Simulation ──
  console.log('[TEST 5] Testing Auto-Pilot navigation step without early finish...');
  const stepResult = await page.evaluate(async () => {
    const solver = window.UniversalSolver;

    // Mock AIEngine to return Option D (Control roll)
    window.AIEngine = {
      solveMCQ: async () => ({ success: true, letter: 'D', answer: 'Control roll' })
    };

    const logs = [];
    const updateStatus = (msg) => logs.push(msg);

    // Wire up option click delegation & simulated async check-answer
    const btnNext = document.getElementById('btnNext');
    btnNext.disabled = true;

    const container = document.getElementById('quizContainer');
    container.addEventListener('click', (e) => {
      const li = e.target.closest('.quiz-options li');
      if (li) {
        li.classList.add('selected');
        setTimeout(() => { btnNext.disabled = false; }, 60);
      }
    });

    // Solve visible question
    const res = await solver._solveAllOnPage(updateStatus, () => true);

    // Wait 120ms for simulated API check-answer response
    await new Promise(r => setTimeout(r, 120));

    // Next button check
    const activeNext = solver.findNextButton();

    return {
      solveSuccess: res.allAnswered,
      optDSelected: document.querySelectorAll('.quiz-options li')[3].classList.contains('selected'),
      nextBtnEnabled: !btnNext.disabled,
      activeNextFound: !!activeNext,
      logs: logs.slice(-2)
    };
  });

  assert.strictEqual(stepResult.solveSuccess, true);
  assert.strictEqual(stepResult.optDSelected, true);
  assert.strictEqual(stepResult.nextBtnEnabled, true);
  assert.strictEqual(stepResult.activeNextFound, true);
  console.log('  Logs:', stepResult.logs);
  console.log('  ✅ TEST 5 PASSED: Auto-Pilot solves Q1, enables Next, and prepares advance.\n');

  await browser.close();

  console.log('══════════════════════════════════════════════════════════════');
  console.log('🎉 ALL MCQEXAMTEST AUTO-PILOT TESTS PASSED WITH 100% SUCCESS!');
  console.log('══════════════════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
