// Simulates an iPhone with a share menu to test Save a copy -> Share -> auto-clear.
const { chromium, devices } = require('playwright');

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = __dirname + '/out';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => {
    window.__shares = [];
    navigator.canShare = (d) => !!(d && d.files);
    navigator.share = (d) => { window.__shares.push(d.files.map(f => f.name + ' ' + f.size)); return Promise.resolve(); };
  });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  await page.goto('http://127.0.0.1:8765/#huddle');
  await page.waitForSelector('#attendee-list .chip');
  // Send with no ward -> prompt
  await page.fill('#ward', '');
  await page.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => page.click('.actionbar [data-action="send"]')).then(() => sendAnyway(page));
  console.log('no-ward prompt:', await page.textContent('#confirm-title'));
  await page.click('#confirm-primary');
  await page.fill('#ward', 'Riverton 3rd Ward');
  await page.fill('[data-bind="cp.rm.0.name"]', 'Jake Hill');
  await page.fill('[data-bind="cp.rm.0.action"]', 'Invite to priesthood meeting');
  await page.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => page.click('.actionbar [data-action="send"]')).then(() => sendAnyway(page));
  await page.waitForSelector('#save-btn:not([disabled])');
  console.log('share disabled before save:', await page.isDisabled('#share-btn'));
  console.log('save hint:', await page.textContent('#save-hint'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/07-ios-send.png' });
  await page.click('#save-btn');
  await page.waitForSelector('#share-btn:not([disabled])');
  console.log('after save:', await page.textContent('#save-hint'));
  await page.click('#share-btn');
  await page.waitForSelector('#send-sheet', { state: 'hidden' });
  console.log('shares:', JSON.stringify(await page.evaluate(() => window.__shares)));
  console.log('cleared:', (await page.inputValue('[data-bind="cp.rm.0.name"]')) === '', 'toast:', await page.textContent('#toast'));
  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
