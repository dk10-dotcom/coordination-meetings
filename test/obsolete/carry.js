// Load last week carries names into Covenant Path Report Review; Remove takes untouched ones back.
const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const BASE = 'http://127.0.0.1:8765/#huddle';
const ok = (l, c) => console.log((c ? 'PASS ' : 'FAIL ') + l);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const problems = []; page.on('pageerror', e => problems.push(e.message));
  await page.goto(BASE); await page.waitForSelector('.chip');
  ok('Load panel sits above Return and Report', await page.evaluate(() =>
    document.querySelector('#load-panel').compareDocumentPosition(document.querySelector('#h-rr')) & Node.DOCUMENT_POSITION_FOLLOWING));
  ok('Three Names has its own section header', (await page.textContent('#h-tn')) === '3 Names Next Ordinance (Ward Council Focus Names)');

  await page.fill('#ward', 'Riverton 5th Ward'); await page.fill('#date', '2026-11-01');
  await page.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez');
  await page.fill('[data-bind="cp.nm.0.action"]', 'Invite to activity');
  await page.click('[data-action="add-cp"][data-a="nm"]');
  await page.fill('[data-bind="cp.nm.1.name"]', 'Tom Becker');
  await page.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz');
  await page.fill('[data-bind="cp.bt.0.action"]', 'Sit with him at church');
  await page.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => page.click('.actionbar [data-action="send"]')).then(() => sendAnyway(page)); await page.waitForSelector('#share-btn:not([disabled])');
  await Promise.all([page.waitForEvent('download'), page.click('#share-btn')]);
  await page.click('#confirm-primary').catch(() => {});

  await page.fill('#date', '2026-11-08');
  await page.fill('[data-bind="cp.rm.0.name"]', 'Already Typed');
  await freshWeek(page); await page.click('[data-action="load"]'); await page.waitForSelector('#load-sheet:not([hidden])');
  await page.click('.agenda-row'); await page.waitForSelector('#loaded-banner:not([hidden])');
  const nm = await page.$$eval('[data-group="nm"] input[data-bind$=".name"]', els => els.map(e => e.value));
  const bt = await page.$$eval('[data-group="bt"] input[data-bind$=".name"]', els => els.map(e => e.value));
  const rm = await page.$$eval('[data-group="rm"] input[data-bind$=".name"]', els => els.map(e => e.value));
  ok('new members carried: ' + nm.join(', '), nm.join('|') === 'Maria Lopez|Tom Becker');
  ok('those being taught carried: ' + bt.join(', '), bt.join('|') === 'Sam Ortiz');
  ok('typed returning member kept', rm.join('|') === 'Already Typed');
  ok('carried actions are blank', (await page.inputValue('[data-bind="cp.nm.0.action"]')) === '');
  ok('From last week tag shown', (await page.$$('[data-group="nm"] .source')).length === 2);
  ok('toast mentions names', (await page.textContent('#toast')).includes('and 3 names'));
  await page.screenshot({ path: __dirname + '/out2/carry.png', fullPage: true });

  await page.fill('[data-bind="cp.nm.0.action"]', 'Visit Tuesday');
  await page.click('[data-action="unload"]');
  const nm2 = await page.$$eval('[data-group="nm"] input[data-bind$=".name"]', els => els.map(e => e.value));
  const bt2 = await page.$$eval('[data-group="bt"] input[data-bind$=".name"]', els => els.map(e => e.value));
  ok('Remove keeps names you added to, drops untouched: ' + nm2.join(', '), nm2.join('|') === 'Maria Lopez' && bt2.join('|') === '');
  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
