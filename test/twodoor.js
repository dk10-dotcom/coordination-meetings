// Opening screen: Ward council, Huddle, Send. Ward council lists every name with name, next ordinance and need,
// plus last huddle's assignment and its mark. Nothing is entered twice between the two views.
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
    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    // Opening screen
    ok(await vis('.door-wc') && await vis('.door-hd') && await vis('.actionbar [data-action="send"]'), tag + ': opens to Ward council, Huddle and Send');
    ok(!(await vis('#steps-home')) && !(await vis('#details-summary')) && !(await vis('.info-pair')), tag + ': no date, sections or details on the opening screen');
    ok(await vis('[data-action="help"]') && await vis('[data-action="load-other"]') && !(await vis('[data-action="tips"]')), tag + ': How to use and the quiet Load link are there; Tips is not');
    ok(await noOverflow(), tag + ': opening screen fits the phone');
    ok(await vis('#before-box') && await vis('#after-box') && (await p.textContent('h1')).trim() === 'Ward Mission Leader Process', tag + ': title is Ward Mission Leader Process, with the two Covenant Path Report boxes');
    // Before ward council: quick list with add, remove, the report link and a check-off
    await p.click('[data-action="open-before"]'); await p.waitForSelector('#before-sheet:not([hidden])');
    ok(await vis('#before-sheet [data-tools-link]') && await p.locator('#before-list .quick-panel').count() === 3 && !(await p.textContent('#before-list')).includes('Grace Thompson'), tag + ': Before ward council opens the three Covenant Path lists (no focus names) and the report link');
    await p.fill('#before-list [data-quick="rm"] .quick-input', 'Marcus Bell'); await p.click('[data-action="quick-add"][data-a="rm"]'); await p.waitForTimeout(150);
    await p.fill('#before-list [data-quick="rm"] .quick-input', 'Extra Person'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    ok((await p.$$eval('#before-list [data-quick="rm"] .quick-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Bell|Extra Person', tag + ': names can be added (button or Enter)');
    await p.click('#before-list [data-quick="rm"] li >> nth=1 >> .btn-remove'); await p.waitForTimeout(250);
    if (await vis('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForTimeout(200);
    ok((await p.$$eval('#before-list [data-quick="rm"] .quick-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Bell', tag + ': a name can be removed');
    ok(await noOverflow(), tag + ': the quick list fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-before.png` });
    await p.click('[data-action="before-done"]'); await p.waitForTimeout(200);
    ok(await p.isChecked('#before-check') && await p.evaluate(() => document.querySelector('#before-box').classList.contains('done')) && !(await p.isChecked('#after-check')), tag + ': marking done checks the box and turns it green');
    await p.screenshot({ path: `${OUT}/${tag}-start.png` });
    // Ward council: two lists rolled up, like the huddle's sections
    await p.click('.door-wc');
    ok(await vis('#wc-view') && await vis('#mode-bar') && !(await vis('.actionbar')) && (await p.textContent('#mode-title')) === 'Ward council', tag + ': Ward council opens with Back, no Send bar');
    const rowText = async id => (await p.textContent(`[data-action="open-wc-list"][data-a="${id}"]`)).replace(/\s+/g, ' ');
    ok(await p.locator('#wc-rows .wc-row').count() === 2 && (await rowText('cp')).includes('Covenant Path Report lists') && (await rowText('tn')).includes('Name Next Ordinance') && await p.locator('#wc-list .wc-card').count() === 0, tag + ': it shows two roll-ups, not the names');
    ok((await rowText('cp')).includes('1 person · 1 needs a next ordinance') && (await rowText('tn')).includes('No focus names yet'), tag + ': each roll-up has a status: ' + await rowText('cp'));
    await p.screenshot({ path: `${OUT}/${tag}-wc.png` });
    // Name Next Ordinance
    await p.click('[data-action="open-wc-list"][data-a="tn"]');
    ok(await p.locator('#wc-list [data-wc="tn"] .wc-card').count() === 3 && await p.locator('#wc-list .wc-panel').count() === 1 && (await p.textContent('#step-title')) === 'Name Next Ordinance' && !(await vis('#wc-rows')), tag + ': Name Next Ordinance opens the three focus names, with its title beside Back');
    await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.need', 'Temple prep class');
    ok(!(await p.getAttribute('[data-bind="tn.1.need"]', 'placeholder')).includes('Covenant Path Report'), tag + ': focus names aren’t told to look in the Covenant Path Report for needs');
    await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    ok(await vis('#wc-rows') && (await rowText('tn')).includes('1 of 3 focus names · everyone has a next ordinance'), tag + ': Back returns to the roll-ups, updated: ' + await rowText('tn'));
    // Covenant Path Report lists
    await p.click('[data-action="open-wc-list"][data-a="cp"]');
    ok(await p.locator('#wc-list .wc-panel').count() === 3 && await p.locator('#wc-list [data-wc="tn"]').count() === 0 && (await p.textContent('#step-title')) === 'Covenant Path Report lists', tag + ': Covenant Path Report lists opens the three lists');
    const labels = await p.$$eval('#wc-list [data-wc="nm"] .wc-card >> nth=0 >> label', ls => ls.map(l => l.childNodes[0].textContent.trim()));
    ok(labels.join('|') === 'Name|Baptism date|Next ordinance|Needs', tag + ': only ward council’s fields: ' + labels.join('|'));
    ok(await p.locator('#wc-list [data-bind$=".action"], #wc-list [data-bind$=".assigned"], #wc-list [data-bind$=".sac"]').count() === 0, tag + ': no action, assigned or sacrament fields here');
    ok(await p.locator('#wc-list [data-bind="cp.bt.0.ordinance"]').count() === 0 && (await p.textContent('#wc-list [data-wc="bt"] .fixed-value')) === 'Baptism', tag + ': Those being taught show Baptism as the next ordinance, as in the huddle');
    await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.need', 'A ride');
    await p.click('[data-action="wc-add"][data-a="nm"]'); await p.waitForTimeout(200);
    await fill('cp.nm.1.name', 'Olivia Chen');
    ok(await p.locator('#wc-list [data-wc="nm"] .wc-card').count() === 2, tag + ': Add a name adds a row');
    ok(await noOverflow(), tag + ': ward council fits the phone');
    await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    ok((await rowText('cp')).includes('3 people · 2 need a next ordinance') && await p.locator('[data-action="open-wc-list"][data-a="cp"] .step-status.warn').count() === 1, tag + ': the roll-up counts people and turns orange when a next ordinance is missing');
    await p.screenshot({ path: `${OUT}/${tag}-wc-filled.png` });
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(200);
    ok(await vis('.door-wc') && (await p.textContent('#door-wc-sub')).startsWith('4 names'), tag + ': Back returns to the start; the door counts the names: ' + await p.textContent('#door-wc-sub'));
    // Huddle: the same names are already on the cards
    await p.click('.door-hd'); await p.waitForTimeout(200);
    ok(await vis('#steps-home') && await vis('#details-summary') && (await p.textContent('#mode-title')) === 'Huddle', tag + ': Huddle opens the details and four sections');
    ok(await p.evaluate(() => { const r = document.querySelector('#meeting-date').getBoundingClientRect(); return r.height <= 1 && getComputedStyle(document.querySelector('#meeting-date')).pointerEvents === 'none'; }) && await p.inputValue('#date') === await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }), tag + ': no date on screen; the huddle is dated today on its own');
    await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="conducting"][data-a="wml"]'); await p.click('[data-action="toggle-att"][data-a="wml"]'); await p.click('#details-full .btn-collapse');
    await p.click('[data-action="open-step"][data-a="cp"]');
    ok((await p.textContent('#step-title')) === 'Covenant Path Report Review' && await vis('#step-title') && !(await vis('#h-plan')), tag + ': the section title sits beside Back, not in the page');
    ok(await p.inputValue('[data-bind="cp.nm.0.name"]') === 'Daniel Rivera' && await p.inputValue('[data-bind="cp.nm.0.need"]') === 'A ride' && await p.inputValue('[data-bind="cp.nm.1.name"]') === 'Olivia Chen', tag + ': names and needs from Ward council are on the huddle’s cards');
    await fill('cp.nm.0.action', 'Drive him to the temple'); await fill('cp.nm.0.assigned', 'Bro. Patel'); await fill('cp.nm.0.when', 'Sat');
    await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
    ok(await p.inputValue('[data-bind="tn.0.name"]') === 'Grace Thompson' && await p.inputValue('[data-bind="tn.0.ordinance"]') === 'Endowment', tag + ': focus names came over too');
    await fill('tn.0.action', 'Invite to temple prep'); await p.click('[data-action="steps-home"]'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${tag}-huddle.png` });
    ok(!(await vis('.actionbar')) && !(await vis('[data-action="help"]')) && await vis('#steps-home [data-action="tips"]'), tag + ': Huddle screen has Tips at the top; no Send, Hand off or How to use');
    // Send lives on the opening screen and waits for the after-huddle check
    await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); });
    await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(200);
    await p.click('.actionbar [data-action="send"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Update the Covenant Path Report first') && !(await vis('#send-sheet')), tag + ': Send is held until the after-huddle box is checked');
    await p.click('#confirm-primary'); await p.waitForSelector('#after-sheet:not([hidden])');
    const dan = (await p.locator('#after-list .after-card', { hasText: 'Daniel Rivera' }).textContent()).replace(/\s+/g, ' ');
    ok(dan.includes('Sacrament') && dan.includes('Temple') && dan.includes('A ride') && dan.includes('Drive him to the temple') && await vis('#after-sheet [data-tools-link]'), tag + ': it lists sacrament, temple, needs and the assignment per person, with the report link');
    ok(!(await p.textContent('#after-list')).includes('Grace Thompson'), tag + ': focus names aren’t in the after-huddle list');
    ok(await noOverflow(), tag + ': the after-huddle list fits the phone');
    await p.screenshot({ path: `${OUT}/${tag}-afterlist.png` });
    await p.click('[data-action="after-done"]'); await p.waitForTimeout(200);
    ok(await p.isChecked('#after-check') && await p.evaluate(() => document.querySelector('#after-box').classList.contains('done')), tag + ': marking it done turns the box green');
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
    ok(await vis('.door-wc') && await vis('#sent-line') && (await p.textContent('#door-hd-sub')).startsWith('0 of 2 reported back') && !(await p.isChecked('#before-check')) && !(await p.isChecked('#after-check')), tag + ': after sending, back at the start with both boxes cleared for the next huddle');
    await p.screenshot({ path: `${OUT}/${tag}-after.png` });
    // Ward council shows last huddle's assignment and its status, read-only
    await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="cp"]');
    const last = p.locator('#wc-list [data-wc="nm"] .wc-card >> nth=0 >> .wc-last:not(.wc-details)');
    ok((await last.textContent()).includes('Drive him to the temple') && (await last.textContent()).includes('Bro. Patel') && (await last.locator('.wc-status').textContent()) === 'Pending', tag + ': the name shows last huddle’s assignment, Pending');
    ok(await p.locator('#wc-list [data-action="happened"], #wc-list .wc-last button, #wc-list .wc-last input').count() === 0, tag + ': the status can’t be changed in Ward council');
    const det = (await p.locator('#wc-list [data-wc="nm"] .wc-card >> nth=0 >> .wc-details').textContent()).replace(/\s+/g, ' ');
    ok(det.includes('Details') && det.includes('Temple') && det.includes('Sacrament') && det.includes('Not marked at the last huddle'), tag + ': Details under a new member show temple and sacrament: ' + det);
    ok(await p.locator('#wc-list [data-wc="nm"] .wc-card >> nth=1 >> .wc-last:not(.wc-details)').count() === 0, tag + ': a name with no assignment shows no assignment line');
    ok((await p.getAttribute('[data-bind="cp.nm.1.need"]', 'placeholder')).includes('Tap their name in the Covenant Path Report'), tag + ': empty Needs says to tap the name in the Covenant Path Report');
    ok(await p.locator('#wc-view .cpr-step, #wc-view .btn-tools, #wc-view .muted').count() === 0, tag + ': Ward council has no intro text, reminder box or report button');
    await p.screenshot({ path: `${OUT}/${tag}-wc-last.png`, fullPage: true });
    await p.click('[data-action="steps-home"]'); await p.click('#mode-bar [data-action="go-start"]'); await p.click('.door-hd'); await p.click('[data-action="open-step"][data-a="rr"]');
    await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]');
    await p.goBack(); await p.waitForTimeout(150); await p.goBack(); await p.waitForTimeout(150); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="cp"]');
    ok((await p.locator('#wc-list [data-wc="nm"] .wc-card >> nth=0 >> .wc-status').textContent()) === 'Done', tag + ': once the huddle marks it Yes, Ward council shows Done');
    await p.goBack(); await p.waitForTimeout(150);
    ok(await vis('#wc-rows') && !(await vis('#wc-list .wc-card')), tag + ': the phone’s Back goes from a list to the roll-ups');
    await p.click('#mode-bar [data-action="go-start"]'); await p.click('.door-hd'); await p.click('[data-action="open-step"][data-a="rr"]');
    // Carry forward is only offered while the name is still on its list
    const gi = await p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1')).rr.findIndex(r => r.pname === 'Grace Thompson'));
    await p.click(`[data-action="happened"][data-a="${gi}"][data-b="No"]`); await p.waitForTimeout(150);
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${gi}"]`).count() === 1, tag + ': Carry forward is offered while the name is on its list');
    await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
    await fill('tn.0.name', ''); await fill('tn.0.ordinance', ''); await fill('tn.0.need', '');
    await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="rr"]');
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${gi}"]`).count() === 0 && (await p.textContent('#rr-list')).includes('Grace Thompson is no longer on the Name Next Ordinance list'), tag + ': once the name is off the list, there’s no Carry forward, just a note');
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
