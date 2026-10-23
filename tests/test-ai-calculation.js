// Unit test for AI calculation & parsing when NO answer key is provided
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
  createElement: () => ({ getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/png;base64,mock' }),
  querySelectorAll: () => [],
  querySelector: () => null
};

eval(fs.readFileSync(path.join(__dirname, '../content/ai-engine.js'), 'utf8'));

async function testAICalculationPipeline() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING AI CALCULATION PIPELINE (NO ANSWER KEYS)');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Test 1: Verify prompt formatting and number extraction from multi-step reasoning outputs
  const mockReasoningOutput1 = `
<think>
Line equation is 2x + y + 3 = 0, so slope m = -2.
Line passes through (-1, 1), so equation is y - 1 = -2(x - (-1)) = -2x - 2.
y = -2x - 1.
It also passes through (1, k).
Substituting x = 1: k = -2(1) - 1 = -3.
</think>
To find the value of k, we determine the slope of 2x + y + 3 = 0, which is -2.
Using point-slope form with (-1, 1): y - 1 = -2(x + 1) => y = -2x - 1.
For (1, k): k = -2(1) - 1 = -3.
-3
  `;

  // Simulate generateAnswer returning this response
  window.AIEngine.generateAnswer = async () => ({ success: true, text: mockReasoningOutput1 });
  const natRes1 = await window.AIEngine.solveNATAnswer("Find the value of k for which the line parallel to 2x+y+3=0 and passing through (-1,1) also passes through (1,k).");
  console.log(`  ✓ Line slope problem: extracted "${natRes1.text}" (Expected: "-3")`);

  // Test 2: Quadratic interval problem
  const mockReasoningOutput2 = `
<think>
-x^2 + x + 6 > 0 => x^2 - x - 6 < 0 => (x - 3)(x + 2) < 0.
So x in (-2, 3).
Here a = -2, b = 3.
b - a = 3 - (-2) = 5.
</think>
The interval where the expression is positive is (-2, 3).
Therefore, b - a = 3 - (-2) = 5.
5
  `;
  window.AIEngine.generateAnswer = async () => ({ success: true, text: mockReasoningOutput2 });
  const natRes2 = await window.AIEngine.solveNATAnswer("Find b - a for quadratic -x^2 + x + 6 > 0");
  console.log(`  ✓ Quadratic interval: extracted "${natRes2.text}" (Expected: "5")`);

  // Test 3: Rejection of conversational AI refusal/hallucination
  const mockConversationalRefusal = "Could you please provide the full numeric question you'd like solved?";
  window.AIEngine.generateAnswer = async () => ({ success: true, text: mockConversationalRefusal });
  const natRes3 = await window.AIEngine.solveNATAnswer("Incomplete question");
  console.log(`  ✓ Refusal rejection: success = ${natRes3.success} (Expected: false, no text typed)`);

  // Test 4: Decimal limit calculation
  const mockReasoningOutput4 = `
<think>
Divide numerator and denominator by n:
(2 + 5(-1)^n / n) / (4 - 3(-1)^n / n).
As n -> inf, (-1)^n / n -> 0.
Limit is 2/4 = 0.5.
</think>
The limit is 2/4 = 0.5.
0.5
  `;
  window.AIEngine.generateAnswer = async () => ({ success: true, text: mockReasoningOutput4 });
  const natRes4 = await window.AIEngine.solveNATAnswer("Find lim a_n as n -> inf");
  console.log(`  ✓ Limit calculation: extracted "${natRes4.text}" (Expected: "0.5")`);

  const allPassed = natRes1.text === '-3' && natRes2.text === '5' && natRes3.success === false && natRes4.text === '0.5';
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`🏆 AI CALCULATION PIPELINE: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!allPassed) process.exit(1);
}

testAICalculationPipeline().catch(console.error);
