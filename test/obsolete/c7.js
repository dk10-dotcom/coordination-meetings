const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip');
  await p.click('[data-action="dismiss-install"]').catch(()=>{});
  await p.evaluate(() => scrollTo(0, document.querySelector('.conduct-field').getBoundingClientRect().top + scrollY - 40)); await p.waitForTimeout(200); await p.screenshot({ path: 'test/out7/conduct.png', clip: { x: 0, y: 0, width: 390, height: 420 } }); await b.close(); })();
