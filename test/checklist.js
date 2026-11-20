// The Covenant Path Report checklist: Before ward council mirrors the report, ward council picks What will help
// from what's still open, the Huddle has no sacrament box on a focus name, After the huddle lists only what changed,
// and the PDF prints Done this week under a focus name. Run with the server on 8765 like the other tests.
// BASE can point at the test copy: BASE=http://127.0.0.1:8765/try/ KEY=huddletest node test/checklist.js
const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const OUT = 'test/out-checklist'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const KEY = process.env.KEY || 'huddle';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: shift(-1) }, o);
const seed = {
  ward: 'Sample Ward', date: iso(new Date()), conducting: 'wml', attendees: ['wml'],
  rr: [{ plan: '', happened: '', notes: '' }],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: shift(-9) })],
    rm: [card({ name: 'Olivia Chen', checks: { friends: true, aaronic: 'na' } })],
    bt: [card({ name: 'Marcus Hill', bap: shift(20), committed: true })]
  },
  cpNone: {}, tn: [card({ name: 'Olivia Chen' }), card({ name: 'Grace Thompson' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }], opps: [{ id: 'o1', title: 'Christmas sacrament meeting', date: shift(30) }] }, referrals: [],
  verified: { before: false, after: false }, stepsDone: {}
};
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone SE'], acceptDownloads: true });
  await c.addInitScript(k => { try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); [k + '-tour-seen', k + '-help-seen', k + '-names-hint-seen'].forEach(x => localStorage.setItem(x, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem(k + '-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} }, KEY);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = t => p.waitForTimeout(t);
  const saved = () => p.evaluate(k => JSON.parse(localStorage.getItem(k + '-agenda-v1') || '{}'), KEY);
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.goto(BASE); await w(500);
  await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed);
  await p.reload(); await w(1500);

  // Before ward council: Olivia's checklist, with Doesn't apply on the "if applicable" items
  await p.click('#before-box'); await w(500);
  ok((await p.textContent('#before-list [data-bw="rm"] .person-row')).includes('1 of 11 done'), 'a row counts what’s done, leaving out what doesn’t apply');
  if (!(await p.isVisible('#before-list [data-bw="rm"] .exp-edit'))) { await p.click('#before-list [data-bw="rm"] [data-action="row-toggle"]'); await w(300); } await p.click('#before-list [data-bw="rm"] .exp-edit'); await w(400); // opens in place; Edit details opens the screen
  ok(await p.locator('#person-card .ck-li.is-na').count() === 1 && await p.locator('#person-card .ck-na').count() === 3, 'Aaronic Priesthood is marked Doesn’t apply; three items offer it');
  await p.click('[data-action="check-na"][data-b="sealspouse"]'); await w(200);
  await p.click('[data-action="check-item"][data-b="calling"]'); await w(200);
  ok((await p.textContent('#person-card .ck-count')).trim() === '2 of 10 done' && await wide(), 'Doesn’t apply takes an item out of the count; a check counts as done');
  await w(800); let st = await saved();
  ok(st.cp.rm[0].checks.sealspouse === 'na' && st.cp.rm[0].checks.calling === true && st.cp.rm[0].checks.friends === true, 'the checklist is saved with the person');
  await p.click('[data-action="check-na"][data-b="sealspouse"]'); await w(800);
  ok(!(await saved()).cp.rm[0].checks.sealspouse, 'tapping Doesn’t apply again puts it back as still open');
  await p.screenshot({ path: OUT + '/before-rm.png', fullPage: true });
  await p.click('#person-view .person-done'); await w(300);
  await p.click('#before-done-btn'); await w(500); // step 1 done: remembers how everyone looks

  // Ward Council: a focus name gets its next ordinance suggested; What will help isn't here any more (Nov 19, 2026)
  await p.click('.door-wc'); await w(400); // the focus names sit right on Ward Council
  await p.click('#wc-rows [data-action="open-person"][data-a="tn"][data-b="0"]'); await w(500);
  ok(/Suggested: Priesthood advancement/.test(await p.textContent('#person-card .ord-suggest')), 'Olivia’s next ordinance is suggested from her checklist (Melchizedek Priesthood still open)');
  ok(!(await p.$('#person-card [data-bind$=".need"]')) && !(await p.$('#person-card .help-chips')), 'Ward Council has no What will help box or chips');
  await p.click('#person-card .ord-suggest .idea-chip'); await w(300);
  st = await saved();
  ok(st.tn[0].ordinance === 'Priesthood advancement', 'tapping the suggestion fills Next ordinance');
  ok(await wide(), 'ward council’s screen fits a small iPhone');
  await p.screenshot({ path: OUT + '/wc-focus.png', fullPage: true });
  await p.click('#person-view .person-done'); await w(300);
  await p.click('#wc-rows [data-action="open-person"][data-a="tn"][data-b="1"]'); await w(400);
  await p.selectOption('#person-card [data-bind="tn.1.ordinance"]', 'Endowment'); await w(400);
  await p.click('#person-view .person-done'); await w(300);

  // The Huddle: no sacrament box; the action item offers what's still open on her report, then ideas for her next ordinance
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(400);
  await p.click('[data-action="open-step"][data-a="tn"]'); await w(400);
  await p.click('#tn-list [data-action="open-person"][data-b="0"]'); await w(400);
  ok(!(await p.$('#person-card .sac-toggle')), 'a focus name in the Huddle has no Attended sacrament box');
  const ach = await p.$$eval('#person-card .action-chips .idea-chip', e => e.map(x => x.textContent));
  const atext = await p.textContent('#person-card .action-chips');
  ok(/Next steps on their Covenant Path Report/.test(atext) && /Ideas for priesthood advancement/.test(atext) && ach.includes('Melchizedek Priesthood ordination') && !ach.includes('A calling') && !ach.includes('Friends at church') && !ach.includes('Aaronic Priesthood ordination'),
    'under Assignment: only her next steps on her report, then ideas for her next ordinance: ' + ach.join(' | '));
  await p.click('#person-card .action-chips .idea-chip >> text=Melchizedek Priesthood ordination'); await w(400);
  st = await saved();
  ok(st.tn[0].action === 'Melchizedek Priesthood ordination' && !(await p.isVisible('#person-card .action-chips')) && await p.evaluate(() => /assigned$/.test(document.activeElement.dataset.bind || '')), 'tapping one fills the Action item, the chips hide, and the cursor moves to Assigned to');
  await p.fill('#person-card [data-bind="tn.0.action"]', 'Meet with the elders quorum president'); await p.evaluate(() => document.activeElement.blur()); await w(200);
  await p.click('#person-view .person-done'); await w(300);
  await p.click('#tn-list [data-action="open-person"][data-b="1"]'); await w(400);
  const gi = await p.$$eval('#person-card .action-chips .idea-chip', e => e.map(x => x.textContent));
  ok(/Ideas for the endowment/.test(await p.textContent('#person-card .action-chips')) && !/Still open/.test(await p.textContent('#person-card .action-chips')) && gi.includes('Meet with the bishop'), 'a name not on the report gets only Ideas for its next ordinance: ' + gi.join(' | '));
  await p.click('#person-view .person-done'); await w(300);

  // Opportunities to invite: an assignment is one line; texting it names the opportunity
  await p.click('#step-foot [data-action="steps-home"], .step-back'); await w(400);
  await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  await p.click('#fn-list [data-a="opp"]'); await w(400);
  await p.click('#person-card [data-action="add-fn"]'); await w(300);
  await p.fill('#person-card [data-bind$=".task"]', 'Each family invites one friend'); await p.fill('#person-card [data-bind$=".who"]', 'Elders quorum'); await p.evaluate(() => document.activeElement.blur()); await w(300);
  await p.evaluate(() => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (/^sms:/.test(this.href)) { window.__sms = this.href; return; } return orig.call(this); }; });
  ok(await p.isVisible('#person-card .fn-line .btn-text-assign'), 'an assignment with what and who can be texted');
  await p.click('#person-card .fn-line .btn-text-assign'); await w(300);
  const sms = await p.evaluate(() => decodeURIComponent(String(window.__sms || '')));
  ok(/Each family invites one friend/.test(sms) && /For: Christmas sacrament meeting/.test(sms) && /report back before Sunday/.test(sms), 'the text has the assignment, the opportunity and the report-back line: ' + sms.replace(/\n/g, ' / ').slice(0, 160));
  await p.click('#person-card .fn-line summary'); await w(300);
  ok(await p.locator('#person-card .fn-line').count() === 1 && /Elders quorum/.test(await p.textContent('#person-card .fn-line summary')), 'closed, the assignment is one line with who');
  await p.click('#person-view .person-done'); await w(300);
  ok(await p.locator('#fn-list .opp-panel').count() === 1 && /Each family invites one friend/.test(await p.textContent('#fn-list .opp-panel .asg-row')) && /Elders quorum/.test(await p.textContent('#fn-list .opp-panel .asg-row')), 'in the Huddle the opportunity is a card, with the assignment as one line under it');
  await p.click('#fn-list .asg-row'); await w(500);
  ok(await p.isVisible('#person-view') && await p.locator('#person-card details.fn-line[open]').count() === 1, 'tapping the line opens just that assignment');
  await p.click('#person-view .person-done'); await w(300);

  // Something done this week: Olivia got her calling... and Melchizedek Priesthood
  await p.click('.nav-home'); await w(400); await p.click('#before-box'); await w(400);
  if (!(await p.isVisible('#before-list [data-bw="rm"] .exp-edit'))) { await p.click('#before-list [data-bw="rm"] [data-action="row-toggle"]'); await w(300); } await p.click('#before-list [data-bw="rm"] .exp-edit'); await w(400); // opens in place; Edit details opens the screen
  await p.click('[data-action="check-item"][data-b="melch"]'); await w(200);
  await p.click('#person-view .person-done'); await w(300);
  await p.click('.nav-home'); await w(400);

  // After the huddle: only Olivia, with the item that changed
  await p.click('#after-box'); await w(500);
  const names = await p.$$eval('#after-list .after-card .after-name', e => e.map(x => x.firstChild.textContent));
  const ol = (await p.textContent('#after-list')).replace(/\s+/g, ' ');
  ok(names.join('|') === 'Olivia Chen' && /Melchizedek Priesthood ordination\s*Done/.test(ol) && !/What will help|Next ordinance/.test(ol), 'After the huddle lists only who changed, and only what goes into the report: ' + names.join('|'));
  await p.screenshot({ path: OUT + '/after.png', fullPage: true });
  for (let k = 0; k < 12 && await p.$('[data-action="after-upd"][aria-checked="false"]'); k++) { await p.click('[data-action="after-upd"][aria-checked="false"]'); await w(150); } // tick each changed name
  await p.click('#after-done-btn'); await w(500);

  // The PDF: Done this week under Olivia's focus name; the checklist itself isn't printed
  await p.click('.actionbar [data-action="send"]'); await w(400);
  if (await p.isVisible('#confirm-sheet')) { ok(!/Covenant Path Report: /.test(await p.textContent('#confirm-sheet')), 'Ready to send doesn’t ask for action items on the Covenant Path Report (only focus names)'); await p.click('#confirm-primary'); }
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const f = OUT + '/checklist.pdf'; await dl.saveAs(f);
  const t = execSync(`pdftotext "${f}" -`).toString().replace(/\s+/g, ' ');
  ok(/Done this week Melchizedek Priesthood ordination|Done this week/.test(t) && /Next steps/.test(t) && !/Still open/.test(t) && /Melchizedek Priesthood ordination/.test(t), 'PDF: Done this week under the focus name, What will help, and no checklist');

  // Next huddle: the checklist comes along with the name
  await p.click('#confirm-primary').catch(() => {}); await w(600);
  st = await saved();
  const ol2 = (st.cp.rm || []).find(x => x.name === 'Olivia Chen') || {};
  ok(ol2.checks && ol2.checks.melch === true && ol2.checks.calling === true && ol2.checks.aaronic === 'na', 'next huddle: the checklist carries over with the name');
  const ol3 = (st.tn || []).find(x => x.name === 'Olivia Chen') || {};
  ok(ol3.ordinance === 'Priesthood advancement' && !ol3.action, 'next huddle: the focus name keeps its next ordinance; its action item moves to Return and Report');
  const past = (st.find.items || []).filter(x => x.past);
  const ri = (st.rr || []).findIndex(r => /Each family invites one friend/.test(r.action || ''));
  ok(past.length === 1 && past[0].opp === 'o1' && ri >= 0 && st.rr[ri].fid === past[0].id, 'next huddle: the assignment stays on the opportunity and comes back in Return and Report');
  await p.click('.nav-home').catch(() => {}); await w(300); if (await p.isVisible('.door-hd')) { await p.click('.door-hd'); await w(400); }
  await p.click('[data-action="open-step"][data-a="rr"]'); await w(400);
  await p.click(`#rr-list [data-action="happened"][data-a="${ri}"][data-b="Yes"]`); await w(800);
  ok(((await saved()).find.items.find(x => x.past) || {}).status === 'Yes', 'marking it Yes in Return and Report marks it on the opportunity');
  await p.click('.step-back'); await w(300); await p.click('[data-action="open-step"][data-a="fn"]'); await w(400);
  await p.click('#fn-list [data-a="opp"]'); await w(400);
  ok((await p.textContent('#person-card .fn-line.is-past .wc-status')).trim() === 'Done', 'the opportunity shows it as Done');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
