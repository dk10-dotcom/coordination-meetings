const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-view-all'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  ok((await p.textContent('#attendee-list')).includes('High Councilor') && !(await p.textContent('#attendee-list')).includes('Councilman'), 'High Councilor');
  ok(await p.locator('[data-bind="cp.bt.0.ordinance"]').count() === 0 && (await p.textContent('[data-group="bt"] .fixed-value')).trim() === 'Baptism', 'being taught: ordinance fixed to Baptism');
  await p.fill('#ward', 'Test Ward'); await p.fill('#date', '2026-11-01');
  await p.click('#attendee-list .chip:has-text("High Councilor")');
  await p.fill('[data-bind="cp.bt.0.name"]', 'Olivia Chen'); await p.fill('[data-bind="cp.bt.0.action"]', 'Teach lesson 3');
  await p.click('[data-group="bt"] .commit-box');
  ok(!(await p.isVisible('#toast')) || !(await p.textContent('#toast')).includes('Covenant Path Report'), 'no reminder for committed to baptism');
  await p.click('[data-group="rm"] .sac-toggle >> nth=0');
  await p.waitForTimeout(4500); ok(await p.isVisible('#toast') && (await p.textContent('#toast')).includes('sacrament'), 'sacrament reminder still showing after 4.5 s');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  await dl.saveAs(__dirname + '/out-fixed.pdf');
  const t = execSync(`pdftotext -layout "${__dirname}/out-fixed.pdf" -`).toString();
  ok(/Olivia Chen[\s\S]{0,80}Next ordinance\s+Baptism/.test(t), 'PDF shows Baptism for being taught');
  ok(/Attended\s+High Councilor/.test(t), 'PDF lists High Councilor as attended');
  ok(!/Relief Society|Elders Quorum|Primary presidency/.test(t), 'PDF leaves out the people who did not attend');
  ok(!errs.length, 'no errors ' + errs.join('; '));
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
