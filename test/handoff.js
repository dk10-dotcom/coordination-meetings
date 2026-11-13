// Handoff link: the ward mission leader texts the agenda; another leader opens the link (iPhone Safari, iPhone app via paste, Android) and it loads.
// On iPhone the link opens in Safari, never in the app, so it gets a page of its own: Copy handoff, then paste it in the app.
// Hand off (beside Send) offers both ends: Send a handoff (text it) and Receive a handoff (paste it).
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-handoff'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const seen = ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'];
  const mk = async (dev, extra) => {
    const ctx = await b.newContext({ ...devices[dev], ...(extra || {}) });
    await ctx.addInitScript(k => { try { k.forEach(x => localStorage.setItem(x, '1')); } catch (e) {} }, seen);
    await ctx.addInitScript(() => { const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (/^sms:/.test(this.href)) { window.__sms = this.href; return; } return orig.call(this); }; });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    return { ctx, p };
  };

  // Sender: fill an agenda and hand it off
  const A = await mk('iPhone 13'); const p = A.p;
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.fill('#date', '2026-11-15');
  await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="conducting"][data-a="wml"]'); await p.click('[data-action="toggle-att"][data-a="rs"]'); await p.click('#details-full .btn-collapse');
  await p.click('[data-action="open-step"][data-a="cp"]'); await p.click('[data-action="cp-add-first"][data-a="nm"]');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Temple baptisms'); await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple'); await p.fill('[data-bind="cp.nm.0.assigned"]', 'Bro. Patel');
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
  await p.fill('[data-bind="tn.0.name"]', 'Grace Thompson'); await p.fill('[data-bind="tn.0.action"]', 'Invite to temple prep');
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="mr"]'); await p.click('[data-action="add-mr"]');
  await p.fill('[data-bind="referrals.0.name"]', 'Marcus Bell'); await p.fill('[data-bind="referrals.0.by"]', 'Olivia Chen');
  await p.click('[data-action="steps-home"]'); await p.waitForTimeout(400);
  ok(await p.locator('.actionbar [data-action="handoff"]').count() === 1 && !(await p.isVisible('[data-action="save-only"]')), 'Hand off sits beside Send; Save without sending is gone');
  await p.evaluate(() => document.querySelector('.actionbar [data-action="handoff"]').click()); await p.waitForSelector('#handoff-sheet:not([hidden])');
  ok((await p.textContent('#handoff-title')) === 'Hand off' && await p.locator('#handoff-sheet .nav-row').count() === 2 && (await p.textContent('#handoff-send')).includes('Send a handoff') && (await p.textContent('#handoff-receive')).includes('Receive a handoff'), 'Hand off offers two choices: Send a handoff and Receive a handoff');
  ok((await p.textContent('#handoff-send-sub')).includes('Text this huddle') && (await p.textContent('#handoff-send-sub')).includes('the leader who conducts next') && (await p.textContent('#handoff-sheet .step-hint')).includes('Send a handoff only to the leader who conducts next.') && (await p.textContent('#handoff-sheet .step-hint')).includes('After you send the PDF, hand it back the same way.') && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Hand off says to send it only to the leader who conducts next, and to hand it back after filling in');
  await p.screenshot({ path: `${OUT}/ask.png` });
  await p.click('#handoff-send'); await p.waitForTimeout(250);
  ok(await p.isHidden('#handoff-sheet') && await p.isHidden('#confirm-sheet'), 'Send a handoff goes straight to Messages, with no second question');
  const href = await p.evaluate(() => window.__sms || '');
  const body = decodeURIComponent(href.replace(/^sms:\?&body=/, ''));
  const url = (body.match(/https?:\/\/\S+/) || [''])[0];
  console.log('message:', body.slice(0, 120) + '…', '| link length', url.length);
  ok(/^sms:/.test(href) && body.includes('Sample Ward') && /\?h=[a-z0-9]{1,6}#handoff=z/.test(url), 'Messages opens with the handoff link (compressed, with its own tag before the #)');
  ok(body.includes('Tap the link and follow the steps') && body.includes('Huddle app'), 'the text says to tap the link and follow the steps');
  ok(url.length < 4000, 'link is a reasonable length: ' + url.length);
  ok(!/Daniel|Rivera|temple/i.test(url), 'names aren’t readable in the link itself');

  // iPhone Safari (not the Home Screen app): a page of its own with three steps
  const B = await mk('iPhone 13', { permissions: ['clipboard-read', 'clipboard-write'] }); const q = B.p;
  const fits = pg => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await q.goto(url); await q.waitForSelector('#handoff-page:not([hidden])');
  ok((await q.textContent('#hp-title')).includes('handed a huddle') && (await q.textContent('#hp-what')).includes('Sample Ward') && (await q.textContent('#hp-what')).includes('November 15'), 'iPhone Safari opens the handoff page, naming the ward and the huddle: ' + await q.textContent('#hp-what'));
  ok(!(await q.isVisible('#form')) && !(await q.isVisible('.actionbar')) && !(await q.isVisible('#confirm-sheet')) && !(await q.isVisible('#install-banner')), 'nothing of the app shows behind it, and no sheet is over it');
  ok(!/handoff=/.test(await q.evaluate(() => location.href)), 'the link is cleared from the address bar');
  ok(await q.locator('.hp-step').count() === 3 && await q.locator('#handoff-page .btn-primary:visible').count() === 1 && (await q.textContent('#hp-copy')).trim() === 'Copy handoff' && await q.locator('#hp-step-1.now').count() === 1, 'three steps, with one main button: Copy handoff');
  ok((await q.textContent('#hp-step-2')).includes('Open Huddle from your Home Screen') && (await q.textContent('#hp-step-3')).includes('Tap Hand off, then Receive a handoff') && (await q.textContent('#hp-step-3')).includes('in the bar at the bottom'), 'steps 2 and 3 say where to go in the app');
  ok(await fits(q), 'the handoff page fits the phone');
  await q.screenshot({ path: `${OUT}/safari.png`, fullPage: true });
  await q.click('#hp-copy'); await q.waitForTimeout(250);
  ok(await q.isVisible('#hp-copied') && /#handoff=z/.test(await q.evaluate(() => navigator.clipboard.readText())) && (await q.textContent('#hp-copy')).trim() === 'Copy again', 'Copy handoff copies the link and says Copied');
  ok(await q.locator('#hp-step-1.done').count() === 1 && await q.locator('#hp-step-2.now').count() === 1 && await q.isVisible('#hp-step-3') && await q.isVisible('#handoff-page'), 'the steps stay on screen, with step 1 done and the next ones lit');
  await q.screenshot({ path: `${OUT}/safari-copied.png`, fullPage: true });
  // No app yet: how to add it, or use it in Safari this once
  ok(!(await q.isVisible('[data-action="hp-safari"]')), 'Use it in Safari is tucked away');
  await q.click('#hp-noapp summary'); await q.waitForTimeout(150);
  ok(await q.isVisible('[data-action="hp-install"]') && await q.isVisible('[data-action="hp-safari"]') && (await q.textContent('.hp-warn')).includes('Home Screen app won’t have it'), '“Don’t have Huddle on your Home Screen?” shows how to add it, and the Safari last resort with its warning');
  ok(await fits(q), 'it still fits the phone when opened');
  await q.screenshot({ path: `${OUT}/safari-noapp.png`, fullPage: true });
  await q.click('[data-action="hp-install"]'); await q.waitForSelector('#install-sheet:not([hidden])');
  ok((await q.textContent('#install-steps')).includes('Add to Home Screen'), 'Show me how opens the Add to Home Screen steps');
  await q.click('[data-action="close-install"]'); await q.waitForTimeout(200);
  await q.click('[data-action="hp-safari"]'); await q.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await q.textContent('#confirm-title')).includes('Load this handoff?') && (await q.textContent('#confirm-compare')).includes('Sample Ward'), 'Use it in Safari shows what’s coming');
  await q.click('#confirm-secondary'); await q.waitForTimeout(250);
  ok(await q.isVisible('#handoff-page') && !(await q.isVisible('#form')), 'Cancel stays on the handoff page');
  await q.click('[data-action="hp-safari"]'); await q.waitForSelector('#confirm-sheet:not([hidden])');
  await q.click('#confirm-primary'); await q.waitForTimeout(300);
  ok(!(await q.isVisible('#handoff-page')) && await q.isVisible('#form'), 'loading it closes the handoff page');
  ok(await q.isVisible('#start-home'), 'after loading, the opening screen shows');
  await q.click('[data-action="open-huddle"]'); await q.waitForTimeout(200);
  ok((await q.textContent('#meeting-date .md-text')).includes('November 15') && (await q.textContent('#details-line')).includes('Sample Ward'), 'date and ward came over');
  await q.click('[data-action="open-step"][data-a="cp"]');
  ok(await q.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await q.inputValue('[data-bind="cp.nm.0.action"]') === 'Drive him to the temple', 'names and actions came over');
  await q.click('[data-action="steps-home"]'); ok((await q.textContent('#details-sub')).includes('1 attended'), 'attendance came over');
  ok((await q.textContent('.step-row[data-a="mr"] .step-status')).trim() === '1 referral', 'the missionary referral came over');
  await q.click('[data-action="open-step"][data-a="mr"]');
  ok(await q.inputValue('[data-bind="referrals.0.name"]') === 'Marcus Bell' && await q.inputValue('[data-bind="referrals.0.by"]') === 'Olivia Chen', 'with its name and who referred them');
  await q.click('[data-action="steps-home"]');

  // iPhone app: Paste a handoff from the clipboard
  const C = await mk('iPhone 13', { permissions: ['clipboard-read', 'clipboard-write'] }); const r = C.p;
  await r.goto('http://127.0.0.1:8765/#huddle'); await r.waitForSelector('.chip', { state: 'attached' }); await r.click('[data-action="dismiss-install"]').catch(() => {});
  await r.evaluate(t => navigator.clipboard.writeText(t), 'Handoff: tap the link ' + url);
  await r.click('[data-action="go-start"]'); await r.click('.actionbar [data-action="handoff"]'); await r.waitForSelector('#handoff-sheet:not([hidden])');
  ok((await r.textContent('#handoff-send-sub')).includes('Nothing to hand off yet'), 'on a phone with nothing entered, Send says there’s nothing to hand off yet');
  ok(await r.getAttribute('#handoff-send', 'aria-disabled') === 'true', 'and the row is marked unavailable');
  await r.evaluate(() => document.querySelector('#handoff-send').click()); await r.waitForTimeout(200);
  ok(await r.isVisible('#handoff-sheet') && await r.isHidden('#toast') && !(await r.evaluate(() => window.__sms)), 'tapping it sends nothing and leaves the choices open, with nothing covering Receive a handoff');
  await r.screenshot({ path: `${OUT}/handoff-sheet.png` });
  await r.click('#handoff-receive'); await r.waitForSelector('#confirm-sheet:not([hidden])');
  ok(await r.isHidden('#handoff-sheet'), 'Receive a handoff closes the choices');
  ok((await r.textContent('#confirm-title')).includes('Load this handoff?'), 'Paste a handoff reads the link from the clipboard');
  await r.click('#confirm-primary'); await r.waitForTimeout(300);
  // (The Undo message sits over this row for a few seconds; tap the row itself, the way a finger would beside it.)
  await r.evaluate(() => document.querySelector('[data-action="open-step"][data-a="tn"]').click());
  ok(await r.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson', 'pasted handoff loads the agenda');
  // Undo right after
  await r.click('[data-action="steps-home"]');
  ok(await r.isVisible('#toast .toast-action'), 'Undo offered after loading');
  // A bad paste
  await r.evaluate(() => navigator.clipboard.writeText('hello'));
  await r.click('[data-action="go-start"]'); await r.waitForTimeout(300); await r.evaluate(() => document.querySelector('.actionbar [data-action="handoff"]').click()); await r.waitForSelector('#handoff-sheet:not([hidden])');
  ok((await r.textContent('#handoff-send-sub')).includes('Text this huddle'), 'once there is an agenda, Send is ready');
  await r.click('#handoff-receive'); await r.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await r.textContent('#confirm-title')).includes('Paste a handoff') && await r.isVisible('#confirm-text'), 'no link on the clipboard: a box to paste it');
  await r.fill('#confirm-text', 'not a link'); await r.click('#confirm-primary'); await r.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await r.textContent('#confirm-title')).includes('isn’t a handoff link'), 'explains when it isn’t a handoff link');

  // Not now: the page closes and nothing is loaded
  const N = await mk('iPhone 13'); const n = N.p;
  await n.goto(url); await n.waitForSelector('#handoff-page:not([hidden])');
  await n.click('[data-action="hp-close"]'); await n.waitForTimeout(250);
  ok(!(await n.isVisible('#handoff-page')) && await n.isVisible('#start-home') && !(await n.evaluate(() => (localStorage.getItem('huddle-agenda-v1') || '').includes('Daniel Rivera'))), 'Not now closes the page and loads nothing');
  // A first visit with a handoff link: the handoff comes first, not How to use or the tour
  const F = await b.newContext({ ...devices['iPhone 13'] });
  await F.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const f = await F.newPage(); f.errs = []; f.on('pageerror', e => f.errs.push(e.message));
  await f.goto(url); await f.waitForSelector('#handoff-page:not([hidden])'); await f.waitForTimeout(600);
  ok(await f.isHidden('#help-sheet') && !(await f.isVisible('.tour')), 'on a first visit, the handoff page shows without How to use or the tour over it');
  await f.goto('http://127.0.0.1:8765/'); await f.waitForSelector('#help-sheet:not([hidden])');
  ok(await f.isVisible('#help-sheet'), 'How to use still opens on the next visit');

  // Android: opens straight to Load this handoff
  const D = await mk('Pixel 7'); const s = D.p;
  await s.goto(url); await s.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await s.textContent('#confirm-title')).includes('Load this handoff?') && await s.isHidden('#handoff-page'), 'Android goes straight to loading');

  // Handing it back: the leader who filled in sends the PDF, then hands the huddle back the same way
  await s.click('#confirm-primary'); await s.waitForTimeout(500);
  await s.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
  await s.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => s.click('.actionbar [data-action="send"]'));
  await s.waitForTimeout(300); if (await s.isVisible('#confirm-sheet') && /Ready to send/.test(await s.textContent('#confirm-title'))) await s.click('#confirm-primary');
  await s.waitForSelector('#share-btn:not([disabled])'); await s.click('#share-btn'); await s.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await s.textContent('#confirm-title')).includes('Sent successfully'), 'the leader who filled in sends the PDF');
  await s.click('#confirm-primary'); await s.waitForTimeout(400);
  await s.evaluate(() => { window.__sms = ''; document.querySelector('.actionbar [data-action="handoff"]').click(); }); await s.waitForSelector('#handoff-sheet:not([hidden])');
  ok((await s.getAttribute('#handoff-send', 'aria-disabled')) === 'false' && (await s.textContent('#handoff-send-sub')).includes('the leader who conducts next'), 'right after sending, Send a handoff is ready for handing it back');
  await s.click('#handoff-send'); await s.waitForTimeout(300);
  const backUrl = (decodeURIComponent((await s.evaluate(() => window.__sms || '')).replace(/^sms:\?&body=/, '')).match(/https?:\/\/\S+/) || [''])[0];
  ok(/#handoff=z/.test(backUrl) && backUrl !== url, 'handing it back texts a new link');
  const G = await mk('Pixel 7'); const g2 = G.p;
  await g2.goto(backUrl); await g2.waitForSelector('#confirm-sheet:not([hidden])'); await g2.click('#confirm-primary'); await g2.waitForTimeout(600);
  const got = await g2.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
  ok(got.cp.nm[0].name === 'Daniel Rivera' && got.rr.some(r => r.prefilled && r.pname === 'Daniel Rivera' && r.action === 'Drive him to the temple') && !got.cp.nm[0].action && got.referrals.length === 1, 'the leader conducting next gets the next huddle: names kept, and the last assignments in Return and Report');

  // A broken link
  const E = await mk('Pixel 7'); const s2 = E.p;
  await s2.goto('http://127.0.0.1:8765/#handoff=zBROKEN'); await s2.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await s2.textContent('#confirm-title')).includes('didn’t work'), 'a broken link says so');

  const errs = [p, q, r, s, n, f, g2].flatMap(x => x.errs);
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
