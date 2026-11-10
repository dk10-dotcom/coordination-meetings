// How to use: first-visit open, header link, #help link, one-time names reminder after Load last week.
const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.evaluate(() => document.querySelector('.clear-link').click()); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }

const OUT = __dirname + '/out2';
const BASE = 'http://127.0.0.1:8765/#huddle';
const ok = (l, c) => console.log((c ? 'PASS ' : 'FAIL ') + l);
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const p = await ctx.newPage(); p.on('pageerror', e => problems.push(e.message));

  await p.goto(BASE); await p.waitForSelector('.chip');
  ok('opens on first visit', await p.isVisible('#help-sheet'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/help-1.png' });
  await p.$eval('#help-sheet .sheet', s => s.scrollTop = s.scrollHeight); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/help-2.png' });
  await p.click('#help-done');
  ok('Got it closes', await p.isHidden('#help-sheet'));
  await p.reload(); await p.waitForSelector('.chip'); await p.waitForTimeout(200);
  ok('not shown again', await p.isHidden('#help-sheet'));
  await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.screenshot({ path: OUT + '/help-header.png' });
  await p.evaluate(() => document.querySelector('[data-action="help"]').click());
  ok('header link opens it', await p.isVisible('#help-sheet'));
  await p.keyboard.press('Escape');
  ok('Escape closes', await p.isHidden('#help-sheet'));
  await p.goto(BASE.replace('#huddle', '') + '#help'); await p.reload(); await p.waitForSelector('.chip');
  ok('#help link opens it', await p.isVisible('#help-sheet'));
  await p.click('#help-done');

  // How to use is a short list: tap a step to read it. Three groups of rows, the same rows as the rest of the app.
  const openHelp = async pg => { await pg.evaluate(() => document.querySelector('[data-action="help"]').click()); await pg.waitForSelector('#help-sheet:not([hidden])'); await pg.waitForTimeout(200); };
  const openIds = pg => pg.$$eval('#help-sheet details[open]', d => d.map(x => x.id || x.querySelector('.step-title').textContent).join('|'));
  await openHelp(p);
  ok('five short lists: 1 first-time step, 5 weekly steps, 6 questions, 1 about the app, 4 ways to watch or try', (await p.$$eval('#help-sheet .help-list', ls => ls.map(l => l.children.length).join())) === '1,5,6,1,4');
  ok('their headings: First time only, Every week, How do I…, About this app, Watch or try', (await p.$$eval('#help-sheet .help-band', h => h.map(x => x.textContent).join('|'))) === 'First time only|Every week|How do I…|About this app|Watch or try');
  ok('Privacy and security has its own row, saying everything stays on this phone', (await p.textContent('#help-privacy .step-title')) === 'Privacy and security' && (await p.textContent('#help-privacy .step-status')) === 'Everything stays on this phone' && await p.isVisible('#help-privacy summary') && await p.isHidden('#help-privacy .help-body'));
  await p.click('#help-privacy summary'); const priv = await p.textContent('#help-privacy .help-body');
  ok('it says nothing is saved online, to protect the PDF (with the sharing rule word for word), and never to enter confidential or sensitive information', priv.includes('Nothing is saved online.') && priv.includes('Protect the PDF.') && priv.includes('Only share via email or text message. Do not share through any other app.') && priv.includes('Delete old copies.') && priv.includes('Never enter confidential or sensitive information.'));
  await p.click('#help-privacy summary');
  ok('adding Huddle to the Home Screen is set apart: first time only, with no step number', (await p.$$eval('#help-sheet .help-list >> nth=0 >> .step-title', t => t.map(x => x.textContent).join('|'))) === 'Add Huddle to your Home Screen' && (await p.locator('#help-install .help-num').count()) === 0 && (await p.textContent('#help-install-status')).trim() === 'Do this once, before you start');
  ok('the weekly steps are numbered 1 to 5', (await p.$$eval('#help-sheet .help-num', n => n.map(x => x.textContent).join(''))) === '12345');
  ok('weekly step names, in order', (await p.$$eval('#help-sheet .help-list >> nth=1 >> .step-title', t => t.map(x => x.textContent).join('|'))) === 'Before ward council|Ward council|Huddle|After the huddle|During the week');
  ok('in a phone browser only the first-time step (Add to Home Screen) starts open', (await openIds(p)) === 'help-install');
  ok('the confidentiality warning shows without opening anything', await p.isVisible('#help-sheet .help-warning') && (await p.textContent('#help-sheet .help-warning strong')) === 'Never add confidential information to this agenda.');
  ok('a closed step shows its one-line summary, not its text', await p.isVisible('#help-sheet .step-status:has-text("Update the report, then share the PDF")') && await p.isHidden('#help-sheet :text("Send works only after this.")'));
  await p.click('#help-sheet details:has-text("Update the report, then share the PDF") summary');
  ok('tapping a step opens it in place', await p.isVisible('#help-sheet :text("Send works only after this.")'));
  ok('the After the huddle step keeps the sharing rule word for word', (await p.textContent('#help-sheet details[open]:has-text("Share PDF")')).includes('Only share via email or text message. Do not share through any other app.'));
  await p.click('#help-sheet details:has-text("Update the report, then share the PDF") summary');
  ok('tapping it again closes it', await p.isHidden('#help-sheet :text("Send works only after this.")'));
  await p.click('#help-sheet details:has-text("Fix a mistake") summary'); await p.click('#help-sheet details:has-text("Get my names back") summary');
  ok('How do I rows open the same way', await p.isVisible('#help-sheet :text("Sent too soon?")') && await p.isVisible('#help-sheet :text("This is why you include yourself when you send.")'));
  const ho = (await p.textContent('#help-sheet details:has-text("Hand off to someone else")')).replace(/\s+/g, ' ');
  ok('Hand off says the leader who filled in hands it back, not Load from a PDF', ho.includes('Filled in for someone? After you send the PDF, hand it back the same way, to whoever conducts next week.') && !ho.includes('Load from a PDF'));
  await p.click('#help-video-row summary');
  ok('the training video opens inside its row', await p.isVisible('#help-video'));
  await p.$eval('#help-video', v => { v.pause = () => { window.__paused = (window.__paused || 0) + 1; }; });
  await p.click('#help-video-row summary'); await p.waitForTimeout(150);
  ok('closing the row stops the video', await p.isHidden('#help-video') && (await p.evaluate(() => window.__paused)) === 1);
  await p.$eval('#help-sheet .sheet', s => { s.scrollTop = 400; });
  await p.click('#help-done'); await openHelp(p);
  ok('opening How to use again shows the short list from the top', (await openIds(p)) === 'help-install' && (await p.$eval('#help-sheet .sheet', s => s.scrollTop)) === 0);
  const size = await p.evaluate(() => { document.querySelectorAll('#help-sheet details').forEach(d => { d.open = true; }); return { words: document.querySelector('#help-sheet .sheet').innerText.trim().split(/\s+/).length, lines: Math.max(...[...document.querySelectorAll('#help-sheet ul.help-body')].map(u => u.children.length)) }; });
  ok('it stays short: under 900 words in all (' + size.words + '), and no step longer than 5 lines (' + size.lines + ')', size.words < 900 && size.lines <= 5);
  await p.click('#help-done');

  // From the Home Screen app, nothing starts open. On the smallest phone, nothing is wider than the screen with every row open.
  const app = await browser.newContext({ ...devices['iPhone SE'] });
  await app.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); } catch (e) {} });
  const q = await app.newPage(); q.on('pageerror', e => problems.push(e.message));
  await q.goto(BASE.replace('#huddle', '')); await q.waitForSelector('#start-home:not([hidden])'); await openHelp(q);
  ok('from the Home Screen app every step starts closed, and the first-time step says it is already done', (await openIds(q)) === '' && (await q.textContent('#help-install-status')).trim() === 'Already done on this phone');
  await q.screenshot({ path: OUT + '/help-se-closed.png' });
  ok('the first-time step and the first weekly step show on the first screen of a small phone', await q.evaluate(() => { const r = document.querySelectorAll('#help-sheet .help-num')[0].closest('summary').getBoundingClientRect(); return r.bottom <= window.innerHeight; }));
  await q.evaluate(() => document.querySelectorAll('#help-sheet details').forEach(d => { d.open = true; })); await q.waitForTimeout(150);
  ok('320 px: nothing wider than the screen with every row open', await q.evaluate(() => { const s = document.querySelector('#help-sheet .sheet'); return document.documentElement.scrollWidth <= window.innerWidth && s.scrollWidth <= s.clientWidth && [...s.querySelectorAll('*')].every(e => e.getBoundingClientRect().right <= window.innerWidth + 0.5); }));
  await app.close();

  // Names reminder: the first time names carry over (practice week), then never again
  await p.fill('#ward', 'Riverton 5th Ward');
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200); await p.click('#help-sheet [data-action="practice"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok('names reminder shown', (await p.textContent('#confirm-title')) === 'Check the names that carried over');
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/names-hint.png' });
  await p.click('#confirm-secondary'); await p.waitForTimeout(200);
  await p.click('#loaded-banner [data-action="unload"]'); await p.click('#confirm-primary'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200); await p.click('#help-sheet [data-action="practice"]'); await p.waitForTimeout(400);
  ok('names reminder only once', await p.isHidden('#confirm-sheet'));

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
