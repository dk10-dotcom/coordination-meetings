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
  // Start from How to use
  await p.click('[data-action="help"]'); await p.waitForTimeout(300); await p.click('#help-sheet [data-action="practice"]'); await p.waitForTimeout(500);
  ok(await p.isVisible('.coach') && (await coach()).startsWith('1 of 10') && /Before ward council/.test(await p.textContent('.coach-t')), 'the practice starts with task 1 of 10');
  ok(await p.evaluate(() => !document.querySelector('#before-box').classList.contains('done')), 'the practice week starts fresh (step 1 not done)');
  ok(await p.evaluate(() => { window.dispatchEvent(new Event('pagehide')); const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); return !JSON.stringify(s.cp).includes('Emma Walsh') && s.practiceSnapshot.cp.nm[0].name === 'Emma Walsh'; }), 'the practice has only sample names; the real ones are set aside');
  await p.screenshot({ path: OUT + '/1-start.png' });
  // 1-2
  await p.click('#before-box'); ok(await waitCoach(2), 'opening Before ward council moves to task 2');
  await p.click('#before-done-btn'); ok(await waitCoach(3), 'marking it done moves to task 3');
  if (!(await p.isVisible('#start-home'))) await home();
  // 3
  await p.click('.door-wc'); await p.waitForTimeout(300); await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.waitForTimeout(300);
  await p.click('[data-wc="tn"] [data-action="open-person"][data-b="1"]'); await p.waitForTimeout(400);
  await p.selectOption('#person-card select[data-bind$=".ordinance"]', 'Priesthood advancement');
  ok(await waitCoach(4), 'choosing Samuel Ortiz’s next ordinance moves to task 4');
  await p.screenshot({ path: OUT + '/2-task4.png' });
  await p.goBack(); await p.waitForTimeout(250); await p.goBack(); await p.waitForTimeout(250); await home();
  // 4
  await p.click('.door-hd'); await p.waitForTimeout(300); await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(400);
  const n = await p.locator('[data-action="happened"][data-b="Yes"]').count();
  for (let i = 0; i < n; i++) await p.click(`[data-action="happened"][data-a="${i}"][data-b="Yes"]`);
  ok(await waitCoach(5), 'marking every assignment moves to task 5');
  await p.goBack(); await p.waitForTimeout(300);
  // 5-6
  await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);
  await p.click('[data-group="nm"] [data-action="open-person"][data-b="0"]'); await p.waitForTimeout(400);
  await p.fill('#person-card [data-bind$=".action"]', 'Go with the youth to the temple'); await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Patel'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-19');
  ok(await waitCoach(6), 'an action item, who and a date move to task 6');
  ok(await fits(), 'the practice card leaves the page inside the screen');
  await p.screenshot({ path: OUT + '/3-task6.png' });
  await p.click('#person-card [data-action="text-assign"]'); ok(await waitCoach(7), 'texting the assignment moves to task 7');
  ok((await p.evaluate(() => window.__sms.join('\n'))).includes('SAMPLE (practice, not a real assignment)'), 'a practice text says SAMPLE');
  await p.click('#person-view .person-done'); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(300); await home();
  // 7
  await p.click('#after-box'); await p.waitForTimeout(300); await p.click('#after-done-btn'); ok(await waitCoach(8), 'After the huddle marked done moves to task 8');
  if (!(await p.isVisible('#start-home'))) await home();
  // 8: a sample PDF
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(400);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForSelector('#share-btn:not([disabled])');
  ok((await p.textContent('#send-title')) === 'Send a sample agenda' && /SAMPLE/.test(await p.textContent('#send-filename')) && /Send it to yourself/.test(await p.textContent('#send-recipients')), 'Send offers a sample to send to yourself');
  await p.screenshot({ path: OUT + '/4-send.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  await dl.saveAs(OUT + '/sample.pdf');
  const text = execFileSync('pdftotext', ['-raw', OUT + '/sample.pdf', '-']).toString();
  const info = execFileSync('pdfinfo', [OUT + '/sample.pdf']).toString();
  ok((text.match(/SAMPLE · practice names, not a real huddle/g) || []).length >= 2 && /Daniel Rivera/.test(text), 'every page of the PDF says SAMPLE');
  ok(!(await p.evaluate(async () => { const b = await (await fetch(location.href)).text(); return false; })) && !/HuddleData/.test(fs.readFileSync(OUT + '/sample.pdf', 'latin1')), 'the sample carries no huddle data to load');
  await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await p.textContent('#confirm-title')) === 'Sample sent', 'it says Sample sent');
  await p.click('#confirm-primary'); ok(await waitCoach(9), 'sending the sample moves to task 9');
  ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('huddle-agenda-v1')).loaded.practice) && (await p.locator('.actionbar [data-action="send"]').count()) === 1, 'the practice week is still there after the sample');
  ok(!(await p.isVisible('#sent-line')), 'nothing was marked as sent');
  // 9: a practice handoff
  await p.click('.actionbar [data-action="handoff"]'); await p.waitForTimeout(600);
  ok(/Practice/.test(await p.textContent('#handoff-send-sub')), 'Hand off offers a practice handoff');
  await p.click('#handoff-send'); ok(await waitCoach(10), 'sending a practice handoff moves to the last task');
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
