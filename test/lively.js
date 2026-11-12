// The livelier look: a header card in each step's color (ward, date, the line on what to do, and progress in the two
// meetings), a colored icon on each section row, initials beside each name, a band of the list's color at the top of
// a person's screen, a pop when a section is marked done, and a small celebration when the huddle is sent.
// Fake names only.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
const OUT = __dirname + '/out-lively'; require('fs').mkdirSync(OUT, { recursive: true });
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: ago(1) }, o);
const rr = o => Object.assign({ prefilled: true, source: '', group: '', pname: '', person: '', action: '', assigned: '', when: '', happened: '', notes: '', hneed: '' }, o);
const seed = {
  ward: 'Sample Ward', date: iso(new Date()), conducting: 'wml', attendees: ['pqa', 'rs', 'eq', 'wm', 'ftm', 'wml'], rolledFrom: ago(7),
  rr: [
    rr({ group: 'nm', source: 'New members', pname: 'Daniel Rivera', action: 'Invite him on the ward temple trip', assigned: 'Bro. Patel', when: 'Sat', happened: 'Yes', notes: 'He came with the youth' }),
    rr({ group: 'rm', source: 'Returning members', pname: 'Olivia Chen', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun', happened: 'Partly' }),
    rr({ group: 'bt', source: 'Those being taught', pname: 'Marcus Hill', action: 'Invite him to the ward dinner', assigned: 'Elders quorum', when: 'Fri', happened: 'Yes' })
  ],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: ago(12), ordinance: 'Temple baptisms', need: 'A ride to the temple', action: 'Go with the youth on Thursday', assigned: 'Bro. Patel', when: 'Thu', sac: true }), card({ name: 'Emma Walsh', bap: ago(40), temple: true, ordinance: 'Aaronic Priesthood', sac: true })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family', assigned: 'Sister Diaz', when: 'Sun' })],
    bt: [card({ name: 'Marcus Hill', bap: ago(-11), committed: true, need: 'Get to know ward members' }), card({ name: 'Samuel Ortiz' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names', action: 'A consultant visits', assigned: 'Sister Nguyen', when: 'Thu' }), card({ name: 'Marcus Bell', ordinance: '', need: '' }), card({ touched: '' })],
  find: { plan: 'Invite friends to the ward Christmas devotional', items: [{ task: 'Each family invites one friend', when: 'Sun' }] },
  referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: 'A friend from work' }],
  stepsDone: { rr: true, fn: true }, verified: { before: true, after: false }
};

(async () => {
  const b = await chromium.launch(); let bad = 0, good = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (c) good++; else bad++; };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const ctx = await b.newContext({ ...devices[dev], acceptDownloads: true });
    await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const view = () => p.evaluate(() => document.body.dataset.view);
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p.goto(BASE); await p.waitForSelector('#start-home:not([hidden])');
    await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed);
    await p.reload(); await p.waitForSelector('#start-home:not([hidden])');
    // Opening screen: header card, the four steps as a timeline, Up next, Send quiet until After the huddle is done
    const tl = await p.evaluate(() => ({ ward: document.querySelector('#start-ward').textContent, done: [...document.querySelectorAll('.tl-step')].map(e => e.classList.contains('tl-done') ? 'done' : e.classList.contains('tl-next') ? 'next' : '-').join(' '),
      icons: document.querySelectorAll('.tl-step .row-icon svg').length, quiet: document.querySelector('.actionbar [data-action="send"]').classList.contains('not-ready') }));
    ok(tl.ward === 'Sample Ward' && tl.done === 'done next - -' && tl.icons === 4 && tl.quiet && await fits(), dev + ': opening screen: ward in the header, step 1 done, step 2 up next, four icons, Send quiet');
    await p.click('.door-hd'); await p.waitForSelector('#steps-home:not([hidden])'); await p.waitForTimeout(300);
    ok(await p.isVisible('#hd-hero') && (await p.textContent('#hd-hero .hero-ward')) === 'Sample Ward' && (await p.textContent('#hd-hero .hero-count')) === '2 of 5 sections done', dev + ': Huddle header card: ward and 2 of 5 sections done');
    ok((await p.$eval('#hd-hero .hero-fill', e => e.style.width)) === '40%', dev + ': the bar is at 40%');
    ok((await p.$$eval('#steps-this .row-icon, #steps-last .row-icon', e => e.length)) === 5 && await fits(), dev + ': five section rows have icons; fits the screen');
    ok((await p.locator('#steps-attn').count()) === 0, dev + ': no Needs attention list');
    // A person's screen opens with their initials, name and list
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);
    ok((await p.$$eval('[data-group="nm"] .person-row .avatar', e => e.map(x => x.textContent).join())) === 'DR,EW', dev + ': initials beside each name');
    await p.click('[data-group="nm"] [data-action="open-person"][data-b="1"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(300);
    ok((await p.textContent('.person-head-name')) === 'Emma Walsh' && (await p.textContent('.person-head .avatar')) === 'EW' && (await p.textContent('.person-head-list')) === 'New member', dev + ': Emma Walsh’s screen opens with her initials, name and list');
    await p.fill('#person-card [data-bind$=".action"]', 'Invite her to the ward dinner'); await p.waitForTimeout(150);
    await p.click('#person-view .person-done'); await p.waitForTimeout(400); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(350);
    // Mark a section done: its check pops, the bar moves
    await p.click('[data-action="open-step"][data-a="mr"]'); await p.waitForTimeout(300);
    await p.click('[data-action="step-done"]'); await p.waitForTimeout(250);
    ok((await view()) === 'home' && await p.$eval('[data-action="open-step"][data-a="mr"] .step-num', e => e.classList.contains('pop')), dev + ': Missionary Referrals marked done: its check pops');
    await p.waitForTimeout(900);
    ok((await p.textContent('#hd-hero .hero-count')) === '3 of 5 sections done' && (await p.$eval('#hd-hero .hero-fill', e => e.style.width)) === '60%', dev + ': the bar moved to 3 of 5');
    // A new name: the header follows the typing
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);
    await p.click('[data-group="rm"] [data-action="add-person"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(300);
    ok((await p.textContent('.person-head .avatar')) === '+' && (await p.textContent('.person-head-name')) === 'New name', dev + ': a new name starts with a plus and "New name"');
    await p.fill('#person-card input[data-bind$=".name"]', 'Samuel Ortiz'); await p.waitForTimeout(200);
    ok((await p.textContent('.person-head .avatar')) === 'SO' && (await p.textContent('.person-head-name')) === 'Samuel Ortiz' && await fits(), dev + ': typing the name fills in the header');
    await p.fill('#person-card input[data-bind$=".name"]', ''); await p.waitForTimeout(200);
    await p.click('#person-view .person-done'); await p.waitForTimeout(400); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(300);
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(200);
    // Ward council
    await p.click('.door-wc'); await p.waitForTimeout(350);
    ok(await p.isVisible('#wc-hero') && (await p.textContent('#wc-hero .hero-count')) === '6 of 7 names have a next ordinance' && (await p.$$eval('#wc-rows .row-icon', e => e.length)) === 4 && await fits(), dev + ': Ward council header card and four icons');
    ok(await p.isVisible('#wc-note') && /Never add confidential information to this agenda\./.test(await p.textContent('#wc-note')), dev + ': the confidential warning is still there');
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(200);
    // Every page fits
    for (const [open, name] of [['#before-box', 'Before ward council'], ['#after-box', 'After the huddle']]) {
      await p.click(open); await p.waitForTimeout(350);
      ok(await p.isVisible(`#${open === '#before-box' ? 'bw' : 'af'}-hero`) && await fits(), dev + ': ' + name + ' has its header card and fits');
      if (open === '#after-box') await p.click('#after-done-btn'); else await p.click('#mode-bar [data-action="go-start"]');
      await p.waitForTimeout(400);
      if (!(await p.isVisible('#start-home'))) { await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(300); }
    }
    // Send: the celebration
    await p.evaluate(() => { navigator.canShare = () => false; });
    await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(400);
    if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])');
    await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.waitForTimeout(620);
    await p.screenshot({ path: `${OUT}/sent-${dev === 'iPhone SE' ? 'se' : 'i13'}.png` });
    ok(await p.$eval('#confirm-sheet .sheet', e => e.classList.contains('celebrate')) && (await p.textContent('#confirm-cheer')) === '4 people have a plan this week.' && await p.isVisible('#confirm-secondary') && await fits(), dev + ': Sent: celebration, "4 people have a plan this week.", Undo still there');
    await p.click('#confirm-primary'); await p.waitForTimeout(300);
    // An ordinary question afterwards is not a celebration
    await p.evaluate(() => document.querySelector('.clear-link').click()); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.waitForTimeout(200);
    ok(!(await p.$eval('#confirm-sheet .sheet', e => e.classList.contains('celebrate'))) && await p.isHidden('#confirm-cheer') && await p.isHidden('#confirm-sheet .confetti'), dev + ': the next question (Erase everything) is plain again');
    await p.click('#confirm-secondary').catch(() => {}); await p.waitForTimeout(200);
    ok(errs.length === 0, dev + ': no errors ' + errs.join('; '));
    await ctx.close();
  }
  for (const flag of ['huddle-cards-open', 'huddle-view-all']) {
    const ctx = await b.newContext({ ...devices['iPhone SE'] });
    await ctx.addInitScript(f => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', f].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} }, flag);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.waitForTimeout(400);
    ok(errs.length === 0 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), flag + ': opens with no errors and fits ' + errs.join('; '));
    ok(flag === 'huddle-view-all' ? await p.isHidden('#hd-hero') : await p.isVisible('#hd-hero'), flag + ': header card ' + (flag === 'huddle-view-all' ? 'hidden in the one-page layout' : 'shown'));
    await ctx.close();
  }
  await b.close(); console.log(`${good}/${good + bad} checks passed`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
