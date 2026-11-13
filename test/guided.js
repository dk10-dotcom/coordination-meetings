// Guided practice: Try a practice week sets the real huddle aside, gives one task at a time in a card at the
// bottom, and moves on once each is done. Send makes a sample PDF stamped SAMPLE that changes nothing, and a
// practice handoff loads as a practice week on the other phone. Finishing brings the real huddle back.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = __dirname + '/out-guided'; fs.mkdirSync(OUT, { recursive: true });
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-14' }, o);
const real = { ward: 'Sample Ward', date: '2026-11-15', conducting: 'wml', attendees: ['wml'], rr: [], cpNone: {},
  cp: { nm: [card({ name: 'Emma Walsh', ordinance: 'Endowment' })], rm: [card({})], bt: [card({})] }, tn: [card({}), card({}), card({})],
  find: { plan: '', items: [{ task: '', when: '' }] }, referrals: [], verified: { before: true, after: false } };
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone SE'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } window.__sms = []; } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('request', r => { if (/^sms:/.test(r.url())) p.evaluate(u => window.__sms.push(u), decodeURIComponent(r.url())).catch(() => {}); });
  await p.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])');
  await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), real); await p.reload(); await p.waitForSelector('#start-home:not([hidden])');
  const coach = () => p.textContent('.coach .coach-n').catch(() => '');
  const waitCoach = async n => { for (let k = 0; k < 30; k++) { if ((await coach()).startsWith(n + ' of')) return true; await p.waitForTimeout(150); } return false; };
  const home = async () => { await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(350); };
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const homeBtn = async () => { await p.click('.nav-home'); await p.waitForTimeout(350); };
  const ringed = () => p.evaluate(() => { const e = document.querySelector('.coach-target'); return e ? (e.id || e.className) : ''; });
  // Start from How to use
  await p.click('[data-action="help"]'); await p.waitForTimeout(300); await p.click('#help-sheet [data-action="tour"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('.coach') && /sample names/.test(await p.textContent('.coach-t')) && await p.isVisible('.coach-start'), 'Take the guided tour opens with a welcome card and Start');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.coach')).backgroundColor) === 'rgb(17, 17, 17)', 'the tour card is black');
  ok(await p.evaluate(() => !document.querySelector('#before-box').classList.contains('done')), 'the practice week starts fresh (step 1 not done)');
  ok(await p.evaluate(() => { window.dispatchEvent(new Event('pagehide')); const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); return !JSON.stringify(s.cp).includes('Emma Walsh') && s.practiceSnapshot.cp.nm[0].name === 'Emma Walsh'; }), 'the practice has only sample names; the real ones are set aside');
  await p.screenshot({ path: OUT + '/1-start.png' });
  await p.click('.coach-start'); ok(await waitCoach(1) && await p.waitForTimeout(600).then(() => true) && /before-box/.test(await ringed()), 'Start: task 1 rings Step 1');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.nav-home')).visibility === 'hidden'), 'no Home button on the opening screen itself');
  const barOK = await p.evaluate(() => { const a = document.querySelector('.actionbar').getBoundingClientRect(), c = document.querySelector('.coach').getBoundingClientRect(); return a.bottom <= c.top + 1; });
  ok(barOK, 'Hand off and Send sit above the tour card, not under it');
  await p.click('#before-box'); ok(await waitCoach(2), 'opening Before ward council moves to task 2');
  await p.click('#before-done-btn'); ok(await waitCoach(3), 'marking it done moves to task 3');
  if (!(await p.isVisible('#start-home'))) await home();
  await p.click('.door-wc'); ok(await waitCoach(4), 'opening Ward council moves to task 4');
  ok(/Never add confidential information/.test(await p.textContent('.coach-t')), 'the Ward council card has the confidential warning');
  await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.waitForTimeout(300);
  await p.click('[data-wc="tn"] [data-action="open-person"][data-b="1"]'); await p.waitForTimeout(400);
  await p.selectOption('#person-card select[data-bind$=".ordinance"]', 'Priesthood advancement');
  ok(await waitCoach(5), 'choosing Samuel Ortiz’s next ordinance moves to task 5');
  await p.waitForTimeout(600); ok(await p.isVisible('.nav-home') && /nav-home/.test(await ringed()), 'Home is in the bottom bar of a person’s screen, and ringed');
  await p.click('.nav-home'); await p.waitForTimeout(400);
  ok(await p.isVisible('#start-home') && await p.evaluate(() => document.querySelector('[data-tl="2"]').classList.contains('tl-done')), 'Home goes straight to the opening screen, and Step 2 has its check');
  await p.click('.door-hd'); ok(await waitCoach(6), 'opening the Huddle moves to task 6 (attendees)');
  await p.click('#details-summary'); await p.waitForTimeout(300);
  await p.click('#attendee-list [data-a="pqa"]'); await p.click('#attendee-list [data-a="gol"]'); ok(await waitCoach(7), 'marking both youth moves to task 7');
  await p.click('#details-full [data-action="close-details"]'); await p.waitForTimeout(300);
  await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(400);
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]'); await p.click('[data-action="happened"][data-a="1"][data-b="Partly"]'); await p.click('[data-action="happened"][data-a="2"][data-b="No"]');
  ok(await waitCoach(8), 'one Yes, one Partly and one No move to task 8');
  await p.click('.btn-carry >> nth=0'); ok(await waitCoach(9), 'carrying one forward moves to task 9');
  await p.screenshot({ path: OUT + '/2-carry.png' });
  await p.click('[data-action="step-done"]'); ok(await waitCoach(10), 'Mark section done moves to task 10');
  await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);
  await p.click('[data-group="nm"] [data-action="open-person"][data-b="0"]'); await p.waitForTimeout(400);
  await p.fill('#person-card [data-bind$=".action"]', 'Go with the youth to the temple'); await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Patel'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-19');
  ok(await waitCoach(11), 'an action item, who and a date move to task 11');
  ok(await fits(), 'the tour card leaves the page inside the screen');
  await p.screenshot({ path: OUT + '/3-text.png' });
  await p.click('#person-card [data-action="text-assign"]'); ok(await waitCoach(12), 'texting the assignment moves to task 12');
  ok((await p.evaluate(() => window.__sms.join('\n'))).includes('SAMPLE (practice, not a real assignment)'), 'a practice text says SAMPLE');
  await p.click('#person-view .person-done'); await p.waitForTimeout(400); await p.click('[data-action="step-done"]'); ok(await waitCoach(13), 'Covenant Path Report marked done moves to task 13');
  for (const id of ['tn', 'fn', 'mr']) { await p.click(`[data-action="open-step"][data-a="${id}"]`); await p.waitForTimeout(300); await p.click('[data-action="step-done"]'); await p.waitForTimeout(400); }
  ok(await waitCoach(14), 'all five sections done moves to task 14');
  await homeBtn(); ok(await p.evaluate(() => document.querySelector('[data-tl="3"]').classList.contains('tl-done')), 'Step 3 has its green check');
  await p.click('#after-box'); ok(await waitCoach(15), 'opening After the huddle moves to task 15');
  await p.click('#after-done-btn'); ok(await waitCoach(16), 'After the huddle marked done moves to task 16 (Send)');
  if (!(await p.isVisible('#start-home'))) await home();
  // 8: a sample PDF
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(400);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForSelector('#share-btn:not([disabled])');
  ok((await p.textContent('#send-title')) === 'Send a sample huddle report' && /SAMPLE/.test(await p.textContent('#send-filename')) && /Send it to yourself/.test(await p.textContent('#send-recipients')), 'Send offers a sample to send to yourself');
  await p.screenshot({ path: OUT + '/4-send.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  await dl.saveAs(OUT + '/sample.pdf');
  const text = execFileSync('pdftotext', ['-raw', OUT + '/sample.pdf', '-']).toString();
  const info = execFileSync('pdfinfo', [OUT + '/sample.pdf']).toString();
  ok((text.match(/SAMPLE · practice names, not a real huddle/g) || []).length >= 2 && /Daniel Rivera/.test(text), 'every page of the PDF says SAMPLE');
  ok(!(await p.evaluate(async () => { const b = await (await fetch(location.href)).text(); return false; })) && !/HuddleData/.test(fs.readFileSync(OUT + '/sample.pdf', 'latin1')), 'the sample carries no huddle data to load');
  await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await p.textContent('#confirm-title')) === 'Sample sent', 'it says Sample sent');
  await p.click('#confirm-primary'); ok(await waitCoach(17), 'sending the sample moves to task 17 (Hand off)');
  ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('huddle-agenda-v1')).loaded.practice) && (await p.locator('.actionbar [data-action="send"]').count()) === 1, 'the practice week is still there after the sample');
  ok(!(await p.isVisible('#sent-line')), 'nothing was marked as sent');
  // 9: a practice handoff
  await p.click('.actionbar [data-action="handoff"]'); await p.waitForTimeout(600);
  ok(/Practice/.test(await p.textContent('#handoff-send-sub')), 'Hand off offers a practice handoff');
  await p.click('#handoff-send'); ok(await waitCoach(18), 'sending a practice handoff moves to the last card');
  const msg = await p.evaluate(() => window.__sms.join('\n'));
  const link = (msg.match(/https?:\/\/\S+#handoff=\S+/) || [])[0];
  ok(/Practice handoff/.test(msg) && !!link, 'the handoff text says Practice handoff and has a link');
  await p.screenshot({ path: OUT + '/5-last.png' });
  // The other phone: a real huddle on it is set aside while the practice handoff loads
  const c2 = await b.newContext({ ...devices['iPhone 13'] });
  await c2.addInitScript(s => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); if (!localStorage.getItem('__d')) { localStorage.setItem('huddle-agenda-v1', s); localStorage.setItem('__d', '1'); } } catch (e) {} }, JSON.stringify(Object.assign({}, real, { ward: 'Sample Ward 2' })));
  const q = await c2.newPage(); await q.goto(link); await q.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await q.textContent('#confirm-title')) === 'Try this practice handoff?', 'the other phone asks to try the practice handoff');
  await q.click('#confirm-primary'); await q.waitForTimeout(500);
  await q.evaluate(() => window.dispatchEvent(new Event('pagehide'))); const st = await q.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
  ok(st.loaded && st.loaded.practice && st.practiceSnapshot && st.practiceSnapshot.ward === 'Sample Ward 2' && st.cp.nm[0].name === 'Daniel Rivera', 'it loads as a practice week, with that phone’s own huddle set aside');
  await q.click('#loaded-banner [data-action="unload"]'); await q.waitForTimeout(300); await q.click('#confirm-primary'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); return !s.loaded && s.ward === 'Sample Ward 2' && s.cp.nm[0].name === 'Emma Walsh'; }), 'removing it brings that phone’s own huddle back');
  await c2.close();
  // 10: Finish
  await p.click('.coach [data-action="coach-finish"]'); await p.waitForTimeout(500);
  const back = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
  ok(!back.loaded && back.cp.nm[0].name === 'Emma Walsh' && back.verified.before === true && await p.isHidden('.coach'), 'Finish removes the practice and the real huddle comes back as it was');
  ok(errs.length === 0, 'no errors ' + errs.join('; '));
  await b.close(); console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
