// How to use: first-visit open, header link, #help link, one-time names reminder after Load last week.
const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.evaluate(() => document.querySelector('.clear-link').click()); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

const OUT = __dirname + '/out2';
const BASE = 'http://127.0.0.1:8765/#huddle';
const ok = (l, c) => console.log((c ? 'PASS ' : 'FAIL ') + l);
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const p = await ctx.newPage(); p.on('pageerror', e => problems.push(e.message));

  await p.goto(BASE); await p.waitForSelector('.chip');
  ok('opens on first visit', await p.isVisible('#help-sheet'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/help-1.png' });
  await p.$eval('#help-sheet .sheet', s => s.scrollTop = s.scrollHeight); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/help-2.png' });
  await p.click('#help-done');
  ok('Got it closes', await p.isHidden('#help-sheet'));
  await p.reload(); await p.waitForSelector('.chip'); await p.waitForTimeout(200);
  ok('not shown again', await p.isHidden('#help-sheet'));
  await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.screenshot({ path: OUT + '/help-header.png' });
  await p.evaluate(() => document.querySelector('[data-action="help"]').click());
  ok('header link opens it', await p.isVisible('#help-sheet'));
  await p.keyboard.press('Escape');
  ok('Escape closes', await p.isHidden('#help-sheet'));
  await p.goto(BASE.replace('#huddle', '') + '#help'); await p.reload(); await p.waitForSelector('.chip');
  ok('#help link opens it', await p.isVisible('#help-sheet'));
  await p.click('#help-done');

  // Names reminder: the first time names carry over (practice week), then never again
  await p.fill('#ward', 'Riverton 5th Ward');
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200); await p.click('#help-sheet [data-action="practice"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok('names reminder shown', (await p.textContent('#confirm-title')) === 'Check the names that carried over');
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/names-hint.png' });
  await p.click('#confirm-secondary'); await p.waitForTimeout(200);
  await p.click('#loaded-banner [data-action="unload"]'); await p.click('#confirm-primary'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200); await p.click('#help-sheet [data-action="practice"]'); await p.waitForTimeout(400);
  ok('names reminder only once', await p.isHidden('#confirm-sheet'));

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
