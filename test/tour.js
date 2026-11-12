const { chromium, devices } = require('playwright');
const res = []; const ok = (l, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
(async () => {
  await require('./tools/compat-fill.js')();
  const b = await chromium.launch();
  for (const [d, n] of [['iPhone 13', 'i13'], ['iPhone SE', 'se']]) {
    const ctx = await b.newContext({ ...devices[d] });
    await ctx.addInitScript(() => { try { localStorage.setItem('huddle-names-hint-seen','1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/#huddle'); await p.waitForSelector('.chip', { state: 'attached' }); await p.click('[data-action="dismiss-install"]').catch(() => {});
    if (n === 'i13') {
      await p.evaluate(() => document.querySelector('[data-action="help"]').click()); await p.waitForSelector('#help-sheet:not([hidden])');
      ok('Take the tour is a row in How to use', await p.isVisible('#help-sheet [data-action="tour"]'));
      await p.click('#help-sheet [data-action="tour"]');
    } else {
      await p.evaluate(() => window.HuddleTour.start());
    }
    await p.waitForSelector('.tour:not([hidden])');
    ok(n + ': How to use closed when the tour starts', await p.isHidden('#help-sheet'));
    const total = await p.evaluate(() => window.HuddleTour.steps);
    let bad = []; const views = [], demos = [], titles = [], texts = [];
    for (let i = 0; i < total; i++) {
      await p.waitForTimeout(320);
      const info = await p.evaluate(() => {
        const bub = document.querySelector('.tour-bubble').getBoundingClientRect();
        const spot = document.querySelector('.tour-spot'); const sr = spot.getBoundingClientRect();
        return { title: document.querySelector('.tour-title').textContent, count: document.querySelector('.tour-count').textContent,
          bubIn: bub.top >= 0 && bub.bottom <= innerHeight && bub.left >= 0 && bub.right <= innerWidth,
          spotOn: getComputedStyle(spot).opacity !== '0', spotH: Math.round(sr.height),
          overlap: !(bub.bottom <= sr.top + 2 || bub.top >= sr.bottom - 2), cls: document.querySelector('.tour-bubble').className,
          view: document.body.getAttribute('data-view'), demo: document.querySelector('.tour-demo').textContent, wide: document.documentElement.scrollWidth > innerWidth };
      });
      if (!info.bubIn) bad.push(info.count + ' bubble off screen');
      if (info.wide) bad.push(info.count + ' page wider than the screen');
      views.push(info.view); demos.push(info.demo); titles.push(info.title); texts.push(await p.textContent('.tour-text'));
      await p.screenshot({ path: `test/out15/${n}-${String(i + 1).padStart(2, '0')}.png` });
      console.log(`  ${info.count} ${info.title} | spot ${info.spotOn ? info.spotH + 'px' : 'none'} | ${info.cls}${info.overlap && info.spotOn ? ' | covers part of highlight' : ''}`);
      await p.click('.tour-next');
    }
    ok(n + ': every bubble fully on screen', bad.length === 0, bad.join(', '));
    ok(n + ': the tour has 10 stops', total === 10, String(total));
    ok(n + ': the two stops about one person open that person’s screen in the huddle', views.filter(v => v === 'p-hd').length === 2, views.join(','));
    ok(n + ': the tour covers all four steps: Before ward council, Ward council, the Huddle and After the huddle', views[2] === 'bw' && views[3] === 'wc' && views.includes('home') && views.includes('rr') && titles.includes('Before ward council') && titles.includes('After the huddle'), views.join(',') + ' | ' + titles.join(','));
    ok(n + ': the stop on the four steps no longer says the boxes turn green', !texts[1].includes('green') && texts[1].includes('Then tap Send.'), texts[1]);
    ok(n + ': the tour keeps the confidentiality warning', demos.some(d => d.includes('Never add confidential information to this agenda.')));
    await p.waitForTimeout(500);
    ok(n + ': the sample name the tour shows is never saved', await p.evaluate(() => !(localStorage.getItem('huddle-agenda-v1') || '').includes('Daniel Rivera')));
    ok(n + ': tour closes at the end and is remembered', await p.isHidden('.tour') && await p.evaluate(() => window.HuddleTour.seen()));
    // Back and Skip
    await p.evaluate(() => window.HuddleTour.start()); await p.click('.tour-next'); await p.click('.tour-next'); await p.click('.tour-back');
    ok(n + ': Back goes back a step', (await p.textContent('.tour-count')).startsWith('2 of'));
    await p.click('.tour-skip'); ok(n + ': Skip ends it', await p.isHidden('.tour'));
    await p.evaluate(() => window.HuddleTour.start()); await p.keyboard.press('Escape'); ok(n + ': Escape ends it', await p.isHidden('.tour'));
    console.log('PROBLEMS:', errs.length ? errs : 'none'); await ctx.close();
  }
  // #tour link starts it
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8765/#tour'); await p.waitForSelector('.chip', { state: 'attached' }); await p.waitForTimeout(300);
  ok('#tour link starts the tour', await p.isVisible('.tour'));
  console.log(`${res.filter(Boolean).length}/${res.length} checks passed`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
