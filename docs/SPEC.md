# How the app works

The app is named **Huddle**. That is the name under its Home Screen icon, in the browser tab and in
small letters above the opening screen's title. (The third step is also called the Huddle; the
opening screen's large title stays "Ward Mission Leader Process" so the two are not confused.)

This describes the behavior of the app as it is today. The code is the final word:
`app.js` (behavior and PDF), `index.html` (screens and How to use), `tour.js` (the tour).
When behavior changes, change this file in the same commit.

## Who it's for

The person who conducts a ward's weekly coordination meeting ("the huddle"), usually the ward
mission leader. Ward council decides **who** to focus on and **what** each person's next ordinance
is. The huddle decides **how** and **when** to help. The app carries the names from ward council to
the huddle, records the huddle's assignments, and produces a PDF that is shared by email or text.

The users are not technical. The app must be usable with no training beyond a one-minute tour.
It should look and behave like an ordinary iPhone app: lists of rows with a chevron, one screen per
thing, **Back** at the top left with the screen's name centered beside it, and screens that slide
in from the right and back out to the left (no slide when the phone asks for reduced motion).

## The weekly process

The app opens to four steps, in order, and then Send:

1. **Before ward council:** match the names to the Covenant Path Report (in Member Tools).
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
  when. A missing one shows in orange ("Needs a next ordinance", "Needs an action item").
  Small tags under that line show what matters at a glance: the 30-day temple count for a new
  member, "Committed to baptism", "✓ Sacrament", "Carried over" and "Not updated in 4 weeks".
- **Add a name** is the last row of each Covenant Path Report list. It opens a new person with the
  cursor in Name. A new name left empty is dropped when you leave it.
- The three focus-name spots always show; an empty one reads "Focus name 2 · Tap to add".
- **Tapping a name opens that person's screen.** Their name is the screen's title. Ward council's
  screen has only ward council's fields. The Huddle's shows ward council's half as a short summary
  and the huddle's half, highlighted, as the part to fill in (see Covenant Path).
- **Done** at the bottom, **Back** at the top and the phone's own Back all return to the list.
- **Remove from the list** (or **Clear this focus name**) is at the bottom of the person's screen.
  Removing someone who has details asks first, then returns to the list.

The same row is used for the Huddle's four sections and Ward council's two lists, so every list in
the app looks alike. A section marked done shows a green check before its chevron.

## Opening screen

Title: "Ward Mission Leader Process" with the app's name, Huddle, in small letters above it, and
**How to use** beside it.

From top to bottom:

- **✓ {date} huddle sent · Share again** (only after a send).
- **Before ward council** box. Amber; green with a check once it is marked done.
- **Ward council** button.
- **Huddle** button. Shows how many assignments have been reported back.
- **After the huddle, before you send** box. Amber; green with a check once it is marked done.
- **Load a handoff or PDF** (a quiet link).
- **Erase everything and start over**, then the footer. Both appear on this screen only.
- Fixed at the bottom: **Hand off** and **Send**. These appear on this screen only.

The two boxes have no check box to tap. Each is one button that opens its sheet, and the only way
to mark it done is the **Mark done** button at the bottom of that sheet. Opening a box that is
already done shows **✓ Marked done**, **Close** and **Mark as not done**. Both clear after a send.

### Before ward council (sheet)

Opens from the first box. Shows the three Covenant Path Report lists, one line per name, with:

- **Open the Covenant Path Report** (opens Member Tools; see Links).
- **Add a name** per list. A name already on that list is refused.
- An **×** on each name. Removing a name that has details asks first.
- **The names match · Mark done**, which marks the box done.

Focus names are not shown here.

### After the huddle, before you send (sheet)

Opens from the second box. Read-only. For each person on the three Covenant Path Report lists it
shows what to carry into the report: sacrament attendance, temple attendance (new members),
baptism commitment (those being taught), next ordinance, needs, how the last assignment went
(with any note), the new assignment, and huddle notes. It has the same report button and
**It's all updated · Mark done**.

**Send is blocked until this box is marked done.** Tapping Send early explains why and offers to
open this sheet.

## Ward council

Opens to two rows, each with a count that turns orange when someone is missing a next ordinance:

- **Covenant Path Report lists** opens New members, Returning members and Those being taught.
- **Name Next Ordinance** opens the three focus names.

Under the two rows, once, is "Never add confidential information to this agenda." It is not
repeated on the lists or on a person's screen.

Each list shows its names as rows (see Lists of names and a person's screen). A person's screen
shows only what ward council decides: name, baptism date (new members), next ordinance and needs.
The empty Needs box on Covenant Path names reads "Tap their name in the Covenant Path Report to
identify needs"; focus names read "What do they need to get there?".

Under those, two read-only boxes appear when there is something to show:

- **Details:** baptism date and temple status (new members), baptism commitment (those being
  taught), sacrament attendance as of the last huddle, huddle notes.
- **Last huddle's assignment:** the action, who had it, and a status of Done, Partly done,
  Not done or Pending. It cannot be changed here.

What is entered here is the same data the Huddle shows.

## Huddle

Top to bottom: **Huddle Details**, **Tips for an effective meeting**, then four sections as rows.
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
- **Those being taught:** **Committed to baptism** and the scheduled baptismal date.
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
**Tips for finding new people to teach**.

## Send

1. Requires a ward name and something to send.
2. Requires the after-huddle box to be marked done.
3. **Ready to send?** lists anything still open (attendance, unmarked report-backs, people with
   no action, no finding plan). Each line jumps to that spot. **Send anyway** continues.
4. The Send screen shows the file name, **Dated {day} · Change date**, who to send to, and the
   share rule: "Only share via email or text message. Do not share through any other app."
5. **Share PDF** opens the phone's share menu. On a computer the PDF downloads instead.

The PDF goes to the bishop-approved list, the stake presidency and the full-time missionaries.

### What sending does

- One copy of the sent huddle is kept on the phone for **Share again**. It is replaced at the next
  send, removed after 5 weeks, and removed by Erase everything.
- Every action item moves into Return and Report for the next huddle.
- Names, next ordinances, needs and huddle notes stay. Baptism dates, temple and commitment stay.
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

- **Hand off** texts a link that loads the current huddle on another phone, for when someone else
  conducts. The data rides in the part of the link after `#`, which browsers never send to the
  website. On Android (and on a computer) opening the link asks "Load this handoff?" right away.
- **On iPhone the link opens in Safari, never in the Home Screen app,** and the two keep their data
  apart. So the link opens a page of its own, with nothing of the app behind it. It names the ward
  and the huddle, and shows three steps that stay on screen:
  1. **Copy handoff** (the one main button; it then reads "Copy again" with "✓ Copied").
  2. Open Huddle from the Home Screen (the icon is pictured).
  3. Tap **Load a handoff or PDF**, then **Paste a handoff**.

  Under the steps, **Don't have Huddle on your Home Screen?** opens to **Show me how to add it**
  and, as a last resort, **Use it in Safari this once** with a warning that it stays in Safari
  (the Home Screen app won't have it, and the phone can erase it after about a week without a
  visit). **Not now** closes the page and loads nothing. On a first visit, How to use and the tour
  wait until the next visit so nothing covers this page.
- **Load from a PDF** reads the data embedded in a sent PDF and sets up the next huddle from it,
  the same way sending does. This is how a ward mission leader picks up after someone else
  conducted, or restores after losing the phone's data.
- Both ask first and can be undone right after.

## Help built into the app

- **How to use:** training video, Take the tour, See a sample agenda, Try a practice week, and
  the written instructions. Opens by itself the first time in a phone's browser.
- **Tour:** 20 stops. The stops about one person open a person's screen; when New members is
  empty the tour shows a sample name, which is never saved. Starts once on its own the first time the app is opened from the Home
  Screen (or on a computer).
- **Practice week:** loads sample names and sample report-backs. Send and Hand off are blocked
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

US Letter, built in the browser with pdf-lib, with no fillable fields. File name:
`Huddle - {Ward} - {YYYY-MM-DD}.pdf`.

- Top: "Keep this PDF secure and delete it when it's no longer needed.", title, ward, date, who
  conducted, the Ward Council and huddle reminder boxes, and the attendees.
- **From the {date} huddle · Did it happen?** Return and Report: person, action, happened, notes.
- **{date} huddle plan:** Covenant Path Report Review and Name Next Ordinance, with Ward Council
  columns (name, next ordinance, needs) and Huddle columns (attended sacrament, action item,
  assigned to, when). Temple status and baptism commitments print under the name.
- Plans to Find New People to Teach.

A copy of the huddle's data is stored inside the PDF (the `HuddleData` entry of its information
dictionary; app id `huddle-agenda`, version 1). **Load from a PDF** reads it back. Keep this
format readable by future versions.
