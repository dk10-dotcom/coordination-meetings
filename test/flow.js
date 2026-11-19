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
  // Opportunities to invite: gray until an event has an assignment
  await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  ok(await blocked() && await btn() === 'Plan at least one assignment', 'Opportunities to invite: Mark done is gray until an event has an assignment');
  await p.click('#step-done-btn'); await w(400);
  ok(await view() === 'p-hd', 'tapping it opens the event');
  await p.click('#person-card [data-action="add-fn"]'); await w(300);
  await p.fill('#person-card [data-bind$=".task"]', 'Invite the Ortiz family'); await p.click('#person-view .person-done'); await w(400);
  ok(!(await blocked()) && await btn() === 'Mark done', 'with an assignment, Mark done works');
  await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'tn', 'Mark done goes straight on to the next section (Focus names)');
  ok(await blocked() && await btn() === 'Marcus Bell needs an assignment', 'Focus names: gray, saying who still needs an assignment');
  await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'p-hd' && (await p.textContent('#step-title')) === 'Marcus Bell', 'tapping it opens that focus name');
  // The focus name's screen: ward council's part is one line with an i
  ok(await p.locator('#person-card .wc-line').count() === 1 && /Next ordinance\s*Endowment/.test((await p.textContent('#person-card .wc-line')).replace(/:/g, '')) && !(await p.$('#person-card .zone-wc-wrap')) && !/Who & What/.test(await p.textContent('#person-card .wc-line')), 'ward council’s part is one line, Next ordinance: Endowment, with no box or label');
  await p.click('#person-card .info-i[data-a="wc-ord"]'); await w(150);
  ok(/Chosen in Ward Council\. To change it, open this name in Ward Council\./.test(await p.textContent('#person-card [data-info="wc-ord"]')), 'its i says it was chosen in Ward Council and where to change it');
  ok((await p.textContent('#person-card')).includes('Assignment') && !(await p.textContent('#person-card')).includes('Action item'), 'it says Assignment, not Action item');
  await p.fill('#person-card [data-bind$=".action"]', 'Sit with him at church'); await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Hill'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-22');
  await p.click('#person-view .person-done'); await w(400);
  ok(!(await blocked()) && await btn() === 'Mark done', 'once every focus name has an assignment, who and when, Mark done works');
  // Finish the other sections, then the last Mark done goes home with what's next
  for (const id of ['rr', 'sa']) { await p.click('.nav-home'); await w(250); await p.click('.door-hd'); await w(400); await p.click(`[data-action="open-step"][data-a="${id}"]`); await w(300); if (!(await blocked())) { await p.click('#step-done-btn'); await w(400); } }
  if (await view() !== 'tn') { await p.click('.nav-home'); await w(250); await p.click('.door-hd'); await w(400); await p.click('[data-action="open-step"][data-a="tn"]'); await w(300); }
  await p.click('#step-done-btn'); await w(800);
  ok(await view() === 'start' && /Step 3 done\. Next: After the huddle\./.test(await p.textContent('#toast')), 'the last section done goes home: Step 3 done. Next: After the huddle.');
  // After the huddle: tick each changed name
  await p.click('#after-box'); await w(500);
  ok(await p.evaluate(() => document.querySelector('#after-done-btn').classList.contains('is-blocked')) && /1 person to update/.test(await p.textContent('#after-done-btn')), 'After the huddle: Mark done waits for the changed name');
  await p.click('#after-list .info-i[data-a="changed"]'); await w(150);
  ok(/since Before Ward Council/.test(await p.textContent('#after-list [data-info="changed"]')), 'the i by Changed says what it means');
  await p.click('#after-done-btn'); await w(300);
  ok(await view() === 'af', 'tapping the gray button stays here (it points to who’s left)');
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
  ok((await q.textContent('#step-done-btn')).trim() === 'No upcoming events', 'the Huddle’s Opportunities to invite with no events: No upcoming events');
  await q.click('#step-done-btn'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).stepsDone.fn === true), 'it marks the section done');
  await d.close();

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
