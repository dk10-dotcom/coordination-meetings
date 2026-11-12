const { chromium, devices } = require('playwright');
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const c = await b.newContext({ ...devices[dev] });
    await c.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    await p.evaluate(() => document.querySelector('.title-row [data-action="help"]').click()); await p.waitForSelector('#help-sheet:not([hidden])');
    await p.click('[data-action="sample"]'); await p.waitForSelector('#sample-sheet:not([hidden])');
    await p.waitForFunction(() => [...document.querySelectorAll('.sample-page')].every(i => i.complete && i.naturalWidth > 0));
    ok(await p.evaluate(() => { const i = [...document.querySelectorAll('.sample-page')]; return i.length === 4 && i.every(x => x.naturalWidth === 900 && x.naturalHeight === 1950); }), dev + ' four phone-shaped sample pages');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && [...document.querySelectorAll('.sample-page')].every(x => x.getBoundingClientRect().right <= window.innerWidth)), dev + ' sample pages fit the screen width');
    ok(await p.evaluate(() => { const r = document.querySelector('.sample-close').getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!el.closest('.sample-close'); }), dev + ' close button on top');
    await p.screenshot({ path: `test/out-sample/${tag}-top.png` });
    await p.evaluate(() => { const s = document.querySelector('#sample-sheet .sheet'); s.scrollTop = 900; });
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const r = document.querySelector('.sample-close').getBoundingClientRect(); return r.top >= 0 && r.top < 80; }), dev + ' close button stays visible while scrolling');
    await p.screenshot({ path: `test/out-sample/${tag}-scrolled.png` });
    await p.click('.sample-close');
    ok(await p.isHidden('#sample-sheet') && await p.isVisible('#help-sheet'), dev + ' close returns to How to use');
    await p.click('[data-action="sample"]'); await p.keyboard.press('Escape');
    ok(await p.isHidden('#sample-sheet') && await p.isVisible('#help-sheet'), dev + ' Escape closes only the sample');
    await p.click('[data-action="sample"]'); await p.click('#sample-sheet .btn-primary');
    ok(await p.isHidden('#sample-sheet'), dev + ' bottom button closes');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await c.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
