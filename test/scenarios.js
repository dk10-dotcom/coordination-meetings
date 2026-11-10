// Scenarios: names added, assigned, removed, renamed, re-added and moved between lists across huddles.
// Each scenario checks that nothing errors, nothing is lost silently, and the PDF still builds.
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = 'test/out-scen'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const notes = [];
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const note = m => { notes.push(m); console.log('NOTE', m); };
  let n = 0;
  const open = async () => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
    await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    await p.click('.door-hd'); await p.click('#details-summary'); await p.fill('#ward', 'Sample Ward'); await p.click('[data-action="conducting"][data-a="wml"]'); await p.click('[data-action="toggle-att"][data-a="wml"]'); await p.click('#details-full .btn-collapse'); await p.click('#mode-bar [data-action="go-start"]');
    return p;
  };
  const st = async p => { await p.waitForTimeout(350); return p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1'))); };
  const toStart = async p => { for (let i = 0; i < 3 && !(await p.isVisible('.door-wc')); i++) { if (await p.isVisible('[data-action="steps-home"]')) await p.click('[data-action="steps-home"]'); else if (await p.isVisible('#mode-bar [data-action="go-start"]')) await p.click('#mode-bar [data-action="go-start"]'); await p.waitForTimeout(120); } };
  const addName = async (p, g, name) => { await toStart(p); await p.click('[data-action="open-before"]'); await p.waitForSelector('#bw-view:not([hidden])'); await p.click(`#before-list [data-action="add-person"][data-a="${g}"]`); await p.waitForSelector('#person-view:not([hidden])'); await p.fill('#person-card input[data-bind$=".name"]', name); await p.click('#person-card .person-done'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(150); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(150); };
  const removeName = async (p, g, name) => { await toStart(p); await p.click('[data-action="open-before"]'); await p.waitForSelector('#bw-view:not([hidden])'); await p.locator(`#before-list [data-bw="${g}"] .person-row`, { hasText: name }).click(); await p.waitForSelector('#person-view:not([hidden])'); await p.click('#person-card .person-remove'); await p.waitForTimeout(200); if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForSelector('#bw-view:not([hidden])'); await p.waitForTimeout(150); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])'); await p.waitForTimeout(150); };
  const step = async (p, id) => { await toStart(p); await p.click('.door-hd'); await p.click(`[data-action="open-step"][data-a="${id}"]`); };
  const idxOf = async (p, g, name) => (await st(p)).cp[g].findIndex(a => a.name === name);
  const assign = async (p, g, name, action, who) => { const i = await idxOf(p, g, name); await step(p, 'cp'); await p.fill(`[data-bind="cp.${g}.${i}.action"]`, action); await p.fill(`[data-bind="cp.${g}.${i}.assigned"]`, who || 'Bro. Patel'); await toStart(p); };
  const rrIdx = async (p, name) => (await st(p)).rr.findIndex(r => r.pname === name);
  const mark = async (p, name, v) => { const i = await rrIdx(p, name); await step(p, 'rr'); await p.click(`[data-action="happened"][data-a="${i}"][data-b="${v}"]`); await p.waitForTimeout(150); return i; };
  const send = async (p, label) => {
    await toStart(p); await p.evaluate(() => { navigator.canShare = () => false; const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } });
    await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#confirm-sheet') && /Ready to send/.test(await p.textContent('#confirm-title'))) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])', { timeout: 15000 }).catch(async e => { console.log('BLOCKED', label, await p.textContent('#confirm-title').catch(() => ''), '|', await p.textContent('#toast').catch(() => '')); throw e; });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    const f = `${OUT}/${++n}-${label}.pdf`; await dl.saveAs(f);
    await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-primary'); await p.waitForTimeout(200);
    return execFileSync('pdftotext', ['-raw', f, '-']).toString().replace(/\s+/g, ' ');
  };
  const done = async (p, label) => { ok(!p.errs.length, label + ': no page errors ' + p.errs.join('; ')); await p.context().close(); };

  // A. Assigned at one huddle, removed before the next
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple');
    const t1 = await send(p, 'A1'); ok(t1.includes('Daniel Rivera') && t1.includes('Drive him to the temple'), 'A: assignment is on the first PDF');
    await removeName(p, 'nm', 'Daniel Rivera');
    let s = await st(p); ok(s.rr.some(r => r.pname === 'Daniel Rivera') && !s.cp.nm.some(a => a.name === 'Daniel Rivera'), 'A: removing the name keeps his Return and Report item');
    const i = await mark(p, 'Daniel Rivera', 'No');
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count() === 0 && (await p.textContent('#rr-list')).includes('no longer on the Covenant Path Report list'), 'A: no Carry forward for the removed name; a note explains why');
    await toStart(p); await p.click('[data-action="open-after"]'); ok(!(await p.textContent('#after-list')).includes('Daniel Rivera'), 'A: the removed name isn’t in the after-huddle list'); await p.click('[data-action="close-after"]');
    const t2 = await send(p, 'A2'); ok(t2.includes('Daniel Rivera') && /Drive him to the temple.*No/.test(t2), 'A: the next PDF still reports his assignment as No');
    s = await st(p); ok(!s.rr.some(r => r.pname === 'Daniel Rivera') && !s.cp.nm.some(a => a.name === 'Daniel Rivera'), 'A: after that send he’s gone everywhere');
    await done(p, 'A'); }

  // B. Assigned, then removed before sending that same huddle
  { const p = await open(); await addName(p, 'rm', 'Olivia Chen'); await assign(p, 'rm', 'Olivia Chen', 'Sit with her family'); await addName(p, 'rm', 'Marcus Bell');
    await removeName(p, 'rm', 'Olivia Chen');
    let s = await st(p); ok(!s.cp.rm.some(a => a.name === 'Olivia Chen') && s.cp.rm.some(a => a.name === 'Marcus Bell'), 'B: removing a name with an assignment asks, then removes only that name');
    const t = await send(p, 'B'); ok(!t.includes('Olivia Chen') && !t.includes('Sit with her family') && t.includes('Marcus Bell'), 'B: the removed name and her assignment aren’t on the PDF');
    s = await st(p); ok(!s.rr.some(r => r.pname === 'Olivia Chen'), 'B: nothing of hers goes to Return and Report');
    await done(p, 'B'); }

  // C. Carried forward, then the name is removed
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple'); await send(p, 'C1');
    const i = await mark(p, 'Daniel Rivera', 'Partly'); await p.click(`[data-action="carry-fwd"][data-a="${i}"]`); await p.waitForTimeout(200);
    let s = await st(p); ok(s.cp.nm.find(a => a.name === 'Daniel Rivera').action === 'Drive him to the temple' && s.rr[i].carriedFwd, 'C: carry forward puts the assignment back on his card');
    await removeName(p, 'nm', 'Daniel Rivera');
    await step(p, 'rr'); const txt = await p.textContent('#rr-list');
    s = await st(p);
    ok(!s.cp.nm.some(a => a.name === 'Daniel Rivera'), 'C: the carried name can still be removed');
    ok(!/Added to this huddle’s plan/.test(txt) || await p.locator('#rr-list [data-action="undo-carry"]').count() === 0, 'C: Return and Report no longer claims it’s on this huddle’s plan: ' + (/(✓ Added[^.]*)/.exec(txt) || ['ok'])[0]);
    if (await p.locator(`#rr-list [data-action="undo-carry"][data-a="${i}"]`).count()) { await p.click(`#rr-list [data-action="undo-carry"][data-a="${i}"]`); await p.waitForTimeout(150); if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForTimeout(150); }
    const t = await send(p, 'C2'); ok(t.includes('Daniel Rivera') && t.includes('Partly'), 'C: the PDF still builds and reports Partly');
    ok(!/Carried forward to/.test(t.slice(0, t.indexOf('PLAN'))) , 'C: the PDF doesn’t say it was carried forward when the name is gone');
    await done(p, 'C'); }

  // D. Removed, then added back
  { const p = await open(); await addName(p, 'bt', 'Marcus Hill'); await assign(p, 'bt', 'Marcus Hill', 'Invite to the ward dinner'); await send(p, 'D1');
    await removeName(p, 'bt', 'Marcus Hill'); await addName(p, 'bt', 'marcus hill ');
    const i = await mark(p, 'Marcus Hill', 'No');
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count() === 1, 'D: added back (even typed differently), Carry forward is offered again');
    await p.click(`[data-action="carry-fwd"][data-a="${i}"]`); await p.waitForTimeout(200);
    const s = await st(p); ok(s.cp.bt.filter(a => a.name.trim()).length === 1 && s.cp.bt.find(a => a.name.trim()).action === 'Invite to the ward dinner', 'D: it carries onto the re-added card, with no duplicate');
    await send(p, 'D2'); await done(p, 'D'); }

  // E. Renamed after an assignment: the app asks whether it's the same person
  { const p = await open(); await addName(p, 'nm', 'Dan Rivera'); await assign(p, 'nm', 'Dan Rivera', 'Drive him to the temple'); await send(p, 'E1');
    await toStart(p); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.evaluate(() => document.activeElement.blur()); await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok((await p.textContent('#confirm-title')).includes('Is this the same person?') && (await p.textContent('#confirm-compare')).includes('Dan Rivera'), 'E: changing a name that has a last-huddle assignment asks if it’s the same person');
    await p.click('#confirm-primary'); await p.waitForTimeout(200);
    ok((await p.locator('#wc-list [data-wc="nm"] .wc-card').first().textContent()).includes('Drive him to the temple'), 'E: Same person: the assignment shows under the corrected name');
    const i = await mark(p, 'Daniel Rivera', 'No');
    ok(i >= 0 && await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count() === 1, 'E: and Carry forward works for the corrected name');
    const t = await send(p, 'E2'); ok(t.includes('Daniel Rivera') && !t.includes('Dan Rivera'), 'E: the PDF uses the corrected name throughout');
    await done(p, 'E'); }
  // E2. Renamed to a different person
  { const p = await open(); await addName(p, 'nm', 'Dan Rivera'); await assign(p, 'nm', 'Dan Rivera', 'Drive him to the temple'); await send(p, 'E3');
    await step(p, 'cp'); await p.fill('[data-bind="cp.nm.0.name"]', 'Olivia Chen'); await p.evaluate(() => document.activeElement.blur()); await p.waitForSelector('#confirm-sheet:not([hidden])');
    await p.click('#confirm-secondary'); await p.waitForTimeout(200);
    const i = await mark(p, 'Dan Rivera', 'No');
    ok(i >= 0 && await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count() === 0, 'E2: Different person: the assignment stays under the old name, with no Carry forward');
    await toStart(p); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="cp"]'); await p.fill('[data-bind="cp.nm.0.ordinance"]', 'Temple baptisms'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#confirm-sheet')), 'E2: editing other fields never asks');
    await send(p, 'E4'); await done(p, 'E2'); }

  // F. Being taught, baptized, converted to new member
  { const p = await open(); await addName(p, 'bt', 'Marcus Hill'); await assign(p, 'bt', 'Marcus Hill', 'Invite to the ward dinner'); await send(p, 'F1');
    await step(p, 'cp'); const cv = p.locator('[data-action="convert-nm"]').first();
    if (await cv.count()) { await cv.click(); await p.waitForTimeout(200); if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary'); await p.waitForTimeout(200); }
    let s = await st(p); const moved = s.cp.nm.some(a => a.name === 'Marcus Hill') && !s.cp.bt.some(a => a.name === 'Marcus Hill');
    ok(moved, 'F: Move to New members moves him to New members');
    const i = await mark(p, 'Marcus Hill', 'Partly');
    const carry = await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count();
    if (!carry) note('F: after Move to New members, his unfinished assignment from Those being taught can’t be carried forward (the app looks for him only on his old list).');
    else { await p.click(`[data-action="carry-fwd"][data-a="${i}"]`); await p.waitForTimeout(200); s = await st(p); ok(s.cp.nm.find(a => a.name === 'Marcus Hill').action === 'Invite to the ward dinner' && !s.cp.bt.some(a => a.name === 'Marcus Hill'), 'F: carry forward follows him to New members'); }
    await send(p, 'F2'); await done(p, 'F'); }

  // G. A focus name is replaced by a different person in the same spot
  { const p = await open(); await toStart(p); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.fill('[data-bind="tn.0.name"]', 'Grace Thompson'); await toStart(p);
    await step(p, 'tn'); await p.fill('[data-bind="tn.0.action"]', 'Invite to temple prep'); await send(p, 'G1');
    await toStart(p); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.fill('[data-bind="tn.0.name"]', 'Emma Walsh'); await p.evaluate(() => document.activeElement.blur()); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-secondary'); await p.waitForTimeout(150);
    const card = await p.locator('#wc-list [data-wc="tn"] .wc-card').first().textContent();
    ok(!card.includes('Invite to temple prep'), 'G: the new focus name doesn’t inherit the old one’s assignment');
    const s0 = await st(p); if (s0.tn[0].ordinance || s0.tn[0].need) note('G: typing a new name over a focus name keeps the previous person’s next ordinance and need on the card.');
    const i = await mark(p, 'Grace Thompson', 'No');
    ok(await p.locator(`[data-action="carry-fwd"][data-a="${i}"]`).count() === 0, 'G: no Carry forward for the replaced focus name');
    const t = await send(p, 'G2'); ok(t.includes('Grace Thompson') && t.includes('Emma Walsh'), 'G: the PDF reports Grace’s item and plans for Emma');
    await done(p, 'G'); }

  // H. The same person on two lists
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await toStart(p); await p.click('.door-wc'); await p.click('[data-action="open-wc-list"][data-a="tn"]'); await p.fill('[data-bind="tn.0.name"]', 'Daniel Rivera'); await toStart(p);
    await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple'); await step(p, 'tn'); await p.fill('[data-bind="tn.0.action"]', 'Introduce him to the bishop');
    await send(p, 'H1'); let s = await st(p);
    ok(s.rr.filter(r => r.pname === 'Daniel Rivera').length === 2, 'H: a name on two lists gets one Return and Report item per list');
    await removeName(p, 'nm', 'Daniel Rivera'); await step(p, 'rr');
    const notes2 = (await p.textContent('#rr-list'));
    await p.click('[data-action="happened"][data-a="0"][data-b="No"]'); await p.click('[data-action="happened"][data-a="1"][data-b="No"]'); await p.waitForTimeout(150);
    ok(await p.locator('#rr-list [data-action="carry-fwd"]').count() === 1 && (await p.textContent('#rr-list')).includes('no longer on the Covenant Path Report list'), 'H: removed from one list, Carry forward stays only for the list he’s still on');
    await send(p, 'H2'); await done(p, 'H'); }

  // I. Every name removed
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple'); await send(p, 'I1');
    await removeName(p, 'nm', 'Daniel Rivera');
    await toStart(p); ok((await p.textContent('#door-wc-sub')).startsWith('Names'), 'I: with no names left, the Ward council button goes back to its starting text');
    await p.click('[data-action="open-before"]'); await p.waitForSelector('#bw-view:not([hidden])'); ok((await p.locator('#before-list .list-panel.is-empty').count()) === 3 && (await p.locator('#before-list .person-row').count()) === 0, 'I: Before ward council shows three empty lists'); await p.click('#mode-bar [data-action="go-start"]'); await p.waitForSelector('#start-home:not([hidden])');
    const t = await send(p, 'I2'); ok(t.includes('Daniel Rivera') && /Not reviewed|No one/.test(t), 'I: the PDF still builds: his report-back, and empty lists marked as such');
    const s = await st(p); ok(s.rr.filter(r => r.prefilled).length === 0, 'I: the next huddle starts with an empty Return and Report');
    await done(p, 'I'); }

  // J. A name with no assignment
  { const p = await open(); await addName(p, 'rm', 'Olivia Chen'); await addName(p, 'rm', 'Marcus Bell'); await assign(p, 'rm', 'Marcus Bell', 'Invite to activity'); await send(p, 'J1');
    const s = await st(p); const o = s.rr.find(r => r.pname === 'Olivia Chen');
    if (o) note('J: a name that had no assignment still gets a Return and Report item (“No action item was written”), so the huddle is asked “Did it happen?” about nothing. Home shows ' + s.rr.filter(r => r.prefilled).length + ' items for 1 real assignment.');
    else ok(true, 'J: names without an assignment don’t create Return and Report items');
    await done(p, 'J'); }

  // K. The same name twice on one list
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await addName(p, 'nm', 'Daniel Rivera');
    let s = await st(p); const twice = s.cp.nm.filter(a => a.name === 'Daniel Rivera').length;
    if (twice === 2) { await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple'); await send(p, 'K1'); s = await st(p);
      note('K: the same name can be added twice to one list. After sending, ' + s.cp.nm.filter(a => a.name === 'Daniel Rivera').length + ' card(s) remain and Return and Report has ' + s.rr.filter(r => r.pname === 'Daniel Rivera').length + ' item(s) for him' + (s.cp.nm.filter(a => a.name === 'Daniel Rivera').length === 1 ? ' (the duplicate is dropped without saying so).' : '.')); }
    else ok(true, 'K: a duplicate name isn’t added');
    await done(p, 'K'); }

  // L. Undo a send after names changed, and reload in the middle
  { const p = await open(); await addName(p, 'nm', 'Daniel Rivera'); await assign(p, 'nm', 'Daniel Rivera', 'Drive him to the temple'); await send(p, 'L1');
    await removeName(p, 'nm', 'Daniel Rivera'); await addName(p, 'nm', 'Olivia Chen'); await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
    let s = await st(p); ok(s.cp.nm.some(a => a.name === 'Olivia Chen') && !s.cp.nm.some(a => a.name === 'Daniel Rivera') && s.rr.some(r => r.pname === 'Daniel Rivera'), 'L: adds and removes survive a reload');
    await p.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.resolve(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } });
    await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(200); if (await p.isVisible('#confirm-sheet') && /Ready to send/.test(await p.textContent('#confirm-title'))) await p.click('#confirm-primary');
    await p.waitForSelector('#share-btn:not([disabled])'); await p.click('#share-btn'); await p.waitForSelector('#confirm-sheet:not([hidden])'); await p.click('#confirm-secondary'); await p.waitForTimeout(300);
    s = await st(p); ok(s.cp.nm.some(a => a.name === 'Olivia Chen') && s.rr.some(r => r.pname === 'Daniel Rivera') && s.verified.after, 'L: Undo after sending brings back the same names, report items and check');
    await done(p, 'L'); }

  console.log(`${pass}/${pass + fail} checks passed · ${notes.length} notes`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
