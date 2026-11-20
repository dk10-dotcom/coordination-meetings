// The baptism date opens Huddle's own calendar (Nov 20, 2026). The phone's date picker filled in today's date just
// from looking at it; now a date is only kept when Apply is tapped, Clear empties it, and Cancel leaves it as it was.
const { chromium, devices } = require('playwright');
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('PASS ' + m); } else { failed++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone SE'] });
  await c.addInitScript(() => { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = ms => p.waitForTimeout(ms);
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('huddle-agenda-v1') || '{}'));
  await p.goto('http://127.0.0.1:8765/'); await w(800); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.click('#before-box'); await w(400);
  await p.click('#before-list [data-action="add-person"][data-a="nm"]'); await p.waitForSelector('#person-view:not([hidden])'); await w(300);
  await p.fill('[data-bind="cp.nm.0.name"]', 'Daniel Rivera'); await w(300);
  const tap = '#person-card .date-tap[data-a="cp.nm.0.bap"]';
  ok(await p.isVisible(tap), 'the baptism date box is there');
  // Looking and tapping away: nothing is filled in
  await p.click(tap); await w(300);
  ok(await p.isVisible('#confirm-sheet') && (await p.textContent('#confirm-title')).trim() === 'Baptism date' && await p.locator('#confirm-sheet .cal-day').count() >= 28, 'tapping it opens a calendar titled Baptism date');
  ok((await p.textContent('#confirm-primary')).trim() === 'Apply' && (await p.textContent('#confirm-secondary')).trim() === 'Clear' && (await p.textContent('#confirm-tertiary')).trim() === 'Cancel', 'its buttons are Apply, Clear and Cancel');
  ok(!(await p.isVisible('#confirm-sheet .warn-icon')), 'no warning sign on it');
  await p.click('#confirm-tertiary'); await w(400);
  ok(!(await saved()).cp.nm[0].bap && (await p.inputValue('[data-bind="cp.nm.0.bap"]')) === '', 'Cancel: no date is added');
  await p.click(tap); await w(300); await p.click('#confirm-primary'); await w(400);
  ok(!(await saved()).cp.nm[0].bap, 'Apply with no day picked adds nothing');
  // Picking a day and Apply
  await p.click(tap); await w(300);
  await p.click('#confirm-sheet .cal-nav[aria-label="Previous month"]'); await w(150);
  const day = await p.getAttribute('#confirm-sheet .cal-day >> nth=9', 'data-day');
  await p.click('#confirm-sheet .cal-day >> nth=9'); await w(150);
  ok(await p.locator('#confirm-sheet .cal-day.is-sel').count() === 1 && !(await saved()).cp.nm[0].bap, 'picking a day marks it, but nothing is kept yet');
  await p.click('#confirm-primary'); await w(500);
  ok((await saved()).cp.nm[0].bap === day && (await p.inputValue('[data-bind="cp.nm.0.bap"]')) === day, 'Apply keeps the day picked (' + day + ')');
  // Cancel after picking another day keeps the first one
  await p.click(tap); await w(300);
  ok(await p.getAttribute('#confirm-sheet .cal-day.is-sel', 'data-day') === day, 'it opens on the date already set');
  await p.click('#confirm-sheet .cal-day >> nth=3'); await p.click('#confirm-tertiary'); await w(400);
  ok((await saved()).cp.nm[0].bap === day, 'Cancel keeps the date as it was');
  // Clear
  await p.click(tap); await w(300); await p.click('#confirm-secondary'); await w(500);
  ok(!(await saved()).cp.nm[0].bap && (await p.inputValue('[data-bind="cp.nm.0.bap"]')) === '', 'Clear empties it');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'it fits a small iPhone');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
  console.log(`${passed}/${passed + failed} checks passed`); process.exit(failed ? 1 : 0);
})();
