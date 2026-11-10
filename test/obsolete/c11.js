const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip');
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(300);
  await p.screenshot({ path: 'test/out10/help-top.png', clip: { x: 0, y: 0, width: 390, height: 260 } });
  console.log(await p.$eval('#help-sheet .grab', g => { const r = g.getBoundingClientRect(); const cs = getComputedStyle(g); return JSON.stringify({ top: r.top, w: r.width, h: r.height, bg: cs.backgroundColor }); }));
  await p.$eval('#help-sheet .sheet', s => { s.scrollTop = 400; }); await p.waitForTimeout(100);
  await p.screenshot({ path: 'test/out10/help-scrolled.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
  await b.close(); })();
