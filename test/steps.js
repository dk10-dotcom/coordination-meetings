// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
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
    await ctx.addInitScript(() => { try { ['huddle-names-hint-seen', 'huddle-tour-seen', 'huddle-help-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    const vis = s => p.isVisible(s);
    // Home: details open on a fresh form, five sections listed, sections hidden
    ok(!(await vis('#details-full')) && await vis('#details-summary') && (await p.textContent('#details-summary')).includes('Huddle Attendees'), 'details closed on a fresh form');
    ok((await p.textContent('#details-sub .warn')).includes('Attendance not taken yet') && await p.evaluate(() => getComputedStyle(document.querySelector('#details-sub .warn')).color) === 'rgb(154, 68, 22)', 'missing attendance shows in dark orange');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways overflow');
    ok(await p.locator('.step-row').count() === 5 && (await p.textContent('.step-row[data-a="mr"]')).includes('Missionary Referrals') && (await p.textContent('.step-row[data-a="mr"] .step-status')).trim() === 'None listed', 'five sections, ending with Missionary Referrals');
    ok(!(await vis('[data-step="rr"]')) && !(await vis('[data-step="cp"]')), 'sections hidden on home');
    ok(await p.locator('.step-row.next, .step-tag, #steps-count, .steps-bar').count() === 0 && await p.locator('.step-num').count() === 0, 'no up next, numbers, empty circles or progress bar');
    await p.click('#details-summary');
    ok(await vis('#details-full .btn-collapse'), 'open details have a Close button at the top');
    await p.click('#details-full .btn-collapse'); await p.waitForTimeout(150);
    ok(!(await vis('#details-full')) && await vis('#details-summary'), 'Close at the top collapses the details');
    await p.click('#details-summary');
    ok(await vis('#details-full') && await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('#details-full')); return cs.borderTopStyle === 'solid' && cs.borderBottomStyle === 'solid'; }), 'open details have a line above and below');
    await p.fill('#ward', 'Sample Ward'); await p.fill('#date', '2026-11-01'); await p.click('[data-action="conducting"][data-a="wml"]');
    for (const a of ['pqa', 'rs', 'eq', 'wml']) await p.click(`[data-action="toggle-att"][data-a="${a}"]`);
    await p.click('[data-action="close-details"]');
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
    ok((await p.textContent('[data-a="cp"] .step-status')).includes('1 person · 1 needs an action'), 'status counts people and missing actions');
    // Mark complete
    await p.click('[data-action="open-step"][data-a="cp"]');
    await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple');
    await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#confirm-sheet')), 'marking done doesn’t ask about Tools (that reminder is on Send now)');
    ok(await vis('#steps-home'), 'Mark section done returns to the list');
    ok(await p.isVisible('#toast .toast-action') && (await p.textContent('#toast')).includes('marked done'), 'Undo shows right after marking done');
    await p.click('#toast .toast-action'); await p.waitForTimeout(150);
    ok(await p.locator('[data-a="cp"].step-row.done').count() === 0, 'Undo takes the check off');
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#confirm-sheet')) { await p.click('#confirm-primary'); await p.waitForTimeout(200); }
    await p.click('[data-action="open-step"][data-a="cp"]');
    ok(await vis('.step-undone') && (await p.textContent('#step-done-label')).includes('Section done'), 'a done section offers Mark as not done');
    await p.click('.step-undone'); await p.waitForTimeout(150);
    ok(!(await vis('.step-undone')) && (await p.textContent('#step-done-label')).includes('Mark section done'), 'Mark as not done clears it');
    await p.click('[data-action="step-done"]'); await p.waitForTimeout(200); if (await p.isVisible('#confirm-sheet')) { await p.click('#confirm-primary'); await p.waitForTimeout(200); }
    ok(await p.locator('[data-a="cp"].step-row.done').count() === 1 && await p.locator('.step-row.done').count() === 1, 'section gets a green check');
    // Next step link
    await p.click('[data-action="open-step"][data-a="tn"]');
    ok((await p.textContent('#step-next')).includes('Find New People to Teach'), 'next step link');
    ok((await p.textContent('#step-prev')).includes('Covenant Path') && !(await p.textContent('#step-prev')).includes('Report Review'), 'back link names the previous step (Covenant Path Report)');
    await p.click('#step-next');
    ok(await vis('[data-step="fn"]') && (await p.textContent('#step-next')).includes('Missionary Referrals'), 'went to Find New People to Teach; next is Missionary Referrals');
    await p.click('#step-next');
    ok(await vis('[data-step="mr"]') && !(await p.isVisible('#step-next')) && (await p.textContent('#step-title')) === 'Missionary Referrals', 'went to the last section; no next link');
    await p.click('#step-prev');
    await p.locator('#step-foot').screenshot({ path: `${OUT}/${tag}-foot.png` });
    await p.click('#step-prev');
    ok(await vis('[data-step="tn"]'), 'Back goes to the previous step');
    await p.click('#step-next');
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
    ok(await p.locator('.step-row.done').count() === 0 && await vis('#steps-home') && (await p.textContent('#sent-line')).includes('huddle sent'), 'after sending, the next huddle starts with no checks and the sent line shows');
    // Missing ward on send opens details
    await p.fill('#ward', '').catch(() => {});
    // Clear keeps the ward name
    await p.fill('#ward', 'Sample Ward').catch(() => {});
    await p.click('[data-action="open-details"]').catch(() => {}); await p.fill('#ward', 'Sample Ward'); await p.fill('[data-bind="find.plan"]', 'x').catch(() => {});
    await p.click('[data-action="open-step"][data-a="fn"]').catch(() => {}); await p.fill('[data-bind="find.plan"]', 'Plan'); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('.clear-link').click()); await p.click('#confirm-primary'); await p.waitForTimeout(200);
    ok(await p.inputValue('#ward') === 'Sample Ward', 'Clear keeps the ward name');
    ok(await p.locator('.btn-done:visible').count() === 0, 'no list Done buttons in the step view');
    // View-all flag shows the classic long page
    await p.evaluate(() => localStorage.setItem('huddle-view-all', '1')); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    ok(await vis('[data-step="rr"]') && await vis('[data-step="fn"]') && !(await vis('#steps-home')), 'view-all shows every section');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
