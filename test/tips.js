// Tips button: opens Principles + Prepare ahead tip; closes like How to use; gone from page bottom, help sheet and PDF.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out10'; require('fs').mkdirSync(OUT, { recursive: true });

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const ctx = await b.newContext({ ...devices[d], acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/${n}-top.png`, clip: { x: 0, y: 0, width: devices[d].viewport.width, height: 260 } });
    if (n === 'se') { ok('SE: one Tips button, on the Huddle screen (placement is checked in twodoor.js)', await p.locator('#steps-home .huddle-tips').count() === 1 && await p.locator('.top-buttons [data-action="tips"]').count() === 0); await ctx.close(); continue; }
    ok('Tips lives on the Huddle screen; How to use is the only button at the top', await p.locator('#steps-home .huddle-tips').count() === 1 && (await p.$$eval('.top-buttons .help-link', bs => bs.map(x => x.textContent.trim()))).join('|') === 'How to use');
    ok('principles no longer at bottom of page', (await p.$$('details.principles')).length === 0);
    await p.evaluate(() => document.querySelector('[data-action="tips"]').click()); await p.waitForSelector('#tips-sheet:not([hidden])');
    ok('Tips opens Principles for Effective Coordination', (await p.textContent('#tips-title')) === 'Principles for Effective Coordination' && (await p.$$('#tips-sheet .principle-list li')).length === 5);
    ok('Prepare ahead tip is in Tips', (await p.textContent('#tips-sheet')).includes('Open the agenda before the meeting starts; ward council has already updated the names and needs'));
    await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/tips.png` });
    await p.click('[data-action="close-tips"]'); ok('Got it closes', await p.isHidden('#tips-sheet'));
    await p.evaluate(() => document.querySelector('[data-action="tips"]').click()); await p.keyboard.press('Escape'); ok('Escape closes', await p.isHidden('#tips-sheet'));
    await p.evaluate(() => document.querySelector('[data-action="tips"]').click()); await p.mouse.click(195, 30); ok('tapping outside closes', await p.isHidden('#tips-sheet'));
    const cdp = await ctx.newCDPSession(p);
    await p.evaluate(() => document.querySelector('[data-action="tips"]').click()); await p.waitForSelector('#tips-sheet:not([hidden])');
    const top = await p.$eval('#tips-sheet .sheet', s => s.getBoundingClientRect().top);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: top + 20 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: top + 20 + 25 * i }] }); await p.waitForTimeout(20); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
    ok('swipe down closes Tips', await p.isHidden('#tips-sheet'));
    await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForSelector('#help-sheet:not([hidden])');
    ok('Tip removed from How to use', !(await p.textContent('#help-sheet')).includes('Prepare ahead') && (await p.$$('#help-sheet .help-tip')).length === 0);
    await p.click('[data-action="close-help"]');
    await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez');
    await p.evaluate(() => { navigator.canShare = () => false; });
    await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await dl.saveAs(OUT + '/a.pdf');
    ok('PDF has no Principles section', !execFileSync('pdftotext', ['-raw', OUT + '/a.pdf', '-']).toString().includes('Principles'));
    console.log('PROBLEMS:', errs.length ? errs : 'none');
    await ctx.close();
  }
  console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
