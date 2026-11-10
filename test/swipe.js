// Swipe down closes pop-up sheets; a short drag snaps back; scrolled-down help scrolls first.
const { chromium, devices } = require('playwright');

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip');
  const cdp = await ctx.newCDPSession(p);
  async function swipe(y0, y1, ms = 300, steps = 12) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: y0 + (y1 - y0) * i / steps }] }); await p.waitForTimeout(ms / steps); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(400);
  }
  ok('no label above Load last week', (await p.$$('.start-label')).length === 0);
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForSelector('#help-sheet:not([hidden])');
  const top = await p.$eval('#help-sheet .sheet', s => s.getBoundingClientRect().top);
  await swipe(top + 30, top + 80, 400);
  ok('short drag snaps back, help stays open', await p.isVisible('#help-sheet') && (await p.$eval('#help-sheet .sheet', s => s.style.transform)) === '');
  await p.$eval('#help-sheet .sheet', s => { s.scrollTop = 300; });
  await swipe(top + 60, top + 300, 300);
  const st = await p.$eval('#help-sheet .sheet', s => s.scrollTop);
  ok('scrolled down: swiping down scrolls up first, stays open', await p.isVisible('#help-sheet') && st < 300, 'scrollTop ' + st);
  await p.$eval('#help-sheet .sheet', s => { s.scrollTop = 0; });
  await swipe(top + 30, top + 330, 300);
  ok('swipe down closes How to use', await p.isHidden('#help-sheet'));
  ok('page scrolling unlocked after close', (await p.evaluate(() => document.body.style.overflow)) === '');
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForSelector('#help-sheet:not([hidden])');
  ok('reopens in place, not stuck off-screen', (await p.$eval('#help-sheet .sheet', s => s.style.transform)) === '' && await p.isVisible('#help-title'));
  await p.click('[data-action="close-help"]');
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez');
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  await p.$eval('#send-sheet .sheet', s => { s.scrollTop = 0; }); await p.waitForTimeout(100);
  const t2 = await p.$eval('#send-sheet .sheet', s => s.getBoundingClientRect().top);
  await swipe(t2 + 20, t2 + 320, 250);
  ok('swipe down closes the Send sheet too, form kept', await p.isHidden('#send-sheet') && (await p.inputValue('[data-bind="cp.nm.0.name"]')) === 'Maria Lopez');
  await p.click('.clear-link'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  const t3 = await p.$eval('#confirm-sheet .sheet', s => s.getBoundingClientRect().top);
  await swipe(t3 + 20, t3 + 320, 250);
  ok('swipe down on Clear? cancels without clearing', await p.isHidden('#confirm-sheet') && (await p.inputValue('[data-bind="cp.nm.0.name"]')) === 'Maria Lopez');
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
