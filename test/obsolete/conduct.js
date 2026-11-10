// Conducting choice: select, Other text, remembered, on the PDF, survives Open to edit; Important note gone.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = __dirname + '/out6'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/#huddle';
const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const pdfText = f => execFileSync('pdftotext', ['-raw', f, '-']).toString();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('.chip');
  await p.click('[data-action="dismiss-install"]');
  ok('Important note removed from the page', !(await p.textContent('body')).includes('Follow-Through Report'));
  ok('Conducting sits right under Ward and Date', await p.evaluate(() => !!(document.querySelector('#date').compareDocumentPosition(document.querySelector('#conduct-seg')) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(document.querySelector('#conduct-seg').compareDocumentPosition(document.querySelector('#load-panel')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  ok('Other text box hidden at first', await p.isHidden('#conducting-other'));
  await p.locator('.conduct-field').screenshot({ path: OUT + '/conduct.png' });

  await p.click('[data-action="conducting"][data-a="other"]');
  ok('Other shows a text box', await p.isVisible('#conducting-other'));
  await p.fill('#conducting-other', 'Bro. Example, ward clerk');
  await p.locator('.conduct-field').screenshot({ path: OUT + '/conduct-other.png' });
  await p.click('[data-action="conducting"][data-a="eq"]');
  ok('choosing Elders Quorum hides the text box', await p.isHidden('#conducting-other'));
  ok('only one choice selected', (await p.$$('#conduct-seg [aria-pressed="true"]')).length === 1);

  // PDF shows who is conducting; no Important note
  await p.fill('#ward', 'Riverton 5th Ward'); await p.fill('#date', '2026-11-01');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Example Person A'); await p.fill('[data-bind="cp.nm.0.action"]', 'Invite');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await dl.saveAs(OUT + '/eq.pdf');
  const t = pdfText(OUT + '/eq.pdf');
  ok('PDF shows Conducting: Elders Quorum', /Conducting\s+Elders Quorum/.test(t));
  ok('PDF has no Important note', !t.includes('Follow-Through'));
  await p.click('#confirm-primary').catch(() => {});
  ok('choice kept after Send & Clear', (await p.getAttribute('[data-action="conducting"][data-a="eq"]', 'aria-pressed')) === 'true');

  // Remembered on the phone
  await p.reload(); await p.waitForSelector('.chip');
  ok('choice remembered after reload', (await p.getAttribute('[data-action="conducting"][data-a="eq"]', 'aria-pressed')) === 'true');

  // Other text goes on the PDF
  await p.fill('#date', '2026-11-01');
  await p.click('[data-action="conducting"][data-a="other"]'); await p.fill('#conducting-other', 'Bro. Example');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Example Person B');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]); await dl2.saveAs(OUT + '/other.pdf');
  ok('PDF shows the typed name for Other', /Conducting\s+Bro\. Example/.test(pdfText(OUT + '/other.pdf')));
  execFileSync('pdftoppm', ['-r', '110', '-png', '-singlefile', '-x', '60', '-y', '40', '-W', '880', '-H', '190', OUT + '/other.pdf', OUT + '/header']);
  await p.click('#confirm-primary').catch(() => {});

  // Open to edit restores the choice from that agenda
  await p.click('[data-action="conducting"][data-a="wml"]');
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])');
  await p.locator('.agenda-entry').filter({ hasText: 'November 1' }).locator('[data-action="open-agenda"]').first().click();
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForTimeout(200);
  ok('Open to edit restores who was conducting', (await p.getAttribute('[data-action="conducting"][data-a="other"]', 'aria-pressed')) === 'true' && (await p.inputValue('#conducting-other')) === 'Bro. Example');

  // Clear erases it
  await p.click('.clear-link'); await p.click('#confirm-primary');
  ok('Clear erases the choice', (await p.$$('#conduct-seg [aria-pressed="true"]')).length === 0);
  await p.reload(); await p.waitForSelector('.chip');
  ok('and it is forgotten after reload', (await p.$$('#conduct-seg [aria-pressed="true"]')).length === 0);

  console.log('PROBLEMS:', errs.length ? errs : 'none');
  console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
