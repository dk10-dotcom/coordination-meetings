// Done per list: folds to one line per person; warns about missing actions; reopens; PDF unaffected; load/open-to-edit reopen.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out13'; require('fs').mkdirSync(OUT, { recursive: true });
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  ok('Done on each Covenant Path list, 3 Names and Return and Report', (await p.$$('[data-action="list-done"]')).length === 5);
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-08');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.bap"]', '2026-10-20'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to temple trip'); await p.fill('[data-bind="cp.nm.0.assigned"]', 'Sister Jensen'); await p.fill('[data-bind="cp.nm.0.when"]', 'Thu');
  await p.click('[data-action="add-cp"][data-a="nm"]'); await p.fill('[data-bind="cp.nm.1.name"]', 'Tom Hale');
  await p.click('[data-action="list-done"][data-a="nm"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok('warns when someone has no action item', (await p.textContent('#confirm-title')) === 'Tom Hale has no action item yet');
  await p.click('#confirm-secondary'); await p.waitForTimeout(200);
  ok('Keep working leaves it open', (await p.$$('[data-group="nm"].is-folded')).length === 0);
  await p.click('[data-action="list-done"][data-a="nm"]'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('dismissing the question also keeps working', (await p.$$('[data-group="nm"].is-folded')).length === 0);
  await p.fill('[data-bind="cp.nm.1.action"]', 'Visit'); await p.fill('[data-bind="cp.nm.1.assigned"]', 'Bro. Lee');
  await p.click('[data-action="list-done"][data-a="nm"]'); await p.waitForTimeout(300);
  ok('no warning when every person has an action', await p.isHidden('#confirm-sheet') && (await p.$$('[data-group="nm"].is-folded')).length === 1);
  const rows = await p.$$eval('[data-group="nm"] .fold-row', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok('one line per person: name, temple tag, action · who · when', rows.length === 2 && rows[0].includes('Maria Lopez') && rows[0].includes('Temple: 11 days left') && rows[0].includes('Invite to temple trip · Sister Jensen · Thu'), JSON.stringify(rows));
  ok('no input boxes while folded', (await p.$$('[data-group="nm"] input')).length === 0);
  ok('other lists still open', (await p.$$('[data-group="rm"] input')).length > 0);
  await p.locator('[data-group="nm"]').screenshot({ path: OUT + '/folded.png' });
  await p.reload(); await p.waitForSelector('.chip');
  ok('stays folded after a reload', (await p.$$('[data-group="nm"].is-folded')).length === 1);
  await p.click('[data-group="nm"] .fold-head'); await p.waitForTimeout(200);
  ok('tapping the header reopens it with everything kept', (await p.inputValue('[data-bind="cp.nm.1.action"]')) === 'Visit');
  await p.click('[data-action="list-done"][data-a="nm"]'); await p.click('[data-action="list-done"][data-a="tn"]'); await p.waitForTimeout(200);
  ok('3 Names folds too (empty list says so)', (await p.textContent('#tn-list')).includes('No names added.'));
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await dl.saveAs(OUT + '/a.pdf');
  const t = execFileSync('pdftotext', ['-raw', OUT + '/a.pdf', '-']).toString().replace(/\s+/g, ' ');
  ok('PDF prints folded lists in full', t.includes('Maria Lopez') && t.includes('Tom Hale') && t.includes('Visit') && t.includes('Bro. Lee'));
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  ok('Send & Clear opens everything again', (await p.$$('.is-folded')).length === 0);
  await p.fill('#date', '2026-11-15');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
  ok('next week the carried names start open', (await p.$$('.is-folded')).length === 0 && (await p.inputValue('[data-bind="cp.nm.0.name"]')) === 'Maria Lopez');
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
