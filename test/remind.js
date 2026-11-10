const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-view-all'].forEach(k => localStorage.setItem(k, '1')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/#huddle'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  const shown = async () => (await p.isVisible('#toast')) ? (await p.textContent('#toast')) : '';
  const hide = () => p.evaluate(() => { document.getElementById('toast').hidden = true; });
  await p.click('#tn-list .sac-toggle >> nth=0'); ok(!(await shown()).includes('Covenant Path'), 'no reminder on Name Next Ordinance sacrament'); await hide();
  await p.click('[data-group="bt"] .commit-box'); ok(!(await shown()).includes('Covenant Path'), 'no reminder on committed to baptism'); await hide();
  await p.click('[data-group="rm"] .sac-toggle >> nth=0'); ok((await shown()).includes('sacrament attendance'), 'reminder on Covenant Path sacrament'); await hide();
  await p.click('[data-group="nm"] .temple-box input, [data-group="nm"] .temple-box >> nth=0').catch(async () => p.click('[data-group="nm"] .temple-box'));
  ok((await shown()).includes('temple attendance'), 'reminder on new member temple attendance');
  ok(!errs.length, 'no errors ' + errs.join('; '));
  console.log(pass + '/' + (pass + fail) + ' checks passed'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
