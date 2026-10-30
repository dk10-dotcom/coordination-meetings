# Weekly Coordination Meeting Agenda (web form)

A phone-friendly agenda form for ward huddles. Fill it in, tap **Send & Clear** to make a PDF and share it, and next week tap **Load last week** to pull last week's action items into Return and Report.

## Privacy and security

- **Everything happens on the phone.** The page has no server, database, analytics, or tracking. The website host only delivers the page; it never sees what anyone types.
- **No outside connections.** All code is included in this folder, and the page's security settings block it from contacting any other site.
- **Temporary draft only.** While someone fills in the form, a draft is kept in that browser tab so a reload doesn't lose work. **Send & Clear** or **Clear** erases it, and closing the tab removes it.
- **Ward name is remembered** on each phone for convenience. **Send & Clear** keeps it for next week; the **Clear** button erases it too.
- **Saved agendas:** each time an agenda is sent, its form data is kept in the app's private storage on that phone so **Load last week** can list it. Agendas are erased automatically once their meeting date is more than 4 weeks old (checked each time the app opens), at most 4 are kept, resending the same week replaces it, and **Load last week → Delete all saved agendas** erases them all at once. Nothing is saved online.
- **The PDF is the only copy that leaves the phone,** sent through the person's own email or messaging app. The PDF also carries a hidden copy of the form data, so **Load from a file** works when a different phone runs the next meeting. Treat the PDF as confidential.
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

- **How to use** (top right) opens the instructions: the 4 steps, a tip, and good-to-know notes. It also opens by itself the first time someone visits on a new device.
- Send people straight to it with the site link plus `#help` (for example `https://dk10-dotcom.github.io/coordination-meetings/#help`).
- The first time last week's names carry over, a one-time reminder asks the user to compare them to this week's Covenant Path Report.
- The wording lives in `index.html` under `How to use`.

## How people use it each week

**Before:** Load last week and check the names. **During:** Mark what happened, and plan one action per person. **After:** Send it to the bishop-approved list, including the elders quorum representative and the stake presidency.

1. Open the app from the Home Screen icon. The ward is remembered and the date starts on the usual meeting day.
2. **Start here → Load last week** → tap last week's agenda. Mark each Return and Report item Yes / Partly / No. For Partly or No, **Carry forward to this week** copies it into this week's plan.
   - Last week's names carry over to Covenant Path Report Review. Check them against the report, add new names, remove any no longer listed.
   - No saved agendas yet (first week, or a new phone)? Use **Load from a file** with last week's PDF.
   - Each saved agenda also has **Open to edit** (restores the whole form) and **Share again** (resends its PDF).
3. Fill in attendees, the Covenant Path Report actions and the Three Names.
4. **Send & Clear → Share PDF.** A copy is saved in the app, then the form clears. **Save without sending** keeps a copy and leaves the form filled in. **Clear the whole form** is a link at the bottom of the page.

The Ward Council / huddle explanation starts open for the first three visits on a phone, then folds to one line (tap it to open).

## Making changes later

- Edit the files (for example in VS Code, Antigravity, or Claude Code), then upload the changed files to the same repository. Pages updates within a minute or two.
- After changing any file, change `huddle-v1` in `sw.js` to `huddle-v2` (and so on). That tells phones to fetch the new version.
- Agenda wording lives in `index.html`. The PDF layout and wording live in the `buildPdf` section of `app.js`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The form |
| `styles.css` | Look and layout (phone first) |
| `app.js` | Form behavior, PDF creation, Send & Clear, Load last week |
| `vendor/pdf-lib.min.js` | PDF library (pdf-lib 1.17.1, MIT license) |
| `sw.js` | Lets the page open without a connection after the first visit |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |
