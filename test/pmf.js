// Ward council shows Open Part-Member Families above its four rows: the web report, opened outside the app,
// on the four-row screen only (not on the lists of names), and never wider than a small iPhone.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
const URL = 'https://lcr.churchofjesuschrist.org/mlt/report/part-member-households?lang=eng';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); } catch (e) {} });
  const p = await c.newPage(); const problems = []; p.on('pageerror', e => problems.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(600);
  const link = p.locator('#wc-pmf');
  ok(!(await link.isVisible()), 'not on the opening screen');
  await p.locator('[data-action="open-wc"]').first().click(); await p.waitForTimeout(500);
  ok(await link.isVisible(), 'shows on Ward council');
  ok(await link.getAttribute('href') === URL, 'opens the Part-Member Families report');
  ok(await link.getAttribute('target') === '_blank' && /noopener/.test(await link.getAttribute('rel')), 'opens outside the app');
  ok(/Open Part-Member Families/.test(await link.innerText()), 'says Open Part-Member Families');
  const rowsTop = await p.locator('#wc-rows').evaluate(e => e.getBoundingClientRect().top);
  const lb = await link.boundingBox();
  ok(lb.y + lb.height <= rowsTop, 'sits above the four rows');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 320, 'fits a 320 px screen');
  await p.locator('[data-action="open-wc-list"][data-a="tn"]').click(); await p.waitForTimeout(400);
  ok(!(await link.isVisible()), 'hidden on a list of names');
  await p.goBack(); await p.waitForTimeout(500);
  ok(await link.isVisible(), 'back on Ward council, it shows again');
  ok(/Open Part-Member Families/.test(await p.content()), 'Help & training mentions it');
  ok(!problems.length, 'no page errors' + (problems.length ? ': ' + problems.join('; ') : ''));
  await b.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
