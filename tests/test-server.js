// Mock Moodle LMS Server for E2E Testing of Finish My Work Extension
const http = require('http');
const url = require('url');

const PORT = 8089;

// SVG Icons matching the user's test quiz
const ICONS = {
  snapchat: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#FFFC00"/><path d="M32 14c-7 0-11 5-11 11 0 3 1 5 1 6-2 1-5 2-5 4 0 2 3 3 4 3 0 2-2 5-6 6 0 1 2 2 5 2 2 0 4-1 6-2 3 2 7 2 10 0 2 1 4 2 6 2 3 0 5-1 5-2-4-1-6-4-6-6 1 0 4-1 4-3 0-2-3-3-5-4 0-1 1-3 1-6 0-6-4-11-11-11z" fill="#FFF" stroke="#000" stroke-width="2"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1DA1F2"/><path d="M48 22c-1.3.6-2.7 1-4.2 1.2 1.5-.9 2.6-2.4 3.2-4.1-1.4.9-3 1.5-4.7 1.8-1.3-1.4-3.3-2.3-5.4-2.3-4.1 0-7.4 3.3-7.4 7.4 0 .6.1 1.2.2 1.7-6.2-.3-11.6-3.3-15.3-7.8-.6 1.1-1 2.4-1 3.7 0 2.6 1.3 4.8 3.3 6.1-1.2 0-2.4-.4-3.4-.9v.1c0 3.6 2.6 6.6 6 7.3-.6.2-1.3.3-2 .3-.5 0-1 0-1.4-.1 1 3 3.7 5.1 7 5.2-2.5 2-5.8 3.2-9.3 3.2-.6 0-1.2 0-1.8-.1 3.3 2.1 7.2 3.4 11.4 3.4 13.7 0 21.2-11.4 21.2-21.2v-1c1.5-1.1 2.7-2.4 3.7-3.9z" fill="#FFF"/></svg>`,
  yelp: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#2E75B6"/><g fill="#FFF"><ellipse cx="32" cy="18" rx="4" ry="8"/><ellipse cx="44" cy="25" rx="8" ry="4" transform="rotate(30 44 25)"/><ellipse cx="44" cy="39" rx="8" ry="4" transform="rotate(-30 44 39)"/><ellipse cx="32" cy="46" rx="4" ry="8"/><ellipse cx="20" cy="39" rx="8" ry="4" transform="rotate(30 20 39)"/><ellipse cx="20" cy="25" rx="8" ry="4" transform="rotate(-30 20 25)"/></g></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#586574"/><rect x="16" y="16" width="32" height="32" rx="8" fill="none" stroke="#FFF" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="none" stroke="#FFF" stroke-width="3"/><circle cx="41" cy="23" r="2" fill="#FFF"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0077B5"/><text x="18" y="44" font-family="Arial, sans-serif" font-weight="bold" font-size="28" fill="#FFF">in</text></svg>`
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // Serve SVG Icons
  if (path.startsWith('/icon/')) {
    const name = path.replace('/icon/', '').replace('.svg', '');
    if (ICONS[name]) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(ICONS[name]);
      return;
    }
  }

  // Serve mock CSS
  if (path.endsWith('.css')) {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end('/* mock styles */');
    return;
  }

  // ── 1. Dashboard (All Courses View) ──
  if (path === '/' || path === '/my/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>My Courses Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <div class="course-listitem">
          <a class="coursename" href="/course/view.php?id=101">Course 101: Digital Media</a>
        </div>
        <div class="course-listitem">
          <a class="coursename" href="/course/view.php?id=102">Course 102: Web Communication</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ── 2. Course View Page (Course Batch View) ──
  if (path === '/course/view.php') {
    const courseId = parsed.query.id || '101';
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Course ${courseId}</title></head>
      <body>
        <h1>Course ${courseId} Overview</h1>
        <div class="activity">
          <a class="aalink" href="/mod/quiz/view.php?id=${courseId}1">Assignment 1: Social Networks Quiz</a>
        </div>
        <div class="activity">
          <a class="aalink" href="/mod/quiz/view.php?id=${courseId}2">Assignment 2: Final Assessment Quiz</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ── 3. Quiz Landing Page ──
  if (path === '/mod/quiz/view.php') {
    const quizId = parsed.query.id || '1011';
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Quiz ${quizId}</title></head>
      <body>
        <h1>Quiz ${quizId}: Social Media</h1>
        <p>Attempts allowed: 1. This quiz covers interactive social media formats.</p>
        <form action="/mod/quiz/attempt.php" method="GET">
          <input type="hidden" name="id" value="${quizId}">
          <button type="submit" class="btn btn-primary" id="btn-attempt">Attempt quiz now</button>
        </form>
      </body>
      </html>
    `);
    return;
  }

  // ── 4. Quiz Attempt Page (Full Moodle DOM with all 4 question types!) ──
  if (path === '/mod/quiz/attempt.php') {
    const quizId = parsed.query.id || '1011';
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quiz Attempt ${quizId}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .que { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: #fff; }
          .dropzone { display: inline-block; min-width: 120px; min-height: 28px; border: 2px dashed #9ca3af; border-radius: 4px; vertical-align: middle; margin: 0 4px; background: #f9fafb; text-align: center; line-height: 28px; }
          .drags { margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px; }
          .drag { display: inline-block; padding: 4px 12px; background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 4px; margin-right: 8px; font-weight: 500; }
          table.answer { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.answer td { padding: 8px; vertical-align: middle; }
          table.answer td.text { width: 80px; }
          table.answer td.text img { width: 60px; height: 60px; border-radius: 8px; display: block; }
          select { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; min-width: 140px; }
        </style>
      </head>
      <body>
        <h2>Active Attempt: Quiz ${quizId}</h2>

        <!-- Question 1: MCQ -->
        <div class="que multichoice" id="q1">
          <div class="qtext">Which platform is known for professional career networking?</div>
          <div class="formulation">
            <div class="answer">
              <div><input type="radio" name="q1" id="q1_a" value="A"><label for="q1_a">Facebook</label></div>
              <div><input type="radio" name="q1" id="q1_b" value="B"><label for="q1_b">LinkedIn</label></div>
              <div><input type="radio" name="q1" id="q1_c" value="C"><label for="q1_c">TikTok</label></div>
            </div>
          </div>
        </div>

        <!-- Question 2: Moodle ddwtos (Drag and drop words into text) -->
        <div class="que ddwtos" id="q2">
          <div class="qtext">Complete the sentences:</div>
          <div class="formulation">
            <p>
              If I want to send short messages of under 140 characters, I use <span class="drop place1 dropzone"></span>.
              If I want to quickly share pictures I can use <span class="drop place2 dropzone"></span>.
              If I want to do a videochat on my iPhone I can use <span class="drop place3 dropzone"></span>.
            </p>
            <input type="hidden" class="placeinput place1" name="q2_p1" value="0">
            <input type="hidden" class="placeinput place2" name="q2_p2" value="0">
            <input type="hidden" class="placeinput place3" name="q2_p3" value="0">
            <div class="drags">
              <span class="drag choice1">Twitter</span>
              <span class="drag choice2">Instagram</span>
              <span class="drag choice3">Facetime</span>
              <span class="drag choice4">LinkedIn</span>
              <span class="drag choice5">Pinterest</span>
              <span class="drag choice6">Youtube</span>
            </div>
          </div>
        </div>

        <!-- Question 3: Moodle shortanswer -->
        <div class="que shortanswer" id="q3">
          <div class="qtext">A short message on Twitter is called a ?????</div>
          <div class="formulation">
            Answer: <input type="text" name="q3_answer" id="q3_text" style="padding: 6px; width: 200px;">
          </div>
        </div>

        <!-- Question 4: Moodle match (Matching icons to their sites) -->
        <div class="que match" id="q4">
          <div class="qtext">Match the icons to their sites.</div>
          <div class="formulation">
            <table class="answer">
              <tbody>
                <tr class="r0">
                  <td class="text"><img src="/icon/snapchat.svg" alt="Snapchat"></td>
                  <td class="control">
                    <select name="q4_sub0" id="select_q4_0">
                      <option value="0">Choose...</option>
                      <option value="1">Snapchat</option>
                      <option value="2">Twitter</option>
                      <option value="3">Yelp</option>
                      <option value="4">Instagram</option>
                      <option value="5">LinkedIn</option>
                    </select>
                  </td>
                </tr>
                <tr class="r1">
                  <td class="text"><img src="/icon/twitter.svg" alt="Twitter"></td>
                  <td class="control">
                    <select name="q4_sub1" id="select_q4_1">
                      <option value="0">Choose...</option>
                      <option value="1">Snapchat</option>
                      <option value="2">Twitter</option>
                      <option value="3">Yelp</option>
                      <option value="4">Instagram</option>
                      <option value="5">LinkedIn</option>
                    </select>
                  </td>
                </tr>
                <tr class="r2">
                  <td class="text"><img src="/icon/yelp.svg" alt=""></td>
                  <td class="control">
                    <select name="q4_sub2" id="select_q4_2">
                      <option value="0">Choose...</option>
                      <option value="1">Snapchat</option>
                      <option value="2">Twitter</option>
                      <option value="3">Yelp</option>
                      <option value="4">Instagram</option>
                      <option value="5">LinkedIn</option>
                    </select>
                  </td>
                </tr>
                <tr class="r3">
                  <td class="text"><img src="/icon/instagram.svg" alt="Instagram"></td>
                  <td class="control">
                    <select name="q4_sub3" id="select_q4_3">
                      <option value="0">Choose...</option>
                      <option value="1">Snapchat</option>
                      <option value="2">Twitter</option>
                      <option value="3">Yelp</option>
                      <option value="4">Instagram</option>
                      <option value="5">LinkedIn</option>
                    </select>
                  </td>
                </tr>
                <tr class="r4">
                  <td class="text"><img src="/icon/linkedin.svg" alt="LinkedIn"></td>
                  <td class="control">
                    <select name="q4_sub4" id="select_q4_4">
                      <option value="0">Choose...</option>
                      <option value="1">Snapchat</option>
                      <option value="2">Twitter</option>
                      <option value="3">Yelp</option>
                      <option value="4">Instagram</option>
                      <option value="5">LinkedIn</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Question 5: Moodle multichoice with checkboxes (Cat breeds from user screenshot) -->
        <div class="que multichoice" id="q5">
          <div class="qtext">Which of these are genuine breeds of cat?</div>
          <div class="formulation">
            <div class="answer">
              <div><input type="checkbox" name="q5_a" id="q5_a" value="A"><label for="q5_a">Sphinx</label></div>
              <div><input type="checkbox" name="q5_b" id="q5_b" value="B"><label for="q5_b">Siberian</label></div>
              <div><input type="checkbox" name="q5_c" id="q5_c" value="C"><label for="q5_c">Burmese</label></div>
              <div><input type="checkbox" name="q5_d" id="q5_d" value="D"><label for="q5_d">Ragdoll</label></div>
            </div>
          </div>
        </div>

        <!-- Moodle Finish Attempt Navigation -->
        <div style="margin-top: 30px;">
          <form action="/mod/quiz/summary.php" method="GET">
            <input type="hidden" name="id" value="${quizId}">
            <input type="submit" value="Finish attempt ..." class="btn btn-secondary" id="btn-finish-attempt">
          </form>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ── 4b. Paginated Quiz (1 Question per page flow) ──
  if (path === '/mod/quiz/paginated.php') {
    const quizId = parsed.query.id || '201';
    const pageNum = parseInt(parsed.query.page || '0', 10);

    const questions = [
      { text: 'Which platform is known for professional career networking?', options: ['Facebook', 'LinkedIn', 'TikTok'], correct: 'LinkedIn' },
      { text: 'Where does the Manx cat originate?', options: ['Isle of Manx', 'Isle of Man', 'Manchester, England'], correct: 'Isle of Man' },
      { text: 'Jan is vegetarian. Is it Ok for Jan to make their cat a vegetarian too?', options: ['No - cats must have meat in their diets.', 'Yes, as long as Jan gives them a balanced diet.'], correct: 'No - cats must have meat in their diets.' }
    ];

    const currentQ = questions[pageNum] || questions[0];
    const isLastPage = pageNum >= questions.length - 1;

    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Paginated Quiz ${quizId} - Page ${pageNum + 1}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .que { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 20px; background: #fff; }
          .mod_quiz-next-nav { padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; }
        </style>
      </head>
      <body>
        <h2>Quiz ${quizId} (Page ${pageNum + 1} of ${questions.length})</h2>

        <div class="que multichoice" id="q_paginated">
          <div class="qtext">${currentQ.text}</div>
          <div class="formulation">
            <div class="answer">
              ${currentQ.options.map((opt, i) => `
                <div><input type="radio" name="q_p" id="opt_${i}" value="${String.fromCharCode(65 + i)}"><label for="opt_${i}">${opt}</label></div>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="margin-top: 30px;">
          ${!isLastPage ? `
            <form action="/mod/quiz/paginated.php" method="GET">
              <input type="hidden" name="id" value="${quizId}">
              <input type="hidden" name="page" value="${pageNum + 1}">
              <input type="submit" name="next" value="Next page" class="mod_quiz-next-nav btn btn-primary" id="btn-next-page">
            </form>
          ` : `
            <form action="/mod/quiz/summary.php" method="GET">
              <input type="hidden" name="id" value="${quizId}">
              <input type="submit" value="Finish attempt ..." class="btn btn-secondary" id="btn-finish-attempt">
            </form>
          `}
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ── 5. Quiz Summary Page (Moodle Double Confirm) ──
  if (path === '/mod/quiz/summary.php') {
    const quizId = parsed.query.id || '1011';
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Summary of Attempt ${quizId}</title></head>
      <body>
        <h1>Summary of attempt</h1>
        <p>Status: All questions answered.</p>
        <button id="btn-submit-all" class="btn btn-primary" onclick="showModal()">Submit all and finish</button>

        <!-- Moodle Confirmation Modal -->
        <div id="confirm-modal" style="display: none; position: fixed; top: 30%; left: 35%; background: #fff; padding: 24px; border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <h3>Confirmation</h3>
          <p>Once you submit, you will no longer be able to change your answers.</p>
          <form action="/mod/quiz/review.php" method="GET">
            <input type="hidden" name="id" value="${quizId}">
            <input type="submit" value="Submit all and finish" class="btn btn-primary" id="btn-confirm-submit">
          </form>
        </div>

        <script>
          function showModal() {
            document.getElementById('confirm-modal').style.display = 'block';
          }
        </script>
      </body>
      </html>
    `);
    return;
  }

  // ── 6. Quiz Review / Completed Page ──
  if (path === '/mod/quiz/review.php') {
    const quizId = parsed.query.id || '1011';
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Quiz Review ${quizId}</title></head>
      <body>
        <h1>Attempt Review</h1>
        <p class="state">Your attempt has been submitted successfully.</p>
        <p>Marks: 4.00 / 4.00 (100%)</p>
        <a href="/course/view.php?id=101" class="btn" id="btn-back-course">Finish review</a>
      </body>
      </html>
    `);
    return;
  }

  // ── 7. IITM Online Degree Portal / Angular Material Route ──
  if (path === '/courses/iitm-assessment') {
    res.end(`
      <!DOCTYPE html>
      <html lang="en" data-theme="dark">
      <head>
        <title>Courses :: IITM Study - Week 3 Graded Assignment 3</title>
        <link rel="stylesheet" href="assets/css/questions.css">
        <style>
          body { font-family: sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; }
          .app-shell { display: flex; flex-direction: column; gap: 20px; }
          .top-bar { display: flex; justify-content: space-between; align-items: center; }
          .question-nav { display: flex; gap: 8px; }
          .circle-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #444; background: #222; color: #fff; cursor: pointer; }
          .circle-btn.active { border-color: #3b82f6; background: #1e3a8a; }
          .container { display: flex; gap: 20px; }
          .left-col { flex: 1; background: #1e1e1e; padding: 20px; border-radius: 8px; }
          .right-col { flex: 1.2; background: #1e1e1e; padding: 20px; border-radius: 8px; }
          .options { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
          .mat-mdc-radio-button { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border-radius: 4px; border: 1px solid #333; }
          .nav-controls { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
          button { padding: 8px 16px; border-radius: 4px; cursor: pointer; }
          .submit-btn { background: #10b981; color: #fff; border: none; font-weight: bold; }
          .next-btn { background: #3b82f6; color: #fff; border: none; }
        </style>
      </head>
      <body class="mat-typography">
        <app-root ng-version="18.2.14">
          <div class="app-shell">
            <div class="top-bar">
              <div class="question-nav palette">
                <button class="circle-btn active" aria-current="true">1</button>
                <button class="circle-btn">2</button>
                <button class="circle-btn">3</button>
              </div>
              <button class="mat-mdc-button submit-btn" onclick="submitAssessment()">Submit Assessment</button>
            </div>

            <div class="container">
              <!-- Left Column: Common Information -->
              <div class="left-col common-data">
                <h3>Common Information</h3>
                <p>The information below is common to Questions 1 to 13</p>
                <p>There are some questions which have functions with discrete valued domains. For simplicity, we treat them as continuous functions.</p>
                <p>For NAT type question, enter only one right answer, even if you get multiple answers for that particular question.</p>
                <p>Notations: R = Set of real numbers Q = Set of rational numbers, Z = Set of integers, N = Set of natural numbers.</p>
              </div>

              <!-- Right Column: Question 1 -->
              <div class="right-col">
                <app-question class="question-card">
                  <div class="q-header">Question 1 / 17 <span class="badge">• 1 mark</span> <button class="flag-btn">Flag for review</button></div>
                  <div class="question-text">
                    Find out the points where the curve y = 4x<sup>2</sup> + x and the straight line y = 2x - 3 intersect with each other.
                  </div>
                  <div class="options">
                    <h4>Options</h4>
                    <mat-radio-group role="radiogroup">
                      <mat-radio-button class="mat-mdc-radio-button">
                        <input type="radio" name="opts" id="optA">
                        <label for="optA">A. (3/8, 0) and (3/8, 21/2).</label>
                      </mat-radio-button>
                      <mat-radio-button class="mat-mdc-radio-button">
                        <input type="radio" name="opts" id="optB">
                        <label for="optB">B. Only at the origin.</label>
                      </mat-radio-button>
                      <mat-radio-button class="mat-mdc-radio-button">
                        <input type="radio" name="opts" id="optC">
                        <label for="optC">C. The curve and the straight line do not intersect.</label>
                      </mat-radio-button>
                      <mat-radio-button class="mat-mdc-radio-button">
                        <input type="radio" name="opts" id="optD">
                        <label for="optD">D. (1, -1) and (1, 5).</label>
                      </mat-radio-button>
                    </mat-radio-group>
                    <a href="#" class="clear-selection" style="color: #888; font-size: 12px; margin-top: 8px;">Clear Selection</a>
                  </div>
                </app-question>

                <div class="nav-controls">
                  <span>Use arrows ← and → to navigate</span>
                  <button class="mat-button prev-btn">← Previous</button>
                  <button class="mat-button next-btn" onclick="nextQuestion()">Next →</button>
                </div>
              </div>
            </div>
          </div>
        </app-root>

        <script>
          let submitted = false;
          function submitAssessment() {
            submitted = true;
            document.body.innerHTML = '<h1>Assessment Submitted</h1><p class="state">Complete</p>';
          }
          function nextQuestion() {
            const header = document.querySelector('.q-header');
            if (header) header.innerHTML = 'Question 5 / 17 <span class="badge">• 1 mark</span> <button class="flag-btn">Flag for review</button>';
            const qText = document.querySelector('.question-text');
            if (qText) qText.innerHTML = 'The daily production cost (in lakh ₹) of manufacturing an electric device is p(x) = 7400 - 60x + 15x<sup>2</sup>, where x is the number of electric devices produced per day and the daily transportation cost (in lakh ₹) of x number of electric devices is given by the slope of the function p(x) at point x. If the transportation cost of the electric devices on a particular day is 30 (in lakh ₹), then find the number of transported electric devices.';
            const opts = document.querySelector('.options');
            if (opts) opts.innerHTML = '<label>Your answer</label><mat-form-field><textarea matinput class="mat-mdc-input-element" placeholder="Enter your answer"></textarea></mat-form-field><span class="instruction">Only numeric input is accepted for this question.</span>';
            const active = document.querySelector('.circle-btn.active');
            if (active) active.classList.remove('active');
            const btns = document.querySelectorAll('.circle-btn');
            if (btns[1]) btns[1].classList.add('active');
          }
        </script>
      </body>
      </html>
    `);
    return;
  }

  if (!res.headersSent) {
    res.writeHead(404);
  }
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Test LMS Server] Running at http://localhost:${PORT}`);
});
