# Ward Mission Leader Process (weekly coordination meeting agenda)

A phone-first web app that a ward mission leader uses every week. It is live at
https://dk10-dotcom.github.io/coordination-meetings/ and used by nine wards.
GitHub Pages serves the top level of `main`, so every push to `main` is a release.

Read `docs/SPEC.md` before changing behavior. It describes every screen and rule.

## Rules that do not change

- **No server, no database, no analytics, no network calls.** Everything stays on the phone.
  The page's security settings block outside connections; keep it that way.
- **The PDF is the only thing that leaves the phone,** and only by email or text. Keep this wording
  wherever sharing is offered: "Only share via email or text message. Do not share through any other app."
- Keep this warning visible in Ward council, How to use and the tour:
  "Never add confidential information to this agenda."
- Keep both lines in the footer: "Not affiliated with The Church of Jesus Christ of Latter-day Saints."
  and "Darren Kirkham · darrenkirkham@mac.com".
- **Fake names only** in samples, tests, screenshots and commit messages
  (Daniel Rivera, Olivia Chen, Grace Thompson, Marcus Bell, Marcus Hill, Emma Walsh, Samuel Ortiz).
- **Whenever behavior changes, update How to use (`index.html`) and the tour (`tour.js`) in the same change.**
  Update `docs/SPEC.md` and the tests too.
- Keep the data embedded in the PDF and the handoff link format compatible with earlier versions,
  so an older PDF or link still loads.
- The people who use this are not technical. Prefer fewer screens, fewer taps and plain words.
  Check every screen on a small iPhone (320 px wide): nothing may make the page wider than the screen.

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
```

See `test/README.md` for setup (Playwright and the poppler PDF tools).
A link ending in `#huddle` opens straight to the Huddle screen; most tests use it.

## Releasing

1. Run the tests that cover what changed, and `bash test/run-all.sh` for anything broad.
2. Change the number in `CACHE` in `sw.js` (for example `huddle-v176` to `huddle-v177`).
   Phones only pick up a release when this changes.
3. Commit and push to `main`. The site updates in a minute or two.
4. Tell the user to close and reopen the app to load it.

## Open items

- The training video (`media/training-video.mp4`) and its deck show an older design.
- First run: a phone browser opens How to use (with Add to Home Screen first); the Home Screen app
  then starts the tour once. These could be combined into one short welcome.
- `test/obsolete/` holds tests for removed features (saved agendas, Send & Clear). Do not revive them.
