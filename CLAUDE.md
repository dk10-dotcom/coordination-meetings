# Huddle: the Weekly Ward Mission Process app (weekly coordination meeting agenda)

The app's name is **Huddle** (Home Screen icon, browser tab, and small letters above the opening
screen's title, which stays "Weekly Ward Mission Process").

A phone-first web app that a ward mission leader uses every week. It is live at
https://dk10-dotcom.github.io/coordination-meetings/ and used by nine wards.
GitHub Pages serves the top level of `main`, so every push to `main` is a release.

Read `docs/SPEC.md` before changing behavior. It describes every screen and rule.

## Rules that do not change

- **No server, no database, no analytics, no network calls.** Everything stays on the phone.
  The page's security settings block outside connections; keep it that way.
- **The PDF is the only thing that leaves the phone,** and only by email or text. Keep this wording
  wherever sharing is offered: "Only share via email or text message. Do not share through any other app."
- Keep this warning visible right under the step card in Ward council and the Huddle, and in the tour:
  "Never add confidential information to this huddle report." (Help & training says it in Privacy and
  security; the user decided it needs no banner there.)
- Keep the disclaimer on the opening screen: "Not an official app of The Church of Jesus Christ of
  Latter-day Saints." Keep "Made by Darren Kirkham · darrenkirkham@mac.com" at the end of Help & training.
- **Fake names only** in samples, tests, screenshots and commit messages
  (Daniel Rivera, Olivia Chen, Grace Thompson, Marcus Bell, Marcus Hill, Emma Walsh, Samuel Ortiz).
- **Whenever behavior changes, update Help & training (`index.html`) and the guided tour (the `COACH` steps in `app.js`) in the same change.**
  Update `docs/SPEC.md` and the tests too.
- **Keep Help & training short.** It is a list of steps that open when tapped, at most five short lines
  each, saying what to tap. Updating it usually means changing a line, not adding one: leave out
  anything the screen already explains. `test/help.js` fails if it grows past 900 words.
- **Name the source of anything quoted or adapted** from *Preach My Gospel*, the General Handbook or
  another Church page: one small line (`.source-line`) under it, linked to that page in the Gospel
  Library, and a row in the "Source links" table in `docs/SPEC.md`. Quote the manual's own words;
  don't cite a source for wording that isn't in it. `test/howhelp.js` checks the lines and links.
- Keep the data embedded in the PDF and the handoff link format compatible with earlier versions,
  so an older PDF or link still loads.
- **The training slides are made from the app itself.** When the look or the steps change, run
  `node test/tools/slides/make.js` (the words are in `test/tools/slides/scenes.js`) and look through them in
  Help & training → Training slides. People tap Next when ready; don't make them advance on their own.
- **The PDF is read on phones.** Its pages are phone-shaped (360 × 780 points) with one short block
  per person: no tables, no small print. When its look changes, remake the sample agenda pictures
  with `node test/tools/make-sample.js` and look at them.
- **Dark mode comes from `dark.css`, made from `styles.css`.** After changing any color in `styles.css`,
  run `python3 test/tools/make-dark.py` and look at the changed screen with the phone in dark mode.
  Hand-tuned dark rules live in that script (`TUNED`), not in `dark.css`.
- The people who use this are not technical. Prefer fewer screens, fewer taps and plain words.
  Check every screen on a small iPhone (320 px wide): nothing may make the page wider than the screen.
- **Each of the four steps opens a screen of its own** (Back at the top, the step's name beside it),
  never a sheet that slides up, and **starts with one line saying what to do there**. Keep those
  lines short and in the same place on all four.
- **It should look and feel like an ordinary iPhone app.** Every list uses the same row (`.nav-row`
  inside `.steps-list`): title, one status line, chevron. Names are rows; a name opens on its own
  screen; Back, Done and the phone's Back return to the list. Don't put fields in a list.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page: every screen, sheet and the Help & training text |
| `app.js` | All behavior and the PDF builder (one file, plain JavaScript, no build step) |
| `styles.css` | Look and layout |
| `dark.css` | Dark mode, made from `styles.css` by `test/tools/make-dark.py`; applies while the page has `theme-dark` |
| `theme.js` | Sets `theme-dark` before the page draws (Settings → Appearance: Automatic, Light or Dark) |
| `sw.js` | Offline support. `CACHE` must change on every release |
| `vendor/pdf-lib.min.js` | PDF library |
| `sample/`, `media/`, `icons/`, `manifest.webmanifest` | Sample huddle report images, training slides (`media/slides/`), app icon |
| `docs/SPEC.md` | How the app behaves |
| `test/` | Automated checks (Playwright). `test/obsolete/` is old material kept for reference |

There is no build step and no framework. Edit the files directly.

## Running and testing

```bash
python3 -m http.server 8765          # from the top folder; the tests expect this address
node test/twodoor.js                 # one test
bash test/run-all.sh                 # every test, with a summary (about 20 minutes)
node test/tools/make-sample.js       # remakes sample/page-*.png (the sample agenda) from the current PDF
python3 test/tools/make-dark.py      # remakes dark.css (dark mode) from styles.css
node test/tools/make-launch.js       # remakes the launch screens (icons/launch/) and prints their <link> lines
node test/tools/slides/make.js       # remakes the training slides (media/slides/) from the app as it is now
```

See `test/README.md` for setup (Playwright and the poppler PDF tools).
A link ending in `#huddle` opens straight to the Huddle screen; most tests use it.
Two flags in the phone's storage exist only for tests: `huddle-view-all` (an older one-page layout)
and `huddle-cards-open` (every card open in its list, for tests that fill many cards).
`rows.js` and `twodoor.js` test what people see: names as rows and one screen per person.
Next ordinance is a menu and When is a date (`datesmenu.js`). Older tests type words into them through
`test/tools/compat-fill.js`, the way a huddle saved before the change holds them; new tests should pick a
choice (`selectOption`) and type dates as `YYYY-MM-DD`.
The guided tour is a practice week (`guided.js`): a black card at the bottom gives one task at a time (the `COACH`
list in `app.js`), rings what to tap, and moves on once it's done; each step ends with that step's green check.
The bottom bar (Hand off, a round Home in the middle, Send) floats on every screen. Mark done (step 1, each Huddle section, step 4) is pinned just above it, green with a check once done, tapped again to undo; on the opening screen Home scrolls back to the top. Each training slide shows which part of the week it is in (1-4 and Week). The bar stays above the card. The old passive tour (`tour.js`) is retired. a sample Send (stamped SAMPLE, no data inside, changes nothing) and a
practice handoff are allowed; nothing from a practice may ever load over or replace a real huddle.
`howhelp.js` tests the How can we help? panels, the list names' bands and the source links.
`lively.js` tests the header cards, icons, initials and the Sent celebration. Keep color and motion
within those pieces; don't add a "needs attention" list (the user decided it repeats what the sections say).

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

- First run: a phone browser opens Help & training (with Add to Home Screen first); the Home Screen app
  then starts the tour once. These could be combined into one short welcome.
- `test/obsolete/` holds tests for removed features (saved agendas, Send & Clear). Do not revive them.
- `app.js` still carries unused code from saved agendas (`open-agenda`, `share-agenda`, `pick-agenda`,
  `delete-all`, `openLoad`). Nothing on the page calls it; remove it in a cleanup.
