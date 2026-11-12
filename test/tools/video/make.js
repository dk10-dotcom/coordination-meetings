// Remakes the training video (media/training-video.mp4) and its poster from the app as it is now.
// Run it whenever the app's look changes:
//
//   python3 -m http.server 8765        (from the top folder, in another window)
//   node test/tools/video/make.js
//
// It walks through a week with made-up names (seed.js) on an iPhone-sized screen, draws each scene in
// scenes.js (words on the left, the phone on the right, a ring around what to tap), and joins them into
// a 1920x1080 video with no sound. To change the wording or timing, edit scenes.js. Needs ffmpeg.
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const WORK = path.join(__dirname, '..', '..', 'out-video'), MEDIA = path.join(__dirname, '..', '..', '..', 'media');
const scenes = require('./scenes.js');
(async () => {
  await require('./capture.js')();
  await require('./compose.js')();
  fs.mkdirSync(WORK + '/clips', { recursive: true });
  let list = '';
  scenes.forEach((sc, i) => {
    const n = String(i).padStart(2, '0'), out = `${WORK}/clips/c${n}.mp4`, tmp = `${WORK}/clips/tmp${n}.mp4`, d = sc.t, f = 0.35;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', `${WORK}/frames/f${n}.png`, '-vf',
      `format=yuv420p,loop=-1:1,trim=duration=${d},fade=t=in:st=0:d=${f}:color=0xF3F5F9,fade=t=out:st=${d - f}:d=${f}:color=0xF3F5F9`,
      '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', tmp]);
    fs.renameSync(tmp, out); list += `file 'c${n}.mp4'\n`;
  });
  fs.writeFileSync(`${WORK}/clips/list.txt`, list);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${WORK}/clips/list.txt`, '-c', 'copy', '-movflags', '+faststart', `${WORK}/training-video.mp4`]);
  fs.copyFileSync(`${WORK}/training-video.mp4`, `${MEDIA}/training-video.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${WORK}/frames/f00.png`, '-vf', 'scale=960:540', '-q:v', '3', `${MEDIA}/training-poster.jpg`]);
  const secs = scenes.reduce((a, s) => a + s.t, 0);
  console.log(`Wrote media/training-video.mp4 (${Math.floor(secs / 60)} min ${secs % 60} s) and media/training-poster.jpg`);
  console.log('If the length changed, update "About … minutes" beside Watch the training video in index.html.');
})().catch(e => { console.error(e); process.exit(1); });
