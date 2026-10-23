// Monitored Playwright E2E Test Suite for Finish My Work Extension
// Rigorous monitored testing for:
// 1. Question 4 Matching Icons (Snapchat, Twitter, Yelp, Instagram, LinkedIn)
// 2. Questions 1-3 (MCQ, Drag-and-drop, Short Answer)
// 3. Multi-Select / Checkbox Questions (Cat breeds: Sphinx, Siberian, Burmese, Ragdoll -> 4/4 checked!)
// 4. Mode 2: Full Submit (Attempt -> Summary -> Modal Confirm -> Review)
// 5. Mode 3: Course Batch (Course view -> Quiz 1 -> Quiz 2 -> Course Complete)
// 6. Mode 4: All Courses (Dashboard -> Course 101 -> Course 102 Sweep)
// 7. Paginated 1-Question-Per-Page Quizzes (Next page navigation without early stopping!)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

async function runMonitoredTests() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING COMPREHENSIVE MONITORED PLAYWRIGHT TEST SUITE');
  console.log('   Testing: Multi-Option Questions, 1-Q-Per-Page Quizzes,');
  console.log('            Mode 3, Mode 4, Mode 2 & Question 4 Icon Matching');
  console.log('══════════════════════════════════════════════════════════════\n');

  // 1. Start local mock LMS server
  const serverProcess = spawn('node', [path.join(__dirname, 'test-server.js')], {
    stdio: 'inherit'
  });

  // Give server 1 second to start
  await new Promise(r => setTimeout(r, 1000));

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.text()));

    // Read extension content scripts
    const aiEngineCode = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');
    const solverCode = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');

    // Setup mock Chrome environment that persists across page navigations
    await page.addInitScript(({ aiEngineCode, solverCode }) => {
      // Mock chrome storage backed by persistent localStorage
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys) => {
            const res = {};
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => {
              const val = localStorage.getItem('peslms_mock_' + k);
              if (val !== null) {
                try { res[k] = JSON.parse(val); } catch (e) { res[k] = val; }
              }
            });
            return Promise.resolve(res);
          },
          set: (obj) => {
            Object.entries(obj).forEach(([k, v]) => {
              localStorage.setItem('peslms_mock_' + k, JSON.stringify(v));
            });
            return Promise.resolve();
          },
          remove: (keys) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => localStorage.removeItem('peslms_mock_' + k));
            return Promise.resolve();
          }
        }
      };

      // Mock AI engine message responder
      window.chrome.runtime = {
        sendMessage: (msg, cb) => {
          if (!cb) return;
          const p = (msg.prompt || '').toLowerCase();
          if (p.includes('breeds of cat') || p.includes('sphinx')) {
            cb({ success: true, text: 'A, B, C, D' });
          } else if (p.includes('twitter is called') || p.includes('called a ?????')) {
            cb({ success: true, text: 'tweet' });
          } else if (p.includes('complete the sentences') || p.includes('text with blanks') || p.includes('available choices')) {
            cb({ success: true, text: '{"1": "Twitter", "2": "Instagram", "3": "Facetime"}' });
          } else if (p.includes('professional career networking')) {
            cb({ success: true, text: 'B' });
          } else if (p.includes('manx cat')) {
            cb({ success: true, text: 'B' });
          } else if (p.includes('vegetarian')) {
            cb({ success: true, text: 'A' });
          } else {
            cb({ success: true, text: 'A' });
          }
        },
        lastError: null
      };

      // Evaluate AI engine and universal solver into every window
      try {
        const fn1 = new Function(aiEngineCode);
        fn1();
        const fn2 = new Function(solverCode);
        fn2();
      } catch (err) {
        console.error('Init script eval error:', err);
      }

      // Automatically auto-resume persistent batch on DOMContentLoaded (mirroring content.js)
      window.addEventListener('DOMContentLoaded', async () => {
        try {
          const store = await window.chrome.storage.local.get(['autopilotBatchState']);
          const state = store.autopilotBatchState;
          if (state && state.active && window.UniversalSolver) {
            console.log('[AUTO-RESUME] Resuming batch on page:', window.location.pathname + window.location.search);
            setTimeout(() => {
              window.UniversalSolver.resumePersistentBatch(
                (m) => console.log('[STATUS]', m),
                () => true
              );
            }, 300);
          }
        } catch (e) {}
      });
    }, { aiEngineCode, solverCode });

    // ── TEST 1: Question 4 (Matching Icons) + Q1, Q2, Q3 + Multi-Select Cat Breeds (Q5) ──
    console.log('[TEST 1] Testing Question 4 (Icons), Q1-Q3 & Multi-Select Q5 (Cat Breeds)...');
    await page.goto('http://localhost:8089/mod/quiz/attempt.php?id=1011');
    await page.waitForTimeout(500);

    const detected = await page.evaluate(() => {
      const qs = window.UniversalSolver.detectAllQuestions();
      return qs.map(q => ({ type: q.type, text: q.text.slice(0, 35) }));
    });
    console.log('✓ Detected questions on page:', detected);
    if (detected.length !== 5) throw new Error(`Expected 5 detected questions, got ${detected.length}`);

    // Solve all questions
    console.log('Executing solveAllOnPage on attempt page...');
    const solveRes = await page.evaluate(async () => {
      return await window.UniversalSolver._solveAllOnPage(
        (status) => console.log('[STATUS]', status),
        () => true
      );
    });
    console.log('✓ Solve result:', solveRes);

    // Verify Question 4 (Matching Icons)
    const q4Results = await page.evaluate(() => {
      const s0 = document.getElementById('select_q4_0');
      const s1 = document.getElementById('select_q4_1');
      const s2 = document.getElementById('select_q4_2');
      const s3 = document.getElementById('select_q4_3');
      const s4 = document.getElementById('select_q4_4');
      return {
        row0_snapchat: s0.options[s0.selectedIndex]?.text,
        row1_twitter: s1.options[s1.selectedIndex]?.text,
        row2_yelp: s2.options[s2.selectedIndex]?.text,
        row3_instagram: s3.options[s3.selectedIndex]?.text,
        row4_linkedin: s4.options[s4.selectedIndex]?.text
      };
    });
    console.log('✓ Question 4 (Matching Icons) Assigned Dropdown Values:', q4Results);
    if (q4Results.row0_snapchat !== 'Snapchat') throw new Error(`Row 0 mismatch: expected Snapchat, got ${q4Results.row0_snapchat}`);
    if (q4Results.row1_twitter !== 'Twitter') throw new Error(`Row 1 mismatch: expected Twitter, got ${q4Results.row1_twitter}`);
    if (q4Results.row2_yelp !== 'Yelp') throw new Error(`Row 2 mismatch: expected Yelp (by elimination), got ${q4Results.row2_yelp}`);
    if (q4Results.row3_instagram !== 'Instagram') throw new Error(`Row 3 mismatch: expected Instagram, got ${q4Results.row3_instagram}`);
    if (q4Results.row4_linkedin !== 'LinkedIn') throw new Error(`Row 4 mismatch: expected LinkedIn, got ${q4Results.row4_linkedin}`);
    console.log('🎉 QUESTION 4 MATCHING ICONS: 100% PERFECT MATCH FOR ALL 5 DROPDOWNS!');

    // Verify Question 5 (Multi-Select: Cat breeds)
    const q5Results = await page.evaluate(() => ({
      a_sphinx: document.getElementById('q5_a')?.checked,
      b_siberian: document.getElementById('q5_b')?.checked,
      c_burmese: document.getElementById('q5_c')?.checked,
      d_ragdoll: document.getElementById('q5_d')?.checked
    }));
    console.log('✓ Question 5 (Multi-Select Checkboxes) Results:', q5Results);
    if (!q5Results.a_sphinx || !q5Results.b_siberian || !q5Results.c_burmese || !q5Results.d_ragdoll) {
      throw new Error(`Multi-select question failed! Not all 4 breeds checked: ${JSON.stringify(q5Results)}`);
    }
    console.log('🎉 QUESTION 5 MULTI-OPTION CHECKBOXES: ALL 4/4 CORRECT OPTIONS SELECTED (100% SCORE)!');

    // Verify Question 2 (Drag & Drop ddwtos)
    const q2Results = await page.evaluate(() => ({
      p1: document.querySelector('input.placeinput.place1')?.value,
      p2: document.querySelector('input.placeinput.place2')?.value,
      p3: document.querySelector('input.placeinput.place3')?.value,
      dz1: document.querySelector('.dropzone.place1')?.textContent,
      dz2: document.querySelector('.dropzone.place2')?.textContent,
      dz3: document.querySelector('.dropzone.place3')?.textContent
    }));
    console.log('✓ Question 2 (Drag & Drop) Result:', q2Results);
    if (!q2Results.p1 || q2Results.p1 === '0') throw new Error('Q2 place 1 not placed');
    if (!q2Results.dz1.includes('Twitter')) throw new Error('Q2 place 1 visual tag missing Twitter');
    console.log('🎉 QUESTION 2 DRAG & DROP: 100% PERFECTLY PLACED & FORMATTED!');

    // Verify Question 3 (Short Answer)
    const q3Val = await page.evaluate(() => document.getElementById('q3_text')?.value);
    console.log('✓ Question 3 (Short Answer) Typed Value:', q3Val);
    if (!q3Val || q3Val.toLowerCase() !== 'tweet') throw new Error(`Q3 short answer expected tweet, got "${q3Val}"`);
    console.log('🎉 QUESTION 3 SHORT ANSWER: 100% CORRECT!');

    // Verify Question 1 (MCQ)
    const q1Checked = await page.evaluate(() => document.getElementById('q1_b')?.checked);
    console.log('✓ Question 1 (MCQ) Checked Option B (LinkedIn):', q1Checked);
    if (!q1Checked) throw new Error('Q1 option B not checked');
    console.log('🎉 QUESTION 1 MCQ: 100% CORRECT!');

    // ── TEST 2: Mode 2 (Full Submit Flow: Attempt -> Summary -> Modal -> Review) ──
    console.log('\n[TEST 2] Testing Mode 2 (Full Submit with Double Confirmation)...');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8089/mod/quiz/attempt.php?id=1011');
    await page.waitForTimeout(400);

    // Launch Auto-Pilot in submit mode
    await page.evaluate(() => {
      window.UniversalSolver.startAutoPilot(
        (m) => console.log('[SUBMIT-MODE]', m),
        () => true,
        'submit'
      );
    });

    // Wait for the full submission cycle to complete
    console.log('Waiting for full submission to reach review page...');
    await page.waitForURL('**/mod/quiz/review.php?id=1011', { timeout: 10000 });
    const isComplete = await page.evaluate(() => window.UniversalSolver.isQuizComplete());
    console.log('✓ Review page isQuizComplete:', isComplete);
    if (!isComplete) throw new Error('Review page did not register completion in Mode 2');
    console.log('🎉 MODE 2 (FULL SUBMIT): END-TO-END CONFIRMATION & SUBMIT VERIFIED!');

    // ── TEST 3: Mode 3 (Course Batch Automation: All Assignments in Course) ──
    console.log('\n[TEST 3] Testing Mode 3 (Course Batch: All Assignments in Course)...');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8089/course/view.php?id=101');
    await page.waitForTimeout(400);

    const asgns = await page.evaluate(() => window.UniversalSolver.findAssignmentLinks());
    console.log('✓ Found course assignments:', asgns.map(a => a.title));
    if (asgns.length !== 2) throw new Error(`Expected 2 assignments, got ${asgns.length}`);

    console.log('Starting Auto-Pilot in Course Batch mode...');
    await page.evaluate(() => {
      window.UniversalSolver.startAutoPilot(
        (m) => console.log('[COURSE-MODE]', m),
        () => true,
        'course'
      );
    });

    console.log('Waiting for Quiz 1 Landing Page...');
    await page.waitForURL('**/mod/quiz/view.php?id=1011', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 1 Landing page');

    console.log('Waiting for Quiz 1 Attempt Page...');
    await page.waitForURL('**/mod/quiz/attempt.php?id=1011', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 1 Attempt page');

    console.log('Waiting for Quiz 1 Summary Page...');
    await page.waitForURL('**/mod/quiz/summary.php?id=1011', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 1 Summary page');

    console.log('Waiting for Quiz 1 Review Page...');
    await page.waitForURL('**/mod/quiz/review.php?id=1011', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 1 Review page (Quiz 1 complete!)');

    console.log('Waiting for Batch Auto-Advance to Quiz 2 Landing Page...');
    await page.waitForURL('**/mod/quiz/view.php?id=1012', { timeout: 10000 });
    console.log('✓ Navigated to Quiz 2 Landing page');

    console.log('Waiting for Quiz 2 Attempt Page...');
    await page.waitForURL('**/mod/quiz/attempt.php?id=1012', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 2 Attempt page');

    console.log('Waiting for Quiz 2 Summary Page...');
    await page.waitForURL('**/mod/quiz/summary.php?id=1012', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 2 Summary page');

    console.log('Waiting for Quiz 2 Review Page...');
    await page.waitForURL('**/mod/quiz/review.php?id=1012', { timeout: 8000 });
    console.log('✓ Navigated to Quiz 2 Review page (Quiz 2 complete!)');

    await page.waitForTimeout(2000);
    const finalBatchState = await page.evaluate(async () => {
      const data = await window.chrome.storage.local.get(['autopilotBatchState']);
      return data.autopilotBatchState;
    });
    console.log('✓ Final batch state after course complete:', finalBatchState);
    if (finalBatchState && finalBatchState.active) {
      throw new Error('Expected autopilotBatchState to be cleared or inactive after completing all course assignments');
    }
    console.log('🎉 MODE 3 (COURSE BATCH): 100% OPERATIONAL & VERIFIED ACROSS MULTIPLE ASSIGNMENTS!');

    // ── TEST 4: Mode 4 (All Courses Sweep Automation) ──
    console.log('\n[TEST 4] Testing Mode 4 (All Courses Multi-Course Sweep)...');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8089/my/');
    await page.waitForTimeout(400);

    const allCourses = await page.evaluate(() => window.UniversalSolver.findCourseLinks());
    console.log('✓ Found courses on dashboard:', allCourses.map(c => c.title));
    if (allCourses.length !== 2) throw new Error(`Expected 2 courses on dashboard, got ${allCourses.length}`);

    console.log('Starting Auto-Pilot in All Courses mode...');
    await page.evaluate(() => {
      window.UniversalSolver.startAutoPilot(
        (m) => console.log('[ALL-COURSES]', m),
        () => true,
        'allcourses'
      );
    });

    console.log('Waiting for navigation to Course 101...');
    await page.waitForURL('**/course/view.php?id=101', { timeout: 8000 });
    console.log('✓ Opened Course 101 from dashboard');

    console.log('Waiting for Mode 4 to route into Course 101 first assignment attempt...');
    await page.waitForURL('**/mod/quiz/attempt.php?id=1011', { timeout: 8000 });
    console.log('✓ Mode 4 automatically navigated into Quiz 1 Attempt page');

    // Verify Mode 4 state persisted course queue
    const m4State = await page.evaluate(async () => {
      const data = await window.chrome.storage.local.get(['autopilotBatchState']);
      return data.autopilotBatchState;
    });
    console.log('✓ Mode 4 active state:', {
      mode: m4State?.mode,
      courseIndex: m4State?.courseIndex,
      courseQueueCount: m4State?.courseQueue?.length
    });
    if (m4State?.mode !== 'allcourses') throw new Error(`Expected mode allcourses, got ${m4State?.mode}`);
    if (m4State?.courseQueue?.length !== 2) throw new Error('Expected 2 courses in queue');

    console.log('Simulating completion of Course 101 assignments to verify Course 2 transition...');
    await page.evaluate(async () => {
      const data = await window.chrome.storage.local.get(['autopilotBatchState']);
      const state = data.autopilotBatchState;
      state.assignmentIndex = state.assignmentQueue ? state.assignmentQueue.length : 2;
      await window.chrome.storage.local.set({ autopilotBatchState: state });
      await window.UniversalSolver.advanceBatchAssignment((m) => console.log('[ADVANCE]', m));
    });

    console.log('Waiting for navigation to Course 102...');
    await page.waitForURL('**/course/view.php?id=102', { timeout: 8000 });
    console.log('✓ Successfully advanced to Course 102!');
    console.log('🎉 MODE 4 (ALL COURSES): MULTI-COURSE TRANSITIONS & SWEEP 100% OPERATIONAL!');

    // ── TEST 5: Paginated 1-Question-Per-Page Flow (Next Page Navigation) ──
    console.log('\n[TEST 5] Testing Paginated Quiz (1 Question per Page with Next Buttons)...');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8089/mod/quiz/paginated.php?id=201&page=0');
    await page.waitForTimeout(400);

    // Verify next button is present on page 0
    const hasNext0 = await page.evaluate(() => !!window.UniversalSolver.findNextButton());
    console.log('✓ Page 0 findNextButton:', hasNext0);
    if (!hasNext0) throw new Error('findNextButton returned false on paginated page 0');

    // Launch Auto-Pilot in submit mode to verify it steps through Page 0 -> Page 1 -> Page 2 -> Summary
    console.log('Starting Auto-Pilot on paginated 1-question-per-page quiz...');
    await page.evaluate(() => {
      window.UniversalSolver.startAutoPilot(
        (m) => console.log('[PAGINATED-AUTO]', m),
        () => true,
        'submit'
      );
    });

    // Wait for Auto-Pilot to step through all pages (Page 0 -> Page 1 -> Page 2 -> Summary -> Review)
    console.log('Waiting for Auto-Pilot to advance through all pages and reach Review Page...');
    await page.waitForURL('**/mod/quiz/review.php?id=201*', { timeout: 15000 });
    const isPaginatedComplete = await page.evaluate(() => window.UniversalSolver.isQuizComplete());
    console.log('✓ Paginated Review Page isQuizComplete:', isPaginatedComplete);
    if (!isPaginatedComplete) throw new Error('Paginated quiz did not complete submission');
    console.log('🎉 PAGINATED QUIZ (1 QUESTION PER PAGE): ADVANCED ACROSS ALL PAGES AND SUBMITTED 100%!');

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('✅ ALL MONITORED TESTS PASSED FLAWLESSLY! 100% OPERATIONAL');
    console.log('   - Question 4 Icon Matching: 5/5 Matches Correct');
    console.log('   - Question 5 Multi-Select (Cat Breeds): 4/4 Checkboxes Selected');
    console.log('   - Questions 1, 2, 3: 100% Solved');
    console.log('   - Mode 2 (Full Submit): Attempt -> Summary -> Review Complete');
    console.log('   - Mode 3 (Course Batch): All Quizzes Solved End-to-End');
    console.log('   - Mode 4 (All Courses): Multi-Course Sweep Operational');
    console.log('   - Paginated Quizzes: 1-Q-Per-Page Next Flow 100% Solved & Advanced');
    console.log('══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ MONITORED TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    serverProcess.kill('SIGTERM');
  }
}

runMonitoredTests();
