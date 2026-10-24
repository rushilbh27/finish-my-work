// Test for MSQ Checkbox interaction, Question Number Detection, and Two-Pass MSQ Parsing
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runMsqAndQNumTests() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING MSQ CHECKBOXES & DYNAMIC QUESTION NUMBERING');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const universalSolverJs = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');
  const aiEngineJs = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');

  // Simulated Angular Material 18 IITM Assessment Page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Courses :: IITM Study - Week 3 Graded Assignment 3</title>
        <style>
          .circle-btn { width: 30px; height: 30px; border-radius: 50%; }
          .circle-btn.active { border: 2px solid #fff; }
          .mat-mdc-checkbox { display: flex; align-items: center; cursor: pointer; }
          .mat-mdc-checkbox input { pointer-events: none; opacity: 0; }
        </style>
      </head>
      <body>
        <div class="palette question-nav">
          <button class="circle-btn">8</button>
          <button class="circle-btn">9</button>
          <button class="circle-btn active" aria-current="true">10</button>
          <button class="circle-btn">11</button>
        </div>

        <div class="container">
          <div class="right-col">
            <app-question class="question-card">
              <div class="q-header">Question 10 / 17 <span class="badge">• 1 mark</span> <button class="flag-btn">Flag for review</button></div>
              <div class="question-text">
                Which of the following options is/are true?
              </div>
              <div class="options">
                <mat-checkbox class="mat-mdc-checkbox" id="mat-cb-a">
                  <div class="mdc-checkbox">
                    <input type="checkbox" id="cb-a" class="mdc-checkbox__native-control">
                  </div>
                  <label for="cb-a" class="mdc-label">A. The point at which the slope of the equation x^2 + 2x - 5 equals 10 is (4,17)</label>
                </mat-checkbox>

                <mat-checkbox class="mat-mdc-checkbox" id="mat-cb-b">
                  <div class="mdc-checkbox">
                    <input type="checkbox" id="cb-b" class="mdc-checkbox__native-control">
                  </div>
                  <label for="cb-b" class="mdc-label">B. x = 2 is the axis of symmetry of quadratic function f(x) = x^2 + 4x + 5</label>
                </mat-checkbox>

                <mat-checkbox class="mat-mdc-checkbox" id="mat-cb-c">
                  <div class="mdc-checkbox">
                    <input type="checkbox" id="cb-c" class="mdc-checkbox__native-control">
                  </div>
                  <label for="cb-c" class="mdc-label">C. If two different quadratic equations have the same discriminant then the roots of both equations can be the same.</label>
                </mat-checkbox>

                <mat-checkbox class="mat-mdc-checkbox" id="mat-cb-d">
                  <div class="mdc-checkbox">
                    <input type="checkbox" id="cb-d" class="mdc-checkbox__native-control">
                  </div>
                  <label for="cb-d" class="mdc-label">D. The point at which the slope of the equation x^2 + 2x - 5 equals 10 is (4,19)</label>
                </mat-checkbox>
              </div>
            </app-question>
          </div>
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

    // TEST 1: Question Number Detection
    const detectedQ = window.UniversalSolver.detectCurrentQuestion();
    const realNum = window.UniversalSolver.extractRealQuestionNumber(detectedQ?.container);
    results.push({
      test: 'Dynamic Question Number Detection (Question 10 / 17)',
      pass: detectedQ?.questionNum === 10 && realNum === 10,
      details: `Detected qNum: ${detectedQ?.questionNum}, realNum: ${realNum}`
    });

    // TEST 2: MSQ Letter Parsing with Negative Sentences
    const negativeExplanation = `
      Step-by-step evaluation:
      - Option A: y' = 2x + 2 = 10 => x = 4. y(4) = 19 != 17. Therefore Option A is false.
      - Option B: Axis of symmetry is x = -b/(2a) = -2. Option B is false.
      - Option C: Two different quadratic equations can have the same roots if one is negative of the other. Option C is true.
      - Option D: (4,19) satisfies the equation. Option D is true.

      FINAL_VERIFIED: C, D
    `;
    const parsedLetters = window.AIEngine.parseMSQLetters(negativeExplanation, 4);
    results.push({
      test: 'MSQ Negative Sentence Filtering (Excluding false letters A, B)',
      pass: parsedLetters.length === 2 && parsedLetters[0] === 'C' && parsedLetters[1] === 'D',
      details: `Parsed letters: [${parsedLetters.join(', ')}]`
    });

    // TEST 3: Mock MSQ Solver & Angular Material Checkbox Clicking
    window.AIEngine.solveMultiChoice = async () => ({
      success: true,
      letters: ['C', 'D']
    });

    const solveRes = await window.UniversalSolver.solve(() => {});
    const cbA = document.getElementById('cb-a').checked;
    const cbB = document.getElementById('cb-b').checked;
    const cbC = document.getElementById('cb-c').checked;
    const cbD = document.getElementById('cb-d').checked;
    const hostC = document.getElementById('mat-cb-c').classList.contains('mat-mdc-checkbox-checked');
    const hostD = document.getElementById('mat-cb-d').classList.contains('mat-mdc-checkbox-checked');

    results.push({
      test: 'Angular Material 18 Checkbox State & Class Toggling',
      pass: !cbA && !cbB && cbC && cbD && hostC && hostD,
      details: `A: ${cbA}, B: ${cbB}, C: ${cbC} (host: ${hostC}), D: ${cbD} (host: ${hostD})`
    });

    results.push({
      test: 'Solve Result Question Number Sync',
      pass: solveRes.questionNum === 10 && solveRes.answer === 'C, D',
      details: `solveRes.questionNum: ${solveRes.questionNum}, answer: ${solveRes.answer}`
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

runMsqAndQNumTests().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
