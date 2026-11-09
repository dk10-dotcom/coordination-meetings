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

- **How to use** (top right) opens the instructions: the steps and good-to-know notes.
- **Guided tour:** a 20-stop walk-through that dims the page and explains each part in a bubble (Next / Back / Skip tour). It starts once on its own the first time the app is opened from the Home Screen (in a phone's browser, How to use opens instead, since it starts with Add to Home Screen). Replay it from **Take the tour** at the top of How to use, or send people the site link plus `#tour`. The wording lives in `tour.js`.
- **Tips for an effective meeting** (next to it) opens the Principles for Effective Coordination and the Prepare ahead tip. These are no longer printed on the PDF. It also opens by itself the first time someone visits on a new device.
- Send people straight to it with the site link plus `#help` (for example `https://dk10-dotcom.github.io/coordination-meetings/#help`).
- The first time last week's names carry over, a one-time reminder asks the user to compare them to this week's Covenant Path Report.
- The wording lives in `index.html` under `How to use`.

## How people use it each week

**In ward council:** check the names against the Covenant Path Report (in Tools) and update each person's next ordinance and need, right in the next huddle's agenda. **During huddle:** take attendance, confirm Return and Report, and check sacrament attendance. Then plan one action item per person: who will do it, and when. **After huddle:** Send it to the bishop-approved list, the stake presidency and the full-time missionaries. **During the week:** mark Return and Report as people report back, and keep the Covenant Path Report in Tools updated.

1. Open the app from the Home Screen icon. Before the huddle, tap **Ward council** and update the names, next ordinances and needs. A name that had an assignment from the last huddle shows it there, with Yes / Partly / No. At the meeting, tap **Huddle**; choose who is **Conducting** in Huddle Details (remembered on the phone and printed on the PDF). A link ending in `#huddle` opens straight to the huddle's list.
2. Tap everyone who attended. **Return and Report** is labeled with the huddle its items came from ("From the November 8 huddle"), and the home screen shows how many are marked ("From Nov 8 · 3 of 8 marked"). Mark each item Yes / Partly / No. For Partly or No, **Carry forward to this week** copies it into this week's plan.
3. Fill in the Covenant Path Report actions and the 3 Names Next Ordinance (Ward Council Focus Names). **Text this assignment** texts each one before everyone leaves.
4. **Send → Share PDF.** The huddle closes: the app sets up the next huddle a week later, moves the action items into Return and Report, and keeps names and needs. **Undo** in the Sent successfully message puts the huddle back. Under the date, **✓ Nov 8 huddle sent · Share again** resends the last PDF.
   - Someone else conducting? **Hand off** texts them a link that loads the agenda. When they send it, load their PDF to set up your next huddle.

The Ward Council (who · what) and huddle (how · when) boxes stay at the top of the page as a constant reminder. The note about who conducts sits right under the Conducting choice. New members (blue), Returning members (green), Those being taught (purple) and 3 Names Next Ordinance (amber) each have their own colored panel, with numbered cards. Return and Report cards carry a stripe and tag in the color of the list they came from, and fill green, amber or red once marked Yes, Partly or No. The PDF uses the same colors.

Each name card has an **Attended sacrament** checkbox (top right), **Next ordinance**, **Need**, then the action item, who it's assigned to, and when. When last week is loaded, all of these show on that person's Return and Report card. Carried-over names keep their next ordinance and need; the sacrament checkbox starts blank each week.

**New members** also have a **Baptism date** and a red **Temple attendance** checkbox. Goal: baptisms for the dead within 30 days of baptism. The box counts the days from the baptism date to the meeting date ("18 days left of 30", "12 days past the 30-day goal") and stays red until it's checked, carrying forward every week. The PDF shows "Temple: …" under each new member's name, and next week's Return and Report shows the updated count.

**Two halves on every name card:** the top, **Ward Council · Who & What** (name, next ordinance, need, and the baptism date / temple or committed-to-baptism details), is filled in before the meeting from ward council and the Covenant Path Report. The bottom, **Huddle · How & When** (action, assigned to, when), is filled in at the huddle. Both groups can add to **Needs**. **+ Add a note for ward council** opens a "Huddle notes" box for anything the huddle wants to relay back; it carries forward, shows on Return and Report as "Huddle notes," and prints on the PDF on its own light-orange line under that person's row, labeled "Huddle notes." On the PDF the tables carry a Ward Council label over Name / Next ordinance / Need and a Huddle label over Attended sacrament / Action / Assigned to / When.

**Done:** each Covenant Path list and 3 Names has a **Done** button. It folds that list to one line per person (name, action, who, when, plus a red temple tag if it's still due), and warns first if someone has no action item. Tap the list's title to reopen it. Folding only changes the screen: the PDF prints everything, and loading or opening an agenda starts with every list open. Return and Report has its own **Done** too: it folds each item to one line with its Yes/Partly/No answer and notes, and warns first if any item isn't marked.

**Those being taught** have a **Committed to baptism** checkbox and a **Scheduled baptismal date**. Both carry forward each week and show on Return and Report and under the name on the PDF ("Committed · Nov 21"). After the baptism, **Convert to new member** moves the card to New members with everything on it, and the 30-day temple count starts from the baptism date.

## Making changes later

- Edit the files (for example in VS Code, Antigravity, or Claude Code), then upload the changed files to the same repository. Pages updates within a minute or two.
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
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |

## The PDF at a glance

- **Top:** title, ward, date, who conducted, and the Ward Council (who · what) / huddle (how · when) reminder. Attendees who were there print dark; those who weren't print light gray.
- **Two bands group the page, named by date:** **FROM THE NOV 1 HUDDLE** (Did it happen?) over Return and Report, and **NOV 8 HUDDLE PLAN** over Covenant Path Report Review and 3 Names. The form's home screen groups its sections the same way (From the Nov 8 huddle / Nov 15 huddle plan).
- **Return and Report:** one row per item: the person (with their list in color), last week's action with who and when in gray, whether it happened (green / amber / red), and notes. Carried-forward items say so, and last week's huddle notes sit under the person.
- **Covenant Path Report Review and 3 Names:** Ward Council columns (name, next ordinance, need) then Huddle columns (attended sacrament as a green tick, action, assigned to, when). Temple countdowns and baptism commitments sit under the name; huddle notes sit in the person's row. Empty lists say "None this week."

