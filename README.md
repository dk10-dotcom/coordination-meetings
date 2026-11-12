# Huddle: the Ward Mission Leader Process app

A phone-friendly app for the ward mission leader's weekly process, built around the weekly coordination meeting (the huddle). It opens to four numbered steps and **Send**: **Before ward council** (update each person from the Covenant Path Report), **Ward council** (every name with its next ordinance and need), **Huddle** (attendance, Return and Report, and this huddle's assignments) and **After the huddle** (update the Covenant Path Report). Sending finishes the huddle: its assignments move into Return and Report for next time, and names and needs stay. There is no date to set; the PDF is dated the day it's sent.

## Privacy and security

- **Everything happens on the phone.** The page has no server, database, analytics, or tracking. The website host only delivers the page; it never sees what anyone types.
- **No outside connections.** All code is included in this folder, and the page's security settings block it from contacting any other site.
- **The agenda lives on the phone.** The next huddle's agenda is kept in the app's private storage on that phone. Names nobody has updated in 4 weeks ask "Still on the Covenant Path Report?", and after 5 weeks with no changes they're removed. **Erase everything and start over** erases everything except the ward name.
- **One sent copy.** After a send, the app keeps one copy of that huddle so **Share again** can resend its PDF. It's replaced at the next send, removed after 5 weeks, and erased by **Erase everything and start over**. Nothing is saved online.
- **Ward name is remembered** on each phone for convenience.
- **The PDF is the only copy that leaves the phone,** sent through the person's own email or text messages. The PDF also carries a hidden copy of the form data, so **Load from a PDF** can set up the next huddle from it on another phone. A **Hand off** link carries the agenda in the part of the link browsers never send to the website. Treat the PDF as confidential.
- **Text this assignment** opens the phone's own Messages with one assignment: the action, the name and when (never needs or notes). It is a plain text with no link, and the app sends nothing itself.
- **iPhone users must add the app to their Home Screen and always open it from that icon.** In plain Safari, iPhones can erase a website's saved data after about 7 days without a visit, and Safari and the Home Screen app keep separate storage. Whenever the app is opened in a phone's browser instead of from the icon, an **Add to Home Screen** button appears at the top. On Android it opens the phone's install prompt; on iPhone it shows the three steps.
- Remind users to keep saved PDFs secure and delete old ones when they're no longer needed.

## Put it online with GitHub Pages (free, about 15 minutes)

1. **Create a GitHub account** at github.com (free).
2. **Create a repository.** Click **+** (top right) → **New repository**.
   - Name: `huddle` (or anything you like).
   - Choose **Public**. Free GitHub Pages requires it. Only the page's code is public, never anyone's data.
   - Click **Create repository**.
3. **Upload the files.** On the new repository page, click **uploading an existing file**. Drag in **everything inside this folder**: `index.html`, `app.js`, `tour.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `README.md`, and the `icons`, `vendor`, `sample` and `media` folders. (Without `tour.js` or the `sample` folder, the tour and offline use fail.) Click **Commit changes**.
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

- **How to use** (top of the opening screen) is a short list: a first-time step (Add Huddle to your Home Screen), five numbered steps for every week, six "How do I…" questions, a Privacy and security row, a Sources row, and the tour, a sample agenda, a practice week and the training slides. Tap a row to read it; each step is a few short lines. In a phone's browser it opens by itself the first time, with the first-time step open.
- **Guided tour:** an 11-stop walk-through (about 2 minutes) that dims the page and explains each part in a bubble (Next / Back / Skip tour). It starts once on its own the first time the app is opened from the Home Screen. Replay it from **Take the tour** in How to use, or send people the site link plus `#tour`. The wording lives in `tour.js`.
- **Look:** each of the four steps opens with a header card in its own color (ward, date, what to do there; the Huddle and Ward council also show progress), section rows have colored icons, names have initials, and sending ends with a short celebration.
- **Tips for an effective meeting** is at the top of the Huddle screen. It opens the Principles for Effective Coordination and the Prepare ahead tip.
- **How can we help?** is a small link under New members, Returning members and Those being taught in the Covenant Path Report and at the top of Find New People to Teach, in the Huddle and in Ward council. It slides up that section's questions from *Preach My Gospel*, chapter 13. Nothing is typed there and none of it goes on the PDF.
- **Sources:** whatever the app quotes or adapts names its source in one small line, linked to that page in the Gospel Library: *Preach My Gospel*, chapter 13 (the questions), "Ideas for Weekly Missionary Coordination" in *Sharing the Gospel: Resources for Leaders* (both lists of tips), and General Handbook 23.4 (who conducts and who is invited). All three are listed under **Sources** in How to use.
- Send people straight to the instructions with the site link plus `#help` (for example `https://dk10-dotcom.github.io/coordination-meetings/#help`).
- The How to use wording lives in `index.html`.

## How people use it each week

The opening screen is titled **Ward Mission Leader Process** and shows four numbered steps in order, then Send. The full description of every screen and rule is in [`docs/SPEC.md`](docs/SPEC.md).

1. **Before ward council:** tap the first box. It opens the three Covenant Path Report lists, one row per person, with a button that opens the report in Member Tools. Tap a name to update what the report says about them: next ordinance, needs, temple attendance (new members) and sacrament attendance. Tap **Add a name** for anyone new, and open a name to remove someone no longer listed. Tap **All up to date · Mark done** at the bottom when you're finished.
2. **Ward council:** four rows. **Covenant Path Report** and **Focus names** show one row per name; tap a name to open it. A person's screen has ward council's part on top (name, next ordinance, needs) and the huddle's part under it as a short summary with **Edit**, plus the last huddle's assignment. **Find New People to Teach** and **Missionary Referrals** are the same sections the Huddle has.
3. **Huddle:** take attendance in Huddle Details, then go through Return and Report, Covenant Path Report, Focus names, Find New People to Teach and Missionary Referrals (name, referred by, notes; a referral stays until removed). Each list shows one row per name with their action item; tap a name to open their screen, which shows the Ward Council half as a short summary (tap **Edit** to change it) and the Huddle half highlighted (attended sacrament, action item, assigned to, when). **Text this assignment** texts each one before everyone leaves; a weekday in When ("Sat 9 am") is sent with its date ("Saturday 9 am (Nov 14)").
4. **After the huddle:** tap the box to see what to update in the Covenant Path Report for each person, then tap **It's all updated · Mark done**. Send is blocked until it is.

Each of the four steps opens a screen of its own, with Back at the top and one line under the title saying what to do there.

**Send → Share PDF** finishes the huddle: its assignments move into Return and Report for next time, names and needs stay, and everything else clears. **Undo** in the Sent successfully message puts it back. **Share again** on the opening screen resends the last PDF. There is no date to set; the PDF is dated the day it's sent, and **Change date** on the Send screen overrides that.

Someone else conducting? Tap **Hand off**, then **Send a handoff**, to text them a link that loads the huddle on their phone. On iPhone, links open in Safari and never in the Home Screen app, so the link opens a page with three steps: copy the handoff, open Huddle, then tap **Hand off → Receive a handoff**. After they send the PDF, they hand it back the same way, to whoever conducts next week. (**Load from a PDF** is the fallback: it sets up the next huddle from the PDF they sent.)

New members (blue), Returning members (green), Those being taught (purple) and Focus names (amber) each have their own color in the app (a dot beside the list's name, and on the person's card) and on the PDF. Return and Report cards fill green, amber or red once marked Yes, Partly or No.

## Making changes later

- Edit the files (for example in VS Code, Antigravity, or Claude Code), then upload the changed files to the same repository. Pages updates within a minute or two.
- `CLAUDE.md` has the project's rules and release steps, and `test/` has the automated checks (see `test/README.md`).
- After changing any file, change `huddle-v1` in `sw.js` to `huddle-v2` (and so on). That tells phones to fetch the new version.
- Agenda wording lives in `index.html`. The PDF layout and wording live in the `buildPdf` section of `app.js`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page: every screen and the How to use text |
| `styles.css` | Look and layout (phone first) |
| `app.js` | The app's behavior, PDF creation, Send (closes the huddle), Hand off, Load from a PDF |
| `vendor/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `sw.js` | Lets the page open without a connection after the first visit |
| `tour.js` | The guided tour |
| `docs/SPEC.md` | How the app behaves, screen by screen |
| `CLAUDE.md` | Project rules and release steps |
| `test/` | Automated checks |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |

## The PDF at a glance

The PDF is made to read on a phone: its pages are the shape of a phone screen (360 × 780 points), with text large enough to read without zooming. On letter paper each page prints as a narrow column.

- **Top:** "Keep this PDF secure", the title, ward, date, who conducted, and **Attended**: only the people who were there, on one line.
- **Two bands group the pages, named by date:** **FROM THE NOV 1 HUDDLE** (Did it happen?) over Return and Report, and **NOV 8 HUDDLE PLAN** over the rest.
- **One short block per person,** with a thin bar in the color of their list. There are no tables.
- **Return and Report:** the name with **Yes**, **Partly** or **No** in color at the right (or "Not marked"), the person's list, last huddle's action item with who and when in gray, and notes. Carried-forward items say so.
- **Covenant Path Report Review** (new members, returning members, those being taught) **and Name Next Ordinance:** the name; a colored line for the temple count, a baptism commitment and "Attended sacrament meeting"; then next ordinance, needs, and the action item with who and when. Huddle notes come last.
- **Plans to Find New People to Teach:** the plan and its assignments.
- **Missionary Referrals:** name, referred by and notes. With none, it prints "None listed" where there is room.
- **Every page ends with** the ward, the date and the page number.
