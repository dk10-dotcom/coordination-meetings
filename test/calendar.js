// Add to calendar: with a day in When, the assignment text carries a link. The link opens a page of its own
// (nothing of the app behind it) that makes a calendar file on that phone. Only what the text already says is in
// the link: the action, the name, the day and time, and the ward. Fake names only.
const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const decode = code => JSON.parse(Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const linkOf = body => (/#cal=([A-Za-z0-9_-]+)/.exec(body) || [])[1] || '';

  // ---- The text: what goes in it for different things typed under When. Today is Sunday, Nov 8, 2026.
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => {
    try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {}
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (/^sms:/.test(this.href)) { window.__sms = this.href; return; } return orig.call(this); };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-08T10:00:00'));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="close-details"]');
  await p.click('[data-action="open-step"][data-a="cp"]'); await p.click('[data-action="cp-add-first"][data-a="nm"]');
  const btn = '.btn-text-assign[data-a="cp.nm.0."]';
  await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.need"]', 'A ride to the temple');
  await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple'); await p.fill('[data-bind="cp.nm.0.assigned"]', 'Bro. Patel');
  ok((await p.getAttribute('[data-bind="cp.nm.0.when"]', 'placeholder')) === 'e.g. Sat 9 am', 'the When box suggests a day and a time');
  const text = async when => {
    await p.fill('[data-bind="cp.nm.0.when"]', when); await p.evaluate(() => { window.__sms = ''; document.activeElement && document.activeElement.blur(); });
    await p.waitForTimeout(120); await p.click(btn); await p.waitForTimeout(150);
    return decodeURIComponent((await p.evaluate(() => window.__sms || '')).replace(/^sms:\?&body=/, ''));
  };
  // [typed under When, the When line of the text, date in the link, time in the link]
  const cases = [
    ['Sat 9 am', 'When: Saturday 9 am (Nov 14)', '2026-11-14', '09:00'],
    ['Sat', 'When: Saturday (Nov 14)', '2026-11-14', ''],
    ['Sun', 'When: Sunday (Nov 15)', '2026-11-15', ''],            // the next Sunday, not today
    ['Thurs 6:30', 'When: Thursday 6:30 (Nov 12)', '2026-11-12', '18:30'],
    ['tonight at 7', 'When: tonight at 7 (Nov 8)', '2026-11-08', '19:00'],
    ['tomorrow', 'When: tomorrow (Nov 9)', '2026-11-09', ''],
    ['Nov 14 at 7 pm', 'When: Nov 14 at 7 pm', '2026-11-14', '19:00'],
    ['11/20 noon', 'When: 11/20 noon', '2026-11-20', '12:00'],
    ['Jan 5', 'When: Jan 5', '2027-01-05', '']                      // a January date typed in November is next year
  ];
  for (const [when, line, date, time] of cases) {
    const body = await text(when), code = linkOf(body), c = code ? decode(code) : {};
    ok(body.split('\n').includes(line) && c.d === date && c.t === time, `"${when}" → "${line}", calendar ${date}${time ? ' ' + time : ' all day'}` + (c.d === date && c.t === time ? '' : '  got ' + JSON.stringify(c) + ' | ' + body.split('\n')[2]));
  }
  const full = await text('Sat 9 am'), sent = decode(linkOf(full));
  ok(full === 'Drive him to the temple\nFor: Daniel Rivera\nWhen: Saturday 9 am (Nov 14)\nAdd to calendar: http://127.0.0.1:8765/#cal=' + linkOf(full) + '\nFrom the Sample Ward huddle. Please report back. Thank you!', 'the whole text: the action first, then For, When, the link and where it came from');
  ok(JSON.stringify(Object.keys(sent).sort()) === '["a","d","n","t","w"]' && sent.a === 'Drive him to the temple' && sent.n === 'Daniel Rivera' && sent.w === 'Sample Ward' && !/ride to the temple|Bro\. Patel/.test(JSON.stringify(sent)), 'the link holds only the action, the name, the day and time, and the ward: no needs, no one else');
  for (const when of ['this week', 'ASAP', '9 am']) { const body = await text(when); ok(!body.includes('Add to calendar') && body.includes('When: ' + when), `"${when}" has no day, so the text has no calendar link`); }
  const none = await text('');
  ok(!none.includes('Add to calendar') && !none.includes('When:') && none.startsWith('Drive him to the temple\nFor: Daniel Rivera\nFrom the Sample Ward huddle.'), 'with nothing under When, the text has no When line and no link');
  const timed = 'http://127.0.0.1:8765/#cal=' + linkOf(full), allDay = 'http://127.0.0.1:8765/#cal=' + linkOf(await text('Tue'));
  ok(!errs.length, 'no page errors while texting ' + errs.join('; '));
  await ctx.close();

  // ---- The link, opened by someone who has never used the app (iPhone, in the browser)
  const fresh = async (dev, init) => {
    const c = await b.newContext({ ...devices[dev], acceptDownloads: true });
    await c.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })); // so the first-visit instructions would run
    if (init) await c.addInitScript(init);
    const q = await c.newPage(); const e = []; q.on('pageerror', x => e.push(x.message)); return { c, q, e };
  };
  const ics = async q => { const [dl] = await Promise.all([q.waitForEvent('download'), q.click('#cal-add')]); return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8') }; };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const { c, q, e } = await fresh(dev); const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    await q.goto(timed); await q.waitForSelector('#cal-page:not([hidden])'); await q.waitForTimeout(700);
    ok(await q.isVisible('#cal-page') && !(await q.isVisible('main.wrap')) && await q.isHidden('#help-sheet') && !(await q.isVisible('.tour')) && !(await q.isVisible('#install-banner')), tag + ': the link opens a page of its own: no app behind it, no instructions, no tour, no banner');
    ok((await q.textContent('#cal-title')) === 'Your assignment' && (await q.textContent('#cal-what')) === 'Drive him to the temple' && (await q.textContent('#cal-for')) === 'Daniel Rivera' && (await q.textContent('#cal-when')) === 'Saturday, November 14 at 9:00 AM' && (await q.textContent('#cal-from')).includes('From the Sample Ward huddle.'), tag + ': it shows the action, who it is for, the day and time, and the ward');
    ok(await q.isVisible('#cal-add') && await q.isHidden('#cal-next') && await q.isHidden('#cal-close') && (await q.textContent('#cal-page')).includes('Nothing on this page is saved online.'), tag + ': one button, Add to calendar; no Done in a browser; it says nothing is saved online');
    ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tag + ': the page fits the phone');
    const f = await ics(q), L = f.text.split('\r\n');
    ok(f.name === 'Assignment.ics' && L[0] === 'BEGIN:VCALENDAR' && L.includes('BEGIN:VEVENT') && L.includes('END:VEVENT') && L[L.length - 2] === 'END:VCALENDAR' && f.text.endsWith('\r\n') && L.every(x => Buffer.byteLength(x) <= 75), tag + ': Add to calendar hands the phone a calendar file with one event, in the standard format');
    ok(L.includes('SUMMARY:Drive him to the temple') && L.includes('DTSTART:20261114T090000') && L.includes('DTEND:20261114T100000') && f.text.replace(/\r\n /g, '').includes('DESCRIPTION:For: Daniel Rivera\\nFrom the Sample Ward huddle.'), tag + ': the event is titled with the action, on that day for an hour, with who it is for in its notes');
    ok(L.includes('BEGIN:VALARM') && L.includes('TRIGGER:-PT1H') && !/ride to the temple|Bro\. Patel/.test(f.text), tag + ': it carries an alert an hour before, and nothing the text did not say');
    ok(await q.isVisible('#cal-next') && (await q.textContent('#cal-next')).includes('Tap Add to Calendar') && (await q.textContent('#cal-next')).includes('Nothing opened? Add it yourself from the details above.'), tag + ': after the tap it says what to do next, and what to do if nothing opened');
    ok(!e.length, tag + ': no page errors ' + e.join('; '));
    await c.close();
  }
  // A day with no time is an all-day event with an alert at 9 that morning
  { const { c, q } = await fresh('iPhone 13'); await q.goto(allDay); await q.waitForSelector('#cal-page:not([hidden])');
    const f = await ics(q), L = f.text.split('\r\n');
    ok((await q.textContent('#cal-when')) === 'Tuesday, November 10' && L.includes('DTSTART;VALUE=DATE:20261110') && L.includes('DTEND;VALUE=DATE:20261111') && L.includes('TRIGGER:PT9H'), 'a day with no time makes an all-day event, with an alert at 9 that morning');
    await c.close(); }
  // Android: the file downloads
  { const { c, q } = await fresh('Pixel 5'); await q.goto(timed); await q.waitForSelector('#cal-page:not([hidden])'); await ics(q);
    ok((await q.textContent('#cal-next')).includes('A calendar file downloads. Open it to add the event'), 'on Android it says the file downloads and to open it');
    await c.close(); }
  // In the Home Screen app (Android can open links there), Done goes back to the app
  { const { c, q } = await fresh('iPhone 13', () => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await q.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    await q.goto(timed); await q.waitForSelector('#cal-page:not([hidden])');
    ok(await q.isVisible('#cal-close'), 'opened inside the Home Screen app, the page has Done');
    await q.click('#cal-close'); await q.waitForTimeout(200);
    ok(await q.isHidden('#cal-page') && await q.isVisible('main.wrap') && !/cal=/.test(await q.evaluate(() => location.href)), 'Done goes back to the app and drops the link');
    await c.close(); }
  // A link that was cut short
  { const { c, q } = await fresh('iPhone 13'); await q.goto('http://127.0.0.1:8765/#cal=eyJhIjoiRHJpdmUi'); await q.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await q.textContent('#confirm-title')) === 'This calendar link didn’t work' && await q.isHidden('#cal-page'), 'a broken link says so instead of showing an empty page');
    await c.close(); }
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
