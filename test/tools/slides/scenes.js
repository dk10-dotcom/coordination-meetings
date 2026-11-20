// The step-by-step guide's slides, in order: which screen, what it says, and how long it stays (seconds).
// kicker colors follow the step: 1 slate, 2 blue, 3 orange, 4 plum.
// Wording (Nov 20, 2026): say what to tap and why, for the person using the app; leave out how the app works.
module.exports = [
  { shot: 's01-start', kind: 'title', title: 'Huddle', sub: 'Your weekly missionary coordination meeting', body: 'Help each person take their next step on the covenant path. Here’s how to use Huddle each week.', t: 8 },
  { shot: 's02-start-step1', k: 'The opening screen', c: 'slate', title: 'Four steps each week', body: '1. Before Ward Council\n2. Ward Council\n3. The Huddle\n4. After the huddle\nUp next shows where you are. Tap the i on any step for help.', t: 8 },
  { shot: 's03-bw', k: 'Step 1 · Before Ward Council', c: 'slate', title: 'Match Member Tools', body: 'Open the Covenant Path Report in Member Tools. Add or remove names here so your lists match it.', t: 7 },
  { shot: 's04-bw-list', k: 'Step 1 · Before Ward Council', c: 'slate', title: 'Tap each name', body: 'Check off the steps the report shows are done. Tap Edit details to change dates.', t: 7 },
  { shot: 's06-bw-done', k: 'Step 1 · Before Ward Council', c: 'slate', title: 'Mark it done', body: 'When your lists match the report, tap Mark done.', t: 5 },
  { shot: 's08-wc', k: 'Step 2 · Ward Council', c: 'blue', title: 'Counsel together', body: 'Work through the three cards with the council. Up next shows which card is next.', t: 6 },
  { shot: 's12b-wc-opp', k: 'Step 2 · Opportunities to invite', c: 'blue', title: 'What’s coming up', body: 'Add each upcoming event and its date, then tap Done. No events? Tap No upcoming events.', t: 7 },
  { shot: 's09-wc-cp', k: 'Step 2 · Ask ward council', c: 'blue', title: 'What has anyone heard?', body: 'Ask the council whether anyone has taken a step on the covenant path this week.', t: 6 },
  { shot: 's18-howhelp', k: 'Step 2 · How can we help?', c: 'blue', title: 'Questions to guide you', body: 'Tap How can we help? for questions from Preach My Gospel, chapter 13.', t: 6 },
  { shot: 's10-wc-person', k: 'Step 2 · Ask ward council', c: 'blue', title: 'Check off what’s done', body: 'Tap a name to see its open steps and check off what the council knows. Then tap Done, or No changes this week.', t: 8 },
  { shot: 's11-wc-focus-person', k: 'Step 2 · Focus names', c: 'blue', title: 'Choose a next ordinance', body: 'Tap each focus name and choose its next ordinance. Not sure? Tap Suggested.', t: 7 },
  { shot: 's12-wc-done', k: 'Step 2 · Focus names', c: 'blue', title: 'Keep these focus names', body: 'Review your focus names each week. To add one, tap Covenant Path Report under Focus names. Then tap Keep these focus names.', t: 8 },
  { shot: 's14-huddle', k: 'Step 3 · The Huddle', c: 'orange', title: 'Brief and about people', body: 'Work through Return and Report, Sacrament attendance, Opportunities to invite and Focus names.', t: 7 },
  { shot: 's15-attendance', k: 'Step 3 · The Huddle', c: 'orange', title: 'Who came', body: 'Tap everyone at the huddle. Make an extra effort to involve the youth.', t: 6 },
  { shot: 's16-rr', k: 'Step 3 · Return and Report', c: 'orange', title: 'Did it happen?', body: 'For each of last week’s assignments, tap Yes, Partly or No and add a short note.', t: 7 },
  { shot: 's17-sa', k: 'Step 3 · Sacrament attendance', c: 'orange', title: 'One tap each', body: 'Tap each person who came to sacrament meeting.', t: 5 },
  { shot: 's24-fn', k: 'Step 3 · Opportunities to invite', c: 'orange', title: 'Love, share, invite', body: 'Tap an opportunity, add an assignment and a way to invite, then who and when.', t: 7 },
  { shot: 's20-person-action', k: 'Step 3 · Focus names', c: 'orange', title: 'One assignment each', body: 'Tap each focus name. What will we do this week to help them toward their next ordinance? Pick an idea or type your own, then who and when.', t: 9 },
  { shot: 's22-person-text', k: 'Step 3 · Before everyone leaves', c: 'orange', title: 'Text each assignment', body: 'Text it to the person helping, so they know what, for whom and when.', t: 6 },
  { shot: 's21-hd-note', k: 'Step 3 · Focus names', c: 'red', title: 'Keep notes simple', body: 'Never add confidential information to this huddle report. Everyone who receives it can read it. Keep notes to names, ordinances and simple needs.', t: 8 },
  { shot: 's25-huddle-all', k: 'Step 3 · The Huddle', c: 'orange', title: 'Mark each section done', body: 'Tap Mark done as you finish each section. Up next takes you through them in order.', t: 6 },
  { shot: 's27-after', k: 'Step 4 · After the huddle', c: 'plum', title: 'Update the Covenant Path Report', body: 'Only the names that changed are listed. Update each one in Member Tools, tick Updated in the report, then tap Mark done.', t: 8 },
  { shot: 's30-send', k: 'Send', c: 'red', title: 'Send the huddle report', body: 'Tap Send. Share it with the bishop-approved list, the stake presidency and the full-time missionaries, and include yourself. Only share via email or text message. Do not share through any other app.', t: 10 },
  { shot: 's31-sent', k: 'Send', c: 'green', title: 'Sent', body: 'Next week starts again with Before Ward Council. This week’s assignments will be waiting in Return and Report.', t: 7 },
  { shot: 's32-next-week-rr', k: 'During the week', c: 'teal', title: 'Follow up', body: 'As people report back, mark each assignment Yes, Partly or No, and offer help where it’s needed.', t: 7 },
  { shot: 's01-start', kind: 'end', title: 'One by one', sub: '', body: 'Helping each person take the next step on the covenant path, together as a ward.', t: 7 }
];
