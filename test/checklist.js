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
  find: { plan: '', items: [{ task: '', when: '' }], opps: [] }, referrals: [],
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
  ok((await p.textContent('#before-list [data-bw="rm"] .person-row')).includes('1 of 10 done'), 'a row counts what’s done, leaving out what doesn’t apply');
  await p.click('#before-list [data-bw="rm"] [data-action="open-person"]'); await w(400);
  ok(await p.locator('#person-card .ck-li.is-na').count() === 1 && await p.locator('#person-card .ck-na').count() === 3, 'Aaronic Priesthood is marked Doesn’t apply; three items offer it');
  await p.click('[data-action="check-na"][data-b="sealspouse"]'); await w(200);
  await p.click('[data-action="check-item"][data-b="calling"]'); await w(200);
  ok((await p.textContent('#person-card .ck-count')).trim() === '2 of 9 done' && await wide(), 'Doesn’t apply takes an item out of the count; a check counts as done');
  await w(800); let st = await saved();
  ok(st.cp.rm[0].checks.sealspouse === 'na' && st.cp.rm[0].checks.calling === true && st.cp.rm[0].checks.friends === true, 'the checklist is saved with the person');
  await p.click('[data-action="check-na"][data-b="sealspouse"]'); await w(800);
  ok(!(await saved()).cp.rm[0].checks.sealspouse, 'tapping Doesn’t apply again puts it back as still open');
  await p.screenshot({ path: OUT + '/before-rm.png', fullPage: true });
  await p.click('#person-view .person-done'); await w(300);
  await p.click('#before-done-btn'); await w(500); // step 1 done: remembers how everyone looks

  // Ward council: a focus name gets its next ordinance suggested and its open items as chips
  await p.click('.door-wc'); await w(400); await p.click('[data-action="open-wc-list"][data-a="tn"]'); await w(400);
  await p.click('#wc-list [data-action="open-person"][data-a="tn"][data-b="0"]'); await w(500);
  ok(/Suggested: Priesthood advancement/.test(await p.textContent('#person-card .ord-suggest')), 'Olivia’s next ordinance is suggested from her checklist (Melchizedek Priesthood still open)');
  const chips = await p.$$eval('#person-card .help-chips .idea-chip', e => e.map(x => x.textContent));
  ok(/Still open on their Covenant Path Report/.test(await p.textContent('#person-card .help-chips')) && chips.includes('Melchizedek Priesthood ordination') && !chips.includes('A calling') && !chips.includes('Friends at church') && !chips.includes('Aaronic Priesthood ordination'),
    'under What will help: only what’s still open on her report: ' + chips.join(' | '));
  await p.click('#person-card .ord-suggest .idea-chip'); await w(300);
  await p.click('#person-card .help-chips .idea-chip >> text=Melchizedek Priesthood ordination'); await w(300);
  st = await saved();
  ok(st.tn[0].ordinance === 'Priesthood advancement' && st.tn[0].need === 'Melchizedek Priesthood ordination' && !(await p.isVisible('#person-card .help-chips')), 'tapping fills Next ordinance and What will help; the chips hide');
  ok(await wide(), 'ward council’s screen fits a small iPhone');
  await p.screenshot({ path: OUT + '/wc-focus.png', fullPage: true });
  await p.click('#person-view .person-done'); await w(300);
  await p.click('#wc-list [data-action="open-person"][data-a="tn"][data-b="1"]'); await w(400);
  ok(!(await p.$('#person-card .help-chips')), 'a focus name that isn’t on the report gets no chips');
  await p.click('#person-view .person-done'); await w(300);

  // The Huddle: a focus name has no sacrament box
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(400);
  await p.click('[data-action="open-step"][data-a="tn"]'); await w(400);
  await p.click('#tn-list [data-action="open-person"][data-b="0"]'); await w(400);
  ok(!(await p.$('#person-card .sac-toggle')), 'a focus name in the Huddle has no Attended sacrament box');
  await p.fill('#person-card [data-bind="tn.0.action"]', 'Meet with the elders quorum president'); await p.evaluate(() => document.activeElement.blur()); await w(200);
  await p.click('#person-view .person-done'); await w(300);

  // Something done this week: Olivia got her calling... and Melchizedek Priesthood
  await p.click('.nav-home'); await w(400); await p.click('#before-box'); await w(400);
  await p.click('#before-list [data-bw="rm"] [data-action="open-person"]'); await w(400);
  await p.click('[data-action="check-item"][data-b="melch"]'); await w(200);
  await p.click('#person-view .person-done'); await w(300);
  await p.click('.nav-home'); await w(400);

  // After the huddle: only Olivia, with the item that changed
  await p.click('#after-box'); await w(500);
  const names = await p.$$eval('#after-list .after-card .after-name', e => e.map(x => x.firstChild.textContent));
  const ol = (await p.textContent('#after-list')).replace(/\s+/g, ' ');
  ok(names.join('|') === 'Olivia Chen' && /Melchizedek Priesthood ordination\s*Done/.test(ol) && !/What will help|Next ordinance/.test(ol), 'After the huddle lists only who changed, and only what goes into the report: ' + names.join('|'));
  await p.screenshot({ path: OUT + '/after.png', fullPage: true });
  await p.click('#after-done-btn'); await w(500);

  // The PDF: Done this week under Olivia's focus name; the checklist itself isn't printed
  await p.click('.actionbar [data-action="send"]'); await w(400);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const f = OUT + '/checklist.pdf'; await dl.saveAs(f);
  const t = execSync(`pdftotext "${f}" -`).toString().replace(/\s+/g, ' ');
  ok(/Done this week/.test(t) && (t.match(/Melchizedek Priesthood ordination/g) || []).length >= 2 && /What will help/.test(t) && !/Interview for patriarchal blessing|Assigned ministers/.test(t), 'PDF: Done this week under the focus name, What will help, and no checklist');

  // Next huddle: the checklist comes along with the name
  await p.click('#confirm-primary').catch(() => {}); await w(600);
  st = await saved();
  const ol2 = (st.cp.rm || []).find(x => x.name === 'Olivia Chen') || {};
  ok(ol2.checks && ol2.checks.melch === true && ol2.checks.calling === true && ol2.checks.aaronic === 'na', 'next huddle: the checklist carries over with the name');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
