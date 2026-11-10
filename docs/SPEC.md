# How the app works

The app is named **Huddle**. That is the name under its Home Screen icon, in the browser tab and in
small letters above the opening screen's title. (The third step is also called the Huddle; the
opening screen's large title stays "Ward Mission Leader Process" so the two are not confused.)

This describes the behavior of the app as it is today. The code is the final word:
`app.js` (behavior and PDF), `index.html` (screens and How to use), `tour.js` (the tour).
When behavior changes, change this file in the same commit.

## Words the app uses

One word for each thing, on every screen, in How to use and in the tour:

| Word | Means |
| --- | --- |
| Huddle | The app, the weekly coordination meeting, and that meeting's plan on the phone ("Text this huddle", "Sending finishes the huddle") |
| Agenda | What is filled in and sent: the PDF ("Send this huddle's agenda", "Sample agenda") |
| Opening screen | The first screen: the four steps and Send |
| Covenant Path Report | The report in Member Tools (always "Member Tools", never "Tools") |
| Assignment | An action item with who will do it and when. **Action item** is only the name of that field |
| Focus names | The three names in Name Next Ordinance |
| Carry forward | Moving an unfinished assignment onto this huddle's plan. A carried one is tagged "Carried forward" |
| The last huddle | Where Return and Report comes from (not "last week") |

## Who it's for

The person who conducts a ward's weekly coordination meeting ("the huddle"), usually the ward
mission leader. Ward council decides **who** to focus on and **what** each person's next ordinance
is. The huddle decides **how** and **when** to help. The app carries the names from ward council to
the huddle, records the huddle's assignments, and produces a PDF that is shared by email or text.

The users are not technical. The app must be usable with no training beyond a short tour.
It should look and behave like an ordinary iPhone app: lists of rows with a chevron, one screen per
thing, **Back** at the top left with the screen's name centered beside it, and screens that slide
in from the right and back out to the left (no slide when the phone asks for reduced motion).

## The weekly process

The app opens to four steps, in order, and then Send:

1. **Before ward council:** update each person from the Covenant Path Report (in Member Tools):
   names, next ordinance, needs, temple attendance and sacrament attendance.
2. **Ward council:** who to focus on, each person's next ordinance and needs.
3. **Huddle:** attendance, report back on the last huddle's assignments, plan this huddle's assignments.
4. **After the huddle, before you send:** update the Covenant Path Report.

**Send** makes the PDF, shares it and finishes the huddle. The app is then ready for the next one.
There is no date to set. The huddle is dated the day it is sent.

## The four lists of people

| List | Where it comes from | Notes |
| --- | --- | --- |
| New members | Covenant Path Report | Has a baptism date and a 30-day temple goal |
| Returning members | Covenant Path Report | |
| Those being taught | Covenant Path Report | Next ordinance is always "Baptism"; can be marked committed, with a scheduled date |
| Name Next Ordinance (focus names) | Chosen by ward council | Exactly three spots. Not part of the Covenant Path Report |

Every person holds: name, next ordinance, needs, huddle notes, attended sacrament, and one
assignment (action item, assigned to, when).

## Lists of names and a person's screen

Ward council and the Huddle show names the same way.

- **A list is rows, one per name.** No fields are open in a list. Under the name is one line:
  in Ward council the next ordinance ("Next: Endowment"), in the Huddle the action item, who and
  when, and in Before ward council the next ordinance and needs. A missing one shows in orange
  ("Needs a next ordinance", "Needs an action item").
  Small tags under that line show what matters at a glance: the 30-day temple count for a new
  member, "Committed to baptism", "✓ Sacrament", "Carried forward" and "Not updated in 4 weeks".
- **Add a name** is the last row of each Covenant Path Report list. It opens a new person with the
  cursor in Name. A new name left empty is dropped when you leave it.
- The three focus-name spots always show; an empty one reads "Focus name 2 · Tap to add".
- **Tapping a name opens that person's screen.** Their name is the screen's title. Each meeting
  shows its own half open and highlighted, and the other meeting's half closed as a short summary
  with **Edit** (see Ward council and Covenant Path). Before ward council shows one card with only
  what the Covenant Path Report tells you (see Before ward council).
- **Missionary referrals** are listed and opened the same way (see Missionary Referrals).
- **Done** at the bottom, **Back** at the top and the phone's own Back all return to the list.
- **Remove from the list** (or **Clear this focus name**) is at the bottom of the person's screen.
  Removing someone who has details asks first, then returns to the list. While there is nothing
  to remove the link is invisible but keeps its place, so the screen does not shift under a tap.

The same row is used for the Huddle's sections, Ward council's lists and Before ward council, so
every list in the app looks alike. A section marked done shows a green check before its chevron.

## Opening screen

Title: "Ward Mission Leader Process" with the app's name, Huddle, in small letters above it, and
**How to use** beside it.

From top to bottom:

- **✓ {date} huddle sent · Share again** (only after a send).
- **Before ward council** box. Amber; green with a check once it is marked done.
- **Ward council** button.
- **Huddle** button. Shows how many assignments have been reported back.
- **After the huddle, before you send** box. Amber; green with a check once it is marked done.
- **Load from a PDF** (a quiet link that goes straight to choosing the file).
- **Erase everything and start over**, then the footer. Both appear on this screen only.
- Fixed at the bottom: **Hand off** and **Send**. These appear on this screen only.

The two boxes have no check box to tap. Each is one button: the first opens the Before ward
council screen and the second opens the After the huddle sheet. The only way to mark one done is
the **Mark done** button at the bottom of what it opens. Opening one that is already done shows
**✓ Marked done** with a way to take the mark back off. Both clear after a send.

### Before ward council (screen)

Opens from the first box, as a screen of its own with **Back** at the top. The box reads
"Update each person from the Covenant Path Report" with "Names, next ordinance, needs and
attendance" under it. The screen has:

- One line saying what to update for each person: next ordinance, needs, temple attendance and
  sacrament attendance.
- **Open the Covenant Path Report** (opens Member Tools; see Links).
- The three Covenant Path Report lists, as the same rows every other list uses. A row shows the
  name; one status line ("Next: Temple baptisms · Needs: A ride to the temple", with "Needs a next
  ordinance" in orange and "No needs listed" when those are missing); and tags for attendance: a
  new member's temple status ("Temple: 18 days left" in red, or "✓ Temple") and "✓ Sacrament".
  Each list ends in **Add a name**. Focus names are not shown here.
- **All up to date · Mark done**, which marks the box done and returns to the opening
  screen. Once done it reads **Done · Back**, with **Marked by mistake? Mark as not done** under it.

**Tapping a name opens that person on their own screen**, one amber card labeled Covenant Path
Report: Name, Baptism date (new members), Next ordinance (fixed to Baptism for those being
taught), Needs, **Temple attendance** (new members) and **Attended sacrament**. Nothing else is on
it. These are the same fields ward council and the huddle show, so nothing is entered twice.
Checking attendance here does not show the "remember to update the Covenant Path Report" reminder,
because here it is being copied from the report. **Done**, **Back** and the phone's Back return to
the list. **Remove from the list** is at the bottom and asks first when the person has details. A
name already on that list is refused ("… is already on this list."). A name added and left empty
does not stay.

### After the huddle, before you send (sheet)

Opens from the second box. Read-only. For each person on the three Covenant Path Report lists it
shows what to carry into the report: sacrament attendance, temple attendance (new members),
baptism commitment (those being taught), next ordinance, needs, how the last assignment went
(with any note), the new assignment, and huddle notes. It has the same report button and
**It's all updated · Mark done**.

**Send is blocked until this box is marked done.** Tapping Send early explains why and offers to
open this sheet.

## Ward council

Opens to four rows:

- **Covenant Path Report lists** opens New members, Returning members and Those being taught.
- **Name Next Ordinance** opens the three focus names.
- **Find New People to Teach** and **Missionary Referrals** open the same sections the Huddle has.
  They hold the same data, so what is entered in one meeting shows in the other.

The first two show a count that turns orange when someone is missing a next ordinance.
Under the rows, once, is "Never add confidential information to this agenda." It is not
repeated on the lists or on a person's screen.

Each list of names shows rows (see Lists of names and a person's screen). **A person's screen is
the mirror of the Huddle's:**

- **Ward Council · Who & What** is on top, open and highlighted: name, baptism date (new
  members), next ordinance and needs. The empty Needs box on Covenant Path names reads "Tap their
  name in the Covenant Path Report to identify needs"; focus names read "What do they need to get
  there?".
- **Huddle · How & When** is under it, closed, as a short summary: sacrament attendance (marked
  this huddle, or as of the last one), temple status (new members), baptism commitment (those
  being taught), this huddle's action item, and huddle notes. **Edit** opens the same fields the
  Huddle has, so they can be changed from Ward council; **Hide** closes them again.
- **Last huddle's assignment** (when there was one) shows the action, who had it, and a status of
  Done, Partly done, Not done or Pending. It is read-only: the huddle marks it.

## Huddle

Top to bottom: **Huddle Details**, **Tips for an effective meeting**, then five sections as rows.
There is no Erase everything, footer, Send or Hand off on this screen.
A section's name sits beside **Back** when it is open. **Mark section done** gives a section a
green check; it is optional, never blocks Send, and clears when the huddle is sent. A section whose
status is orange is still missing something.

### Huddle Details

Ward name (remembered on the phone), who is conducting (Ward mission leader, Elders Quorum, or
Other with a name), and attendance. Attendees, with the two youth roles first: Priests quorum
assistant, Gatherers of Light rep, Relief Society, Elders Quorum, Primary presidency, Ward
missionaries, Full-time missionaries, Ward mission leader, TFH leader, TFH consultants, High
Councilor. Until attendance is taken the summary says so in orange.

### Return and Report

The assignments from the last huddle. Only real assignments appear: a name with no action item
creates no entry. Each is marked **Yes**, **Partly** or **No**, with optional **Notes for ward
council**. They can be marked any time during the week.

**Carry forward to this huddle** appears on a Partly or No item. It puts the assignment back on
that person's card, tagged as carried, and can be undone. It is offered only while the person is
still listed. If they have been removed, a note says so. Someone converted from Those being
taught to New members is followed to the new list.

### Covenant Path

The Huddle's second section. On screen it is called **Covenant Path**; the PDF's heading for it
stays "Covenant Path Report Review".

**Open the Covenant Path Report** is at the top (there is no reminder box), then the three lists as
rows. Tapping a name opens that person's screen, which has two halves:

- **Ward Council · Who & What** is condensed to a short summary: next ordinance, needs, and a new
  member's baptism date. **Edit** opens the name, baptism date, next ordinance and needs;
  **Hide** condenses them again. It opens with the fields showing only when there is nothing to
  summarize yet: a new name, or a new member with no baptism date.
- **Huddle · How & When** is a highlighted block, the part the huddle fills in: attended
  sacrament, action item, assigned to, when.

Also in the huddle's half:

- **New members:** a red **Temple attendance** box counts down the 30 days from the baptism date
  and stays red until checked. The goal is stated once, under the New members list.
- **Those being taught:** **Committed to baptism** and **Scheduled baptism date**.
  **Convert to new member** (under the card) moves the person to New members and keeps their
  screen open.
- **Text this assignment** opens Messages with the name, action and when. Needs and notes are
  never included. It then shows Texted.
- **+ Add a note for ward council** adds huddle notes, which carry forward and print on the PDF.

On the lists:

- **Confirm none this week** is a row on an empty list. It marks the list as reviewed, and
  **Undo** takes it back. A list left blank prints "Not reviewed".
- **Add a name** adds a person to a list.

### Name Next Ordinance

The three focus names as rows; each opens the same two-half screen.

### Find New People to Teach

A plan for the week and any number of assignments (who will do what, and when), plus
**Tips for finding new people to teach**. The same section opens from Ward council.

### Missionary Referrals

People referred to the full-time missionaries. The same list opens from Ward council.

- Each referral holds a **name**, who it was **referred by**, and **notes**.
- The list shows one row per referral (the name, then "Referred by … · notes"). **Add a referral**
  is the last row and opens a new one with the cursor in Name; one left empty is dropped.
- Tapping a referral opens its three fields. **Remove from the list** is at the bottom and asks first.
- **A referral stays on the list from huddle to huddle until it is removed.** It has no
  assignment, so it never appears in Return and Report, and it is not part of the two Covenant
  Path Report sheets.
- The row on the Huddle and Ward council screens reads "None listed" or the number of referrals.

## Send

1. Requires a ward name and something to send.
2. Requires the after-huddle box to be marked done.
3. **Ready to send?** lists anything still open (attendance, unmarked report-backs, people with
   no action, no finding plan). Each line jumps to that spot. **Send anyway** continues.
4. The Send screen shows the file name, **Dated {day} · Change date**, who to send to (including
   yourself, so you keep a copy), and the share rule: "Only share via email or text message. Do not share through any other app."
5. **Share PDF** opens the phone's share menu. On a computer the PDF downloads instead.

The PDF goes to the bishop-approved list, the stake presidency and the full-time missionaries.

### What sending does

- One copy of the sent huddle is kept on the phone for **Share again**. It is replaced at the next
  send, removed after 5 weeks, and removed by Erase everything.
- Every action item moves into Return and Report for the next huddle.
- Names, next ordinances, needs and huddle notes stay. Baptism dates, temple and commitment stay.
- Missionary referrals stay.
- Attendance, attended-sacrament marks, assignments, section checks and both boxes clear.
  Each card remembers whether sacrament was marked at the huddle just sent.
- The next huddle is dated the day it is sent, unless **Change date** is used.
- **Undo** in the Sent successfully message restores everything as it was.

## Rules that carry between huddles

- **Names not updated in 4 weeks** show "Not updated in 4 weeks" on their row. Their screen (in
  Ward council and in the Huddle) asks "Still on the Covenant Path Report?" (Keep or Remove).
  After 5 weeks with no change a name is removed and a note says how many were removed.
- **Changing a name** that has an assignment from the last huddle asks "Is this the same person?".
  Same person keeps the assignment with the corrected name. Different person leaves it under the
  old name, where it still reports on the PDF but cannot be carried forward.
- **Removing a name** keeps its report-back from the last huddle until the next send. A carried
  assignment stops counting as carried once its name is removed.
- **Report-backs can be sent even if every name has been removed.**

## Hand off and loading

- **Hand off** (beside Send) opens two choices, for when someone else conducts:
  - **Send a handoff** opens Messages with a link that loads the current huddle on another phone.
    The person picks who to text; send it only to the leader who conducts next. With nothing
    entered, the row reads "Nothing to hand off yet".
  - **Receive a handoff** reads the copied link from the clipboard (or offers a box to paste it)
    and asks "Load this handoff?".

  Hand off is blocked during a practice week.
- **A leader who filled in hands the huddle back.** After sending the PDF (which finishes that
  huddle and sets up the next one), they tap **Hand off**, then **Send a handoff**, and text it to
  whoever conducts next week. That leader then has the next huddle, with the last assignments in
  Return and Report. The Hand off sheet, How to use and the tour all say this.
- The data rides in the part of the link after `#`, which browsers never send to the website.
  On Android (and on a computer) opening the link asks "Load this handoff?" right away.
- **On iPhone the link opens in Safari, never in the Home Screen app,** and the two keep their data
  apart. So the link opens a page of its own, with nothing of the app behind it. It names the ward
  and the huddle, and shows three steps that stay on screen:
  1. **Copy handoff** (the one main button; it then reads "Copy again" with "✓ Copied").
  2. Open Huddle from the Home Screen (the icon is pictured).
  3. Tap **Hand off**, then **Receive a handoff**.

  Under the steps, **Don't have Huddle on your Home Screen?** opens to **Show me how to add it**
  and, as a last resort, **Use it in Safari this once** with a warning that it stays in Safari
  (the Home Screen app won't have it, and the phone can erase it after about a week without a
  visit). **Not now** closes the page and loads nothing. On a first visit, How to use and the tour
  wait until the next visit so nothing covers this page.
- **Load from a PDF** (the quiet link under the four steps) reads the data embedded in a sent PDF
  and sets up the next huddle from it, the same way sending does. It restores a phone that lost its
  data, and it is the fallback if a leader who filled in did not hand the huddle back.
- Both ask first and can be undone right after.

## Help built into the app

- **How to use** is a short list, not a page of text. It has an intro line, the warning "Never add
  confidential information to this agenda." (always showing), and four groups of rows:
  - **First time only:** Add Huddle to your Home Screen. It is set apart and has no step number,
    because it is done once and is not part of the week. Its one-line summary reads "Do this once,
    before you start", or "Already done on this phone" when the app is running from the Home Screen.
  - **Every week:** five numbered steps, each with a one-line summary: Before ward council, Ward
    council, Huddle, Send, During the week.
  - **How do I…:** Hand off to someone else, Fix a mistake, Share the PDF again, Get my names
    back, Add or remove a name, New members and those being taught.
  - **Watch or try:** Take the tour, See a sample agenda, Try a practice week, and Watch the
    training video (the video opens inside its row; closing the row stops it).

  Tapping a step or question opens it in place, and tapping it again closes it. A step is at most
  five short lines that say what to tap; what a screen already explains is left out. The Send step
  carries the sharing rule word for word. Every time How to use opens it is the short list again,
  scrolled to the top. In a phone's browser the first-time step (Add Huddle to your Home Screen) starts
  open, and How to use opens by itself on the first visit; from the Home Screen app every step
  starts closed.
- **Tour:** 21 stops, about 4 minutes. The stops about one person open a person's screen; when New members is
  empty the tour shows a sample name, which is never saved. Starts once on its own the first time the app is opened from the Home
  Screen (or on a computer).
- **Practice week:** loads sample names, sample report-backs and one sample referral. Send and Hand off are blocked
  while it is on. Removing it restores what was there before.
- **Add to Home Screen** banner whenever the app is open in a phone's browser.

## Erase everything and start over

Erases every name, need and assignment and the last sent huddle. The ward name is kept. Asks first.

## Links

| Link ending | What it does |
| --- | --- |
| `#huddle` | Opens straight to the Huddle screen (used by the tests) |
| `#help` | Opens How to use |
| `#tour` | Starts the tour |
| `#handoff=…` | Offers to load a handed-off huddle |

**Open the Covenant Path Report** opens `membertools://` on iPhone, the Member Tools app by its ID
on Android (falling back to the web report), and the Leader and Clerk Resources report elsewhere.

## Data on the phone

Stored in the browser's local storage for this site only:

| Key | Holds |
| --- | --- |
| `huddle-agenda-v1` | The current huddle (everything on screen) |
| `huddle-last-sent` | The one sent copy used by Share again |
| `huddle-ward`, `huddle-conducting` | Remembered ward name and who conducts |
| `huddle-tour-seen`, `huddle-help-seen`, `huddle-names-hint-seen` | One-time prompts already shown |
| `huddle-view-all` | An older one-page layout, kept only because some tests use it |
| `huddle-cards-open` | Keeps every card open in its list instead of rows. For tests that fill many cards; never set for users |

Nothing is sent anywhere. The page's Content-Security-Policy allows connections only to itself.

## The PDF

Built in the browser with pdf-lib, with no fillable fields. File name:
`Huddle - {Ward} - {YYYY-MM-DD}.pdf`.

**It is made to read on a phone.** A PDF cannot rearrange itself to fit a screen, so the pages
are phone-shaped instead: 360 × 780 points, with 12-point text. A phone shows a page at full
width with nothing to zoom. On letter paper a page prints as a narrow column at about actual size.

- Top: "Keep this PDF secure and delete it when it's no longer needed.", title, then Ward, Date,
  Conducting and **Attended**. Attended lists only the people who were there, on one line, in the
  order of the form (a dash when no one was marked).
- There are no tables and no Who/What/How/When boxes. **Each person is one short block** with a
  thin bar in the color of their list at the left and a hairline under it. A block stays together
  on one page when it fits, and a heading never sits alone at the bottom of a page.
- **From the {date} huddle · Did it happen?** Return and Report. Each block: the name with **Yes**,
  **Partly** or **No** in color at the right ("Not marked" when unanswered), the list the person is
  on, **Action item** with who and when in gray under it, **Notes**, "Carried forward to the
  {date} plan", and **Huddle notes**. An item typed in without a person prints its text in place
  of the name.
- **{date} huddle plan:** Covenant Path Report Review (a tinted label for each list: new members,
  returning members, those being taught) and Name Next Ordinance. Each block: the name; one colored
  line with the temple status (new members), "Committed · {date}" or "Scheduled: {date}" (those
  being taught) and a green tick with "Attended sacrament meeting"; then **Next ordinance**,
  **Needs**, **Action item** (who and when in gray, "Carried forward from {date}" in italics; "None
  yet" when there is no action item) and **Huddle notes**. Empty parts are left out. An empty list
  prints "No one on the Covenant Path Report this week" when confirmed, otherwise "Not reviewed".
- **Plans to Find New People to Teach:** the plan, then each assignment with its when.
- **Missionary Referrals:** name, referred by, notes. With no referrals it prints "None listed",
  but only where there is room: an empty referral section never starts a page by itself.
- Every page ends with the ward, the date and, when there is more than one page, "Page 1 of 3".

The sample agenda in How to use (`sample/page-1.png` to `page-4.png`) is this PDF made from a
made-up huddle. Remake it with `node test/tools/make-sample.js` whenever the PDF's look changes.

A copy of the huddle's data is stored inside the PDF (the `HuddleData` entry of its information
dictionary; app id `huddle-agenda`, version 1). **Load from a PDF** reads it back. Keep this
format readable by future versions. `referrals` was added later as an optional list; a PDF or
handoff link without it loads with no referrals.
