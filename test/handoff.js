// Handoff link: the ward mission leader texts the agenda; another leader opens the link (iPhone Safari, iPhone app via paste, Android) and it loads.
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-handoff'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
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
  await p.click('[data-action="steps-home"]'); await p.waitForTimeout(400);
  ok(await p.locator('.actionbar [data-action="handoff"]').count() === 1 && !(await p.isVisible('[data-action="save-only"]')), 'Hand off sits beside Send; Save without sending is gone');
  await p.evaluate(() => document.querySelector('.actionbar [data-action="handoff"]').click()); await p.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await p.textContent('#confirm-title')).includes('Hand off this agenda?'), 'asks before handing off');
  await p.screenshot({ path: `${OUT}/ask.png` });
  await p.click('#confirm-primary'); await p.waitForTimeout(200);
  const href = await p.evaluate(() => window.__sms || '');
  const body = decodeURIComponent(href.replace(/^sms:\?&body=/, ''));
  const url = (body.match(/https?:\/\/\S+/) || [''])[0];
  console.log('message:', body.slice(0, 120) + '…', '| link length', url.length);
  ok(/^sms:/.test(href) && body.includes('Sample Ward') && /#handoff=z/.test(url), 'Messages opens with the handoff link (compressed)');
  ok(url.length < 4000, 'link is a reasonable length: ' + url.length);
  ok(!/Daniel|Rivera|temple/i.test(url), 'names aren’t readable in the link itself');

  // iPhone Safari (not the Home Screen app): offers Copy handoff, or load here
  const B = await mk('iPhone 13'); const q = B.p;
  await q.goto(url); await q.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await q.textContent('#confirm-title')).includes('Open this handoff in the app'), 'iPhone Safari explains how to get it into the app');
  ok(!/handoff=/.test(await q.evaluate(() => location.href)), 'the link is cleared from the address bar');
  await q.screenshot({ path: `${OUT}/safari.png` });
  await q.click('#confirm-secondary'); await q.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await q.textContent('#confirm-title')).includes('Load this handoff?') && (await q.textContent('#confirm-compare')).includes('Sample Ward'), 'Load it here shows what’s coming');
  await q.click('#confirm-primary'); await q.waitForTimeout(300);
  ok(await q.isVisible('#start-home'), 'after loading, the opening screen shows');
  await q.click('[data-action="open-huddle"]'); await q.waitForTimeout(200);
  ok((await q.textContent('#meeting-date .md-text')).includes('November 15') && (await q.textContent('#details-line')).includes('Sample Ward'), 'date and ward came over');
  await q.click('[data-action="open-step"][data-a="cp"]');
  ok(await q.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await q.inputValue('[data-bind="cp.nm.0.action"]') === 'Drive him to the temple', 'names and actions came over');
  await q.click('[data-action="steps-home"]'); ok((await q.textContent('#details-sub')).includes('1 attended'), 'attendance came over');

  // iPhone app: Paste a handoff from the clipboard
  const C = await mk('iPhone 13', { permissions: ['clipboard-read', 'clipboard-write'] }); const r = C.p;
  await r.goto('http://127.0.0.1:8765/#huddle'); await r.waitForSelector('.chip', { state: 'attached' }); await r.click('[data-action="dismiss-install"]').catch(() => {});
  await r.evaluate(t => navigator.clipboard.writeText(t), 'Handoff: tap the link ' + url);
  await r.click('[data-action="go-start"]'); await r.click('[data-action="load-other"]'); await r.waitForSelector('#load-sheet:not([hidden])');
  await r.screenshot({ path: `${OUT}/load-sheet.png` });
  await r.click('[data-action="paste-handoff"]'); await r.waitForSelector('#confirm-sheet:not([hidden])');
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
  await r.click('[data-action="go-start"]'); await r.click('[data-action="load-other"]'); await r.click('[data-action="paste-handoff"]'); await r.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await r.textContent('#confirm-title')).includes('Paste a handoff') && await r.isVisible('#confirm-text'), 'no link on the clipboard: a box to paste it');
  await r.fill('#confirm-text', 'not a link'); await r.click('#confirm-primary'); await r.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await r.textContent('#confirm-title')).includes('isn’t a handoff link'), 'explains when it isn’t a handoff link');

  // Android: opens straight to Load this handoff
  const D = await mk('Pixel 7'); const s = D.p;
  await s.goto(url); await s.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await s.textContent('#confirm-title')).includes('Load this handoff?'), 'Android goes straight to loading');

  // A broken link
  const E = await mk('Pixel 7'); const s2 = E.p;
  await s2.goto('http://127.0.0.1:8765/#handoff=zBROKEN'); await s2.waitForSelector('#confirm-sheet:not([hidden])');
  ok((await s2.textContent('#confirm-title')).includes('didn’t work'), 'a broken link says so');

  const errs = [p, q, r, s].flatMap(x => x.errs);
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
