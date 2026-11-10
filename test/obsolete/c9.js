const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
  const ctx = await b.newContext({ ...devices[d] }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(()=>{});
  await p.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('huddle-draft-v1') || 'null'); });
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.need"]', 'A friend in Relief Society');
  await p.click('[data-action="add-cp"][data-a="nm"]');
  await p.evaluate(() => { document.querySelector('[data-group="nm"] .card:nth-of-type(1)'); });
  await p.locator('[data-group="nm"]').screenshot({ path: `test/out9/${n}-panel.png` });
  await p.locator('#tn-list .card').first().screenshot({ path: `test/out9/${n}-tn.png` });
  await ctx.close(); }
  await b.close(); })();
