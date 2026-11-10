# Weekly Coordination Meeting Agenda (web form)

A phone-friendly agenda form for ward huddles. It opens to three things: **Ward council** (every name with its next ordinance and need), **Huddle** (attendance, Return and Report, and this huddle's assignments) and **Send** (update Tools, then share the PDF). Sending finishes the huddle: its action items move into Return and Report for next time, and names and needs stay. There is no date to set; the PDF is dated the day it's sent.

## Privacy and security

- **Everything happens on the phone.** The page has no server, database, analytics, or tracking. The website host only delivers the page; it never sees what anyone types.
- **No outside connections.** All code is included in this folder, and the page's security settings block it from contacting any other site.
- **The agenda lives on the phone.** The next huddle's agenda is kept in the app's private storage on that phone. Names nobody has updated in 4 weeks ask "Still on the Covenant Path Report?", and after 5 weeks with no changes they're removed. **Clear the whole form** erases everything except the ward name.
- **One sent copy.** After a send, the app keeps one copy of that huddle so **Share again** can resend its PDF. It's replaced at the next send, removed after 5 weeks, and erased by **Clear the whole form**. Nothing is saved online.
- **Ward name is remembered** on each phone for convenience.
- **The PDF is the only copy that leaves the phone,** sent through the person's own email or text messages. The PDF also carries a hidden copy of the form data, so **Load a handoff or PDF → Load from a PDF** can set up the next huddle from it on another phone. A **Hand off** link carries the agenda in the part of the link browsers never send to the website. Treat the PDF as confidential.
- **iPhone users must add the app to their Home Screen and always open it from that icon.** In plain Safari, iPhones can erase a website's saved data after about 7 days without a visit, and Safari and the Home Screen app keep separate storage. Whenever the app is opened in a phone's browser instead of from the icon, an **Add to Home Screen** button appears at the top. On Android it opens the phone's install prompt; on iPhone it shows the three steps.
- Remind users to keep saved PDFs secure and delete old ones when they're no longer needed.

## Put it online with GitHub Pages (free, about 15 minutes)

1. **Create a GitHub account** at github.com (free).
2. **Create a repository.** Click **+** (top right) → **New repository**.
   - Name: `huddle` (or anything you like).
   - Choose **Public**. Free GitHub Pages requires it. Only the page's code is public, never anyone's data.
   - Click **Create repository**.
3. **Upload the files.** On the new repository page, click **uploading an existing file**. Drag in **everything inside this folder**: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `README.md`, and the `icons` and `vendor` folders. Click **Commit changes**.
   - Make sure `index.html` sits at the top level of the repository, not inside another folder.
4. **Turn on Pages.** Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then **Save**.
5. **Wait 1–2 minutes,** then refresh that page. Your link appears at the top, something like `https://yourname.github.io/huddle/`.
6. **Test it** on your iPhone and on an Android phone before sharing it with the wards.

### Optional: a shorter address
Buy a domain (about $12/year), then add it under **Settings → Pages → Custom domain** and follow GitHub's DNS steps. Keep **Enforce HTTPS** checked.

## Share it with the wards

- Send each ward mission leader the link, or print a QR code of it.
- Ask them to add it to their home screen so it opens like an app:
  - **iPhone (Safari):** Share button → **Add to Home Screen**.
  - **Android (Chrome):** ⋮ menu → **Add to Home screen** (or **Install app**).

## Built-in instructions

- **How to use** (top of the opening screen) has the training video, the tour, a sample agenda, a practice week and the written steps. In a phone's browser it opens by itself the first time, since it starts with Add to Home Screen.
- **Guided tour:** a 19-stop walk-through that dims the page and explains each part in a bubble (Next / Back / Skip tour). It starts once on its own the first time the app is opened from the Home Screen. Replay it from **Take the tour** in How to use, or send people the site link plus `#tour`. The wording lives in `tour.js`.
- **Tips for an effective meeting** is at the top of the Huddle screen. It opens the Principles for Effective Coordination and the Prepare ahead tip.
- Send people straight to the instructions with the site link plus `#help` (for example `https://dk10-dotcom.github.io/coordination-meetings/#help`).
- The How to use wording lives in `index.html`.

## How people use it each week

The opening screen is titled **Ward Mission Leader Process** and shows four steps in order, then Send. The full description of every screen and rule is in [`docs/SPEC.md`](docs/SPEC.md).

1. **Before ward council:** tap the first box to see every name on the three Covenant Path Report lists, add or remove names, and open the report in Member Tools. Check the box when the names match.
2. **Ward council:** two roll-ups, **Covenant Path Report lists** and **Name Next Ordinance** (the three focus names). Each name has the name, next ordinance and needs, with read-only details and the last huddle's assignment underneath.
3. **Huddle:** take attendance in Huddle Details, then go through Return and Report, Covenant Path Report Review, Name Next Ordinance and Find New People to Teach. Each card has a Ward Council half (already filled in) and a Huddle half (attended sacrament, action item, assigned to, when). **Text this assignment** texts each one before everyone leaves.
4. **After the huddle, before you send:** tap the box to see what to update in the Covenant Path Report for each person, then check it off. Send is blocked until it is.

**Send → Share PDF** finishes the huddle: its action items move into Return and Report for next time, names and needs stay, and everything else clears. **Undo** in the Sent successfully message puts it back. **Share again** on the opening screen resends the last PDF. There is no date to set; the PDF is dated the day it's sent, and **Change date** on the Send screen overrides that.

Someone else conducting? **Hand off** texts them a link that loads the huddle on their phone. After they send it, **Load a handoff or PDF → Load from a PDF** sets up the next huddle from their PDF.

New members (blue), Returning members (green), Those being taught (purple) and Name Next Ordinance (amber) each have their own color in the app and on the PDF. Return and Report cards fill green, amber or red once marked Yes, Partly or No.

## Making changes later

- Edit the files (for example in VS Code, Antigravity, or Claude Code), then upload the changed files to the same repository. Pages updates within a minute or two.
- `CLAUDE.md` has the project's rules and release steps, and `test/` has the automated checks (see `test/README.md`).
- After changing any file, change `huddle-v1` in `sw.js` to `huddle-v2` (and so on). That tells phones to fetch the new version.
- Agenda wording lives in `index.html`. The PDF layout and wording live in the `buildPdf` section of `app.js`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The form |
| `styles.css` | Look and layout (phone first) |
| `app.js` | Form behavior, PDF creation, Send (closes the huddle), Hand off, Load from a PDF |
| `vendor/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `sw.js` | Lets the page open without a connection after the first visit |
| `tour.js` | The guided tour |
| `docs/SPEC.md` | How the app behaves, screen by screen |
| `CLAUDE.md` | Project rules and release steps |
| `test/` | Automated checks |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |

## The PDF at a glance

- **Top:** title, ward, date, who conducted, and the Ward Council (who · what) / huddle (how · when) reminder. Attendees who were there print dark; those who weren't print light gray.
- **Two bands group the page, named by date:** **FROM THE NOV 1 HUDDLE** (Did it happen?) over Return and Report, and **NOV 8 HUDDLE PLAN** over Covenant Path Report Review and 3 Names. The form's home screen groups its sections the same way (From the Nov 8 huddle / Nov 15 huddle plan).
- **Return and Report:** one row per item: the person (with their list in color), last week's action with who and when in gray, whether it happened (green / amber / red), and notes. Carried-forward items say so, and last week's huddle notes sit under the person.
- **Covenant Path Report Review and 3 Names:** Ward Council columns (name, next ordinance, need) then Huddle columns (attended sacrament as a green tick, action, assigned to, when). Temple countdowns and baptism commitments sit under the name; huddle notes sit in the person's row. Empty lists say "None this week."

