// The step-by-step guide's slides, in order: which screen, what it says, and how long it stays (seconds).
// kicker colors follow the step: 1 slate, 2 blue, 3 orange, 4 plum.
// An overview (the user decided, Nov 20, 2026): ten slides at most, what each step is for, main points only,
// nothing said twice, for the person using the app (not how the app works).
module.exports = [
  { shot: 's02-start-step1', kind: 'title', title: 'Huddle', sub: '', body: 'Each week follows four steps. Up next shows where you are, and the (i) on any step says what to do there.', t: 8 },
  { shot: 's04-bw-list', k: 'Step 1 · Before Ward Council', c: 'slate', title: 'Start with the report', body: 'Bring your lists up to date with the Covenant Path Report in Member Tools. Names with a red bar are suggested focus names.', t: 8 },
  { shot: 's10-wc-person', k: 'Step 2 · Ward Council', c: 'blue', title: 'Counsel together', body: 'Plan for upcoming events, and counsel together about steps people on the Covenant Path Report took this week.', t: 8 },
  { shot: 's12p-wc-pick', k: 'Step 2 · Focus names', c: 'blue', title: 'Choose your focus names', body: 'Use the Covenant Path Report and the Part-Member Families report to help identify focus names. Names with a red bar are suggested.', t: 8 },
  { shot: 's14-huddle', k: 'Step 3 · The Huddle', c: 'orange', title: 'A brief, focused huddle', body: 'Report back on last week, note who came to sacrament meeting, and plan for upcoming opportunities to invite.', t: 8 },
  { shot: 's20-person-action', k: 'Step 3 · Focus names', c: 'orange', title: 'One assignment for each name', body: 'Decide what we’ll do this week to help each focus name, who will do it and when, and text them the assignment. Never add confidential information to this huddle report.', t: 10 },
  { shot: 's27-after', k: 'Step 4 · After the huddle', c: 'plum', title: 'Update the report', body: 'This shows the changes from the day. Update those names in the Covenant Path Report.', t: 7 },
  { shot: 's30-send', k: 'Send', c: 'red', title: 'Send the huddle report', body: 'Send it to the bishop-approved list, the stake presidency and the full-time missionaries, and include yourself. Only share via email or text message. Do not share through any other app.', t: 10 },
  { shot: 's05-bw-person', pair: ['s05-bw-person', 'sample/page-2.png'], k: 'During the week', c: 'teal', title: 'Help each person take their next step', body: 'Ward council members and their organizations, along with the huddle, help each person take their next step. Then let the ward mission leader know so he can mark it on the Covenant Path Report. Tap Assignments to follow up during the week.', t: 9 },
  { shot: 's01-start', kind: 'end', title: 'One by one', sub: '', body: 'We are joyfully gathering Israel one by one in Christ. Every name here is someone the Lord knows and loves. Thank you for helping each one take their next step on the covenant path.', t: 9 }
];
