// Agendas whose meeting date is more than 4 weeks old are erased when the app opens.
const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('huddle-view-all', '1'); } catch (e) {} }); const page = await ctx.newPage();
  await page.goto(BASE); await page.waitForSelector('#attendee-list .chip');
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(new Date(d.getTime() - d.getTimezoneOffset() * 60000)); };
  const dates = { old: daysAgo(35), edge: daysAgo(29), recent: daysAgo(7) };
  await page.evaluate((dates) => new Promise((res, rej) => {
    const r = indexedDB.open('huddle', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('agendas', { keyPath: 'id' });
    r.onsuccess = () => {
      const t = r.result.transaction('agendas', 'readwrite'); const s = t.objectStore('agendas');
      for (const [k, d] of Object.entries(dates)) {
        s.put({ id: 'w|' + d, ward: 'Riverton 5th Ward', date: d, savedAt: new Date().toISOString(),
          data: { app: 'huddle-agenda', v: 1, ward: 'Riverton 5th Ward', date: d, cp: { nm: [{ name: k, action: 'x' }] }, tn: [] } });
      }
      t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error);
    };
  }), dates);
  await page.reload(); await page.waitForSelector('#attendee-list .chip'); await page.waitForTimeout(500);
  const left = await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('huddle', 1);
    r.onsuccess = () => { const q = r.result.transaction('agendas').objectStore('agendas').getAll(); q.onsuccess = () => res(q.result.map(x => x.date)); };
  }));
  console.log((left.length === 1 && left[0] === dates.recent ? 'PASS' : 'FAIL') + ' only the recent agenda remains after reopening:', left, dates);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
