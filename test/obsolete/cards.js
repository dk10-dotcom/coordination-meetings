// Card styling: Three Names panel, Return and Report colors by list and by answer, numbered cards, PDF colors.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const OUT = __dirname + '/out8'; require('fs').mkdirSync(OUT, { recursive: true });
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]');
  ok('Three Names is its own amber panel', (await p.$$('#tn-list > .list-panel.list-tn')).length === 1);
  await p.type('[data-bind="tn.0.name"]', 'Ana Ruiz');
  ok('Three Names count updates live', (await p.textContent('.list-tn .list-count')) === '1 of 3 names');
  ok('every card has a numbered circle', (await p.$$('#cp-groups .card .card-num')).length === 3 && (await p.$$('#tn-list .card .card-num')).length === 3);
  // week 1
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to dinner');
  await p.fill('[data-bind="cp.rm.0.name"]', 'Tom Hale'); await p.fill('[data-bind="cp.rm.0.action"]', 'Visit Tuesday');
  await p.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz'); await p.fill('[data-bind="cp.bt.0.action"]', 'Sit together');
  await p.fill('[data-bind="tn.0.ordinance"]', 'Endowment'); await p.fill('[data-bind="tn.0.action"]', 'Temple prep');
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  await p.evaluate(() => { navigator.canShare = () => false; });
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d1.saveAs(OUT + '/w1.pdf');
  await p.click('#confirm-primary', { timeout: 3000 }).catch(() => {});
  // week 2
  await p.fill('#date', '2026-11-08');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row');
  await p.waitForSelector('#loaded-banner:not([hidden])');
  const cls = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => c.className));
  ok('Return and Report cards colored by list', ['g-nm','g-rm','g-bt','g-tn'].every((g, i) => cls[i] && cls[i].includes(g)), JSON.stringify(cls));
  ok('list tags shown', (await p.$$eval('#rr-list .group-tag', t => t.map(x => x.textContent))).join('|') === 'New members|Returning members|Those being taught|Name Next Ordinance');
  const stripes = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => getComputedStyle(c).borderLeftColor));
  ok('four different stripe colors', new Set(stripes).size === 4, stripes.join(' '));
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
  await p.click('[data-action="happened"][data-a="1"][data-b="Partly"]');
  await p.click('[data-action="happened"][data-a="2"][data-b="No"]');
  const bgs = await p.$$eval('#rr-list .rr-card', cs => cs.map(c => getComputedStyle(c).backgroundColor));
  ok('cards fill green / amber / red by answer', bgs[0] === 'rgb(234, 245, 238)' && bgs[1] === 'rgb(255, 246, 224)' && bgs[2] === 'rgb(251, 234, 234)' && bgs[3] === 'rgb(255, 255, 255)', bgs.join(' '));
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
  ok('tapping again clears the color', (await p.getAttribute('#rr-list .rr-card >> nth=0', 'data-status')) === '');
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
  await p.reload(); await p.waitForSelector('.chip');
  ok('answer colors survive reload', (await p.$$eval('#rr-list .rr-card', cs => cs.map(c => c.dataset.status))).slice(0, 3).join(',') === 'yes,partly,no');
  await p.locator('#rr-list').scrollIntoViewIfNeeded(); await p.locator('#rr-list').screenshot({ path: OUT + '/rr.png' });
  await p.locator('#tn-list').screenshot({ path: OUT + '/tn.png' });
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await d2.saveAs(OUT + '/w2.pdf');
  ok('week 2 PDF is at most two pages', /Pages:\s+[12]\b/.test(execFileSync('pdfinfo', [OUT + '/w2.pdf']).toString()));
  execFileSync('pdftoppm', ['-r', '90', '-png', '-singlefile', OUT + '/w2.pdf', OUT + '/w2']);
  console.log('PROBLEMS:', errs.length ? errs : 'none'); console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
