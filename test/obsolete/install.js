// Add to Home Screen banner and button on iPhone, Android (with and without install prompt), app mode, desktop.
const { chromium, devices } = require('playwright');
const OUT = __dirname + '/out2';
const BASE = 'http://127.0.0.1:8765/#huddle';
const ok = (l, c) => console.log((c ? 'PASS ' : 'FAIL ') + l);
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const open = async (opts, init) => {
    const ctx = await browser.newContext(opts);
    if (init) await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.on('pageerror', e => problems.push(e.message));
    await p.goto(BASE); await p.waitForSelector('.chip'); return p;
  };

  // iPhone: banner + steps sheet
  let p = await open({ ...devices['iPhone 13'] });
  ok('iPhone banner shown', await p.isVisible('#install-banner'));
  ok('banner says phone, not iPhone', !(await p.textContent('#install-banner')).includes('iPhone'));
  await p.screenshot({ path: OUT + '/i-banner.png' });
  await p.click('[data-action="install"]');
  await p.waitForSelector('#install-sheet:not([hidden])');
  ok('iPhone steps mention Share', (await p.textContent('#install-steps')).includes('Tap the Share button'));
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/i-steps.png' });
  await p.click('[data-action="close-install"]');
  await p.click('[data-action="dismiss-install"]');
  ok('Not now hides banner', await p.isHidden('#install-banner'));
  await p.context().close();

  // Android without install prompt: banner + Android steps
  p = await open({ ...devices['Pixel 5'] });
  ok('Android banner shown', await p.isVisible('#install-banner'));
  await p.click('[data-action="install"]');
  await p.waitForSelector('#install-sheet:not([hidden])');
  ok('Android steps mention menu', (await p.textContent('#install-steps')).includes('Install app'));
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/a-steps.png' });
  await p.context().close();

  // Android with Chrome's install prompt
  p = await open({ ...devices['Pixel 5'] });
  await p.evaluate(() => {
    window.__prompted = false;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = true; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await p.click('[data-action="install"]');
  await p.waitForTimeout(300);
  ok('native install prompt used', await p.evaluate(() => window.__prompted));
  ok('banner hidden after install', await p.isHidden('#install-banner'));
  ok('no steps sheet when prompt exists', await p.isHidden('#install-sheet'));
  ok('install toast', (await p.textContent('#toast')).startsWith('Added.'));
  await p.context().close();

  // Opened from the Home Screen: no banner
  p = await open({ ...devices['iPhone 13'] }, () => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => q.includes('display-mode: standalone') ? { matches: true, addEventListener() {}, removeEventListener() {} } : mm(q);
  });
  ok('no banner in Home Screen app', await p.isHidden('#install-banner'));
  await p.context().close();

  // Desktop: no banner
  p = await open({ viewport: { width: 1280, height: 900 } });
  ok('no banner on desktop', await p.isHidden('#install-banner'));
  await p.context().close();

  console.log('PROBLEMS:', problems.length ? problems : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
