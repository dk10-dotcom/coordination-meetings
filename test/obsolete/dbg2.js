const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.click('[data-action="conducting"][data-a="other"]'); await p.fill('#conducting-other', 'Bro. Example');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Example Person B');
  await p.click('.btn-save'); await p.waitForTimeout(500);
  await p.click('.clear-link'); await p.click('#confirm-primary'); await p.waitForTimeout(200);
  await p.click('[data-action="conducting"][data-a="wml"]');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])');
  await p.locator('.agenda-entry').filter({ hasText: 'November 1' }).locator('[data-action="open-agenda"]').first().click();
  await p.waitForTimeout(300);
  console.log('confirm visible', await p.isVisible('#confirm-sheet'), await p.textContent('#confirm-title').catch(()=>''));
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForTimeout(300);
  console.log('pressed:', await p.$$eval('#conduct-seg [aria-pressed="true"]', bs => bs.map(b => b.dataset.a)), 'other:', await p.inputValue('#conducting-other'), 'name:', await p.inputValue('[data-bind="cp.nm.0.name"]'));
  await b.close();
})();
