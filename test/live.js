// Always the next huddle: Send closes it and sets up the next one (+ Undo), Share again, Return and Report as the one place to mark, 4-week name rule.
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-live'; fs.mkdirSync(OUT, { recursive: true });
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  // Test hook: age a name card as the page loads (after the previous page saved itself on the way out).
  await ctx.addInitScript(() => { try { const d = localStorage.getItem('__touch'); if (d) { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.cp.nm[0].touched = d; localStorage.setItem('huddle-agenda-v1', JSON.stringify(s)); localStorage.removeItem('__touch'); } } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
  const home = async () => { if (await p.isVisible('[data-action="steps-home"]')) await p.click('[data-action="steps-home"]'); await p.waitForTimeout(150); };
  const open = async id => { await home(); await p.click(`[data-action="open-step"][data-a="${id}"]`); };
  const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});

  const md = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const longD = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const rrRow = async () => (await p.textContent('.step-row[data-a="rr"] .step-status')).trim();
  const sendNow = async () => {
    await home(); await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')); await p.waitForTimeout(200);
    if (await p.isVisible('#confirm-sheet') && /Ready to send/.test(await p.textContent('#confirm-title'))) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])'); await p.click('#share-btn'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  };

  ok(await p.isVisible('#steps-home') && await p.isVisible('#mode-bar') && !(await p.isVisible('#start-home')), 'the #huddle link opens the huddle’s list, with Back');
  ok((await p.textContent('#meeting-date .md-text')) === longD(daysAgo(0)), 'the huddle date is today without setting it: ' + (await p.textContent('#meeting-date .md-text')));
  ok(await p.evaluate(() => { const i = document.querySelector('#meeting-date input[type=date]'); return !!i && i.id === 'date'; }) && !(await p.evaluate(() => !!document.querySelector('#details-full input[type=date]'))), 'the date is set at the top, not in Huddle Attendees');
  ok((await rrRow()).startsWith('Nothing yet. After your first huddle'), 'Return and Report row before the first send: ' + await rrRow());
  ok((await p.textContent('#band-rr')).trim() === 'From the last huddle', 'home groups before a date: ' + await p.textContent('#band-rr'));
  const today = daysAgo(0);
  await fill('date', today); await p.waitForTimeout(100);
  ok((await p.textContent('#meeting-date .md-text')) === longD(today), 'changing the date updates the label');
  await p.click('#details-summary'); await fill('ward', 'Test Ward'); await p.click('[data-action="conducting"][data-a="wml"]'); await p.click('#details-full .btn-collapse');

  await open('cp'); await p.click('[data-action="cp-add-first"][data-a="nm"]');
  await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.need', 'A ride');
  await fill('cp.nm.0.action', 'Drive him to the temple'); await fill('cp.nm.0.assigned', 'Bro. Patel'); await blur();
  ok(await p.locator('.btn-completed').count() === 0 && await p.isVisible('.btn-text-assign[data-a="cp.nm.0."]'), 'no Mark completed on the card (Text this assignment stays)');
  await open('tn'); await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.action', 'Invite to temple prep'); await blur();
  await open('fn'); await fill('find.plan', 'Invite friends to the devotional'); await fill('find.items.0.task', 'Each family invites a friend'); await blur();
  await home();
  ok(await p.locator('#newweek-btn').count() === 0 && !(await p.isVisible('#load-panel')), 'no Start button and no Load panel on the huddle’s list');
  ok(await p.locator('#date-nudge').count() === 0, 'no “has passed” nudge');
  ok((await p.textContent('#send-label')).trim() === 'Send' && !(await p.isVisible('#sent-line')), 'not sent yet: Send, no sent line');

  // Ready to send? (attendance not taken, Return and Report empty is fine)
  await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
  await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await p.textContent('#confirm-title')).includes('Ready to send?') && (await p.textContent('#confirm-compare')).includes('Attendance not taken'), 'Ready to send? lists what is open');
  await p.screenshot({ path: `${OUT}/ready.png` });
  await p.click('#confirm-compare .jump-row'); await p.waitForTimeout(200);
  ok(await p.isVisible('#details-full'), 'tapping a row goes to it (attendance)');
  await p.click('[data-action="toggle-att"][data-a="wml"]'); await p.click('#details-full .btn-collapse');
  await p.click('[data-action="open-step"][data-a="fn"]'); await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  ok(await p.locator('.step-row.done').count() === 1, 'one section checked before sending');
  await sendNow();

  // Send closes the huddle and sets up the next one
  const next = today;
  ok((await p.textContent('#confirm-title')).trim() === 'Sent successfully' && (await p.textContent('#confirm-body')).includes('set for your next huddle') && (await p.textContent('#confirm-body')).includes('assignments are now in Return and Report'), 'Sent successfully: set for the next huddle, no dates');
  ok((await p.textContent('#confirm-secondary')).trim() === 'Undo', 'Undo is offered right after sending');
  await p.screenshot({ path: `${OUT}/sent.png` });
  await p.click('#confirm-primary'); await p.waitForTimeout(250);
  ok(await p.inputValue('#date') === today, 'the next huddle is dated today until it’s sent: ' + await p.inputValue('#date'));
  ok(await p.isVisible('#sent-line') && (await p.textContent('#sent-line-text')).trim() === '✓ ' + md(today) + ' huddle sent' && await p.isVisible('[data-action="share-last"]'), 'under the date: ✓ ' + md(today) + ' huddle sent · Share again');
  ok((await p.textContent('#send-label')).trim() === 'Send', 'Send stays Send');
  ok((await rrRow()) === '0 of 3 marked', 'home row: ' + await rrRow());
  ok((await p.textContent('#band-rr')).trim() === 'From the last huddle' && (await p.textContent('#band-plan')).trim() === 'This huddle’s plan', 'groups have no dates: ' + await p.textContent('#band-rr') + ' / ' + await p.textContent('#band-plan'));
  ok((await p.textContent('#details-sub')).includes('Attendance not taken'), 'attendance cleared');
  ok(await p.locator('.step-row.done').count() === 0, 'section checks cleared');
  await p.locator('header.top').screenshot({ path: `${OUT}/header-next.png` });
  await open('rr');
  ok((await p.textContent('#rr-from')).includes('From the last huddle'), 'Return and Report says where its items came from: ' + await p.textContent('#rr-from'));
  ok(await p.locator('#rr-list .rr-card').count() === 3, 'the 3 action items are in Return and Report');
  await p.click('[data-action="happened"][data-a="0"][data-b="No"]');
  ok((await p.textContent('[data-action="carry-fwd"][data-a="0"]')).trim() === 'Carry forward to this huddle', 'Carry forward has no date: ' + await p.textContent('[data-action="carry-fwd"][data-a="0"]'));
  await p.click('[data-action="happened"][data-a="0"][data-b="No"]');
  await open('cp');
  ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await p.inputValue('[data-bind="cp.nm.0.need"]') === 'A ride' && await p.inputValue('[data-bind="cp.nm.0.action"]') === '', 'names and needs stay; actions clear');
  ok((await p.textContent('[data-group="nm"] .source')).trim() === 'From the last huddle', 'kept names are tagged From the last huddle');
  await open('tn');
  ok(await p.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson', 'focus names stay');

  // During the week: mark in Return and Report (the one place)
  await open('rr'); await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]'); await home();
  ok((await rrRow()) === '1 of 3 marked', 'marking one shows on the home row: ' + await rrRow());
  await p.screenshot({ path: `${OUT}/home-next.png` });

  // Persists across reloads (localStorage)
  await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
  ok((await p.textContent('#sent-line-text')).includes(md(today) + ' huddle sent') && (await rrRow()).includes('1 of 3 marked') && await p.inputValue('#date') === today, 'marks and the sent line survive a reload');

  // Changing the date just changes it
  const moved = plus(9);
  await fill('date', moved); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#confirm-sheet')) && await p.inputValue('#date') === moved && (await rrRow()).includes('1 of 3 marked'), 'a new date just changes the date; nothing else moves');
  await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' }); ok(await p.inputValue('#date') === moved, 'a date you pick is kept (it isn’t reset to today)');

  // Share again: the sent huddle's PDF, without touching the next huddle
  await p.click('[data-action="share-last"]'); await p.waitForSelector('#share-btn:not([disabled])');
  ok((await p.textContent('#send-title')).trim() === 'Share the ' + md(today) + ' agenda again', 'Share again opens the sent huddle: ' + await p.textContent('#send-title'));
  await p.click('#share-btn'); await p.waitForTimeout(300);
  ok((await p.textContent('#toast')).includes('Shared again') && await p.inputValue('#date') === moved && (await rrRow()).includes('1 of 3 marked'), 'shared again; the next huddle is unchanged');

  // Undo right after sending puts the huddle back
  await sendNow();
  ok((await p.textContent('#confirm-body')).includes('set for your next huddle'), 'the next send says the same');
  await p.click('#confirm-secondary'); await p.waitForTimeout(300);
  ok(await p.inputValue('#date') === moved && (await rrRow()).includes('1 of 3 marked') && (await p.textContent('#sent-line-text')).includes(md(today) + ' huddle sent'), 'Undo puts the huddle back, and the earlier sent copy');
  ok((await p.textContent('#toast')).includes('Your huddle is back'), 'Undo says so');
  // Send it for real: the sent copy is replaced
  await sendNow(); await p.click('#confirm-primary'); await p.waitForTimeout(250);
  ok((await p.textContent('#sent-line-text')).trim() === '✓ ' + md(moved) + ' huddle sent' && await p.inputValue('#date') === today, 'the PDF carried the picked date; the next huddle goes back to today');
  await open('rr');
  ok(await p.locator('#rr-list .rr-card').count() > 0 && (await p.textContent('#rr-from')).includes('last huddle'), 'Return and Report is from the newest huddle');
  await home();

  // A sent copy more than 5 weeks old isn't kept
  await p.evaluate(() => { const k = 'huddle-last-sent'; const v = JSON.parse(localStorage.getItem(k)); v.sentAt = new Date(Date.now() - 40 * 86400000).toISOString(); localStorage.setItem(k, JSON.stringify(v)); });
  await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
  ok(!(await p.isVisible('#sent-line')) && await p.evaluate(() => localStorage.getItem('huddle-last-sent') === null), 'a sent copy older than 5 weeks is removed');

  // 4-week rule
  const setTouched = async (days) => {
    await p.evaluate(d => localStorage.setItem('__touch', d), days);
    await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
  };
  await setTouched(daysAgo(30)); await open('cp');
  ok(await p.isVisible('.stale-note') && (await p.textContent('.stale-note')).includes('Still on the Covenant Path Report?'), 'a name untouched 4 weeks asks if it is still on the report');
  await p.locator('.stale-note').screenshot({ path: `${OUT}/stale.png` });
  await p.click('[data-action="stale-keep"]'); await p.waitForTimeout(150);
  ok(!(await p.isVisible('.stale-note')), 'Keep clears the question');
  await setTouched(daysAgo(40));
  ok((await p.textContent('#toast')).includes('not updated in 5 weeks'), 'a name untouched 5 weeks is removed, with a note');
  await open('cp');
  ok(await p.locator('.list-nm.is-empty').count() === 1, 'the stale name is gone');

  // Clear erases the sent copy too
  await sendNow(); await p.click('#confirm-primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!localStorage.getItem('huddle-last-sent')), 'a sent copy is kept');
  await home(); await p.evaluate(() => document.querySelector('.clear-link').click()); await p.click('#confirm-primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => localStorage.getItem('huddle-last-sent') === null) && !(await p.isVisible('#sent-line')), 'Clear erases the sent copy too');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
