const { chromium, devices } = require('playwright');
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

(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { ['huddle-names-hint-seen', 'huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
    await fill('ward', 'Test Ward'); await fill('date', '2026-10-25');
    await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.action', 'Schedule interview'); await fill('cp.nm.0.assigned', 'Bishop');
    await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.action', 'Invite to temple prep'); await fill('tn.0.assigned', 'Sister Diaz');
    await fill('find.items.0.task', 'Hand out flyers'); await fill('find.items.0.when', 'Sat');
    // a card added this week that carry forward will add a new card next to
    await nextWeek(p, '2026-11-01');
    // New members: Daniel carried as a name (no action) -> carry fills the action
    await p.click('[data-action="happened"][data-a="0"][data-b="No"]'); await p.click('[data-action="carry-fwd"][data-a="0"]');
    ok(await p.inputValue('[data-bind="cp.nm.0.action"]') === 'Schedule interview', 'carried into Daniel');
    await fill('cp.nm.0.when', 'Sat 9 am'); // typed after carrying: should survive undo
    ok(await p.locator('#rr-list .btn-undo').count() === 1, 'Undo button shows after carrying');
    await p.waitForTimeout(3600); await p.locator('#rr-list .rr-card').first().screenshot({ path: `test/out-people/${tag}-undo-btn.png` });
    await p.click('#rr-list [data-action="undo-carry"][data-a="0"]');
    ok((await p.textContent('#confirm-title')).includes('Undo carry forward'), 'asks before undoing');
    await p.click('#confirm-secondary');
    ok(await p.inputValue('[data-bind="cp.nm.0.action"]') === 'Schedule interview', 'Keep it leaves the carry');
    await p.click('#rr-list [data-action="undo-carry"][data-a="0"]'); await p.click('#confirm-primary');
    ok(await p.inputValue('[data-bind="cp.nm.0.action"]') === '', 'undo clears the carried action');
    ok(await p.inputValue('[data-bind="cp.nm.0.assigned"]') === '', 'undo clears the carried assignee');
    ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera', 'name (from last week) stays');
    ok(await p.inputValue('[data-bind="cp.nm.0.when"]') === 'Sat 9 am', 'what you typed since stays');
    ok(await p.locator('[data-group="nm"] .carried-tag').count() === 0, 'carried tag gone');
    ok(await p.locator('#rr-list [data-action="carry-fwd"][data-a="0"]').count() === 1, 'Carry forward button is back');
    // Name Next Ordinance: carry fills an empty slot; undo empties it again
    await p.click('[data-action="happened"][data-a="1"][data-b="Partly"]'); await p.click('[data-action="carry-fwd"][data-a="1"]');
    ok(await p.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson', 'carried into Name Next Ordinance');
    // marking Yes afterwards offers to undo
    await p.click('[data-action="happened"][data-a="1"][data-b="Yes"]');
    await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Take it off this huddle’s plan too?'), 'marking Yes offers to take it off');
    await p.click('#confirm-primary');
    ok(await p.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson' && await p.inputValue('[data-bind="tn.0.action"]') === '', 'carried action cleared; name from last week stays');
    ok(await p.locator('#rr-list [data-a="1"][data-b="Yes"][aria-pressed="true"]').count() === 1, 'still marked Yes');
    // Finding new people: added assignment is removed
    await p.click('[data-action="happened"][data-a="2"][data-b="No"]'); await p.click('[data-action="carry-fwd"][data-a="2"]');
    ok(await p.inputValue('[data-bind="find.items.0.task"]') === 'Hand out flyers', 'assignment carried');
    await p.click('#rr-list [data-action="undo-carry"][data-a="2"]'); await p.click('#confirm-primary');
    ok(await p.inputValue('[data-bind="find.items.0.task"]') === '' && await p.locator('.fn-assign').count() === 1, 'assignment removed');
    // a name that's no longer on its list gets no Carry forward
    await p.fill('[data-bind="cp.nm.0.name"]', 'Someone Else');
    await p.evaluate(() => document.activeElement.blur()); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Is this the same person?'), 'changing the name asks if it’s the same person'); await p.click('#confirm-secondary'); await p.waitForTimeout(150);
    await p.click('[data-action="happened"][data-a="0"][data-b="Partly"]'); await p.waitForTimeout(150);
    ok(await p.locator('#rr-list [data-action="carry-fwd"][data-a="0"]').count() === 0 && (await p.textContent('#rr-list')).includes('Daniel Rivera is no longer on the Covenant Path Report list'), 'no Carry forward once the name is off the list');
    ok(await p.locator('[data-group="nm"] .card').count() === 1, 'no card is added for the missing name');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
