const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testHudControls() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING HUD MINIMIZE, EXPAND, AND CLOSE INTERACTIONS');
  console.log('══════════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const overlayCss = fs.readFileSync(path.join(__dirname, '../content/overlay.css'), 'utf8');
  const contentJs = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><style>${overlayCss}</style></head>
      <body><div>Host Page Content</div></body>
    </html>
  `);

  await page.evaluate(() => {
    window.chrome = {
      storage: {
        local: {
          get: () => Promise.resolve({ extensionEnabled: true, showFloatingWidget: true }),
          set: (obj) => { 
            window.__stored = Object.assign(window.__stored || {}, obj); 
            return Promise.resolve(); 
          }
        }
      },
      runtime: { onMessage: { addListener: () => {} }, getURL: (p) => p }
    };
  });

  await page.evaluate(contentJs);

  // 1. Initial State
  const isMainVisibleInit = await page.$eval('#peslms-main-widget', el => window.getComputedStyle(el).display !== 'none');
  const isDockVisibleInit = await page.$eval('#peslms-dock-tab', el => window.getComputedStyle(el).display !== 'none');
  console.log(`1. Initial State: Main visible = ${isMainVisibleInit}, Dock visible = ${isDockVisibleInit}`);

  // 2. Click Minimize button
  await page.click('#peslms-btn-minimize');
  const isMainVisibleMin = await page.$eval('#peslms-main-widget', el => window.getComputedStyle(el).display !== 'none');
  const isDockVisibleMin = await page.$eval('#peslms-dock-tab', el => window.getComputedStyle(el).display !== 'none');
  console.log(`2. After Minimize: Main visible = ${isMainVisibleMin}, Dock visible = ${isDockVisibleMin}`);

  // 3. Click Dock tab to re-expand
  await page.click('#peslms-dock-tab');
  const isMainVisibleExp = await page.$eval('#peslms-main-widget', el => window.getComputedStyle(el).display !== 'none');
  const isDockVisibleExp = await page.$eval('#peslms-dock-tab', el => window.getComputedStyle(el).display !== 'none');
  console.log(`3. After Re-Expand: Main visible = ${isMainVisibleExp}, Dock visible = ${isDockVisibleExp}`);

  // 4. Click Close button
  await page.click('#peslms-btn-close');
  const isContainerVisible = await page.$eval('#peslms-autopilot-root', el => window.getComputedStyle(el).display !== 'none');
  const storageResult = await page.evaluate(() => window.__stored);
  console.log(`4. After Close: Container visible = ${isContainerVisible}, Stored showFloatingWidget = ${storageResult?.showFloatingWidget}`);

  const passed = isMainVisibleInit && !isDockVisibleInit &&
                 !isMainVisibleMin && isDockVisibleMin &&
                 isMainVisibleExp && !isDockVisibleExp &&
                 !isContainerVisible && storageResult?.showFloatingWidget === false;

  if (!passed) {
    console.error('\n❌ HUD CONTROLS TEST FAILED');
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('✅ ALL HUD CONTROLS VERIFIED 100%!');
  console.log('══════════════════════════════════════════════════════════════\n');
  await browser.close();
}

testHudControls().catch(err => {
  console.error(err);
  process.exit(1);
});
