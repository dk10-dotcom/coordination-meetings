// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// 'huddle-cp-section' (a test-only flag) brings back the Huddle's Covenant Path Report section these checks use. // cp-section flag
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  const OUT = __dirname + '/out-steps'; require('fs').mkdirSync(OUT, { recursive: true });

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript(() => { try { ['huddle-names-hint-seen', 'huddle-tour-seen', 'huddle-help-seen', 'huddle-cp-section', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    const vis = s => p.isVisible(s);
    // Home: details open on a fresh form, five sections listed, sections hidden
    ok(!(await vis('#details-full')) && await vis('#details-summary') && (await p.textContent('#details-summary')).includes('Huddle Attendees'), 'details closed on a fresh form');
    ok((await p.textContent('#details-sub .warn')).includes('Attendance not taken yet') && await p.evaluate(() => getComputedStyle(document.querySelector('#details-sub .warn')).color) === 'rgb(154, 68, 22)', 'missing attendance shows in dark orange');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways overflow');
    ok(await p.locator('.step-row').count() === 5 && (await p.textContent('.step-row[data-a="fn"]')).includes('Opportunities to invite') && (await p.textContent('.step-row[data-a="fn"] .step-status')).trim() === 'Ward council hasn’t listed any yet' && !(await vis('.step-row[data-a="mr"]')), 'five sections (with the test-only Covenant Path Report), ending with Opportunities to invite; no Missionary Referrals');
    ok(!(await vis('[data-step="rr"]')) && !(await vis('[data-step="cp"]')), 'sections hidden on home');
    ok(await p.locator('.step-row.next, .step-tag, #steps-count, .steps-bar').count() === 0 && await p.locator('.step-num').count() === 0, 'no up next, numbers, empty circles or progress bar');
    await p.click('#details-summary');
    ok(await vis('#details-full') && (await p.textContent('#step-title')).trim() === 'Huddle Attendees' && await vis('#step-bar') && !(await vis('#details-full .btn-collapse')) && !(await vis('#steps-home')), 'Huddle Attendees opens on a page of its own, with Back and its name at the top (Nov 20, 2026)');
    await p.click('#step-bar [data-action="steps-home"]'); await p.waitForTimeout(250);
    ok(!(await vis('#details-full')) && await vis('#details-summary') && await vis('#steps-home'), 'Back goes back to the Huddle’s list');
    await p.click('#details-summary');
    ok(await vis('#details-full') && await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('#details-full')); return cs.borderTopStyle === 'solid' && cs.borderBottomStyle === 'solid'; }), 'open details have a line above and below');
    await p.fill('#ward', 'Sample Ward'); await p.fill('#date', '2026-11-01'); await p.click('[data-action="conducting"][data-a="wml"]');
    for (const a of ['pqa', 'rs', 'eq', 'wml']) await p.click(`[data-action="toggle-att"][data-a="${a}"]`);
    await p.click('#details-full .details-done'); await p.waitForTimeout(250);
    ok(await vis('#details-summary') && (await p.textContent('#details-summary')).includes('4 attended'), 'summary shows ward and attendance');
    ok(await p.locator('#details-sub .warn').count() === 0, 'orange goes away once attendance is taken');
    await p.screenshot({ path: `${OUT}/${tag}-home.png` });
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways overflow on the step list');
    // Open Covenant Path step
    await p.click('[data-action="open-step"][data-a="cp"]');
    ok(await vis('[data-step="cp"]') && !(await vis('[data-step="rr"]')) && !(await vis('header.top')), 'only the Covenant Path step shows');
    ok(await vis('#step-bar') && (await p.textContent('#step-back, #step-bar .step-back')).trim() === 'Back' && (await p.textContent('#step-title')).length > 5 && !(await p.textContent('#step-bar')).includes('Step'), 'top bar shows Back and the section title, no step count');
    await p.click('[data-action="cp-add-first"][data-a="nm"]'); await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Temple baptisms');
    await p.screenshot({ path: `${OUT}/${tag}-step.png` });
    // Back gesture returns to list; status updates
    await p.goBack(); await p.waitForTimeout(200);
    ok(await vis('#steps-home') && !(await vis('[data-step="cp"]')), 'Back returns to the step list');
    ok((await p.textContent('[data-a="cp"] .step-status')).includes('1 person · 1 needs an assignment'), 'status counts people and missing assignments');
    // Mark complete
    await p.click('[data-action="open-step"][data-a="cp"]');
    await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple');
    await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#confirm-sheet')), 'marking done doesn’t ask about Tools (that reminder is on Send now)');
    ok(await p.evaluate(() => document.body.dataset.view) === 'home', 'Mark section done goes back to the list (it never jumps ahead)');
    ok(await p.isVisible('#toast .toast-action') && (await p.textContent('#toast')).includes('marked done'), 'Undo shows right after marking done');
    await p.click('#toast .toast-action'); await p.waitForTimeout(150);
    if (await p.isVisible('[data-action="steps-home"]')) { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200); }
    ok(await p.locator('[data-a="cp"].step-row.done').count() === 0, 'Undo takes the check off');
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#confirm-sheet')) { await p.click('#confirm-primary'); await p.waitForTimeout(200); }
    if (!(await vis('#steps-home'))) { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200); }
    await p.click('[data-action="open-step"][data-a="cp"]');
    ok((await p.getAttribute('#step-done-btn', 'class')).includes('is-done') && (await p.textContent('#step-done-label')) === 'Done', 'a done section shows a green Done');
    ok(await p.isVisible('#step-foot .undone-link'), 'a small Mark as not done link sits under it');
    await p.click('#step-foot .undone-link'); await p.waitForTimeout(150);
    ok(!(await p.getAttribute('#step-done-btn', 'class')).includes('is-done') && (await p.textContent('#step-done-label')) === 'Mark done', 'Mark as not done takes the mark off');
    await p.click('[data-action="step-done"]'); await p.waitForTimeout(200); if (await p.isVisible('#confirm-sheet')) { await p.click('#confirm-primary'); await p.waitForTimeout(200); }
    if (!(await vis('#steps-home'))) { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200); } // Mark done went on to the next section
    ok(await p.locator('[data-a="cp"].step-row.done').count() === 1 && await p.locator('.step-row.done').count() === 1, 'section gets a green check');
    // One big button per screen (Nov 19, 2026, night): no Next or Back links under Mark done
    await p.click('[data-action="open-step"][data-a="fn"]'); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#step-next')) && !(await p.isVisible('#step-prev')), 'no Next or Back links under Mark done');
    await p.locator('#step-done-btn').screenshot({ path: `${OUT}/${tag}-foot.png` });
    await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    ok(await vis('#steps-home'), 'All steps button returns');
    // Draft keeps progress after reload
    await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    ok(await p.locator('[data-a="cp"].step-row.done').count() === 1 && await vis('#details-summary'), 'check and summary survive a reload');
    // Send & Clear resets
    await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
    if (process.env.DBG) { console.log(await p.evaluate(() => { const r = e => JSON.stringify(document.querySelector(e).getBoundingClientRect()); return [r('.actionbar'), r('.fine-notes'), innerHeight, scrollY, document.documentElement.scrollHeight, document.body.className].join(' | '); })); await p.screenshot({ path: OUT + '/dbg.png' }); }
    await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])'); await p.click('#share-btn');
    await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-primary');
    await p.waitForTimeout(300);
    ok(await p.locator('.step-row.done').count() === 0 && await vis('#start-home') && (await p.textContent('#sent-line')).includes('huddle sent'), 'after sending, Done goes to the opening screen: the next huddle starts with no checks and the sent line shows');
    await p.click('.door-hd'); await p.waitForTimeout(300);
    // Missing ward on send opens details
    await p.fill('#ward', '').catch(() => {});
    // Clear keeps the ward name
    await p.fill('#ward', 'Sample Ward').catch(() => {});
    await p.click('[data-action="open-details"]').catch(() => {}); await p.fill('#ward', 'Sample Ward'); await p.fill('[data-bind="find.plan"]', 'x').catch(() => {}); await p.click('#details-full .details-done').catch(() => {}); await p.waitForTimeout(250);
    await p.click('[data-action="open-step"][data-a="fn"]').catch(() => {}); await p.click('[data-action="add-opp"]'); await p.fill('[data-bind="find.opps.0.title"]', 'Plan'); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('.clear-link').click());
    await Promise.all([p.waitForNavigation().catch(() => {}), p.click('#confirm-primary')]); await p.waitForTimeout(600);
    ok(!(await p.evaluate(() => localStorage.getItem('huddle-ward'))) && !/Plan/.test(await p.evaluate(() => localStorage.getItem('huddle-agenda-v1') || '')), 'Erase everything starts over: the ward name and the huddle are gone (Nov 20, 2026)');
    await p.goto('about:blank'); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {}); if (await p.isVisible('#ward-sheet')) await p.click('[data-action="close-ward"]');
    ok(await p.locator('.btn-done:visible').count() === 0, 'no list Done buttons in the step view');
    // View-all flag shows the classic long page
    await p.evaluate(() => localStorage.setItem('huddle-view-all', '1')); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    ok(await vis('[data-step="rr"]') && await vis('[data-step="fn"]') && !(await vis('#steps-home')), 'view-all shows every section');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
