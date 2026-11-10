const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

const OUT = __dirname + '/out13';
const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to dinner');
  await p.fill('[data-bind="cp.rm.0.name"]', 'Tom Hale'); await p.fill('[data-bind="cp.rm.0.action"]', 'Visit Tuesday');
  await p.click('.btn-save'); await p.waitForTimeout(400); await p.click('.clear-link'); await p.click('#confirm-primary');
  await p.fill('#date', '2026-11-08');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
  ok('Done button under Return and Report', await p.isVisible('#rr-foot [data-action="list-done"][data-a="rr"]'));
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
  await p.click('[data-action="list-done"][data-a="rr"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok('warns when an item isn’t marked', (await p.textContent('#confirm-title')) === '1 item isn’t marked yet');
  await p.click('#confirm-secondary'); await p.waitForTimeout(150);
  ok('Keep working leaves it open', (await p.$$('#rr-list .rr-card')).length === 2);
  await p.click('[data-action="happened"][data-a="1"][data-b="No"]'); await p.fill('[data-bind="rr.1.notes"]', 'He was out of town');
  await p.click('[data-action="list-done"][data-a="rr"]'); await p.waitForTimeout(300);
  const rows = await p.$$eval('#rr-list .fold-row', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok('folds to one line per item with answer and notes', rows.length === 2 && rows[0].includes('Maria Lopez') && rows[0].includes('Yes') && rows[1].includes('No') && rows[1].includes('Notes: He was out of town'), JSON.stringify(rows));
  ok('Add item and Done hidden while folded', await p.isHidden('#rr-foot'));
  ok('loaded banner still shown', await p.isVisible('#loaded-banner'));
  await p.locator('#rr-list').screenshot({ path: OUT + '/rr-folded.png' });
  await p.reload(); await p.waitForSelector('.chip');
  ok('stays folded after reload', (await p.$$('#rr-list .is-folded')).length === 1);
  await p.click('#rr-list .fold-head'); await p.waitForTimeout(200);
  ok('reopens with answers and notes kept', (await p.$$('#rr-list .rr-card')).length === 2 && (await p.inputValue('[data-bind="rr.1.notes"]')) === 'He was out of town' && await p.isVisible('#rr-foot'));
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
