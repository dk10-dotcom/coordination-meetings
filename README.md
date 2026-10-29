# Weekly Coordination Meeting Agenda (web form)

A phone-friendly agenda form for ward huddles. Fill it in, tap **Send & Clear** to make a PDF and share it, and next week tap **Load last week** to pull last week's action items into Return and Report.

## Privacy and security

- **Everything happens on the phone.** The page has no server, database, analytics, or tracking. The website host only delivers the page; it never sees what anyone types.
- **No outside connections.** All code is included in this folder, and the page's security settings block it from contacting any other site.
- **Temporary draft only.** While someone fills in the form, a draft is kept in that browser tab so a reload doesn't lose work. **Send & Clear** or **Clear** erases it, and closing the tab removes it.
- **Ward name is remembered** on each phone for convenience. **Send & Clear** keeps it for next week; the **Clear** button erases it too.
- **Saved agendas:** each time an agenda is sent, its form data is kept in the app's private storage on that phone so **Load last week** can list it. Only the newest 4 agendas are kept (resending the same week replaces it), and **Load last week → Delete all saved agendas** erases them. Nothing is saved online.
- **The PDF is the only copy that leaves the phone,** sent through the person's own email or messaging app. The PDF also carries a hidden copy of the form data, so **Load from a file** works when a different phone runs the next meeting. Treat the PDF as confidential.
- **iPhone users must add the app to their Home Screen and always open it from that icon.** In plain Safari, iPhones can erase a website's saved data after about 7 days without a visit, and Safari and the Home Screen app keep separate storage. The app shows a reminder banner when it's opened in Safari.
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

## How people use it each week

1. Open the app from the Home Screen icon. Enter the ward (remembered next time) and check the date.
2. **Load last week** → tap last week's agenda in the list → tap Yes / Partly / No and add notes for each item.
   - No saved agendas yet (first week, or a new phone)? The app says so. Use **Load from a file** to pick last week's PDF from email or Files instead.
3. Fill in attendees, the Covenant Path Report actions, and the Three Names.
4. **Send & Clear → Share PDF.** Pick Mail, Messages, or another app. A copy is saved in the app, then the form clears.

On computers whose browser has no share menu, the button becomes **Download PDF**. Attach the file to an email, then tap **Clear the form**.

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
