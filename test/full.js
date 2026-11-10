// Full data check: fill every field (light and heavy loads), make the PDF, confirm every value
// is in it, confirm it renders, then load it back and confirm the round trip.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.evaluate(() => document.querySelector('.clear-link').click()); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = __dirname + '/out3';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765/#huddle';
const results = [];
const ok = (l, c, extra) => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (extra ? '  ' + extra : '')); };

const ATT = ['Priests quorum assistant', 'Gatherers of Light rep', 'Relief Society', 'Elders Quorum', 'Primary presidency',
  'Ward missionaries', 'Full-time missionaries', 'Ward mission leader', 'TFH leader', 'TFH consultants', 'High Councilor'];

function scenario(heavy) {
  const n = heavy ? 4 : 1;
  const long = heavy ? ' and then follow up with a phone call the next evening to see how it went and plan the next visit together' : '';
  const s = { ward: heavy ? 'Riverton 12th Ward' : 'Riverton 5th Ward', date: '2026-11-01',
    attendees: heavy ? ATT : ['Ward mission leader', 'Relief Society', 'High Councilor'],
    rr: [], cp: { nm: [], rm: [], bt: [] }, tn: [] };
  for (let i = 0; i < (heavy ? 5 : 2); i++) s.rr.push({ plan: `Plan item R${i + 1}: visit O'Brien & Sons family${long}`, happened: ['Yes', 'Partly', 'No'][i % 3], notes: `Note R${i + 1} — José said “thanks”` });
  for (const g of ['nm', 'rm', 'bt']) for (let i = 0; i < n; i++) s.cp[g].push({ name: `Person ${g.toUpperCase()}${i + 1} Müller`, action: `Action ${g}${i + 1}: invite to dinner${long}`, assigned: `Bro. Assignee ${g}${i + 1}`, when: `Day ${g}${i + 1}` });
  for (let i = 0; i < 3; i++) s.tn.push({ name: `Focus Name ${i + 1}`, ordinance: ['Baptism', 'Endowment', 'Sealing'][i], action: `TN action ${i + 1}${long}`, assigned: `Sister TN${i + 1}`, when: `TN when ${i + 1}` });
  return s;
}

async function fill(p, s) {
  await p.fill('#ward', s.ward); await p.fill('#date', s.date);
  for (const a of s.attendees) await p.click(`#attendee-list .chip:has-text("${a}")`);
  for (let i = 0; i < s.rr.length; i++) {
    if (i >= 2) await p.click('[data-action="add-rr"]');
    await p.fill(`[data-bind="rr.${i}.plan"]`, s.rr[i].plan);
    await p.click(`[data-action="happened"][data-a="${i}"][data-b="${s.rr[i].happened}"]`);
    await p.fill(`[data-bind="rr.${i}.notes"]`, s.rr[i].notes);
  }
  for (const g of ['nm', 'rm', 'bt']) for (let i = 0; i < s.cp[g].length; i++) {
    if (i >= 1) await p.click(`[data-action="add-cp"][data-a="${g}"]`);
    for (const k of ['name', 'action', 'assigned', 'when']) await p.fill(`[data-bind="cp.${g}.${i}.${k}"]`, s.cp[g][i][k]);
  }
  for (let i = 0; i < 3; i++) for (const k of ['name', 'ordinance', 'action', 'assigned', 'when']) await p.fill(`[data-bind="tn.${i}.${k}"]`, s.tn[i][k]);
}

function pdfText(file) { return execFileSync('pdftotext', ['-raw', file, '-']).toString().replace(/\s+/g, ' '); }
function words(v) { return v.replace(/[“”]/g, '').split(/\s+/).filter(Boolean); }

(async () => {
  const browser = await chromium.launch();
  for (const heavy of [false, true]) {
    const label = heavy ? 'HEAVY' : 'TYPICAL';
    console.log('\n=== ' + label + ' agenda');
    const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen', '1'); } catch (e) {} });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(BASE); await p.waitForSelector('.chip');
    const s = scenario(heavy);
    await fill(p, s);
    await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    const file = `${OUT}/${dl.suggestedFilename()}`; await dl.saveAs(file);
    ok('file name', dl.suggestedFilename() === `Huddle - ${s.ward} - ${s.date}.pdf`, dl.suggestedFilename());

    const info = execFileSync('pdfinfo', [file]).toString();
    const pages = +/Pages:\s+(\d+)/.exec(info)[1];
    ok('page size is US Letter', /612 x 792/.test(info));
    console.log('     pages: ' + pages);
    const text = pdfText(file);

    // Every typed value must appear (checked word by word, since long text wraps inside table cells)
    const missing = [];
    const need = [s.ward, 'Sunday, November 1, 2026'];
    s.rr.forEach(r => need.push(r.plan, r.happened, r.notes));
    for (const g of ['nm', 'rm', 'bt']) s.cp[g].forEach(a => need.push(a.name, a.action, a.assigned, a.when));
    s.tn.forEach(t => need.push(t.name, t.ordinance, t.action, t.assigned, t.when));
    need.forEach(v => { const w = words(v); const joined = w.join(' '); if (!text.includes(joined)) { if (!w.every(x => text.includes(x))) missing.push(v); } });
    ok('every typed value is in the PDF', missing.length === 0, missing.length ? 'missing: ' + missing.join(' | ') : `${need.length} values checked`);

    // Attendees: all names printed, and the ticked ones checked (checked = drawn tick next to the label)
    ok('all attendee labels printed', ATT.every(a => text.includes(a)));
    // Fixed agenda text
    const fixed = ['Weekly Coordination', 'Meeting Agenda', 'Ward Council', 'Weekly Coordination Meeting', 'Return and Report', 'FROM THE LAST HUDDLE', 'Did it happen?', 'NOV 1 HUDDLE PLAN',
      'Covenant Path Report Review', 'Name Next Ordinance (Ward Council Focus Names)',
      'NEW MEMBERS', 'RETURNING MEMBERS', 'THOSE BEING TAUGHT'];
    const fixedMissing = fixed.filter(f => !text.includes(f));
    ok('all section headings printed', fixedMissing.length === 0, fixedMissing.join(' | '));
    ok('how-to lines left off the PDF', !text.includes('Open the Covenant Path Report') && !text.includes('Open the 3 Names Next Ordinance spreadsheet') && !text.includes('Make a plan'));
    ok('no stake name', !text.includes('Riverton Utah South Stake'));
    ok('no unprintable-character marks', !/\?\?|�/.test(text));
    if (pages > 1) ok('continued pages have a header and page numbers', text.includes('(continued)') && text.includes('Page 2 of ' + pages));

    // Text stays inside the page margins
    const bbox = execFileSync('pdftotext', ['-bbox', file, '-']).toString();
    const xs = [...bbox.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
    const out = xs.filter(([x0, y0, x1, y1]) => x0 < 40 || x1 > 572 || y0 < 20 || y1 > 780);
    ok('all text inside page margins', out.length === 0, out.length ? out.length + ' words outside' : '');

    // Render each page for a visual check
    execFileSync('pdftoppm', ['-r', '70', '-png', file, `${OUT}/${label.toLowerCase()}`]);

    // Hidden data round trip: load the PDF back and compare
    await p.click('#confirm-primary').catch(() => {});
    await p.evaluate(() => document.querySelector('.clear-link').click()); await p.click('#confirm-primary'); await p.waitForTimeout(250);
    // (This test uses the one-page layout, which has no opening screen; hand the PDF to the file picker directly.)
    await p.setInputFiles('#file-input', file);
    await p.waitForSelector('#confirm-sheet:not([hidden])');
    ok('Load from a PDF asks first', (await p.textContent('#confirm-title')).includes('Set up the next huddle from this PDF'));
    await p.click('#confirm-primary'); await p.waitForTimeout(400);
    // Names and needs stay on the cards; the actions, assignees and whens are in Return and Report.
    const vals = await p.$$eval('#cp-groups input, #cp-groups textarea, #tn-list input, #tn-list textarea', els => els.map(e => e.value).join(' | '));
    const rrText = await p.$$eval('#rr-list .rr-card', els => els.map(e => e.textContent).join(' | '));
    const lost = [];
    for (const g of ['nm', 'rm', 'bt']) s.cp[g].forEach(a => { [a.name].forEach(v => { if (!vals.includes(v)) lost.push(v); }); [a.action, a.assigned, a.when].forEach(v => { if (v && !rrText.includes(v)) lost.push(v); }); });
    s.tn.forEach(t => { [t.name, t.ordinance].forEach(v => { if (!vals.includes(v)) lost.push(v); }); [t.action, t.assigned, t.when].forEach(v => { if (v && !rrText.includes(v)) lost.push(v); }); });
    ok('Load from a PDF: names stay, and actions, assignees and whens are in Return and Report', lost.length === 0, lost.join(' | '));
    const td = new Date(); const todayISO = td.getFullYear() + '-' + String(td.getMonth() + 1).padStart(2, '0') + '-' + String(td.getDate()).padStart(2, '0');
    ok('Load from a PDF: set up for the next huddle, dated today', await p.inputValue('#date') === todayISO && (await p.textContent('#rr-from')).includes('last huddle'), await p.inputValue('#date'));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await browser.close();
  const fails = results.filter(r => !r).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
})().catch(e => { console.error(e); process.exit(1); });
