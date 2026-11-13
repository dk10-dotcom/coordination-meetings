// Step 4 marks what changed since step 1; a person's name header edits the name; Ward council shows the temple
// countdown; Mark done is pinned above the bottom bar and toggles; the confidential line sits under both step cards.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-changes'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: ago(1) }, o);
const seed = () => ({
  ward: 'Sample Ward', date: iso(new Date()), conducting: 'wml', attendees: ['wml'],
  rr: [], cp: {
    nm: [card({ name: 'Daniel Rivera', bap: ago(10), ordinance: 'Baptisms for the dead', need: 'A ride' }), card({ name: 'Emma Walsh', bap: ago(3), ordinance: 'Baptisms for the dead' })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment' })],
    bt: [card({ name: 'Marcus Hill', need: 'Friends at church' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Endowment' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }] }, verified: { before: false, after: false }, stepsDone: {}
});
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await c.newPage(); const problems = []; p.on('pageerror', e => problems.push(e.message));
  const w = t => p.waitForTimeout(t);
  await p.goto(BASE); await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed()); await p.reload(); await w(600);

  // Step 1: Mark done is pinned above the bottom bar, then remembers everyone
  await p.click('#before-box'); await w(500);
  const pinned = await p.evaluate(() => { const b = document.querySelector('#before-done-btn').getBoundingClientRect(), bar = document.querySelector('.actionbar').getBoundingClientRect(); return b.bottom <= bar.top + 30 && b.bottom > innerHeight / 2; });
  ok(pinned, 'Mark done stays in view just above the bottom bar on a long list');
  ok((await p.textContent('#before-done-btn')).trim() === 'Mark done', 'it says Mark done');
  await p.click('#before-done-btn'); await p.waitForSelector('#start-home:not([hidden])'); await w(300);
  ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('huddle-agenda-v1')).bwSnap), 'marking step 1 done remembers how each person looked');

  // Ward council: confidential line under the step card, and the temple countdown on new members
  await p.click('.door-wc'); await w(500);
  ok(await p.evaluate(() => { const h = document.querySelector('#wc-hero'), n = document.querySelector('#wc-note'); return !n.hidden && h.nextElementSibling === n; }), 'Ward council: the confidential reminder sits right under the step card');
  await p.locator('#wc-rows .nav-row').first().click(); await w(500);
  ok((await p.textContent('#wc-list')).includes('Temple:'), 'Ward council: new members show the temple countdown');

  // A person's name header opens the name to edit
  await p.locator('[data-action="open-person"]').first().click(); await w(500);
  ok(await p.isVisible('#person-view .avatar-pencil'), 'the initials carry a small pencil');
  await p.click('.person-head'); await w(600);
  ok(await p.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === 'INPUT' && /\.name$/.test(a.getAttribute('data-bind') || '') && a.value === 'Daniel Rivera'; }), 'tapping the name header puts the cursor in the name box');
  await p.evaluate(() => document.activeElement.blur()); await w(600);

  // Change things after step 1 (in the huddle): sacrament for Daniel, a new need for Marcus, a new name
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(500);
  ok(await p.evaluate(() => { const h = document.querySelector('#hd-hero'), n = document.querySelector('#hd-note'); return !n.hidden && h.nextElementSibling === n; }), 'Huddle: the confidential reminder sits right under the step card');
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('huddle-agenda-v1'));
    s.cp.nm[0].sac = true; s.cp.bt[0].need = 'A ride to church'; s.cp.rm.push(Object.assign({}, s.cp.rm[0], { name: 'Samuel Ortiz', ordinance: 'Sealing' }));
    localStorage.setItem('__seed', JSON.stringify(s));
  });
  await p.reload(); await w(600);
  await p.click('#after-box'); await w(600);
  const cards = await p.$$eval('#after-list .after-card', cs => cs.map(c => ({ name: c.querySelector('.after-name').firstChild.textContent, tag: (c.querySelector('.after-changed') || {}).textContent || '', upd: [...c.querySelectorAll('.after-fact.is-upd .after-k')].map(k => k.textContent) })));
  ok(cards.slice(0, 3).map(x => x.name).sort().join('|') === 'Daniel Rivera|Marcus Hill|Samuel Ortiz', 'the three people who changed come first', cards.map(x => x.name).join(' | '));
  const by = n => cards.find(x => x.name === n) || {};
  ok(by('Daniel Rivera').tag === 'Changed' && by('Daniel Rivera').upd.join() === 'Sacrament', 'Daniel: Changed, with Sacrament marked Updated');
  ok(by('Marcus Hill').upd.join() === 'Needs', 'Marcus: Needs marked Updated');
  ok(by('Samuel Ortiz').tag === 'New since step 1', 'a name added after step 1 says New since step 1');
  ok(by('Emma Walsh').tag === '' && by('Olivia Chen').tag === '', 'people with no changes have no tag');
  ok((await p.textContent('.after-summary')).startsWith('3 people changed since step 1'), 'a line at the top says how many changed');
  await p.screenshot({ path: OUT + '/after.png' });

  // Mark done toggles: green Done, tapped again takes it off
  await p.click('#after-done-btn'); await p.waitForSelector('#start-home:not([hidden])'); await w(300);
  await p.click('#after-box'); await w(500);
  ok((await p.getAttribute('#after-done-btn', 'class')).includes('is-done') && (await p.textContent('#after-done-btn')).trim() === 'Done', 'once done it is green and says Done');
  await p.click('#after-done-btn'); await w(300);
  ok((await p.textContent('#after-done-btn')).trim() === 'Mark done' && await p.isVisible('#toast .toast-action'), 'tapping it again takes the mark off, with Undo');

  // A new week starts without the memory of step 1
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); delete s.bwSnap; s.verified.before = false; localStorage.setItem('__seed', JSON.stringify(s)); });
  await p.reload(); await w(500); await p.click('#after-box'); await w(500);
  ok(await p.locator('.after-changed, .after-summary').count() === 0, 'without step 1 marked done, nothing is marked');

  ok(problems.length === 0, 'no page errors' + (problems.length ? ': ' + problems.join(' | ') : ''));
  await b.close();
  console.log(`${passed}/${passed + failed} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
