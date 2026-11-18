// The test copy (try/): focus names filter the huddle, and it keeps its own storage.
// Pressing names are suggested in red; Make focus name works in ward council (past three when needed);
// the huddle plans action items for focus names only; a carried assignment comes back as a focus name;
// the PDF leads with the focus names. Run with the server on 8765 like the other tests.
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
    nm: [card({ name: 'Daniel Rivera', bap: shift(-60), temple: true, ordinance: 'Priesthood advancement' }), card({ name: 'Emma Walsh', bap: shift(-21), ordinance: 'Baptisms for the dead', need: 'A ride to the temple' })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church' })],
    bt: [card({ name: 'Marcus Hill', bap: shift(10), committed: true, need: 'Get to know ward members' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }] }, verified: { before: true, after: true }, stepsDone: {}
};
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone SE'], acceptDownloads: true });
  await c.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); ['huddletest-tour-seen', 'huddletest-help-seen', 'huddletest-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddletest-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = t => p.waitForTimeout(t);
  await p.goto(BASE); await w(500);
  // A real huddle saved by the live app on the same website is never touched.
  await p.evaluate(s => { localStorage.setItem('huddle-agenda-v1', '{"live":true}'); localStorage.setItem('__seed', JSON.stringify(s)); }, seed);
  await p.reload(); await w(700);
  ok(await p.textContent('.title-text .app-name').then(t => /Test version/.test(t)), 'the opening screen says Test version');

  // Before ward council: pressing names are suggested
  await p.click('#before-box'); await w(500);
  const bwText = await p.textContent('#before-list');
  ok((bwText.match(/Suggested focus name/g) || []).length === 2, 'Before ward council suggests Emma Walsh (temple) and Marcus Hill (baptism)');
  await p.click('.nav-home'); await w(400);

  // Ward council: make them focus names, and one more past three
  await p.click('.door-wc'); await w(400);
  await p.click('[data-action="open-wc-list"][data-a="cp"]'); await w(400);
  for (const [g, i] of [['bt', 0], ['nm', 1], ['rm', 0]]) {
    await p.click(`#wc-list [data-group="${g}"] [data-b="${i}"], #wc-list [data-wc="${g}"] [data-b="${i}"]`); await w(500);
    if (g === 'bt') { ok(await p.isVisible('#person-card .focus-box.is-pressing') && /Suggested focus name · Baptism/.test(await p.textContent('#person-card .focus-why')), 'a pressing name says why it is suggested'); await p.screenshot({ path: OUT + '/wc-pressing.png' }); }
    await p.click('#person-card [data-action="make-focus"]'); await w(400);
    ok(await p.isVisible('#person-card .focus-on'), 'Make focus name: the screen now says it is a focus name');
    await p.click('#person-view .person-done'); await w(400);
  }
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('huddletest-agenda-v1') || localStorage.getItem('huddletest-draft-v1') || '{}'));
  const names = (st.tn || []).map(t => t.name).filter(Boolean);
  ok(names.join('|') === 'Grace Thompson|Marcus Hill|Emma Walsh|Olivia Chen', 'focus names: Grace, then Marcus and Emma in the open spots, Olivia past three: ' + names.join('|'));
  ok(st.tn[1].ordinance === 'Baptism' && st.tn[2].need === 'A ride to the temple', 'the next ordinance and needs come along');
  ok(await p.evaluate(() => localStorage.getItem('huddle-agenda-v1')) === '{"live":true}', 'the live app’s saved huddle is untouched');

  // Huddle: focus names first; the Covenant Path names are for reference, with no action item
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(500);
  const order = await p.$$eval('#steps-this [data-action="open-step"]', els => els.map(e => e.getAttribute('data-a')));
  ok(order[0] === 'tn' && order[1] === 'cp', 'the huddle plan opens with Focus names, then the Covenant Path Report: ' + order.join(','));
  ok(/4 names/.test(await p.textContent('#steps-this')), 'Focus names counts four names');
  await p.click('[data-action="open-step"][data-a="cp"]'); await w(400);
  await p.click('[data-group="rm"] [data-b="0"]'); await w(500);
  ok(await p.locator('#person-card [data-bind$=".action"]').count() === 0 && await p.isVisible('#person-card .focus-on'), 'a Covenant Path name in the huddle has no action item; it says it is a focus name');
  await p.screenshot({ path: OUT + '/hd-cp-person.png' });
  await p.click('#person-view .person-done'); await w(300);

  // Return and Report: Daniel's partly-done assignment comes back as a focus name
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(400);
  await p.click('[data-action="open-step"][data-a="rr"]'); await w(400);
  await p.click('#rr-list [data-b="Partly"]'); await w(300);
  await p.click('#rr-list [data-action="carry-fwd"]'); await w(400);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('huddletest-agenda-v1') || localStorage.getItem('huddletest-draft-v1') || '{}'));
  const dan = (st.tn || []).find(t => t.name === 'Daniel Rivera');
  ok(!!dan && dan.action === 'Set up his interview', 'carry forward makes Daniel Rivera a focus name with his action item');

  // The PDF leads with the focus names; Covenant Path blocks carry no action item
  await p.click('.actionbar [data-action="send"]'); await w(400);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const f = OUT + '/try.pdf'; await dl.saveAs(f);
  const t = execSync(`pdftotext -layout "${f}" -`).toString();
  ok(t.indexOf('Focus names') > 0 && t.indexOf('Focus names') < t.indexOf('Covenant Path Report Review'), 'PDF: Focus names come before the Covenant Path Report Review');
  ok(!/more on the Covenant Path Report/.test(t) && /Daniel Rivera\s+Set up his interview/.test(t), 'PDF: At a glance lists the focus names with their action items (everyone here is a focus name)');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(`\n${passed}/${passed + failed} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
