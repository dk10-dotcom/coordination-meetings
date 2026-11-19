// Ward council shows Part-Member Families under Find your focus names, as a plain link row beside the Covenant Path
// Report card: the web report, opened outside the app, on Ward Council's own screen only, never wider than a small iPhone.
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
  ok(/Part-Member Families/.test(await link.innerText()) && await link.evaluate(e => !e.classList.contains('btn-tools')), 'says Part-Member Families, as a plain row (less prominent than the cards)');
  const cpB = await p.locator('#wc-step-cp').boundingBox(), tnB = await p.locator('#wc-step-tn').boundingBox(), lb = await link.boundingBox();
  ok(lb.y >= cpB.y + cpB.height - 1 && lb.y + lb.height <= tnB.y + 1 && /Find your focus names/i.test(await p.textContent('#wc-find-k')), 'sits under Find your focus names, between the Covenant Path Report and Focus names');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 320, 'fits a 320 px screen');
  await p.locator('[data-action="open-wc-list"][data-a="cp"]').click(); await p.waitForTimeout(400);
  ok(!(await link.isVisible()), 'hidden on a list of names');
  await p.goBack(); await p.waitForTimeout(500);
  ok(await link.isVisible(), 'back on Ward council, it shows again');
  ok(/Part-Member Families<\/strong>/.test(await p.content()), 'Help & training mentions it');
  ok(!problems.length, 'no page errors' + (problems.length ? ': ' + problems.join('; ') : ''));
  await b.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
