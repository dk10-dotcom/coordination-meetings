// The test copy (try/): focus names filter the huddle, and it keeps its own storage.
// - New members not yet at the temple, and those being taught with a baptism in 30 days or an appointment in a week, are suggested
// - Make focus name in ward council (past three when needed); swipe a focus name left to remove it
// - The Huddle: Return and Report and Sacrament attendance, then the Huddle action plan (Focus names, Find New People to Teach)
// - No Covenant Path Report section in the Huddle and no Missionary Referrals anywhere
// - Upcoming opportunities are cards from ward council with assignments under them; they stay until their date passes
// Run with the server on 8765 like the other tests.
const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const OUT = 'test/out-try'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/try/';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: shift(-1) }, o);
const rr = o => Object.assign({ prefilled: true, source: '', group: '', pname: '', person: '', action: '', assigned: '', when: '', happened: '', notes: '', hneed: '' }, o);
const seed = {
  ward: 'Sample Ward', date: iso(new Date()), conducting: 'wml', attendees: ['wml'], rolledFrom: shift(-7),
  rr: [rr({ group: 'nm', source: 'New members', pname: 'Daniel Rivera', action: 'Set up his interview', assigned: 'Bro. Patel', when: 'Sun' })],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: shift(-60), temple: true, ordinance: 'Priesthood advancement' }), card({ name: 'Emma Walsh', ordinance: 'Baptisms for the dead', need: 'A ride to the temple' })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church' })],
    bt: [card({ name: 'Marcus Hill', bap: shift(20), committed: true, need: 'Get to know ward members' }), card({ name: 'Samuel Ortiz', appt: shift(3) }), card({ name: 'Marcus Bell', bap: shift(45), appt: shift(10) })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }] }, referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: '' }],
  verified: { before: true, after: true }, stepsDone: {}
};
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone SE'], acceptDownloads: true });
  await c.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); ['huddletest-tour-seen', 'huddletest-help-seen', 'huddletest-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddletest-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = t => p.waitForTimeout(t);
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('huddletest-agenda-v1') || '{}'));
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.goto(BASE); await w(500);
  // A real huddle saved by the live app on the same website is never touched.
  await p.evaluate(s => { localStorage.setItem('huddle-agenda-v1', '{"live":true}'); localStorage.setItem('__seed', JSON.stringify(s)); }, seed);
  await p.reload(); await w(700);
  ok(/Test version/.test(await p.textContent('.title-text')), 'the opening screen says Test version');

  // Before ward council: pressing names are suggested (not returning members, not a new member who has been to the temple)
  await p.click('#before-box'); await w(500);
  const bw = await p.$$eval('#before-list .person-row', els => els.map(e => e.querySelector('.person-name').textContent + (/Suggested focus name/.test(e.textContent) ? '*' : '')));
  ok(bw.filter(x => x.endsWith('*')).sort().join('|') === 'Emma Walsh*|Marcus Hill*|Samuel Ortiz*', 'suggested: Emma (not yet to the temple, no baptism date), Marcus Hill (baptism in 20 days), Samuel (appointment in 3 days); not Marcus Bell (baptism in 45 days, appointment in 10): ' + bw.join(', '));
  await p.click('.nav-home'); await w(400);

  // Ward council: the report button, then make them focus names (past three)
  await p.click('.door-wc'); await w(400);
  ok(!(await p.isVisible('[data-action="open-wc-list"][data-a="mr"]')), 'Ward council has no Missionary Referrals');
  await p.click('[data-action="open-wc-list"][data-a="cp"]'); await w(400);
  ok(await p.isVisible('#wc-list .wc-report-link') && /Open the Covenant Path Report/.test(await p.textContent('#wc-list .wc-report-link')), 'Ward council’s Covenant Path Report list has Open the Covenant Path Report');
  for (const [g, i] of [['bt', 0], ['nm', 1], ['bt', 1]]) {
    await p.click(`#wc-list [data-wc="${g}"] [data-b="${i}"]`); await w(500);
    if (g === 'nm') { ok(/Not yet to the temple/.test(await p.textContent('#person-card .focus-why')), 'a new member with no baptism date says Not yet to the temple'); await p.screenshot({ path: OUT + '/wc-pressing.png' }); }
    await p.click('#person-card [data-action="make-focus"]'); await w(400);
    ok(await p.isVisible('#person-card .focus-on'), 'Make focus name: the screen now says it is a focus name');
    await p.click('#person-view .person-done'); await w(400);
  }
  let st = await saved();
  ok(st.tn.map(t => t.name).filter(Boolean).join('|') === 'Grace Thompson|Marcus Hill|Emma Walsh|Samuel Ortiz', 'focus names fill the open spots, then go past three: ' + st.tn.map(t => t.name).join('|'));
  ok(await p.evaluate(() => localStorage.getItem('huddle-agenda-v1')) === '{"live":true}', 'the live app’s saved huddle is untouched');

  // Swipe a focus name left to remove it; Undo brings it back; they stay on the Covenant Path Report
  await p.click('.step-back'); await w(400); // the focus names sit right on Ward Council
  const swiped = await p.evaluate(async () => {
    const row = [...document.querySelectorAll('#wc-rows .swipe-li .person-row')].find(r => /Samuel Ortiz/.test(r.textContent));
    const r = row.getBoundingClientRect(), y = r.top + r.height / 2;
    const t = x => new Touch({ identifier: 1, target: row, clientX: x, clientY: y });
    row.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(r.right - 20)], changedTouches: [t(r.right - 20)] }));
    row.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(r.right - 120)], changedTouches: [t(r.right - 120)] }));
    row.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(r.right - 120)] }));
    await new Promise(res => setTimeout(res, 300));
    return row.parentNode.classList.contains('is-open');
  });
  ok(swiped, 'swiping a focus name left shows Remove');
  await p.screenshot({ path: OUT + '/wc-swipe.png' });
  await p.tap('#wc-rows .swipe-li.is-open .swipe-del'); await w(400); // a real tap: touches first, then the click
  ok(await p.isVisible('#confirm-sheet') && /Remove Samuel Ortiz from Focus names\?/.test(await p.textContent('#confirm-title')) && !(await p.isVisible('#person-view')), 'tapping Remove asks first, and does not open the name');
  await p.click('#confirm-primary'); await w(400);
  st = await saved();
  ok(!st.tn.some(t => t.name === 'Samuel Ortiz') && st.cp.bt.some(a => a.name === 'Samuel Ortiz'), 'Remove takes Samuel off Focus names; he stays on the Covenant Path Report');
  await p.click('#toast .toast-action'); await w(300);
  ok((await saved()).tn.some(t => t.name === 'Samuel Ortiz'), 'Undo brings him back');
  // Removing a name in the middle leaves no blank spot behind
  await p.evaluate(() => [...document.querySelectorAll('#wc-rows .swipe-li')].find(li => /Marcus Hill/.test(li.textContent)).querySelector('.swipe-del').click()); await w(300);
  await p.click('#confirm-primary'); await w(400);
  const rowsNow = await p.$$eval('#wc-rows [data-wc="tn"] .person-name', els => els.map(e => e.textContent));
  ok(rowsNow.join('|') === 'Grace Thompson|Emma Walsh|Samuel Ortiz', 'after removing Marcus Hill the names close up, with no blank spot: ' + rowsNow.join('|'));
  await p.click('#toast .toast-action'); await w(300);
  ok((await saved()).tn.map(t => t.name).join('|') === 'Grace Thompson|Marcus Hill|Emma Walsh|Samuel Ortiz', 'Undo puts Marcus Hill back in his place');

  // Ward council: Opportunities to invite. With none yet it says so, with starter ideas; a tip of the week sits on top.
  // (already on Ward Council: the focus names sit right on its screen)
  ok(/Opportunities to invite/.test(await p.textContent('#wc-rows')), 'Ward council’s row is called Opportunities to invite');
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400);
  ok(/Ward council hasn’t listed any events yet/.test(await p.textContent('#fn-list')) && await p.locator('#fn-list [data-action="opp-starter"]').count() >= 5, 'no opportunities yet: it says so, with starter ideas');
  ok(!(await p.$('#tip-week')) && !(await p.$('[data-step="fn"] .how-help-fn')) && await p.isVisible('[data-step="fn"] [data-action="find-tips"]'), 'no tip of the week and no How can we help?; Tips at the top');
  const starters = await p.$$eval('#fn-list [data-action="opp-starter"]', els => els.map(e => e.dataset.b));
  ok(['Special sacrament meeting', 'Christmas sacrament meeting', 'Easter sacrament meeting', 'Member speaking in sacrament meeting', 'Stake conference', 'Ward conference', 'Youth activity'].every(t => starters.includes(t)), 'starter ideas include Christmas, Easter, a member speaking, Stake and Ward conference, Youth activity');
  ok(!(await p.$('#fn-list .source-line')), 'no source line on the opportunity cards');
  ok(!(await p.$('#fn-list details.other-ways')) && !/Other ways to invite/.test(await p.textContent('#fn-list')), 'no Other ways to invite');
  await p.click('#fn-list [data-action="opp-starter"][data-b="Ward activity"]'); await w(400);
  await p.click('#person-card [data-action="add-fn"]'); await w(300);
  await p.fill('#person-card [data-bind$=".task"]', 'Each family invites one friend'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(200);
  ok((await saved()).find.opps.map(o => o.title).join('|') === 'Ward activity' && await p.isVisible('#person-view') && (await p.textContent('#step-title')).trim() === 'Ward activity', 'tapping a starter idea adds that opportunity and opens it on its own screen');
  await p.click('#person-card [data-action="remove-opp"]'); await w(300); if (await p.isVisible('#confirm-sheet')) { await p.click('#confirm-primary'); await w(400); }
  ok(!(await saved()).find.opps.length && !(await saved()).find.items.some(x => /Each family/.test(x.task)) && !(await p.isVisible('#person-view')) && await p.isVisible('#fn-list'), 'Remove this opportunity takes it and its assignments off, and returns to the list');
  await p.click('[data-action="add-opp"]'); await w(400);
  ok(await p.isVisible('#person-view') && await p.evaluate(() => /\.title$/.test(document.activeElement.dataset.bind || '')), 'Add an opportunity opens a new one, ready to type its name');
  await p.fill('#person-card [data-bind="find.opps.0.title"]', 'Christmas sacrament meeting');
  await p.fill('#person-card [data-bind="find.opps.0.date"]', shift(30)); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(200);
  await p.click('#person-view .person-done'); await w(400);
  const oppRow = await p.textContent('#fn-list [data-action="open-person"][data-a="opp"]');
  ok(/Christmas sacrament meeting/.test(oppRow) && !/assignment/.test(oppRow) && !(await p.$('#fn-list [data-a="opp"] .warn')) && await p.locator('#fn-list .opp-tile-d').count() === 1, 'Done returns to the list: a row like a name, with a date tile, its name and date, and no warning in ward council: ' + oppRow.trim());
  ok(await p.locator('#fn-list .swipe-li [data-action="swipe-remove-opp"]').count() === 1, 'an opportunity can be swiped left to remove it');
  ok(await p.isHidden('#step-next') && await p.isHidden('#step-prev') && (await p.textContent('#step-done-btn')).trim() === 'Done', 'ward council’s Opportunities to invite has just Done at the bottom (no Next or Back links)');
  await p.click('.step-back'); await w(400);
  ok(!/needs? an assignment/.test(await p.textContent('#wc-rows')) && /Christmas sacrament meeting \(/.test(await p.textContent('#wc-rows')), 'ward council’s row lists the opportunity and its date, no warning');
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400);
  ok(wide ? await wide() : true, 'Find New People to Teach fits a small iPhone');

  // Huddle: no heading over Return and Report and Sacrament attendance; the Huddle action plan is two sections
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(500);
  const last = await p.$$eval('#steps-last [data-action="open-step"]', els => els.map(e => e.getAttribute('data-a')));
  const plan = await p.$$eval('#steps-this [data-action="open-step"]', els => els.map(e => e.getAttribute('data-a')));
  ok(last.join(',') === 'rr,sa' && plan.join(',') === 'fn,tn', 'the Huddle: rr,sa then fn,tn: ' + last + ' / ' + plan);
  ok(/Christmas sacrament meeting · 1 needs an assignment/.test(await p.textContent('#steps-this')), 'the Huddle row names the opportunity and what still needs an assignment');
  ok(!(await p.isVisible('#band-rr')) && (await p.textContent('#band-plan')).trim() === 'This week’s plan', 'no “From the last huddle” heading; “This week’s plan” over the plan');
  await p.screenshot({ path: OUT + '/huddle.png' });

  // Sacrament attendance: one tap per name, and a focus name is marked once
  await p.click('[data-action="open-step"][data-a="sa"]'); await w(400);
  const saNames = await p.$$eval('#sa-list .person-name', els => els.map(e => e.textContent));
  ok(saNames.join('|') === 'Daniel Rivera|Emma Walsh|Olivia Chen|Marcus Hill|Samuel Ortiz|Marcus Bell|Grace Thompson', 'everyone once: ' + saNames.join('|'));
  await p.click('#sa-list [data-a="bt"][data-b="0"]'); await w(300);
  st = await saved();
  ok(st.cp.bt[0].sac && st.tn.find(t => t.name === 'Marcus Hill').sac, 'tapping Marcus Hill marks him on the report and on his focus name card');
  await p.screenshot({ path: OUT + '/sacrament.png' });
  ok(await wide(), 'Sacrament attendance fits a small iPhone');

  // Find New People to Teach in the Huddle: an assignment under the opportunity
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(400);
  await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  const opp = (await saved()).find.opps[0];
  await p.reload(); await w(1500); if (!(await p.isVisible('[data-action="open-step"][data-a="fn"]'))) { await p.click('.door-hd'); await w(400); }
  await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  await p.click('#fn-list [data-a="opp"]'); await w(400);
  await p.click('#person-card [data-action="add-fn"]'); await w(300);
  const ti = (await saved()).find.items.length - 1;
  ok(await p.isVisible(`#person-card [data-bind="find.items.${ti}.task"]`) && await p.isVisible(`#person-card [data-bind="find.items.${ti}.who"]`) && /Assigned to/.test(await p.textContent('#person-card .fn-assign')), 'an assignment has Assignment and Assigned to');
  await p.fill(`[data-bind="find.items.${ti}.task"]`, 'Each family invites one friend'); await p.fill(`[data-bind="find.items.${ti}.who"]`, 'Elders quorum'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(300);
  st = await saved();
  ok(st.find.items[ti].opp === opp.id && st.find.items[ti].task === 'Each family invites one friend' && st.find.items[ti].who === 'Elders quorum', 'the assignment sits under the opportunity, with who');
  ok(!(await p.locator('#person-card .fn-assign').first().locator('.invite-ideas').isVisible().catch(() => false)), 'a filled assignment shows no ways to invite');
  await p.click('#person-card [data-action="add-fn"]'); await w(300);
  const ideas = await p.$$eval('#person-card [data-action="invite-idea"]', els => els.map(e => e.dataset.b));
  ok(ideas.length === 3 && !ideas.some(t => /Speakers/.test(t)), 'an empty assignment shows the ways to invite (no speakers idea): ' + ideas.join('|'));
  await p.click('#person-card [data-action="invite-idea"][data-b="Members go on a visit with the missionaries"]'); await w(300);
  ok(await p.evaluate(() => /find\.items\.\d+\.who/.test(document.activeElement.dataset.bind || '')), 'the cursor goes to Assigned to');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(300);
  st = await saved();
  ok(st.find.items.filter(x => x.opp === opp.id).length === 2 && st.find.items.some(x => x.opp === opp.id && x.task === 'Members go on a visit with the missionaries'), 'tapping a way to invite fills that assignment');
  await p.screenshot({ path: OUT + '/opportunity.png', fullPage: true });
  await p.click('#person-view .person-done'); await w(400);
  ok(/2 assignments/.test(await p.textContent('#fn-list [data-a="opp"]')), 'its row now says 2 assignments');

  // Return and Report: Daniel's partly-done assignment comes back as a focus name
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(400);
  await p.click('[data-action="open-step"][data-a="rr"]'); await w(400);
  await p.click('#rr-list [data-b="Partly"]'); await w(300);
  await p.click('#rr-list [data-action="carry-fwd"]'); await w(400);
  ok((await saved()).tn.some(t => t.name === 'Daniel Rivera' && t.action === 'Set up his interview'), 'carry forward makes Daniel Rivera a focus name with his action item');

  // The PDF: focus names and the opportunity, no referrals
  await p.click('.actionbar [data-action="send"]'); await w(400);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const f = OUT + '/try.pdf'; await dl.saveAs(f);
  const t = execSync(`pdftotext -layout "${f}" -`).toString();
  ok(t.indexOf('Focus names') > 0 && /Christmas sacrament meeting/.test(t) && /Each family invites one friend/.test(t), 'PDF: focus names, the opportunity and its assignment');
  const glance = t.slice(t.indexOf('COMING UP'), t.indexOf('Return and Report'));
  ok(t.indexOf('COMING UP') > 0 && !/AT A GLANCE/.test(t) && /Christmas sacrament meeting/.test(glance), 'PDF: no At a glance; Coming up at the top lists the upcoming opportunity');
  ok(!/Missionary Referrals|Referred by/.test(t), 'PDF: no Missionary Referrals');
  // The next huddle: the assignment comes back in Return and Report, and the opportunity stays until its date
  await p.click('#confirm-primary').catch(() => {}); await w(500);
  st = await saved();
  ok(st.rr.some(r => /Each family invites one friend \(Christmas sacrament meeting\)/.test(r.action) && r.assigned === 'Elders quorum'), 'next huddle: the assignment is in Return and Report with its opportunity and who');
  ok(st.find.opps.length === 1 && st.find.opps[0].title === 'Christmas sacrament meeting', 'next huddle: the opportunity card is still there (its date hasn’t passed)');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(`\n${passed}/${passed + failed} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
