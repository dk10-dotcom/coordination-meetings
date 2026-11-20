# How the app works

The app is named **Huddle**. That is the name under its Home Screen icon, in the browser tab and in
small letters above the opening screen's title. (The third step is also called the Huddle; the
opening screen's large title is "One by One" so the two are not confused.)

This describes the behavior of the app as it is today. The code is the final word:
`app.js` (behavior and PDF), `index.html` (screens and Help & training). (There is no guided tour any more.)
When behavior changes, change this file in the same commit.

## Words the app uses

One word for each thing, on every screen, in Help & training and in the step-by-step guide:

| Word | Means |
| --- | --- |
| Huddle | The app, the weekly coordination meeting, and that meeting's plan on the phone ("Text this huddle", "Sending finishes the huddle") |
| Huddle report | What is filled in and sent: the PDF ("Send the huddle report", "Load a huddle report"). Not "agenda", and "the PDF" only where the file itself is meant |
| Opening screen | The first screen: the four steps, with Hand off as a line under them (Home and Send float at the bottom of every screen) |
| Covenant Path Report | The report in Member Tools (always "Member Tools", never "Tools") |
| Assignment | What someone will do, with who and when, for a focus name or an event. (It was "action item"; that word is gone.) |
| Focus names | The names ward council chooses, on every screen and in the huddle report |
| Covenant Path Report (the section) | The three lists from the report: New members, Returning members, Those being taught. The huddle report heads them "Covenant Path Report" too |
| Next steps | A person's items not yet done on their Covenant Path Report (in Ward Council, the Huddle's suggestions and the huddle report) |
| This week's plan | The Huddle's Opportunities to invite and Focus names (it was "Huddle action plan") |
| Ward Council, Before Ward Council | Capitalized as the names of steps and screens; "ward council" in ordinary sentences, as the Handbook writes it |
| Carry forward | Moving an unfinished assignment onto this huddle's plan. A carried one is tagged "Carried forward" |
| The last huddle | Where Return and Report comes from (not "last week") |

## Who it's for

The person who conducts a ward's weekly coordination meeting ("the huddle"), usually the ward
mission leader. Ward council decides **who** to focus on and **what** each person's next ordinance
is. The huddle decides **how** and **when** to help. The app carries the names from ward council to
the huddle, records the huddle's assignments, and produces a PDF that is shared by email or text.

The users are not technical. The app must be usable with no training beyond the short step-by-step guide.
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

Every person holds: name, next ordinance, What will help (`need`; called Needs before), huddle notes, attended
sacrament, and one assignment (action item, assigned to, when). People on the Covenant Path Report also hold their
group's checklist (`checks`: each item done or "doesn't apply"; see Before ward council).

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
- **Done** at the bottom, **Back** at the top and the phone's own Back all return to the list.
- **Remove from the list** (or **Clear this focus name**) is at the bottom of the person's screen.
  Removing someone who has details asks first, then returns to the list. While there is nothing
  to remove the link is invisible but keeps its place, so the screen does not shift under a tap.

The same row is used for the Huddle's sections, Ward council's lists and Before ward council, so
every list in the app looks alike. A section marked done shows a green check before its chevron.

**Every list's name stands out.** New members, Returning members, Those being taught and Focus names
each sit on a band of the list's own
color (blue, green, purple, gold, teal: the colors the PDF uses), large and bold, with the
count beside it. On the smallest phones the name is a little smaller so the count stays beside it.

**Names have initials.** Each name row starts with a circle of initials ("DR") in its list's color;
an empty spot shows a dashed circle with a plus. A person's screen opens with a band of their
list's color: large initials, their name and their list ("New member"). Both follow the name as it
is typed.

**Section rows have icons.** In the Huddle and Ward council, each section row starts with a white
drawing on a rounded tile of the section's color, like an iPhone's Settings: Return and Report
(an arrow coming back, violet), Sacrament attendance (a calendar with a check), Covenant Path Report
(people, blue; Ward council), Focus names (a star, gold), Opportunities to invite (a magnifying glass, teal).

**Each of the four steps starts with a header card** in the step's color (Before ward council slate,
Ward council blue, Huddle orange, After the huddle plum): the step ("Step 3 · How & When") and the
date on one line, the ward name large (or the step's name when no ward is set), then the step's one
line on what to do. The Huddle and After the huddle show the huddle's date; the other two show
today's. The two meetings also show progress:
- **Huddle:** "2 of 5 sections done", with a bar that fills as sections are marked done.
- **Ward council:** "Opportunities to invite not done yet · 2 of 3 focus names have a next ordinance", or "Ward Council
  is done". A focus name without a next ordinance carries a red **Needs a next ordinance** tag on Ward Council's
  screen. Ward council (step 2 on the opening screen) is done when Opportunities to invite has an event (or **No
  upcoming events**) and every focus name has a next ordinance (the user decided, Nov 19, 2026).
  Hidden while there are no names.
At the top a full bar reads "✓ All 5 sections done". The ward name is not repeated in Huddle
Details once it is in the card.

**Small moments.** A section's green check pops once when it is marked done, and the bar slides
to its new place. Sending opens the Sent message with a larger check, a brief burst of colored
specks, and a line such as "4 people have a plan this week." (people with an action item; left out
when there are none). Undo is unchanged. All motion is skipped when the phone is set to reduce motion.
There is no "needs attention" list: the sections' own orange status lines already say what is missing.

**Next ordinance is a menu:** Baptism, Sacrament, Baptisms for the dead, Priesthood advancement, Endowment,
Sealing ("Choose one" until picked). Those being taught stay fixed on Baptism. A next ordinance typed in
before the menu existed ("Aaronic Priesthood") stays chosen and is listed as one more choice. An older "Temple baptisms" becomes "Baptisms for the dead".

**When is a date** (the huddle's action items and Opportunities to invite's assignments). Rows and the
PDF show it as "Thu, Nov 19"; the assignment text writes it out ("When: Thursday, November 19"). A When
typed before ("Sat", "tomorrow") becomes that date when the app opens; one that isn't a day ("this week")
stays as typed, in a text box. Return and Report keeps last week's wording as it was. An empty date
field says "Pick a date" in gray, in place of the phone's blank box or "mm/dd/yyyy".

**Dark mode** follows the phone's setting, or Settings → Appearance (Automatic, Light, Dark). Light surfaces turn dark gray, dark text turns light, and the
step colors, buttons and header cards keep their colors. It comes from `dark.css`, which
`python3 test/tools/make-dark.py` makes from `styles.css`; run it after changing colors in `styles.css`.
The PDF, the sample report and the training slides stay light.

**A person's screen is flat:** each part (what ward council decided, the Covenant Path Report, the
Huddle's how and when) is one white panel on the gray background, with color only in its small label;
fields are light gray boxes with no border. The red Temple attendance box keeps its color.

**The step card is compact:** the colored card at the top of each step keeps its words (step, ward, date, the one
line saying what to do, and progress) in less height, so the first rows show without scrolling.

**Nothing is smaller than 13 pt:** the small capital labels ("STEP 1", "UP NEXT"), tags, the bottom
bar's words and the footer included.

**Launch screen.** Opening Huddle from the Home Screen shows the app icon on navy with "Huddle" and
"Joyfully gathering Israel one by one in Christ" under it (`icons/launch/`, made by `node test/tools/make-launch.js`),
instead of a white flash.

**A list's band and its names are one card:** the band is the card's top and the names hang right under
it, edged in the list's color.


## Opening screen

**The opening picture.** When the app opens, the same picture as the phone's launch screen (the icon,
"Huddle", and “Joyfully gathering Israel one by one in Christ”) stays about a second longer, then fades.
Taps pass through it. Automated checks skip it.

**Look.** At the top, **Help & training**, then a deep blue header card: "Huddle", the title "Weekly Ward
Mission Process", and under a thin line the ward name and today's date. **The ward is set here:** tapping
the name (it has a small pencil) opens "Your ward" with one box and Done; with no ward yet the card reads
"Tap to add your ward" in a dashed outline. Huddle Attendees no longer has a ward box. If Send finds no ward,
it offers "Add the ward", which opens the same box. The four steps follow as a timeline: white cards joined by a line on the left, each
with an icon tile in its page's color (Before ward council slate, Ward council blue, Huddle orange,
After the huddle plum; green is kept for "done" only). The circle on the line shows the step's number, or a green check once the
step is done: Before ward council and After the huddle when marked done, Ward council when every
name has a next ordinance, the Huddle when all five sections are marked done. The first step not
done is **Up next**: outlined in its color, a little larger, with an "Up next" tag. The bottom bar
(Hand off, Home, Send) is a frosted pill floating at the bottom of every screen; Send is pale until After the huddle
is done, then solid blue.

Title: "One by One", with the app's name, Huddle, in small letters above it and, under it in smaller
type and in quotation marks, “Joyfully gathering Israel one by one in Christ” (the Area Presidency's directive; no source line, by the user's
decision, since it is already established in the stake). **Help & training** sits beside it.

From top to bottom:

- **✓ {date} huddle sent · Share again** (only after a send).
- **Step 1 · Before ward council** box. Amber; green with a check once it is marked done.
- **Step 2 · Who & What · Ward council** button.
- **Step 3 · How & When · Huddle** button. Shows how many assignments have been reported back.
- **Step 4 · After the huddle** box. Amber; green with a check once it is marked done.

  All four read the same way: "Step N" in small letters, the step's name, then one line saying
  what to do (or where it stands).
- One line: "Not an official app of The Church of Jesus Christ of Latter-day Saints." It appears on this
  screen only. Who made the app, with an email link, is at the end of Help & training.
- Load from a PDF and Erase everything are under **Settings** in Help & training.

The two boxes have no check box to tap. Each is one button that opens its step's screen. The only
way to mark one done is the **Mark done** button on that screen, which also returns to the opening
screen. Opening one that is already done shows the button green, reading **Done** with a check;
tapping it keeps it done and goes back. A small **Mark as not done** link under it takes the mark off (with Undo
in the message). Both clear after a send.

**Mark done is the same everywhere** (Before ward council, each Huddle section, After the huddle): one
label, pinned just above the bottom bar so it stays in view on a long list, green with a check once done.
**The green Done keeps it done** and goes back (the user decided, Nov 18, 2026: tapping it used to take the mark
off, which was easy to do by mistake right after a person's own Done). **Mark as not done**, a small link under it,
is the only way to take the mark off.

**Each of the four steps opens a screen of its own**, with **Back** at the top and the step's name
beside it. None of them slides up as a sheet. **Each screen starts with one line saying what to do
there**, in the same place on all four:

| Step | The line |
| --- | --- |
| Before ward council | Open the Covenant Path Report in Member Tools and make this list match it: add or remove names so everyone is listed, and check off each person's items that are done there. |
| Ward council | Add any upcoming opportunities to invite. Then identify focus names from the Covenant Path Report, the Part-Member Families list, or anyone else ward council feels to focus on. |
| Huddle | Report back on the last huddle and take attendance. Review the opportunities to invite and make at least one action plan, then plan one assignment for each focus name: what, who and when. |
| After the huddle | Go back to the Covenant Path Report and update it with any new information. Then mark this done so you can send. |

Ward council's line shows on its opening list only, not on a list of names or a person's screen.

### Before ward council (screen)

Opens from the first box, as a screen of its own with **Back** at the top. Before ward council **mirrors the
Covenant Path Report** (the user decided, Nov 18, 2026): no decisions are made here. The screen has:

- One line: "Open the Covenant Path Report in Member Tools and make this list match it: add or remove names so
  everyone is listed, and check off each person's items that are done there."
- **Open the Covenant Path Report** (opens Member Tools; see Links).
- The three Covenant Path Report lists, as the same rows every other list uses. A row shows the name, one
  status line ("3 of 9 done") and tags: a new member's temple status ("Temple: 18 days left" in red, or
  "✓ Temple"), "Committed to baptism · Dec 5" and "Appointment: Wed, Nov 18" for those being taught (an
  appointment shows until its day has passed; it carries to next week until then). Each list ends in
  **Add a name**. Focus names are not shown here.
- **Mark done** (pinned above the bottom bar), which marks the box done and returns to the opening
  screen, and remembers how each person looks at that moment, so After the huddle can show what changed.

**Tapping a name opens that person on their own screen**: the dates first (a new member's **Baptism date**;
for those being taught, **Baptism date** (entering it marks them committed, clearing it takes that off) and
**Next scheduled appointment**), then **Check off what's done**, the group's checklist with "3 of 9 done"
beside it. **A check means done.** Sacrament attendance, next ordinance and needs are not here (sacrament is
marked in the Huddle; next ordinance and What will help are ward council's).

| New members | Returning members | Those being taught |
| --- | --- | --- |
| Meet with the bishop | Has friends at church | Attended sacrament meeting |
| Performed baptisms for the dead (red, with the 30-day countdown, until checked) | Aaronic Priesthood ordination (if applicable) | Has friends at church |
| A calling | Melchizedek Priesthood ordination (if applicable) | Met the bishop |
| A ministering assignment | A calling | Participated in family history |
| Assigned ministers | A ministering assignment | |
| Prepared a family name for the temple | Assigned ministers | |
| Invited to attend institute | Prepared a family name for the temple | |
| Invited to mission or temple preparation | Meet with the bishop | |
| Interview for patriarchal blessing | Performed baptisms for the dead | |
| Invited to consider a full-time mission | Received endowment | |
| | Sealed to parents | |
| | Sealed to spouse (if applicable) | |

The "if applicable" items have a **Doesn't apply** button beside them; an item that doesn't apply is crossed
out and left out of the count. (Nov 20, 2026: the priesthood ordinations offer it; Received endowment and Sealed to parents
no longer do, and an older "Doesn't apply" on those two counts as still open.) A new member's "Performed baptisms for the dead" sits right under the baptism date, in red with the countdown,
until it's checked; then it moves into the list after Meet with the bishop. It is the same as temple
attendance everywhere else (the countdown, the tags, the PDF). The checklist carries to the next huddle with
the name, and is kept in the PDF's data. **Done**, **Back** and the phone's Back return to the list.
**Remove from the list** is at the bottom and asks first when the person has details. A name already on that
list is refused ("… is already on this list."). A name added and left empty does not stay.

### After the huddle (screen)

Opens from the second box as a screen of its own, like Before ward council. The box reads "Step 4", "After the
huddle", then "Update the Covenant Path Report, then send". Read-only. It has the same report button and
**Mark done**.

**It lists only what changed since step 1** (the user decided, Nov 18, 2026). Marking Before ward council done
remembers each person's sacrament attendance, baptisms for the dead, baptism commitment and date, appointment
and checklist. Here, only the people different since then are listed, each with a gold **Changed** tag and only
the lines that changed, marked **Updated** (a checklist item reads "Done", "Doesn't apply" or "Not done"); a name
added since is **New since step 1**, with what's checked. Next ordinance, What will help and Huddle notes are
left out: they don't go into the Covenant Path Report. A line at the top says how many changed ("1 person
changed since step 1. Update these in the Covenant Path Report." or "Nothing changed since step 1."). Without
step 1 marked done, everyone is listed with sacrament and temple attendance and how the last assignment went.

**Send is blocked until this box is marked done.** Tapping Send early explains why and offers to
open this screen.

## Ward council

**Next** (the user asked, Nov 18, 2026): at the bottom of each of ward council's two lists, and of each Huddle
section under **Mark done**, a full-width **Next: {next section} ›** button goes to the next one in order;
a quiet "‹ {previous section}" link sits under it. Ward council's lists have no Mark done. Ward council's header
card has the same kind of progress bar as the Huddle's (names with a next ordinance).

Opens to its parts as separate cards, in order, with no numbers (the user decided, Nov 19, 2026). Like the opening
screen, the first one not done is outlined with an **Up next** tag, and a finished one gets a green check:

- **Opportunities to invite** opens the same section the Huddle has. It holds the same data, so what is
  entered in one meeting shows in the other. Done when its button was tapped: **Done** with events listed, **No
  upcoming events** with none (see the evening changes below).
- **Find your focus names**: one box, with that heading inside it, holding the two lists the focus names come from,
  so it's plain they go together (the user asked, Nov 19, 2026). The box is the card: it carries Up next, and its
  check sits by the heading, with "Done once you choose a focus name." under it.
  - **Covenant Path Report** opens New members, Returning members and Those being taught, with
    **Open the Covenant Path Report** at the top (the same button the opening screen's step 1 has). Its status
    counts people ("4 people · 1 needs a next ordinance", in gray).
  - **Open Part-Member Families**, a button under it in the same box.
- **Focus names**, a card with the focus names right in it (there is no Focus names list of its own any more; an old
  `wc-tn` screen still opens). Each is the usual name row, a little smaller: name, "Next: Sealing" or the red
  **Needs a next ordinance** tag. Tap a name to open it (Back and Done return here); swipe it left to remove it.
  With none yet: "Choose up to three from the lists above." **Add a focus name** (for someone on neither list) shows
  while there are fewer than three. Once every focus name has a next ordinance the card gets a green outline and
  check, "Every focus name has a next ordinance".

**Ward council chooses the focus names; the huddle plans their action items.**

- **Suggested focus name.** In Before ward council and Ward council, a Covenant Path name gets a red
  "Suggested focus name" tag when it is pressing: every new member who hasn't been to the temple yet
  ("Temple: 9 days left", or "Not yet to the temple" with no baptism date), and anyone being taught with a
  baptism date in the next 30 days or an appointment with the missionaries in the next week. Returning
  members are never suggested; ward council can still choose them.
- **Make focus name** is at the top of a Covenant Path name's Ward council screen (in a red box saying why
  when suggested). It fills the first open spot, or adds one past three: a pressing name can take the list
  over three. Their next ordinance and needs come along, and an action item already on their card moves with
  them. Once they are a focus name the screen says so, and their row carries "★ Focus name".
- **Swipe a focus name left** (Ward council and the Huddle) to show **Remove**, or open the name and tap
  **Remove from Focus names** at the bottom of its screen. Either asks first ("Remove … from
  Focus names?"), then takes them off Focus names (from their screen, it goes back to the list); **Undo** in the message puts them back where they were.
  They stay on the Covenant Path Report. The list closes up: names stay together, and empty spots only fill
  out to three at the end (a huddle saved with a gap closes up when it opens).

**Open Part-Member Families** (in the Find your focus names box, with "In Leader and Clerk Resources, on the web"
under it) opens the Part-Member Families report
in Leader and Clerk Resources (`https://lcr.churchofjesuschrist.org/mlt/report/part-member-households?lang=eng`)
outside the app (`target="_blank"`), for finding names to discuss. Member Tools has no link to this report, so
it always opens the web page. It shows on Ward Council's own screen only, not on the lists of names.
"Never add confidential information to this huddle report." is one small gray line with a red "!", placed
next to the boxes where details are typed rather than under the step card. It is not on a person's Ward council
screen: nothing is typed there (the user decided, Nov 19, 2026). In the Huddle it sits under
the notes: at the end of a person's **Huddle · How & When** (under Huddle notes, or under "+ Add a note for ward
council") and under **Notes** on each Return and Report item. It is not repeated on the lists. New members' rows show the same temple countdown as in the Huddle
("Temple: 14 days left" in red), so the 30-day goal is in front of both meetings.

**The name is edited in the header, and only there.** On every person's screen (Before ward council, Ward
council, the Huddle, a missionary referral), tapping the name or the initials (which carry a small pencil)
turns the name into a text box in the same place, with the cursor at the end. Done on the keyboard, or
tapping anywhere else, turns it back. No section below has a Name box. A new name opens with the header box
ready to type in. The duplicate check ("… is already on this list.") and "Is this the same person?" work as
before.

Each list of names shows rows (see Lists of names and a person's screen). **A person's screen is
the mirror of the Huddle's:**

- **Ward Council · Who & What** is on top, open and highlighted: name, baptism date (new
  members), **Next ordinance** and **What will help** (called Needs before; the user renamed it, Nov 18, 2026),
  following Elder Bednar's pattern: name, next ordinance, then one step that helps them get there.
  - While Next ordinance is empty, a chip **Suggested: {ordinance}** offers what the checklist points to (a new
    member who hasn't done baptisms for the dead: Baptisms for the dead; a returning member: Priesthood
    advancement while a priesthood ordination is open, then Baptisms for the dead, Endowment, Sealing). A tap
    fills it in.
  - Under What will help (placeholder "One step toward their next ordinance"), **Still open on their Covenant
    Path Report** lists the person's unchecked items as chips ("A calling", "Prepare a family name for the
    temple"). A tap fills What will help; the chips hide once something is typed. A focus name finds its chips
    by name on the Covenant Path Report lists. A name that isn't on the report gets ideas by the next ordinance
    ward council picks, labeled **Ideas for {ordinance}**: baptism (Attend sacrament meeting, Friends at church,
    Meet the bishop, Participate in family history); the sacrament (Friends at church, Assigned ministers, A
    calling); baptisms for the dead (Meet with the bishop, Prepare a family name
    for the temple); priesthood advancement (Meet the bishop, Friends at church, Assigned ministers, A calling);
    the endowment (Meet with the bishop, Invite to temple preparation, Prepare a
    family name for the temple); sealing (Meet with the bishop, Invite to temple
    preparation). They change when the next ordinance changes.
- **Huddle · How & When** is under it, closed, as a short summary: sacrament attendance (marked
  this huddle, or as of the last one), temple status (new members), baptism commitment (those
  being taught), this huddle's action item, and huddle notes. **Edit** opens the same fields the
  Huddle has, so they can be changed from Ward council; **Hide** closes them again.
- **Last huddle's assignment** (when there was one) shows the action, who had it, and a status of
  Done, Partly done, Not done or Pending. It is read-only: the huddle marks it.

## Huddle

Top to bottom: the header card (its one line saying what to do, then a small white link **Tips for an effective
meeting ›**, then the progress bar), **Huddle Attendees**, then four sections as rows: **Return and Report** and **Sacrament attendance** at the top, with no heading,
then **Huddle action plan** over **Opportunities to invite** and **Focus names** (focus names last, so they finish
the huddle; the user decided, Nov 19, 2026). The Covenant Path names are
not a section of their own here: their sacrament attendance is marked in Sacrament attendance, and their
assignments come back in Return and Report.
The confidential reminder sits under the notes on each name and Return and Report item, not under the step card.
There is no disclaimer line on this screen.
A section's name sits beside **Back** when it is open. **Mark done** gives a section a
green check; it is optional, never blocks Send, and clears when the huddle is sent. A section whose
status is orange is still missing something.

### Huddle Attendees

Ward name (remembered on the phone), who is conducting (Ward mission leader, Elders Quorum, or
Other with a name; a short list; the one chosen is filled in blue), and attendance. Attendees, with the two youth roles first: Priests quorum
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

**Carry forward to this huddle** appears on a Partly or No item. It brings the assignment back as a
**focus name** with the action item on it (past three if need be), tagged as carried, and can be undone.
A finding assignment goes back to Opportunities to invite. It is offered only while the person is
still listed. If they have been removed, a note says so. Someone converted from Those being
taught to New members is followed to the new list.

Each assignment has a **Notes** box ("How did it go?") under Yes / Partly / No; its words go on the PDF as before.

### Sacrament attendance

Everyone once: the Covenant Path names (New members, Returning members, Those being taught), then focus
names not on the report. Each is a row with the person's list under the name and a box at the right; one tap
marks them as attending, another unmarks them. Marking someone marks their focus name card too, so no one is
marked twice. The row on the Huddle screen reads "3 of 6 attended".

### A person's Huddle screen

Tapping a focus name opens that person's screen, which has two halves:

- **Ward Council · Who & What** is condensed to a short summary: next ordinance, What will help, and a new
  member's baptism date. **Edit** opens the name, baptism date, next ordinance and What will help;
  **Hide** condenses them again. It opens with the fields showing only when there is nothing to
  summarize yet: a new name, or a new member with no baptism date.
- **Huddle · How & When** is a highlighted block, the part the huddle fills in: action item, assigned to,
  when. A focus name has no Attended sacrament box (the user took it off, Nov 18, 2026): Sacrament
  attendance marks everyone once.

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
  From the Sample Ward huddle. Please report back before Sunday, Nov 15. Thank you!
  ```

  The last line asks them to report back before the coming Sunday (a week out when the text is sent on a
  Sunday), so the next huddle hears how it went. The action is the first line. It is a plain text with no link in it. Day names are spelled out
  ("Sat" becomes "Saturday"), and a weekday, "today", "tonight" or "tomorrow" gets its date, so the
  person reading it does not have to work out which Saturday is meant. A weekday means the next one
  after today (on a Sunday, "Sun" is next Sunday). A date that was typed out ("Nov 14", "11/20") is
  sent as typed, and so is anything with no day in it ("this week").
- **When** suggests "e.g. Sat 9 am". On a phone it has a row of its own under **Assigned to**.
- **+ Add a note for ward council** adds huddle notes, which carry forward and print on the PDF.

A Covenant Path name opened from Ward council shows its sacrament, temple and baptism checks with "Action items
are planned for focus names" in place of the action item.

### Focus names

The focus names as rows (three spots, more when ward council adds pressing names); each opens the two-half
screen above. Swipe one left to remove it (see Ward council). On the PDF the heading is "Focus names" with
"Name Next Ordinance" beside it.

### Opportunities to invite

(Called Find New People to Teach before.) Ward council lists what's coming up; the huddle plans how members
will invite. The same section opens from Ward council and the Huddle.

- **At the top:** **Tips** (the tips sheet, with its source line). The Tip of the week and How can we help? were
  taken out (the user decided, Nov 18, 2026).
- **Opportunities are rows, like the name lists** (the user decided, Nov 18, 2026): under the band **Upcoming**
  (with "2 events"), each row has a date tile (DEC 20), its name, one status line ("Sun, Dec 20 ·
  1 assignment", or "Needs an assignment" in orange) and a chevron; **Add an event** is the last row. Above the list,
  one gray line says what an opportunity is: "Ward activities, special meetings and other events to invite friends to."
  The section keeps its name; only the button and the hint say "event" (the user decided, Nov 19, 2026).
- **No upcoming events:** with none listed, the button pinned at the bottom says **No upcoming events**; tapping it
  shows "No upcoming events" with a green check in the list and counts as done for Ward Council. Adding an event
  clears it; a new week starts without it.
- **In the Huddle each opportunity is a card of its own** (the user asked, Nov 18, 2026): its date tile, name and
  "Sun, Dec 13 · 2 assignments" (or "Needs an assignment" in orange) on top, then one line per assignment (what,
  who and when, and Done, Partly, Not done or Pending for one from an earlier huddle), then **Add an assignment**.
  Tapping the top opens the opportunity; tapping an assignment opens it with just that assignment open; Add an
  assignment opens it with a new one ready to type. **+ Add an event** sits under the cards. Ward council keeps
  the list of rows (dates only).
- **Each opportunity opens on its own screen** (Back, Done and the phone's Back return to the list): what's coming
  up and its **Event date** (so it isn't mistaken for when an assignment is due), then its assignments and **Add an assignment**, then **Remove this opportunity** at the
  bottom (asks first when anything is typed; its assignments go with it). An opportunity left empty is dropped on
  the way back. While its name is empty it shows starter ideas to tap: Special sacrament meeting, Christmas
  sacrament meeting, Easter sacrament meeting, Member speaking in sacrament meeting, Stake conference, Ward
  conference, Ward activity, Youth activity, Dinner or home evening, Baptismal service, Sports night, Self-reliance or other
  classes, Service project.
- **Each assignment has three boxes:** **Assignment** (what), **Assigned to** (who) and **When**. While Assignment is
  empty, **Ways to invite: tap one** sits under it: Members invite friends and neighbors, Members go on a visit with
  the missionaries, Share it on the ward's activity page. A tap fills Assignment and moves to Assigned to. An older
  huddle's assignment keeps its words in Assignment, with Assigned to empty.
- **Each assignment is one line** on the opportunity's screen (the user asked, Nov 18, 2026): what, then who and
  when in gray, a chevron, and for one from an earlier huddle a status tag (**Done**, **Partly**, **Not done** or
  **Pending**). Tap the line to open its boxes; a new assignment opens by itself. Earlier ones come first.
- **Text this assignment** sits in each open assignment once it has what and who: the text reads the assignment,
  "For: Christmas sacrament meeting (Dec 20)", When, and the report-back line.
- **An opportunity keeps its assignments until its date passes.** At the next huddle each one comes back in Return
  and Report (with the opportunity in brackets) and also stays on the opportunity, marked **Pending**; marking it
  Yes, Partly or No in Return and Report shows on the opportunity as Done, Partly or Not done, and it stays that way
  (an earlier one isn't sent to Return and Report again). On the PDF it reads "From an earlier huddle · Done".
- **With no opportunities:** "Ward council hasn't listed any opportunities yet." with the starter ideas; a tap
  adds that opportunity and opens it.
- **No "Other ways to invite"** (the user took it out, Nov 18, 2026). Every assignment sits under an opportunity.
  An older huddle's assignments that weren't tied to one, and a carried-forward assignment whose opportunity is
  gone, go under an opportunity named "Other assignments". A carried-forward assignment goes back under its own
  opportunity when that is still listed.
- The user decided opportunities carry no source line (Nov 18, 2026); the Tips sheet keeps its own.
- **The row** on the Huddle screen names what's coming up: "Christmas sacrament meeting · 1 needs an assignment"
  ("each has an assignment" when done; "Ward council hasn't listed any yet" when empty). **In Ward council there is
  no warning**, since the huddle makes the assignments: its row lists the opportunities with their dates
  ("Christmas sacrament meeting (Dec 20)", or "None listed yet"), and each opportunity's row shows only its date.
- **Swipe an opportunity left** to show **Remove**. It asks first, and its assignments go with it.
- **Next week** the assignments come back in Return and Report with the opportunity named ("Each family invites
  one friend (Christmas sacrament meeting)"). **An opportunity stays until its date passes.** An older huddle's
  typed opportunities become one card.

### How can we help?

Questions to talk through, for the person conducting who is not sure what to ask. The link is in
Ward council: under New members, Returning members and Those being taught in the Covenant Path Report.
Opportunities to invite no longer has it (the user took it off, Nov 18, 2026). It is not in Before ward council
or on a person's screen.

Tapping it slides up a panel with that section's questions and no others:

| Link under | The panel's heading | Questions |
| --- | --- | --- |
| New members | How can we help those who were recently baptized? | 6 |
| Returning members | How can we help returning members? | 4 |
| Those being taught | How can we help those being taught? | 3 |
| Opportunities to invite | How can we find more people to teach? | 2 |

The headings and questions are the "possible discussion items" in *Preach My Gospel*, chapter 13
("Participate in the Weekly Coordination Meeting"), word for word. Each card holds one item; when an item asks several questions, each
question sits on its own line with a thin line between, still in the manual's words. Under them is the line
"From *Preach My Gospel*, chapter 13", a link to the chapter in the Gospel Library.

The panel closes with one tap: the **X** at its top right, or a tap outside it (a swipe down and
Escape work too). There is nothing to type and nothing is saved. The questions are never on the
PDF, in a handoff or in an assignment text.

### Missionary Referrals

Removed. Ward council, the Huddle and the PDF no longer have referrals. A huddle, PDF or handoff saved with
referrals still loads; they are kept in its data but not shown.

## Send

1. Requires a ward name and something to send.
2. Requires the after-huddle box to be marked done.
3. **Ready to send?** lists anything still open (attendance, unmarked report-backs, focus names with
   no action item, no opportunities listed). Covenant Path Report names are not counted: action items are planned
   for focus names only. Each line jumps to that spot. **Send anyway** continues.
4. The Send screen shows the file name, **Dated {day} · Change date**, who to send to (including
   yourself, so you keep a copy), and the share rule: "Only share via email or text message. Do not share through any other app."
5. **Share PDF** opens the phone's share menu. On a computer the PDF downloads instead.

The PDF goes to the bishop-approved list, the stake presidency and the full-time missionaries.

### What sending does

- One copy of the sent huddle is kept on the phone for **Share again**. It is replaced at the next
  send, removed after 5 weeks, and removed by Erase everything.
- Every action item moves into Return and Report for the next huddle.
- Names, next ordinances, huddle notes and the checklist stay. Baptism dates, temple and commitment stay.
  **What will help clears** (it is ward council's choice for the week; the user decided, Nov 18, 2026).
- Upcoming opportunities stay until their date passes.
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

- **A leader who filled in hands the huddle back.** After sending the PDF (which finishes that
  huddle and sets up the next one), they tap **Hand off**, then **Send a handoff**, and text it to
  whoever conducts next week. That leader then has the next huddle, with the last assignments in
  Return and Report. The Hand off sheet and Help & training both say this.
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
  visit). **Not now** closes the page and loads nothing. On a first visit, Help & training and the guide
  wait until the next visit so nothing covers this page.
- **Load from a PDF** (Help & training → Settings) reads the data embedded in a sent PDF
  and sets up the next huddle from it, the same way sending does. It restores a phone that lost its
  data, and it is the fallback if a leader who filled in did not hand the huddle back.
- Both ask first and can be undone right after.

## Help built into the app

- **Help & training** (the button at the top of the opening screen) is a short list, not a page of text. Its
  title and **Close** stay at the top while it scrolls (swiping down closes it too). It has
  five groups of rows, in this order (no confidential banner: Ward council and the Huddle carry it next to
  their Needs and notes boxes, and Privacy and security says it here):
  - **Start here:** Add Huddle to your Home Screen ("Do this once, before you start", or "Already done on
    this phone" when the app is running from the Home Screen); Step-by-step guide ("Read through at your own pace"; the training slides); and See a sample huddle report. None has a step
    number, because they are not part of the week. (The ward is set from the opening screen's header.)
  - **Every week:** Before ward council, Ward council, Huddle, After the huddle (numbered 1 to 4, the four
    steps on the opening screen under the same names), then During the week, marked with a calendar instead
    of a number, like "Week" on the training slides. Each starts with "Tap **Home**, then …".
  - **FAQ:** each a question, most used first: How do I add or remove a name? How do I track baptisms and
    the temple? What if someone else conducts? How do I fix a mistake? How do I share the PDF again? New
    phone? How do I get my names back?
  - **About this app:** Privacy and security ("Everything stays on this phone"). It says that what
    is entered stays on the phone and nothing is saved online; that only what is sent leaves (the
    PDF, an assignment text or a handoff); to protect the PDF (the sharing rule word for word, and
    delete old copies); and never to enter confidential or sensitive information, because everyone
    who gets the PDF can read it.
  - **Settings** (between FAQ and About this app): **Appearance**, three choices: Automatic (follows
    the phone), Light and Dark; the choice is kept on this phone (`huddle-theme`), and `theme.js` applies it
    before the page draws. **Load from a PDF** ("New phone? Choose the last PDF you sent") and **Erase everything and start over** in red ("Clears this phone. The ward name
    stays."). Either closes Help & training first.

  At the end: "Not an official app of The Church of Jesus Christ of Latter-day Saints." and "Made by
  Darren Kirkham · darrenkirkham@mac.com" (an email link).

  **The Step-by-step guide** (the training slides) opens full screen, one at a time: a count ("3 of 33"); five pills showing
    where the slide is in the week (1, 2, 3, 4 and Week: the current one filled in its color, earlier ones pale;
    Send belongs to step 4); a solid band in that color naming the part ("Step 3 · The Huddle", with the section,
    such as "New members", on a small second line); a short title and a few sentences, then a picture of the app with a ring
    around what to tap. **Back** and **Next** at the bottom (or a swipe left or right); nothing moves on by
    itself, and the last slide's button is **Done**. The X closes them. The pictures and words are in
    `media/slides/` (fetched from the website, not kept offline) and are made from the app with
    `node test/tools/slides/make.js`; the words are in `test/tools/slides/scenes.js`.

  **Sources** is the second row under About this app: links to *Preach My Gospel*, chapter 13
  (questions), General Handbook 23.4 (the meeting) and "Ideas for Weekly Missionary Coordination"
  (tips).

  Tapping a step or question opens it in place, and tapping it again closes it. A step is at most
  five short lines that say what to tap; what a screen already explains is left out. The After the
  huddle step carries the sharing rule word for word. Every time Help & training opens it is the short list again,
  scrolled to the top. In a phone's browser the first-time step (Add Huddle to your Home Screen) starts
  open, and Help & training opens by itself on the first visit; from the Home Screen app every step
  starts closed.
- **Tips for an effective meeting** (in the Huddle) and **Tips for finding new people to teach**
  (Tips, in Opportunities to invite) each end their borrowed text with a source line linking to
  "Ideas for Weekly Missionary Coordination" in *Sharing the Gospel: Resources for Leaders*.
  The first says "Adapted from" (five points condensed from the page's eight principles); the
  second says "From" (quoted). The **Prepare ahead** tip is the app's own and sits below the line.
- **No guided tour or practice week** (the user took them out, Nov 18, 2026: the step-by-step guide and Help &
  training cover it, and a practice week's sample report confused a real one). The first time the app is opened from
  the Home Screen, "Welcome to Huddle" offers **Open the guide** (the step-by-step guide) or **Not now**, once. A link
  ending in `#tour` opens the guide. A phone left in a practice week from before gets its own huddle back when the app
  opens; an old practice handoff link says there's nothing to load.
- **The bottom bar** floats on every screen: **Hand off** on the left, a round raised **Home** in the middle and
  **Send** on the right. Home is one tap back to the opening screen; on the opening screen itself it scrolls back to
  the top. The bar steps aside while the keyboard is up, and anything scrolled into view stops above it. On a
  person's screen, **Done** stays just above the bar as you scroll, so Done and Home are both always in reach; every
  list ends with enough room for its last row to clear the bar.


- **Add to Home Screen** banner whenever the app is open in a phone's browser.

## Erase everything and start over

Erases every name, need and assignment and the last sent huddle. The ward name is kept. Asks first.

## Links

| Link ending | What it does |
| --- | --- |
| `#huddle` | Opens straight to the Huddle screen (used by the tests) |
| `#help` | Opens Help & training |
| `#tour` | Opens the step-by-step guide (the tour was taken out) |
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
| Opportunities to invite: starter ideas and ways to invite (short words drawn from "Know the Calendar", "Help Speakers Invite Friends", "Assist the Missionaries" and "Share Activities") | No line on the cards (the user decided, Nov 18, 2026); the Tips sheet beside them names the page | the same page |
| Huddle Attendees: temple and family history invitation | General Handbook 25.2.3 (quoted) | `…/general-handbook/25-temple-and-family-history-work` |
| Help & training: Sources | The two above, and General Handbook 23.4 (who conducts and who is invited) | `…/general-handbook/23-sharing-the-gospel-and-strengthening-new-and-returning-members` |

Not from these sources, and so not cited: the 30-day temple goal, the Who & What / How & When
labels, the Prepare ahead tip, and the three attendee choices General Handbook 23.4 does not list
(High Councilor; the temple and family history leader and consultants are invited per 25.2.3). When adding quoted or adapted text, add its source
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
- **Coming up**, right under the header (the user took out the rest of At a glance, Nov 18, 2026: the last
  huddle's counts and the list of focus names): a baptism date for those being taught, the 30-day temple countdown
  for new members who haven't gone yet, and each upcoming opportunity to invite with its date (it stays until its
  date passes). Nothing is typed for it; it comes from what is already entered. Left out when there's nothing.
- There are no tables and no Who/What/How/When boxes. **Each person is one short block** with a
  hairline under it. Down its left side runs a band in the color of its section with the section's
  name turned sideways in white (RETURN & REPORT in slate; NEW MEMBERS, RETURNING, BEING TAUGHT,
  FOCUS NAME and FINDING in their list's color; a shorter word when the block is short,
  none when even that doesn't fit). So wherever a reader stops scrolling, each name shows where it
  belongs. A block stays together on one page when it fits, and a heading never sits alone at the
  bottom of a page.
- The report has **two parts, each opening with a colored header**: **1 · Looking back · {date}
  huddle — Return and Report** *Did it happen?* in slate, and **2 · Looking ahead · {date} huddle —
  Huddle action plan** *Who, what, how and when* in navy. The headers appear once each; pages don't
  repeat them.
- **Return and Report.** Each block: the name with **Yes**,
  **Partly** or **No** in color at the right ("Not marked" when unanswered), the list the person is
  on, **Action item** with who and when in gray under it, **Notes**, "Carried forward to the
  {date} plan", and **Huddle notes**. An item typed in without a person prints its text in place
  of the name.
- **Huddle action plan:** **Focus names** (with "Name Next Ordinance" beside it) first, then the
  **Covenant Path Report Review** "For reference" (a tinted label for each list: new members,
  returning members, those being taught), whose blocks have no action item line unless one was typed.
  Each block: the name; one colored
  line with the temple status (new members), "Committed · {date}" or "Scheduled: {date}" (those
  being taught) and a green tick with "Attended sacrament meeting"; then **Next ordinance**,
  **What will help**, **Done this week** (focus names only: checklist items checked since step 1, from their
  Covenant Path Report name; the checklist itself isn't printed), **Action item** (who and when in gray, "Carried forward from {date}" in italics; "None
  yet" when there is no action item) and **Huddle notes**. Empty parts are left out. An empty list
  prints "No one on the Covenant Path Report this week" when confirmed, otherwise "Not reviewed".
- **Opportunities to invite** *Huddle action plan*: each opportunity as a block (its name, its **Event date**, or
  "No assignments yet"), its assignments under it with their when, then assignments not tied to an event.
  "None this week" when there is nothing. There is no Missionary Referrals section.
- Every page ends with the ward, the date and, when there is more than one page, "Page 1 of 3".

The sample agenda in Help & training (`sample/page-1.png` to `page-4.png`) is this PDF made from a
made-up huddle. Remake it with `node test/tools/make-sample.js` whenever the PDF's look changes.

A copy of the huddle's data is stored inside the PDF (the `HuddleData` entry of its information
dictionary; app id `huddle-agenda`, version 1). **Load from a PDF** reads it back. Keep this
format readable by future versions. `referrals` was added later as an optional list; a PDF or
handoff link without it loads with no referrals (referrals are no longer shown, but are kept). `find.opps`
(each `{id, title, date}`) and an assignment's `opp` were added later too; without them, typed opportunities
(`find.plan`) become one card. `tn` may hold more than three names; `stepsDone.sa` is Sacrament attendance.


## Changes on Nov 19, 2026 (the user asked)

- **iPhone and iPad Safari show only the way to the Home Screen app.** What's typed in Safari is kept apart from the
  Home Screen app, so a full screen says "Open Huddle from your Home Screen" with the Add to Home Screen steps (the
  ··· or Share button, Add to Home Screen, Add) and "Already added? Close Safari and tap the Huddle icon", and a
  gold arrow bobs toward the button that opens Share: on iOS 26 the ≡ at the left of the address bar (just past Back),
  on iOS 18 and earlier Share in the middle of the bottom toolbar, otherwise bottom right; top right on iPad. Step 1 shows all three
  buttons (≡, ••• and Share) and says to tap whichever the arrow points to. Nothing else of the app shows.
  A handoff link still opens its page in Safari, and "Use it in Safari this once" lets that visit run in Safari.
  Android and computers are not blocked. (Tests turn the screen on with the `huddle-gate-test` flag; it is off while
  a test browser runs.)
- **"Ward Council"** is capitalized in its screen's title and header card.
- **No Add a name in Ward Council's Covenant Path Report lists** (names come in during Before ward council), and the
  Huddle's Focus names shows only named focus names (no empty spots to add one).
- **New members' checklist adds Aaronic Priesthood ordination**, after Meet with the bishop, with Doesn't apply. A
  new member who has done baptisms for the dead gets Priesthood advancement suggested while it's open.
- **What will help is out of Ward Council** (every name, the Covenant Path Report lists and focus names). Ward Council
  chooses the name and next ordinance; the Huddle chooses the step. Under the Huddle's **Action item**, chips offer
  **Still open on their Covenant Path Report** (the person's unchecked items, found by name) and **Ideas for {next
  ordinance}** (now including a ride to church, sitting with them in sacrament meeting, an invitation to a ward
  activity, going with them to the temple, and so on). A tap fills the action item and moves to Assigned to; typing
  hides them. One action item per person. A What will help saved before stays on the PDF and in Return and Report.
- **The PDF prints "Next steps"** for each person in the Covenant Path Report Review: their unchecked checklist items
  in two columns, each with an empty box before it (☐ A calling), so ward council can see and tick off what each
  person still needs.

## Changes on Nov 19, 2026, evening: a plainer week (the user asked)

- **Ward Council's Opportunities to invite** has one button pinned at the bottom: **Done** when events are listed,
  **No upcoming events** when there are none. Either one checks off its card and goes back to Ward Council; adding an
  event no longer checks it off by itself. A small **Mark as not done** link under it undoes it. (`find.done`,
  `find.none` in the saved huddle.)
- **Find your focus names** carries its own check, by its heading, with "Done once you choose a focus name." under
  it. The Covenant Path Report row in the box has no check of its own, so no one looks for one on Part-Member Families.
- **A name's Ward Council screen** is plain: Make focus name (with why it's suggested), the baptism date as a line
  ("Baptized: Nov 8"), the next ordinance with its suggestion, and a closed list, "4 next steps on their Covenant Path
  Report". Tapping it opens the person's unchecked items with checkboxes; checking one marks it done on their report
  (the same check as Before Ward Council) and keeps it in view until the screen closes. There is no "Ward Council ·
  Who & What" label, no Huddle box and no last huddle's assignment: return and report comes after ward council, so it
  would almost always say Pending. A focus name not on the report has no list.
- **The Huddle's Mark done waits for what's needed.** Focus names: gray, saying "Marcus Bell needs an assignment"
  (or "2 focus names need an assignment") until every focus name has an assignment, who and when; tapping it opens
  the first one missing. Opportunities to invite: gray, "Plan at least one assignment", until an event has an
  assignment (tapping it opens the first event); with no events it says **No upcoming events** and works.
- **Mark done goes straight to the next section** not yet done. After the last one, the opening screen shows with
  "Step 3 done. Next: After the huddle."
- **A focus name's Huddle screen** shows ward council's part as one line, "Next ordinance: Endowment", with an **i**:
  "Chosen in Ward Council. To change it, open this name in Ward Council." (No box, label or Edit.)
- **After the huddle:** each changed name has an **Updated in the report** checkbox. Mark done is gray ("1 person to
  update"; tapping it scrolls to who's left) until all are ticked, and works right away when nothing changed. The ticks
  are saved (`afterUpd`) and a new week starts without them.
- **The little i.** Each step's header card keeps its one line of instructions behind an **i** beside the ward name:
  open the first time that step opens on the phone, tucked away after that. The same goes for Before Ward Council's
  note under its list and Opportunities to invite's "Ward activities, special meetings and other events to invite
  friends to." New ones explain the temple countdown (where a new member is suggested, and under baptisms for the dead
  in Before Ward Council) and **Changed** in After the huddle.
- **The opening screen** shows "Huddle", the ward and the date first; "One by One · “Joyfully gathering Israel one
  by one in Christ”" is a small line under them. In a new week step 1 says **Start here**. Finishing step 1, 3 or 4
  shows "Step 1 done. Next: Ward Council." (and so on); Ward Council finishing on its own screen says "Step 2 done.
  Next: Huddle." with a Home button. After sending: "Sent. Next week starts with Before Ward Council." and Done goes
  to the opening screen.
- **Hand off** left the bottom bar (now Home and Send). It is a line under the four steps, "Someone else conducting?
  Hand off", and Help's "What if someone else conducts?" has the steps and a **Hand off now** link.
- **The first time from the Home Screen** the ward name is asked first ("Welcome! What’s your ward?"); the welcome
  offering the step-by-step guide follows.
- **The first list that can be swiped** shows "← Swipe a name left to remove it." with **Got it**, once per phone.
- **Words:** assignment (not action item), huddle report (not agenda or PDF), Focus names and Covenant Path Report
  in the huddle report too (no "Name Next Ordinance" or "Review"), "This week's plan", "plan at least one assignment",
  Next steps, Ward Council and Before Ward Council as step names, "Invite" as the huddle report's side label for
  opportunities, and **Send the huddle report** on the send panel's button.


## Changes on Nov 19, 2026, later evening: one clean look, and Ward Council asks (the user asked)

- **One look for every list of names.** Ward Council's Covenant Path Report, Before Ward Council's lists, the Huddle's
  Sacrament attendance and Focus names (and Opportunities to invite's list) are each one plain white card: a small
  heading inside (a dot in the list's color, its name and count), then the rows. Return and Report's cards are plain
  white too (no colored left edge or kicker). Each name shows **one tag at most** (Not updated in 4 weeks, ★ Focus
  name or Suggested focus name, in that order); the temple countdown ("Temple: 19 days left", in red), a baptism
  date, an appointment and "✓ Sacrament" go into the gray line under the name.
- **Ward Council, in order:** Opportunities to invite; **Ask ward council** ("Has anyone completed a step on their
  Covenant Path this week?"); **Find your focus names** (a tool box: the Covenant Path Report and Open Part-Member
  Families, with no check of its own); **Focus names**. Up next moves through the three cards with checks.
- **Ask ward council** opens the Covenant Path Report's lists, with the question at the top (its **i**: "Before Ward
  Council matches the report in Member Tools. This is for what people in ward council know that the report doesn't
  show yet.") and a quiet link to open the report (no big button: that's step 1's job). Tapping a name opens its next
  steps, open to check off, and Make focus name. The button at the bottom says **No changes this week**, or **Done**
  once a step was checked off in Ward Council; either checks the card and goes back. (`ask.done`, `ask.changed`.)
- **The next ordinance is chosen only for focus names.** It is gone from every Covenant Path Report screen and row
  (Before Ward Council, Ward Council and the Huddle), whose gray line now says how far along the report is ("2 of 11
  done"), and from those people's blocks in the huddle report. The Huddle's screen for a focus name still shows it.
- **Focus names starts unchecked each week.** Its button: gray "Marcus Bell needs a next ordinance" (tapping opens
  him) until every focus name has one, then **Keep these focus names**. Making, adding or removing a focus name counts
  as keeping them. (`tnKept`.)
- **A next ordinance that's done:** when the Covenant Path Report shows a focus name's next ordinance done (checked
  off in Before Ward Council or Ward Council: baptisms for the dead, priesthood advancement, endowment, sealing,
  sacrament), the row says "Endowment is done" with **Choose the next ordinance**, their screen says "Endowment is
  done. Choose the next one.", and the card isn't done until a new one is chosen. Sending never changes it.
- **Words:** Before Ward Council says **Match Member Tools** (step 1's line, its instructions and Help), so it reads
  as copying the official report, and Ask ward council as asking people.
- An event's own screen keeps its fields in a white block, like a person's screen.

## Changes on Nov 19, 2026, night: a lighter Huddle and a focus name picker (the user asked)

- **Find your focus names → Covenant Path Report** opens a picker of its own, titled "Find your focus names": the three
  lists with each name, a **Suggested focus name** tag with its reason in red ("Temple: 3 days left", a baptism date),
  and **Add to focus names** on the right (it wraps under the name on a small phone). Once added the row says
  "✓ Focus name". Nothing else: the Ask ward council question and the report link stay on Ask ward council's screen.
- **One big button per screen.** The "Next: …" button and "‹ …" link under Mark done are gone (Mark done already moves
  on). When something is still needed, Mark done is gray with a plain gray line above it ("Plan at least one
  assignment first."); tapping it still opens what's missing.
- **The Huddle's Opportunities to invite:** "+ Add an event" is a small link under the events, and each event's
  **Add an assignment** row is tinted so it stands out.
- **Up next in the Huddle:** Huddle Attendees, then Return and Report, Sacrament attendance, Opportunities to invite
  and Focus names. The first not done is highlighted (Attendees outlined with an Up next tag; a section row tinted
  with an Up next pill). Attendees' **Done** goes straight on to the next section once attendance is taken.

## Changes on Nov 19, 2026, late night (the user asked)

- **Gray buttons explain themselves** instead of jumping somewhere: Focus names' Mark done in the Huddle shows "Marcus
  Bell needs an assignment first" with OK; After the huddle's shows "Update the report first"; Keep these focus names
  shows "Choose a next ordinance first" with who still needs one.
- **The Huddle's Opportunities to invite can always be marked done.** With no events it asks "No upcoming events?";
  with events but no assignment, "Mark done without an assignment?" (Mark done or Cancel).
- **Done never jumps ahead.** Mark done in the Huddle, and Attendees' Done, go back to the Huddle's list (Up next shows
  what's next); after the last section the message says "Step 3 done. Next: After the huddle."
- **Focus names and suggested names** have a thin bar down the row's left edge and one line of words instead of a
  pill: gold "★ Focus name", red "Suggested focus name · Temple: 3 days left". The same everywhere names are listed
  (Before Ward Council, Ask ward council, the picker, the Huddle).
- **Find your focus names moved into the Focus names card:** under its heading, "Find names in" with two small buttons,
  **Covenant Path Report** (the Add to focus names picker) and **Part-Member Families**. Ward Council has three cards,
  each with its own check; the Focus names check sits by its heading.
- **Ask ward council's lists open in place:** tapping a name opens what's still open on their report, with
  checkboxes, right in the list ("3 steps open" in the gray line, an arrow that turns). One name open at a time.
  The question ends "Tap a name to see what's still open."
- **Before Ward Council's lists open in place too,** showing every step (to fix a mistake either way) and **Edit
  details ›**, which opens the person's full screen (name, dates, remove). Add a name still opens a new screen.

## Step-by-step guide wording (Nov 20, 2026)

- The guide speaks to the person using the app: what to tap and why. It leaves out how the app works inside.
- 29 slides (was 34). Focus names has three: Find your focus names (Covenant Path Report and Part-Member Families), Watch for suggested names (the red bar, Add to focus names) and Keep these focus names. Merged or dropped: the second check-off slide, Who and what, How and when, One person at a time,
  A plan for every focus name, Up next: After the huddle, the second Mark it done, and All four steps done.
- It still carries "Never add confidential information to this huddle report." and the sharing rule word for word.
- During the week ends with "Help each person take their next step": a person's checklist beside a sample huddle report page
  (make.js draws two screens side by side when a scene has `pair`). Ward council members work with their presidencies
  and tell the ward mission leader at ward council what happened.
- The last slide (no confidential line under it; slide 20 carries it): "We are joyfully gathering Israel one by one in Christ. Every name here is someone the Lord knows and loves.
  Thank you for helping each one take their next step on the covenant path."

## Huddle report: a note to ward council organizations (Nov 20, 2026)

- Under the PDF's "Covenant Path Report · For reference" heading, a light blue box: "Ward council organizations: As you help
  the people on this list take their next steps, please let the ward mission leader know so he can mark them off on the
  Covenant Path Report and keep our efforts aligned." (`WC_NOTE` in app.js; `test/checklist.js` checks it.)
- Nov 20, 2026, later: the guide is now an overview in 10 slides (the user's limit): title, one slide per step (two for
  Ward Council, two for the Huddle), Send, During the week, and the closing message. Each says what the step is for,
  not every tap. `test/help.js` checks there are ten at most.

## Baptism date: Huddle's own calendar (Nov 20, 2026)

- Tapping a baptism date (new members; those being taught) opens a sheet titled with the field's name ("Baptism date"),
  with a month calendar (‹ ›, today ringed, the picked day filled), the day picked written under it, and **Apply**,
  **Clear** and **Cancel**. Nothing is saved until Apply; Clear empties the date; Cancel and tapping outside leave it.
  (The phone's own date picker filled in today's date just from opening it.) `test/bapdate.js` covers it.
- The other date boxes (When, Event date, Next appointment) still use the phone's picker.
