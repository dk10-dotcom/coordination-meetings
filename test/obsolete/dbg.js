const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip'); await p.click('[data-action="dismiss-install"]').catch(()=>{});
  await p.click('[data-action="add-cp"][data-a="bt"]');
  await p.fill('[data-bind="cp.bt.1.name"]', 'James Park');
  await p.fill('[data-bind="tn.1.name"]', 'Ethan Walker');
  await p.click('#tn-list .card >> nth=1 >> [data-action="add-hneed"]');
  console.log('focused:', await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bind')));
  await p.fill('[data-bind="tn.1.hneed"]', 'Ask EQ president about a mentor');
  await p.fill('[data-bind="tn.2.name"]', 'Sofia Martinez');
  const st = await p.evaluate(() => JSON.parse(sessionStorage.getItem('huddle-draft-v1') || 'null'));
  await p.waitForTimeout(400);
  const st2 = await p.evaluate(() => JSON.parse(sessionStorage.getItem('huddle-draft-v1') || 'null'));
  console.log('bt names:', st2.cp.bt.map(x => x.name), 'tn names:', st2.tn.map(x => x.name), 'tn1 hneed:', st2.tn[1].hneed);
  console.log('inputs:', await p.inputValue('[data-bind="cp.bt.1.name"]'), '|', await p.inputValue('[data-bind="tn.2.name"]'));
  await b.close();
})();
