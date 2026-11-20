// The guided tour and its practice week are gone (Nov 18, 2026). A phone left in the middle of one gets its own huddle
// back when the app opens, and the first visit from the Home Screen offers the step-by-step guide instead.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  // 1) A phone left in a practice week, with its own huddle set aside
  const own = { ward: 'Sample Ward', cp: { nm: [{ name: 'Emma Walsh' }], rm: [], bt: [] }, tn: [{ name: 'Grace Thompson' }] };
  const practice = { ward: 'Sample Ward', cp: { nm: [{ name: 'Daniel Rivera' }], rm: [], bt: [] }, tn: [{ name: 'Samuel Ortiz' }],
    loaded: { fileName: 'Practice week', practice: true }, practiceSnapshot: own };
  const c = await b.newContext({ ...devices['iPhone SE'] });
  await c.addInitScript(s => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__done')) { localStorage.setItem('huddle-agenda-v1', s); localStorage.setItem('huddle-coach-step', '4'); localStorage.setItem('__done', '1'); } } catch (e) {} }, JSON.stringify(practice));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
  ok(st.cp.nm[0].name === 'Emma Walsh' && !(st.loaded && st.loaded.practice) && !st.practiceSnapshot, 'a phone left in a practice week gets its own huddle back');
  ok(!(await p.$('.coach')) && await p.evaluate(() => localStorage.getItem('huddle-coach-step') === null), 'no tour card, and its step is forgotten');
  ok(!(await p.$('[data-action="tour"]')) && !(await p.$('[data-action="practice"]')), 'nothing offers a tour or a practice week');
  await p.goto(BASE + '#tour'); await p.reload(); await p.waitForTimeout(1200);
  ok(await p.isVisible('#slides-sheet'), 'an old #tour link opens the step-by-step guide');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await c.close();

  // 2) The first visit from the Home Screen: a welcome offers the step-by-step guide
  const d = await b.newContext({ ...devices['iPhone SE'] });
  await d.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); try { localStorage.setItem('huddle-gate-off', '1'); } catch (e) {}; Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); });
  const q = await d.newPage();
  await q.goto(BASE); await q.waitForTimeout(2200);
  if (await q.isVisible('#ward-sheet')) { await q.fill('#ward', 'Sample Ward'); await q.click('#ward-sheet [data-action="close-ward"]'); await q.waitForTimeout(700); } // the ward comes first (Nov 19, 2026)
  ok(await q.isVisible('#confirm-sheet') && /Welcome to Huddle/.test(await q.textContent('#confirm-title')) && /Open the guide/.test(await q.textContent('#confirm-primary')), 'the first visit from the Home Screen offers the step-by-step guide');
  await q.click('#confirm-primary'); await q.waitForTimeout(500);
  ok(await q.isVisible('#slides-sheet'), 'Open the guide opens it');
  await d.close();
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
