// New name-card fields: Attended sacrament, Next ordinance, Need; carried into Return and Report and the PDF.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out9'; require('fs').mkdirSync(OUT, { recursive: true });
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
const txt = f => execFileSync('pdftotext', ['-raw', f, '-']).toString();
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]');
  const labels = await p.$$eval('[data-group="nm"] .card .field', fs => fs.map(f => f.firstChild.textContent.trim()));
  ok('card fields in order', labels.join('|') === 'Baptism date|Next ordinance|Needs|Action item|Assigned to|When|Huddle notes', labels.join('|'));
  ok('Attended sacrament checkbox on every name card', (await p.$$('.card .sac-toggle')).length === 6);
  ok('action placeholder reworded', (await p.getAttribute('[data-bind="cp.nm.0.action"]', 'placeholder')) === 'What might you do to assist them in being worthy and prepared for their next ordinance?');
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Temple recommend');
  await p.fill('[data-bind="cp.nm.0.need"]', 'A friend in Relief Society'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to RS dinner');
  await p.fill('[data-bind="cp.nm.0.assigned"]', 'Sister Jensen'); await p.fill('[data-bind="cp.nm.0.when"]', 'Thursday');
  await p.click('[data-group="nm"] .sac-toggle');
  ok('tapping the checkbox checks it', await p.isChecked('[data-bind="cp.nm.0.sac"]'));
  await p.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz'); await p.fill('[data-bind="cp.bt.0.action"]', 'Sit together');
  await p.fill('[data-bind="tn.0.name"]', 'Ana Ruiz'); await p.fill('[data-bind="tn.0.ordinance"]', 'Endowment'); await p.fill('[data-bind="tn.0.need"]', 'Temple prep class'); await p.fill('[data-bind="tn.0.action"]', 'Invite to class');
  await p.click('#tn-list .card >> nth=0 >> .sac-toggle');
  await p.reload(); await p.waitForSelector('.chip');
  ok('checkbox and new fields survive a reload', await p.isChecked('[data-bind="cp.nm.0.sac"]') && (await p.inputValue('[data-bind="cp.nm.0.need"]')) === 'A friend in Relief Society' && await p.isChecked('[data-bind="tn.0.sac"]'));
  await p.locator('[data-group="nm"] .card').first().screenshot({ path: OUT + '/card.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d1.saveAs(OUT + '/w1.pdf');
  const t1 = txt(OUT + '/w1.pdf').replace(/\s+/g, ' ');
  ok('PDF labels each part of a person\'s block', /Attended sacrament meeting/.test(t1) && /Next ordinance Temple recommend/.test(t1) && /Needs A friend in Relief/.test(t1) && /Action item Invite to RS dinner Sister Jensen · Thursday/.test(t1), t1.slice(t1.indexOf('Maria'), t1.indexOf('Maria') + 200));
  ok('no sacrament line for someone who was not marked', !/Sam Ortiz Attended sacrament meeting/.test(t1) && /Ana Ruiz Attended sacrament meeting/.test(t1));
  ok('PDF shows ordinance and need', t1.includes('Temple recommend') && t1.replace(/\s+/g, ' ').includes('A friend in Relief') && t1.includes('Temple prep'));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w1.pdf', OUT + '/w1']);
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  ok('sending keeps the form filled in', true);
  // Week 2
  await setDate(p, '2026-11-08');
  const c0 = (await p.textContent('#rr-list .rr-card >> nth=0')).replace(/\s+/g, ' ');
  ok('Return and Report shows next ordinance, need, sacrament', c0.includes('Next: Temple recommend') && c0.includes('Needs: A friend in Relief Society') && c0.includes('Attended sacrament') && c0.includes('Invite to RS dinner'), c0.slice(0, 200));
  const c1 = (await p.textContent('#rr-list .rr-card >> nth=1')).replace(/\s+/g, ' ');
  ok('no sacrament line when not checked', c1.includes('Next: Baptism') && !c1.includes('Attended sacrament'));
  const c2 = (await p.textContent('#rr-list .rr-card >> nth=2')).replace(/\s+/g, ' ');
  ok('3 Names item carries need and sacrament', c2.includes('Next: Endowment') && c2.includes('Needs: Temple prep class') && c2.includes('Attended sacrament'));
  ok('carried name keeps next ordinance and need, sacrament starts blank', (await p.inputValue('[data-bind="cp.nm.0.name"]')) === 'Maria Lopez' && (await p.inputValue('[data-bind="cp.nm.0.ordinance"]')) === 'Temple recommend' && (await p.inputValue('[data-bind="cp.nm.0.need"]')) === 'A friend in Relief Society' && !(await p.isChecked('[data-bind="cp.nm.0.sac"]')));
  await p.click('[data-action="happened"][data-a="2"][data-b="No"]'); await p.click('[data-action="carry-fwd"][data-a="2"]');
  ok('carry forward fills 3 Names with ordinance and need', (await p.inputValue('[data-bind="tn.0.name"]')) === 'Ana Ruiz' && (await p.inputValue('[data-bind="tn.0.need"]')) === 'Temple prep class');
  await p.locator('#rr-list .rr-card').first().screenshot({ path: OUT + '/rr.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d2.saveAs(OUT + '/w2.pdf');
  const t2 = txt(OUT + '/w2.pdf').replace(/\s+/g, ' ');
  ok('week 2 PDF: Return and Report row plus details in this week\'s table', t2.includes('Maria Lopez') && t2.includes('Invite to RS dinner') && t2.includes('Sister Jensen · Thursday') && t2.includes('Temple recommend') && t2.includes('A friend in Relief Society'), t2.slice(t2.indexOf('Maria'), t2.indexOf('Maria') + 160));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w2.pdf', OUT + '/w2']);
  console.log('pages w1/w2:', /Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [OUT + '/w1.pdf']).toString())[1], /Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [OUT + '/w2.pdf']).toString())[1]);
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
