const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13','i13'],['iPhone SE','se']]) {
    const ctx = await b.newContext({ ...devices[d] });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip');
    await p.click('[data-action="dismiss-install"]').catch(()=>{});
    await p.fill('[data-bind="cp.nm.0.name"]','Maria Lopez'); await p.click('[data-action="add-cp"][data-a="nm"]').catch(()=>{});
    await p.evaluate(() => scrollTo(0,0)); await p.waitForTimeout(200);
    await p.screenshot({ path: `test/out7/${n}-top.png` });
    await p.locator('#cp-groups').screenshot({ path: `test/out7/${n}-lists.png` });
    await ctx.close();
  }
  await b.close();
})();
