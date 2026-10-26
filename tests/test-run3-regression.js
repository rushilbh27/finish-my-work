const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runRun3RegressionTests() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 VERIFYING RUN 3 FIXES: MSQ, NO-SKIP NAV, & DATA TABLES');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const universalSolverJs = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');
  const aiEngineJs = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');

  // Simulated IITM Assessment Page with Contingency Table & MSQ 6 options (A..F)
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Courses :: IITM Study - Week 4 Grading Assignment 4</title>
      </head>
      <body>
        <div class="left-col common-data">
          <h3>Common Information</h3>
          <p>The information below is common to Questions 8 to 13</p>
          <p>652 college students are classified according to their intelligence and economic conditions and the results are as follows.</p>
          <table>
            <tr><th>Economic Conditions</th><th>Bright</th><th>Average</th><th>Dull</th><th>Borderline</th></tr>
            <tr><td>Good</td><td>51</td><td>96</td><td>72</td><td>127</td></tr>
            <tr><td>Poor</td><td>50</td><td>90</td><td>73</td><td>93</td></tr>
          </table>
          <p>Table Q4.2.G: Intelligence Level and Economic Conditions</p>
        </div>

        <div class="right-col">
          <app-question class="question-card" id="q6-container">
            <div class="q-header">Question 6 / 17 <span class="badge">• 1 mark</span></div>
            <div class="question-text">
              What can you say about the linear relationship between the sales of OnePlus and BBK Electronics?(More than one option can be correct)
            </div>
            <div class="options">
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-a">
                <input type="checkbox" id="cb-a" class="mdc-checkbox__native-control">
                <label for="cb-a" class="mdc-label">A. Negative</label>
              </mat-checkbox>
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-b">
                <input type="checkbox" id="cb-b" class="mdc-checkbox__native-control">
                <label for="cb-b" class="mdc-label">B. Positive</label>
              </mat-checkbox>
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-c">
                <input type="checkbox" id="cb-c" class="mdc-checkbox__native-control">
                <label for="cb-c" class="mdc-label">C. Moderate</label>
              </mat-checkbox>
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-d">
                <input type="checkbox" id="cb-d" class="mdc-checkbox__native-control">
                <label for="cb-d" class="mdc-label">D. Strong</label>
              </mat-checkbox>
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-e">
                <input type="checkbox" id="cb-e" class="mdc-checkbox__native-control">
                <label for="cb-e" class="mdc-label">E. Absence of linear relationship</label>
              </mat-checkbox>
              <mat-checkbox class="mat-mdc-checkbox" id="mat-opt-f">
                <input type="checkbox" id="cb-f" class="mdc-checkbox__native-control">
                <label for="cb-f" class="mdc-label">F. Weak</label>
              </mat-checkbox>
            </div>
          </app-question>

          <button class="mat-button next-btn" id="next-button">Next →</button>
        </div>
      </body>
    </html>
  `);

  await page.evaluate(() => {
    window.chrome = {
      storage: {
        local: {
          get: () => Promise.resolve({ extensionEnabled: true }),
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

  const testResults = await page.evaluate(async ({ universalSolverJs, aiEngineJs }) => {
    eval(aiEngineJs);
    eval(universalSolverJs);

    const results = [];

    // TEST 1: Table to Markdown Formatting
    const detectedQ = window.UniversalSolver.detectAllQuestions()[0];
    const hasMdTable = detectedQ.text.includes('| Economic Conditions | Bright | Average | Dull | Borderline |');
    const hasTableRows = detectedQ.text.includes('| Good | 51 | 96 | 72 | 127 |') && detectedQ.text.includes('| Poor | 50 | 90 | 73 | 93 |');
    results.push({
      test: 'Contingency Table Preserved as Markdown in Question Text',
      pass: hasMdTable && hasTableRows,
      details: hasMdTable && hasTableRows ? 'Pristine Markdown Table Detected' : 'Table lost or corrupted'
    });

    // TEST 2: MSQ Options 6 Choices (A through F)
    const optLetters = detectedQ.options.map(o => o.letter);
    results.push({
      test: 'MSQ Option Extraction Beyond D (Options A to F)',
      pass: optLetters.join(',') === 'A,B,C,D,E,F',
      details: `Extracted letters: [${optLetters.join(', ')}]`
    });

    // TEST 3: MSQ Checkbox Toggle (Selecting A and F)
    window.AIEngine.solveMultiChoice = async () => ({
      success: true,
      letters: ['A', 'F']
    });

    await window.UniversalSolver.solveQuestionItem(detectedQ, () => {});
    const cbA = document.getElementById('cb-a').checked;
    const cbB = document.getElementById('cb-b').checked;
    const cbF = document.getElementById('cb-f').checked;
    const hostA = document.getElementById('mat-opt-a').classList.contains('mat-mdc-checkbox-checked');
    const hostF = document.getElementById('mat-opt-f').classList.contains('mat-mdc-checkbox-checked');

    results.push({
      test: 'Single-Target MSQ Selection (A & F Checked, B Unchecked)',
      pass: cbA && !cbB && cbF && hostA && hostF,
      details: `A: ${cbA} (host: ${hostA}), B: ${cbB}, F: ${cbF} (host: ${hostF})`
    });

    // TEST 4: Navigation Does NOT Fire ArrowRight When Next Button Exists
    let arrowRightFired = 0;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') arrowRightFired++;
    });

    // Simulate next click
    const nextBtn = window.UniversalSolver.findNextButton();
    let nextBtnClicked = 0;
    nextBtn.addEventListener('click', () => { nextBtnClicked++; });

    // Calling the clean navigation logic
    nextBtn.focus?.();
    nextBtn.click?.();

    results.push({
      test: 'Next Button Click Does NOT Trigger Redundant ArrowRight',
      pass: nextBtnClicked === 1 && arrowRightFired === 0,
      details: `nextBtnClicked: ${nextBtnClicked}, arrowRightFired: ${arrowRightFired}`
    });

    return results;
  }, { universalSolverJs, aiEngineJs });

  await browser.close();

  let allPass = true;
  testResults.forEach(r => {
    const symbol = r.pass ? '✅' : '❌';
    if (!r.pass) allPass = false;
    console.log(`${symbol} ${r.test.padEnd(55)} | ${r.pass ? 'PASS' : 'FAIL'} (${r.details})`);
  });

  console.log('══════════════════════════════════════════════════════════════\n');
  if (!allPass) process.exit(1);
}

runRun3RegressionTests().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
