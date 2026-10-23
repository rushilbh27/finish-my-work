const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testLiveQ6Interaction() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 VERIFYING LIVE VUE 3 SELECTION ON QUIZPRACTICE.SPACE');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to live paper...');
  await page.goto('https://quizpractice.space/question-paper/practise/16/000bc6c7-688', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Read extension code
  const solverCode = fs.readFileSync(path.join(__dirname, '../content/universal-solver.js'), 'utf8');

  console.log('2. Injecting UniversalSolver into live page...');
  await page.evaluate((code) => {
    const s = document.createElement('script');
    s.textContent = code;
    (document.head || document.documentElement).appendChild(s);
  }, solverCode);

  console.log('3. Solving Questions 6, 7, and 10 via UniversalSolver...');
  const result = await page.evaluate(async () => {
    const solver = window.UniversalSolver;
    const questions = solver.detectAllQuestions();

    const q6 = questions.find(q => q.container?.id === 'question6' || q.id === 'question6');
    const q7 = questions.find(q => q.container?.id === 'question7' || q.id === 'question7');
    const q10 = questions.find(q => q.container?.id === 'question10' || q.id === 'question10');

    const res6 = await solver.solveQuestionItem(q6);
    await new Promise(r => setTimeout(r, 200));

    const res7 = await solver.solveQuestionItem(q7);
    await new Promise(r => setTimeout(r, 200));

    const res10 = await solver.solveQuestionItem(q10);
    await new Promise(r => setTimeout(r, 200));

    const btn1 = document.getElementById('r1334539');
    const q7Checkboxes = Array.from(document.getElementById('question7').querySelectorAll('input[type="checkbox"]')).map(cb => ({
      id: cb.id,
      checked: cb.checked
    }));
    const q10Input = document.getElementById('question10').querySelector('input');

    return {
      res6,
      res7,
      res10,
      q6State: {
        ariaChecked: btn1?.getAttribute('aria-checked'),
        dataState: btn1?.getAttribute('data-state'),
        hasSvg: !!btn1?.querySelector('svg')
      },
      q7State: q7Checkboxes,
      q10Value: q10Input?.value
    };
  });

  console.log('Q6 MCQ Result:', result.res6, result.q6State);
  console.log('Q7 MSQ Result:', result.res7, result.q7State);
  console.log('Q10 SA Result:', result.res10, 'Value:', result.q10Value);

  const q6Ok = result.q6State.ariaChecked === 'true' && result.q6State.dataState === 'checked' && result.q6State.hasSvg;
  const q7Ok = result.q7State[0].checked === true && result.q7State[1].checked === false && result.q7State[2].checked === true && result.q7State[3].checked === false;
  const q10Ok = result.q10Value === '1123';

  if (q6Ok && q7Ok && q10Ok) {
    console.log('\n🎉 ALL LIVE TESTS PASSED: MCQ, MSQ, AND NUMERIC INPUTS APPLIED FLAWLESSLY ON QUIZPRACTICE.SPACE!');
  } else {
    console.error('\n❌ TEST FAILED:', { q6Ok, q7Ok, q10Ok });
    process.exit(1);
  }

  await browser.close();
}

testLiveQ6Interaction().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
