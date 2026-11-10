const { chromium, devices } = require('playwright');

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip');
  await p.fill('#ward','Riverton 5th Ward');
  await p.type('[data-bind="cp.rm.0.name"]','Tom Hale');
  console.log('live count:', await p.textContent('.list-rm .list-count'));
  await p.fill('[data-bind="cp.rm.0.action"]','Visit Tuesday');
  await p.fill('[data-bind="cp.nm.0.name"]','Maria Lopez'); await p.fill('[data-bind="cp.nm.0.action"]','Invite to dinner');
  await p.fill('[data-bind="cp.bt.0.name"]','Sam Ortiz'); await p.fill('[data-bind="cp.bt.0.action"]','Sit together');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await dl.saveAs('test/out7/a.pdf');
  await b.close();
})();
