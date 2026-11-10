# Huddle: the Ward Mission Leader Process app (weekly coordination meeting agenda)

The app's name is **Huddle** (Home Screen icon, browser tab, and small letters above the opening
screen's title, which stays "Ward Mission Leader Process").

A phone-first web app that a ward mission leader uses every week. It is live at
https://dk10-dotcom.github.io/coordination-meetings/ and used by nine wards.
GitHub Pages serves the top level of `main`, so every push to `main` is a release.

Read `docs/SPEC.md` before changing behavior. It describes every screen and rule.

## Rules that do not change

- **No server, no database, no analytics, no network calls.** Everything stays on the phone.
  The page's security settings block outside connections; keep it that way.
- **The PDF is the only thing that leaves the phone,** and only by email or text. Keep this wording
  wherever sharing is offered: "Only share via email or text message. Do not share through any other app."
- Keep this warning visible in Ward council (once, under its two lists), How to use and the tour:
  "Never add confidential information to this agenda."
- Keep both lines in the footer: "Not affiliated with The Church of Jesus Christ of Latter-day Saints."
  and "Darren Kirkham · darrenkirkham@mac.com".
- **Fake names only** in samples, tests, screenshots and commit messages
  (Daniel Rivera, Olivia Chen, Grace Thompson, Marcus Bell, Marcus Hill, Emma Walsh, Samuel Ortiz).
- **Whenever behavior changes, update How to use (`index.html`) and the tour (`tour.js`) in the same change.**
  Update `docs/SPEC.md` and the tests too.
- **Keep How to use short.** It is a list of steps that open when tapped, at most five short lines
  each, saying what to tap. Updating it usually means changing a line, not adding one: leave out
  anything the screen already explains. `test/help.js` fails if it grows past 900 words.
- Keep the data embedded in the PDF and the handoff link format compatible with earlier versions,
  so an older PDF or link still loads.
- **The PDF is read on phones.** Its pages are phone-shaped (360 × 780 points) with one short block
  per person: no tables, no small print. When its look changes, remake the sample agenda pictures
  with `node test/tools/make-sample.js` and look at them.
- The people who use this are not technical. Prefer fewer screens, fewer taps and plain words.
  Check every screen on a small iPhone (320 px wide): nothing may make the page wider than the screen.
- **It should look and feel like an ordinary iPhone app.** Every list uses the same row (`.nav-row`
  inside `.steps-list`): title, one status line, chevron. Names are rows; a name opens on its own
  screen; Back, Done and the phone's Back return to the list. Don't put fields in a list.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page: every screen, sheet and the How to use text |
| `app.js` | All behavior and the PDF builder (one file, plain JavaScript, no build step) |
| `tour.js` | The guided tour (wording and placement) |
| `styles.css` | Look and layout |
| `sw.js` | Offline support. `CACHE` must change on every release |
| `vendor/pdf-lib.min.js` | PDF library |
| `sample/`, `media/`, `icons/`, `manifest.webmanifest` | Sample agenda images, training video, app icon |
| `docs/SPEC.md` | How the app behaves |
| `test/` | Automated checks (Playwright). `test/obsolete/` is old material kept for reference |

There is no build step and no framework. Edit the files directly.

## Running and testing

```bash
python3 -m http.server 8765          # from the top folder; the tests expect this address
node test/twodoor.js                 # one test
bash test/run-all.sh                 # every test, with a summary (about 20 minutes)
node test/tools/make-sample.js       # remakes sample/page-*.png (the sample agenda) from the current PDF
```

See `test/README.md` for setup (Playwright and the poppler PDF tools).
A link ending in `#huddle` opens straight to the Huddle screen; most tests use it.
Two flags in the phone's storage exist only for tests: `huddle-view-all` (an older one-page layout)
and `huddle-cards-open` (every card open in its list, for tests that fill many cards).
`rows.js` and `twodoor.js` test what people see: names as rows and one screen per person.

## Releasing

1. Run the tests that cover what changed, and `bash test/run-all.sh` for anything broad.
2. Change the number in `CACHE` in `sw.js` (for example `huddle-v176` to `huddle-v177`).
   Phones only pick up a release when this changes.
3. Commit and push to `main`. The site updates in a minute or two.
4. Tell the user to close and reopen the app to load it.

## Things that have gone wrong before

- `app.js` reads the saved huddle while the file is still loading (`var state = normalizeState(…)`,
  near the top). Anything `normalizeState` uses must be set up above that line. A list of field
  names declared lower down once made the app fail to open whenever referrals were saved.
- Test a change by reopening the app with data already saved, not only by typing into a fresh one.

## Open items

- The training video (`media/training-video.mp4`) and its deck show an older design.
- First run: a phone browser opens How to use (with Add to Home Screen first); the Home Screen app
  then starts the tour once. These could be combined into one short welcome.
- `test/obsolete/` holds tests for removed features (saved agendas, Send & Clear). Do not revive them.
- `app.js` still carries unused code from saved agendas (`open-agenda`, `share-agenda`, `pick-agenda`,
  `delete-all`, `openLoad`). Nothing on the page calls it; remove it in a cleanup.
