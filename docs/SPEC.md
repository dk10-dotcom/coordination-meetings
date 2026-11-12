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
| Focus names | The three names ward council chooses. The PDF heads them "Name Next Ordinance" |
| Covenant Path Report (the section) | The three lists from the report: New members, Returning members, Those being taught. The PDF heads them "Covenant Path Report Review" |
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
4. **After the huddle:** update the Covenant Path Report.

**Send** makes the PDF, shares it and finishes the huddle. The app is then ready for the next one.
There is no date to set. The huddle is dated the day it is sent.

## The four lists of people

| List | Where it comes from | Notes |
| --- | --- | --- |
| New members | Covenant Path Report | Has a baptism date and a 30-day temple goal |
| Returning members | Covenant Path Report | |
| Those being taught | Covenant Path Report | Next ordinance is always "Baptism"; can be marked committed, with a scheduled date |
| Focus names ("Name Next Ordinance" on the PDF) | Chosen by ward council | Exactly three spots. Not part of the Covenant Path Report |

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
  with **Edit** (see Ward council and Covenant Path Report). Before ward council shows one card with only
  what the Covenant Path Report tells you (see Before ward council).
- **Missionary referrals** are listed and opened the same way (see Missionary Referrals).
- **Done** at the bottom, **Back** at the top and the phone's own Back all return to the list.
- **Remove from the list** (or **Clear this focus name**) is at the bottom of the person's screen.
  Removing someone who has details asks first, then returns to the list. While there is nothing
  to remove the link is invisible but keeps its place, so the screen does not shift under a tap.

The same row is used for the Huddle's sections, Ward council's lists and Before ward council, so
every list in the app looks alike. A section marked done shows a green check before its chevron.

**Every list's name stands out.** New members, Returning members, Those being taught, Focus names,
Referrals and Find New People to Teach's "This week's plan" each sit on a band of the list's own
color (blue, green, purple, gold, rose, teal: the colors the PDF uses), large and bold, with the
count beside it. On the smallest phones the name is a little smaller so the count stays beside it.

**Names have initials.** Each name row starts with a circle of initials ("DR") in its list's color;
an empty spot shows a dashed circle with a plus. A person's screen opens with a band of their
list's color: large initials, their name and their list ("New member"). Both follow the name as it
is typed.

**Section rows have icons.** In the Huddle and Ward council, each section row starts with a white
drawing on a rounded tile of the section's color, like an iPhone's Settings: Return and Report
(an arrow coming back, violet), Covenant Path Report (people, blue), Focus names (a star, gold),
Find New People to Teach (a magnifying glass, teal), Missionary Referrals (a paper plane, rose).

**Each of the four steps starts with a header card** in the step's color (Before ward council slate,
Ward council blue, Huddle orange, After the huddle plum): the step ("Step 3 · How & When") and the
date on one line, the ward name large (or the step's name when no ward is set), then the step's one
line on what to do. The Huddle and After the huddle show the huddle's date; the other two show
today's. The two meetings also show progress:
- **Huddle:** "2 of 5 sections done", with a bar that fills as sections are marked done.
- **Ward council:** "6 of 7 names have a next ordinance" (Covenant Path lists and focus names).
  Hidden while there are no names.
At the top a full bar reads "✓ All 5 sections done". The ward name is not repeated in Huddle
Details once it is in the card.

**Small moments.** A section's green check pops once when it is marked done, and the bar slides
to its new place. Sending opens the Sent message with a larger check, a brief burst of colored
specks, and a line such as "4 people have a plan this week." (people with an action item; left out
when there are none). Undo is unchanged. All motion is skipped when the phone is set to reduce motion.
There is no "needs attention" list: the sections' own orange status lines already say what is missing.

**Next ordinance is a menu:** Baptism, Sacrament, Temple baptisms, Priesthood advancement, Endowment,
Sealing ("Choose one" until picked). Those being taught stay fixed on Baptism. A next ordinance typed in
before the menu existed ("Aaronic Priesthood") stays chosen and is listed as one more choice.

**When is a date** (the huddle's action items and Find New People to Teach's assignments). Rows and the
PDF show it as "Thu, Nov 19"; the assignment text writes it out ("When: Thursday, November 19"). A When
typed before ("Sat", "tomorrow") becomes that date when the app opens; one that isn't a day ("this week")
stays as typed, in a text box. Return and Report keeps last week's wording as it was.

**A list's band and its names are one card:** the band is the card's top and the names hang right under
it, edged in the list's color.

**Missionary Referrals:** a referral's screen has **Text this referral to the missionaries**. Messages
opens with "Missionary referral: name", "Referred by: …", the notes, and "From the … huddle. Thank you!";
the person picks the missionaries. Turned off during a practice week.

## Opening screen

**Look.** At the top, How to use, then a deep blue header card: "Huddle", the title "Ward Mission
Leader Process", and under a thin line the ward name and today's date. **The ward is set here:** tapping
the name (it has a small pencil) opens "Your ward" with one box and Done; with no ward yet the card reads
"Tap to add your ward" in a dashed outline. Huddle Details no longer has a ward box. If Send finds no ward,
it offers "Add the ward", which opens the same box. The four steps follow as a timeline: white cards joined by a line on the left, each
with an icon tile in its page's color (Before ward council slate, Ward council blue, Huddle orange,
After the huddle plum; green is kept for "done" only). The circle on the line shows the step's number, or a green check once the
step is done: Before ward council and After the huddle when marked done, Ward council when every
name has a next ordinance, the Huddle when all five sections are marked done. The first step not
done is **Up next**: outlined in its color, a little larger, with an "Up next" tag. The bottom bar
(Hand off, Send) is frosted; Send is pale until After the huddle is done, then solid blue.

Title: "Ward Mission Leader Process" with the app's name, Huddle, in small letters above it, and
**How to use** beside it.

From top to bottom:

- **✓ {date} huddle sent · Share again** (only after a send).
- **Step 1 · Before ward council** box. Amber; green with a check once it is marked done.
- **Step 2 · Who & What · Ward council** button.
- **Step 3 · How & When · Huddle** button. Shows how many assignments have been reported back.
- **Step 4 · After the huddle** box. Amber; green with a check once it is marked done.

  All four read the same way: "Step N" in small letters, the step's name, then one line saying
  what to do (or where it stands).
- **Load from a PDF** (a quiet link that goes straight to choosing the file).
- **Erase everything and start over**, then the footer. Both appear on this screen only.
- Fixed at the bottom: **Hand off** and **Send**. These appear on this screen only.

The two boxes have no check box to tap. Each is one button that opens its step's screen. The only
way to mark one done is the **Mark done** button at the bottom of that screen, which also returns
to the opening screen. Opening one that is already done shows **✓ Marked done**, **Done · Back**
and **Marked by mistake? Mark as not done**. Both clear after a send.

**Each of the four steps opens a screen of its own**, with **Back** at the top and the step's name
beside it. None of them slides up as a sheet. **Each screen starts with one line saying what to do
there**, in the same place on all four:

| Step | The line |
| --- | --- |
| Before ward council | Update each person from the Covenant Path Report: next ordinance, needs, temple attendance and sacrament attendance. |
| Ward council | Decide who to focus on, each person's next ordinance, and what they need. |
| Huddle | Report back on the last huddle, take attendance, and plan one assignment for each person: what, who and when. |
| After the huddle | Update the Covenant Path Report with what happened, then mark it done so you can send. |

Ward council's line shows on its opening list only, not on a list of names or a person's screen.

### Before ward council (screen)

Opens from the first box, as a screen of its own with **Back** at the top. The box reads
"Step 1", "Before ward council", then "Update each person from the Covenant Path Report".
The screen has:

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

### After the huddle (screen)

Opens from the second box as a screen of its own, like Before ward council. The box reads "Step 4", "After the huddle", then "Update the Covenant
Path Report, then send". Read-only. For each person on the three Covenant Path Report lists it
shows what to carry into the report: sacrament attendance, temple attendance (new members),
baptism commitment (those being taught), next ordinance, needs, how the last assignment went
(with any note), the new assignment, and huddle notes. It has the same report button and, at the
bottom, **It's all updated · Mark done**.

**Send is blocked until this box is marked done.** Tapping Send early explains why and offers to
open this screen.

## Ward council

Opens to four rows:

- **Covenant Path Report** opens New members, Returning members and Those being taught.
- **Focus names** opens the three focus names.
- **Find New People to Teach** and **Missionary Referrals** open the same sections the Huddle has.
  They hold the same data, so what is entered in one meeting shows in the other.

The first two show a count that turns orange when someone is missing a next ordinance.
Under the rows, once, is "Never add confidential information to this agenda." It is not
repeated on the lists or on a person's screen.

Each list of names shows rows (see Lists of names and a person's screen). **A person's screen is
the mirror of the Huddle's:**

- **Ward Council · Who & What** is on top, open and highlighted: name, baptism date (new
  members), next ordinance and needs. The empty Needs box on Covenant Path Report names reads "Tap their
  name in the Covenant Path Report to identify needs"; focus names read "What do they need to get
  there?".
- **Huddle · How & When** is under it, closed, as a short summary: sacrament attendance (marked
  this huddle, or as of the last one), temple status (new members), baptism commitment (those
  being taught), this huddle's action item, and huddle notes. **Edit** opens the same fields the
  Huddle has, so they can be changed from Ward council; **Hide** closes them again.
- **Last huddle's assignment** (when there was one) shows the action, who had it, and a status of
  Done, Partly done, Not done or Pending. It is read-only: the huddle marks it.

## Huddle

Top to bottom: the one line saying what to do, **Huddle Details**, **Tips for an effective meeting**,
then five sections as rows.
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

With nothing to report the section is one line, not blank forms: "Nothing to report yet. After
your first huddle, its assignments show up here." before the first huddle, and "Nothing to report
from the last huddle." after a huddle that made no assignments. **Add an item** then shows one
blank item, for reporting on something that was not in the app. Every item has a remove button;
an item left blank is gone the next time the section opens.

**Carry forward to this huddle** appears on a Partly or No item. It puts the assignment back on
that person's card, tagged as carried, and can be undone. It is offered only while the person is
still listed. If they have been removed, a note says so. Someone converted from Those being
taught to New members is followed to the new list.

Each assignment has a **Notes** box ("How did it go?") under Yes / Partly / No; its words go on the PDF as before.

### Covenant Path Report

The Huddle's second section. On screen it is called **Covenant Path Report**, the same name Ward
council uses for these lists; the PDF's heading for it stays "Covenant Path Report Review".

**Open the Covenant Path Report** is at the top (there is no reminder box), then the three lists as
rows. Under each list's name is a small **How can we help?** link (see How can we help?).
Tapping a name opens that person's screen, which has two halves:

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
  **Move to New members** (under the card) moves the person to New members and keeps their
  screen open.
- **Text this assignment** opens Messages with the action, the name and when. Needs and notes are
  never included. It then shows Texted. The text reads, for example:

  ```
  Drive him to the temple
  For: Daniel Rivera
  When: Saturday 9 am (Nov 14)
  From the Sample Ward huddle. Please report back. Thank you!
  ```

  The action is the first line. It is a plain text with no link in it. Day names are spelled out
  ("Sat" becomes "Saturday"), and a weekday, "today", "tonight" or "tomorrow" gets its date, so the
  person reading it does not have to work out which Saturday is meant. A weekday means the next one
  after today (on a Sunday, "Sun" is next Sunday). A date that was typed out ("Nov 14", "11/20") is
  sent as typed, and so is anything with no day in it ("this week").
- **When** suggests "e.g. Sat 9 am". On a phone it has a row of its own under **Assigned to**.
- **+ Add a note for ward council** adds huddle notes, which carry forward and print on the PDF.

On the lists:

- **Confirm none this week** is a row on an empty list. It marks the list as reviewed, and
  **Undo** takes it back. A list left blank prints "Not reviewed".
- **Add a name** adds a person to a list.

### Focus names

The three focus names as rows; each opens the same two-half screen. On screen the section is
called **Focus names** in both meetings; the PDF's heading for it stays "Name Next Ordinance"
(with "Ward council focus names" beside it).

### Find New People to Teach

A plan for the week and any number of assignments (who will do what, and when), plus
**Tips for finding new people to teach**. The same section opens from Ward council.
Its "This week's plan" band carries its own **How can we help?** link, in the Huddle and in Ward council.

### How can we help?

Questions to talk through, for the person conducting who is not sure what to ask. The link is in
the Huddle and in Ward council: under New members, Returning members and Those being taught in the
Covenant Path Report, and at the top of Find New People to Teach. It is not in Before ward council
or on a person's screen.

Tapping it slides up a panel with that section's questions and no others:

| Link under | The panel's heading | Questions |
| --- | --- | --- |
| New members | How can we help those who were recently baptized? | 6 |
| Returning members | How can we help returning members? | 4 |
| Those being taught | How can we help those being taught? | 3 |
| Find New People to Teach | How can we find more people to teach? | 2 |

The headings and questions are the "possible discussion items" in *Preach My Gospel*, chapter 13
("Participate in the Weekly Coordination Meeting"), word for word. Each card holds one item; when an item asks several questions, each
question sits on its own line with a thin line between, still in the manual's words. Under them is the line
"From *Preach My Gospel*, chapter 13", a link to the chapter in the Gospel Library.

The panel closes with one tap: the **X** at its top right, or a tap outside it (a swipe down and
Escape work too). There is nothing to type and nothing is saved. The questions are never on the
PDF, in a handoff or in an assignment text.

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

**The link's form.** `…/coordination-meetings/?h=<6 random letters>#handoff=<code>`. The huddle is in the
code after the #, which is never sent to the website. The random tag before the # carries nothing; it makes
each link different, so Safari opens the link instead of bringing forward a Huddle tab that is already open
(which showed the opening screen instead of the handoff page). Links without the tag still load. Opening a
link clears both from the address bar.

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
  Return and Report. The Hand off sheet and How to use both say this.
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
  confidential information to this agenda." (always showing), and five groups of rows:
  - **First time only:** Add Huddle to your Home Screen. It is set apart and has no step number,
    because it is done once and is not part of the week. Its one-line summary reads "Do this once,
    before you start", or "Already done on this phone" when the app is running from the Home Screen.
  - **Every week:** five numbered steps, each with a one-line summary: Before ward council, Ward
    council, Huddle, After the huddle, During the week. The first four are the four steps on the
    opening screen, under the same names.
  - **How do I…:** Hand off to someone else, Fix a mistake, Share the PDF again, Get my names
    back, Add or remove a name, New members and those being taught.
  - **About this app:** Privacy and security ("Everything stays on this phone"). It says that what
    is entered stays on the phone and nothing is saved online; that only what is sent leaves (the
    PDF, an assignment text or a handoff); to protect the PDF (the sharing rule word for word, and
    delete old copies); and never to enter confidential or sensitive information, because everyone
    who gets the PDF can read it.
  - **Watch or try:** Take the tour, See a sample agenda, Try a practice week, and Training slides
    ("At your own pace"). The slides open full screen, one at a time: a count ("3 of 33") and a bar at the
    top, the step in its color, a short title and a few sentences, then a picture of the app with a ring
    around what to tap. **Back** and **Next** at the bottom (or a swipe left or right); nothing moves on by
    itself, and the last slide's button is **Done**. The X closes them. The pictures and words are in
    `media/slides/` (fetched from the website, not kept offline) and are made from the app with
    `node test/tools/slides/make.js`; the words are in `test/tools/slides/scenes.js`.

  **Sources** is the second row under About this app: links to *Preach My Gospel*, chapter 13
  (questions), General Handbook 23.4 (the meeting) and "Ideas for Weekly Missionary Coordination"
  (tips).

  Tapping a step or question opens it in place, and tapping it again closes it. A step is at most
  five short lines that say what to tap; what a screen already explains is left out. The After the
  huddle step carries the sharing rule word for word. Every time How to use opens it is the short list again,
  scrolled to the top. In a phone's browser the first-time step (Add Huddle to your Home Screen) starts
  open, and How to use opens by itself on the first visit; from the Home Screen app every step
  starts closed.
- **Tour:** 11 stops, about 2 minutes (the Huddle Details stop also points out the progress bar): Welcome, Your ward, the four steps, Before ward council, Ward council
  (with the warning "Never add confidential information to this agenda."), Huddle Details, Return
  and Report, a person's screen in the huddle (which also points to **How can we help?**), the
  30-day temple goal, After the huddle, and Send.
  The stops about names show a sample name when New members is empty, which is never saved.
  Starts once on its own the first time the app is opened from the Home Screen (or on a computer).
- **Tips for an effective meeting** (in the Huddle) and **Tips for finding new people to teach**
  (in Find New People to Teach) each end their borrowed text with a source line linking to
  "Ideas for Weekly Missionary Coordination" in *Sharing the Gospel: Resources for Leaders*.
  The first says "Adapted from" (five points condensed from the page's eight principles); the
  second says "From" (quoted). The **Prepare ahead** tip is the app's own and sits below the line.
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

### Source links

Whatever the app quotes or adapts names its source in one small line (`.source-line`) with a link
to that page in the Gospel Library. The links open outside the app (`target="_blank"`); tapping
one is the only time these pages are contacted, and the app itself still makes no network calls.

| Where | Source line | Opens |
| --- | --- | --- |
| How can we help? panels | From *Preach My Gospel*, chapter 13 | `…/preach-my-gospel-2023/21-chapter-13` |
| Tips for an effective meeting | Adapted from "Ideas for Weekly Missionary Coordination," *Sharing the Gospel: Resources for Leaders* | `…/sharing-the-gospel-resources-for-leaders/02-effective-coordination-with-missionaries` |
| Tips for finding new people to teach | From the same page | the same page |
| How to use: Sources | The two above, and General Handbook 23.4 (who conducts and who is invited) | `…/general-handbook/23-sharing-the-gospel-and-strengthening-new-and-returning-members` |

Not from these sources, and so not cited: the 30-day temple goal, the Who & What / How & When
labels, the Prepare ahead tip, and the three attendee choices General Handbook 23.4 does not list
(TFH leader, TFH consultants, High Councilor). When adding quoted or adapted text, add its source
line in the same change and a row here.

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
