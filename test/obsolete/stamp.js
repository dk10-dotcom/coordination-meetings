const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  for (const d of ['2026-11-01', '2026-11-08']) {
    await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', d); await p.fill('[data-bind="cp.nm.0.name"]', 'Maria ' + d);
    await p.click('[data-action="save-only"], .btn-save'); await p.waitForTimeout(400);
    await p.click('.clear-link'); await p.click('#confirm-primary'); await p.waitForTimeout(200);
  }
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.waitForTimeout(250);
  const t = await p.$$eval('.agenda-row-time', s => s.map(x => x.textContent));
  ok('each saved agenda shows when it was saved', t.length === 2 && t.every(x => /^Saved today, \d{1,2}:\d{2}\s?(AM|PM)$/.test(x)), t.join(' | '));
  await p.locator('#load-sheet .sheet').screenshot({ path: 'test/out10/load.png' });
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
