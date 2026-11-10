// Those being taught: Committed to baptism + Baptism date; carried over; on Return and Report and the PDF.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out12'; require('fs').mkdirSync(OUT, { recursive: true });
// Next week: Send closes the huddle and sets up the next one; then pick the date the test wants.
async function nextWeek(pg, date) {
  if (await pg.isVisible('[data-action="steps-home"]')) { await pg.click('[data-action="steps-home"]'); await pg.waitForTimeout(150); }
  await pg.evaluate(() => { window.__sh = [navigator.canShare, navigator.share]; navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
  await pg.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => pg.click('.actionbar [data-action="send"]')); await pg.waitForTimeout(150);
  if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary');
  await pg.waitForSelector('#share-btn:not([disabled])'); await pg.click('#share-btn');
  await pg.waitForSelector('#confirm-sheet:not([hidden])'); await pg.click('#confirm-primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => { navigator.canShare = window.__sh[0]; navigator.share = window.__sh[1]; });
  if (date) await setDate(pg, date);
}
// After a send (which already set up the next huddle), just pick the date.
async function setDate(pg, date) { await pg.fill('#date', date); await pg.waitForTimeout(150); }

// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const txt = f => execFileSync('pdftotext', ['-raw', f, '-']).toString().replace(/\s+/g, ' ');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  ok('Committed to baptism only on Those being taught', (await p.$$('[data-group="bt"] .commit-box')).length === 1 && (await p.$$('[data-group="nm"] .commit-box, [data-group="rm"] .commit-box')).length === 0);
  ok('Baptism date field on Those being taught', (await p.$$('[data-group="bt"] input[type="date"][data-bind="cp.bt.0.bap"]')).length === 1 && (await p.$$('[data-group="rm"] [data-bind$=".bap"]')).length === 0);
  ok('no temple box on Those being taught', (await p.$$('[data-group="bt"] .temple-box')).length === 0);
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz'); await p.click('[data-group="bt"] .commit-box'); await p.fill('[data-bind="cp.bt.0.bap"]', '2026-11-21'); await p.fill('[data-bind="cp.bt.0.action"]', 'Teach lesson 3');
  ok('checking it works', await p.isChecked('[data-bind="cp.bt.0.committed"]'));
  await p.click('[data-action="add-cp"][data-a="bt"]');
  await p.fill('[data-bind="cp.bt.1.name"]', 'Lee Park'); await p.fill('[data-bind="cp.bt.1.action"]', 'Invite to church');
  await p.locator('[data-group="bt"] .card').first().screenshot({ path: OUT + '/card.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d1.saveAs(OUT + '/w1.pdf');
  const t1 = txt(OUT + '/w1.pdf');
  ok('PDF notes commitment and date under the name', t1.includes('Committed · Nov 21'), t1.slice(t1.indexOf('Sam'), t1.indexOf('Sam') + 80));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w1.pdf', OUT + '/w1']);
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  await setDate(p, '2026-11-08');
  const rr = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ')));
  ok('Return and Report shows Committed to baptism · date', rr[0].includes('✓ Committed to baptism · Nov 21') && !rr[1].includes('Committed'), rr.map(x => x.slice(0, 110)).join(' || '));
  ok('carried over: checkbox and date kept', await p.isChecked('[data-bind="cp.bt.0.committed"]') && (await p.inputValue('[data-bind="cp.bt.0.bap"]')) === '2026-11-21' && !(await p.isChecked('[data-bind="cp.bt.1.committed"]')));
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d2.saveAs(OUT + '/w2.pdf');
  const t2 = txt(OUT + '/w2.pdf');
  ok('week 2 PDF: Sam in Return and Report, commitment in this week\'s table', t2.includes('Sam Ortiz') && t2.includes('Teach lesson 3') && t2.includes('Committed · Nov 21'));
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
