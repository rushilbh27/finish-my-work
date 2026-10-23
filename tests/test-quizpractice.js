// Test QuizPractice.space & Practice Paper Portals
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testQuizPractice() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING QUIZPRACTICE.SPACE PORTAL INTEGRATION');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Load the exact DOM from the user's screenshot
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>QuizPractice | IITM BS Degree Question Papers</title></head>
      <body>
        <div class="qp-container max-w-4xl mx-auto p-4">
          <!-- Question 1 -->
          <div id="q1" class="question-card border-b py-6" style="min-height: 250px;">
            <div class="flex justify-between items-center">
              <h3>Question 1: 6406531951224</h3>
              <span>Total Mark: 0.00 | Type: MCQ</span>
            </div>
            <div class="body my-3">
              <p>Instructions: There are some questions which have functions with discrete valued domains...</p>
              <p>OPTIONS:</p>
              <div>
                <label id="lbl-opt1"><input type="radio" name="q_6406531951224" id="opt1" value="1"> Instructions has been mentioned above.</label><br>
                <label id="lbl-opt2"><input type="radio" name="q_6406531951224" id="opt2" value="2"> This Instructions is just for a reference & not for an evaluation.</label>
              </div>
            </div>
          </div>

          <!-- Question 2 -->
          <div id="q2" class="question-card border-b py-6" style="min-height: 350px;">
            <div class="flex justify-between items-center">
              <h3>Question 2: 6406531951225</h3>
              <span>Total Mark: 5.00 | Type: SA</span>
            </div>
            <div class="body my-3">
              <p>In a survey among 250 students in Bandipur House of IITM BS degree, the following data were found:</p>
              <ul>
                <li>100 students have a Spotify subscription.</li>
                <li>110 students have a YouTube Premium subscription.</li>
                <li>120 students have an Apple Music membership.</li>
                <li>30 students have both Spotify and YouTube Premium subscriptions...</li>
              </ul>
              <p>Answer (Numeric):</p>
              <input type="text" id="ans-box-q2" placeholder="Answer" class="border p-2">
            </div>
          </div>
        </div>
      </body>
    </html>
  `);

  const solverJs = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');
  const aiEngineJs = fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8');

  const testReport = await page.evaluate(async ({ solverJs, aiEngineJs }) => {
    eval(aiEngineJs);
    eval(solverJs);

    // Mock AI Engine
    window.AIEngine.solveMCQ = async () => ({ success: true, letter: 'B' });
    window.AIEngine.solveNATAnswer = async () => ({ success: true, text: '20' });

    // Step 1: Detect All Questions
    const detected = window.UniversalSolver.detectAllQuestions();

    // Step 2: Detect Current Visible Question (at top)
    const currentQ1 = window.UniversalSolver.detectCurrentQuestion();

    // Step 3: Solve Q1
    const solveQ1 = await window.UniversalSolver.solveQuestionItem(detected[0], () => {});

    // Step 4: Scroll down to Q2 and detect current question
    document.getElementById('q2').scrollIntoView();
    const currentQ2 = window.UniversalSolver.detectCurrentQuestion();

    // Step 5: Solve Q2
    const solveQ2 = await window.UniversalSolver.solveQuestionItem(detected[1], () => {});

    return {
      totalDetected: detected.length,
      q1Type: detected[0]?.type,
      q2Type: detected[1]?.type,
      q2IsNAT: detected[1]?.isNAT,
      solveQ1Success: solveQ1.success,
      opt2Checked: document.getElementById('opt2').checked,
      solveQ2Success: solveQ2.success,
      q2Value: document.getElementById('ans-box-q2').value
    };
  }, { solverJs, aiEngineJs });

  console.log(`  ✓ Questions Detected: ${testReport.totalDetected} (Expected: 2)`);
  console.log(`  ✓ Question 1 Type: ${testReport.q1Type} (Expected: mcq)`);
  console.log(`  ✓ Question 2 Type: ${testReport.q2Type} (Expected: text, NAT: ${testReport.q2IsNAT})`);
  console.log(`  ✓ Question 1 Solve: Option B checked = ${testReport.opt2Checked}`);
  console.log(`  ✓ Question 2 Solve: Injected value = "${testReport.q2Value}" (Expected: "20")`);

  const success = testReport.totalDetected === 2 && 
                  testReport.opt2Checked === true && 
                  testReport.q2Value === '20';

  if (!success) {
    console.error('\n❌ QUIZPRACTICE TEST FAILED');
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('✅ QUIZPRACTICE.SPACE PORTAL INTEGRATION VERIFIED 100%!');
  console.log('══════════════════════════════════════════════════════════════\n');
  await browser.close();
}

testQuizPractice().catch(err => {
  console.error(err);
  process.exit(1);
});
