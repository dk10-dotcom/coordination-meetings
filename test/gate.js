// iPhone and iPad Safari show only the way to the Home Screen app (Nov 19, 2026). A handoff link still opens there,
// the Home Screen app opens as usual, and Android isn't blocked. The screen is off while a test browser runs, so this
// test turns it on with the huddle-gate-test flag.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const page = async (dev, init, ua) => { const c = await b.newContext({ ...devices[dev], ...(ua ? { userAgent: ua } : {}) }); await c.addInitScript(init || (() => {})); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); return p; };

  // iPhone Safari: the Home Screen steps only, with the arrow at the bottom right
  const p = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); });
  await p.goto(BASE); await p.waitForTimeout(1800);
  ok(await p.isVisible('#safari-gate') && /Open Huddle from your Home Screen/.test(await p.textContent('#safari-gate')) && /Add to Home Screen/.test(await p.textContent('#safari-gate')), 'iPhone Safari shows only “Open Huddle from your Home Screen”, with the steps');
  // The arrow points where that Safari keeps Share: iOS 26 the ≡ at the left of the address bar, iOS 18 the middle
  const arrowAt = async (pg) => pg.$eval('.gate-arrow', e => { const r = e.getBoundingClientRect(); return { left: r.left, mid: r.left + r.width / 2 - innerWidth / 2, bottom: innerHeight - r.bottom }; });
  const UA = v => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`;
  const p26 = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); }, UA('26.1'));
  await p26.goto(BASE); await p26.waitForTimeout(1500);
  const a26 = await arrowAt(p26);
  ok(a26.left > 70 && a26.left < 100 && a26.bottom < 40, 'iOS 26: the arrow points to the ≡ at the left of the address bar (' + Math.round(a26.left) + ')');
  const p18 = await page('iPhone SE', () => { localStorage.setItem('huddle-gate-test', '1'); }, UA('18.5'));
  await p18.goto(BASE); await p18.waitForTimeout(1500);
  const a18 = await arrowAt(p18);
  ok(Math.abs(a18.mid) < 4 && a18.bottom < 40, 'iOS 18: the arrow points to Share in the middle of the toolbar');
  ok(await p.locator('#safari-gate .gate-steps li:first-child .gate-ic').count() === 3, 'step 1 shows the three buttons it could be (≡, ••• and Share)');
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
