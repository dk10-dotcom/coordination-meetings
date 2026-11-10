const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const ctx = await b.newContext({ ...devices[d], acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
    await p.fill('[data-bind="cp.nm.0.name"]', 'Ana Ruiz'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Endowment'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite');
    await p.fill('[data-bind="cp.rm.0.name"]', 'Bartholomew Montgomery-Fitzgerald'); await p.fill('[data-bind="cp.rm.0.ordinance"]', 'Temple recommend'); await p.fill('[data-bind="cp.rm.0.action"]', 'Visit');
    await p.click('.btn-save'); await p.waitForTimeout(400); await p.click('.clear-link'); await p.click('#confirm-primary');
    await p.fill('#date', '2026-11-08');
    await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
    const pos = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => { const n = c.querySelector('.card-person'), cr = c.getBoundingClientRect(), nr = n.getBoundingClientRect(); return { name: n.textContent.trim(), inside: nr.right <= cr.right + 1 }; }));
    ok(n + ': name in the card header', pos[0].name === 'Ana Ruiz', JSON.stringify(pos[0]));
    ok(n + ': long name stays inside the card', pos[1].name === 'Bartholomew Montgomery-Fitzgerald' && pos[1].inside, JSON.stringify(pos[1]));
    await p.locator('#rr-list').screenshot({ path: `test/out10/${n}-rrline.png` });
    console.log('PROBLEMS:', errs.length ? errs : 'none'); await ctx.close();
  }
  console.log(`${res.filter(Boolean).length}/${res.length} checks passed`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
