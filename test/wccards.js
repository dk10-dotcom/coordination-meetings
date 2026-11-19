// Ward Council's screen as cards, in order (Nov 19, 2026): Opportunities to invite, then Find your focus names (the
// Covenant Path Report card and a plain Part-Member Families row), then the focus names right on the screen. The next
// card says Up next; a finished one gets a green check, and the focus names card turns green once every focus name has
// a next ordinance. No upcoming events finishes Opportunities to invite, and Ward Council's check waits for it.
// The opportunity's date is labeled Event date, and the Huddle puts Opportunities to invite before Focus names.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const st = { ward: 'Sample Ward', cp: { nm: [{ name: 'Emma Walsh' }], rm: [{ name: 'Marcus Bell' }], bt: [] }, tn: [{ name: 'Emma Walsh', ordinance: 'Baptisms for the dead' }, { name: 'Marcus Bell' }] };
  const c = await b.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 640 } });
  await c.addInitScript(s => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-gate-off'].forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__seeded')) { localStorage.setItem('huddle-agenda-v1', s); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, JSON.stringify(st));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = ms => p.waitForTimeout(ms);
  const nextId = () => p.evaluate(() => { const u = document.querySelector('#wc-rows .wc-up-next'); return u ? u.closest('[id]').id : ''; });
  const doneIds = () => p.evaluate(() => Array.from(document.querySelectorAll('#wc-rows .is-done')).map(e => e.id).filter(Boolean).join('|'));
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await p.goto(BASE); await w(900); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('.door-wc'); await w(500);
  ok(await nextId() === 'wc-step-fn' && await doneIds() === 'wc-step-cp', 'Opportunities to invite is Up next; the Covenant Path Report has its check once focus names are chosen');
  ok(/Opportunities to invite not done yet/.test(await p.textContent('#wc-hero .hero-count')), 'the header card says Opportunities to invite isn’t done yet');
  ok(await fits(), 'Ward Council fits a 320 px screen');
  // Opportunities to invite: what counts as an event, Add an event, No upcoming events
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(500);
  ok(/Ward activities, special meetings and other events to invite friends to\./.test(await p.textContent('#fn-list .opp-what')), 'a hint says what an opportunity is');
  ok(await p.isVisible('#fn-list [data-action="add-opp"]:has-text("Add an event")') && await p.isVisible('#fn-list [data-action="opps-none"]:has-text("No upcoming events")'), 'Add an event, and No upcoming events when there are none');
  await p.click('[data-action="opps-none"]'); await w(300);
  ok(await p.isVisible('#fn-list .list-empty.confirmed:has-text("No upcoming events")') && !(await p.isVisible('[data-action="opps-none"]')), 'No upcoming events shows with a green check and an Undo');
  await p.click('[data-action="steps-home"]'); await w(500);
  ok(await nextId() === 'wc-step-tn' && /wc-step-fn/.test(await doneIds()) && /No upcoming events/.test(await p.textContent('#wc-step-fn')), 'back on Ward Council, Opportunities to invite has its check and Focus names is Up next');
  ok(!(await p.evaluate(() => document.querySelector('.door-wc').classList.contains('tl-done'))), 'Ward Council isn’t done while a focus name has no next ordinance');
  // Reopen with the data saved: No upcoming events stays
  await p.reload(); await w(900);
  if (!(await p.isVisible('#wc-rows'))) { await p.click('[data-action="dismiss-install"]').catch(() => {}); if (await p.isVisible('.door-wc')) await p.click('.door-wc'); await w(500); }
  ok(/No upcoming events/.test(await p.textContent('#wc-step-fn')), 'reopened, No upcoming events is still there');
  // The focus names sit right on the screen: tap one, give it a next ordinance, Back returns here
  ok((await p.$$eval('#wc-step-tn .person-name', e => e.map(x => x.textContent))).join('|') === 'Emma Walsh|Marcus Bell' && await p.isVisible('#wc-step-tn .swipe-li'), 'the focus names are listed on Ward Council, ready to swipe');
  ok(/Needs a next ordinance/.test(await p.textContent('#wc-step-tn')), 'a focus name with no next ordinance says so');
  await p.click('#wc-step-tn .person-row:has-text("Marcus Bell")'); await w(500);
  ok(await p.evaluate(() => document.body.dataset.view) === 'p-wc' && !(await p.$('#person-card .need-note')), 'tapping a focus name opens it, with no confidential note under Next ordinance');
  const opts = await p.$$eval('#person-card [data-bind$=".ordinance"] option', o => o.map(x => x.value).filter(Boolean));
  await p.selectOption('#person-card [data-bind$=".ordinance"]', opts[0]); await w(200);
  await p.click('#person-card .person-done'); await w(500);
  ok(await p.evaluate(() => document.body.dataset.view) === 'wc' && await p.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done')) && await nextId() === '', 'Done returns to Ward Council; the focus names card is green and nothing is left Up next');
  ok(/Ward Council is done/.test(await p.textContent('#wc-hero .hero-count')), 'the header card says Ward Council is done');
  // Undo No upcoming events: Ward Council isn't done again
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400); await p.click('[data-action="opps-none-undo"]'); await w(300);
  await p.click('[data-action="steps-home"]'); await w(500);
  ok(await nextId() === 'wc-step-fn' && !/Ward Council is done/.test(await p.textContent('#wc-hero .hero-count')), 'Undo puts Opportunities to invite back to Up next, and Ward Council waits for it');
  // An event: its date is labeled Event date
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400); await p.click('[data-action="add-opp"]'); await w(400);
  ok((await p.textContent('#person-card .opp-screen')).includes('Event date'), 'the opportunity’s date is labeled Event date');
  await p.fill('[data-bind="find.opps.0.title"]', 'Ward Christmas party'); await p.fill('[data-bind="find.opps.0.date"]', '2026-12-12');
  await p.click('#person-card .person-done'); await w(400); await p.click('[data-action="steps-home"]'); await w(500);
  ok(await nextId() === '' && /Ward Christmas party/.test(await p.textContent('#wc-step-fn')), 'an event finishes Opportunities to invite too');
  // Add a focus name for someone on neither list
  await p.click('[data-action="add-focus"]'); await w(500); await p.keyboard.type('Samuel Ortiz'); await p.keyboard.press('Enter'); await w(200);
  await p.click('#person-card .person-done'); await w(500);
  ok((await p.$$eval('#wc-step-tn .person-name', e => e.map(x => x.textContent))).join('|') === 'Emma Walsh|Marcus Bell|Samuel Ortiz' && !(await p.isVisible('[data-action="add-focus"]')), 'Add a focus name adds a third, and the button goes once there are three');
  // The Huddle: Opportunities to invite comes before Focus names
  await p.click('.nav-home'); await w(400); await p.click('.door-hd'); await w(500);
  const order = await p.$$eval('#steps-this [data-action="open-step"]', e => e.map(x => x.dataset.a));
  ok(order.indexOf('fn') >= 0 && order.indexOf('fn') < order.indexOf('tn'), 'the Huddle lists Opportunities to invite before Focus names: ' + order.join(','));
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
