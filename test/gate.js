// iPhone and iPad Safari show only the way to the Home Screen app (Nov 19, 2026). A handoff link still opens there,
// the Home Screen app opens as usual, and Android isn't blocked. The screen is off while a test browser runs, so this
// test turns it on with the huddle-gate-test flag.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const page = async (dev, init) => { const c = await b.newContext({ ...devices[dev] }); await c.addInitScript(init || (() => {})); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); return p; };

  // iPhone Safari: the Home Screen steps only, with the arrow at the bottom right
  const p = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); });
  await p.goto(BASE); await p.waitForTimeout(1800);
  ok(await p.isVisible('#safari-gate') && /Open Huddle from your Home Screen/.test(await p.textContent('#safari-gate')) && /Add to Home Screen/.test(await p.textContent('#safari-gate')), 'iPhone Safari shows only “Open Huddle from your Home Screen”, with the steps');
  const arrow = await p.$eval('.gate-arrow', e => { const r = e.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
  ok(arrow.right < 40 && arrow.bottom < 40, 'the arrow points to Safari’s toolbar at the bottom right');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'it fits a small iPhone');
  ok(!(await p.isVisible('#help-sheet')) && !(await p.isVisible('#confirm-sheet')), 'nothing opens over it');
  ok(!p.errs.length, 'no page errors ' + p.errs.join('; '));

  // iPad Safari: the arrow points up
  const q = await page('iPad Mini', () => { localStorage.setItem('huddle-gate-test', '1'); });
  await q.goto(BASE); await q.waitForTimeout(1800);
  ok(await q.isVisible('#safari-gate') && await q.evaluate(() => document.querySelector('.gate-arrow').getBoundingClientRect().top < 80), 'iPad Safari shows it too, with the arrow at the top');

  // The Home Screen app: no screen
  const r = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); });
  await r.goto(BASE); await r.waitForTimeout(1800);
  ok(!(await r.isVisible('#safari-gate')) && await r.isVisible('#start-home'), 'the Home Screen app opens as usual');

  // Android: not blocked
  const a = await page('Pixel 7', () => { localStorage.setItem('huddle-gate-test', '1'); });
  await a.goto(BASE); await a.waitForTimeout(1800);
  ok(!(await a.isVisible('#safari-gate')), 'Android isn’t blocked');

  // "Use it in Safari this once" (after a handoff): this visit runs in Safari
  const u = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); sessionStorage.setItem('huddle-safari-once', 'true'); });
  await u.goto(BASE); await u.waitForTimeout(1800);
  ok(!(await u.isVisible('#safari-gate')), 'after “Use it in Safari this once”, that visit runs in Safari');

  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
