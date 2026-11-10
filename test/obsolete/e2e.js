// End-to-end test: phone viewport, fill form, send (download fallback), load back, checks.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/#huddle';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, userAgent: devices['Pixel 5'].userAgent });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', r => problems.push('requestfailed: ' + r.url()));
  page.on('request', r => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) problems.push('OUTSIDE REQUEST: ' + r.url()); });

  await page.goto(BASE);
  await page.waitForSelector('#attendee-list .chip');
  await page.screenshot({ path: `${OUT}/01-empty.png`, fullPage: true });

  // Fill
  await page.fill('#ward', 'Riverton 5th Ward');
  await page.fill('#date', '2026-11-01');
  for (const label of ['Priests quorum assistant', 'Relief Society', 'Ward mission leader', 'TFH leader']) {
    await page.click(`#attendee-list .chip:has-text("${label}")`);
  }
  await page.fill('[data-bind="rr.0.plan"]', 'Invite the Garcia family to the trunk-or-treat');
  await page.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
  await page.fill('[data-bind="rr.0.notes"]', 'They came and loved it');
  await page.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez');
  await page.fill('[data-bind="cp.nm.0.action"]', 'Invite to Relief Society activity on Thursday');
  await page.fill('[data-bind="cp.nm.0.assigned"]', 'Sister Jensen');
  await page.fill('[data-bind="cp.nm.0.when"]', 'Thursday');
  await page.click('[data-action="add-cp"][data-a="nm"]');
  await page.fill('[data-bind="cp.nm.1.name"]', 'Tom Becker');
  await page.fill('[data-bind="cp.nm.1.action"]', 'Help him find family names to take to the temple, a longer action item to check wrapping in the PDF table cells');
  await page.fill('[data-bind="cp.nm.1.assigned"]', 'Bro. Lee');
  await page.fill('[data-bind="cp.nm.1.when"]', 'by Sunday');
  await page.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz 😀');
  await page.fill('[data-bind="cp.bt.0.action"]', 'Sit with him at sacrament meeting');
  await page.fill('[data-bind="cp.bt.0.assigned"]', 'Elders Quorum pres.');
  await page.fill('[data-bind="tn.0.name"]', 'Ana Ruiz');
  await page.fill('[data-bind="tn.0.ordinance"]', 'Endowment');
  await page.fill('[data-bind="tn.0.action"]', 'Schedule temple prep class');
  await page.fill('[data-bind="tn.0.assigned"]', 'Bishop');
  await page.fill('[data-bind="tn.0.when"]', 'Nov 8');

  // Draft survives reload
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('#attendee-list .chip');
  const kept = await page.inputValue('[data-bind="cp.nm.1.name"]');
  console.log('draft kept after reload:', kept === 'Tom Becker');
  await page.screenshot({ path: `${OUT}/02-filled.png`, fullPage: true });

  // Send (no share menu in headless Chromium -> download path)
  await page.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => page.click('.actionbar [data-action="send"]')).then(() => sendAnyway(page));
  await page.waitForSelector('#share-btn:not([disabled])');
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/03-send-sheet.png` });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#share-btn')]);
  const pdfPath = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(pdfPath);
  console.log('downloaded:', dl.suggestedFilename());
  await page.click('#confirm-primary').catch(() => {});
  const cleared = await page.inputValue('[data-bind="cp.nm.0.name"]');
  console.log('cleared after send:', cleared === '', 'ward kept:', await page.inputValue('#ward'));

  // Next week: load last week
  await page.fill('#date', '2026-11-08');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="load"]')]);
  await fc.setFiles(pdfPath);
  await page.waitForSelector('#loaded-banner:not([hidden])');
  const cards = await page.$$eval('#rr-list .card', els => els.length);
  console.log('loaded cards:', cards);
  await page.click('[data-action="happened"][data-a="1"][data-b="Partly"]');
  await page.screenshot({ path: `${OUT}/04-loaded.png`, fullPage: true });

  // Ward mismatch check
  await page.click('[data-action="unload"]');
  await page.click('#confirm-primary').catch(() => {});
  await page.fill('#ward', 'Riverton 2nd Ward');
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="load"]')]);
  await fc2.setFiles(pdfPath);
  await page.waitForSelector('#confirm-sheet:not([hidden])');
  console.log('mismatch title:', await page.textContent('#confirm-title'));
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/05-ward-check.png` });
  await page.click('#confirm-secondary');
  console.log('loaded anyway:', await page.isVisible('#loaded-banner'));

  // Wrong file
  await page.click('[data-action="unload"]');
  if (await page.isVisible('#confirm-sheet')) await page.click('#confirm-primary');
  const [fc3] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="load"]')]);
  await fc3.setFiles('/home/claude/orig.pdf');
  await page.waitForSelector('#confirm-sheet:not([hidden])');
  console.log('wrong-file title:', await page.textContent('#confirm-title'));
  await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/06-wrong-file.png` });

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
