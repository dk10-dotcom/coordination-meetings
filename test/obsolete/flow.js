// New flow features: Start here placement, collapsing intro, date default, carry forward,
// Open to edit, Share again, Clear link, recipients note, iPhone banner wording, RR time on PDF.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = __dirname + '/out4';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/#huddle';
const res = [];
const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const pos = (p, a, b) => p.evaluate(([a, b]) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING), [a, b]);

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { window.__shares = []; navigator.canShare = d => !!(d && d.files); navigator.share = d => { window.__shares.push(d.files[0].name); return Promise.resolve(); }; });
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push(e.message));
  await p.goto(BASE); await p.waitForSelector('.chip');

  // Layout
  ok('Who/What and How/When boxes sit at the top, always visible', await pos(p, '.meeting-time', '.info-pair') && await pos(p, '.info-pair', '#ward') && await p.isVisible('.info-pair .info-card.blue') && await p.isVisible('.info-pair .info-card.orange') && (await p.$$('#about')).length === 0);
  ok('Load last week sits under Attendees, above Return and Report', await pos(p, '#attendee-list', '#load-panel') && await pos(p, '#load-panel', '#h-rr'));
  ok('conducting note removed (it lives in How to use)', (await p.$$('.conduct-note')).length === 0 && (await p.textContent('#help-sheet')).includes('Who uses this agenda'));
  ok('no label above Load last week', (await p.$$('.start-label')).length === 0);
  ok('three lists are separate panels', (await p.$$('#cp-groups > .list-panel')).length === 3 && (await p.$$eval('#cp-groups > .list-panel', ps => new Set(ps.map(x => getComputedStyle(x).backgroundColor)).size)) === 3);
  ok('total time shown', (await p.textContent('.meeting-time')) === 'About 15 minutes');
  ok('no per-section times on the page', (await p.$$('.section .time')).length === 0 && !/\b5 min\b/.test(await p.textContent('body')));
  ok('Clear is a text link, not in the bottom bar', (await p.$$('.actionbar [data-action="clear"]')).length === 0 && await p.isVisible('.clear-link'));
  ok('bottom bar has Save without sending + Send & Clear', (await p.textContent('.actionbar')).replace(/\s+/g, ' ').trim() === 'Save without sending Send & Clear');
  ok('iPhone banner says add first', (await p.textContent('#install-banner .install-title')) === 'Add to Home Screen first');
  ok('date hint shown', (await p.textContent('#date-hint')).includes('Make sure this is the meeting date'));
  await p.screenshot({ path: OUT + '/top.png' });

  // Week 1: fill and send (date a Sunday)
  await p.click('[data-action="dismiss-install"]');
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Maria Lopez'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite to RS dinner'); await p.fill('[data-bind="cp.nm.0.assigned"]', 'Sister Jensen');
  await p.fill('[data-bind="cp.bt.0.name"]', 'Sam Ortiz'); await p.fill('[data-bind="cp.bt.0.action"]', 'Sit together at church'); await p.fill('[data-bind="cp.bt.0.assigned"]', 'Bro. Lee');
  await p.fill('[data-bind="tn.0.name"]', 'Ana Ruiz'); await p.fill('[data-bind="tn.0.ordinance"]', 'Endowment'); await p.fill('[data-bind="tn.0.action"]', 'Temple prep class'); await p.fill('[data-bind="tn.0.assigned"]', 'Bishop');
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  ok('send sheet shows recipient reminder', (await p.textContent('#send-recipients')).includes('elders quorum representative, the full-time missionaries, and the stake presidency'));
  await p.waitForTimeout(250); await p.screenshot({ path: OUT + '/send.png' });
  await p.click('#share-btn'); await p.waitForSelector('#send-sheet', { state: 'hidden' });

  // Date default moves to the usual meeting weekday (Sunday)
  const def = await p.inputValue('#date');
  ok('date defaults to the usual meeting day (a Sunday)', new Date(def + 'T12:00').getDay() === 0, def);

  // Week 2: load, mark Partly/No, carry forward
  await p.fill('#date', '2026-11-08');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])');
  ok('saved agenda shows Open to edit and Share again', (await p.$$('[data-action="open-agenda"]')).length === 1 && (await p.$$('[data-action="share-agenda"]')).length === 1);
  await p.waitForTimeout(250); await p.screenshot({ path: OUT + '/load-list.png' });
  await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
  const cards = await p.$$('#rr-list .card');
  await p.click('[data-action="happened"][data-a="0"][data-b="Partly"]');   // Maria (New members)
  await p.click('[data-action="happened"][data-a="1"][data-b="No"]');       // Sam (Being taught)
  await p.click('[data-action="happened"][data-a="2"][data-b="No"]');       // Ana (Three Names)
  ok('Carry forward buttons appear on Partly/No', (await p.$$('[data-action="carry-fwd"]')).length === 3, `${cards.length} cards`);
  await p.locator('#rr-list .card').nth(0).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.locator('#rr-list .card').nth(0).screenshot({ path: OUT + '/carry-card.png' });
  await p.click('[data-action="carry-fwd"][data-a="0"]');
  await p.click('[data-action="carry-fwd"][data-a="1"]');
  await p.click('[data-action="carry-fwd"][data-a="2"]');
  const vals = c => ['name', 'action', 'assigned'].map(k => c.querySelector('input[data-bind$=".' + k + '"]').value);
  const nm = await p.$$eval('[data-group="nm"] .card', cs => cs.map(c => ['name', 'action', 'assigned'].map(k => c.querySelector('input[data-bind$=".' + k + '"]').value)));
  const bt = await p.$$eval('[data-group="bt"] .card', cs => cs.map(c => ['name', 'action', 'assigned'].map(k => c.querySelector('input[data-bind$=".' + k + '"]').value)));
  ok('carried into New members (no duplicate card)', nm.length === 1 && nm[0][0] === 'Maria Lopez' && nm[0][1] === 'Invite to RS dinner' && nm[0][2] === 'Sister Jensen', JSON.stringify(nm));
  ok('carried into Those being taught', bt.length === 1 && bt[0][0] === 'Sam Ortiz' && bt[0][1] === 'Sit together at church', JSON.stringify(bt));
  ok('carried into Three Names with ordinance', (await p.inputValue('[data-bind="tn.0.name"]')) === 'Ana Ruiz' && (await p.inputValue('[data-bind="tn.0.ordinance"]')) === 'Endowment' && (await p.inputValue('[data-bind="tn.0.action"]')) === 'Temple prep class');
  ok('cards show "Added to this week’s plan"', (await p.$$('.carried-note')).length === 3);

  // Save without sending, reload: carry state survives the draft
  await p.reload(); await p.waitForSelector('.chip');
  ok('carried state survives a reload', (await p.$$('.carried-note')).length === 3);

  // Open to edit replaces the form with the saved agenda
  await freshWeek(p); await p.click('[data-action="load"]').catch(() => {});
  await p.click('[data-action="unload"]').catch(() => {});
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])');
  await p.click('[data-action="open-agenda"]');
  if (await p.isVisible('#confirm-sheet')) { ok('asks before replacing the form', (await p.textContent('#confirm-title')) === 'Replace what’s on the form?'); await p.click('#confirm-primary'); }
  await p.waitForTimeout(200);
  ok('Open to edit restores the whole agenda', (await p.inputValue('#date')) === '2026-11-01' && (await p.inputValue('[data-bind="cp.nm.0.name"]')) === 'Maria Lopez' && (await p.inputValue('[data-bind="tn.0.ordinance"]')) === 'Endowment');

  // Share again: shares the saved PDF, leaves the form alone
  const before = await p.inputValue('[data-bind="cp.nm.0.name"]');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])');
  await p.click('[data-action="share-agenda"]'); await p.waitForSelector('#share-btn:not([disabled])');
  ok('Share again sheet title', (await p.textContent('#send-title')) === 'Share this agenda again');
  await p.click('#share-btn'); await p.waitForSelector('#send-sheet', { state: 'hidden' });
  const shares = await p.evaluate(() => window.__shares);
  ok('Share again shared the PDF', shares[shares.length - 1] === 'Huddle - Riverton 5th Ward - 2026-11-01.pdf', shares.join(', '));
  ok('Share again left the form alone', (await p.inputValue('[data-bind="cp.nm.0.name"]')) === before);

  // Clear link still asks first
  await p.click('.clear-link');
  ok('Clear asks first', (await p.textContent('#confirm-title')) === 'Clear the whole form?');
  await p.click('#confirm-secondary');

  // Boxes stay visible on later visits
  await p.reload(); await p.reload(); await p.waitForSelector('.chip');
  ok('boxes still visible after several visits', await p.isVisible('.info-pair'));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: OUT + '/top-later.png' });

  // PDF has the Return and Report time
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  await p.click('[data-action="close-send"]');
  const ctx2 = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true });
  const p2 = await ctx2.newPage(); await p2.goto(BASE); await p2.waitForSelector('.chip');
  await p2.fill('#ward', 'Riverton 5th Ward'); await p2.fill('[data-bind="rr.0.plan"]', 'x');
  await p2.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p2.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p2)); await p2.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p2.waitForEvent('download'), p2.click('#share-btn')]); await dl.saveAs(OUT + '/rr.pdf');
  ok('PDF has no per-section times', !/5 min/.test(execFileSync('pdftotext', ['-raw', OUT + '/rr.pdf', '-']).toString()));

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
