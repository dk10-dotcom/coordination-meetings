# Tests

Automated checks that drive the app in a phone-sized browser and read the PDFs it makes.
They use fake names only.

## Setup (once)

```bash
cd test && npm install && npx playwright install chromium && cd ..
```

The PDF tests also need the poppler tools (`pdftotext`, `pdftoppm`, `pdfinfo`):
`brew install poppler` on a Mac, `apt install poppler-utils` on Linux.

## Running

Run everything from the top folder of the repository.

```bash
python3 -m http.server 8765     # leave running in another terminal
node test/twodoor.js            # one test
bash test/run-all.sh            # all of them, with a summary (about 20 minutes)
```

Each test prints PASS or FAIL per check and a count at the end. Screenshots and PDFs go into
`test/out*` folders, which are not kept in the repository.

Most tests open `http://127.0.0.1:8765/#huddle`, which goes straight to the Huddle screen.
Two flags in the phone's storage exist only for tests. Many set `huddle-view-all`, an older
one-page layout. A few set `huddle-cards-open`, which keeps every card open in its list so a test
can fill many cards in a row. `rows.js` and `twodoor.js` set neither: they use what people see,
names as rows and one screen per person.

## What each test covers

| Test | Covers |
| --- | --- |
| `twodoor.js` | Opening screen, the two Covenant Path Report boxes (marked done from inside), Ward council and Huddle lists of names, a person's screen, Send gating, Change date |
| `rows.js` | Names as rows and a person's screen: what a row says, Remove, Convert, the 4-week question, the same-person question, the slide between screens |
| `scenarios.js` | Names added, assigned, removed, renamed, re-added and converted across several huddles |
| `live.js` | The weekly cycle: Send finishes the huddle, Undo, Share again, the 4-week name rule, Erase everything |
| `steps.js` | The Huddle's four sections, Mark section done, Back, layout on two phone sizes |
| `full.js` | The PDF: every value printed, margins, page breaks, and loading it back |
| `handoff.js` | Hand off links on iPhone and Android, pasting a link, a broken link |
| `people.js`, `undo.js` | Carry forward and undoing it, folded lists, the Sent message |
| `practice.js` | Practice week: loading, limits, removing |
| `fields.js`, `zones.js`, `committed.js`, `temple.js`, `convert.js`, `remove.js`, `tncarry.js` | What's on each card and what carries to the next huddle |
| `textassign.js` | Text this assignment |
| `tour.js`, `help.js`, `tips.js`, `sample-view.js`, `swipe.js` | Tour, How to use, Tips, the sample agenda, closing sheets |
| `empty.js`, `fixed.js`, `remind.js` | Empty lists, fixed wording, reminders |

`obsolete/` holds tests and one-off scripts written for earlier designs (saved agendas,
Send & Clear, the one-page form). They do not pass and are kept only for reference.
