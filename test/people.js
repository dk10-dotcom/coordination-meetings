const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  const OUT = __dirname + '/out-people'; require('fs').mkdirSync(OUT, { recursive: true });
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

  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev], acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { ['huddle-names-hint-seen', 'huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
    // 1. Name at the top
    ok(await p.$eval('[data-bind="cp.nm.0.name"]', i => i.closest('.card-head') && getComputedStyle(i).fontWeight >= 700), 'name field is the bold card title');
    await fill('cp.nm.0.name', 'Daniel Rivera');
    ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera', 'name typed in the title');
    ok((await p.getAttribute('[data-bind="tn.0.name"]', 'placeholder')) === 'Focus name 1', 'Name Next Ordinance placeholder');
    // last week
    await fill('ward', 'Test Ward'); await fill('date', '2026-10-25');
    await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.action', 'Schedule interview'); await fill('cp.nm.0.assigned', 'Bishop'); await fill('cp.nm.0.when', 'Sun');
    await fill('cp.rm.0.name', 'Marcus Bell'); await fill('cp.rm.0.action', 'Invite to activity');
    await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.action', 'Invite to temple prep');
    await fill('find.items.0.task', 'Hand out flyers'); await fill('find.items.0.when', 'Sat');
    // this week: load and carry forward
    await nextWeek(p, '2026-11-01');
    const heads = await p.$$eval('#rr-list .card-item', e => e.map(x => x.textContent.trim()));
    ok(heads.join('|') === 'Daniel Rivera|Marcus Bell|Grace Thompson|Finding new people', 'Return and Report headers show names: ' + heads.join('|'));
    for (const i of [0, 2, 3]) { await p.click(`[data-action="happened"][data-a="${i}"][data-b="No"]`); await p.click(`[data-action="carry-fwd"][data-a="${i}"]`); }
    await p.click('[data-action="happened"][data-a="1"][data-b="Yes"]');
    const nmCard = p.locator('[data-group="nm"] .card').filter({ has: p.locator('[data-bind="cp.nm.0.name"]') });
    ok(await nmCard.locator('.carried-tag').count() === 1, 'carried tag on New members card');
    ok(await p.locator('#tn-list .carried-tag').count() === 1, 'carried tag on Name Next Ordinance card');
    ok(await p.locator('#fn-list .carried-tag').count() === 1, 'carried tag on finding assignment');
    ok(await p.locator('[data-group="rm"] .carried-tag').count() === 0, 'no carried tag where nothing was carried');
    await p.waitForTimeout(3500); await nmCard.screenshot({ path: `${OUT}/${tag}-card.png` });
    await p.locator('#rr-list .rr-card').first().screenshot({ path: `${OUT}/${tag}-rr.png` });
    // clearing the action removes the tag
    await fill('cp.rm.0.name', 'Marcus Bell');
    // 2. Done, then edit one
    await fill('cp.nm.0.assigned', 'Bro. Patel');
    await p.click('[data-action="list-done"][data-a="nm"]');
    if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
    ok(await p.locator('[data-group="nm"].is-folded').count() === 1, 'New members folded');
    ok(await p.locator('[data-group="nm"] .fold-tag', { hasText: 'Carried over' }).count() === 1, 'folded row says Carried over');
    await p.click('[data-group="nm"] .fold-row-btn >> nth=0');
    ok(await p.locator('[data-group="nm"] .fold-open .card').count() === 1, 'tapped name opens its card');
    ok(await p.locator('[data-group="nm"].is-folded').count() === 1, 'list stays folded');
    await fill('cp.nm.0.when', 'Sat 9 am');
    await p.locator('[data-group="nm"]').screenshot({ path: `${OUT}/${tag}-editone.png` });
    await p.click('[data-group="nm"] [data-action="close-one"]');
    ok(await p.locator('[data-group="nm"] .fold-open').count() === 0, 'Done with closes the one card');
    await p.locator('[data-group="nm"]').screenshot({ path: `${OUT}/${tag}-folded.png` });
    ok((await p.textContent('[data-group="nm"] .fold-plan')).includes('Sat 9 am'), 'edit shows in the folded row');
    // Return and Report fold and edit one
    await p.click('[data-action="list-done"][data-a="rr"]');
    await p.click('#rr-list .fold-row-btn >> nth=1');
    ok(await p.locator('#rr-list .fold-open .rr-card').count() === 1, 'Return and Report item opens alone');
    await p.click('#rr-list [data-action="close-one"]');
    // PDF
    await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
    await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
    await p.click('#share-btn');
    await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).trim() === 'Sent successfully', 'sent popup title');
    ok(await p.isVisible('#confirm-sheet .ok-icon') && !(await p.isVisible('#confirm-sheet .warn-icon')), 'green check, no warning icon');
    ok((await p.textContent('#confirm-sheet')).includes('set for your next huddle') && await p.isVisible('#confirm-secondary') && (await p.textContent('#confirm-secondary')).trim() === 'Undo', 'sent popup: next huddle is set up, with Undo');
    await p.screenshot({ path: `${OUT}/${tag}-sent.png` });
    await p.click('#confirm-primary');
    ok(await p.isVisible('#sent-line') && (await p.textContent('#sent-line')).includes('huddle sent') && await p.isVisible('[data-action="share-last"]'), 'shows the huddle was sent, with Share again');
    // PDF text: Share again, as a download
    await p.evaluate(() => { navigator.canShare = () => false; });
    await p.click('[data-action="share-last"]'); await p.waitForSelector('#share-btn:not([disabled])');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    const f = `${OUT}/${tag}.pdf`; await dl.saveAs(f);
    const t = execSync(`pdftotext -layout "${f}" -`).toString();
    ok((t.match(/Carried over from Oct 25/g) || []).length === 3, 'PDF marks 3 carried actions with the last huddle’s date: ' + (t.match(/Carried over from Oct 25/g) || []).length);
    ok(/FROM THE OCT 25 HUDDLE/.test(t) && /NOV 1 HUDDLE PLAN/.test(t), 'PDF bands name the huddles by date');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
