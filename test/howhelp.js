// "How can we help?": a small link under each Covenant Path list's name in the Huddle, and one in the Huddle's
// Find New People to Teach. It slides up that section's questions from Preach My Gospel, chapter 13, with a link
// to the chapter. Nothing is typed, nothing is saved, and none of it goes on the PDF. Also checked here: the three
// list names stand out (large, bold, on a band of the list's color), and every list of questions or tips names
// its source with a link to the Gospel Library.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = 'test/out-howhelp'; fs.mkdirSync(OUT, { recursive: true });

const PMG = 'https://www.churchofjesuschrist.org/study/manual/preach-my-gospel-2023/21-chapter-13?lang=eng';
const GH = 'https://www.churchofjesuschrist.org/study/manual/general-handbook/23-sharing-the-gospel-and-strengthening-new-and-returning-members?lang=eng';
const IDEAS = 'https://www.churchofjesuschrist.org/study/manual/sharing-the-gospel-resources-for-leaders/02-effective-coordination-with-missionaries?lang=eng';
// What each panel shows: the app's name for the list, the manual's question, how many items, and the first one.
const PANELS = {
  nm: { list: 'New members', title: 'How can we help those who were recently baptized?', n: 6, first: 'Which new members in their first year of membership are attending sacrament meeting? How can we help any who are not attending?', last: 'Review My Covenant Path progress for each new member.' },
  rm: { list: 'Returning members', title: 'How can we help returning members?', n: 4, first: 'Which part-member families can the missionaries visit and teach?', last: 'How can we help these members?' },
  bt: { list: 'Those being taught', title: 'How can we help those being taught?', n: 3, first: 'Which members could participate in the lessons this coming week? Who will invite them to participate?', last: 'What are the needs for those with a scheduled baptismal date? Has the baptism been planned?' },
  fn: { list: 'Find New People to Teach', title: 'How can we find more people to teach?', n: 2, first: 'How can we help individuals, including youth, and families apply the principles of love, share, and invite?', last: 'How can we help members, including Primary leaders, invite friends to ward activities?' }
};
// Words that appear only in the questions, never in the made-up huddle below: none may reach the PDF.
const QUESTION_WORDS = ['How can we help', 'Preach My Gospel', 'ministering brothers', 'part-member', 'scheduled baptismal date', 'love, share, and invite', 'deceased ancestors', 'Possible discussion'];

const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-07' }, o);
const huddle = {
  ward: 'Sample Ward', date: '2026-11-08', conducting: 'wml', attendees: ['rs', 'eq', 'wm', 'ftm', 'wml'], rr: [],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: '2026-10-27', ordinance: 'Temple baptisms', need: 'A ride to the temple', action: 'Go with the youth on Thursday', assigned: 'Bro. Patel', when: 'Thu', sac: true }), card({ name: 'Emma Walsh', bap: '2026-10-18', temple: true, ordinance: 'Aaronic Priesthood' })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family', assigned: 'Sister Diaz', when: 'Sun' })],
    bt: [card({ name: 'Marcus Hill', bap: '2026-11-22', committed: true, need: 'Get to know ward members', action: 'Home evening with the Patel family', assigned: 'Bro. Patel', when: 'Mon' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names', action: 'A consultant visits', assigned: 'Sister Nguyen', when: 'Thu' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: 'Invite friends to the ward Christmas devotional', items: [{ task: 'Each family invites one friend', when: 'Sun' }] },
  referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: 'A friend from work' }],
  verified: { before: true, after: true }
};

(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev], acceptDownloads: true });
    // The saved huddle is put in place before the app starts, so this is the app reopening with a week already saved.
    await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.setFixedTime(new Date('2026-11-08T10:00:00'));
    const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const back = async () => { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(300); };
    const shown = () => p.isVisible('#howhelp-sheet');
    const linksShown = () => p.locator('[data-action="how-help"]:visible').count();
    const panel = () => p.evaluate(() => ({
      kicker: document.querySelector('#howhelp-kicker').textContent, title: document.querySelector('#howhelp-title').textContent,
      items: Array.prototype.map.call(document.querySelectorAll('#howhelp-list li'), li => li.textContent),
      source: document.querySelector('#howhelp-source').textContent.trim(), href: document.querySelector('#howhelp-source a').getAttribute('href'),
      target: document.querySelector('#howhelp-source a').target, rel: document.querySelector('#howhelp-source a').rel,
      fields: document.querySelectorAll('#howhelp-sheet input, #howhelp-sheet textarea, #howhelp-sheet select, #howhelp-sheet [contenteditable]').length,
      buttons: document.querySelectorAll('#howhelp-sheet button').length,
      fits: document.querySelector('#howhelp-sheet .sheet').scrollWidth <= document.querySelector('#howhelp-sheet .sheet').clientWidth
    }));
    const checkPanel = async (id, where) => {
      const want = PANELS[id], got = await panel();
      ok(got.kicker === want.list && got.title === want.title, `${tag}: ${where}: the panel is headed "${want.list}" and "${want.title}"`);
      ok(got.items.length === want.n && got.items[0] === want.first && got.items[want.n - 1] === want.last, `${tag}: ${where}: it lists that section's ${want.n} questions, in the manual's words`);
      const others = Object.keys(PANELS).filter(k => k !== id).map(k => PANELS[k].first);
      ok(!got.items.some(t => others.includes(t)), `${tag}: ${where}: and no other section's questions`);
      ok(got.source === 'From Preach My Gospel, chapter 13' && got.href === PMG && got.target === '_blank' && /noopener/.test(got.rel), `${tag}: ${where}: source line "From Preach My Gospel, chapter 13" links to the chapter`);
      ok(got.fields === 0 && got.buttons === 1, `${tag}: ${where}: nothing to type; the only button is the X`);
      ok(got.fits && await noOverflow(), `${tag}: ${where}: the panel fits the screen`);
    };

    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])');
    await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), huddle);
    await p.reload(); await p.waitForSelector('#start-home:not([hidden])'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    ok((await linksShown()) === 0, tag + ': no link on the opening screen');

    // ----- The Huddle's Covenant Path Report: a link under each of the three names -----
    await p.click('.door-hd'); await p.waitForSelector('#steps-home:not([hidden])');
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(350);
    const heads = await p.evaluate(() => ['nm', 'rm', 'bt'].map(g => {
      const head = document.querySelector('[data-group="' + g + '"] .list-head'), t = head.querySelector('.list-title'), c = head.querySelector('.list-count'), l = head.querySelector('[data-action="how-help"]');
      const cs = getComputedStyle(t), hs = getComputedStyle(head), tr = t.getBoundingClientRect(), cr = c.getBoundingClientRect(), lr = l ? l.getBoundingClientRect() : null, hr = head.getBoundingClientRect();
      return { g, title: t.textContent, size: parseFloat(cs.fontSize), weight: +cs.fontWeight, upper: cs.textTransform, ink: cs.color, band: hs.backgroundColor, edge: parseFloat(hs.borderLeftWidth),
        countBeside: cr.top < tr.bottom && cr.left > tr.right, link: l ? l.textContent : '', linkA: l ? l.getAttribute('data-a') : '', under: lr ? lr.top >= tr.bottom - 1 && lr.bottom <= hr.bottom + 1 : false, tall: lr ? lr.height : 0, tag: l ? l.tagName : '' };
    }));
    ok(heads.map(x => x.title).join('|') === 'New members|Returning members|Those being taught', tag + ': the three lists are New members, Returning members, Those being taught');
    ok(heads.every(x => x.link.replace('›', '').trim() === 'How can we help?' && x.linkA === x.g && x.tag === 'BUTTON'), tag + ': each has a "How can we help?" link for its own list');
    ok(heads.every(x => x.under), tag + ': the link sits right under the list’s name, inside its band');
    ok(heads.every(x => x.tall >= 40), tag + ': the link is tall enough to tap (' + heads.map(x => Math.round(x.tall)).join() + ' px)');
    ok(heads.every(x => x.size >= 18 && x.weight >= 700 && x.upper === 'none'), tag + ': the names are large and bold (' + heads.map(x => x.size + '/' + x.weight).join() + ')');
    ok(heads.every(x => x.band !== 'rgba(0, 0, 0, 0)' && x.edge >= 4) && new Set(heads.map(x => x.band)).size === 3 && new Set(heads.map(x => x.ink)).size === 3, tag + ': each sits on a band of its own color');
    ok(heads.every(x => x.countBeside), tag + ': the count stays beside the name on all three');
    ok((await linksShown()) === 3 && await noOverflow(), tag + ': three links on the page, and it fits the screen');
    await p.screenshot({ path: `${OUT}/${tag}-1-lists.png`, fullPage: true });

    const saved = () => p.evaluate(() => { window.dispatchEvent(new Event('pagehide')); return localStorage.getItem('huddle-agenda-v1'); });
    const before = await saved();
    // X closes it
    await p.click('[data-group="nm"] [data-action="how-help"]'); await p.waitForTimeout(350);
    ok(await shown(), tag + ': tapping the link under New members slides the panel up');
    await checkPanel('nm', 'New members'); await p.screenshot({ path: `${OUT}/${tag}-2-new-members.png` });
    await p.click('#howhelp-sheet [data-action="close-how-help"]'); await p.waitForTimeout(300);
    ok(!(await shown()) && (await p.evaluate(() => document.body.dataset.view)) === 'cp', tag + ': one tap on the X closes it, back on the list');
    // A tap outside closes it
    await p.click('[data-group="rm"] [data-action="how-help"]'); await p.waitForTimeout(350);
    await checkPanel('rm', 'Returning members');
    await p.mouse.click(p.viewportSize().width / 2, 14); await p.waitForTimeout(300);
    ok(!(await shown()), tag + ': one tap outside closes it');
    // Escape closes it (a keyboard)
    await p.click('[data-group="bt"] [data-action="how-help"]'); await p.waitForTimeout(350);
    await checkPanel('bt', 'Those being taught'); await p.screenshot({ path: `${OUT}/${tag}-3-being-taught.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(!(await shown()), tag + ': Escape closes it');
    ok((await saved()) === before, tag + ': opening the panels saved nothing and changed nothing');
    // A person's own screen has no link
    await p.click('[data-group="nm"] [data-action="open-person"][data-b="0"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok((await linksShown()) === 0, tag + ': a person’s screen has no link');
    await p.click('#person-view .person-done'); await p.waitForTimeout(350);
    ok((await p.evaluate(() => document.body.dataset.view)) === 'cp' && (await linksShown()) === 3, tag + ': Done returns to the list, links still there');
    await back();

    // ----- The Huddle's Find New People to Teach has its own -----
    await p.click('[data-action="open-step"][data-a="fn"]'); await p.waitForTimeout(350);
    ok((await linksShown()) === 1 && await p.isVisible('[data-step="fn"] .how-help-fn') && await p.isVisible('[data-action="find-tips"]'), tag + ': Find New People to Teach has its own link, with the Tips button still there');
    await p.click('[data-step="fn"] [data-action="how-help"]'); await p.waitForTimeout(350);
    await checkPanel('fn', 'Find New People to Teach'); await p.screenshot({ path: `${OUT}/${tag}-4-finding.png` });
    await p.click('#howhelp-sheet [data-action="close-how-help"]'); await p.waitForTimeout(300);
    // Where the finding tips come from
    await p.click('[data-action="find-tips"]'); await p.waitForTimeout(350);
    const ft = await p.evaluate(() => { const a = document.querySelector('#find-tips-source a'); return { text: document.querySelector('#find-tips-source').textContent.trim(), href: a.getAttribute('href'), target: a.target, shown: !!document.querySelector('#find-tips-source').offsetParent }; });
    ok(ft.shown && ft.text === 'From “Ideas for Weekly Missionary Coordination,” Sharing the Gospel: Resources for Leaders' && ft.href === IDEAS && ft.target === '_blank', tag + ': the finding tips name their source, with a link');
    await p.click('[data-action="close-find-tips"]'); await p.waitForTimeout(300);
    await back();

    // Where the meeting tips come from
    await p.click('[data-action="tips"]'); await p.waitForTimeout(350);
    const tp = await p.evaluate(() => { const a = document.querySelector('#tips-source a'); return { text: document.querySelector('#tips-source').textContent.trim(), href: a.getAttribute('href'), target: a.target, shown: !!document.querySelector('#tips-source').offsetParent, fits: document.querySelector('#tips-sheet .sheet').scrollWidth <= document.querySelector('#tips-sheet .sheet').clientWidth }; });
    ok(tp.shown && tp.text === 'Adapted from “Ideas for Weekly Missionary Coordination,” Sharing the Gospel: Resources for Leaders' && tp.href === IDEAS && tp.target === '_blank' && tp.fits, tag + ': the meeting tips name their source, with a link');
    await p.click('[data-action="close-tips"]'); await p.waitForTimeout(300);
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(200);

    // ----- The Huddle only: Ward council and Before ward council show the bands, not the link -----
    await p.click('.door-wc'); await p.waitForTimeout(350);
    await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(350);
    const wcHeads = await p.evaluate(() => ['nm', 'rm', 'bt'].map(g => { const head = document.querySelector('[data-wc="' + g + '"] .list-head'); return { band: getComputedStyle(head).backgroundColor, size: parseFloat(getComputedStyle(head.querySelector('.list-title')).fontSize), link: !!head.querySelector('[data-action="how-help"]') }; }));
    ok(wcHeads.every(x => x.link) && (await linksShown()) === 3, tag + ': Ward council’s three lists have the link too');
    ok(wcHeads.every(x => x.band !== 'rgba(0, 0, 0, 0)' && x.size >= 18) && await noOverflow(), tag + ': Ward council’s lists have the same bold names on bands');
    await p.goBack(); await p.waitForTimeout(300);
    await p.click('[data-action="open-wc-list"][data-a="fn"]'); await p.waitForTimeout(350);
    ok((await p.evaluate(() => document.body.dataset.view)) === 'wc-fn' && (await linksShown()) === 1 && await p.isVisible('[data-action="find-tips"]'), tag + ': Ward council’s Find New People to Teach has its link too');
    await p.goBack(); await p.waitForTimeout(300); await p.goBack(); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(200);
    await p.click('#before-box'); await p.waitForTimeout(350);
    const bwHeads = await p.evaluate(() => ['nm', 'rm', 'bt'].map(g => { const head = document.querySelector('[data-bw="' + g + '"] .list-head'); return head ? { band: getComputedStyle(head).backgroundColor, link: !!head.querySelector('[data-action="how-help"]') } : null; }));
    ok(bwHeads.every(x => x && !x.link && x.band !== 'rgba(0, 0, 0, 0)') && (await linksShown()) === 0 && await noOverflow(), tag + ': Before ward council’s lists have the bands and no link');
    await p.goBack(); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(200);

    // ----- How to use and the tour say so, and Sources lists all three -----
    await p.click('[data-action="help"]'); await p.waitForSelector('#help-sheet:not([hidden])'); await p.waitForTimeout(250);
    const help = await p.evaluate(() => {
      const step = Array.prototype.filter.call(document.querySelectorAll('#help-sheet details'), d => d.querySelector('.step-title').textContent === 'Huddle')[0];
      const src = document.querySelector('#help-sources');
      return { step: step.textContent, lines: step.querySelectorAll('.help-body > li').length, title: src.querySelector('.step-title').textContent,
        links: Array.prototype.map.call(src.querySelectorAll('a'), a => a.textContent + ' -> ' + a.getAttribute('href') + ' ' + a.target), text: src.querySelector('.help-body').textContent.replace(/\s+/g, ' ').trim() };
    });
    ok(/tap How can we help\?/.test(help.step) && help.lines <= 5, tag + ': How to use, step 3 mentions the link (still five lines or fewer)');
    ok(help.title === 'Sources' && help.links.join('|') === [`Preach My Gospel, chapter 13 -> ${PMG} _blank`, `General Handbook 23.4 -> ${GH} _blank`, `“Ideas for Weekly Missionary Coordination” -> ${IDEAS} _blank`].join('|'), tag + ': How to use has a Sources row linking all three sources');
    await p.click('#help-sources summary'); await p.waitForTimeout(250); await p.$eval('#help-sources', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    ok(await p.isVisible('#help-sources .help-body a') && await noOverflow() && await p.evaluate(() => { const s = document.querySelector('#help-sheet .sheet'); return s.scrollWidth <= s.clientWidth; }), tag + ': the Sources row opens and fits the screen');
    await p.screenshot({ path: `${OUT}/${tag}-5-sources.png` });
    await p.click('#help-done'); await p.waitForTimeout(250);
    const tourText = await p.evaluate(() => fetch('tour.js').then(r => r.text()));
    ok(/tap \*\*How can we help\?\*\*/i.test(tourText), tag + ': the tour mentions the link');

    // ----- None of it goes on the PDF -----
    await p.evaluate(() => { navigator.canShare = () => false; });
    await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(300);
    if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    const pdf = `${OUT}/${tag}.pdf`; await dl.saveAs(pdf);
    const text = execFileSync('pdftotext', ['-raw', pdf, '-']).toString().replace(/\s+/g, ' ');
    ok(/Daniel Rivera/.test(text) && /Invite friends to the ward Christmas devotional/.test(text), tag + ': the PDF has the huddle’s names and plan');
    const leaked = QUESTION_WORDS.filter(w => text.toLowerCase().includes(w.toLowerCase()));
    ok(leaked.length === 0, tag + ': the PDF has none of the questions or their source' + (leaked.length ? ' (found: ' + leaked.join(', ') + ')' : ''));
    ok(!/howhelp|HOW_HELP/.test(await p.evaluate(() => localStorage.getItem('huddle-agenda-v1') || '')), tag + ': nothing about the questions is kept with the huddle');
    ok(errs.length === 0, tag + ': no errors' + (errs.length ? ' (' + errs.join('; ') + ')' : ''));
    await ctx.close();
  }

  // A brand-new app with no names yet has the links too, and so do the two layouts kept for tests
  // (every card open; the older one-page layout).
  for (const flag of ['huddle-no-flag', 'huddle-cards-open', 'huddle-view-all']) {
    const ctx = await b.newContext({ ...devices['iPhone SE'] });
    await ctx.addInitScript(f => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', f].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} }, flag);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    if (flag !== 'huddle-view-all') { await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300); }
    if (flag === 'huddle-no-flag') { // a list confirmed as "None this week" keeps its link, and still fits a small phone
      await p.click('[data-action="cp-none"][data-a="rm"]'); await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}/empty-lists.png`, fullPage: true });
    }
    const n = await p.locator('#cp-groups [data-action="how-help"]:visible').count();
    await p.click('#cp-groups [data-group="rm"] [data-action="how-help"]'); await p.waitForTimeout(350);
    const items = await p.$$eval('#howhelp-list li', l => l.length);
    ok(n === 3 && items === 4 && await p.isVisible('#howhelp-sheet'), `${flag}: three links, and Returning members opens its four questions`);
    await p.click('#howhelp-sheet [data-action="close-how-help"]'); await p.waitForTimeout(250);
    ok(await p.isHidden('#howhelp-sheet') && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && errs.length === 0, `${flag}: closes, fits the screen, no errors`);
    await ctx.close();
  }

  await b.close();
  console.log(`${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
