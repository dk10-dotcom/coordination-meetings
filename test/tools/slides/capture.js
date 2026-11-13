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
  await shot('s04-bw-list', '[data-bw="nm"] [data-action="open-person"][data-b="0"]');
  await p.click('[data-bw="nm"] [data-action="open-person"][data-b="0"]'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await shot('s05-bw-person');
  await back();
  await shot('s06-bw-done', '#before-done-btn', { block: 'end' });
  await p.click('#before-done-btn'); await wait(600);
  if (!(await p.isVisible('#start-home'))) await start();
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s07-start-after1', '.door-wc', { scroll: false });
  // Step 2
  await p.click('.door-wc'); await wait(500);
  await shot('s08-wc', '[data-action="open-wc-list"][data-a="cp"]', { scroll: false });
  await p.click('[data-action="open-wc-list"][data-a="cp"]'); await wait(500);
  await shot('s09-wc-cp', '[data-wc="nm"] [data-action="open-person"][data-b="0"]', { scroll: false });
  await p.click('[data-wc="nm"] [data-action="open-person"][data-b="0"]'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await shot('s10-wc-person', '#person-card [data-bind$=".need"]');
  await back(); await back();
  await p.click('[data-action="open-wc-list"][data-a="tn"]'); await wait(500);
  await p.click('[data-wc="tn"] [data-action="open-person"][data-b="1"]'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await p.selectOption('#person-card [data-bind$=".ordinance"]', 'Baptism'); await p.fill('#person-card [data-bind$=".need"]', 'Someone to sit with at church'); await wait(200);
  await shot('s11-wc-focus-person', '#person-card [data-bind$=".ordinance"]');
  await back(); await back();
  await shot('s12-wc-note', '#wc-note', { block: 'center' });
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
  await p.click('[data-action="step-done"]'); await wait(600);
  await p.click('[data-action="open-step"][data-a="cp"]'); await wait(500);
  await shot('s17-hd-cp', '[data-group="nm"] [data-action="how-help"]', { scroll: false });
  await p.click('[data-group="nm"] [data-action="how-help"]'); await wait(500);
  await shot('s18-howhelp');
  await p.click('#howhelp-sheet [data-action="close-how-help"]'); await wait(400);
  await p.click('[data-group="nm"] [data-action="open-person"][data-b="0"]'); await wait(500);
  await p.click('#person-card .sac-toggle'); await wait(200);
  await shot('s19-person-sac', '#person-card .sac-toggle', { block: 'start' });
  await p.fill('#person-card [data-bind$=".action"]', 'Go with the youth to the temple on Thursday');
  await p.fill('#person-card [data-bind$=".assigned"]', 'Bro. Patel'); await p.fill('#person-card [data-bind$=".when"]', '2026-11-19'); await wait(300);
  await shot('s20-person-action', '#person-card [data-bind$=".action"]', { block: 'center' });
  await shot('s21-person-temple', '#person-card .temple-box', { block: 'center' });
  await shot('s22-person-text', '#person-card [data-action="text-assign"]', { block: 'center' });
  await p.click('#person-view .person-done'); await wait(500);
  // fill the rest quietly so the week looks finished
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('huddle-agenda-v1'));
    return true;
  });
  for (const [g, i, act, who, when] of [['nm', 1, 'Ask her to give the prayer in Young Women', 'Sister Lee', '2026-11-18'], ['rm', 0, 'Sit with her family at sacrament meeting', 'Sister Diaz', '2026-11-22'], ['bt', 0, 'Home evening with the Patel family', 'Bro. Patel', '2026-11-16'], ['bt', 1, 'Invite him to the ward Christmas devotional', 'Bro. Young', '2026-11-22']]) {
    await p.click(`[data-group="${g}"] [data-action="open-person"][data-b="${i}"]`); await wait(350);
    await p.fill('#person-card [data-bind$=".action"]', act); await p.fill('#person-card [data-bind$=".assigned"]', who); await p.fill('#person-card [data-bind$=".when"]', when);
    await p.click('#person-view .person-done'); await wait(350);
  }
  await p.evaluate(() => scrollTo(0, 0)); await shot('s23-hd-cp-done');
  await p.click('[data-action="step-done"]'); await wait(600);
  for (const [i, act, who, when] of [[0, 'A family history consultant visits', 'Sister Nguyen', '2026-11-19'], [1, 'Sit with him at church', 'Bro. Hansen', '2026-11-22']]) {
    await p.click('[data-action="open-step"][data-a="tn"]'); await wait(350);
    await p.click(`[data-group="tn"] [data-action="open-person"][data-b="${i}"]`); await wait(350);
    await p.fill('#person-card [data-bind$=".action"]', act); await p.fill('#person-card [data-bind$=".assigned"]', who); await p.fill('#person-card [data-bind$=".when"]', when);
    await p.click('#person-view .person-done'); await wait(350); await back();
  }
  await p.click('[data-action="open-step"][data-a="tn"]'); await wait(350); await p.click('[data-action="step-done"]'); await wait(500);
  await p.click('[data-action="open-step"][data-a="fn"]'); await wait(500);
  await p.fill('[data-bind="find.plan"]', 'Invite friends to the ward Christmas devotional');
  await p.fill('[data-bind="find.items.0.task"]', 'Each family invites one friend'); await p.fill('[data-bind="find.items.0.when"]', '2026-11-22'); await wait(300);
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s24-fn', '[data-step="fn"] .how-help-fn', { scroll: false });
  await p.click('[data-action="step-done"]'); await wait(500);
  await p.click('[data-action="open-step"][data-a="mr"]'); await wait(400); await p.click('[data-action="step-done"]'); await wait(800);
  await p.evaluate(() => scrollTo(0, 0));
  await shot('s25-huddle-all', '#hd-hero .hero-progress', { scroll: false });
  await start();
  // Step 4
  await shot('s26-start-up4', '#after-box', { block: 'center' });
  await p.click('#after-box'); await wait(500); await p.evaluate(() => scrollTo(0, 0));
  await shot('s27-after', '#af-view .btn-tools', { scroll: false });
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
