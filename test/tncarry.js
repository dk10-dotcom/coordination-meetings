// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
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

(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
  if (await p.isVisible('[data-action="open-details"]')) await p.click('[data-action="open-details"]'); await fill('ward', 'Test Ward'); await fill('date', '2026-10-25'); await p.click('[data-action="conducting"][data-a="wml"]');
  await p.click('[data-action="close-details"]');
  await p.click('[data-action="open-step"][data-a="tn"]');
  await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.need', 'Temple prep class'); await fill('tn.0.action', 'Invite to temple prep');
  await fill('tn.1.name', 'Ethan Walker'); await fill('tn.1.ordinance', 'Melchizedek Priesthood');
  await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
  await nextWeek(p, '2026-11-01');
  await p.click('[data-action="open-step"][data-a="tn"]');
  const names = [0, 1, 2].map(i => p.inputValue(`[data-bind="tn.${i}.name"]`));
  const v = await Promise.all(names);
  ok(v[2] === '', 'third spot stays open: ' + v[2]);
  ok(v[0] === 'Grace Thompson' && v[1] === 'Ethan Walker', 'last week’s focus names stay: ' + v.join(', '));
  ok(await p.inputValue('[data-bind="tn.0.ordinance"]') === 'Endowment' && await p.inputValue('[data-bind="tn.0.need"]') === 'Temple prep class', 'ordinance and need carried');
  ok(await p.inputValue('[data-bind="tn.0.action"]') === '', 'action left blank for this week');
  ok(await p.locator('#tn-list .source', { hasText: 'From the last huddle' }).count() === 2, 'marked From the last huddle');
  ok((await p.textContent('#rr-list')).includes('Grace Thompson'), 'Grace’s action is in Return and Report');
  ok(!errs.length, 'no errors ' + errs.join('; '));
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
