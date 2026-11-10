// New members: Baptism date + Temple attendance (red until checked), 30-day count, carry-over, PDF.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out11'; require('fs').mkdirSync(OUT, { recursive: true });
// Next week: Send closes the huddle and sets up the next one; then pick the date the test wants.
async function nextWeek(pg, date) {
  if (await pg.isVisible('[data-action="steps-home"]')) { await pg.click('[data-action="steps-home"]'); await pg.waitForTimeout(150); }
  await pg.evaluate(() => { window.__sh = [navigator.canShare, navigator.share]; navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
  await pg.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => pg.click('.actionbar [data-action="send"]')); await pg.waitForTimeout(150);
  if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary');
  await pg.waitForSelector('#share-btn:not([disabled])'); await pg.click('#share-btn');
  await pg.waitForSelector('#confirm-sheet:not([hidden])'); await pg.click('#confirm-primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => { navigator.canShare = window.__sh[0]; navigator.share = window.__sh[1]; });
  if (date) await setDate(pg, date);
}
// After a send (which already set up the next huddle), just pick the date.
async function setDate(pg, date) { await pg.fill('#date', date); await pg.waitForTimeout(150); }

// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.evaluate(() => document.querySelector('.clear-link').click()); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const txt = f => execFileSync('pdftotext', ['-raw', f, '-']).toString().replace(/\s+/g, ' ');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  ok('temple box only on New member cards', (await p.$$('[data-group="nm"] .temple-box')).length === 1 && (await p.$$('[data-group="rm"] .temple-box, [data-group="bt"] .temple-box, #tn-list .temple-box')).length === 0);
  ok('Baptism date only on New member cards', (await p.$$('[data-group="nm"] input[type="date"][data-bind$=".bap"]')).length === 1 && (await p.$$('[data-group="rm"] [data-bind$=".bap"]')).length === 0);
  ok('goal line shown', (await p.textContent('.temple-goal')).includes('within 30 days of their baptism'));
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.bap"]', '2026-10-20'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to temple trip');
  const sub0 = await p.textContent('[data-group="nm"] [data-temple="0"] .temple-sub');
  ok('counts down from baptism to the meeting date', sub0 === '18 days left of 30', sub0);
  const bg = await p.$eval('[data-group="nm"] [data-temple="0"]', e => getComputedStyle(e).backgroundColor);
  ok('box is red while unchecked', bg === 'rgb(251, 234, 234)', bg);
  await p.click('[data-action="add-cp"][data-a="nm"]');
  await p.fill('[data-bind="cp.nm.1.name"]', 'Tom Hale'); await p.fill('[data-bind="cp.nm.1.bap"]', '2026-09-20'); await p.fill('[data-bind="cp.nm.1.action"]', 'Limited-use recommend');
  ok('past 30 days says so', (await p.textContent('[data-group="nm"] [data-temple="1"] .temple-sub')) === '12 days past the 30-day goal');
  await p.click('[data-action="add-cp"][data-a="nm"]');
  await p.fill('[data-bind="cp.nm.2.name"]', 'Ana Ruiz'); await p.fill('[data-bind="cp.nm.2.action"]', 'Visit');
  ok('no baptism date asks for it', (await p.textContent('[data-group="nm"] [data-temple="2"] .temple-sub')).startsWith('Add the baptism date'));
  ok('no tally at the top of New members', (await p.$$('#temple-summary')).length === 0);
  await p.click('[data-group="nm"] [data-temple="2"]');
  ok('checking turns it green and done', await p.isChecked('[data-bind="cp.nm.2.temple"]') && (await p.getAttribute('[data-group="nm"] [data-temple="2"]', 'class')).includes('is-done'));
  await p.locator('[data-group="nm"]').screenshot({ path: OUT + '/nm.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d1.saveAs(OUT + '/w1.pdf');
  const t1 = txt(OUT + '/w1.pdf');
  ok('PDF shows temple status under names', t1.includes('Temple: 18 days left') && t1.includes('Temple: 12 days late') && t1.includes('Temple: done'), t1.slice(t1.indexOf('Maria'), t1.indexOf('Maria') + 200));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w1.pdf', OUT + '/w1']);
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  // week 2

  await setDate(p, '2026-11-08');
  const rr = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ')));
  ok('Return and Report shows the count as of this week', rr[0].includes('Temple attendance: 11 days left') && rr[1].includes('Temple attendance: 19 days late') && rr[2].includes('✓ Temple attendance done'), rr.map(x => x.slice(0, 120)).join(' || '));
  ok('carried new members keep baptism date and temple status', (await p.inputValue('[data-bind="cp.nm.0.bap"]')) === '2026-10-20' && !(await p.isChecked('[data-bind="cp.nm.0.temple"]')) && (await p.isChecked('[data-bind="cp.nm.2.temple"]')));
  ok('still red next week until checked', (await p.textContent('[data-group="nm"] [data-temple="1"] .temple-sub')) === '19 days past the 30-day goal');
  await p.locator('#rr-list .rr-card').nth(1).screenshot({ path: OUT + '/rr.png' });
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
