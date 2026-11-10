const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
  const ctx = await b.newContext({ ...devices[d] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => {
    const s = { ward: 'X', date: '2026-11-08', attendees: [], rr: [{plan:'',happened:'',notes:''}], cp: { nm: [{ name: 'Maria Lopez', ordinance: 'Temple recommend', need: 'A friend', carried: true }, { name: '' }], rm: [{}], bt: [{}] }, tn: [{}, {}, {}] };
    sessionStorage.setItem('huddle-draft-v1', JSON.stringify(s)); });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(()=>{});
  await p.locator('[data-group="nm"]').screenshot({ path: `test/out9/${n}-panel2.png` });
  await ctx.close(); }
  await b.close(); })();
