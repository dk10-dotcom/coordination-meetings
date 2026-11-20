// Ward Council's screen as cards, in order (Nov 19, 2026): Opportunities to invite, then the Find your focus names box
// (the Covenant Path Report and an Open Part-Member Families button, with the box's check by its heading), then the
// focus names right on the screen. The next card says Up next; a finished one gets a green check, and the focus names
// card turns green once every focus name has a next ordinance. Opportunities to invite is finished by its one button:
// Done with events listed, No upcoming events with none (adding an event doesn't finish it). The opportunity's date is
// labeled Event date. A name's Ward Council screen is plain: Make focus name, the baptism date as a line, the next
// ordinance, and a closed list of next steps on their Covenant Path Report that can be checked off there.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const st = { ward: 'Sample Ward', cp: { nm: [{ name: 'Emma Walsh', bap: '2026-11-08' }], rm: [{ name: 'Marcus Bell' }], bt: [] }, tn: [{ name: 'Emma Walsh', ordinance: 'Baptisms for the dead' }, { name: 'Marcus Bell' }] };
  const c = await b.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 640 } });
  await c.addInitScript(s => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-gate-off'].forEach(k => localStorage.setItem(k, '1')); if (!localStorage.getItem('__seeded')) { localStorage.setItem('huddle-agenda-v1', s); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, JSON.stringify(st));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = ms => p.waitForTimeout(ms);
  const nextId = () => p.evaluate(() => { const u = document.querySelector('#wc-rows .wc-up-next'); return u ? u.closest('[id]').id : ''; });
  const doneIds = () => p.evaluate(() => Array.from(document.querySelectorAll('#wc-rows .is-done')).map(e => e.id).filter(Boolean).join('|'));
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const view = () => p.evaluate(() => document.body.dataset.view);
  await p.goto(BASE); await w(900); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('.door-wc'); await w(500);
  ok(await nextId() === 'wc-step-fn' && await doneIds() === '', 'a new week: Opportunities to invite is Up next and nothing is checked yet');
  ok(await p.evaluate(() => Array.from(document.querySelectorAll('#wc-rows > [id]')).map(e => e.id).join('|')) === 'wc-step-fn|wc-step-ask|wc-find|wc-step-tn' && /Has anyone completed a step on their Covenant Path this week\?/.test(await p.textContent('#wc-step-ask')), 'the cards in order: Opportunities to invite, Ask ward council, Find your focus names, Focus names');
  ok(await p.locator('#wc-find .wc-done-tick, #wc-find-tick').count() === 0 && !(await p.evaluate(() => document.querySelector('#wc-find').classList.contains('is-next'))), 'Find your focus names is a tool box, with no check of its own');
  ok(await p.evaluate(() => !!document.querySelector('#wc-find #wc-step-cp') && !!document.querySelector('#wc-find #wc-pmf')), 'the Covenant Path Report and Open Part-Member Families share the box');
  ok(/0 of 3 done · next: Opportunities to invite/.test(await p.textContent('#wc-hero .hero-count')), 'the header card says what’s next: ' + await p.textContent('#wc-hero .hero-count'));
  ok(await fits(), 'Ward Council fits a 320 px screen');
  // Opportunities to invite: one button at the bottom
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(500);
  ok(await p.isVisible('#fn-list [data-action="add-opp"]:has-text("Add an event")') && (await p.textContent('#step-done-btn')).trim() === 'No upcoming events' && await p.locator('#fn-list [data-action="opps-none"]').count() === 0, 'with no events, the button at the bottom says No upcoming events (and Add an event is in the list)');
  ok(!(await p.isVisible('#fn-list [data-info="opp-what"]')), 'the hint about what counts is tucked behind an i');
  await p.click('#fn-list .info-i[data-a="opp-what"]'); await w(150);
  ok(/Ward activities, special meetings and other events to invite friends to\./.test(await p.textContent('#fn-list [data-info="opp-what"]')) && await p.isVisible('#fn-list [data-info="opp-what"]'), 'tapping the i shows what an opportunity is');
  await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'wc' && await nextId() === 'wc-step-ask' && /wc-step-fn/.test(await doneIds()) && /No upcoming events/.test(await p.textContent('#wc-step-fn')), 'No upcoming events goes back to Ward Council: Opportunities to invite has its check and Ask ward council is Up next');
  // Ask ward council: the Covenant Path Report's lists, with No changes this week, or Done once a step is checked off
  await p.click('#wc-step-ask [data-action="open-wc-list"]'); await w(400);
  ok(await view() === 'wc-cp' && /Ask ward council/.test(await p.textContent('#wc-list .ask-q')) && (await p.textContent('#step-done-btn')).trim() === 'No changes this week' && await p.locator('#wc-list .btn-tools').count() === 0 && await p.isVisible('#wc-list .quiet-link'), 'Ask ward council opens the lists with its question, a quiet link to the report, and No changes this week');
  ok(!/next ordinance/i.test(await p.textContent('#wc-list')), 'the Covenant Path Report lists say nothing about a next ordinance');
  await p.click('#wc-list [data-wc="nm"] [data-action="open-person"][data-b="0"]'); await w(400);
  ok(await p.locator('#person-card [data-bind$=".ordinance"]').count() === 0 && await p.isVisible('#person-card .ns-list'), 'a Covenant Path name has no next ordinance here; its next steps are open to check off');
  await p.click('#person-card .ns-list [data-action="check-item"][data-b="calling"]'); await w(250);
  await p.click('#person-card .person-done'); await w(400);
  ok((await p.textContent('#step-done-btn')).trim() === 'Done', 'once a step is checked off, the button says Done');
  await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'wc' && await nextId() === 'wc-step-tn' && /wc-step-ask/.test(await doneIds()), 'Done goes back to Ward Council: Ask ward council has its check and Focus names is Up next');
  ok(!(await p.evaluate(() => document.querySelector('.door-wc').classList.contains('tl-done'))), 'Ward Council isn’t done while a focus name has no next ordinance');
  // Reopen with the data saved
  await p.reload(); await w(900);
  if (!(await p.isVisible('#wc-rows'))) { await p.click('[data-action="dismiss-install"]').catch(() => {}); if (await p.isVisible('.door-wc')) await p.click('.door-wc'); await w(500); }
  ok(/No upcoming events/.test(await p.textContent('#wc-step-fn')), 'reopened, No upcoming events is still there');
  // The focus names sit right on the screen
  ok((await p.$$eval('#wc-step-tn .person-name', e => e.map(x => x.textContent))).join('|') === 'Emma Walsh|Marcus Bell' && await p.isVisible('#wc-step-tn .swipe-li'), 'the focus names are listed on Ward Council, ready to swipe');
  ok(await p.isVisible('#wc-step-tn .swipe-hint') && /Swipe a name left/.test(await p.textContent('#wc-step-tn .swipe-hint')), 'the first swipeable list says how to remove a name');
  await p.click('#wc-step-tn [data-action="swipe-hint-ok"]'); await w(200);
  ok(!(await p.isVisible('.swipe-hint')), 'Got it puts the hint away');
  await p.click('#wc-step-tn .person-row:has-text("Marcus Bell")'); await w(500);
  ok(await view() === 'p-wc' && !(await p.$('#person-card .need-note')) && !(await p.$('#person-card .zone-label')) && !(await p.$('#person-card .wc-summary, #person-card .zone-hd-wrap, #person-card .hd-summary')), 'a focus name’s Ward Council screen has no zone label, no Huddle box and no confidential note');
  ok(/next steps? on their Covenant Path Report/.test(await p.textContent('#person-card .ns-head')) && await p.locator('#person-card .ns-list').count() === 0, 'their next steps on the Covenant Path Report sit in a closed list');
  await p.click('#person-card [data-action="ns-toggle"]'); await w(200);
  const before = (await p.textContent('#person-card .ns-head')).match(/\d+/)[0];
  await p.click('#person-card .ns-list [data-action="check-item"][data-b="calling"]'); await w(250);
  const st1 = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
  ok(+((await p.textContent('#person-card .ns-head')).match(/\d+/)[0]) === before - 1 && st1.cp.rm[0].checks && st1.cp.rm[0].checks.calling === true && await p.isVisible('#person-card .ns-list [data-b="calling"]'), 'checking one off marks it done on their Covenant Path Report, and it stays in view');
  const opts = await p.$$eval('#person-card [data-bind$=".ordinance"] option', o => o.map(x => x.value).filter(Boolean));
  await p.selectOption('#person-card [data-bind$=".ordinance"]', opts[0]); await w(200);
  await p.click('#person-card .person-done'); await w(500);
  ok(await view() === 'wc' && !(await p.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done'))) && (await p.textContent('#wc-step-tn .wc-keep')).trim() === 'Keep these focus names', 'with every next ordinance chosen, the card offers Keep these focus names (it starts unchecked each week)');
  await p.click('#wc-step-tn .wc-keep'); await w(400);
  ok(await p.evaluate(() => document.querySelector('#wc-step-tn').classList.contains('is-done')) && await nextId() === '', 'Keep these focus names turns the card green; nothing is left Up next');
  ok(/Ward Council is done/.test(await p.textContent('#wc-hero .hero-count')), 'the header card says Ward Council is done');
  // A new member's Ward Council screen: the baptism date is a plain line
  await p.click('[data-action="open-wc-list"][data-a="cp"]'); await w(400);
  await p.click('[data-wc="nm"] [data-action="open-person"][data-b="0"]'); await w(400);
  ok(/Baptized\s*Nov 8/.test((await p.textContent('#person-card .wc-bap')).replace(/:/g, '')) && !(await p.$('#person-card [data-bind$=".bap"]')), 'a new member’s baptism date is a plain line, not a box');
  await p.click('#person-card .person-done'); await w(300); await p.click('[data-action="steps-home"]'); await w(400);
  // Undo No upcoming events: Ward Council isn't done again
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400); await p.click('#step-foot .undone-link'); await w(300);
  await p.click('[data-action="steps-home"]'); await w(500);
  ok(await nextId() === 'wc-step-fn' && !/Ward Council is done/.test(await p.textContent('#wc-hero .hero-count')), 'Mark as not done puts Opportunities to invite back to Up next, and Ward Council waits for it');
  // An event: Event date; adding it doesn't finish the card, Done does
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400); await p.click('[data-action="add-opp"]'); await w(400);
  ok((await p.textContent('#person-card .opp-screen')).includes('Event date'), 'the opportunity’s date is labeled Event date');
  await p.fill('[data-bind="find.opps.0.title"]', 'Ward Christmas party'); await p.fill('[data-bind="find.opps.0.date"]', '2026-12-12');
  await p.click('#person-card .person-done'); await w(400);
  ok((await p.textContent('#step-done-btn')).trim() === 'Done', 'with an event listed, the button says Done');
  await p.click('[data-action="steps-home"]'); await w(400);
  ok(await nextId() === 'wc-step-fn', 'adding an event doesn’t check the card off by itself');
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await w(400); await p.click('#step-done-btn'); await w(500);
  ok(await view() === 'wc' && await nextId() === '' && /Ward Christmas party/.test(await p.textContent('#wc-step-fn')), 'Done checks it off and goes back to Ward Council');
  // Add a focus name for someone on neither list
  await p.click('[data-action="add-focus"]'); await w(500); await p.keyboard.type('Samuel Ortiz'); await p.keyboard.press('Enter'); await w(200);
  await p.click('#person-card .person-done'); await w(500);
  ok((await p.$$eval('#wc-step-tn .person-name', e => e.map(x => x.textContent))).join('|') === 'Emma Walsh|Marcus Bell|Samuel Ortiz' && !(await p.isVisible('[data-action="add-focus"]')), 'Add a focus name adds a third, and the button goes once there are three');
  // Find your focus names → the Covenant Path Report: a picker with Add to focus names, and nothing else
  await p.click('#wc-step-cp [data-action="open-wc-list"]'); await w(400);
  ok(await view() === 'wc-pick' && (await p.textContent('#step-title')) === 'Find your focus names' && await p.locator('#wc-list .ask-q, #wc-list .quiet-link').count() === 0, 'Find your focus names opens a picker, without the Ask ward council question or report link');
  ok(await p.locator('#wc-list [data-pick="rm"] .pick-on').count() === 1 && await p.locator('#wc-list [data-action="pick-focus"]').count() === 0, 'names already focus names say so (Emma and Marcus here)');
  ok(!(await p.isVisible('#step-done-btn')) && await fits(), 'no button at the bottom, and it fits a small phone');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(passed + '/' + (passed + failed) + ' checks passed');
  process.exit(failed ? 1 : 0);
})();
