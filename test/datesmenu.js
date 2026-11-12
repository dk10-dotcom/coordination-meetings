// When is a date, Next ordinance is a menu, a referral can be texted to the missionaries, and older typed values
// (a When of "Sat" or "this week", an ordinance typed in by hand) still load. Fake names only.
const { chromium, devices } = require('playwright');
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-14' }, o);
const seed = {
  ward: 'Sample Ward', date: '2026-11-15', conducting: 'wml', attendees: ['wml'], rr: [],
  cp: { nm: [card({ name: 'Daniel Rivera', bap: '2026-10-30', ordinance: 'Temple baptisms', action: 'Offer a ride', assigned: 'Bro. Patel', when: 'Sat' }),
             card({ name: 'Emma Walsh', bap: '2026-10-05', temple: true, ordinance: 'Aaronic Priesthood' })],
        rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', action: 'Sit with her', assigned: 'Sister Diaz', when: 'this week' })],
        bt: [card({ name: 'Marcus Hill', committed: true })] },
  cpNone: {}, tn: [card({ name: 'Grace Thompson' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: 'Invite friends', items: [{ task: 'Each family invites one friend', when: 'Sun' }] },
  referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: 'A friend from work' }], verified: { before: true, after: false }
};
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  for (const [dev, tag] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const c = await b.newContext({ ...devices[dev] });
    await c.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])');
    await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed); await p.reload(); await p.waitForSelector('#start-home:not([hidden])');
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const row = (g, i) => p.textContent(`[data-group="${g}"] [data-action="open-person"][data-b="${i}"] .step-status`);
    await p.click('.door-hd'); await p.waitForTimeout(300); await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(400);
    ok((await row('nm', 0)).endsWith('Sat, Nov 21'), tag + ': an older typed "Sat" becomes the next Saturday');
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).cp.nm[0].ordinance) === 'Baptisms for the dead' || (await p.evaluate(() => { window.dispatchEvent(new Event('pagehide')); return JSON.parse(localStorage.getItem('huddle-agenda-v1')).cp.nm[0].ordinance; })) === 'Baptisms for the dead', tag + ': an older "Temple baptisms" becomes "Baptisms for the dead"');
    ok((await row('rm', 0)).endsWith('this week'), tag + ': a When that isn’t a day stays as typed');
    const grouped = await p.evaluate(() => { const h = document.querySelector('[data-group="nm"] .list-head').getBoundingClientRect(), l = document.querySelector('[data-group="nm"] .person-rows').getBoundingClientRect(); return Math.abs(l.top - h.bottom) < 1.5 && Math.abs(l.left - h.left) < 1.5 && Math.abs(l.right - h.right) < 1.5; });
    ok(grouped, tag + ': a list’s band and its names join as one card');
    await p.click('[data-group="nm"] [data-action="open-person"][data-b="0"]'); await p.waitForTimeout(400);
    ok((await p.$eval('#person-card [data-bind$=".when"]', e => e.type + ' ' + e.value)) === 'date 2026-11-21' && await fits(), tag + ': When is a date field');
    await p.fill('#person-card [data-bind$=".when"]', '2026-11-19'); await p.waitForTimeout(150);
    let sms = null; p.on('request', r => { if (/^sms:/.test(r.url())) sms = decodeURIComponent(r.url()); });
    await p.click('#person-card [data-action="text-assign"]'); await p.waitForTimeout(400);
    ok(sms && sms.includes('When: Thursday, November 19'), tag + ': the assignment text writes the date out');
    await p.goBack(); await p.waitForTimeout(400);
    if ((await p.evaluate(() => document.body.dataset.view)) !== 'cp') { await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForTimeout(500); await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300); }
    ok((await row('nm', 0)).endsWith('Thu, Nov 19'), tag + ': the row shows the date picked');
    await p.click('[data-group="rm"] [data-action="open-person"][data-b="0"]'); await p.waitForTimeout(400);
    ok((await p.$eval('#person-card [data-bind$=".when"]', e => e.type + ' ' + e.value)) === 'text this week', tag + ': "this week" stays in a text box, nothing lost');
    await p.click('#person-view .person-done'); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(300);
    await p.click('[data-action="open-step"][data-a="fn"]'); await p.waitForTimeout(400);
    ok((await p.$eval('[data-bind="find.items.0.when"]', e => e.type + ' ' + e.value)) === 'date 2026-11-22' && await fits(), tag + ': Find New People to Teach: When is a date too');
    await p.goBack(); await p.waitForTimeout(300); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(300);
    // Ward council: Next ordinance is a menu; an older typed one stays as a choice; being taught stays Baptism
    await p.click('.door-wc'); await p.waitForTimeout(300); await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(300);
    await p.click('[data-wc="nm"] [data-action="open-person"][data-b="1"]'); await p.waitForTimeout(400);
    const opts = await p.$eval('#person-card select[data-bind$=".ordinance"]', e => e.value + ' | ' + [...e.options].map(o => o.text).join(', '));
    ok(opts === 'Aaronic Priesthood | Choose one, Baptism, Sacrament, Baptisms for the dead, Priesthood advancement, Endowment, Sealing, Aaronic Priesthood', tag + ': Next ordinance is a menu of six; an older typed one stays chosen');
    await p.selectOption('#person-card select[data-bind$=".ordinance"]', 'Priesthood advancement'); await p.waitForTimeout(300);
    await p.click('#person-view .person-done'); await p.waitForTimeout(400);
    ok((await p.textContent('[data-wc="nm"] [data-action="open-person"][data-b="1"] .step-status')) === 'Next: Priesthood advancement', tag + ': the choice shows on the row');
    await p.click('[data-wc="bt"] [data-action="open-person"][data-b="0"]'); await p.waitForTimeout(400);
    ok((await p.locator('#person-card select[data-bind$=".ordinance"]').count()) === 0 && (await p.textContent('#person-card .fixed-value')) === 'Baptism', tag + ': those being taught stay locked on Baptism');
    await p.click('#person-view .person-done'); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(300);
    // Referrals: text it to the missionaries
    await p.click('[data-action="open-wc-list"][data-a="mr"]'); await p.waitForTimeout(300);
    await p.click('[data-action="open-person"][data-a="mr"][data-b="0"]'); await p.waitForTimeout(400); sms = null;
    await p.click('[data-action="text-referral"]'); await p.waitForTimeout(400);
    ok(sms && /Missionary referral: Marcus Bell\nReferred by: Sister Diaz\nA friend from work\nFrom the Sample Ward huddle/.test(sms.split('body=')[1] || ''), tag + ': a referral can be texted to the missionaries');
    ok(errs.length === 0 && await fits(), tag + ': no errors, fits the screen ' + errs.join('; '));
    await c.close();
  }
  await b.close(); console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
