const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const ctx = await b.newContext({ ...devices[dev], acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { ['huddle-names-hint-seen','huddle-tour-seen','huddle-help-seen'].forEach(k => localStorage.setItem(k,'1')); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
    const fill = (k, v) => p.fill(`[data-bind="${k}"]`, v);
    const tag = dev === 'iPhone SE' ? 'se' : 'i13';
    // Section and tips
    ok(await p.isVisible('#h-fn'), 'section heading visible');
    await p.click('[data-action="find-tips"]'); await p.waitForSelector('#find-tips-sheet:not([hidden])');
    ok(await p.locator('#find-tips-sheet .idea-list li').count() === 15, '15 ideas');
    ok(await p.locator('#find-tips-sheet .find-list li').count() === 4, '4 tips');
    await p.screenshot({ path: `out-find/${tag}-tips.png` });
    await p.click('[data-action="close-find-tips"]'); ok(await p.isHidden('#find-tips-sheet'), 'tips closes');
    // Last week
    await fill('ward', 'Riverton 5th Ward'); await fill('date', '2026-10-25');
    await fill('find.plan', 'Invite neighbors to the ward Halloween party');
    await fill('find.items.0.task', 'Young women hand out flyers on Oak Street'); await fill('find.items.0.when', 'Sat');
    await p.click('[data-action="add-fn"]'); await fill('find.items.1.task', 'Bishopric invites part-member families'); await fill('find.items.1.when', 'Sun');
    ok(await p.locator('.fn-assign').count() === 2, 'two assignments');
    await p.locator('#fn-list').scrollIntoViewIfNeeded(); await p.screenshot({ path: `out-find/${tag}-section.png` });
    // remove asks when filled
    await p.click('[data-action="remove-fn"][data-a="1"]'); ok(!(await p.isHidden('#confirm-sheet')), 'remove asks');
    await p.click('#confirm-secondary'); ok(await p.locator('.fn-assign').count() === 2, 'kept after cancel');
    await p.click('.btn-save'); await p.waitForTimeout(500); await p.click('.clear-link'); await p.click('#confirm-primary'); await p.waitForTimeout(200);
    ok(await p.inputValue('[data-bind="find.plan"]') === '', 'cleared');
    // This week: load
    await fill('date', '2026-11-01');
    await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
    const rrText = await p.locator('#rr-list').innerText();
    ok(/Finding new people/.test(rrText) && /flyers on Oak Street/.test(rrText) && /Sat/.test(rrText), 'assignments in Return and Report');
    ok(await p.locator('#rr-list .rr-card').count() === 2, 'two RR items');
    await p.click('[data-action="happened"][data-a="0"][data-b="No"]');
    await p.click('[data-action="carry-fwd"][data-a="0"]');
    ok(await p.inputValue('[data-bind="find.items.0.task"]') === 'Young women hand out flyers on Oak Street', 'carried forward into assignments');
    ok(await p.locator('.fn-assign .source').count() === 1, 'From last week tag');
    await p.locator('#rr-list .rr-card').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: `out-find/${tag}-rr.png` });
    await fill('find.plan', 'Visit new move-ins on Maple Court');
    await fill('find.items.0.when', 'Sat 10 am');
    // PDF
    await p.evaluate(() => { navigator.canShare = () => false; });
    await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
    const f = `out-find/${tag}.pdf`; await dl.saveAs(f);
    const t = execSync(`pdftotext -layout "${f}" -`).toString();
    ok(/Plans to Find New People to Teach/.test(t) && /Maple Court/.test(t) && /flyers on Oak Street/.test(t) && /Finding new people/.test(t), 'PDF has section and RR rows');
    ok(!errs.length, 'no errors ' + errs.join('; '));
    await ctx.close();
  }
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
