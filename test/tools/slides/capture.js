// Walks through a week in Huddle on an iPhone-sized screen and saves each moment the video shows:
// a JPEG of the phone screen and the box of the thing to tap (drawn as a ring in the video).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const seed = require('./seed.js');
const OUT = require('path').join(__dirname, '..', '..', 'out-slides', 'cap'); fs.mkdirSync(OUT, { recursive: true }); const shots = [];
module.exports = (async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
  const wait = ms => p.waitForTimeout(ms);
  // Save the screen. `ring` is a selector (or [selector, n]) to circle; `scroll` brings it into view first.
  const shot = async (id, ring, opts = {}) => {
    let box = null;
    if (ring) {
      const loc = Array.isArray(ring) ? p.locator(ring[0]).nth(ring[1]) : p.locator(ring).first();
      if (opts.scroll !== false) { await loc.evaluate((e, blk) => e.scrollIntoView({ block: blk }), opts.block || 'center'); }
      await wait(700);
      box = await loc.boundingBox();
    } else await wait(700);
    await p.screenshot({ path: `${OUT}/${id}.jpg`, type: 'jpeg', quality: 92 });
    shots.push({ id, box });
  };
  const back = async () => { await p.goBack(); await wait(450); };
  // Mark done goes straight on to the next section, so a section is opened only when it isn't already showing.
  const openStep = async id => { if (await p.evaluate(() => document.body.dataset.view) === id) return; if (!(await p.isVisible('#steps-home'))) { await p.click('.nav-home'); await wait(300); await p.click('.door-hd'); await wait(500); } await p.click(`[data-action="open-step"][data-a="${id}"]`); await wait(500); };
  const start = async () => { await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await wait(400); };

  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])');
  await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed);
  await p.reload(); await p.waitForSelector('#start-home:not([hidden])'); await wait(500);
  await p.evaluate(() => { const t = document.getElementById('toast'); new MutationObserver(() => { t.style.setProperty('display', 'none', 'important'); }).observe(t, { attributes: true }); t.style.setProperty('display', 'none', 'important'); }); // the video explains each step itself
  await shot('s01-start');
  await shot('s02-start-step1', '#before-box', { scroll: false });
  // Step 1
  await p.click('#before-box'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await shot('s03-bw', '#bw-view .btn-tools', { scroll: false });
  await shot('s04-bw-list', '[data-bw="nm"] [data-action="row-toggle"] >> nth=0');
  await p.click('[data-bw="nm"] [data-action="row-toggle"] >> nth=0'); await wait(500); // a name opens its steps right in the list
  for (const k of ['calling', 'ministers']) { await p.click(`[data-bw="nm"] .exp-body [data-action="check-item"][data-b="${k}"]`); await wait(200); }
  await shot('s05-bw-person', '[data-bw="nm"] .exp-li.is-open', { block: 'start' });
  await shot('s06-bw-done', '#before-done-btn', { block: 'end' });
  await p.click('#before-done-btn'); await wait(600);
  if (!(await p.isVisible('#start-home'))) await start();
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s07-start-after1', '.door-wc', { scroll: false });
  // Step 2
  await p.click('.door-wc'); await wait(500);
  await shot('s08-wc', '#wc-step-fn', { scroll: false });
  // Opportunities to invite comes first
  await p.click('[data-action="open-wc-list"][data-a="fn"]'); await wait(500);
  await p.click('[data-action="add-opp"]'); await wait(300);
  await p.fill('[data-bind="find.opps.0.title"]', 'Christmas sacrament meeting'); await p.fill('[data-bind="find.opps.0.date"]', '2026-12-20');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await wait(300);
  await shot('s12b-wc-opp', '#person-card [data-bind$=".date"]', { block: 'center' });
  await back(); await p.click('#step-done-btn'); await wait(600); // Done: back to Ward Council
  // Ask ward council: the Covenant Path Report's lists, to check off steps the council knows about
  await p.click('#wc-step-ask [data-action="open-wc-list"]'); await wait(500);
  await shot('s09-wc-cp', '#wc-list .ask-q', { scroll: false });
  await p.click('[data-wc="nm"] [data-action="how-help"]'); await wait(500);
  await shot('s18-howhelp');
  await p.click('#howhelp-sheet [data-action="close-how-help"]'); await wait(400);
  await p.click('[data-wc="nm"] [data-action="row-toggle"] >> nth=0'); await wait(500); // its open steps, right in the list
  await p.click('[data-wc="nm"] .exp-body [data-action="check-item"][aria-checked="false"]'); await wait(300);
  await shot('s10-wc-person', '[data-wc="nm"] .exp-li.is-open', { block: 'start' });
  await p.click('#step-done-btn'); await wait(600); // Done: back to Ward Council
  // Find names: the Covenant Path Report button in the Focus names card, then Add to focus names
  await shot('s12a-wc-finds', '#wc-step-tn .wc-finds', { block: 'center' });
  await p.click('#wc-step-tn [data-a="pick"]'); await wait(500);
  const hasSug = !!(await p.$('.pick-li.flag-sug [data-action="pick-focus"]'));
  const pickLi = hasSug ? '.pick-li.flag-sug:has([data-action="pick-focus"])' : '.pick-li:has([data-action="pick-focus"])';
  if (await p.isVisible(pickLi)) { await shot('s12p-wc-pick', pickLi); await p.click(pickLi + ' [data-action="pick-focus"] >> nth=0'); await wait(500); }
  else console.log('note: no name to add in the picker');
  await back();
  // The focus names sit right on Ward Council: a next ordinance for each, then Keep these focus names
  for (let k = 0; k < 6; k++) {
    const row = await p.$('#wc-step-tn .person-row:has(.fold-tag.due)'); if (!row) break;
    await row.click(); await wait(400); await p.evaluate(() => scrollTo(0, 0));
    const opts = await p.$$eval('#person-card [data-bind$=".ordinance"] option', o => o.map(x => x.value).filter(Boolean));
    await p.selectOption('#person-card [data-bind$=".ordinance"]', opts[0]); await wait(200);
    if (!k) await shot('s11-wc-focus-person', '#person-card [data-bind$=".ordinance"]');
    await back();
  }
  if (await p.isVisible('#wc-step-tn .wc-keep')) { await p.click('#wc-step-tn .wc-keep'); await wait(500); } // (making a focus name already counts)
  await shot('s12-wc-done', '#wc-step-tn', { block: 'center' });
  await start();
  // Step 3
  await shot('s13-start-up3', '.door-hd', { block: 'center' });
  await p.click('.door-hd'); await p.waitForSelector('#steps-home:not([hidden])'); await wait(500);
  await shot('s14-huddle', '#hd-hero .hero-progress', { scroll: false });
  await p.click('#details-summary'); await wait(400);
  for (const t of ['Priests quorum assistant', 'Relief Society', 'Elders Quorum', 'Ward missionaries', 'Full-time missionaries', 'Ward mission leader']) { await p.click(`#attendee-list button:has-text("${t}")`); await wait(80); }
  await shot('s15-attendance', '#attendee-list button:has-text("Priests quorum assistant")', { block: 'center' });
  await p.click('#details-full [data-action="close-details"]'); await wait(400); await p.evaluate(() => scrollTo(0, 0));
  await p.click('[data-action="open-step"][data-a="rr"]'); await wait(500);
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]'); await wait(250);
  await p.fill('#rr-list textarea, #rr-list input[data-bind$=".notes"]', 'He came with the youth').catch(() => {}); await wait(200);
  await shot('s16-rr', '[data-action="happened"][data-a="0"][data-b="Yes"]', { block: 'center' });
  await p.click('[data-action="happened"][data-a="1"][data-b="Partly"]'); await p.click('[data-action="happened"][data-a="2"][data-b="Yes"]'); await wait(200);
  await p.click('#step-done-btn'); await wait(600);
  // Sacrament attendance: one tap each
  await openStep('sa');
  for (const [g, i] of [['nm', 0], ['rm', 0], ['bt', 0]]) { await p.click(`#sa-list [data-a="${g}"][data-b="${i}"]`); await wait(150); }
  await shot('s17-sa', '#sa-list [data-a="nm"][data-b="0"]', { scroll: false });
  await p.click('#step-done-btn'); await wait(600);
  // Opportunities to invite: the ward council's opportunity opened, an assignment showing the ways to invite
  await openStep('fn');
  await p.click('#fn-list [data-a="opp"]'); await wait(500);
  await p.click('#person-card [data-action="add-fn"]'); await wait(300);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await shot('s24-fn', '#person-card .invite-ideas', { block: 'center' });
  await p.fill('#person-card [data-bind$=".task"]', 'Invite the Ortiz family to the Christmas program'); await wait(200);
  await p.click('#person-view .person-done'); await wait(500);
  await p.click('#step-done-btn'); await wait(800);
  // Focus names: an action item for each
  await openStep('tn');
  await p.click('[data-group="tn"] .person-row:has-text("Daniel Rivera")'); await wait(500);
  await shot('s19-person-sac', '#person-card .zone-hd-wrap', { block: 'start' });
  await p.fill('#person-card [data-bind$=".action"]', 'Go with the youth to the temple on Thursday');
  await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Patel'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-19'); await wait(300);
  await shot('s20-person-action', '#person-card [data-bind$=".action"]', { block: 'center' });
  await shot('s22-person-text', '#person-card [data-action="text-assign"]', { block: 'center' });
  await shot('s21-hd-note', '#person-card .need-note', { block: 'center' }); // the reminder sits under the notes
  await p.click('#person-view .person-done'); await wait(500);
  for (const [name, act, who, when] of [['Grace Thompson', 'A family history consultant visits', 'Sister Nguyen', '2026-11-19'], ['Marcus Bell', 'Sit with him at church', 'Bro. Hansen', '2026-11-22']]) {
    await p.click(`[data-group="tn"] .person-row:has-text("${name}")`); await wait(350);
    await p.fill('#person-card [data-bind$=".action"]', act); await p.fill('#person-card [data-bind$=".assigned"]', who); await p.fill('#person-card [data-bind$=".when"]', when);
    await p.click('#person-view .person-done'); await wait(350);
  }
  await p.evaluate(() => scrollTo(0, 0)); await shot('s23-hd-tn-done');
  await p.click('#step-done-btn'); await wait(600);
  if (!(await p.isVisible('#steps-home'))) { await p.click('.door-hd'); await wait(600); } // the last Mark done goes home
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s25-huddle-all', '#hd-hero .hero-progress', { scroll: false });
  await start();
  // Step 4
  await shot('s26-start-up4', '#after-box', { block: 'center' });
  await p.click('#after-box'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await shot('s27-after', '#af-view .btn-tools', { scroll: false });
  for (let k = 0; k < 12 && await p.$('[data-action="after-upd"][aria-checked="false"]'); k++) { await p.click('[data-action="after-upd"][aria-checked="false"]'); await wait(200); } // tick each changed name
  await shot('s28-after-done', '#after-done-btn', { block: 'end' });
  await p.click('#after-done-btn'); await wait(600);
  if (!(await p.isVisible('#start-home'))) await start();
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s29-start-ready', '.actionbar [data-action="send"]', { scroll: false });
  await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => new Promise(r => setTimeout(r, 300)); });
  await p.click('.actionbar [data-action="send"]'); await wait(500);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForSelector('#share-btn:not([disabled])');
  await shot('s30-send', '#share-btn', { scroll: false });
  await p.click('#share-btn'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await wait(1800);
  await shot('s31-sent');
  await p.click('#confirm-primary'); await wait(500);
  await p.click('.door-hd'); await wait(500); await p.click('[data-action="open-step"][data-a="rr"]'); await wait(600);
  await shot('s32-next-week-rr');
  fs.writeFileSync(OUT + '/shots.json', JSON.stringify(shots, null, 1));
  console.log(shots.length, 'shots; errors:', errs.join('; ') || 'none');
  await b.close();
});
