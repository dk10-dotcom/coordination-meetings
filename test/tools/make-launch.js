// Makes the launch screens the iPhone shows while Huddle opens from the Home Screen (icons/launch/*.png):
// the app icon on the app's navy, with its name under it. Run it if the icon or colors change:
//   node test/tools/make-launch.js       (prints the <link> lines for index.html)
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'icons', 'launch');
// iPhone screens in points (width × height) and pixel ratio
const SIZES = [[320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3], [420, 912, 3]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icons', 'icon-512.png')).toString('base64');
  const b = await chromium.launch(); const lines = [];
  for (const [w, hgt, d] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: d });
    await p.setContent(`<!doctype html><html><body style="margin:0;height:100vh;background:#1B2B4B;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif">
      <img src="${icon}" style="width:112px;height:112px;border-radius:26px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <div style="color:#FFFFFF;font-size:26px;font-weight:700;letter-spacing:.01em">Huddle</div>
      <div style="color:#AFC0DE;font-size:14px;font-weight:600">Weekly Ward Mission Process</div></body></html>`);
    const file = `launch-${w * d}x${hgt * d}.png`;
    await p.screenshot({ path: path.join(OUT, file) }); await p.close();
    lines.push(`<link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${hgt}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)" href="icons/launch/${file}">`);
  }
  await b.close(); console.log(lines.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
