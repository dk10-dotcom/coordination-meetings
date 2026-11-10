// Covenant Path lists with no one this week: confirm "none", PDF wording, add/undo/remove.
// These checks fill many cards in a row, so they keep every card open in its list ('huddle-cards-open').
// The lists of names and each person's own screen are covered by rows.js and twodoor.js.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');

// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

const OUT = 'test/out-empty'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { ['huddle-names-hint-seen', 'huddle-tour-seen', 'huddle-help-seen', 'huddle-cards-open'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('#details-summary'); await p.fill('#ward', 'Test Ward'); await p.fill('#date', '2026-11-08'); await p.click('[data-action="conducting"][data-a="wml"]');
  await p.click('[data-action="close-details"]');
  await p.click('[data-action="open-step"][data-a="cp"]');
  ok(await p.locator('#cp-groups .list-panel.is-empty').count() === 3, 'fresh form: all three lists show the empty state');
  ok(await p.locator('#cp-groups .card').count() === 0, 'no blank cards on empty lists');
  await p.screenshot({ path: `${OUT}/empty.png`, fullPage: true });
  // Confirm none for Returning members
  await p.click('[data-action="cp-none"][data-a="rm"]');
  ok((await p.textContent('.list-rm')).includes('No one on the Covenant Path Report this week') && (await p.textContent('.list-rm .list-count')).includes('None this week'), 'confirmed list says none this week');
  ok(await p.locator('.list-rm [data-action="cp-none"]').count() === 0, 'confirm button gone once confirmed');
  // Undo and confirm again
  await p.click('[data-action="cp-none-undo"][data-a="rm"]');
  ok(await p.locator('.list-rm [data-action="cp-none"]').count() === 1, 'Undo brings the choice back');
  await p.click('[data-action="cp-none"][data-a="rm"]'); await p.click('[data-action="cp-none"][data-a="bt"]');
  // Add a person to New members
  await p.click('[data-action="cp-add-first"][data-a="nm"]'); await p.waitForTimeout(700);
  ok(await p.locator('.list-nm .card').count() === 1 && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind') === 'cp.nm.0.name'), 'Add a person opens a card and focuses the name');
  await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him to the temple');
  await p.screenshot({ path: `${OUT}/mixed.png`, fullPage: true });
  // Status on the home screen
  await p.click('[data-action="steps-home"]');
  ok((await p.textContent('[data-a="cp"] .step-status')).includes('1 person'), 'status counts the one person');
  // Survives a reload
  await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.chip', { state: 'attached' });
  await p.click('[data-action="open-step"][data-a="cp"]');
  ok((await p.textContent('.list-bt')).includes('No one on the Covenant Path Report this week'), 'confirmed none survives a reload');
  // Remove the only card -> back to the empty state
  await p.click('.list-nm [data-action="remove-cp"]'); if (await p.isVisible('#confirm-primary')) await p.click('#confirm-primary');
  ok(await p.locator('.list-nm.is-empty').count() === 1 && await p.locator('.list-nm [data-action="cp-none"]').count() === 1, 'removing the last card brings back the empty state');
  // Add again so the PDF has a person, then send
  await p.click('[data-action="cp-add-first"][data-a="nm"]'); await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await p.fill('[data-bind="cp.nm.0.action"]', 'Drive him');
  await p.click('[data-action="cp-none-undo"][data-a="bt"]'); // leave Those being taught unconfirmed
  ok(!(await p.isVisible('.actionbar')), 'Save and Send are hidden inside a section');
  await p.click('[data-action="steps-home"]');
  ok(!(await p.isVisible('.actionbar')), 'no Send bar on the huddle’s list (it’s on the opening screen)');
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const ab = document.querySelector('#after-box'); if (ab && !ab.classList.contains('done')) { document.querySelector('[data-action="open-after"]').click(); document.querySelector('[data-action="after-done"]').click(); } }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const file = `${OUT}/empty.pdf`; await dl.saveAs(file);
  const t = execFileSync('pdftotext', ['-layout', file, '-']).toString();
  const sec = n => { const i = t.indexOf(n); return t.slice(i, i + 400); };
  ok(/RETURNING MEMBERS\s+No one on the Covenant Path Report this week/.test(t), 'PDF: confirmed list says no one on the report');
  ok(/THOSE BEING TAUGHT\s+Not reviewed/.test(t), 'PDF: unconfirmed empty list says Not reviewed');
  ok(t.includes('Daniel Rivera'), 'PDF: the person is listed');
  // All three confirmed -> status
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  if (await p.isVisible('[data-action="steps-home"]')) await p.click('[data-action="steps-home"]');
  await p.evaluate(() => document.querySelector('.clear-link').click()); await p.click('#confirm-primary'); await p.waitForTimeout(300);
  ok(await p.locator('.step-row').count() === 4, 'back on the home list after Send & Clear');
  {
    await p.click('[data-action="open-step"][data-a="cp"]');
    for (const g of ['nm', 'rm', 'bt']) await p.click(`[data-action="cp-none"][data-a="${g}"]`);
    await p.click('[data-action="steps-home"]');
    ok((await p.textContent('[data-a="cp"] .step-status')).includes('No one on the report this week'), 'all three confirmed: status says no one on the report');
  }
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  console.log(`${pass}/${pass + fail} checks passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
