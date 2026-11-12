// Text this assignment: appears when ready, opens Messages with only the action, the name and when (a weekday gets its date), marks Texted, resets on edit.
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => {
    try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {}
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (/^sms:/.test(this.href)) { window.__sms = this.href; return; } return orig.call(this); };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-08T10:00:00')); // Sunday, Nov 8, 2026
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="close-details"]');
  await p.click('[data-action="open-step"][data-a="cp"]'); await p.click('[data-action="cp-add-first"][data-a="nm"]');
  const btn = '.btn-text-assign[data-a="cp.nm.0."]';
  await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Temple baptisms');
  await p.fill('[data-bind="cp.nm.0.need"]', 'A ride to the temple'); await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple');
  ok(!(await p.isVisible(btn)), 'hidden until someone is assigned');
  ok((await p.getAttribute('[data-bind="cp.nm.0.when"]', 'type')) === 'date', 'the When box is a date');
  await p.fill('[data-bind="cp.nm.0.assigned"]', 'Bro. Patel'); await p.fill('[data-bind="cp.nm.0.when"]', 'Sat 9 am');
  ok(await p.isVisible(btn) && (await p.textContent(btn)).includes('Text this assignment'), 'button appears with action + assigned');
  await p.locator('[data-group="nm"] .card').first().screenshot({ path: 'test/out-empty/text-btn.png' });
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(150); await p.click(btn); await p.waitForTimeout(200);
  const href = await p.evaluate(() => window.__sms || ''); const body = decodeURIComponent(href.replace(/^sms:\?&body=/, ''));
  console.log(body);
  ok(href.startsWith('sms:') && body === 'Drive him to the temple\nFor: Daniel Rivera\nWhen: Saturday 9 am (Nov 14)\nFrom the Sample Ward huddle. Please report back. Thank you!', 'Messages opens with the action, who it is for, when (the day spelled out, with its date) and where it came from');
  ok(!/https?:|calendar/i.test(body), 'the text has no link in it');
  // What the When line says for different things typed under When (today is Sunday, Nov 8)
  const whenLine = async when => {
    await p.fill('[data-bind="cp.nm.0.when"]', when); await p.evaluate(() => { window.__sms = ''; document.activeElement && document.activeElement.blur(); });
    await p.waitForTimeout(120); await p.click(btn); await p.waitForTimeout(150);
    const t = decodeURIComponent((await p.evaluate(() => window.__sms || '')).replace(/^sms:\?&body=/, ''));
    return (t.split('\n').filter(l => l.startsWith('When: '))[0] || '(no When line)');
  };
  for (const [when, line] of [
    ['Sat', 'When: Saturday (Nov 14)'], ['Sun', 'When: Sunday (Nov 15)'], ['Thurs 6:30 pm', 'When: Thursday 6:30 pm (Nov 12)'], ['Wed. night', 'When: Wednesday night (Nov 11)'],
    ['tonight at 7', 'When: tonight at 7 (Nov 8)'], ['tomorrow', 'When: tomorrow (Nov 9)'], ['by Friday', 'When: by Friday (Nov 13)'],
    ['Nov 14 at 7 pm', 'When: Nov 14 at 7 pm'], ['11/20 noon', 'When: 11/20 noon'], ['this week', 'When: this week'], ['ASAP', 'When: ASAP'], ['', '(no When line)']
  ]) { const got = await whenLine(when); ok(got === line, `"${when}" is sent as "${line}"` + (got === line ? '' : '  got "' + got + '"')); }
  await p.fill('[data-bind="cp.nm.0.when"]', 'Sat 9 am'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(150); await p.click(btn); await p.waitForTimeout(200);
  ok(!/ride to the temple|Temple baptisms|New members/i.test(body), 'no needs, ordinance or list in the text');
  ok((await p.textContent(btn)).includes('Texted'), 'card shows Texted');
  await p.fill('[data-bind="cp.nm.0.when"]', 'Sun');
  ok((await p.textContent(btn)).includes('Text this assignment'), 'editing the assignment resets Texted');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(150); await p.click(btn); await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
  await p.click('[data-action="open-step"][data-a="cp"]');
  ok((await p.textContent(btn)).includes('Texted'), 'Texted survives a reload');
  // Name Next Ordinance cards have it too
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
  await p.fill('[data-bind="tn.0.name"]', 'Grace Thompson'); await p.fill('[data-bind="tn.0.action"]', 'Visit to prepare names'); await p.fill('[data-bind="tn.0.assigned"]', 'Sister Nguyen');
  ok(await p.isVisible('.btn-text-assign[data-a="tn.0."]'), 'focus name cards have the button');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
