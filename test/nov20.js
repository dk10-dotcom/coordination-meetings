// The Nov 20, 2026 list: the Huddle's sections as cards (Up next outlined in green) with the focus names right on
// the Focus names card; where a focus name came from; no "Huddle · How & When" on a focus name's screen; one How can we
// help? list on both Focus names cards; suggested names and Mark as not done on Ward Council's Focus names card; the
// bottom bar's Assignments (one page, titled Assignments from there); Send turns green; Doesn't apply on the
// priesthood stops priesthood suggestions; the Tips fit Opportunities to invite; Erase everything starts over as new.
const { chromium, devices } = require('playwright');
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-15' }, o);
const huddle = {
  ward: 'Sample Ward', date: '2026-11-15', conducting: 'wml', attendees: [],
  rr: [{ prefilled: true, pname: 'Grace Thompson', person: 'Grace Thompson', action: 'A consultant visits', assigned: 'Sister Nguyen', when: 'Thu', happened: '' },
    { prefilled: true, pname: 'Olivia Chen', person: 'Olivia Chen', action: 'Sit with her family', assigned: 'Sister Diaz', when: 'Sun', happened: '' }],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: '2026-11-01' }), card({ name: 'Emma Walsh', bap: '2026-10-01', temple: true })],
    rm: [card({ name: 'Olivia Chen', checks: { aaronic: 'na', melch: 'na' } })],
    bt: [card({ name: 'Marcus Hill', bap: '2026-11-28' })]
  },
  cpNone: {}, tn: [card({ name: 'Emma Walsh', ordinance: 'Endowment' }), card({ name: 'Olivia Chen', ordinance: 'Sealing', action: 'Sit with her family\nVisit them as a family', assigned: 'Sister Diaz', when: '2026-11-18' }), card({ touched: '' })],
  find: { items: [], opps: [] }, referrals: [],
  verified: { before: true, after: false }, stepsDone: { tn: true, rr: true }, tnKept: true // saved checked before the rules: they come off
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone SE'] });
  await ctx.addInitScript(() => { try { if (sessionStorage.getItem('t-fresh')) return; ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-swipe-hint-seen'].forEach(k => localStorage.setItem(k, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
  const w = ms => p.waitForTimeout(ms);
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1') || '{}'));
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.goto('http://127.0.0.1:8765/'); await w(500);
  await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), huddle); await p.reload(); await w(900);
  await p.click('[data-action="dismiss-install"]').catch(() => {});

  // ----- The bottom bar: Assignments, with a count -----
  ok(await p.isVisible('.actionbar [data-action="open-assignments"]') && (await p.textContent('#asg-count')).trim() === '2', 'the bottom bar has Assignments, with 2 not marked yet');
  await p.click('.actionbar [data-action="open-assignments"]'); await w(500);
  ok((await p.evaluate(() => document.body.dataset.view)) === 'rr' && (await p.textContent('#step-title')).trim() === 'Assignments', 'Assignments opens Return and Report’s page, titled Assignments');
  ok(!(await p.isVisible('#step-done-btn')) && !(await p.isVisible('#step-foot .undone-link')), 'from Assignments there is no Mark done (marks are kept as they’re tapped)');
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]'); await w(400);
  ok((await p.textContent('#asg-count')).trim() === '1', 'marking one leaves 1 in the count');
  await p.click('.nav-home'); await w(300); await p.click('.door-hd'); await w(400); await p.click('[data-action="open-step"][data-a="rr"]'); await w(400);
  ok(await p.evaluate(() => document.querySelector('#step-done-btn').classList.contains('is-blocked')) && /Mark each assignment Yes, Partly or No first/.test(await p.textContent('#step-gate-hint')), 'Return and Report’s Mark done waits until every assignment is marked');
  await p.click('#step-done-btn'); await w(300);
  ok(await p.isVisible('#confirm-sheet') && /1 assignment from the last huddle isn’t marked yet/.test(await p.textContent('#confirm-body')) && !(await saved()).stepsDone.rr, 'tapping it says what’s left, and doesn’t mark it done');
  await p.click('#confirm-primary'); await w(300);
  await p.click('.actionbar [data-action="open-assignments"]'); await w(400);
  ok(await fits(), 'Assignments fits a small iPhone');

  // ----- The Huddle: each section its own card; Up next outlined in green; Focus names lists its names -----
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(500);
  ok(await p.locator('#steps-home li.hd-card').count() === 4, 'the Huddle’s four sections are cards of their own');
  ok(await p.evaluate(() => document.querySelector('#details-summary').classList.contains('is-next')) && await p.evaluate(() => getComputedStyle(document.querySelector('#details-summary'), '::after').content.includes('Up next')), 'Huddle Attendees is Up next first, with the green badge');
  await p.click('#details-summary'); await w(400);
  ok((await p.evaluate(() => document.body.dataset.view)) === 'att' && (await p.textContent('#step-title')).trim() === 'Huddle Attendees' && !(await p.isVisible('#steps-home')) && await p.isVisible('#attendee-list'), 'Huddle Attendees opens on a page of its own, like the sections');
  await p.goBack(); await w(400);
  ok((await p.evaluate(() => document.body.dataset.view)) === 'home' && await p.isVisible('#steps-home'), 'the phone’s Back returns to the Huddle’s list');
  ok(await p.locator('#steps-home li.hd-card.is-done').count() === 0, 'a huddle saved with Focus names and Return and Report checked loses those checks while a name isn’t marked done and an assignment isn’t marked');
  await p.click('[data-action="open-step"][data-a="rr"]'); await w(400);
  ok((await p.textContent('#step-title')).trim() === 'Return and Report' && await p.isVisible('#step-done-btn'), 'from the Huddle, the same page is titled Return and Report, with Mark done');
  await p.goBack(); await w(400);
  await p.evaluate(() => { document.querySelector('#details-summary') && null; });
  const tnCard = '#steps-home li.hd-card:has([data-action="open-step"][data-a="tn"])';
  const names = await p.$$eval(tnCard + ' .person-name', e => e.map(x => x.textContent));
  ok(names.join('|') === 'Emma Walsh|Olivia Chen', 'the Focus names card lists each focus name: ' + names.join('|'));
  const oc = await p.textContent(tnCard + ' .person-row:has-text("Olivia Chen")'), ew = await p.textContent(tnCard + ' .person-row:has-text("Emma Walsh")');
  ok(/Returning member/.test(oc) && /New member/.test(ew), 'each says which list they came from (New member, Returning member)');
  ok(/Sit with her family, Visit them as a family/.test(oc) && await p.locator(tnCard + ' .person-row:has-text("Olivia Chen") .row-ok').count() === 0, 'a name shows its assignments; no check until it’s marked done');
  ok(/Needs an assignment/.test(ew) && await p.locator(tnCard + ' .person-row:has-text("Emma Walsh") .row-ok').count() === 0, 'an unplanned name says Needs an assignment');
  ok(await p.isVisible(tnCard + ' [data-action="how-help"][data-a="focus"]'), 'the Huddle’s Focus names card has How can we help?');
  await p.click(tnCard + ' [data-action="how-help"]'); await w(400);
  ok((await p.textContent('#howhelp-title')).trim() === 'How can we help?' && await p.locator('#howhelp-list .howhelp-group').count() === 3, 'it opens the one list, with three headers');
  await p.click('#howhelp-sheet [data-action="close-how-help"]'); await w(300);
  // Up next: Huddle Attendees first (no one marked), then the first section not done, outlined in green
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.attendees = ['wml']; localStorage.setItem('__seed', JSON.stringify(s)); });
  await p.reload(); await w(800); await p.click('.door-hd').catch(() => {}); await w(500);
  if (!(await p.isVisible('#steps-home'))) { await p.click('.nav-home'); await w(300); await p.click('.door-hd'); await w(500); }
  const nx = await p.evaluate(() => { const li = document.querySelector('#steps-home li.hd-card.is-next'); return li ? { id: li.querySelector('[data-action="open-step"]').dataset.a, color: getComputedStyle(li).borderTopColor, badge: getComputedStyle(li.querySelector('.row-next')).backgroundColor } : null; });
  ok(nx && nx.id === 'rr' && nx.color === 'rgb(30, 138, 76)' && nx.badge === 'rgb(30, 138, 76)', 'Up next (Return and Report) is outlined in green, with a green badge');
  ok(await fits(), 'the Huddle fits a small iPhone');
  await p.screenshot({ path: 'test/out-nov20-huddle.png', fullPage: true }).catch(() => {});

  // ----- A focus name's screen: where they came from, no Huddle · How & When label -----
  await p.click(tnCard + ' .person-row:has-text("Emma Walsh")'); await w(500);
  ok((await p.textContent('#person-card .person-head-list')).trim() === 'Focus name · New member', 'the screen says Focus name · New member');
  ok(await p.locator('#person-card .zone-label').count() === 0, 'no “Huddle · How & When” label above Assignment');
  // Each focus name is marked done on its own screen; Focus names is done once they all are
  ok((await p.textContent('#person-view .person-done')).trim() === 'Mark done' && await p.evaluate(() => document.querySelector('#person-view .person-done').classList.contains('is-blocked')), 'a focus name’s screen has Mark done, gray until it has an assignment, who and when');
  await p.click('#person-view .person-done'); await w(300);
  ok(await p.isVisible('#confirm-sheet') && /Add an assignment, who and when first/.test(await p.textContent('#confirm-title')) && !(await saved()).tn[0].hdDone, 'tapping it says what to add first, and doesn’t mark it');
  await p.click('#confirm-primary'); await w(300);
  await p.fill('#person-card [data-bind="tn.0.action"]', 'Go with her to the temple grounds'); await p.fill('#person-card [data-bind="tn.0.assigned"]', 'Sister Lee'); await p.fill('#person-card [data-bind="tn.0.when"]', '2026-11-19');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(300);
  ok(!(await p.evaluate(() => document.querySelector('#person-view .person-done').classList.contains('is-blocked'))), 'with all three, Mark done turns blue');
  await p.click('#person-view .person-done'); await w(500);
  ok((await p.evaluate(() => document.body.dataset.view)) === 'home' && await p.locator(tnCard + ' .person-row:has-text("Emma Walsh") .row-ok').count() === 1 && !(await saved()).stepsDone.tn, 'Mark done goes back and checks the name; Focus names waits for the other name');
  await p.click('[data-action="open-step"][data-a="tn"]'); await w(400);
  ok(!(await p.isVisible('#step-done-btn')) && /1 name to go/.test(await p.textContent('#step-gate-hint')), 'the Focus names page has no Mark done of its own: it says 1 name to go');
  await p.click('#tn-list .person-row:has-text("Olivia Chen")'); await w(400);
  await p.click('#person-view .person-done'); await w(500);
  ok((await saved()).stepsDone.tn === true, 'with every name marked done, Focus names is marked done');
  await p.click('#tn-list .person-row:has-text("Olivia Chen")'); await w(400);
  ok((await p.textContent('#person-view .person-done')).trim() === 'Done' && await p.isVisible('#person-view [data-action="tn-name-undone"]'), 'a name marked done shows a green Done and Mark as not done');
  // Clearing who takes the mark off, right there
  await p.fill('#person-card [data-bind="tn.1.assigned"]', ''); await w(400);
  ok(!(await saved()).tn[1].hdDone && !(await saved()).stepsDone.tn && (await p.textContent('#person-view .person-done')).trim() === 'Mark done', 'clearing who takes the mark off the name and off Focus names');
  await p.fill('#person-card [data-bind="tn.1.assigned"]', 'Sister Diaz'); await w(300); await p.click('#person-view .person-done'); await w(500);
  await p.click('#tn-list .person-row:has-text("Olivia Chen")'); await w(400);
  await p.click('#person-view [data-action="tn-name-undone"]'); await w(400);
  ok(!(await saved()).tn[1].hdDone && !(await saved()).stepsDone.tn && (await p.textContent('#person-view .person-done')).trim() === 'Mark done', 'Mark as not done takes the check off the name and off Focus names');
  await p.click('#person-view .person-done'); await w(400); await p.goBack(); await w(400);

  // ----- Ward Council's Focus names card: suggested names to add, How can we help?, Mark as not done -----
  await p.click('.nav-home'); await w(400); await p.click('.door-wc'); await w(500);
  const sugs = await p.$$eval('#wc-step-tn .wc-sugs .person-name', e => e.map(x => x.textContent));
  ok(sugs.includes('Daniel Rivera') && sugs.includes('Marcus Hill') && !sugs.includes('Emma Walsh'), 'with two focus names, the card lists the suggested names: ' + sugs.join('|'));
  ok(await p.isVisible('#wc-step-tn [data-action="how-help"][data-a="focus"]'), 'Ward Council’s Focus names card has How can we help?');
  await p.click('#wc-step-tn .wc-sugs [data-action="pick-focus"] >> nth=0'); await w(500);
  ok((await saved()).tn.map(t => t.name).filter(Boolean).length === 3 && await p.locator('#wc-step-tn .wc-sugs').count() === 0, 'Add makes them a focus name; with three, the suggestions go away');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.tn.forEach(t => { if (t.name && !t.ordinance) t.ordinance = 'Baptisms for the dead'; }); s.tnKept = true; localStorage.setItem('__seed', JSON.stringify(s)); });
  await p.reload(); await w(800); await p.click('.door-wc').catch(() => {}); await w(500);
  if (!(await p.isVisible('#wc-step-tn'))) { await p.click('.nav-home'); await w(300); await p.click('.door-wc'); await w(500); }
  ok(await p.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done')) && await p.isVisible('#wc-step-tn [data-action="tn-undone"]'), 'once kept, the card has its green check and Mark as not done');
  await p.click('#wc-step-tn [data-action="tn-undone"]'); await w(400);
  ok(!(await p.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done'))) && (await saved()).tnKept === false && await p.isVisible('#wc-step-tn .wc-keep'), 'Mark as not done takes the check off, and Keep these focus names comes back');
  ok(await fits(), 'Ward Council fits a small iPhone');

  // ----- Doesn't apply on the priesthood: no priesthood suggestion -----
  await p.click('[data-action="open-wc-list"][data-a="pick"]'); await w(400);
  ok(!/Priesthood/.test(await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); return JSON.stringify(s.tn.map(t => t.ordinance)); })), 'nothing set a priesthood ordinance');
  await p.goBack(); await w(300);
  const sug = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.tn[2] = Object.assign({}, s.tn[2], { name: 'Olivia Chen', ordinance: '' }); s.tn[1].name = 'Grace Thompson'; localStorage.setItem('__seed', JSON.stringify(s)); return true; });
  await p.reload(); await w(800); if (!(await p.isVisible('#wc-step-tn'))) { await p.click('.door-wc').catch(() => {}); await w(500); }
  if (!(await p.isVisible('#wc-step-tn'))) { await p.click('.nav-home'); await w(300); await p.click('.door-wc'); await w(500); }
  await p.click('#wc-step-tn .person-row:has-text("Olivia Chen")'); await w(500);
  const ordSug = await p.evaluate(() => (document.querySelector('#person-card .ord-suggest') || {}).textContent || '');
  ok(!/Priesthood/.test(ordSug), 'with both priesthood steps marked Doesn’t apply, Olivia isn’t suggested Priesthood advancement (' + (ordSug || 'no suggestion') + ')');
  await p.click('#person-view .person-done'); await w(400);

  // ----- Send: green once all four steps are done -----
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.verified = { before: true, after: true }; localStorage.setItem('__seed', JSON.stringify(s)); });
  await p.reload(); await w(900);
  const send = await p.evaluate(() => { const b = document.querySelector('.actionbar [data-action="send"]'); return { ready: b.classList.contains('is-ready'), color: getComputedStyle(b).color }; });
  ok(send.ready && send.color === 'rgb(30, 138, 76)', 'Send is green once After the huddle is done');

  // ----- Tips for opportunities to invite -----
  await p.evaluate(() => document.querySelector('[data-action="find-tips"]').click()); await w(400);
  ok((await p.textContent('#find-tips-title')).trim() === 'Tips for opportunities to invite' && /For each event, plan who will invite and how/.test(await p.textContent('#find-tips-sheet')), 'the Tips are titled for opportunities to invite, and start with planning each event');
  await p.evaluate(() => document.querySelector('[data-action="close-find-tips"]').click()); await w(300);

  // ----- Erase everything starts over as new -----
  await p.evaluate(() => { localStorage.setItem('huddle-theme', 'dark'); sessionStorage.setItem('t-fresh', '1'); });
  await p.evaluate(() => document.querySelector('[data-action="clear"]').click()); await w(400);
  ok(/as if it were new/.test(await p.textContent('#confirm-body')), 'Erase everything says Huddle starts over as if it were new');
  await Promise.all([p.waitForNavigation().catch(() => {}), p.click('#confirm-primary')]); await w(1200);
  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  ok(!keys.includes('huddle-help-seen') && !keys.includes('huddle-tour-seen') && !keys.includes('huddle-ward') && !keys.includes('huddle-names-hint-seen') && keys.includes('huddle-theme'), 'it clears the ward name and the first-time screens, keeping Appearance: ' + keys.join(','));
  const after = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1') || '{}'); return { names: JSON.stringify([s.tn, s.cp]).match(/"name":"[^"]+"/g) || [], ward: s.ward || '', rr: (s.rr || []).length }; });
  ok(!after.names.length && !after.ward && !after.rr && !(await p.evaluate(() => /Sample Ward/.test(document.body.textContent))), 'nothing comes back after the reload: no names, no ward, no assignments');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(`${passed}/${passed + failed} checks passed`); process.exit(failed ? 1 : 0);
})();
