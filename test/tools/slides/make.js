// Remakes the training slides (media/slides/) from the app as it is now. Run it whenever the app's look or
// steps change:
//
//   python3 -m http.server 8765        (from the top folder, in another window)
//   node test/tools/slides/make.js
//
// It walks through a week with made-up names (seed.js) on an iPhone-sized screen (capture.js), then saves, for
// each slide in scenes.js, a picture of the phone with a ring around what to tap (media/slides/NN.jpg), and
// the slides' words in media/slides/slides.json. The app shows them one at a time; people tap Next when ready.
// To change the wording, edit scenes.js and run this again.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const scenes = require('./scenes.js');
const WORK = path.join(__dirname, '..', '..', 'out-slides'), OUT = path.join(__dirname, '..', '..', '..', 'media', 'slides');
const COLORS = { slate: '#4F5A8C', blue: '#2F5DA6', orange: '#B0531A', green: '#237445', plum: '#6E2F7E', red: '#B22A2A' };
const PH = 640, SCALE = PH / 664, PW = Math.round(390 * SCALE); // the phone screen, drawn 640 px tall

(async () => {
  await require('./capture.js')();
  const shots = Object.fromEntries(JSON.parse(fs.readFileSync(WORK + '/cap/shots.json')).map(s => [s.id, s.box]));
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).filter(f => /^\d+\.jpg$/.test(f)).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: PW + 20, height: PH + 20 }, deviceScaleFactor: 2 });
  const slides = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i], col = COLORS[sc.c] || '#1E3A6E', box = sc.kind ? null : shots[sc.shot];
    const img = 'data:image/jpeg;base64,' + fs.readFileSync(`${WORK}/cap/${sc.shot}.jpg`).toString('base64');
    const ring = box ? `<div class="ring" style="left:${box.x * SCALE - 6}px;top:${box.y * SCALE - 6}px;width:${box.width * SCALE + 12}px;height:${box.height * SCALE + 12}px"></div>` : '';
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0} html{background:#FFFFFF} body{width:${PW + 20}px;height:${PH + 20}px;background:#16213A;border-radius:44px;overflow:hidden;padding:10px}
      .screen{position:relative;width:${PW}px;height:${PH}px;border-radius:34px;overflow:hidden;background:#F3F5F9}
      .screen img{width:${PW}px;height:${PH}px;display:block}
      .ring{position:absolute;border:4px solid ${col};border-radius:14px;box-shadow:0 0 0 6px ${col}33}
      </style></head><body><div class="screen"><img src="${img}">${ring}</div></body></html>`);
    await p.waitForTimeout(60);
    const file = String(i + 1).padStart(2, '0') + '.jpg';
    await p.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 78, omitBackground: true });
    slides.push(sc.kind === 'title'
      ? { kicker: 'Huddle', title: 'Ward Mission Leader Process', body: sc.sub + '. ' + sc.body, color: '#2F5DA6', img: file }
      : sc.kind === 'end'
      ? { kicker: 'Huddle', title: sc.title, body: sc.body, fine: 'Never add confidential information to this huddle report.', color: '#2F5DA6', img: file }
      : { kicker: sc.k, title: sc.title, body: sc.body, color: col, img: file });
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(slides, null, 1) + '\n');
  const kb = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
  console.log(`Wrote ${slides.length} slides to media/slides (${Math.round(kb)} KB in all).`);
})().catch(e => { console.error(e); process.exit(1); });
