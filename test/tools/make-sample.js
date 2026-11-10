// Remakes the sample agenda pictures shown in How to use (sample/page-1.png, page-2.png, ...).
// Run it whenever the PDF's look changes:
//
//   python3 -m http.server 8765        (from the top folder, in another window)
//   node test/tools/make-sample.js     (writes into sample/; pass another folder to write elsewhere)
//
// It opens the app with a made-up huddle (fake names only), sends it, and turns each PDF page into a
// picture 900 pixels wide. If the number of pages changes, update the <img> list in index.html
// (#sample-sheet) and the file list in sw.js to match.
const { chromium, devices } = require('playwright');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'sample'));
const TMP = path.join(__dirname, '..', 'out-sample');
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-07' }, o);
const rr = o => Object.assign({ prefilled: true, source: '', group: '', pname: '', person: '', action: '', assigned: '', when: '', happened: '', notes: '', hneed: '' }, o);
const huddle = {
  ward: 'Sample Ward', date: '2026-11-08', conducting: 'wml', attendees: ['pqa', 'gol', 'rs', 'eq', 'wm', 'ftm', 'wml'], rolledFrom: '2026-11-01',
  rr: [
    rr({ group: 'nm', source: 'New members', pname: 'Daniel Rivera', action: 'Invite him on the ward temple trip Saturday', assigned: 'Bro. Patel', when: 'Sat', happened: 'Yes', notes: 'He came and did baptisms with the youth' }),
    rr({ group: 'rm', source: 'Returning members', pname: 'Olivia Chen', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun', happened: 'Partly', notes: 'Sister Diaz was out of town', carriedFwd: true }),
    rr({ group: 'bt', source: 'Those being taught', pname: 'Marcus Hill', action: 'Invite him to the ward dinner Friday', assigned: 'Elders quorum', when: 'Fri', happened: 'Yes', notes: 'He met three families' }),
    rr({ group: 'tn', source: 'Name Next Ordinance', pname: 'Grace Thompson', action: 'Family history consultant visits to prepare names', assigned: 'Sister Nguyen', when: 'Thu', happened: 'No', notes: 'Moved to this Thursday', carriedFwd: true }),
    rr({ group: 'fn', source: 'Finding new people', action: 'Each family invites one friend', when: 'Sun', happened: 'Partly', notes: 'Four families invited a friend' })
  ],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: '2026-10-27', temple: true, ordinance: 'Aaronic Priesthood', need: 'Meet with the bishop', action: 'Set up his interview for Sunday', assigned: 'Bro. Patel', when: 'Sun', sac: true }),
      card({ name: 'Emma Walsh', bap: '2026-10-18', ordinance: 'Temple baptisms', need: 'A ride to the temple', action: 'Go with the youth on Thursday', assigned: 'Sister Lee', when: 'Thu', sac: true })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun', actionCarried: true, hneed: 'Likes a text before a visit' })],
    bt: [card({ name: 'Marcus Hill', bap: '2026-11-21', committed: true, need: 'Get to know ward members', action: 'Home evening with the Patel family', assigned: 'Bro. Patel', when: 'Mon', sac: true })]
  },
  cpNone: {},
  tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names', action: 'Family history consultant visits to prepare names', assigned: 'Sister Nguyen', when: 'Thu', actionCarried: true }),
    card({ name: 'Samuel Ortiz', ordinance: 'Melchizedek Priesthood', need: 'Someone to study with', action: 'Elders quorum president meets with him', assigned: 'Bro. Young', when: 'Tue' }), card({ touched: '' })],
  find: { plan: 'Invite friends to the ward Christmas devotional', items: [{ task: 'Each family invites one friend', when: 'Sun', carried: true }, { task: 'Missionaries bring invitations to hand out', when: 'Wed' }] },
  referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: 'A friend from work who asked about the Book of Mormon' }],
  verified: { before: true, after: true }
};

(async () => {
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  // The saved huddle is put in place before the app starts (the app saves its own copy when a page closes).
  await ctx.addInitScript(() => { try { ['huddle-tour-seen', 'huddle-help-seen', 'huddle-names-hint-seen'].forEach(k => localStorage.setItem(k, '1')); const s = localStorage.getItem('__seed'); if (s) { localStorage.setItem('huddle-agenda-v1', s); localStorage.removeItem('__seed'); } } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-08T10:00:00')); // the sample is always dated Sunday, Nov 8
  await p.goto('http://127.0.0.1:8765/'); await p.waitForSelector('#start-home:not([hidden])');
  await p.evaluate(s => localStorage.setItem('__seed', JSON.stringify(s)), huddle);
  await p.reload(); await p.waitForSelector('#start-home:not([hidden])'); await p.click('[data-action="dismiss-install"]').catch(() => {});
  await p.evaluate(() => { navigator.canShare = () => false; });
  await p.click('.actionbar [data-action="send"]'); await p.waitForTimeout(300);
  if (await p.isVisible('#confirm-sheet')) await p.click('#confirm-primary');
  await p.waitForSelector('#share-btn:not([disabled])');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#share-btn')]);
  const pdf = path.join(TMP, 'sample.pdf'); await dl.saveAs(pdf);
  await b.close();
  if (errs.length) { console.error('The app reported errors: ' + errs.join('; ')); process.exit(1); }

  fs.readdirSync(OUT).filter(f => /^page-\d+\.png$/.test(f)).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  execFileSync('pdftoppm', ['-png', '-scale-to-x', '900', '-scale-to-y', '-1', pdf, path.join(OUT, 'page')]);
  // pdftoppm pads page numbers when there are ten or more pages (page-01.png); the app expects page-1.png.
  const pages = fs.readdirSync(OUT).filter(f => /^page-\d+\.png$/.test(f)).sort();
  pages.forEach(f => { const n = 'page-' + (+/\d+/.exec(f)[0]) + '.png'; if (n !== f) fs.renameSync(path.join(OUT, f), path.join(OUT, n)); });
  // Smaller files when Python's Pillow is installed (the pictures look the same); skipped quietly when it isn't.
  spawnSync('python3', ['-c', 'import sys, glob\nfrom PIL import Image\nfor f in glob.glob(sys.argv[1] + "/page-*.png"):\n    Image.open(f).convert("RGB").quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE).save(f, optimize=True)', OUT]);
  console.log(pages.length + ' pages written to ' + OUT);
  console.log('If that number changed, update the <img> list in index.html (#sample-sheet) and the file list in sw.js.');
})().catch(e => { console.error(e); process.exit(1); });
