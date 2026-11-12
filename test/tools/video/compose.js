// Draws each scene as a 1920x1080 picture: the words on the left, the phone screen on the right,
// with a ring around the thing to tap.
const { chromium } = require('playwright');
const fs = require('fs');
const scenes = require('./scenes.js');
const WORK = require('path').join(__dirname, '..', '..', 'out-video');
const COLORS = { slate: '#4F5A8C', blue: '#2F5DA6', orange: '#B0531A', green: '#237445', plum: '#6E2F7E', red: '#B22A2A' };
const PH = 640, SCALE = PH / 664, PW = Math.round(390 * SCALE);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let shots = {};
const page = (sc, i) => {
  const img = 'data:image/jpeg;base64,' + fs.readFileSync(`${WORK}/cap/${sc.shot}.jpg`).toString('base64');
  const box = sc.kind ? null : shots[sc.shot];
  const ring = box ? `<div class="ring" style="left:${box.x * SCALE - 7}px;top:${box.y * SCALE - 7}px;width:${box.width * SCALE + 14}px;height:${box.height * SCALE + 14}px"></div>` : '';
  const col = COLORS[sc.c] || '#1E3A6E';
  const n = scenes.filter(s => !s.kind).indexOf(sc), total = scenes.filter(s => !s.kind).length;
  const text = sc.kind === 'title'
    ? `<p class="brand">Huddle</p><h1 class="big">Ward Mission Leader Process</h1><p class="sub">${esc(sc.sub)}</p><p class="body">${esc(sc.body)}</p>`
    : sc.kind === 'end'
    ? `<h1 class="big">${esc(sc.title)}</h1><p class="body">${esc(sc.body)}</p><p class="fine">Never add confidential information to this agenda.<br>Not affiliated with The Church of Jesus Christ of Latter-day Saints.</p>`
    : `<p class="kicker" style="color:${col}">${esc(sc.k)}</p><h1>${esc(sc.title)}</h1><p class="body">${esc(sc.body)}</p>`;
  const dots = sc.kind ? '' : `<div class="prog"><span style="width:${Math.round(100 * (n + 1) / total)}%"></span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0} body{width:1280px;height:720px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:radial-gradient(1200px 700px at 85% 40%,#E6ECF6,#F3F5F9 60%);color:#1B2B4B;position:relative}
  .text{position:absolute;left:96px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;gap:18px}
  .kicker{font-size:20px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  h1{font-size:52px;line-height:1.08;font-weight:800;letter-spacing:-.01em} h1.big{font-size:64px}
  .brand{font-size:22px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2F5DA6}
  .sub{font-size:28px;font-weight:600;color:#34589A;line-height:1.25}
  .body{font-size:28px;line-height:1.42;color:#3A4456;max-width:620px}
  .fine{margin-top:18px;font-size:17px;line-height:1.5;color:#7A1C1C;font-weight:600}
  .phone{position:absolute;right:120px;top:40px;width:${PW + 20}px;height:${PH + 20}px;padding:10px;border-radius:46px;background:#16213A;box-shadow:0 30px 60px -20px rgba(22,33,58,.45)}
  .screen{position:relative;width:${PW}px;height:${PH}px;border-radius:36px;overflow:hidden;background:#F3F5F9}
  .screen img{width:${PW}px;height:${PH}px;display:block}
  .ring{position:absolute;border:4px solid ${col};border-radius:16px;box-shadow:0 0 0 6px ${col}33}
  .prog{position:absolute;left:96px;bottom:56px;width:240px;height:6px;border-radius:6px;background:#D6DCE6;overflow:hidden}
  .prog span{display:block;height:100%;background:${col};border-radius:6px}
  </style></head><body><div class="text">${text}</div><div class="phone"><div class="screen"><img src="${img}">${ring}</div></div>${dots}</body></html>`;
};
module.exports = (async () => {
  shots = Object.fromEntries(JSON.parse(fs.readFileSync(WORK + '/cap/shots.json')).map(s => [s.id, s.box]));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  fs.mkdirSync(WORK + '/frames', { recursive: true });
  const only = null;
  for (let i = 0; i < scenes.length; i++) {
    if (only && !only.includes(i)) continue;
    await p.setContent(page(scenes[i], i)); await p.waitForTimeout(80);
    const over = await p.evaluate(() => { const t = document.querySelector('.text'); return t.scrollHeight > t.clientHeight + 2; });
    if (over) console.log('TEXT TOO LONG in scene', i);
    await p.screenshot({ path: `${WORK}/frames/f${String(i).padStart(2, '0')}.png` });
  }
  await b.close(); console.log('frames done');
});
