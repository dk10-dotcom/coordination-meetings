# Test copy: what's different from the live app

Everything here is in `try/` only. When it's ready, these all move to the live app together.

## Focus names filter the huddle
1. **Suggested focus names.** In Before ward council and Ward council, these Covenant Path names get a red
   "Suggested focus name" tag, and their screen says why:
   - every new member who hasn't been to the temple yet ("Temple: 9 days left", or "Not yet to the temple" with no baptism date);
   - anyone being taught with an upcoming baptism date or an upcoming appointment with the missionaries.
   Returning members are never suggested; ward council can still choose them.
2. **Make focus name.** On a Covenant Path name's Ward council screen. Fills an open spot, or adds one past three.
   Their next ordinance and needs come along. An action item already on their card moves with them.
3. **Swipe left to remove a focus name**, in Ward council and the Huddle. Tap **Remove**; **Undo** in the message
   brings it back. They stay on the Covenant Path Report.
4. **Carry forward** in Return and Report brings an unfinished assignment back as a focus name.

## The Huddle screen
5. No heading over **Return and Report** and **Sacrament attendance** ("From the last huddle" is gone).
6. **Sacrament attendance** is its own row: everyone once (Covenant Path names, then focus names not on the
   report), one tap each. Marking someone marks their focus name card too.
7. **Huddle action plan** heading over **Focus names** and **Find New People to Teach**.
8. The Huddle's **Covenant Path Report** row is gone (its names are in Sacrament attendance, and their
   assignments come back in Return and Report).
9. **Missionary Referrals** is gone everywhere: the Huddle, Ward council and the PDF. Older huddles that have
   referrals still load; the referrals just don't show.

## Ward council
10. **Open the Covenant Path Report** button at the top of Ward council's Covenant Path Report list.

## Upcoming opportunities
11. In **Find New People to Teach**, ward council taps **Add an upcoming opportunity**: what's coming up and its
    date (for example, Christmas sacrament meeting, Dec 20). In the huddle, **Add an assignment** sits under
    each one. **Other assignments** holds the ones not tied to an event.
12. Next week, the assignments come back in Return and Report with the opportunity named
    ("Each family invites one friend (Christmas sacrament meeting)"). The card stays until its date passes.
    An older huddle's typed opportunities become one card.

## The PDF
13. Focus names come first in the Huddle action plan; the Covenant Path Report Review follows, "For reference",
    with no action item lines. At a glance lists the focus names with their action items.
14. Each opportunity prints with its date and its assignments under it. No Missionary Referrals.

## Also changed for the test copy
- Its own name (Huddle Test), red TEST band on the icon, "Test version" on the opening screen.
- Its own storage (`huddletest-…`) and offline cache (`huddle-test-vN`).
- Help & training and the guided tour follow the new flow.

Covered by `test/try-focus.js`.
