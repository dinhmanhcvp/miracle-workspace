// Headless test runner: node tests/run-tests.js
// Opens index.html in Chromium (Playwright) and runs the in-app test suite.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.waitForFunction(() => typeof window.runAutomatedTests === 'function');

  // Seed "real" user data to verify tests never destroy it
  await page.evaluate(() => {
    localStorage.setItem('miracle_pnls', JSON.stringify([{ name: 'REAL USER ROW', intCost: 1, extCost: 2, grossProfit: 1 }]));
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.runAutomatedTests === 'function');

  const { passed, failed, results } = await page.evaluate(() => window.runAutomatedTests({ silent: true }));
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  -> ' + r.message}`);

  const realData = await page.evaluate(() => localStorage.getItem('miracle_pnls'));
  const kept = realData && realData.includes('REAL USER ROW');
  console.log(`${kept ? 'PASS' : 'FAIL'}  User data preserved after tests`);
  if (errors.length) console.log('Page errors:\n  ' + errors.join('\n  '));

  await browser.close();
  console.log(`\n${passed + (kept ? 1 : 0)} passed, ${failed + (kept ? 0 : 1)} failed`);
  process.exit(failed || !kept || errors.length ? 1 : 0);
})();
