// Opening screen: the four steps and Send. Ward council and the Huddle list their names as rows; a name opens
// on its own screen (ward council's fields, or the huddle's card), and Done or Back returns to the list.
// Nothing is entered twice between the two views. Ward council also has Find New People to Teach and
// Missionary Referrals (the same sections the Huddle has), and its person screen mirrors the Huddle's.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-twodoor'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
    const vis = s => p.isVisible(s);
    const noOverflow = async () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const isDone = w => p.evaluate(w => document.querySelector('#' + w + '-box').classList.contains('done'), w);
    // Lists show one row per name; a name opens on its own screen.
    const openPerson = async (scope, g, i) => { await p.click(`${scope} [data-action="open-person"][data-a="${g}"][data-b="${i}"]`); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250); };
    const addPerson = async (scope, g) => { await p.click(`${scope} [data-action="add-person"][data-a="${g}"]`); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250); };
    const back = async () => { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(300); };
    const rowNames = (scope, g) => p.$$eval(`${scope} [data-${scope === '#wc-list' ? 'wc' : 'group'}="${g}"] .person-row .person-name`, e => e.map(x => x.textContent));
    const rowSub = async (scope, g, i) => (await p.textContent(`${scope} [data-action="open-person"][data-a="${g}"][data-b="${i}"] .step-status`)).trim();
    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    // Opening screen
    ok(await vis('.door-wc') && await vis('.door-hd') && await vis('.actionbar [data-action="send"]'), tag + ': opens to Ward council, Huddle and Send');
    ok(!(await vis('#steps-home')) && !(await vis('#details-summary')) && !(await vis('.info-pair')), tag + ': no date, sections or details on the opening screen');
    ok(await vis('[data-action="help"]') && await vis('[data-action="load-other"]') && !(await vis('[data-action="tips"]')), tag + ': How to use and the quiet Load link are there; Tips is not');
    ok(await noOverflow(), tag + ': opening screen fits the phone');
    ok(await vis('#before-box') && await vis('#after-box') && (await p.textContent('h1')).trim() === 'Ward Mission Leader Process', tag + ': title is Ward Mission Leader Process, with the two Covenant Path Report boxes');
    ok((await p.textContent('.app-name')).trim() === 'Huddle' && await p.title() === 'Huddle', tag + ': the app is named Huddle, on the page and in the browser');
    ok(await p.locator('#start-home input[type="checkbox"]').count() === 0 && await p.evaluate(() => ['before', 'after'].every(w => document.querySelector('#' + w + '-box').tagName === 'BUTTON')) && !(await vis('#before-box .check-tick')), tag + ': the two boxes have no check box to tap; each is one button');
    ok(await vis('.clear-link') && await vis('.fine-notes .credit-name'), tag + ': Erase everything and the footer are on the opening screen');
    // Hand off holds both ends of a handoff; the quiet link under the steps is for a PDF only
    await p.click('.actionbar [data-action="handoff"]'); await p.waitForSelector('#handoff-sheet:not([hidden])');
    ok(await p.locator('#handoff-sheet .nav-row').count() === 2 && (await p.textContent('#handoff-send')).includes('Send a handoff') && (await p.textContent('#handoff-receive')).includes('Receive a handoff') && await noOverflow(), tag + ': Hand off offers Send a handoff and Receive a handoff');
    await p.click('[data-action="close-handoff"]'); await p.waitForTimeout(200);
    ok(await p.isHidden('#handoff-sheet') && (await p.textContent('[data-action="load-other"]')).trim() === 'Load from a PDF', tag + ': Cancel closes it; the quiet link reads Load from a PDF');
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-action="load-other"]')]);
    ok(!!chooser && await p.locator('.overlay:not([hidden])').count() === 0, tag + ': Load from a PDF goes straight to choosing the file');
    // Each of the four steps opens a page of its own (none slides up as a sheet), and each page starts with one line saying what to do there
    const pages = [['#before-box', '#bw-view', '#bw-view .page-intro', 'Before ward council', 'Update each person from the Covenant Path Report: next ordinance, needs, temple attendance and sacrament attendance.'],
      ['.door-wc', '#wc-view', '#wc-intro', 'Ward council', 'Decide who to focus on, each person’s next ordinance, and what they need.'],
      ['.door-hd', '#steps-home', '#hd-intro', 'Huddle', 'Report back on the last huddle, take attendance, and plan one assignment for each person: what, who and when.'],
      ['#after-box', '#af-view', '#af-view .page-intro', 'After the huddle', 'Update the Covenant Path Report with what happened, then mark it done so you can send.']];
    const introTops = [];
    for (const [door, pageSel, introSel, title, text] of pages) {
      await p.click(door); await p.waitForSelector(pageSel + ':not([hidden])'); await p.waitForTimeout(350);
      ok(await vis(introSel) && (await p.textContent(introSel)).trim() === text && (await p.textContent('#mode-title')) === title && await vis('#mode-bar') && !(await vis('#start-home')) && await p.locator('.overlay:not([hidden])').count() === 0 && await noOverflow(), tag + ': ' + title + ' is a page with Back and one line saying what to do there');
      introTops.push(await p.evaluate(i => Math.round(document.querySelector(i).getBoundingClientRect().top - document.querySelector('#mode-bar').getBoundingClientRect().bottom), introSel));
      await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    }
    ok(introTops.every(t => t === introTops[0]), tag + ': that line sits in the same place on all four pages: ' + introTops.join(', '));
    ok(!(await vis('#hd-intro')) && !(await vis('#wc-intro')), tag + ': the lines belong to their pages, not the opening screen');
    // Before ward council: its own screen. The three Covenant Path Report lists as rows; a name opens on its own
    // screen with what the report tells you: next ordinance, needs, temple attendance and sacrament attendance.
    const bwNames = g => p.$$eval(`#before-list [data-bw="${g}"] .person-row .person-name`, e => e.map(x => x.textContent));
    const bwRow = async (g, i) => (await p.textContent(`#before-list [data-action="open-person"][data-a="${g}"][data-b="${i}"]`)).replace(/\s+/g, ' ').trim();
    const bwOpen = async (g, i) => { await p.click(`#before-list [data-action="open-person"][data-a="${g}"][data-b="${i}"]`); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250); };
    const bwDone = async () => { await p.click('#person-card .person-done'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300); };
    const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    ok((await p.textContent('#before-box .check-line')).trim() === 'Before ward council' && (await p.textContent('#before-sub')).trim() === 'Update each person from the Covenant Path Report', tag + ': the Before ward council box says what it covers');
    // The four steps are numbered, and each leads with its name
    ok((await p.$$eval('#start-home .cpr-step-k, #start-home .door-kicker', k => k.map(x => x.textContent.trim()).join('|'))) === 'Step 1|Step 2 · Who & What|Step 3 · How & When|Step 4', tag + ': the four steps are numbered 1 to 4, in order');
    ok((await p.$$eval('#start-home .check-line, #start-home .door-title', k => k.map(x => x.textContent.trim()).join('|'))) === 'Before ward council|Ward council|Huddle|After the huddle' && (await p.textContent('#after-sub')).trim() === 'Update the Covenant Path Report, then send', tag + ': each step leads with its name: Before ward council, Ward council, Huddle, After the huddle');
    // Return and Report with nothing to report: one line, not blank forms
    await p.click('.door-hd'); await p.waitForTimeout(200); await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(250);
    ok(await p.locator('#rr-list .rr-card').count() === 0 && (await p.textContent('#rr-list .rr-none')).trim() === 'Nothing to report yet. After your first huddle, its assignments show up here.' && !(await vis('[data-step="rr"] .section-head')) && await vis('[data-action="add-rr"]'), tag + ': before the first huddle, Return and Report is one line saying there is nothing to report yet');
    await p.click('[data-action="add-rr"]'); await p.waitForTimeout(250);
    ok(await p.locator('#rr-list .rr-card').count() === 1 && await p.locator('#rr-list .rr-none').count() === 0 && await vis('[data-bind="rr.0.plan"]') && await vis('[data-step="rr"] .section-head') && await noOverflow(), tag + ': Add an item shows one blank item');
    await p.click('[data-action="steps-home"]'); await p.waitForTimeout(250); await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(250);
    ok(await p.locator('#rr-list .rr-card').count() === 0 && await vis('#rr-list .rr-none'), tag + ': an item left blank is gone when the section opens again');
    await p.click('[data-action="add-rr"]'); await p.waitForTimeout(250); await p.fill('[data-bind="rr.0.plan"]', 'Deliver the ward calendar'); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(250);
    ok((await p.textContent('#steps-last .step-status')).includes('0 of 1 marked'), tag + ': an item that was filled in stays and is counted');
    await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(250); await p.click('#rr-list [data-action="remove-rr"]'); await p.waitForTimeout(250); await p.click('#confirm-primary'); await p.waitForTimeout(250);
    ok(await p.locator('#rr-list .rr-card').count() === 0 && await vis('#rr-list .rr-none'), tag + ': removing the only item brings the line back');
    await p.click('[data-action="steps-home"]'); await p.waitForTimeout(250); await p.click('[data-action="go-start"]'); await p.waitForTimeout(300);
    await p.click('[data-action="open-before"]'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    ok(await vis('#mode-bar') && (await p.textContent('#mode-title')) === 'Before ward council' && !(await vis('.actionbar')) && !(await vis('#start-home')) && await p.locator('.overlay:not([hidden])').count() === 0, tag + ': Before ward council opens as its own screen with Back, not a sheet');
    ok(await vis('#bw-view [data-tools-link]') && await p.locator('#before-list .list-panel.rows').count() === 3 && await p.locator('#before-list [data-action="add-person"]').count() === 3 && !(await p.textContent('#bw-view')).includes('Focus name 1'), tag + ': it shows the report link and the three Covenant Path lists, each ending in Add a name (no focus names)');
    const bwIntro = await p.textContent('.bw-intro');
    ok(['next ordinance', 'needs', 'temple attendance', 'sacrament attendance'].every(w => bwIntro.includes(w)), tag + ': it says what to update for each person');
    ok(await p.locator('#bw-view input, #bw-view textarea').count() === 0 && await p.evaluate(() => document.querySelector('#before-list .steps-list').className === document.querySelector('#steps-this').className + ' person-rows'), tag + ': no fields in the list; its rows are the same rows as every other list');
    // A new member from the report: the four things, on the person's own screen
    await p.click('#before-list [data-action="add-person"][data-a="nm"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok((await p.textContent('#step-title')) === 'New name' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind')) === 'cp.nm.0.name' && await p.locator('#person-card .person-bw').count() === 1 && !(await vis('#bw-view')), tag + ': Add a name opens a new person on their own screen, with the cursor in Name');
    ok((await p.$$eval('#person-card [data-bind]', e => e.map(x => x.getAttribute('data-bind').split('.').pop()).join('|'))) === 'name|bap|ordinance|need|temple|sac' && (await p.textContent('#person-card .zone-label')).trim() === 'Covenant Path Report', tag + ': a new member has name, baptism date, next ordinance, needs, temple attendance and sacrament attendance, and nothing else');
    await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.bap', daysAgo(12)); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.need', 'A ride to the temple');
    ok((await p.textContent('#step-title')) === 'Daniel Rivera' && (await p.textContent('#person-card .temple-sub')).trim() === '18 days left of 30' && await noOverflow(), tag + ': the screen takes the name, and the baptism date starts the 30-day temple count');
    await p.screenshot({ path: `${OUT}/${tag}-before-person.png`, fullPage: true });
    await bwDone();
    ok((await bwNames('nm')).join('|') === 'Daniel Rivera' && (await bwRow('nm', 0)).includes('Next: Temple baptisms · Needs: A ride to the temple') && (await bwRow('nm', 0)).includes('Temple: 18 days left') && !(await bwRow('nm', 0)).includes('Sacrament'), tag + ': Done returns to the list, whose row shows the next ordinance, needs and the temple count: ' + await bwRow('nm', 0));
    await bwOpen('nm', 0);
    await p.click('#person-card .temple-box'); await p.click('#person-card .sac-toggle'); await p.waitForTimeout(250);
    ok(await p.isChecked('[data-bind="cp.nm.0.temple"]') && await p.isChecked('[data-bind="cp.nm.0.sac"]') && !(await vis('#toast')), tag + ': temple and sacrament attendance are checked from the report, with no reminder to update the report');
    await p.goBack(); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    ok((await bwRow('nm', 0)).includes('✓ Temple') && (await bwRow('nm', 0)).includes('✓ Sacrament') && !(await bwRow('nm', 0)).includes('days left'), tag + ': the phone’s Back returns to the list too, and the row shows both as attended');
    ok(await noOverflow(), tag + ': the Before ward council list fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-before.png`, fullPage: true });
    // The same person, as ward council and the huddle see them: nothing is entered twice
    ok(await p.evaluate(() => new Promise(r => setTimeout(() => { const a = JSON.parse(localStorage.getItem('huddle-agenda-v1')).cp.nm[0]; r(a.name === 'Daniel Rivera' && a.ordinance === 'Temple baptisms' && a.need === 'A ride to the temple' && a.temple === true && a.sac === true); }, 700))), tag + ': what is entered here is the same next ordinance, needs and attendance ward council and the huddle show');
    // Someone no longer on the report: open them and remove them
    await bwOpen('nm', 0);
    await p.click('#person-card .person-remove'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')) === 'Remove Daniel Rivera?', tag + ': removing someone with details asks first');
    await p.click('#confirm-primary'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    ok((await bwNames('nm')).length === 0 && await vis('#bw-view') && !(await vis('#person-view')), tag + ': Remove from the list takes them off and returns to the list');
    // A name with nothing else yet says what is missing
    await p.click('#before-list [data-action="add-person"][data-a="rm"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok((await p.$$eval('#person-card [data-bind]', e => e.map(x => x.getAttribute('data-bind').split('.').pop()).join('|'))) === 'name|ordinance|need|sac', tag + ': a returning member has no baptism date or temple box');
    await fill('cp.rm.0.name', 'Marcus Bell'); await bwDone();
    ok((await bwNames('rm')).join('|') === 'Marcus Bell' && (await bwRow('rm', 0)).includes('Needs a next ordinance · No needs listed') && await p.locator('#before-list [data-bw="rm"] .person-row .step-status.warn').count() === 1, tag + ': a name with no next ordinance says so in orange: ' + await bwRow('rm', 0));
    await p.click('#before-list [data-action="add-person"][data-a="rm"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    await fill('cp.rm.1.name', 'marcus bell'); await p.keyboard.press('Tab'); await p.waitForTimeout(600);
    ok(await vis('#toast') && (await p.textContent('#toast')).includes('marcus bell is already on this list.') && (await p.inputValue('[data-bind="cp.rm.1.name"]')) === '' && (await p.textContent('#step-title')) === 'New name', tag + ': a name already on that list is refused');
    await bwDone();
    ok((await bwNames('rm')).join('|') === 'Marcus Bell', tag + ': so no one is listed twice');
    await p.click('#before-list [data-action="add-person"][data-a="bt"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok((await p.$$eval('#person-card [data-bind]', e => e.map(x => x.getAttribute('data-bind').split('.').pop()).join('|'))) === 'name|need|sac' && (await p.textContent('#person-card .fixed-value')).trim() === 'Baptism', tag + ': someone being taught has Baptism as the next ordinance, needs and sacrament attendance');
    await bwDone();
    ok((await bwNames('bt')).length === 0, tag + ': a name added and left empty does not stay on the list');
    // Mark done sits at the bottom of the screen
    await p.click('[data-action="before-done"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok(await isDone('before') && await vis('#before-box .check-tick') && !(await isDone('after')) && (await p.textContent('#before-sub')).includes('Done'), tag + ': Mark done returns to the opening screen and turns the box green with a check');
    // Opening it again offers to take the mark back off
    await p.click('#before-box'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    ok(await vis('#before-state') && (await p.textContent('#before-done-btn')).trim() === 'Done · Back' && (await p.textContent('#before-other-btn')).trim() === 'Marked by mistake? Mark as not done', tag + ': a box that is done shows Marked done, with Done · Back and Mark as not done');
    await p.click('#before-done-btn'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok(await isDone('before') && !(await vis('#bw-view')), tag + ': Done · Back leaves it done');
    await p.click('#before-box'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    await p.click('#before-other-btn'); await p.waitForTimeout(250);
    ok(await vis('#bw-view') && !(await vis('#before-state')) && !(await vis('#before-other-btn')) && (await p.textContent('#before-done-btn')).trim() === 'All up to date · Mark done', tag + ': Mark as not done takes the mark off and offers Mark done again');
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok(!(await isDone('before')), tag + ': Back leaves it not done');
    await p.click('#before-box'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(300);
    await p.click('[data-action="before-done"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${tag}-start.png` });
    // Ward council: two lists rolled up, like the huddle's sections
    await p.click('.door-wc');
    ok(await vis('#wc-view') && await vis('#mode-bar') && !(await vis('.actionbar')) && (await p.textContent('#mode-title')) === 'Ward council', tag + ': Ward council opens with Back, no Send bar');
    const rowText = async id => (await p.textContent(`[data-action="open-wc-list"][data-a="${id}"]`)).replace(/\s+/g, ' ');
    ok(await p.locator('#wc-rows .wc-row').count() === 4 && (await rowText('cp')).includes('Covenant Path Report') && (await rowText('tn')).includes('Focus names') && (await rowText('fn')).includes('Find New People to Teach') && (await rowText('mr')).includes('Missionary Referrals') && await p.locator('#wc-list .person-row, #wc-list .wc-card').count() === 0, tag + ': it shows two roll-ups, not the names');
    ok(await vis('#wc-note') && (await p.textContent('#wc-note strong')) === 'Never add confidential information to this agenda.' && await p.locator('#wc-view .help-warning').count() === 0, tag + ': the confidentiality reminder sits once under the two lists');
    ok(await p.evaluate(() => { const a = getComputedStyle(document.querySelector('#wc-rows .nav-row')), b2 = document.querySelector('#steps-this'); return !!a && !!b2 && document.querySelector('#wc-rows').className === b2.className; }), tag + ': ward council’s rows and the huddle’s rows are the same kind of list');
    ok((await rowText('cp')).includes('1 person · 1 needs a next ordinance') && (await rowText('tn')).includes('None chosen yet'), tag + ': each roll-up has a status: ' + await rowText('cp'));
    await p.screenshot({ path: `${OUT}/${tag}-wc.png` });
    // Name Next Ordinance: three rows; a name opens on its own screen
    await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.waitForTimeout(250);
    ok(await p.locator('#wc-list [data-wc="tn"] .person-row').count() === 3 && await p.locator('#wc-list .list-panel').count() === 1 && (await p.textContent('#step-title')) === 'Focus names' && !(await vis('#wc-rows')), tag + ': Focus names lists the three focus names as rows, with its title beside Back');
    ok(await p.locator('#wc-list input, #wc-list textarea').count() === 0 && !(await vis('#wc-note')) && (await rowNames('#wc-list', 'tn')).join('|') === 'Focus name 1|Focus name 2|Focus name 3' && await rowSub('#wc-list', 'tn', 0) === 'Tap to add', tag + ': no fields are open in the list, and empty spots say Tap to add');
    ok(await noOverflow(), tag + ': the list of names fits the phone');
    await openPerson('#wc-list', 'tn', 0);
    ok((await p.textContent('#step-title')) === 'Focus name 1' && await p.locator('#person-card .wc-card').count() === 1 && !(await vis('#wc-list')) && !(await vis('#step-foot')) && !(await vis('#person-card .person-remove')), tag + ': tapping a name opens that person on their own screen');
    ok(!(await p.getAttribute('[data-bind="tn.0.need"]', 'placeholder')).includes('Covenant Path Report'), tag + ': focus names aren’t told to look in the Covenant Path Report for needs');
    await fill('tn.0.name', 'Grace Thompson');
    ok((await p.textContent('#step-title')) === 'Grace Thompson' && await vis('#person-card .person-remove'), tag + ': the screen takes the person’s name as it’s typed');
    await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.need', 'Temple prep class');
    ok(await noOverflow(), tag + ': a person’s screen fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-wc-person.png`, fullPage: true });
    await p.click('#person-card .person-done'); await p.waitForTimeout(300);
    ok(await vis('#wc-list') && !(await vis('#person-view')) && (await p.textContent('#step-title')) === 'Focus names' && (await rowNames('#wc-list', 'tn'))[0] === 'Grace Thompson' && await rowSub('#wc-list', 'tn', 0) === 'Next: Endowment', tag + ': Done rolls back up to the list, which shows the name and next ordinance');
    await back();
    ok(await vis('#wc-rows') && (await rowText('tn')).includes('1 of 3 names · everyone has a next ordinance'), tag + ': Back returns to the roll-ups, updated: ' + await rowText('tn'));
    // Covenant Path Report lists: three lists of rows, each ending in Add a name
    await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(250);
    ok(await p.locator('#wc-list .list-panel').count() === 3 && await p.locator('#wc-list [data-wc="tn"]').count() === 0 && (await p.textContent('#step-title')) === 'Covenant Path Report', tag + ': Covenant Path Report opens the three lists');
    ok(!(await vis('#wc-intro')) && !(await vis('#wc-rows')), tag + ': Ward council’s intro line stays on its opening list, not on a list of names');
    ok((await rowNames('#wc-list', 'rm')).join('|') === 'Marcus Bell' && await rowSub('#wc-list', 'rm', 0) === 'Needs a next ordinance' && await p.locator('#wc-list [data-wc="rm"] .person-row .step-status.warn').count() === 1, tag + ': a name with no next ordinance says so in orange');
    ok(await p.locator('#wc-list [data-action="add-person"]').count() === 3 && await p.locator('#wc-list [data-action="cp-none"]').count() === 0, tag + ': each list ends in Add a name (Confirm none is the huddle’s)');
    await addPerson('#wc-list', 'nm');
    ok((await p.textContent('#step-title')) === 'New name' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind')) === 'cp.nm.0.name', tag + ': Add a name opens a new person with the cursor in Name');
    const labels = await p.$$eval('#person-card .wc-card label', ls => ls.map(l => l.childNodes[0].textContent.trim()));
    ok(labels.join('|') === 'Name|Baptism date|Next ordinance|Needs', tag + ': only ward council’s fields: ' + labels.join('|'));
    ok(await p.locator('#person-card [data-bind$=".action"], #person-card [data-bind$=".assigned"], #person-card [data-bind$=".sac"]').count() === 0, tag + ': no action, assigned or sacrament fields here');
    await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.need', 'A ride');
    await back();
    await addPerson('#wc-list', 'nm'); await fill('cp.nm.1.name', 'Olivia Chen'); await back();
    ok((await rowNames('#wc-list', 'nm')).join('|') === 'Daniel Rivera|Olivia Chen' && (await p.textContent('#wc-list [data-wc="nm"] .list-count')) === '2 people', tag + ': Add a name adds a row');
    await addPerson('#wc-list', 'nm'); await back();
    ok((await rowNames('#wc-list', 'nm')).length === 2 && (await p.textContent('#wc-list [data-wc="nm"] .list-count')) === '2 people', tag + ': a new name left empty doesn’t stay on the list');
    await addPerson('#wc-list', 'bt');
    ok(await p.locator('#person-card [data-bind="cp.bt.0.ordinance"]').count() === 0 && (await p.textContent('#person-card .fixed-value')) === 'Baptism', tag + ': Those being taught show Baptism as the next ordinance, as in the huddle');
    await back();
    ok(await noOverflow(), tag + ': ward council fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-wc-list.png`, fullPage: true });
    await back();
    ok((await rowText('cp')).includes('3 people · 2 need a next ordinance') && await p.locator('[data-action="open-wc-list"][data-a="cp"] .step-status.warn').count() === 1, tag + ': the roll-up counts people and turns orange when a next ordinance is missing');
    // Find New People to Teach and Missionary Referrals: the same sections the Huddle has
    ok((await rowText('fn')).includes('Not started') && (await rowText('mr')).includes('None listed'), tag + ': the two shared sections show their status in ward council');
    await p.click('[data-action="open-wc-list"][data-a="fn"]'); await p.waitForTimeout(300);
    ok((await p.textContent('#step-title')) === 'Find New People to Teach' && await vis('#fn-list [data-bind="find.plan"]') && !(await vis('#step-foot')) && !(await vis('#wc-rows')) && !(await vis('#wc-note')) && await noOverflow(), tag + ': Find New People to Teach opens in ward council with the plan and assignments (no Mark section done)');
    await fill('find.plan', 'Invite friends to the ward party'); await back();
    ok(await vis('#wc-rows') && (await rowText('fn')).includes('Plan written'), tag + ': Back returns to ward council, and the row shows the plan is written');
    await p.click('[data-action="open-wc-list"][data-a="mr"]'); await p.waitForTimeout(300);
    ok((await p.textContent('#step-title')) === 'Missionary Referrals' && await p.locator('#mr-list .person-row').count() === 0 && await vis('#mr-list [data-action="add-person"]') && (await p.textContent('#mr-list .list-count')) === '0 referrals' && !(await vis('#step-foot')), tag + ': Missionary Referrals opens with Add a referral');
    await p.click('#mr-list [data-action="add-person"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    const rlabels = await p.$$eval('#person-card .ref-card label', ls => ls.map(l => l.childNodes[0].textContent.trim()));
    ok((await p.textContent('#step-title')) === 'New referral' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind')) === 'referrals.0.name' && rlabels.join('|') === 'Name|Referred by|Notes', tag + ': Add a referral opens a new referral: name, referred by, notes');
    await fill('referrals.0.name', 'Marcus Hill'); await fill('referrals.0.by', 'Emma Walsh'); await fill('referrals.0.notes', 'Neighbor; asked about church');
    ok((await p.textContent('#step-title')) === 'Marcus Hill' && await vis('#person-card .person-remove') && await noOverflow(), tag + ': the referral’s screen takes the name and fits the phone');
    await p.click('#person-card .person-done'); await p.waitForTimeout(300);
    ok((await p.$$eval('#mr-list .person-row .person-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Hill' && (await p.textContent('#mr-list .person-row .step-status')).trim() === 'Referred by Emma Walsh · Neighbor; asked about church' && (await p.textContent('#mr-list .list-count')) === '1 referral', tag + ': Done returns to the list, which shows the name, who referred them and the note');
    await p.click('#mr-list [data-action="add-person"]'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250); await back();
    ok(await p.locator('#mr-list .person-row').count() === 1, tag + ': a new referral left empty doesn’t stay on the list');
    await p.screenshot({ path: `${OUT}/${tag}-wc-referrals.png`, fullPage: true });
    await back();
    ok((await rowText('mr')).includes('1 referral') && await noOverflow(), tag + ': ward council’s row counts the referrals');
    await p.screenshot({ path: `${OUT}/${tag}-wc-filled.png` });
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(200);
    ok(await vis('.door-wc') && (await p.textContent('#door-wc-sub')).startsWith('4 names'), tag + ': Back returns to the start; the door counts the names: ' + await p.textContent('#door-wc-sub'));
    // Huddle: the same names are already on the cards
    await p.click('.door-hd'); await p.waitForTimeout(200);
    ok(await vis('#steps-home') && await vis('#details-summary') && (await p.textContent('#mode-title')) === 'Huddle', tag + ': Huddle opens the details and its sections');
    ok(await p.evaluate(() => { const r = document.querySelector('#meeting-date').getBoundingClientRect(); return r.height <= 1 && getComputedStyle(document.querySelector('#meeting-date')).pointerEvents === 'none'; }) && await p.inputValue('#date') === await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }), tag + ': no date on screen; the huddle is dated today on its own');
    await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="conducting"][data-a="wml"]'); await p.click('[data-action="toggle-att"][data-a="wml"]'); await p.click('#details-full .btn-collapse');
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(250);
    ok((await p.textContent('#step-title')) === 'Covenant Path Report' && await vis('#step-title') && !(await vis('#h-plan')), tag + ': the section is titled Covenant Path Report, beside Back, not in the page');
    ok(await p.locator('.cp-reminder').count() === 0 && !(await p.textContent('[data-step="cp"]')).includes('Reminder:') && await vis('[data-step="cp"] .btn-tools'), tag + ': no reminder box on the Covenant Path page; the report button stays');
    ok((await rowNames('#cp-groups', 'nm')).join('|') === 'Daniel Rivera|Olivia Chen' && await p.locator('#cp-groups input, #cp-groups textarea').count() === 0, tag + ': the huddle lists the names from Ward council as rows, with no fields open');
    ok(await rowSub('#cp-groups', 'nm', 0) === 'Needs an action item' && await p.locator('#cp-groups [data-group="nm"] .person-row .step-status.warn').count() === 2, tag + ': a name with no action item says so in orange');
    ok(await p.locator('#cp-groups [data-group="bt"] [data-action="cp-none"]').count() === 1 && await p.locator('#cp-groups [data-group="nm"] [data-action="cp-none"]').count() === 0, tag + ': an empty list offers Confirm none this week; a list with names doesn’t');
    await p.click('#cp-groups [data-group="bt"] [data-action="cp-none"]'); await p.waitForTimeout(200);
    ok(await p.locator('#cp-groups [data-group="bt"] .list-empty.confirmed').count() === 1 && (await p.textContent('#cp-groups [data-group="bt"] .list-count')) === 'None this week', tag + ': Confirm none this week marks the empty list as reviewed');
    await p.click('#cp-groups [data-group="bt"] [data-action="cp-none-undo"]'); await p.waitForTimeout(200);
    ok(await p.locator('#cp-groups [data-group="bt"] .list-empty.confirmed').count() === 0 && await p.locator('#cp-groups [data-group="bt"] [data-action="cp-none"]').count() === 1, tag + ': Undo takes it back');
    ok(await noOverflow(), tag + ': the huddle’s list of names fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-huddle-list.png`, fullPage: true });
    await openPerson('#cp-groups', 'nm', 0);
    ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await p.inputValue('[data-bind="cp.nm.0.need"]') === 'A ride' && (await p.textContent('#step-title')) === 'Daniel Rivera' && await p.locator('#person-card .card').count() === 1 && !(await vis('#step-foot')) && !(await vis('#cp-groups')), tag + ': tapping a name opens that person, with ward council’s half already filled in');
    ok(await vis('#person-card .wc-edit') && await p.locator('#person-card .wc-summary').count() === 0, tag + ': a new member with no baptism date opens with ward council’s fields showing, so the date can be added');
    ok(await p.evaluate(() => { const z = document.querySelector('#person-card .zone-hd-wrap'); return !!z && ['.sac-toggle', '.temple-box', '[data-bind$=".action"]', '[data-bind$=".assigned"]', '[data-bind$=".when"]'].every(q => z.querySelector(q)) && getComputedStyle(z).backgroundColor !== 'rgba(0, 0, 0, 0)'; }), tag + ': the huddle’s half is a highlighted block holding sacrament, temple, action, assigned to and when');
    await fill('cp.nm.0.action', 'Drive him to the temple'); await fill('cp.nm.0.assigned', 'Bro. Patel'); await fill('cp.nm.0.when', 'Sat');
    ok(await noOverflow(), tag + ': the person’s card fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-huddle-person.png`, fullPage: true });
    await p.click('#person-card .person-done'); await p.waitForTimeout(300);
    ok(await vis('#cp-groups') && !(await vis('#person-view')) && await vis('#step-foot') && await rowSub('#cp-groups', 'nm', 0) === 'Drive him to the temple · Bro. Patel · Sat' && await p.locator('#cp-groups [data-group="nm"] .person-row .step-status.warn').count() === 1, tag + ': Done rolls back up to the list, which now shows the action item');
    await openPerson('#cp-groups', 'nm', 1); await p.goBack(); await p.waitForTimeout(300);
    ok(await vis('#cp-groups') && !(await vis('#person-view')) && (await rowNames('#cp-groups', 'nm')).length === 2, tag + ': the phone’s Back also returns from a person to the list');
    await back(); await p.click('[data-action="open-step"][data-a="tn"]'); await p.waitForTimeout(250);
    ok((await rowNames('#tn-list', 'tn')).join('|') === 'Grace Thompson|Focus name 2|Focus name 3' && await p.locator('#tn-list [data-action="add-person"]').count() === 0, tag + ': focus names came over too: three spots, no Add a name');
    await openPerson('#tn-list', 'tn', 0);
    const gsum = (await p.textContent('#person-card .wc-summary')).replace(/\s+/g, ' ');
    ok(gsum.includes('Next ordinance') && gsum.includes('Endowment') && gsum.includes('Temple prep class') && await p.locator('#person-card .wc-edit, #person-card .card-name-input, #person-card [data-bind$=".need"]').count() === 0, tag + ': the focus name opens with ward council’s half condensed to a summary: ' + gsum);
    await p.click('#person-card [data-action="wc-edit-toggle"]'); await p.waitForTimeout(150);
    ok(await p.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson' && await p.inputValue('[data-bind="tn.0.ordinance"]') === 'Endowment' && await p.locator('#person-card .wc-summary').count() === 0, tag + ': Edit opens the name, next ordinance and needs');
    await p.click('#person-card [data-action="wc-edit-toggle"]'); await p.waitForTimeout(150);
    ok(await vis('#person-card .wc-summary') && await p.locator('#person-card .card-name-input').count() === 0, tag + ': Hide condenses it again');
    await fill('tn.0.action', 'Invite to temple prep'); await back(); await back();
    // The two shared sections hold what ward council entered
    await p.click('[data-action="open-step"][data-a="fn"]'); await p.waitForTimeout(250);
    ok(await p.inputValue('[data-bind="find.plan"]') === 'Invite friends to the ward party' && await vis('#step-foot'), tag + ': the plan typed in ward council is in the Huddle’s Find New People to Teach');
    await back(); await p.click('[data-action="open-step"][data-a="mr"]'); await p.waitForTimeout(250);
    ok((await p.$$eval('#mr-list .person-row .person-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Hill' && await p.locator('#mr-list [data-group="mr"]').count() === 1 && await vis('#step-foot'), tag + ': the referral added in ward council is in the Huddle’s Missionary Referrals');
    await p.click('#mr-list .person-row'); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok(await p.inputValue('[data-bind="referrals.0.by"]') === 'Emma Walsh' && await p.inputValue('[data-bind="referrals.0.notes"]') === 'Neighbor; asked about church', tag + ': and it opens with the same details');
    await back(); await back();
    await p.screenshot({ path: `${OUT}/${tag}-huddle.png` });
    ok(!(await vis('.actionbar')) && !(await vis('[data-action="help"]')) && await vis('#steps-home [data-action="tips"]'), tag + ': Huddle screen has Tips at the top; no Send, Hand off or How to use');
    ok(!(await vis('.clear-link')) && !(await vis('.fine-notes')), tag + ': no Erase everything or footer on the Huddle screen');
    ok(await p.locator('#steps-home .step-row').count() === 5 && await p.locator('#steps-home .step-row .step-num').count() === 0 && await p.locator('#steps-home .nav-row .step-chev').count() === 5, tag + ': the five sections are plain rows with a chevron (a check only once done)');
    // Send lives on the opening screen and waits for the after-huddle check
    await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(200);
    await p.click('.actionbar [data-action="send"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Update the Covenant Path Report first') && !(await vis('#send-sheet')), tag + ': Send is held until the after-huddle box is checked');
    await p.click('#confirm-primary'); await p.waitForSelector('#af-view:not([hidden])'); await p.waitForTimeout(300);
    ok(await vis('#mode-bar') && (await p.textContent('#mode-title')) === 'After the huddle' && !(await vis('.actionbar')) && !(await vis('#start-home')) && await p.locator('.overlay:not([hidden])').count() === 0, tag + ': Show me what to update opens After the huddle as its own screen with Back, not a sheet');
    const dan = (await p.locator('#after-list .after-card', { hasText: 'Daniel Rivera' }).textContent()).replace(/\s+/g, ' ');
    ok(dan.includes('Sacrament') && dan.includes('Temple') && dan.includes('A ride') && dan.includes('Drive him to the temple') && await vis('#af-view [data-tools-link]'), tag + ': it lists sacrament, temple, needs and the assignment per person, with the report link');
    ok(!(await p.textContent('#after-list')).includes('Grace Thompson'), tag + ': focus names aren’t in the after-huddle list');
    ok(await noOverflow(), tag + ': the after-huddle list fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-afterlist.png` });
    ok((await p.textContent('#after-done-btn')).trim() === 'It’s all updated · Mark done' && !(await vis('#after-other-btn')) && !(await vis('#after-state')), tag + ': Mark done is at the bottom of the screen');
    await p.click('[data-action="after-done"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok(await isDone('after') && await vis('#after-box .check-tick'), tag + ': marking it done returns to the opening screen and turns the box green');
    await p.click('#after-box'); await p.waitForSelector('#af-view:not([hidden])'); await p.waitForTimeout(300);
    ok(await vis('#after-state') && (await p.textContent('#after-done-btn')).trim() === 'Done · Back' && (await p.textContent('#after-other-btn')).trim() === 'Marked by mistake? Mark as not done', tag + ': opened again it shows Marked done, with Done · Back and Mark as not done');
    await p.click('#after-other-btn'); await p.waitForTimeout(250);
    ok(await vis('#af-view') && !(await vis('#after-state')) && !(await vis('#after-other-btn')) && (await p.textContent('#after-done-btn')).trim() === 'It’s all updated · Mark done', tag + ': Mark as not done takes the mark off and offers Mark done again');
    await p.goBack(); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    ok(!(await isDone('after')), tag + ': the phone’s Back returns to the opening screen and leaves it not done');
    await p.click('.actionbar [data-action="send"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Update the Covenant Path Report first'), tag + ': Send waits again');
    await p.click('#confirm-secondary'); await p.waitForTimeout(200);
    await p.click('#after-box'); await p.waitForSelector('#af-view:not([hidden])'); await p.waitForTimeout(300);
    await p.click('[data-action="after-done"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${tag}-checked.png` });
    await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(200);
    if (await vis('#confirm-sheet') && /Ready to send/.test(await p.textContent('#confirm-title'))) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])');
    ok(await p.locator('#send-tools, #tools-check').count() === 0, tag + ': the Covenant Path Report check is on the opening screen, not the Send screen');
    ok((await p.textContent('#send-title')).trim() === 'Send this huddle’s agenda', tag + ': Send title has no date');
    ok(await vis('#send-date-row') && (await p.textContent('#send-date-row')).includes('Change date'), tag + ': Send shows the date with Change date');
    await p.fill('#send-date', '2026-11-08'); await p.waitForSelector('#share-btn:not([disabled])'); await p.waitForTimeout(300);
    ok((await p.textContent('#send-filename')).includes('2026-11-08') && (await p.textContent('#send-date-text')).includes('November 8'), tag + ': changing the date re-dates the PDF');
    await p.screenshot({ path: `${OUT}/${tag}-send.png` });
    await p.click('#share-btn'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-primary'); await p.waitForTimeout(250);
    ok(await vis('.door-wc') && await vis('#sent-line') && (await p.textContent('#door-hd-sub')).startsWith('0 of 2 reported back') && !(await isDone('before')) && !(await isDone('after')), tag + ': after sending, back at the start with both boxes cleared for the next huddle');
    await p.screenshot({ path: `${OUT}/${tag}-after.png` });
    // Ward council shows last huddle's assignment and its status, read-only
    await p.click('.door-wc'); await p.waitForTimeout(250);
    ok((await rowText('mr')).includes('1 referral') && (await rowText('fn')).includes('Not started'), tag + ': after sending, the referral is still listed and the finding plan has cleared for the next huddle');
    await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(250);
    await openPerson('#wc-list', 'nm', 0);
    const last = p.locator('#person-card .wc-card .wc-last:not(.wc-details)');
    ok((await last.textContent()).includes('Drive him to the temple') && (await last.textContent()).includes('Bro. Patel') && (await last.locator('.wc-status').textContent()) === 'Pending', tag + ': the name shows last huddle’s assignment, Pending');
    ok(await p.locator('#person-card [data-action="happened"], #person-card .wc-last button, #person-card .wc-last input').count() === 0, tag + ': the status can’t be changed in Ward council');
    // The mirror of the Huddle's screen: ward council's half on top and highlighted, the huddle's half closed with Edit
    const hsum = async () => (await p.locator('#person-card .hd-summary').textContent()).replace(/\s+/g, ' ');
    ok((await hsum()).includes('Sacrament') && (await hsum()).includes('Not marked at the last huddle') && (await hsum()).includes('Temple') && (await hsum()).includes('Action item') && (await hsum()).includes('None yet') && (await p.textContent('#person-card .hd-summary .zone-toggle')) === 'Edit', tag + ': the huddle’s half shows closed, as a summary with Edit: ' + await hsum());
    ok(await p.evaluate(() => { const c = document.querySelector('#person-card .card'), w = c.querySelector('.zone-wc-wrap'), s = c.querySelector('.hd-summary'); return !!(w.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(w).backgroundColor !== 'rgba(0, 0, 0, 0)'; }) && await p.locator('#person-card [data-bind$=".action"], #person-card [data-bind$=".sac"]').count() === 0, tag + ': ward council’s half is on top and highlighted; the huddle’s fields stay closed');
    await p.click('#person-card [data-action="hd-edit-toggle"]'); await p.waitForTimeout(200);
    ok(await vis('#person-card .zone-hd-wrap [data-bind="cp.nm.0.action"]') && await vis('#person-card .sac-toggle') && await vis('#person-card .temple-box') && (await p.textContent('#person-card .zone-hd-wrap .zone-toggle')) === 'Hide' && await noOverflow(), tag + ': Edit opens the huddle’s fields in ward council: sacrament, temple, action item, who and when');
    await fill('cp.nm.0.action', 'Invite to the temple trip'); await fill('cp.nm.0.assigned', 'Sis. Lee');
    await p.click('#person-card [data-action="hd-edit-toggle"]'); await p.waitForTimeout(200);
    ok((await hsum()).includes('Invite to the temple trip · Sis. Lee') && await p.locator('#person-card [data-bind$=".action"]').count() === 0, tag + ': Hide condenses it again, with the action item showing');
    await p.screenshot({ path: `${OUT}/${tag}-wc-last.png`, fullPage: true });
    await back(); await openPerson('#wc-list', 'nm', 1);
    ok(await p.locator('#person-card .wc-last:not(.wc-details)').count() === 0, tag + ': a name with no assignment shows no assignment line');
    ok((await p.getAttribute('[data-bind="cp.nm.1.need"]', 'placeholder')).includes('Tap their name in the Covenant Path Report'), tag + ': empty Needs says to tap the name in the Covenant Path Report');
    await back();
    ok(await p.locator('#wc-view .cpr-step, #wc-view .btn-tools, #wc-view .muted').count() === 0 && !(await vis('#wc-note')), tag + ': the lists have no intro text, reminder box or report button, and the confidentiality reminder isn’t repeated');
    await p.click('[data-action="steps-home"]'); await p.click('#mode-bar [data-action="go-start"]'); await p.click('.door-hd'); await p.click('[data-action="open-step"][data-a="rr"]');
    await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
    await p.goBack(); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(300); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(250);
    await openPerson('#wc-list', 'nm', 0);
    ok((await p.textContent('#person-card .wc-status')) === 'Done', tag + ': once the huddle marks it Yes, Ward council shows Done');
    await p.goBack(); await p.waitForTimeout(300);
    ok(await vis('#wc-list .person-row') && !(await vis('#person-view')), tag + ': the phone’s Back goes from a person to the list');
    await p.goBack(); await p.waitForTimeout(300);
    ok(await vis('#wc-rows') && !(await vis('#wc-list .person-row')), tag + ': and from a list to the roll-ups');
    await p.click('#mode-bar [data-action="go-start"]'); await p.click('.door-hd'); await p.click('[data-action="open-step"][data-a="rr"]');
    // Carry forward is only offered while the name is still on its list
    const gi = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).rr.findIndex(r => r.pname === 'Grace Thompson'));
    await p.click(`[data-action="happened"][data-a="${gi}"][data-b="No"]`); await p.waitForTimeout(150);
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${gi}"]`).count() === 1, tag + ': Carry forward is offered while the name is on its list');
    await back(); await p.click('[data-action="open-step"][data-a="tn"]'); await p.waitForTimeout(250);
    await openPerson('#tn-list', 'tn', 0);
    await p.click('#person-card .person-remove'); await p.waitForTimeout(250);
    if (await vis('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForTimeout(400);
    ok(await vis('#tn-list') && !(await vis('#person-view')) && await p.locator('#tn-list .person-row.is-blank').count() === 3, tag + ': Clear this focus name empties the spot and returns to the list');
    await back(); await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(250);
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${gi}"]`).count() === 0 && (await p.textContent('#rr-list')).includes('Grace Thompson is no longer a focus name'), tag + ': once the name is off the list, there’s no Carry forward, just a note');
    // The phone's Back goes huddle section -> huddle list -> start
    await p.goBack(); await p.waitForTimeout(200); ok(await vis('#steps-home'), tag + ': Back from a section returns to the huddle’s list');
    await p.goBack(); await p.waitForTimeout(200); ok(await vis('.door-hd'), tag + ': Back again returns to the start');
    // A reload opens at the start with everything kept
    await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    ok(await vis('.door-wc') && (await p.textContent('#door-hd-sub')).startsWith('2 of 2 reported back'), tag + ': reload opens at the start with the mark kept');
    ok(!errs.length, tag + ': no page errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
