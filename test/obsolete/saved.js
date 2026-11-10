// Tests saved agendas, empty state, retention, Clear wiping ward, keyboard bar, iPhone banner + share.
const { chromium, devices } = require('playwright');
const fs = require('fs');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = __dirname + '/out2';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/';
const ok = (label, cond) => console.log((cond ? 'PASS ' : 'FAIL ') + label);

async function fill(page, ward, date, name) {
  await page.fill('#ward', ward);
  await page.fill('#date', date);
  await page.click('#attendee-list .chip:has-text("Relief Society")');
  await page.fill('[data-bind="cp.nm.0.name"]', name);
  await page.fill('[data-bind="cp.nm.0.action"]', 'Invite to the ward activity');
  await page.fill('[data-bind="cp.nm.0.assigned"]', 'Sister Jensen');
  await page.fill('[data-bind="tn.0.name"]', 'Ana Ruiz');
  await page.fill('[data-bind="tn.0.action"]', 'Schedule temple prep class');
}
async function sendDownload(page) {
  await page.click('[data-action="send"]').then(() => sendAnyway(page));
  await page.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#share-btn')]);
  const p = `${OUT}/${dl.suggestedFilename()}`; await dl.saveAs(p);
  await page.waitForSelector('#after-download:not([hidden])');
  await page.click('[data-action="clear-now"]');
  await page.waitForTimeout(200); if (await page.isVisible('#confirm-primary')) await page.click('#confirm-primary');
  return p;
}

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const watch = (page) => {
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    page.on('request', r => { if (!r.url().startsWith(BASE) && !/^(blob|data):/.test(r.url())) problems.push('OUTSIDE: ' + r.url()); });
  };

  // ---- Android-like browser without a file share menu (download path)
  const ctx = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); watch(page);
  await page.goto(BASE); await page.waitForSelector('#attendee-list .chip');

  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#confirm-sheet:not([hidden])');
  ok('empty state message', (await page.textContent('#confirm-title')) === 'No saved agendas yet' && (await page.textContent('#confirm-primary')).includes('practice week'));
  await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/01-empty.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  ok('install banner shown on Android', await page.isVisible('#install-banner'));

  // keyboard: bar stops floating while typing
  await page.focus('#ward');
  ok('bar static while typing', (await page.evaluate(() => getComputedStyle(document.querySelector('.actionbar')).position)) === 'static');
  await page.focus('[data-action="send"]'); await page.waitForTimeout(250);
  ok('bar sticky after typing', (await page.evaluate(() => getComputedStyle(document.querySelector('.actionbar')).position)) === 'sticky');

  await fill(page, 'Riverton 5th Ward', '2026-11-01', 'Maria Lopez');
  const pdf1 = await sendDownload(page);
  ok('ward kept after Send & Clear', (await page.inputValue('#ward')) === 'Riverton 5th Ward');

  await page.fill('#date', '2026-11-08');
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#load-sheet:not([hidden])');
  ok('one saved agenda listed', (await page.$$('.agenda-row')).length === 1);
  await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/02-list.png` });
  await page.click('.agenda-row');
  await page.waitForSelector('#loaded-banner:not([hidden])');
  ok('loaded 2 cards from saved agenda', (await page.$$('#rr-list .card')).length === 2);
  ok('banner label', (await page.textContent('#loaded-sub')).startsWith('Saved on this phone · Nov 1, 2026'));

  // ward check with saved agenda
  await page.click('[data-action="unload"]');
  await page.fill('#ward', 'Riverton 2nd Ward');
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#load-sheet:not([hidden])');
  await page.click('.agenda-row');
  await page.waitForSelector('#confirm-sheet:not([hidden])');
  ok('ward check from saved list', (await page.textContent('#confirm-title')) === 'This agenda is from a different ward');
  await page.click('#confirm-primary'); // choose a different one -> list reopens
  await page.waitForSelector('#load-sheet:not([hidden])');
  ok('choose different reopens list', true);
  await page.click('[data-action="close-load"]');

  // load from a file fallback
  await page.fill('#ward', 'Riverton 5th Ward');
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#load-sheet:not([hidden])');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="load-file"]')]);
  await fc.setFiles(pdf1);
  await page.waitForSelector('#loaded-banner:not([hidden])');
  ok('load from file still works', (await page.textContent('#loaded-sub')).includes('Huddle - Riverton 5th Ward - 2026-11-01.pdf'));

  // Clear wipes ward (and the remembered ward)
  await page.click('[data-action="clear"]');
  await page.click('#confirm-primary');
  ok('Clear erases ward', (await page.inputValue('#ward')) === '');
  await page.reload(); await page.waitForSelector('#attendee-list .chip');
  ok('ward forgotten after reload', (await page.inputValue('#ward')) === '');

  // retention: send 5 weeks, keep 4
  for (const d of ['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']) {
    await fill(page, 'Riverton 5th Ward', d, 'Person ' + d);
    await sendDownload(page);
  }
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#load-sheet:not([hidden])');
  const titles = await page.$$eval('.agenda-row-title', els => els.map(e => e.textContent));
  ok('keeps newest 4 only', titles.length === 4 && titles[0].includes('November 29') && !titles.some(t => t.includes('November 1,')));
  await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/03-list4.png` });

  // resend same date replaces, not duplicates
  await page.click('[data-action="close-load"]');
  await fill(page, 'Riverton 5th Ward', '2026-11-29', 'Changed Name');
  await sendDownload(page);
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#load-sheet:not([hidden])');
  ok('same week replaced, still 4', (await page.$$('.agenda-row')).length === 4);

  // delete all
  await page.click('[data-action="delete-all"]');
  await page.click('#confirm-primary');
  await page.waitForTimeout(300);
  await freshWeek(page); await page.click('[data-action="load"]');
  await page.waitForSelector('#confirm-sheet:not([hidden])');
  ok('delete all empties list', (await page.textContent('#confirm-title')) === 'No saved agendas yet');
  await ctx.close();

  // ---- iPhone in Safari with a share menu
  const ictx = await browser.newContext({ ...devices['iPhone 13'] });
  await ictx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ictx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
  await ictx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ictx.addInitScript(() => {
    navigator.canShare = (d) => !!(d && d.files);
    navigator.share = () => Promise.resolve();
  });
  const ip = await ictx.newPage(); watch(ip);
  await ip.goto(BASE); await ip.waitForSelector('#attendee-list .chip');
  ok('iPhone banner shown in Safari', await ip.isVisible('#install-banner'));
  await ip.waitForTimeout(200); await ip.screenshot({ path: `${OUT}/04-iphone-banner.png` });
  await fill(ip, 'Riverton 3rd Ward', '2026-11-01', 'Jake Hill');
  await ip.click('[data-action="send"]').then(() => sendAnyway(ip));
  await ip.waitForSelector('#share-btn:not([disabled])');
  await ip.waitForTimeout(300); await ip.screenshot({ path: `${OUT}/05-iphone-send.png` });
  await ip.click('#share-btn');
  await ip.waitForSelector('#send-sheet', { state: 'hidden' });
  ok('iPhone share toast', (await ip.textContent('#toast')) === 'Shared and saved. The form is cleared for next week.');
  await ip.fill('#date', '2026-11-08');
  await freshWeek(ip); await ip.click('[data-action="load"]');
  await ip.waitForSelector('#load-sheet:not([hidden])');
  ok('iPhone saved agenda listed', (await ip.$$('.agenda-row')).length === 1);
  await ip.click('[data-action="dismiss-install"]').catch(() => {});

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
