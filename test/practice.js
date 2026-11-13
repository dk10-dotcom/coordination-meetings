// Practice week: first-time Load last week offers sample data; it can't be sent or saved; Remove restores the form.
const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.evaluate(() => document.querySelector('.clear-link').click()); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('#details-summary'); await p.fill('#ward', 'Real Ward'); await p.click('[data-action="conducting"][data-a="wml"]');
  await p.click('[data-action="toggle-att"][data-a="rs"]'); await p.click('[data-action="close-details"]');
  // Hand off offers Send and Receive; Load from a PDF is its own quiet link; the practice week lives in How to use
  await p.click('[data-action="go-start"]'); await p.click('.actionbar [data-action="handoff"]'); await p.waitForSelector('#handoff-sheet:not([hidden])');
  ok(await p.isVisible('#handoff-send') && await p.isVisible('#handoff-receive') && await p.locator('#agenda-list, #load-sheet').count() === 0 && (await p.textContent('[data-action="load-other"]')).trim() === 'Load from a PDF', 'Hand off offers Send and Receive; the quiet link is Load from a PDF; no saved-agenda list');
  await p.click('[data-action="close-handoff"]'); await p.waitForTimeout(150); await p.click('[data-action="open-huddle"]');
  await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200); await p.click('#help-sheet [data-action="tour"]'); await p.waitForTimeout(300);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-secondary'); // names hint
  await p.click('.coach-start'); await p.waitForTimeout(300); await p.click('.coach [data-action="coach-end"]'); await p.waitForTimeout(200); await p.click('#confirm-secondary'); await p.waitForTimeout(200); // keep the practice week; the tour card stays out of the way below
  await p.click('.nav-home'); await p.waitForTimeout(300); await p.click('.door-hd'); await p.waitForTimeout(300);
  ok((await p.textContent('#loaded-banner')).includes('Practice week loaded') && await p.evaluate(() => document.querySelector('#loaded-banner').classList.contains('practice')), 'amber practice banner shows');
  ok(await p.inputValue('#ward').catch(() => '') !== 'Sample Ward' && await p.evaluate(() => !/Sample Ward/.test(localStorage.getItem('huddle-ward') || '')), 'ward name is not changed to Sample Ward');
  await p.click('[data-action="open-step"][data-a="rr"]');
  ok(await p.locator('#rr-list .rr-card').count() === 7, 'Return and Report has 7 sample items (3 lists + 3 focus names + 1 finding)');
  await p.click('[data-action="steps-home"]');
  await p.click('[data-action="open-step"][data-a="cp"]');
  const names = await p.evaluate(() => ['nm', 'rm', 'bt'].map(g => Array.from(document.querySelectorAll(`#cp-groups [data-group="${g}"] .person-row .person-name`)).map(i => i.textContent)));
  ok(JSON.stringify(names) === JSON.stringify([['Daniel Rivera'], ['Olivia Chen'], ['Marcus Hill']]), 'one sample name in each Covenant Path list');
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
  const tn = await p.$$eval('#tn-list .person-row .person-name', e => e.map(x => x.textContent));
  ok(tn.join('|') === 'Grace Thompson|Samuel Ortiz|Emma Walsh', 'three sample focus names');
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="mr"]');
  ok((await p.$$eval('#mr-list .person-row .person-name', e => e.map(x => x.textContent))).join('|') === 'Marcus Bell', 'one sample missionary referral');
  await p.click('[data-action="steps-home"]'); await p.click('[data-action="open-step"][data-a="tn"]');
  // Mark Name Next Ordinance done even though actions are missing -> stays orange
  await p.click('[data-action="step-done"]'); await p.waitForTimeout(200);
  ok(await p.locator('[data-a="tn"].step-row.done .step-status.warn').count() === 1, 'a done section with missing actions stays dark orange');
  // Send and save are blocked
  await p.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 150)); const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) { g.click(); await settle(); } const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); await settle(); document.querySelector('[data-action="after-done"]').click(); await settle(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#send-sheet:not([hidden])');
  ok((await p.textContent('#send-title')) === 'Send a sample huddle report', 'Send makes a sample during practice');
  await p.click('#send-sheet [data-action="close-send"]'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-action="handoff"]').click()); await p.waitForTimeout(300);
  ok(await p.isVisible('#handoff-sheet') && /Practice/.test(await p.textContent('#handoff-send-sub')), 'Hand off offers a practice handoff'); await p.click('#handoff-sheet [data-action="close-handoff"]'); await p.waitForTimeout(200);
  await p.click('#loaded-banner [data-action="unload"]'); await p.waitForSelector('#confirm-sheet:not([hidden])');
  await p.click('#confirm-primary'); await p.waitForTimeout(300);
  ok(await p.isHidden('#loaded-banner') && await p.locator('.step-row.done').count() === 0, 'removing restores the form');
  ok((await p.textContent('#details-sub')).includes('1 attended') && (await p.textContent('#details-line')).includes('Real Ward'), 'real details kept');
  await p.click('[data-action="open-step"][data-a="tn"]');
  ok(await p.locator('#tn-list .person-row.is-blank').count() === 3, 'sample focus names gone');
  await p.click('[data-action="steps-home"]');
  ok((await p.textContent('.step-row[data-a="mr"] .step-status')).trim() === 'None listed', 'the sample referral is gone too');
  await p.click('[data-action="open-step"][data-a="tn"]');
  // How to use button starts it too
  await p.click('[data-action="steps-home"]'); await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForTimeout(200);
  await p.click('#help-sheet [data-action="tour"]'); await p.waitForTimeout(300);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-secondary');
  ok(await p.isHidden('#help-sheet') && (await p.textContent('#loaded-banner')).includes('Practice week loaded'), 'How to use button loads the practice week');
  // Remove via banner
  await p.click('#loaded-banner [data-action="unload"]'); await p.click('#confirm-primary'); await p.waitForTimeout(300);
  ok(await p.isHidden('#loaded-banner'), 'banner Remove clears the practice week');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
