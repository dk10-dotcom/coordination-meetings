// The ward name is set from the opening screen: tap it in the header card, type, Done. Huddle Details has no ward box.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  for (const [dev, tag] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const c = await b.newContext({ ...devices[dev] });
    await c.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); } catch (e) {} });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok((await p.textContent('#start-ward')) === 'Tap to add your ward' && await p.isVisible('.start-ward.is-empty'), tag + ': with no ward, the header card says Tap to add your ward');
    await p.click('.start-ward'); await p.waitForTimeout(300);
    ok(await p.isVisible('#ward-sheet') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'ward'), tag + ': tapping it opens Your ward with the box ready to type');
    await p.keyboard.type('Sample Ward'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok(await p.isHidden('#ward-sheet') && (await p.textContent('#start-ward')) === 'Sample Ward' && !(await p.isVisible('.start-ward.is-empty')), tag + ': Done on the keyboard closes it and the card shows the ward');
    await p.click('.start-ward'); await p.waitForTimeout(300); await p.fill('#ward', 'Sample Ward 2'); await p.click('[data-action="close-ward"]'); await p.waitForTimeout(300);
    ok((await p.textContent('#start-ward')) === 'Sample Ward 2', tag + ': it can be changed the same way');
    await p.reload(); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok((await p.textContent('#start-ward')) === 'Sample Ward 2', tag + ': it is kept after reopening');
    await p.click('.door-hd'); await p.waitForTimeout(300);
    ok((await p.textContent('#hd-hero .hero-ward')) === 'Sample Ward 2', tag + ': the Huddle’s header card shows it');
    await p.click('#details-summary'); await p.waitForTimeout(300);
    ok(!(await p.isVisible('#details-full #ward')) && (await p.locator('#details-full input[data-bind="ward"]').count()) === 0, tag + ': Huddle Details has no ward box');
    ok(errs.length === 0 && await fits(), tag + ': no errors; fits the screen ' + errs.join('; '));
    await c.close();
  }
  await b.close(); console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
