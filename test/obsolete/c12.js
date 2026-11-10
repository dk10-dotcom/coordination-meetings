const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const ctx = await b.newContext({ ...devices[d] }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(()=>{});
    const fit = await p.$$eval('[data-group="rm"] input[data-bind$=".name"], [data-group="rm"] input[data-bind$=".need"]', is => is.map(i => { const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(i); c.font = cs.fontSize + ' ' + cs.fontFamily; const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); return [i.placeholder, Math.round(c.measureText(i.placeholder).width), Math.round(i.clientWidth - pad)]; }));
    console.log(n, JSON.stringify(fit));
    console.log(n, 'instructions gone:', (await p.$$('#h-plan ~ * .instructions, section[aria-labelledby="h-plan"] .instructions')).length === 0);
    await p.click('[data-group="rm"] .sac-toggle'); await p.waitForTimeout(200);
    console.log(n, 'toast:', await p.textContent('#toast'), await p.isVisible('#toast'));
    if (n === 'i13') { await p.locator('section[aria-labelledby="h-plan"]').screenshot({ path: 'test/out12/plan.png', clip: undefined }); }
    await ctx.close(); }
  await b.close(); })();
