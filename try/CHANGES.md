# Test copy: what's different from the live app

On Nov 18, 2026 everything tried here before then moved to the live app.

## Being tried now (Nov 18, 2026)

The full change is on the branch `checklist`, with the live files, tests, slides and docs already updated.
Moving it to the live app is a merge of that branch into `main` plus a `CACHE` bump in `sw.js`.

- **The Covenant Path Report checklist.** Before ward council mirrors the report: each person has their group's
  checklist (new members 9 items, returning members 11, those being taught 4), and a check means done. "If
  applicable" items have Doesn't apply. A new member's "Performed baptisms for the dead" is the temple check, red
  with the 30-day countdown. Next ordinance, needs and sacrament attendance are no longer on Before ward
  council's person screen; its row says "3 of 9 done".
- **What will help** replaces Needs everywhere (app, PDF, Return and Report). Under it, ward council sees
  "Still open on their Covenant Path Report": the person's unchecked items as chips (a focus name finds them by
  name; a name not on the report gets none). An empty Next ordinance offers "Suggested: …" from the checklist.
- **The Huddle:** no Attended sacrament box on a focus name.
- **After the huddle** lists only the people who changed since step 1, and only what goes into the report
  (sacrament, baptisms for the dead, baptism date, appointment, checklist items).
- **PDF:** "Done this week" under a focus name (items checked since step 1); the checklist itself isn't printed.
- **Texts** end "Please report back before Sunday, Nov 22. Thank you!" (the coming Sunday).
- **Header lines:** Before ward council, Ward council, the Huddle and After the huddle each have new wording.
- **Opportunities to invite** has no How can we help? (Tips stays).
- The training slides for the test copy still come from the live app's `media/slides`, so they show the live
  app until this moves over.
