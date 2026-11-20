// The week's flow made plain (Nov 19, 2026):
// - Opening screen: Huddle, the ward and the date first, the vision a small line under them; step 1 says Start here
//   in a new week; Hand off is a quiet line under the four steps (the bottom bar is Home and Send).
// - Each step's instructions sit behind an "i" in its header card: open the first time, tucked away after that.
// - Huddle: Mark done is gray until Focus names has an assignment, who and when on every name (tapping it opens the
//   first one missing), and until an event has an assignment (or says No upcoming events when there are none).
//   Mark done goes straight on to the next section; after the last, home with what's next.
// - A focus name's Huddle screen shows ward council's part as one line with an "i".
// - After the huddle: each changed name is ticked Updated in the report before Mark done works.
// - The first time from the Home Screen, the ward name is asked first.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
const flags = ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-gate-off', 'huddle-swipe-hint-seen'];
(async () => {
  const b = await chromium.launch();
  const snapA = { sac: false, temple: false, committed: false, bap: '2026-11-08', ordinance: '', need: '', appt: '', checks: {} };
  const st = { ward: 'Sample Ward', verified: { before: true, after: false },
    cp: { nm: [{ name: 'Daniel Rivera', bap: '2026-11-08', sac: true }], rm: [], bt: [] },
    tn: [{ name: 'Marcus Bell', ordinance: 'Endowment' }, { name: 'Grace Thompson', ordinance: 'Sealing', action: 'Visit', assigned: 'Bro. Hansen', when: '2026-11-22' }],
    find: { opps: [{ id: 'o1', title: 'Ward Christmas party', date: '2026-12-12' }], items: [] },
    bwSnap: { 'nm|daniel rivera': snapA } };
  const c = await b.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 640 } });
  await c.addInitScript(([s, f]) => { try { f.forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__seeded')) { localStorage.setItem('huddle-agenda-v1', s); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, [JSON.stringify(st), flags]);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = ms => p.waitForTimeout(ms);
  const view = () => p.evaluate(() => document.body.dataset.view);
  const btn = async () => (await p.textContent('#step-done-btn')).trim();
  const blocked = () => p.evaluate(() => document.querySelector('#step-done-btn').classList.contains('is-blocked'));
  await p.goto(BASE); await w(900); await p.click('[data-action="dismiss-install"]').catch(() => {});
  // Opening screen
  ok((await p.textContent('.title-text h1')).trim() === 'Huddle' && await p.evaluate(() => { const t = document.querySelector('.title-text'); const w2 = t.querySelector('.start-where'), sub = t.querySelector('.title-sub'); return !!w2 && !!sub && (w2.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }) && /One by One/.test(await p.textContent('.title-sub')) && /Joyfully gathering Israel one by one in Christ/.test(await p.textContent('.title-sub')), 'opening screen: Huddle, then the ward and date, then the vision as a small line');
  ok(await p.locator('.actionbar [data-action="handoff"]').count() === 0 && await p.isVisible('.actionbar .nav-home') && await p.isVisible('.actionbar .nav-send'), 'the bottom bar is Home and Send');
  ok(await p.isVisible('.handoff-line [data-action="handoff"]') && /Someone else conducting\?/.test(await p.textContent('.handoff-line')), 'Hand off is a line under the four steps');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the opening screen fits 320 px');
  // The Huddle: instructions behind the i, open the first time
  await p.click('.door-hd'); await w(500);
  ok(await p.isVisible('#hd-intro') && /plan at least one assignment/.test(await p.textContent('#hd-intro')), 'the Huddle’s instructions show the first time, and say plan at least one assignment');
  await p.click('.nav-home'); await w(300); await p.click('.door-hd'); await w(500);
  ok(!(await p.isVisible('#hd-intro')) && await p.isVisible('#hd-hero .hero-i'), 'the next time they’re tucked behind the i');
  await p.click('#hd-hero .hero-i'); await w(150);
  ok(await p.isVisible('#hd-intro'), 'tapping the i shows them');
  ok(/This week’s plan/.test(await p.textContent('#band-plan')), 'the plan’s heading is This week’s plan');
  ok(await p.evaluate(() => document.querySelector('#details-summary').classList.contains('is-next')) && await p.locator('.step-row.is-next').count() === 0, 'Up next: Huddle Attendees comes first');
  await p.click('[data-action="open-details"]'); await w(300); await p.click('#attendee-list button >> nth=0'); await w(150); await p.click('[data-action="details-done"]'); await w(500);
  ok(await view() === 'home', 'Attendees’ Done goes back to the Huddle’s list (it never jumps ahead)');
  ok(await p.locator('[data-action="open-step"][data-a="rr"].is-next .row-next').count() === 1 && !(await p.evaluate(() => document.querySelector('#details-summary').classList.contains('is-next'))), 'then Return and Report is Up next');
  // Opportunities to invite: gray until an event has an assignment
  await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  ok(!(await blocked()) && await btn() === 'Mark done', 'Opportunities to invite: Mark done is never gray');
  await p.click('#step-done-btn'); await w(400);
  ok(await p.isVisible('#confirm-sheet') && /Mark done without an assignment\?/.test(await p.textContent('#confirm-title')), 'with an event but no assignment, it asks first');
  await p.click('#confirm-secondary'); await w(300);
  await p.click('#fn-list [data-action="add-asg"]'); await w(400);
  await p.fill('#person-card [data-bind$=".task"]', 'Invite the Ortiz family'); await p.click('#person-view .person-done'); await w(400);
  await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'home' && !(await p.isVisible('#confirm-sheet')), 'with an assignment it’s marked done without asking, and goes back to the list');
  await p.click('[data-action="open-step"][data-a="tn"]'); await w(400);
  ok(!(await p.isVisible('#step-done-btn')) && /Tap each name, then Mark done\./.test(await p.textContent('#step-gate-hint')), 'Focus names has no Mark done of its own: a line says to mark each name done (Nov 20, 2026)');
  await p.click('[data-group="tn"] .person-row:has-text("Marcus Bell")'); await w(400);
  // The focus name's screen: ward council's part is one line with an i
  ok(await p.locator('#person-card .wc-line').count() === 1 && /Next ordinance\s*Endowment/.test((await p.textContent('#person-card .wc-line')).replace(/:/g, '')) && !(await p.$('#person-card .zone-wc-wrap')) && !/Who & What/.test(await p.textContent('#person-card .wc-line')), 'ward council’s part is one line, Next ordinance: Endowment, with no box or label');
  await p.click('#person-card .info-i[data-a="wc-ord"]'); await w(150);
  ok(/Chosen in Ward Council\. To change it, open this name in Ward Council\./.test(await p.textContent('#person-card [data-info="wc-ord"]')), 'its i says it was chosen in Ward Council and where to change it');
  ok((await p.textContent('#person-card')).includes('Assignment') && !(await p.textContent('#person-card')).includes('Action item'), 'it says Assignment, not Action item');
  await p.fill('#person-card [data-bind$=".action"]', 'Sit with him at church'); await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Hill'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-22');
  ok((await p.textContent('#person-view .person-done')).trim() === 'Mark done', 'a focus name’s screen has Mark done');
  await p.click('#person-view .person-done'); await w(400);
  // Finish the other sections (Return and Report waits for each assignment's status), then mark the other focus names
  for (const id of ['rr', 'sa']) { await p.click('.nav-home'); await w(250); await p.click('.door-hd'); await w(400); await p.click(`[data-action="open-step"][data-a="${id}"]`); await w(300);
    if (id === 'rr') { for (const b of await p.$$('[data-action="happened"][data-b="Yes"][aria-pressed="false"]')) { await b.click(); await w(150); } }
    if (!(await blocked())) { await p.click('#step-done-btn'); await w(400); } }
  await p.click('.nav-home'); await w(250); await p.click('.door-hd'); await w(400); await p.click('[data-action="open-step"][data-a="tn"]'); await w(300);
  for (let k = 0; k < 4; k++) { const row = await p.$('#tn-list .person-row:not(:has(.row-ok))'); if (!row) break; await row.click(); await w(400); await p.click('#person-view .person-done'); await w(600); }
  await p.click('.nav-home').catch(() => {}); await w(300); await p.click('.door-hd'); await w(500);
  ok(await view() === 'home' && await p.evaluate(() => ['rr', 'sa', 'fn', 'tn'].every(k => JSON.parse(localStorage.getItem('huddle-agenda-v1')).stepsDone[k])), 'marking the last focus name done finishes the Huddle: all four sections done');
  // After the huddle: tick each changed name
  await p.click('.nav-home'); await w(300); await p.click('#after-box'); await w(500);
  ok(await p.evaluate(() => document.querySelector('#after-done-btn').classList.contains('is-blocked')) && /1 person to update/.test(await p.textContent('#after-done-btn')), 'After the huddle: Mark done waits for the changed name');
  await p.click('#after-list .info-i[data-a="changed"]'); await w(150);
  ok(/since Before Ward Council/.test(await p.textContent('#after-list [data-info="changed"]')), 'the i by Changed says what it means');
  await p.click('#after-done-btn'); await w(300);
  ok(await view() === 'af' && /Update the report first/.test(await p.textContent('#confirm-title')), 'tapping the gray button shows a message saying what’s needed');
  await p.click('#confirm-primary'); await w(300);
  await p.click('[data-action="after-upd"]'); await w(300);
  ok(/Mark done/.test(await p.textContent('#after-done-btn')) && !(await p.evaluate(() => document.querySelector('#after-done-btn').classList.contains('is-blocked'))), 'ticking Updated in the report lets Mark done work');
  await p.click('#after-done-btn'); await w(600);
  ok(await view() === 'start' && /Step 4 done/.test(await p.textContent('#toast')), 'Mark done goes home: Step 4 done');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).afterUpd))['nm|daniel rivera'] === true, 'the tick is saved');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await c.close();

  // A new week: step 1 says Start here; the Opportunities section with no events offers No upcoming events
  const d = await b.newContext({ ...devices['iPhone SE'] });
  await d.addInitScript(([f]) => { try { f.forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__seeded')) { localStorage.setItem('huddle-agenda-v1', JSON.stringify({ ward: 'Sample Ward' })); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, [flags]);
  const q = await d.newPage();
  await q.goto(BASE); await q.waitForTimeout(900); await q.click('[data-action="dismiss-install"]').catch(() => {});
  ok((await q.textContent('.tl-step[data-tl="1"] .up-next')).trim() === 'Start here' && await q.isVisible('.tl-step[data-tl="1"] .up-next'), 'a new week: step 1 says Start here');
  await q.click('.door-hd'); await q.waitForTimeout(400); await q.click('[data-action="open-step"][data-a="fn"]'); await q.waitForTimeout(300);
  ok((await q.textContent('#step-done-btn')).trim() === 'Mark done', 'the Huddle’s Opportunities to invite with no events: Mark done');
  await q.click('#step-done-btn'); await q.waitForTimeout(400);
  ok(/No upcoming events\?/.test(await q.textContent('#confirm-title')), 'it asks: No upcoming events?');
  await q.click('#confirm-primary'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).stepsDone.fn === true), 'it marks the section done');
  await d.close();

  // A focus name whose next ordinance shows as done on their Covenant Path Report: Ward Council chooses the next one
  const g = await b.newContext({ ...devices['iPhone SE'] });
  const st3 = { ward: 'Sample Ward', ask: { done: true }, tnKept: true, cp: { nm: [], rm: [{ name: 'Olivia Chen', checks: { endow: true } }], bt: [] }, tn: [{ name: 'Olivia Chen', ordinance: 'Endowment' }], find: { none: true } };
  await g.addInitScript(([s3, f]) => { try { f.forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__seeded')) { localStorage.setItem('huddle-agenda-v1', s3); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, [JSON.stringify(st3), flags]);
  const u = await g.newPage();
  await u.goto(BASE); await u.waitForTimeout(900); await u.click('[data-action="dismiss-install"]').catch(() => {});
  await u.click('.door-wc'); await u.waitForTimeout(500);
  ok(/Endowment is done/.test(await u.textContent('#wc-step-tn')) && /Choose the next ordinance/.test(await u.textContent('#wc-step-tn')) && !(await u.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done'))), 'a next ordinance done on the report: Ward Council shows it and asks for the next one');
  await u.click('#wc-step-tn .person-row'); await u.waitForTimeout(400);
  ok(/Endowment is done\. Choose the next one\./.test(await u.textContent('#person-card')), 'the focus name’s screen says so too');
  await u.selectOption('#person-card [data-bind$=".ordinance"]', 'Sealing'); await u.click('#person-card .person-done'); await u.waitForTimeout(400);
  ok(await u.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done')), 'choosing the next one finishes the card again');
  await g.close();

  // The first time from the Home Screen: the ward name first, then the welcome
  const e = await b.newContext({ ...devices['iPhone SE'] });
  await e.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); try { localStorage.setItem('huddle-gate-off', '1'); } catch (x) {} Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); });
  const r = await e.newPage();
  await r.goto(BASE); await r.waitForTimeout(2200);
  ok(await r.isVisible('#ward-sheet') && /What’s your ward\?/.test(await r.textContent('#ward-title')) && !(await r.isVisible('#confirm-sheet')), 'the first time from the Home Screen, it asks for the ward first');
  await r.fill('#ward', 'Sample Ward'); await r.click('#ward-sheet [data-action="close-ward"]'); await r.waitForTimeout(700);
  ok(await r.isVisible('#confirm-sheet') && /Welcome to Huddle/.test(await r.textContent('#confirm-title')) && (await r.textContent('#start-ward')).trim() === 'Sample Ward', 'then the welcome offers the guide, with the ward set');
  await e.close();
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
