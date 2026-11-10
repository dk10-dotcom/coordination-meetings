const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out14'; require('fs').mkdirSync(OUT, { recursive: true });
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
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  const zoneOf = sel => p.$eval(sel, i => i.closest('.card-zone').classList.contains('zone-wc-wrap') ? 'wc' : 'hd');
  ok('name in the card title; next ordinance, need in the Ward Council half', (await p.$eval('[data-bind="cp.rm.0.name"]', i => !!i.closest('.card-head'))) && (await zoneOf('[data-bind="cp.rm.0.ordinance"]')) === 'wc' && (await zoneOf('[data-bind="cp.rm.0.need"]')) === 'wc');
  ok('action, assigned, when in the Huddle half', (await zoneOf('[data-bind="cp.rm.0.action"]')) === 'hd' && (await zoneOf('[data-bind="cp.rm.0.assigned"]')) === 'hd' && (await zoneOf('[data-bind="cp.rm.0.when"]')) === 'hd');
  ok('temple box above both halves; baptism date in Ward Council half', (await p.$eval('[data-group="nm"] [data-temple="0"]', e => !e.closest('.card-zone'))) && (await zoneOf('[data-bind="cp.nm.0.bap"]')) === 'wc');
  ok('committed box above both halves', await p.$eval('[data-group="bt"] .commit-box', e => !e.closest('.card-zone')));
  ok('3 Names cards split too', (await p.$eval('[data-bind="tn.0.name"]', i => !!i.closest('.card-head'))) && (await zoneOf('[data-bind="tn.0.ordinance"]')) === 'wc' && (await zoneOf('[data-bind="tn.0.action"]')) === 'hd');
  ok('huddle need hidden behind a link', await p.isHidden('[data-bind="cp.rm.0.hneed"]') && await p.isVisible('[data-group="rm"] [data-action="add-hneed"]'));
  await p.click('[data-group="rm"] [data-action="add-hneed"]');
  ok('tapping the link opens the field', await p.isVisible('[data-bind="cp.rm.0.hneed"]') && await p.isHidden('[data-group="rm"] [data-action="add-hneed"]'));
  await p.fill('#ward', 'Maple Creek 2nd Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.rm.0.name"]', 'Marcus Bell'); await p.fill('[data-bind="cp.rm.0.need"]', 'Friends at church'); await p.fill('[data-bind="cp.rm.0.hneed"]', 'Rides on Sunday'); await p.fill('[data-bind="cp.rm.0.action"]', 'Visit'); 
  await p.reload(); await p.waitForSelector('.chip');
  ok('a filled huddle need stays open after reload', await p.isVisible('[data-bind="cp.rm.0.hneed"]') && (await p.inputValue('[data-bind="cp.rm.0.hneed"]')) === 'Rides on Sunday');
  await p.locator('[data-group="rm"] .card').first().screenshot({ path: OUT + '/card.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d1.saveAs(OUT + '/w1.pdf');
  const t1 = execFileSync('pdftotext', ['-raw', OUT + '/w1.pdf', '-']).toString().replace(/\s+/g, ' ');
  ok('PDF has one block per person: needs, then the action item', /Marcus Bell Needs Friends at church Action item Visit/.test(t1), t1.slice(t1.indexOf('Marcus'), t1.indexOf('Marcus') + 160));
  ok('PDF has no Who/What/How/When boxes or table labels', !/WHO & WHAT|HOW & WHEN|Huddles decide|ATTENDED|ASSIGNED/.test(t1));
  ok('PDF shows the huddle note on its own line', t1.includes('Huddle notes Rides on Sunday'));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w1.pdf', OUT + '/w1']);
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  await setDate(p, '2026-11-08');
  ok('Return and Report shows the huddle need', (await p.textContent('#rr-list')).includes('Huddle notes: Rides on Sunday'));
  ok('huddle need carries forward with the name', (await p.inputValue('[data-bind="cp.rm.0.hneed"]')) === 'Rides on Sunday');
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
