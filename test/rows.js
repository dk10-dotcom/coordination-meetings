// Names as rows and one screen per person, in the Huddle and in Ward council: the parts twodoor.js doesn't reach.
// In the Huddle, ward council's half of a person is a condensed summary (Edit opens it) and the huddle's half is highlighted.
// Removing a name, converting to a new member, names not updated in 4 weeks, the same-person question,
// what a row says about a person, the slide between screens, and a reload.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = 'test/out-rows'; fs.mkdirSync(OUT, { recursive: true });
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: ago(1) }, o);
// A huddle in progress: two new members (one not updated in 30 days), one returning member with an action,
// one person being taught, one focus name, and two assignments from the last huddle.
const seed = () => ({
  ward: 'Sample Ward', date: iso(new Date()), conducting: 'wml', attendees: ['wml'], rolledFrom: ago(7),
  rr: [
    { prefilled: true, group: 'nm', source: 'New members', pname: 'Daniel Rivera', person: 'Daniel Rivera · Next: Temple baptisms', ord: 'Temple baptisms', action: 'Drive him to the temple', assigned: 'Bro. Patel', when: 'Sat', plan: '', happened: '', notes: '' },
    { prefilled: true, group: 'bt', source: 'Those being taught', pname: 'Marcus Hill', person: 'Marcus Hill · Next: Baptism', ord: 'Baptism', action: 'Invite to church', assigned: 'Sis. Lee', when: 'Sun', plan: '', happened: '', notes: '' }
  ],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: ago(10), ordinance: 'Temple baptisms', need: 'A ride' }), card({ name: 'Emma Walsh', bap: ago(3), ordinance: 'Temple baptisms', touched: ago(30) })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', action: 'Temple prep lesson', assigned: 'Sis. Park', when: 'Wed' })],
    bt: [card({ name: 'Marcus Hill', bap: ago(-10), committed: true, need: 'Friends at church' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Endowment', need: 'Temple prep class' }), card({ touched: '' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }] }, verified: { before: false, after: false },
  referrals: [{ name: 'Marcus Bell', by: 'Olivia Chen', notes: 'Friend from work' }, { name: 'Samuel Ortiz', by: '', notes: '' }]
});

(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    // The app saves its own state as a page closes, so a seeded huddle is put in place as the next page opens.
    await ctx.addInitScript(() => { try { const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
    const vis = s => p.isVisible(s);
    const noOverflow = async () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const openPerson = async (scope, g, i) => { await p.click(`${scope} [data-action="open-person"][data-a="${g}"][data-b="${i}"]`); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250); };
    const back = async () => { await p.click('[data-action="steps-home"]'); await p.waitForTimeout(300); };
    const rowNames = (scope, g) => p.$$eval(`${scope} [data-${scope === '#wc-list' ? 'wc' : 'group'}="${g}"] .person-row .person-name`, e => e.map(x => x.textContent));
    const row = (scope, g, i) => `${scope} [data-action="open-person"][data-a="${g}"][data-b="${i}"]`;
    const rowSub = async (scope, g, i) => (await p.textContent(row(scope, g, i) + ' .step-status')).trim();
    const rowTags = (scope, g, i) => p.$$eval(row(scope, g, i) + ' .fold-tag', e => e.map(x => x.textContent));
    const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')));
    const confirmIfAsked = async () => { await p.waitForTimeout(250); if (await vis('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForTimeout(400); };

    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.chip', { state: 'attached' });
    await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), seed());
    await p.reload(); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});

    // ---- Huddle: what each row says
    await p.click('.door-hd'); await p.waitForTimeout(250);
    ok(await p.evaluate(() => !document.body.classList.contains('nav-back')) , tag + ': going deeper is not a back slide');
    await p.click('[data-action="open-step"][data-a="cp"]');
    ok(await p.evaluate(() => document.body.classList.contains('nav-fwd')), tag + ': a screen opened from a list slides in from the right');
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => !document.body.classList.contains('nav-fwd') && !document.body.classList.contains('nav-back')), tag + ': the slide is over in a moment');
    ok((await rowNames('#cp-groups', 'nm')).join('|') === 'Daniel Rivera|Emma Walsh' && (await rowNames('#cp-groups', 'rm')).join('|') === 'Olivia Chen' && (await rowNames('#cp-groups', 'bt')).join('|') === 'Marcus Hill', tag + ': each list shows its names, one row each');
    ok(/^Temple prep lesson · Sis\. Park · Wed(, [A-Z][a-z]{2} \d{1,2})?$/.test(await rowSub('#cp-groups', 'rm', 0)) && await p.locator(row('#cp-groups', 'rm', 0) + ' .step-status.warn').count() === 0, tag + ': a row with an action shows the action, who and when');
    const danTags = await rowTags('#cp-groups', 'nm', 0), emmaTags = await rowTags('#cp-groups', 'nm', 1), marcusTags = await rowTags('#cp-groups', 'bt', 0);
    ok(danTags.join('|') === 'Temple: 20 days left', tag + ': a new member’s row counts down the 30-day temple goal: ' + danTags.join('|'));
    ok(emmaTags.includes('Not updated in 4 weeks'), tag + ': a name not updated in 4 weeks says so on its row: ' + emmaTags.join('|'));
    ok(marcusTags.some(t => t.startsWith('Committed to baptism')), tag + ': someone committed to baptism says so on their row: ' + marcusTags.join('|'));
    ok(await p.locator('#cp-groups .temple-goal').count() === 1 && await vis('#cp-groups [data-group="nm"] .temple-goal'), tag + ': the 30-day temple goal is stated once, under New members');
    ok(await noOverflow(), tag + ': the lists fit the phone');
    await p.screenshot({ path: `${OUT}/${tag}-huddle-list.png`, fullPage: true });

    // ---- A person's screen in the Huddle: ward council's half is condensed; the huddle's half is what's open
    await openPerson('#cp-groups', 'nm', 0);
    const sum = async () => (await p.textContent('#person-card .wc-summary')).replace(/\s+/g, ' ');
    ok(await vis('#person-card .wc-summary') && await p.locator('#person-card .wc-edit, #person-card .card-name-input, #person-card [data-bind$=".need"], #person-card [data-bind$=".ordinance"]').count() === 0, tag + ': ward council’s half is condensed by default');
    ok((await sum()).includes('Next ordinanceBaptisms for the dead') && (await sum()).includes('NeedsA ride') && (await sum()).includes('Baptized') && (await p.textContent('#person-card .wc-summary .zone-toggle')) === 'Edit', tag + ': the summary shows next ordinance, needs and the baptism date, with Edit: ' + await sum());
    ok(await p.evaluate(() => { const c = document.querySelector('#person-card .card'), s = c.querySelector('.wc-summary'), z = c.querySelector('.zone-hd-wrap'); return s.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING && ['.sac-toggle', '.temple-box', '[data-bind$=".action"]', '[data-bind$=".assigned"]', '[data-bind$=".when"]'].every(q => z.querySelector(q)); }), tag + ': the huddle’s half holds sacrament, temple, action, assigned to and when, right under the summary');
    ok(await noOverflow(), tag + ': the condensed screen fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-person-condensed.png`, fullPage: true });
    await p.click('#person-card .wc-summary [data-action="wc-edit-toggle"]'); await p.waitForTimeout(150);
    ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await p.inputValue('[data-bind="cp.nm.0.need"]') === 'A ride' && await p.inputValue('[data-bind="cp.nm.0.ordinance"]') === 'Baptisms for the dead' && await p.locator('#person-card .wc-summary').count() === 0 && (await p.textContent('#person-card .wc-edit .zone-toggle')) === 'Hide', tag + ': Edit opens the name, baptism date, next ordinance and needs');
    await fill('cp.nm.0.need', 'A ride to the temple');
    ok(await noOverflow(), tag + ': the open screen fits the phone');
    await p.click('#person-card .wc-edit [data-action="wc-edit-toggle"]'); await p.waitForTimeout(150);
    ok((await sum()).includes('NeedsA ride to the temple') && await p.locator('#person-card .card-name-input').count() === 0, tag + ': Hide condenses it again, with the change showing');
    // sacrament and temple show on the row afterward
    await p.click('#person-card .sac-toggle'); await p.waitForTimeout(150);
    await p.click('#person-card .temple-box'); await p.waitForTimeout(150);
    await back();
    const danAfter = await rowTags('#cp-groups', 'nm', 0);
    ok(danAfter.join('|') === '✓ Sacrament', tag + ': after checking sacrament and temple, the row shows Sacrament and drops the temple count: ' + danAfter.join('|'));

    // ---- Not updated in 4 weeks: open the name, Keep
    await openPerson('#cp-groups', 'nm', 1);
    ok(await vis('#person-card .stale-note') && (await p.textContent('#person-card .stale-note')).includes('Still on the Covenant Path Report?'), tag + ': opening that name asks if it’s still on the Covenant Path Report');
    await p.click('#person-card [data-action="stale-keep"]'); await p.waitForTimeout(250);
    ok(await p.locator('#person-card .stale-note').count() === 0 && await vis('#person-view') && (await p.textContent('#step-title')) === 'Emma Walsh', tag + ': Keep clears the question and stays on the person');
    await back();
    ok(!(await rowTags('#cp-groups', 'nm', 1)).includes('Not updated in 4 weeks'), tag + ': and the row no longer says so');

    // ---- Remove from the list (asks first), then back at the list
    await openPerson('#cp-groups', 'nm', 1);
    ok((await p.textContent('#person-card .person-remove')).trim() === 'Remove from the list', tag + ': a person’s screen ends with Remove from the list');
    await p.click('#person-card .person-remove'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Remove Emma Walsh?'), tag + ': removing a name with details asks first');
    await p.click('#confirm-secondary'); await p.waitForTimeout(250);
    ok(await vis('#person-view') && (await saved()).cp.nm.length === 2, tag + ': Cancel keeps the person');
    await p.click('#person-card .person-remove'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-primary'); await p.waitForTimeout(450);
    ok(!(await vis('#person-view')) && await vis('#cp-groups') && (await rowNames('#cp-groups', 'nm')).join('|') === 'Daniel Rivera' && (await p.textContent('#step-title')) === 'Covenant Path Report', tag + ': Remove takes them off and returns to the list');
    await p.goBack(); await p.waitForTimeout(300);
    ok(await vis('#steps-home') && !(await vis('#person-view')), tag + ': the phone’s Back then goes to the huddle’s sections, not back to the removed person');
    await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);

    // ---- Move to New members, from the person's screen
    await openPerson('#cp-groups', 'bt', 0);
    ok(await p.locator('#person-card .zone-hd-wrap .commit-box').count() === 1 && await p.inputValue('#person-card .zone-hd-wrap [data-bind="cp.bt.0.bap"]') !== '' && (await p.textContent('#person-card .wc-summary')).includes('Baptism') && !(await p.textContent('#person-card .wc-summary')).includes('Baptized'), tag + ': someone being taught has Committed to baptism and the scheduled date in the huddle’s half');
    await p.click('#person-card [data-action="convert-nm"]'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-primary'); await p.waitForTimeout(400);
    ok(await vis('#person-view') && (await p.textContent('#step-title')) === 'Marcus Hill' && await p.locator('#person-card [data-group="nm"] [data-bind="cp.nm.1.action"]').count() === 1 && await vis('#person-card .temple-box') && (await p.textContent('#person-card .wc-summary')).includes('Baptized'), tag + ': Move to New members keeps the person on screen, now as a new member with the temple box');
    await back();
    ok((await rowNames('#cp-groups', 'nm')).join('|') === 'Daniel Rivera|Marcus Hill' && (await rowNames('#cp-groups', 'bt')).length === 0 && await p.locator('#cp-groups [data-group="bt"] [data-action="cp-none"]').count() === 1, tag + ': Back shows them under New members, and Those being taught is empty');
    await back(); await p.click('[data-action="open-step"][data-a="rr"]'); await p.waitForTimeout(250);
    const mi = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).rr.findIndex(r => r.pname === 'Marcus Hill'));
    await p.click(`[data-action="happened"][data-a="${mi}"][data-b="No"]`); await p.waitForTimeout(200);
    await p.click(`[data-action="carry-fwd"][data-a="${mi}"]`); await p.waitForTimeout(300);
    await back(); await p.click('[data-action="open-step"][data-a="cp"]'); await p.waitForTimeout(300);
    ok(await rowSub('#cp-groups', 'nm', 1) === 'Invite to church · Sis. Lee' && (await rowTags('#cp-groups', 'nm', 1)).includes('Carried forward'), tag + ': an assignment carried forward follows the converted name, and the row says Carried forward');
    await back();

    // ---- Name Next Ordinance in the huddle: action on the row; a blank spot opens ready to type
    await p.click('[data-action="open-step"][data-a="tn"]'); await p.waitForTimeout(300);
    await openPerson('#tn-list', 'tn', 1);
    ok((await p.textContent('#step-title')) === 'Focus name 2' && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind')) === 'tn.1.name' && await vis('#person-card .wc-edit') && await p.locator('#person-card .zone-toggle').count() === 0, tag + ': an empty focus spot opens with its fields showing and the cursor in the name (nothing to condense yet)');
    await fill('tn.1.name', 'Samuel Ortiz'); await fill('tn.1.action', 'Visit with the bishop'); await back();
    ok((await rowNames('#tn-list', 'tn')).join('|') === 'Grace Thompson|Samuel Ortiz|Focus name 3' && await rowSub('#tn-list', 'tn', 1) === 'Visit with the bishop' && (await p.textContent('#tn-list .list-count')) === '2 of 3 names', tag + ': the new focus name is on the list with its action');
    await back();

    // ---- Missionary referrals: saved with the huddle (the app reopened with them above), rows, and Remove on a referral's screen
    ok((await p.textContent('.step-row[data-a="mr"] .step-status')).trim() === '2 referrals', tag + ': the Huddle’s Missionary Referrals row counts the saved referrals');
    await p.click('[data-action="open-step"][data-a="mr"]'); await p.waitForTimeout(300);
    const refNames = () => p.$$eval('#mr-list .person-row .person-name', e => e.map(x => x.textContent));
    const refSubs = () => p.$$eval('#mr-list .person-row .step-status', e => e.map(x => x.textContent.trim()));
    ok((await refNames()).join('|') === 'Marcus Bell|Samuel Ortiz' && (await refSubs()).join('|') === 'Referred by Olivia Chen · Friend from work|No details yet' && (await p.textContent('#mr-list .list-count')) === '2 referrals', tag + ': referrals saved with the huddle are listed after the app is reopened: ' + (await refSubs()).join('|'));
    ok(await p.locator('#mr-list input, #mr-list textarea').count() === 0 && await noOverflow(), tag + ': no fields are open in the referral list, and it fits the phone');
    await p.click(row('#mr-list', 'mr', 1)); await p.waitForSelector('#person-view:not([hidden])'); await p.waitForTimeout(250);
    ok((await p.textContent('#step-title')) === 'Samuel Ortiz' && await p.locator('#person-card .ref-card [data-bind="referrals.1.name"]').count() === 1, tag + ': a referral opens on its own screen');
    await p.click('#person-card .person-remove'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Remove Samuel Ortiz?'), tag + ': removing a referral asks first');
    await p.click('#confirm-primary'); await p.waitForTimeout(450);
    ok(!(await vis('#person-view')) && (await refNames()).join('|') === 'Marcus Bell' && (await p.textContent('#mr-list .list-count')) === '1 referral', tag + ': Remove takes the referral off and returns to the list');
    await back(); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(300);

    // ---- Ward council: the 4-week question, the same-person question and Remove live on the person's screen
    await p.waitForTimeout(500);
    await p.evaluate(d => { const s = JSON.parse(localStorage.getItem('huddle-agenda-v1')); s.cp.rm[0].touched = d; localStorage.setItem('__seed', JSON.stringify(s)); }, ago(30));
    await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    ok(await vis('#start-home') && !(await vis('#person-view')), tag + ': a reload opens at the start');
    await p.click('.door-wc'); await p.waitForTimeout(250);
    ok((await p.textContent('[data-action="open-wc-list"][data-a="mr"] .step-status')).trim() === '1 referral', tag + ': ward council shows the same referral list (1 left), still there after another reopen');
    await p.click('[data-action="open-wc-list"][data-a="mr"]'); await p.waitForTimeout(300);
    ok((await p.$$eval('#mr-list [data-wc="mr"] .person-row .person-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Bell', tag + ': and lists it by name');
    await back();
    await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.waitForTimeout(300);
    ok((await rowTags('#wc-list', 'rm', 0)).includes('Not updated in 4 weeks') && await rowSub('#wc-list', 'rm', 0) === 'Next: Endowment', tag + ': ward council’s row shows the next ordinance and the 4-week flag');
    await openPerson('#wc-list', 'rm', 0);
    ok(await vis('#person-card .stale-note'), tag + ': ward council’s screen asks the 4-week question too');
    await p.click('#person-card [data-action="stale-remove"]'); await p.waitForTimeout(450);
    ok(!(await vis('#person-view')) && await vis('#wc-list') && (await rowNames('#wc-list', 'rm')).length === 0 && (await saved()).cp.rm.every(a => !a.name), tag + ': Remove takes the name off and returns to ward council’s list');
    await openPerson('#wc-list', 'nm', 0);
    await fill('cp.nm.0.name', 'Daniel Rivera Jr'); await p.locator('[data-bind="cp.nm.0.ordinance"]').focus(); await p.waitForTimeout(300);
    ok(await vis('#confirm-sheet') && (await p.textContent('#confirm-title')).includes('Is this the same person?'), tag + ': changing a name with a last-huddle assignment asks if it’s the same person');
    await p.click('#confirm-primary'); await p.waitForTimeout(300);
    ok((await p.textContent('#person-card .wc-last:not(.wc-details)')).includes('Drive him to the temple') && (await p.textContent('#step-title')) === 'Daniel Rivera Jr', tag + ': Same person keeps the last assignment under the corrected name');
    ok(await noOverflow(), tag + ': ward council’s person screen fits the phone');
    await p.click('#person-card .person-remove'); await confirmIfAsked();
    ok(!(await vis('#person-view')) && (await rowNames('#wc-list', 'nm')).join('|') === 'Marcus Hill', tag + ': Remove from the list works from ward council too');
    await back(); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.body.getAttribute('data-view')) === 'start' && (await p.textContent('#door-wc-sub')).startsWith('3 names'), tag + ': back at the start, the door counts the names left: ' + await p.textContent('#door-wc-sub'));
    ok(!errs.length, tag + ': no page errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
