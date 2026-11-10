const { chromium, devices } = require('playwright');
// Sending no longer clears the form; to test loading last week, start from a clear form like another conductor would.
async function freshWeek(pg) { if (await pg.isVisible('#load-panel [data-action="load"]')) return; await pg.click('.clear-link'); await pg.click('#confirm-primary'); await pg.waitForTimeout(250); }


// The app asks "Ready to send?" when something is still open; tests send anyway.
async function sendAnyway(pg) { await pg.waitForTimeout(150); if (await pg.isVisible('#confirm-sheet') && /Ready to send/.test(await pg.textContent('#confirm-title'))) await pg.click('#confirm-primary'); }

(async () => {
  const WARD = process.env.WARD || 'Riverton 5th Ward', OUTF = process.env.OUTF || 'sample/Sample Agenda with Huddle Notes - Riverton 5th Ward - 2026-11-01.pdf';
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  const fill = async (k, v) => p.fill(`[data-bind="${k}"]`, v);
  const hnote = async (k, v) => { const f = p.locator(`[data-bind="${k}"]`); if (!(await f.isVisible())) await f.locator('xpath=ancestor::div[contains(@class,"card-zone")]').locator('[data-action="add-hneed"]').click(); await f.fill(v); };
  // ----- Last week (Oct 25) -----
  await fill('ward', WARD); await fill('date', '2026-10-25');
  await p.click('[data-action="conducting"][data-a="wml"]');
  await fill('cp.nm.0.name', 'Daniel Rivera'); await fill('cp.nm.0.bap', '2026-10-17'); await fill('cp.nm.0.ordinance', 'Temple baptisms'); await fill('cp.nm.0.need', 'A ride to the temple'); await fill('cp.nm.0.action', 'Schedule limited-use recommend interview'); await fill('cp.nm.0.assigned', 'Bishop Allen'); await fill('cp.nm.0.when', 'Sun');
  await hnote('cp.nm.0.hneed', 'Follow up after the temple trip');
  await fill('cp.rm.0.name', 'Marcus Bell'); await fill('cp.rm.0.ordinance', 'Sacrament'); await fill('cp.rm.0.need', 'Friends at church'); await fill('cp.rm.0.action', 'Invite to elders quorum activity'); await fill('cp.rm.0.assigned', 'Bro. Hansen'); await fill('cp.rm.0.when', 'Sat');
  await fill('cp.bt.0.name', 'Olivia Chen'); await fill('cp.bt.0.need', 'Member friend to join lessons'); await fill('cp.bt.0.action', 'Sister Moore to join lesson 3'); await fill('cp.bt.0.assigned', 'Sister Moore'); await fill('cp.bt.0.when', 'Wed');
  await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.need', 'Temple prep class'); await fill('tn.0.action', 'Invite to temple prep'); await fill('tn.0.assigned', 'Sister Diaz'); await fill('tn.0.when', 'Tue');
  await fill('tn.1.name', 'Ethan Walker'); await fill('tn.1.ordinance', 'Melchizedek Priesthood'); await fill('tn.1.need', 'A friend in elders quorum'); await fill('tn.1.action', 'EQ president visits to talk about the priesthood'); await fill('tn.1.assigned', 'EQ president'); await fill('tn.1.when', 'Thu');
  await fill('tn.2.name', 'Sofia Martinez'); await fill('tn.2.ordinance', 'Sealing'); await fill('tn.2.need', 'Family history help'); await fill('tn.2.action', 'Invite to family history night'); await fill('tn.2.assigned', 'Sister Young'); await fill('tn.2.when', 'Wed');
  await fill('find.plan', 'Invite neighbors to the ward trunk-or-treat');
  await fill('find.items.0.task', 'Young women hand out invitations on Oak Street'); await fill('find.items.0.when', 'Sat');
  await p.click('[data-action="add-fn"]'); await fill('find.items.1.task', 'Bishopric invites part-member families'); await fill('find.items.1.when', 'Sun');
  await p.click('.btn-save'); await p.waitForTimeout(500); await p.click('.clear-link'); await p.click('#confirm-primary'); await p.waitForTimeout(200);
  // ----- This week (Nov 1) -----
  await fill('ward', WARD); await fill('date', '2026-11-01');
  await p.click('[data-action="conducting"][data-a="wml"]');
  for (const a of ['pqa', 'gol', 'rs', 'eq', 'wm', 'ftm', 'wml', 'hc']) { const c = await p.$(`[data-action="toggle-att"][data-a="${a}"]`); if (c) await c.click(); }
  await freshWeek(p); await p.click('[data-action="load"]'); await p.waitForSelector('#load-sheet:not([hidden])'); await p.click('.agenda-row'); await p.waitForSelector('#loaded-banner:not([hidden])');
  await p.click('[data-action="happened"][data-a="0"][data-b="Yes"]'); await fill('rr.0.notes', 'Interview set for Nov 8');
  await p.click('[data-action="happened"][data-a="1"][data-b="Partly"]'); await fill('rr.1.notes', 'Invited; may come next time');
  await p.click('[data-action="carry-fwd"][data-a="1"]');
  await p.click('[data-action="happened"][data-a="2"][data-b="Yes"]');
  await p.click('[data-action="happened"][data-a="3"][data-b="No"]'); await fill('rr.3.notes', 'Class was canceled');
  await p.click('[data-action="happened"][data-a="4"][data-b="Yes"]'); await fill('rr.4.notes', 'Ready for his interview');
  await p.click('[data-action="happened"][data-a="5"][data-b="Partly"]'); await fill('rr.5.notes', 'Came for the first half hour');
  await p.click('[data-action="happened"][data-a="6"][data-b="Yes"]'); await fill('rr.6.notes', '2 families came');
  await p.click('[data-action="happened"][data-a="7"][data-b="Partly"]'); await fill('rr.7.notes', 'Reached 3 of 5 families');
  await p.click('[data-action="carry-fwd"][data-a="7"]');
  // New members (Daniel carried over) + one more
  await p.click('[data-group="nm"] .sac-toggle >> nth=0');
  await fill('cp.nm.0.action', 'Drive him to the temple for baptisms'); await fill('cp.nm.0.assigned', 'Bro. Patel'); await fill('cp.nm.0.when', 'Sat 9 am');
  await p.click('[data-action="add-cp"][data-a="nm"]');
  await fill('cp.nm.1.name', 'Hannah Brooks'); await fill('cp.nm.1.bap', '2026-09-20'); await fill('cp.nm.1.ordinance', 'Temple baptisms'); await fill('cp.nm.1.need', 'Limited-use recommend'); await fill('cp.nm.1.action', 'Bishop to call and schedule interview'); await fill('cp.nm.1.assigned', 'Bishop Allen'); await fill('cp.nm.1.when', 'Tue');
  await hnote('cp.nm.1.hneed', 'Pair with a youth who went to the temple recently');
  await p.click('[data-group="nm"] [data-temple="1"]').catch(() => {}); await p.click('[data-group="nm"] [data-temple="1"]').catch(() => {});
  // Returning members
  await hnote('cp.rm.0.hneed', 'Invite to midweek activities too');
  await fill('cp.rm.0.assigned', 'Bro. Hansen'); await fill('cp.rm.0.when', 'Sat');
  await p.click('[data-action="add-cp"][data-a="rm"]');
  await fill('cp.rm.1.name', 'Lisa Morgan'); await fill('cp.rm.1.ordinance', 'Sacrament'); await fill('cp.rm.1.need', 'A friend in Relief Society'); await fill('cp.rm.1.action', 'Introduce to Primary presidency'); await fill('cp.rm.1.assigned', 'Sister Kim'); await fill('cp.rm.1.when', 'Sun');
  await p.click('[data-group="rm"] .sac-toggle >> nth=1');
  // Those being taught
  await p.click('[data-group="bt"] .sac-toggle >> nth=0'); await p.click('[data-group="bt"] .commit-box >> nth=0');
  await fill('cp.bt.0.bap', '2026-11-21'); await fill('cp.bt.0.action', 'Teach lesson 4 with member present'); await fill('cp.bt.0.assigned', 'Elders Ruiz & Webb'); await fill('cp.bt.0.when', 'Wed 7 pm');
  await p.click('[data-action="add-cp"][data-a="bt"]');
  await fill('cp.bt.1.name', 'James Park'); await fill('cp.bt.1.need', 'Answers about the Book of Mormon'); await fill('cp.bt.1.action', 'Give Book of Mormon, read 1 Nephi 1'); await fill('cp.bt.1.assigned', 'Sister missionaries'); await fill('cp.bt.1.when', 'Fri');
  // 3 Names
  await fill('tn.0.name', 'Grace Thompson'); await fill('tn.0.ordinance', 'Endowment'); await fill('tn.0.need', 'Temple prep class'); await fill('tn.0.action', 'Reschedule temple prep class'); await fill('tn.0.assigned', 'Sister Diaz'); await fill('tn.0.when', 'Tue');
  await fill('tn.1.name', 'Ethan Walker'); await fill('tn.1.ordinance', 'Melchizedek Priesthood'); await fill('tn.1.need', 'Interview with stake presidency'); await fill('tn.1.action', 'Schedule interview'); await fill('tn.1.assigned', 'EQ president'); await fill('tn.1.when', 'Sun');
  await hnote('tn.1.hneed', 'Ask EQ president about a mentor');
  await fill('tn.2.name', 'Sofia Martinez'); await fill('tn.2.ordinance', 'Sealing'); await fill('tn.2.need', 'Family history help'); await fill('tn.2.action', 'TFH consultant to visit'); await fill('tn.2.assigned', 'Bro. Young'); await fill('tn.2.when', 'Mon');
  await p.click('#tn-list .sac-toggle >> nth=1');
  await fill('find.plan', 'Welcome new move-ins on Maple Court and invite them to the ward Christmas party');
  await fill('find.items.0.when', 'Next Sun');
  await p.click('[data-action="add-fn"]'); await fill('find.items.1.task', 'Relief Society and elders quorum presidents visit Maple Court move-ins with a plate of cookies'); await fill('find.items.1.when', 'Sat');
  await p.click('[data-action="add-fn"]'); await fill('find.items.2.task', 'Sacrament speakers invite a friend to hear their talk'); await fill('find.items.2.when', 'Sun');
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.evaluate(() => { const m = document.querySelector('#mode-bar'), g = m && !m.hidden && m.querySelector('[data-action="go-start"]'); if (g) g.click(); const c = document.querySelector('#after-check'); if (c && !c.checked) c.click(); }).then(() => p.click('.actionbar [data-action="send"]')).then(() => sendAnyway(p)); await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  await dl.saveAs(OUTF);
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
