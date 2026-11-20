/* Huddle: the One by One app (the weekly coordination meeting agenda)
 * Everything runs on the device. Nothing is sent to a server.
 * - The agenda on this phone (localStorage) is always the next huddle. Send shares the PDF and closes
 *   the huddle: its actions move into Return and Report for the next one, names and needs stay, and one
 *   copy of the sent huddle is kept so it can be shared again (replaced at the next send).
 *   Names not touched in 5 weeks are removed.
 * - The ward name is remembered on this device (localStorage) for convenience.
 * - Send builds a flattened PDF with pdf-lib and hands it to the phone's share menu.
 *   A copy of the form data is tucked into the PDF so "Load from a PDF" can set up the next huddle from it.
 */
'use strict';
(function () {
  var APP_ID = 'huddle-agenda';
  var DATA_VERSION = 1;
  var DRAFT_KEY = 'huddle-draft-v1', LIVE_KEY = 'huddle-agenda-v1';
  var LAST_SENT_KEY = 'huddle-last-sent';
  var STALE_FLAG = 28, STALE_DROP = 35; // days: ask after 4 weeks untouched, remove after 5
  var WARD_KEY = 'huddle-ward';
  var DOC_TITLE = 'Weekly Huddle Report';
  var MAX_AGE_DAYS = 14;

  var ATTENDEES = [
    { id: 'pqa', label: 'Priests quorum assistant', youth: true },
    { id: 'gol', label: 'Gatherers of Light rep', youth: true },
    { id: 'rs', label: 'Relief Society' },
    { id: 'eq', label: 'Elders Quorum' },
    { id: 'pp', label: 'Primary presidency' },
    { id: 'wm', label: 'Ward missionaries' },
    { id: 'ftm', label: 'Full-time missionaries' },
    { id: 'wml', label: 'Ward mission leader' },
    { id: 'tfhl', label: 'TFH leader' },
    { id: 'tfhc', label: 'TFH consultants' },
    { id: 'hc', label: 'High Councilor' }
  ];
  var GROUPS = [
    { id: 'nm', title: 'New members' },
    { id: 'rm', title: 'Returning members' },
    { id: 'bt', title: 'Those being taught' }
  ];
  var SOURCE = { nm: 'New members', rm: 'Returning members', bt: 'Those being taught', tn: 'Focus names', fn: 'Opportunities to invite' };
  /* "How can we help?": the discussion items Preach My Gospel, chapter 13 suggests for the weekly coordination
   * meeting ("Participate in the Weekly Coordination Meeting"), one set per section, in the manual's words.
   * They open on request in the Huddle and in ward council. Nothing is typed or saved, and none of it goes on the PDF. */
  var HOW_HELP = {
    nm: { list: 'New members', title: 'How can we help those who were recently baptized?', items: [
      'Which new members in their first year of membership are attending sacrament meeting? How can we help any who are not attending?',
      'Which new members have friends in the ward? How can ministering brothers and sisters help? How can youth quorums and classes help?',
      'Which new members have an assignment or calling?',
      'How can we help new members begin researching their deceased ancestors so temple ordinances can be performed for them? Do new members have a temple recommend? If a temple is nearby, how can we help them go to the temple to perform baptisms for these ancestors?',
      'Which lessons from chapter 3 still need to be taught again? How can members participate?',
      'Review My Covenant Path progress for each new member.'] },
    rm: { list: 'Returning members', title: 'How can we help returning members?', items: [
      'Which part-member families can the missionaries visit and teach?',
      'Which returning members can the missionaries visit and teach?',
      'Which returning members have friends in the ward and appropriate opportunities to serve?',
      'How can we help these members?'] },
    bt: { list: 'Those being taught', title: 'How can we help those being taught?', items: [
      'Which members could participate in the lessons this coming week? Who will invite them to participate?',
      'What are the challenges for those being taught? How can members help?',
      'What are the needs for those with a scheduled baptismal date? Has the baptism been planned?'] },
    fn: { list: 'Opportunities to invite', title: 'How can we find more people to teach?', items: [
      'How can we help individuals, including youth, and families apply the principles of love, share, and invite?',
      'How can we help members, including Primary leaders, invite friends to ward activities?'] }
  };
  // On screen the three focus names are always called Focus names; SOURCE is what is saved and what the PDF prints.
  function listName(gid) { return gid === 'tn' ? 'Focus names' : SOURCE[gid]; }

  /* ---------- small utilities ---------- */
  function $(sel) { return document.querySelector(sel); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function longDate(s) {
    var d = parseISO(s);
    return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  }
  function shortDate(s) {
    var d = parseISO(s);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }
  function daysBetween(a, b) {
    var da = parseISO(a), db = parseISO(b);
    return da && db ? Math.round((db - da) / 86400000) : null;
  }
  function str(v) { return v == null ? '' : String(v); }
  function norm(s) { return str(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function getStore(kind) { try { return window[kind] || null; } catch (e) { return null; } }
  function readJSON(kind, key) {
    try { var s = getStore(kind); var v = s && s.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJSON(kind, key, val) { try { var s = getStore(kind); if (s) s.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } }
  function removeKey(kind, key) { try { var s = getStore(kind); if (s) s.removeItem(key); } catch (e) { /* ignore */ } }
  function readWard() { try { var s = getStore('localStorage'); return (s && s.getItem(WARD_KEY)) || ''; } catch (e) { return ''; } }
  function writeWard(w) { try { var s = getStore('localStorage'); if (s && w) s.setItem(WARD_KEY, w); } catch (e) { /* ignore */ } }
  // Who is conducting is remembered on this phone, like the ward name.
  function readConducting() {
    var v = readJSON('localStorage', 'huddle-conducting') || {};
    return { who: ['wml', 'eq', 'other'].indexOf(v.who) >= 0 ? v.who : '', other: str(v.other) };
  }
  function writeConducting(s) { writeJSON('localStorage', 'huddle-conducting', { who: s.conducting || '', other: str(s.conductingOther) }); }
  function conductingLabel(s) {
    if (s.conducting === 'wml') return 'Ward mission leader';
    if (s.conducting === 'eq') return 'Elders Quorum';
    if (s.conducting === 'other') return str(s.conductingOther).trim() || 'Other';
    return '';
  }

  /* ---------- state ---------- */
  function blankRR() { return { plan: '', happened: '', notes: '' }; }
  // Every name card (Covenant Path lists and Name Next Ordinance) has the same fields.
  var CARD_KEYS = ['name', 'bap', 'ordinance', 'need', 'hneed', 'action', 'assigned', 'when', 'appt']; // appt: next appointment with the missionaries (those being taught)
  var REF_KEYS = ['name', 'by', 'notes']; // a missionary referral (set up here, before the saved huddle is read)
  function blankAction() { return { name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', appt: '', checks: {} }; }
  /* ---------- The Covenant Path Report checklist ----------
   * Before ward council mirrors the report: each person's group has a checklist, and a check means done.
   * What isn't checked is still open; ward council picks one open item as What will help (`need`).
   * `help` is how an open item reads as a need; `opt` items can be marked "Doesn't apply".
   * A new member's "Performed baptisms for the dead" is the temple check (a.temple), with its 30-day countdown. */
  var CHECKLISTS = {
    nm: [
      { k: 'recint', t: 'Meet with the bishop', help: 'Meet with the bishop' },
      { k: 'aaronic', t: 'Aaronic Priesthood ordination', help: 'Aaronic Priesthood ordination', opt: true },
      { k: 'bfd', t: 'Performed baptisms for the dead', help: 'Perform baptisms for the dead', temple: true },
      { k: 'calling', t: 'A calling', help: 'A calling' },
      { k: 'minassign', t: 'A ministering assignment', help: 'A ministering assignment' },
      { k: 'ministers', t: 'Assigned ministers', help: 'Assigned ministers' },
      { k: 'famname', t: 'Prepared a family name for the temple', help: 'Prepare a family name for the temple' },
      { k: 'institute', t: 'Invited to attend institute', help: 'Invite to attend institute' },
      { k: 'prep', t: 'Invited to mission or temple preparation', help: 'Invite to mission or temple preparation' },
      { k: 'patriarch', t: 'Interview for patriarchal blessing', help: 'Interview for patriarchal blessing' },
      { k: 'mission', t: 'Invited to consider a full-time mission', help: 'Invite to consider a full-time mission' }
    ],
    rm: [
      { k: 'friends', t: 'Has friends at church', help: 'Friends at church' },
      { k: 'aaronic', t: 'Aaronic Priesthood ordination', help: 'Aaronic Priesthood ordination', opt: true },
      { k: 'melch', t: 'Melchizedek Priesthood ordination', help: 'Melchizedek Priesthood ordination', opt: true },
      { k: 'calling', t: 'A calling', help: 'A calling' },
      { k: 'minassign', t: 'A ministering assignment', help: 'A ministering assignment' },
      { k: 'ministers', t: 'Assigned ministers', help: 'Assigned ministers' },
      { k: 'famname', t: 'Prepared a family name for the temple', help: 'Prepare a family name for the temple' },
      { k: 'recint', t: 'Meet with the bishop', help: 'Meet with the bishop' },
      { k: 'bfd', t: 'Performed baptisms for the dead', help: 'Perform baptisms for the dead' },
      { k: 'endow', t: 'Received endowment', help: 'Receive the endowment' },
      { k: 'sealparents', t: 'Sealed to parents', help: 'Be sealed to parents' },
      { k: 'sealspouse', t: 'Sealed to spouse', help: 'Be sealed to spouse', opt: true }
    ],
    bt: [
      { k: 'sacr', t: 'Attended sacrament meeting', help: 'Attend sacrament meeting' },
      { k: 'friends', t: 'Has friends at church', help: 'Friends at church' },
      { k: 'bishop', t: 'Met the bishop', help: 'Meet the bishop' },
      { k: 'fh', t: 'Participated in family history', help: 'Participate in family history' }
    ]
  };
  // For a focus name that isn't on the Covenant Path Report: ideas by the next ordinance ward council picks.
  var ORD_IDEAS = {
    'Baptism': { label: 'Ideas for baptism', items: ['A ride to church', 'Sit with them in sacrament meeting', 'Invite them to a ward activity', 'Friends at church', 'Meet with the bishop', 'Participate in family history'] },
    'Sacrament': { label: 'Ideas for the sacrament', items: ['A ride to church', 'Sit with them in sacrament meeting', 'Invite them to a ward activity', 'Friends at church', 'Assigned ministers', 'A calling'] },
    'Baptisms for the dead': { label: 'Ideas for baptisms for the dead', items: ['Go with them to the temple', 'A ride to the temple', 'Meet with the bishop', 'Prepare a family name for the temple'] },
    'Priesthood advancement': { label: 'Ideas for priesthood advancement', items: ['Invite them to elders quorum or a youth activity', 'Meet with the bishop', 'Friends at church', 'Assigned ministers', 'A calling'] },
    'Endowment': { label: 'Ideas for the endowment', items: ['Go with them to the temple grounds', 'Meet with the bishop', 'Invite to temple preparation', 'Prepare a family name for the temple'] },
    'Sealing': { label: 'Ideas for sealing', items: ['Visit them as a family', 'Meet with the bishop', 'Invite to temple preparation'] }
  };
  var CHECK_KEYS = {}; Object.keys(CHECKLISTS).forEach(function (g) { CHECKLISTS[g].forEach(function (c) { CHECK_KEYS[c.k] = 1; }); });
  function cleanChecks(c) {
    var o = {}; if (!c || typeof c !== 'object') return o;
    Object.keys(c).forEach(function (k) { if (CHECK_KEYS[k] && (c[k] === true || c[k] === 'na')) o[k] = c[k]; });
    return o;
  }
  // An item's state: true (done), 'na' (doesn't apply) or false (still open).
  function checkOf(a, gid, c) { if (c.temple && gid === 'nm') return !!a.temple; var v = a.checks && a.checks[c.k]; return v === true || (v === 'na' && c.opt) ? v : false; } // Doesn't apply only counts where it's offered (Nov 20, 2026: the priesthood steps, not endowment or sealed to parents)
  function openChecks(a, gid) { return (CHECKLISTS[gid] || []).filter(function (c) { return checkOf(a, gid, c) === false; }); }
  function checkCount(a, gid) {
    var l = (CHECKLISTS[gid] || []).filter(function (c) { return checkOf(a, gid, c) !== 'na'; });
    return { done: l.filter(function (c) { return checkOf(a, gid, c) === true; }).length, of: l.length };
  }
  // The next ordinance the checklist points to (ward council can take it or choose another).
  function suggestOrd(a, gid) {
    if (gid === 'bt') return '';
    var open = function (k) { var c = (CHECKLISTS[gid] || []).filter(function (x) { return x.k === k; })[0]; return c && checkOf(a, gid, c) === false; };
    if (gid === 'nm') return !a.temple ? 'Baptisms for the dead' : open('aaronic') ? 'Priesthood advancement' : '';
    if (open('aaronic') || open('melch')) return 'Priesthood advancement';
    if (open('bfd')) return 'Baptisms for the dead';
    if (open('endow')) return 'Endowment';
    if (open('sealparents') || open('sealspouse')) return 'Sealing';
    return '';
  }
  // The Covenant Path person behind a focus name (matched by name), for their open items.
  function cpOfName(name) {
    var n = norm(name), hit = null; if (!n) return null;
    GROUPS.forEach(function (g) { if (!hit) state.cp[g.id].forEach(function (a, i) { if (!hit && norm(a.name) === n) hit = { a: a, gid: g.id, i: i }; }); });
    return hit;
  }
  function shortDay(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
  // Those being taught: "Committed to baptism" and the baptism date, in a few words.
  // Next appointment with the missionaries, while it is today or later: "Appointment: Thu, Nov 19"
  function apptNote(a) { var d = parseISO(str(a.appt)), t = parseISO(todayISO()); return d && t && d >= t ? 'Appointment: ' + whenShow(a.appt) : ''; }
  /* ---------- Focus names filter the huddle ----------
   * Before ward council and in ward council, a Covenant Path name that is pressing (a new member not yet at the temple,
   * someone being taught with a baptism in the next 30 days or a missionary appointment in the next week) is marked red.
   * Returning members are never suggested; ward council can still choose them.
   * Ward council makes focus names; the huddle plans action items for focus names only. */
  function pressingReason(a, gid) {
    if (!a || !str(a.name).trim()) return '';
    if (gid === 'nm' && !a.temple) { // every new member who hasn't been to the temple yet
      var st = templeStatus(a, state.date);
      return parseISO(str(a.bap)) && st.short ? 'Temple: ' + st.short : 'Not yet to the temple';
    }
    if (gid === 'bt') { // being taught: a baptism date in the next 30 days, or a missionary appointment in the next week
      var d = parseISO(str(a.bap)), ap = parseISO(str(a.appt)), t = parseISO(todayISO());
      if (d && t && d >= t && (d - t) / 864e5 <= 30) return 'Baptism ' + whenShow(a.bap);
      if (ap && t && ap >= t && (ap - t) / 864e5 <= 7) return 'Appointment ' + whenShow(a.appt);
    }
    return '';
  }
  function focusIndex(name) { var n = norm(name); return n ? state.tn.findIndex(function (x) { return norm(x.name) === n; }) : -1; }
  function baptismNote(a) {
    var d = shortDay(str(a.bap));
    if (a.committed) return 'Committed to baptism' + (d ? ' · ' + d : '');
    return d ? 'Scheduled baptism: ' + d : '';
  }
  // New members: goal is temple attendance (baptisms for the dead) within 30 days of baptism.
  // Counted from the meeting date. Stays red until Temple attendance is checked.
  var TEMPLE_DAYS = 30;
  function templeStatus(a, meetingISO) {
    if (a.temple) return { done: true, text: 'Done', short: 'done' };
    var bap = parseISO(str(a.bap));
    if (!bap) return { done: false, text: 'Add the baptism date to start the 30-day count', short: 'no baptism date yet' };
    var m = parseISO(meetingISO) || new Date();
    var left = TEMPLE_DAYS - Math.round((m - bap) / 86400000);
    if (left > 0) return { done: false, left: left, text: left + (left === 1 ? ' day' : ' days') + ' left of 30', short: left + (left === 1 ? ' day' : ' days') + ' left' };
    if (left === 0) return { done: false, left: 0, text: 'Today is day 30', short: 'due today' };
    return { done: false, left: left, text: (-left) + (left === -1 ? ' day' : ' days') + ' past the 30-day goal', short: (-left) + (left === -1 ? ' day' : ' days') + ' late' };
  }
  function blankName() { return blankAction(); }
  // Plans to find new people to teach: one plan, and assignments that each have their own when.
  function blankAssign() { return { id: oppId(), task: '', who: '', when: '' }; }
  function blankFind() { return { plan: '', items: [blankAssign()], opps: [], none: false, done: false }; } // none: ward council said No upcoming events; done: ward council tapped Done with events listed
  // Focus names keep no blank spots between names: the names first, then empty spots up to three.
  function tnBlank(n) { return !n.sac && !hasText(n, CARD_KEYS); }
  function packTn(list) {
    var out = list.filter(function (n) { return !tnBlank(n); });
    while (out.length < 3) out.push(blankName());
    return out;
  }
  function oppId() { return 'o' + Math.random().toString(36).slice(2, 9); }
  function assignHasText(x) { return hasText(x, ['task', 'who', 'when']); }
  // The meeting date defaults to the next day matching the weekday of the last saved agenda (today if none).
  function readMeetingDay() {
    try { var st = getStore('localStorage'); var v = st && st.getItem('huddle-meeting-day'); return v === null || v === undefined || v === '' ? null : +v; } catch (e) { return null; }
  }
  function writeMeetingDay(iso) {
    var d = parseISO(iso); if (!d) return;
    try { var st = getStore('localStorage'); if (st) st.setItem('huddle-meeting-day', String(d.getDay())); } catch (e) { /* ignore */ }
  }
  function defaultMeetingDate() {
    var day = readMeetingDay(), d = new Date();
    if (day === null || isNaN(day)) return todayISO();
    d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function freshState() {
    return {
      ward: readWard(), date: defaultMeetingDate(), attendees: [],
      conducting: readConducting().who, conductingOther: readConducting().other,
      rr: [blankRR(), blankRR()], loaded: null,
      cpDone: false, cp: { nm: [blankAction()], rm: [blankAction()], bt: [blankAction()] },
      cpNone: { nm: false, rm: false, bt: false },
      collapsed: {}, openOne: {}, stepsDone: {},
      tnDone: false, tn: [blankName(), blankName(), blankName()],
      find: blankFind(), referrals: [],
      practiceSnapshot: null,
      sentAt: '', sentSig: '', rolledFrom: '', dateManual: false, verified: { before: false, after: false }, afterUpd: {}, ask: { done: false, changed: false }, tnKept: false,
      ftDone: false, bwSnap: null
    };
  }
  function cleanList(list, maker, keys) {
    if (!Array.isArray(list)) return [maker()];
    var out = list.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      var o = maker();
      keys.forEach(function (k) { o[k] = str(x[k]); });
      o.sac = !!x.sac; o.temple = !!x.temple; o.committed = !!x.committed; o.actionCarried = !!x.actionCarried; o.texted = !!x.texted;
      o.lastSac = x.lastSac === true ? true : x.lastSac === false ? false : null;
      o.doneMid = !!x.doneMid; o.touched = parseISO(str(x.touched)) ? str(x.touched) : '';
      o.checks = cleanChecks(x.checks);
      return o;
    });
    return out.length ? out : [maker()];
  }
  function normalizeState(s) {
    var f = freshState();
    if (!s || typeof s !== 'object') return f;
    f.ward = str(s.ward) || f.ward;
    if (s.conducting !== undefined) {
      f.conducting = ['wml', 'eq', 'other'].indexOf(s.conducting) >= 0 ? s.conducting : '';
      f.conductingOther = str(s.conductingOther);
    }
    f.date = parseISO(s.date) ? s.date : f.date;
    f.attendees = Array.isArray(s.attendees) ? s.attendees.filter(function (id) { return ATTENDEES.some(function (a) { return a.id === id; }); }) : [];
    if (Array.isArray(s.rr) && s.rr.length) {
      f.rr = s.rr.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
        var o = { plan: str(r.plan), happened: ['Yes', 'Partly', 'No'].indexOf(r.happened) >= 0 ? r.happened : '', notes: str(r.notes) };
        if (r.prefilled) {
          o.prefilled = true; o.source = str(r.source); o.person = str(r.person);
          o.action = str(r.action); o.assigned = str(r.assigned); o.when = str(r.when);
          o.group = ['nm', 'rm', 'bt', 'tn', 'fn'].indexOf(r.group) >= 0 ? r.group : '';
          o.pname = str(r.pname); o.ord = str(r.ord); o.need = str(r.need); o.hneed = str(r.hneed); o.sac = !!r.sac; o.bap = str(r.bap); o.temple = !!r.temple; o.committed = !!r.committed; o.carriedFwd = !!r.carriedFwd; o.fid = str(r.fid);
          if (r.carryUndo && typeof r.carryUndo === 'object') {
            var cu = r.carryUndo, fo = {};
            if (cu.filled && typeof cu.filled === 'object') Object.keys(cu.filled).forEach(function (k) { if (CARD_KEYS.indexOf(k) >= 0 || k === 'temple' || k === 'committed') fo[k] = typeof cu.filled[k] === 'boolean' ? cu.filled[k] : str(cu.filled[k]); });
            o.carryUndo = { g: str(cu.g), kind: ['new', 'fill', 'none'].indexOf(cu.kind) >= 0 ? cu.kind : 'fill', name: str(cu.name), action: str(cu.action), appended: str(cu.appended), filled: fo };
          }
        }
        return o;
      });
      if (!f.rr.length) f.rr = [blankRR()];
    }
    f.loaded = s.loaded && typeof s.loaded === 'object'
      ? { fileName: str(s.loaded.fileName), ward: str(s.loaded.ward), date: str(s.loaded.date), count: +s.loaded.count || 0, practice: !!s.loaded.practice }
      : null;
    // A practice week remembers the form as it was, so removing it puts everything back.
    f.practiceSnapshot = f.loaded && f.loaded.practice && s.practiceSnapshot && typeof s.practiceSnapshot === 'object' ? s.practiceSnapshot : null;
    f.cpDone = !!s.cpDone; f.tnDone = !!s.tnDone; f.ftDone = !!s.ftDone;
    f.bwSnap = s.bwSnap && typeof s.bwSnap === 'object' && !Array.isArray(s.bwSnap) ? s.bwSnap : null;
    f.ask = { done: !!(s.ask && s.ask.done), changed: !!(s.ask && s.ask.changed) }; f.tnKept = !!s.tnKept; // Ward Council this week: Ask ward council, Keep these focus names
    f.afterUpd = {}; if (s.afterUpd && typeof s.afterUpd === 'object') Object.keys(s.afterUpd).forEach(function (k) { if (s.afterUpd[k] === true) f.afterUpd[k] = true; }); // After the huddle: who's updated in the report
    f.dateManual = !!s.dateManual; f.verified = { before: !!(s.verified && s.verified.before), after: !!(s.verified && s.verified.after) }; f.sentAt = str(s.sentAt); f.sentSig = str(s.sentSig); f.rolledFrom = parseISO(str(s.rolledFrom)) ? str(s.rolledFrom) : '';
    // Lists marked Done stay folded only within the draft; a saved agenda always opens fully.
    var sd = s.stepsDone && typeof s.stepsDone === 'object' ? s.stepsDone : {};
    ['rr', 'sa', 'cp', 'tn', 'fn', 'mr'].forEach(function (k) { if (sd[k] === true) f.stepsDone[k] = true; });
    var col = s.collapsed && typeof s.collapsed === 'object' ? s.collapsed : {};
    ['rr', 'nm', 'rm', 'bt', 'tn'].forEach(function (k) { if (col[k]) f.collapsed[k] = true; });
    var cn = s.cpNone && typeof s.cpNone === 'object' ? s.cpNone : {};
    GROUPS.forEach(function (g) { f.cpNone[g.id] = cn[g.id] === true; });
    var cp = s.cp || {};
    GROUPS.forEach(function (g) {
      var raw = Array.isArray(cp[g.id]) ? cp[g.id] : [];
      f.cp[g.id] = cleanList(raw, blankAction, CARD_KEYS);
      f.cp[g.id].forEach(function (a, i) { if (raw[i] && raw[i].carried) a.carried = true; });
    });
    var tn = cleanList(s.tn, blankName, CARD_KEYS);
    tn.forEach(function (a, i) { if (Array.isArray(s.tn) && s.tn[i] && s.tn[i].carried) a.carried = true; });
    while (tn.length < 3) tn.push(blankName());
    f.tn = packTn(tn.slice(0, 12)); // pressing names can take focus names past three; no blank spots between names
    var fd = s.find && typeof s.find === 'object' ? s.find : {};
    f.find.plan = str(fd.plan);
    var fi = Array.isArray(fd.items) ? fd.items.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) { return { id: str(x.id) || oppId(), task: str(x.task), who: str(x.who), when: str(x.when), carried: !!x.carried, doneMid: !!x.doneMid, opp: str(x.opp), past: !!x.past, status: ['Yes', 'Partly', 'No'].indexOf(x.status) >= 0 ? x.status : '', texted: !!x.texted }; }) : [];
    f.find.items = fi.length ? fi : [blankAssign()];
    // Upcoming opportunities are cards with a name and a date; assignments sit under them.
    // An older huddle's typed opportunities become one card.
    f.find.opps = Array.isArray(fd.opps) ? fd.opps.filter(function (o) { return o && typeof o === 'object'; }).map(function (o) { return { id: str(o.id) || oppId(), title: str(o.title), date: parseISO(str(o.date)) ? str(o.date) : '' }; }) : [];
    f.find.none = fd.none === true; f.find.done = fd.done === true;
    if (!f.find.opps.length && f.find.plan.trim()) { f.find.opps.push({ id: oppId(), title: f.find.plan.trim(), date: '' }); f.find.plan = ''; }
    // Every typed assignment sits under an opportunity (there is no "Other ways to invite" any more):
    // an older huddle's assignments that aren't tied to one go under an opportunity called "Other assignments".
    var orphans = f.find.items.filter(function (x) { return assignHasText(x) && !f.find.opps.some(function (o) { return o.id === x.opp; }); });
    if (orphans.length) {
      var oth = f.find.opps.filter(function (o) { return o.title === 'Other assignments'; })[0];
      if (!oth) { oth = { id: oppId(), title: 'Other assignments', date: '' }; f.find.opps.push(oth); }
      orphans.forEach(function (x) { x.opp = oth.id; });
    }
    f.referrals = cleanReferrals(s.referrals); // older PDFs and handoff links have none
    return f;
  }

  /* ---------- Covenant Path Report link ----------
   * iPhone: membertools:// opens the Member Tools app (tested). Android: open the app by its ID, or the web report if it isn't installed.
   * Anything else: the report in Leader and Clerk Resources. Member Tools opens to its home screen; the report is under Reports. */
  var LCR_REPORT = 'https://lcr.churchofjesuschrist.org/one-work/progress-record?lang=eng';
  function toolsHref() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return 'membertools://';
    if (/Android/.test(ua)) return 'intent://#Intent;package=org.lds.ldstools;S.browser_fallback_url=' + encodeURIComponent(LCR_REPORT) + ';end';
    return LCR_REPORT;
  }
  function setToolsLinks() {
    var href = toolsHref();
    Array.prototype.forEach.call(document.querySelectorAll('[data-tools-link]'), function (a) { a.setAttribute('href', href); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setToolsLinks); else setToolsLinks();

  var state = normalizeState(readJSON('localStorage', LIVE_KEY) || readJSON('sessionStorage', DRAFT_KEY));
  var staleRemoved = sweepStale(state);
  var draftTimer = null;
  function saveDraft() {
    clearTimeout(draftTimer);
    if (typeof renderSteps === 'function') renderSteps();
    if (tourDemo) return; // the tour's sample card is never saved
    if (typeof renderSent === 'function') { renderSent(); renderLoadState(); }
    draftTimer = setTimeout(function () { writeJSON('localStorage', LIVE_KEY, state); }, 250);
  }
  function getPath(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, state);
  }
  function setPath(path, val) {
    var keys = path.split('.'); var last = keys.pop();
    var obj = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, state);
    if (obj != null) obj[last] = val;
  }
  function hasText(o, keys) { return keys.some(function (k) { return str(o[k]).trim() !== ''; }); }
  // Missionary referrals: who is referred, who referred them, and a note. They stay from huddle to huddle until removed.
  function blankReferral() { return { name: '', by: '', notes: '' }; }
  function refBlank(x) { return !x || !hasText(x, REF_KEYS); }
  function cleanReferrals(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object' && !refBlank(x); })
      .map(function (x) { return { name: str(x.name), by: str(x.by), notes: str(x.notes) }; });
  }
  function rrHasInput(r) { return !!r.happened || hasText(r, ['plan', 'notes']); }
  function isEmpty(s) {
    if (s.attendees.length || s.cpDone || s.tnDone || s.ftDone || s.loaded) return false;
    if (GROUPS.some(function (g) { return s.cpNone && s.cpNone[g.id]; })) return false;
    if (s.rr.some(rrHasInput)) return false;
    if (GROUPS.some(function (g) { return s.cp[g.id].some(function (a) { return a.sac || hasText(a, CARD_KEYS); }); })) return false;
    if (s.tn.some(function (n) { return n.sac || hasText(n, CARD_KEYS); })) return false;
    if (str(s.find.plan).trim() || s.find.items.some(assignHasText) || (s.find.opps || []).some(function (o) { return str(o.title).trim(); })) return false;
    if (cleanReferrals(s.referrals).length) return false;
    return true;
  }

  /* ---------- DOM helpers ---------- */
  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  var ICONS = {
    pencil: '<svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 15l1-4 8.5-8.5a2 2 0 0 1 3 3L7 14z"/></svg>',
    circle: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4.5h12v7.5H8l-3.5 3v-3H3z"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    calendar: '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8h13"/><path d="M7 2.8v3.4M13 2.8v3.4"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 5l8 8M13 5l-8 8"/></svg>'
  };
  function icon(name, cls) { var s = h('span', { class: cls || null, 'aria-hidden': 'true' }); s.innerHTML = ICONS[name]; return s; }
  // The little "i": a round button beside a heading or a line; tapping it shows (or tucks away) a short explanation.
  // infoBtn(key) goes beside the thing it explains, infoText(key, text) where the words should appear. What's open
  // stays open while the app is in use.
  var infoOpen = {};
  var TEMPLE_WHY = 'The goal: every new member performs baptisms for the dead within 30 days of being baptized. The count starts at their baptism date.';
  function infoBtn(key, label) {
    return h('button', { type: 'button', class: 'info-i', 'data-action': 'info', 'data-a': key, 'aria-expanded': infoOpen[key] ? 'true' : 'false', 'aria-label': label || 'What is this?' }); // the "i" is drawn by CSS, so it isn't read as part of a heading's text
  }
  function infoText(key, text) { return h('p', { class: 'info-text full', 'data-info': key, hidden: !infoOpen[key], text: text }); }
  function toggleInfo(key) { setInfo(key, !infoOpen[key]); }
  function setInfo(key, on) {
    infoOpen[key] = !!on;
    Array.prototype.forEach.call(document.querySelectorAll('[data-info="' + key + '"]'), function (el) { el.hidden = !infoOpen[key]; });
    Array.prototype.forEach.call(document.querySelectorAll('.info-i[data-a="' + key + '"]'), function (el) { el.setAttribute('aria-expanded', infoOpen[key] ? 'true' : 'false'); });
  }
  /* A livelier look: each section's row starts with a white drawing on a tile of that section's own color
   * (the color its list and its PDF heading use), and each name starts with a circle of initials. */
  var TILE_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var TILE_ICONS = {
    rr: '<path d="M7.5 5l-4 4 4 4"/><path d="M3.5 9H12a4.5 4.5 0 0 1 4.5 4.5V15"/>',
    sa: '<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8h13"/><path d="M7 2.8v3.4M13 2.8v3.4"/><path d="M7.4 12.2l1.8 1.8 3.6-3.6"/>', // a calendar with a check: who came today                                  // an arrow coming back: return and report
    cp: '<circle cx="7.2" cy="7" r="2.7"/><path d="M2.4 16c0-2.7 2.1-4.6 4.8-4.6S12 13.3 12 16"/><circle cx="14.2" cy="7.8" r="2.1"/><path d="M13.6 11.6c2.3-.2 4.1 1.5 4.1 3.9"/>', // people
    tn: '<path d="M10 2.9l2.2 4.5 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9L2.9 8.1l4.9-.7z"/>',                    // a star: the names to focus on
    fn: '<circle cx="8.8" cy="8.8" r="5.3"/><path d="M12.8 12.8l4.2 4.2"/>',                                        // a magnifying glass: finding
    mr: '<path d="M17 3L3 8.8l5.6 2.6L11.2 17z"/><path d="M17 3l-8.4 8.4"/>',
    ask: '<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M7.2 9.4l1.9 1.9 3.8-3.8"/>', // a speech bubble with a check: ask ward council
    // The four steps on the opening screen
    bw: '<rect x="4.5" y="3.5" width="11" height="14" rx="2"/><path d="M7.5 3.5h5v2.4h-5z"/><path d="M7.4 11.2l1.8 1.8 3.6-3.8"/>',  // a clipboard with a check
    hd: '<circle cx="10" cy="6" r="2.4"/><circle cx="4.6" cy="9.4" r="2"/><circle cx="15.4" cy="9.4" r="2"/><path d="M6.4 16.5c0-2.3 1.6-4 3.6-4s3.6 1.7 3.6 4"/><path d="M1.6 16c.2-1.7 1.4-3 3-3.1"/><path d="M18.4 16c-.2-1.7-1.4-3-3-3.1"/>', // a circle of people
    af: '<path d="M17 3L3 8.8l5.6 2.6L11.2 17z"/><path d="M17 3l-8.4 8.4"/>'                                        // a paper plane: sent to the missionaries
  };
  function tile(name) { var t = h('span', { class: 'row-icon tile-' + name, 'aria-hidden': 'true' }); t.innerHTML = TILE_SVG + TILE_ICONS[name] + '</svg>'; return t; }
  // "Daniel Rivera" is DR; a single word gives one letter; no name yet gives a plus.
  function initials(name) {
    var words = str(name).trim().split(/\s+/).map(function (w) { return w.replace(/^[^A-Za-z\u00C0-\uFFFF]+/, ''); }).filter(Boolean);
    if (!words.length) return '';
    return (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words[words.length - 1])[0] : '')).toUpperCase();
  }
  function initialsDot(name) { var t = initials(name); return h('span', { class: 'avatar' + (t ? '' : ' is-blank'), 'aria-hidden': 'true', text: t || '+' }); }
  var LIST_LABEL = { nm: 'New member', rm: 'Returning member', bt: 'Being taught', tn: 'Focus name', mr: 'Missionary referral' };
  function field(label, path, opts) {
    opts = opts || {};
    // An empty date says "Pick a date" (the phone's own empty date box is blank or shows mm/dd/yyyy)
    var isDate = opts.type === 'date', hasV = !!str(getPath(path)).trim();
    return h('label', { class: 'field' + (opts.full ? ' full' : '') + (isDate ? ' date-field' + (hasV ? '' : ' date-empty') : '') }, [
      opts.tag ? h('span', { class: 'label-row' }, [h('span', { class: 'label-text', text: label }), opts.tag]) : label,
      opts.multi ? h('textarea', {
        'data-bind': path, value: str(getPath(path)), placeholder: opts.placeholder || '', rows: opts.rows || '2',
        autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'next', maxlength: '300'
      }) : h('input', {
        type: opts.type || 'text', 'data-bind': path, value: str(getPath(path)), placeholder: opts.placeholder || '',
        autocomplete: 'off', autocapitalize: opts.cap || 'sentences', enterkeyhint: 'next', maxlength: '300'
      }),
      isDate ? h('span', { class: 'date-ph', 'aria-hidden': 'true', text: 'Pick a date' }) : null,
      // A baptism date opens Huddle's own calendar (Nov 20, 2026): the phone's picker fills in today's date just from
      // looking, so the date is only kept when Apply is tapped, and Clear empties it.
      isDate && /\.bap$/.test(path) ? h('button', { type: 'button', class: 'date-tap', 'data-action': 'date-pick', 'data-a': path, 'data-b': typeof label === 'string' ? label : 'Baptism date', 'aria-label': (typeof label === 'string' ? label : 'Baptism date') + ': ' + (hasV ? whenShow(getPath(path)) : 'none. Pick a date') }) : null
    ]);
  }
  // The calendar sheet: a month at a time; the day picked is only saved with Apply.
  function pickDate(path, label) {
    var input = document.querySelector('[data-bind="' + path + '"]'), cur = str(getPath(path)).trim();
    var sel = ISO_DAY.test(cur) ? cur : '', base = parseISO(sel) || new Date(), vy = base.getFullYear(), vm = base.getMonth();
    var iso = function (y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); };
    var t = new Date(), today = iso(t.getFullYear(), t.getMonth(), t.getDate());
    var box = h('div', { class: 'cal' });
    function draw() {
      var first = new Date(vy, vm, 1).getDay(), days = new Date(vy, vm + 1, 0).getDate(), cells = [];
      for (var k = 0; k < first; k++) cells.push(h('span', { class: 'cal-gap' }));
      for (var d = 1; d <= days; d++) (function (d) {
        var v = iso(vy, vm, d);
        var b = h('button', { type: 'button', class: 'cal-day' + (v === sel ? ' is-sel' : '') + (v === today ? ' is-today' : ''), 'aria-pressed': v === sel ? 'true' : 'false', 'data-day': v, text: String(d) });
        b.addEventListener('click', function () { sel = v; draw(); });
        cells.push(b);
      })(d);
      var prev = h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Previous month', text: '‹' }), next = h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Next month', text: '›' });
      prev.addEventListener('click', function () { vm--; if (vm < 0) { vm = 11; vy--; } draw(); });
      next.addEventListener('click', function () { vm++; if (vm > 11) { vm = 0; vy++; } draw(); });
      box.replaceChildren(
        h('div', { class: 'cal-head' }, [prev, h('span', { class: 'cal-month', text: new Date(vy, vm, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }), next]),
        h('div', { class: 'cal-grid' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (w) { return h('span', { class: 'cal-wd', text: w }); }).concat(cells)),
        h('p', { class: 'cal-picked', text: sel ? whenShow(sel) : 'No date picked' }));
    }
    draw();
    var put = function (v) { if (!input) { setPath(path, v); saveDraft(); renderAll(); return; } input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
    ask({ title: label || 'Baptism date', plain: true, custom: box, primary: 'Apply', onPrimary: function () { if (sel && sel !== cur) put(sel); },
      secondary: 'Clear', onSecondary: function () { if (cur) put(''); }, tertiary: { label: 'Cancel', run: function () {} } });
  }
  function markDateEmpty(e) {
    var t = e.target; if (!t || t.type !== 'date') return;
    var f = t.closest && t.closest('.date-field'); if (f) f.classList.toggle('date-empty', !t.value);
  }
  document.addEventListener('input', markDateEmpty, true); document.addEventListener('change', markDateEmpty, true);
  /* Next ordinance is chosen from a list. A name typed in before the list existed keeps its wording as one more choice. */
  var ORDINANCES = ['Baptism', 'Sacrament', 'Baptisms for the dead', 'Priesthood advancement', 'Endowment', 'Sealing'];
  function ordField(label, path, opts) {
    opts = opts || {};
    var v = str(getPath(path)).trim(), list = ORDINANCES.slice();
    var same = list.filter(function (o) { return o.toLowerCase() === v.toLowerCase(); })[0];
    if (v && !same) list.push(v);
    var sel = h('select', { 'data-bind': path, class: 'ord-select' + (v ? '' : ' is-empty') },
      [h('option', { value: '', text: 'Choose one' })].concat(list.map(function (o) { return h('option', { value: o, text: o }); })));
    sel.value = same || v;
    return h('label', { class: 'field' + (opts.full ? ' full' : '') }, [label, sel]);
  }
  /* When is a date. A When typed in before ("Sat", "tomorrow") becomes that date the first time it is shown;
   * anything that isn't a day ("this week") stays as it was typed, in a text box, so nothing is lost. */
  var ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function whenShow(v) {
    v = str(v).trim(); var d = ISO_DAY.test(v) ? parseISO(v) : null;
    return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : v;
  }
  // This huddle's When boxes that still hold a typed day ("Sat") become dates, once, when the app opens.
  // (Return and Report keeps last week's wording as it was.)
  function datesForWhens() {
    var fix = function (o) {
      var v = str(o.when).trim(), p; if (v && !ISO_DAY.test(v) && (p = parseWhen(v)) && p.date) o.when = p.date;
      if (/^temple baptisms?$/i.test(str(o.ordinance).trim())) o.ordinance = 'Baptisms for the dead'; // the menu's older name
    };
    GROUPS.forEach(function (g) { state.cp[g.id].forEach(fix); }); state.tn.forEach(fix); state.find.items.forEach(fix);
  }
  function whenField(label, path, opts) {
    var v = str(getPath(path)).trim();
    if (v && !ISO_DAY.test(v)) { var p = parseWhen(v); if (p && p.date) { setPath(path, p.date); v = p.date; } }
    if (v && !ISO_DAY.test(v)) return field(label, path, opts);
    return field(label, path, Object.assign({}, opts, { type: 'date', placeholder: '' }));
  }
  function removeButton(action, a, b, label) {
    var btn = h('button', { type: 'button', class: 'btn-remove', 'data-action': action, 'data-a': a, 'data-b': b, 'aria-label': label });
    btn.appendChild(icon('x'));
    return btn;
  }
  function addButton(action, a, label) {
    var btn = h('button', { type: 'button', class: 'btn-add', 'data-action': action, 'data-a': a });
    btn.appendChild(icon('plus'));
    btn.appendChild(document.createTextNode(' ' + label));
    return btn;
  }

  /* ---------- rendering ---------- */
  function renderAttendees() {
    var wrap = $('#attendee-list');
    wrap.replaceChildren.apply(wrap, ATTENDEES.map(function (a) {
      var on = state.attendees.indexOf(a.id) >= 0;
      var btn = h('button', {
        type: 'button', class: 'chip' + (a.youth ? ' youth' : ''), 'data-action': 'toggle-att', 'data-a': a.id,
        'aria-pressed': on ? 'true' : 'false'
      });
      btn.appendChild(icon('check', 'check'));
      btn.appendChild(h('span', { text: a.label }));
      if (a.youth) btn.appendChild(h('span', { class: 'tag', text: 'Youth' }));
      return btn;
    }));
  }

  function prefillMeta(r) {
    var bits = [];
    if (str(r.assigned).trim()) bits.push('Assigned to ' + r.assigned.trim());
    if (str(r.when).trim()) bits.push(whenShow(r.when));
    return bits.join(' · ');
  }

  // With nothing to report (a first huddle, or a huddle that made no assignments) the section is one line,
  // not blank forms. "Add an item" then shows one blank item; rrAdding keeps it up while it's being typed.
  var rrAdding = false;
  function rrNothing() { return rowsOn && !rrAdding && !state.rr.some(rrShown); }
  function renderRR() {
    reconcileCarries();
    var list = $('#rr-list');
    $('#rr-foot').hidden = folded('rr');
    if (folded('rr')) { list.replaceChildren(foldedRR()); renderLoadState(); return; }
    var none = rrNothing(), sec = document.querySelector('[data-step="rr"]');
    if (sec) sec.classList.toggle('rr-empty', none); // the intro above the list steps aside too
    if (none) {
      var after = !!(state.rolledFrom || (state.loaded && state.loaded.date));
      list.replaceChildren(h('p', { class: 'rr-none', text: after ? 'Nothing to report from the last huddle.' : 'Nothing to report yet. After your first huddle, its assignments show up here.' }));
      renderLoadState(); return;
    }
    // One item can be removed too when names are rows (taking the last one off brings the line back).
    var many = rowsOn || state.rr.length > 1;
    list.replaceChildren.apply(list, state.rr.map(function (r, i) { return rrCard(r, i, many); }));
    renderLoadState();
  }
  function rrPerson(r) {
    if (!r.prefilled) return '';
    if (groupOf(r) === 'fn') return SOURCE.fn;
    return str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim();
  }
  function rrCard(r, i, many) {
      var gid = r.prefilled ? groupOf(r) : '';
      var who = rrPerson(r);
      var head = h('div', { class: 'card-head' }, [
        // "Return and Report" on every card, so a long list still says where you are.
        h('div', { class: 'card-title' }, [
          avatar(),
          h('div', { class: 'card-title-text' }, [
            h('p', { class: 'card-kicker', text: 'Return and Report' }),
            h('p', { class: 'card-item' + (who ? ' card-person' : ''), text: who || 'Item ' + (i + 1) })
          ])
        ]),
        h('div', { class: 'card-head-right' }, [
          many ? removeButton('remove-rr', i, '', 'Remove Return and Report item ' + (i + 1)) : null
        ])
      ]);
      var body;
      if (r.prefilled) {
        var meta = prefillMeta(r);
        var pname = str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim();
        var pord = str(r.ord).trim() || (str(r.person).split(' · Next: ')[1] || '').trim();
        var ordTag = pord ? h('span', { class: 'fact' }, [h('b', { text: 'Next: ' }), pord]) : null;
        var facts = [
          str(r.need).trim() ? h('span', { class: 'fact' }, [h('b', { text: 'What will help: ' }), r.need.trim()]) : null,
          str(r.hneed).trim() ? h('span', { class: 'fact' }, [h('b', { text: 'Huddle notes: ' }), r.hneed.trim()]) : null,
          r.sac ? h('span', { class: 'fact sac' }, ['✓ Attended sacrament']) : null,
          gid === 'bt' && baptismNote(r) ? h('span', { class: 'fact ' + (r.committed ? 'committed' : '') }, [(r.committed ? '✓ ' : '') + baptismNote(r)]) : null,
          gid === 'nm' ? (function () {
            var st = templeStatus(r, state.date);
            return h('span', { class: 'fact ' + (st.done ? 'sac' : 'temple-due') }, st.done ? ['✓ Temple attendance done'] : [h('b', { text: 'Temple attendance: ' }), st.short]);
          })() : null
        ].filter(Boolean);
        body = h('div', { class: 'prefill' }, [
          gid && gid !== 'fn' ? h('span', { class: 'group-tag', text: listName(gid) }) : null, // (a finding assignment's title already says so)
          // Name and next ordinance share a line; a long name pushes the tag to the next line.
          ordTag ? h('div', { class: 'person-line' }, [ordTag]) : null,
          facts.length ? h('div', { class: 'facts' }, facts) : null,
          h('p', { class: 'prefill-action' }, [h('span', { class: 'prefill-k', text: 'Action: ' }), str(r.action).trim() || 'No assignment was written.']),
          meta ? h('p', { class: 'prefill-meta', text: meta }) : null
        ]);
      } else {
        body = field('What was planned', 'rr.' + i + '.plan', { placeholder: 'What did we plan to do?' });
      }
      var seg = h('div', {}, [
        h('p', { class: 'seg-label', text: 'Did it happen?' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Did item ' + (i + 1) + ' happen?' }, ['Yes', 'Partly', 'No'].map(function (v) {
          return h('button', { type: 'button', 'data-action': 'happened', 'data-a': i, 'data-b': v, 'aria-pressed': r.happened === v ? 'true' : 'false', text: v });
        }))
      ]);
      var carry = null;
      if (r.prefilled && r.carriedFwd) {
        carry = h('div', { class: 'carried-row' }, [
          h('p', { class: 'carried-note', text: '✓ Added to ' + nextPlan() }),
          h('button', { type: 'button', class: 'btn-undo', 'data-action': 'undo-carry', 'data-a': i, 'aria-label': 'Undo carry forward' }, ['Undo'])
        ]);
      } else if (r.prefilled && (r.happened === 'Partly' || r.happened === 'No') && groupOf(r) && !stillListed(r)) {
        // The person is no longer on that list, so there's no card to carry the assignment to.
        carry = h('p', { class: 'carry-none', text: (rrPerson(r) || 'This name') + (groupOf(r) === 'tn' ? ' is no longer a focus name' : ' is no longer on the Covenant Path Report list') + ', so there’s nothing to carry forward.' });
      } else if (r.prefilled && (r.happened === 'Partly' || r.happened === 'No') && groupOf(r)) {
        {
          carry = h('button', { type: 'button', class: 'btn-outline full btn-carry', 'data-action': 'carry-fwd', 'data-a': i, text: 'Carry forward to this huddle' });
        }
      }
      return h('div', { class: 'card rr-card' + (gid ? ' g-' + gid : ''), 'data-status': statusOf(r.happened) }, [head, body,
        // Happened? and the notes stay together so the tour can point at them.
        h('div', { class: 'rr-answer' }, [seg, carry, field('Notes', 'rr.' + i + '.notes', { placeholder: 'How did it go?' }), confNote()])]);
  }

  function statusOf(v) { return { Yes: 'yes', Partly: 'partly', No: 'no' }[v] || ''; }
  // A numbered circle plus a small label at the top of each card.
  // A person icon in the list's color marks each name card.
  function avatar() {
    var a = h('span', { class: 'card-num card-avatar', 'aria-hidden': 'true' });
    a.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="6.6" r="3.6"/><path d="M2.8 17.4c.7-3.6 3.6-5.8 7.2-5.8s6.5 2.2 7.2 5.8c.1.5-.3.9-.8.9H3.6c-.5 0-.9-.4-.8-.9z"/></svg>';
    return a;
  }
  // The person's name, in bold at the top of the card, so the huddle stays focused on people.
  function personTitle(path, ph) {
    var v = str(getPath(path)).trim();
    return h('p', { class: 'card-person' + (v ? '' : ' empty'), 'data-name-for': path, 'data-ph': ph, text: v || ph });
  }
  // Labels name the huddle (by date) instead of "last week" / "this week".
  function prevHuddle(s) { s = s || state; return s.rolledFrom || (s.loaded && s.loaded.date) || ''; }
  function fromLabel(s) { var d = s ? monthDay(prevHuddle(s)) : ''; return d ? 'From the ' + d + ' huddle' : 'From the last huddle'; }
  function planLabel() { return 'This week’s plan'; }
  function nextPlan() { return 'this huddle’s plan'; }
  function carriedText(s) { var d = s ? monthDay(prevHuddle(s)) : ''; return d ? 'Carried forward from ' + d : 'Carried forward from the last huddle'; }
  function carriedTag() { return h('span', { class: 'source carried-tag', text: carriedText() }); }
  // The person's name, typed right in the bold title at the top of the card.
  function nameInput(path, ph) {
    return h('input', { type: 'text', class: 'card-name-input', 'data-bind': path, value: str(getPath(path)), placeholder: ph,
      'aria-label': 'Name', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'next', maxlength: '300' });
  }
  // Those being taught: the next ordinance is always baptism.
  var FIXED_ORD = { bt: 'Baptism' };
  function ordOf(a, gid) { return FIXED_ORD[gid] || str(a.ordinance).trim(); }
  function cardLabel(n, label, extra) {
    return h('div', { class: 'card-title' }, [
      avatar(),
      label ? h('p', { class: 'card-label', text: label }) : null,
      extra || null
    ]);
  }
  // The fields on every name card, in meeting order.
  // Each name card has two halves, like the two boxes at the top of the page:
  // Ward Council decides who and what; the huddle decides how and when.
  function zoneLabel(kind, text) {
    return h('p', { class: 'zone-label zone-' + kind }, [h('span', { class: 'zone-dot', 'aria-hidden': 'true' }), text]);
  }
  /* ---------- Text an assignment ----------
   * Opens Messages with the assignment written out, so the person assigned leaves the huddle with a text.
   * Only the name on the card, the action and when go in it: no needs, notes, list or ordinance. Nothing is stored or sent by the app. */
  // "Sunday, Nov 22": the coming Sunday (a week out when today is Sunday), so the next huddle hears how it went.
  function nextSundayText() {
    var d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()));
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  function assignmentText(base) {
    var fx = isFind(base) ? getPath(base.replace(/\.$/, '')) : null, fo = fx ? state.find.opps.filter(function (o) { return o.id === fx.opp; })[0] : null;
    var who = fx ? (fo ? str(fo.title).trim() + (parseISO(str(fo.date)) ? ' (' + monthDay(fo.date) + ')' : '') : '') : str(getPath(base + 'name')).trim();
    var act = str(getPath(base + (fx ? 'task' : 'action'))).trim(), when = str(getPath(base + 'when')).trim();
    var ward = state.ward.trim();
    // The action comes first, then who it is for and when, with the date written out.
    return [act,
      who ? 'For: ' + who : null,
      when ? 'When: ' + (ISO_DAY.test(when) && parseISO(when) ? parseISO(when).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : whenLine(when, parseWhen(when))) : null,
      'From the ' + (ward ? ward + ' ' : '') + 'huddle. Please report back before ' + nextSundayText() + '. Thank you!'].filter(Boolean).join('\n');
  }
  /* ---------- The When line of the text ----------
   * The person reading the text should not have to work out which Saturday is meant, so a weekday gets its date:
   * "Sat 9 am" is sent as "Saturday 9 am (Nov 14)". Nothing changes in the app; only the text spells it out. */
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_RE = /\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b(\.?)/i;
  var MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
  function isoOfDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // The day in what was typed under When. A weekday ("Sat", "Thursday"), "today", "tonight" or "tomorrow" gives a
  // date: a weekday means the next one after today. A date that was typed out ("Nov 14", "11/14") is left as it is.
  // Returns null when there is no day to go on ("this week", "ASAP").
  function parseWhen(text, base) {
    var t = str(text).toLowerCase(), now = base || new Date(), m, d = null;
    var plus = function (n) { return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n); };
    if (MONTH_RE.test(t) || /\b\d{1,2}\/\d{1,2}\b/.test(t)) return { date: '', explicit: true };
    if (/\b(today|tonight)\b/.test(t)) d = plus(0);
    else if (/\btomorrow\b/.test(t)) d = plus(1);
    else if ((m = DAY_RE.exec(t))) {
      var target = DAY_NAMES.map(function (x) { return x.slice(0, 3).toLowerCase(); }).indexOf(m[1].slice(0, 3));
      d = plus(((target - now.getDay() + 7) % 7) || 7);
    }
    return d ? { date: isoOfDate(d), explicit: false } : null;
  }
  // Day names are spelled out ("Sat" becomes "Saturday"), and a weekday gets its date.
  function whenLine(when, day) {
    var w = str(when).trim().replace(new RegExp(DAY_RE.source, 'gi'), function (all, word) {
      var full = DAY_NAMES.filter(function (x) { return x.slice(0, 3).toLowerCase() === word.slice(0, 3).toLowerCase(); })[0];
      return word.length === full.length ? all : full;
    });
    return w + (day && !day.explicit ? ' (' + monthDay(day.date) + ')' : '');
  }
  // An opportunity's assignment (find.items.N.) keeps what in `task` and who in `who`.
  function isFind(base) { return /^find\.items\./.test(base); }
  function textReady(base) { var f = isFind(base); return !!(str(getPath(base + (f ? 'task' : 'action'))).trim() && str(getPath(base + (f ? 'who' : 'assigned'))).trim()); }
  function textAssignLabel(base) { return getPath(base + 'texted') ? 'Texted · Send again' : 'Text this assignment'; }
  function textAssignButton(base) {
    var sent = !!getPath(base + 'texted');
    return h('button', { type: 'button', class: 'btn-text-assign' + (sent ? ' sent' : ''), 'data-action': 'text-assign', 'data-a': base, hidden: !textReady(base) }, [
      icon(sent ? 'check' : 'chat'), h('span', { class: 'bta-label', text: textAssignLabel(base) })
    ]);
  }
  function refreshTextButton(base, scope) {
    var btn = (scope || document).querySelector('.btn-text-assign[data-a="' + base + '"]');
    if (!btn) return;
    var sent = !!getPath(base + 'texted');
    btn.hidden = !textReady(base); btn.classList.toggle('sent', sent);
    btn.replaceChildren(icon(sent ? 'check' : 'chat'), h('span', { class: 'bta-label', text: textAssignLabel(base) }));
  }
  // A referral, written out for the full-time missionaries. Messages opens; the person picks the missionaries.
  function textReferral(i) {
    var x = state.referrals[i]; if (!x) return;
    if (tourDemo) { toast('Texting is turned off for sample names.'); return; }
    var name = str(x.name).trim(), by = str(x.by).trim(), notes = str(x.notes).trim(), ward = state.ward.trim();
    if (!name) { toast('Add the name first.'); return; }
    openMessages([isPractice() ? 'SAMPLE (practice, not a real referral)' : null, 'Missionary referral: ' + name, by ? 'Referred by: ' + by : null, notes || null,
      'From the ' + (ward ? ward + ' ' : '') + 'huddle. Thank you!'].filter(Boolean).join('\n'));
  }
  function textAssignment(base) {
    if (tourDemo) { toast('Texting is turned off for sample names.'); return; }
    if (!textReady(base)) return;
    openMessages((isPractice() ? 'SAMPLE (practice, not a real assignment)\n' : '') + assignmentText(base));
    setPath(base + 'texted', true); refreshTextButton(base); saveDraft();
  }
  // Ward council's half of a card: next ordinance and needs (and a new member's baptism date).
  function wcZone(base, tag, withBap, needPh, ordPh, fixedOrd) {
    return h('div', { class: 'card-zone zone-wc-wrap' }, [
      tag ? h('div', { class: 'zone-label-row' }, [zoneLabel('wc', 'Ward Council · Who & What'), tag]) : zoneLabel('wc', 'Ward Council · Who & What'),
      h('div', { class: 'card-grid' }, [
        withBap ? field(withBap, base + 'bap', { type: 'date', full: true }) : null,
        fixedOrd ? h('div', { class: 'field full' }, ['Next ordinance', h('p', { class: 'fixed-value', text: fixedOrd })])
          : ordField('Next ordinance', base + 'ordinance', { full: true }),
        fixedOrd ? null : ordSuggest(base),
        // (What will help left Ward Council on Nov 19, 2026; only the cards-open and one-page layouts that older tests use keep it.)
        rowsOn ? null : field('What will help', base + 'need', { full: true, multi: true, placeholder: needPh || 'e.g. A ride to church' })
      ])
    ]);
  }
  // Under What will help: the person's open checklist items (from their Covenant Path Report), to tap.
  // A focus name finds them by name; a name that isn't on the report gets none. They hide once something is typed.
  function helpChips(base) {
    var a = getPath(base.replace(/\.$/, '')); if (!a) return null;
    var m = /^cp\.(\w+)\./.exec(base), src = m ? { a: a, gid: m[1] } : cpOfName(a.name), label, list;
    if (src) { label = 'Next steps on their Covenant Path Report'; list = openChecks(src.a, src.gid).map(function (c) { return c.help; }); }
    else { var oi = ORD_IDEAS[str(a.ordinance).trim()]; if (!oi) return null; label = oi.label; list = oi.items; } // not on the report: ideas by next ordinance
    if (!list.length) return null;
    return h('div', { class: 'full help-chips', hidden: !!str(a.need).trim() }, [h('p', { class: 'idea-k', text: label }),
      h('div', { class: 'idea-chips' }, list.map(function (t) { return h('button', { type: 'button', class: 'idea-chip', 'data-action': 'help-chip', 'data-a': base + 'need', 'data-b': t, text: t }); }))]);
  }
  // Under the Huddle's Action item: what's still open on their Covenant Path Report (found by name), then ideas for
  // their next ordinance (rides, invitations…), to tap; or type your own. Hidden once something is typed.
  function actionChips(base) {
    var a = getPath(base.replace(/\.$/, '')); if (!a || !str(a.name).trim()) return null;
    var m = /^cp\.(\w+)\./.exec(base), src = m ? { a: a, gid: m[1] } : cpOfName(a.name);
    var open = []; // no "Next steps on their Covenant Path Report" here (Nov 20, 2026): only ideas for the next ordinance
    var ord = src && FIXED_ORD[src.gid] ? FIXED_ORD[src.gid] : str(a.ordinance).trim(), oi = ORD_IDEAS[ord];
    var done = src ? (CHECKLISTS[src.gid] || []).filter(function (c) { return checkOf(src.a, src.gid, c) !== false; }).map(function (c) { return c.help; }) : [];
    var ideas = oi ? oi.items.filter(function (t) { return open.indexOf(t) < 0 && done.indexOf(t) < 0; }) : []; // nothing they've already done
    if (!open.length && !ideas.length) return null;
    var have = str(a.action).split('\n').map(function (x) { return x.trim(); });
    var chipsFor = function (list) { return h('div', { class: 'idea-chips' }, list.map(function (t) { var on = have.indexOf(t) >= 0; return h('button', { type: 'button', class: 'idea-chip' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-action': 'help-chip', 'data-a': base + 'action', 'data-b': t, text: t }); })); };
    return h('div', { class: 'full help-chips action-chips' }, [ // they stay after one is tapped, to add another (Nov 20, 2026)
      open.length ? h('p', { class: 'idea-k', text: 'Next steps on their Covenant Path Report' }) : null, open.length ? chipsFor(open) : null,
      ideas.length ? h('p', { class: 'idea-k', text: oi.label }) : null, ideas.length ? chipsFor(ideas) : null]);
  }
  // Under Next ordinance while it's empty: what the checklist points to, to tap.
  function ordSuggest(base) {
    var a = getPath(base.replace(/\.$/, '')); if (!a || str(a.ordinance).trim()) return null;
    var m = /^cp\.(\w+)\./.exec(base), src = m ? { a: a, gid: m[1] } : cpOfName(a.name);
    var sug = src ? suggestOrd(src.a, src.gid) : ''; if (!sug) return null;
    return h('div', { class: 'full ord-suggest' }, [h('button', { type: 'button', class: 'idea-chip is-suggest', 'data-action': 'ord-suggest', 'data-a': base + 'ordinance', 'data-b': sug }, ['Suggested: ' + sug])]);
  }
  // The huddle's half: one action item, who and when. `top` (optional) sits under the label; `tools` beside it.
  function hdZone(base, whenPh, top, tools) {
    var hneedVal = str(getPath(base + 'hneed')).trim();
    var hneedField = field('Huddle notes', base + 'hneed', { full: true, multi: true, placeholder: 'Anything to relay back to ward council' });
    if (!hneedVal) hneedField.hidden = true;
    var hneedLink = h('button', { type: 'button', class: 'link-add', 'data-action': 'add-hneed', hidden: !!hneedVal }, ['+ Add a note for ward council']);
    return h('div', { class: 'card-zone zone-hd-wrap' }, [
      tools ? h('div', { class: 'zone-label-row' }, [zoneLabel('hd', 'Huddle · How & When'), tools]) : zoneLabel('hd', 'Huddle · How & When'),
      top || null,
      h('div', { class: 'card-grid' }, [
        field('Assignment', base + 'action', { full: true, multi: true, rows: '3', placeholder: 'What might you do to assist them in being worthy and prepared for their next ordinance?',
          tag: getPath(base + 'actionCarried') && str(getPath(base + 'action')).trim() ? carriedTag() : null }),
        actionChips(base),
        // Assigned to gets the wider share of its row; When is usually a day or two words.
        h('div', { class: 'assign-row' }, [
          field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
          whenField('When', base + 'when', { placeholder: whenPh })
        ]),
        h('div', { class: 'assign-actions' }, [textAssignButton(base)]),
        hneedField
      ]),
      hneedLink,
      confNote() // under the notes, the same reminder as under the step card
    ]);
  }
  function cardFields(base, nameLabel, namePh, whenPh, tag, withBap, needPh, ordPh, wcExtra, fixedOrd) {
    return h('div', { class: 'card-zones' }, [wcExtra || null, wcZone(base, tag, withBap, needPh, ordPh, fixedOrd), hdZone(base, whenPh)]);
  }
  /* ---------- The Huddle's screen for one person ----------
   * What the huddle does is what shows: sacrament (and temple) attendance, the action item, who and when.
   * Ward council's half is already filled in, so it sits above as a short summary; Edit opens its fields. */
  var personWcOpen = false;
  // Open from the start when there's nothing to summarize yet: a new name, or a new member with no baptism date.
  function wcOpenDefault(r) {
    var a = r && personCard(r);
    return !a || !str(a.name).trim() || (r.g === 'nm' && !parseISO(str(a.bap)));
  }
  // In the Huddle, ward council's part is one plain line: "Next ordinance: Sealing", with an "i" saying where it comes
  // from and how to change it (the user asked, Nov 19, 2026). A new member's baptism date and an appointment, if any.
  function wcSummary(r, a) {
    var ord = ordOf(a, r.g), bap = monthDay(a.bap);
    var facts = r.g === 'tn' || CP_SECTION ? [['Next ordinance', ord || 'Not set yet', !ord]] : []; // only focus names have one now
    if (r.g === 'nm') facts.push(['Baptized', bap || 'No date yet', !bap]);
    if (!facts.length) return null;
    if (r.g === 'bt' && apptNote(a)) facts.push(['Appointment', whenShow(a.appt)]);
    var oldEdit = CP_SECTION ? h('div', { class: 'zone-label-row' }, [zoneLabel('wc', 'Ward Council · Who & What'), // (tests only: the old layout's Edit)
      h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'wc-edit-toggle', 'aria-label': 'Edit the next ordinance and needs', 'aria-expanded': 'false', text: 'Edit' })]) : null;
    return h('div', { class: 'wc-summary wc-line' }, [oldEdit].concat(facts.map(function (f, k) {
      return h('p', { class: 'after-fact' + (f[2] ? ' unset' : '') }, [h('span', { class: 'after-k', text: f[0] }), f[1], f[0] === 'Next ordinance' ? infoBtn('wc-ord', 'Where this comes from') : null]);
    })).concat([infoText('wc-ord', 'Chosen in Ward Council. To change it, open this name in Ward Council.')]));
  }
  function hdPersonCard(r, a) {
    var g = r.g, isTn = g === 'tn', base = isTn ? 'tn.' + r.i + '.' : 'cp.' + g + '.' + r.i + '.';
    var named = !!str(a.name).trim(), top;
    if (personWcOpen && CP_SECTION) { // (tests only: the old Huddle Covenant Path section could edit ward council's part)
      var tools = named ? h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'wc-edit-toggle', 'aria-label': 'Hide the next ordinance and needs', 'aria-expanded': 'true', text: 'Hide' }) : null;
      top = h('div', { class: 'wc-edit' }, [
        // (The name is edited in the header at the top of the screen.) A new member's baptism date is ward council's; a scheduled baptism sits with Committed to baptism, below.
        wcZone(base, tools, g === 'nm' ? 'Baptism date' : '', isTn ? 'e.g. A ride to the temple' : 'Tap their name in the Covenant Path Report to identify needs', isTn ? 'e.g. Sacrament' : '', FIXED_ORD[g])
      ]);
    } else top = wcSummary(r, a);
    if (!isTn && !CP_SECTION) return h('div', { class: 'card person-hd' }, [
      top,
      focusBox(g, r.i, a),
      h('div', { class: 'card-zone zone-hd-wrap' }, [zoneLabel('hd', 'Huddle · How & When'), hdChecks(g, base, r.i, a),
        h('p', { class: 'focus-note', text: 'Assignments are planned for focus names.' })]),
      g === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': r.i }, ['Move to New members']) : null
    ]);
    return h('div', { class: 'card person-hd' }, [
      staleNote(base, a, isTn),
      top,
      hdZone(base, 'e.g. Sat 9 am', hdChecks(g, base, r.i, a)),
      g === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': r.i }, ['Move to New members']) : null
    ]);
  }
  // What the huddle checks off for a person: sacrament, a new member's temple attendance, a commitment to baptism.
  function hdChecks(g, base, i, a) {
    return h('div', { class: 'hd-checks' }, [
      g === 'tn' ? null : sacToggle(base + 'sac', a.sac),
      g === 'nm' ? templeBox(base, i, a) : null,
      g === 'bt' ? committedBox(base, a) : null,
      g === 'bt' ? field('Scheduled baptism date', base + 'bap', { type: 'date', full: true }) : null,
      g === 'bt' ? field('Next appointment with the missionaries', base + 'appt', { type: 'date', full: true }) : null
    ]);
  }
  /* ---------- Ward council's screen for one person: the mirror of the Huddle's ----------
   * Ward council's half is what shows, highlighted. The huddle's half sits under it as a short summary;
   * Edit opens the same fields the Huddle has. Last huddle's assignment stays read-only. */
  var personHdOpen = false;
  function hdSummary(r, a) {
    var g = r.g, facts = [];
    facts.push(['Sacrament', a.sac ? 'Attended (marked this huddle)' : a.lastSac === true ? 'Attended, as of the last huddle' : a.lastSac === false ? 'Not marked at the last huddle' : 'Not marked yet', a.sac || a.lastSac === true ? 'yes' : 'unset']);
    if (g === 'nm') {
      var ts = templeStatus(a, state.date);
      facts.push(['Temple', a.temple ? 'Attended' : parseISO(str(a.bap)) ? 'Not yet · ' + ts.text : 'Not yet', a.temple ? 'yes' : (ts.left !== undefined && ts.left <= 0 ? 'no' : '')]);
    }
    if (g === 'bt') facts.push(['Baptism', a.committed ? 'Committed' + (monthDay(a.bap) ? ' · scheduled ' + monthDay(a.bap) : ', no date yet') : monthDay(a.bap) ? 'Scheduled ' + monthDay(a.bap) : 'Not committed yet', a.committed ? 'yes' : '']);
    var act = [str(a.action).trim(), str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
    facts.push(['Assignment', act || 'None yet', act ? '' : 'unset']);
    if (str(a.hneed).trim()) facts.push(['Huddle notes', a.hneed.trim()]);
    return h('div', { class: 'wc-summary hd-summary' }, [
      h('div', { class: 'zone-label-row' }, [zoneLabel('hd', 'Huddle · How & When'),
        h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'hd-edit-toggle', 'aria-label': 'Edit sacrament attendance and the assignment', 'aria-expanded': 'false', text: 'Edit' })])
    ].concat(facts.map(function (f) {
      return h('p', { class: 'after-fact' + (f[2] ? ' ' + f[2] : '') }, [h('span', { class: 'after-k', text: f[0] }), f[1]]);
    })));
  }
  // Last huddle's assignment for this name and how it went. Read-only: the huddle marks it.
  function wcLast(gid, a) {
    var rr = lastAction(gid, a.name); if (!rr) return null;
    var who = [str(rr.assigned).trim(), whenShow(rr.when)].filter(Boolean).join(' · ');
    var st = { Yes: 'Done', Partly: 'Partly done', No: 'Not done' }[rr.happened] || 'Pending';
    return h('div', { class: 'wc-last' }, [
      h('p', { class: 'wc-last-k' }, ['Last huddle’s assignment', h('span', { class: 'wc-status', 'data-status': statusOf(rr.happened) || 'pending', text: st })]),
      h('p', { class: 'wc-last-action', text: str(rr.action).trim() + (who ? ' (' + who + ')' : '') })
    ]);
  }
  // After a name changes in ward council, the boxes that depend on the name follow it.
  function refreshWcBoxes(card, gid, a) {
    Array.prototype.forEach.call(card.querySelectorAll('.wc-last'), function (x) { x.remove(); });
    (card.classList.contains('person-wc') ? [] : wcExtras(gid, a)).forEach(function (x) { card.appendChild(x); });
  }
  // Under Needs on a ward council name, and under the notes in the Huddle: the same reminder that sits under the step card.
  function confNote() {
    return h('p', { class: 'wc-note need-note full' }, [h('span', { class: 'help-warning-icon', 'aria-hidden': 'true', text: '!' }), h('span', { text: 'Never add confidential information to this huddle report.' })]);
  }
  // A name's Ward Council screen (the user simplified it, Nov 19, 2026): Make focus name, the baptism date as a plain
  // line, the next ordinance, and the person's next steps on their Covenant Path Report in a closed list that can be
  // checked off right there. No zone label and nothing from the Huddle: ward council decides who and what.
  var nsOpen = false, nsKeys = null, nsFor = ''; // the Next steps list: open or closed, and which items it shows
  function wcPersonCard(r, a) {
    var g = r.g, isTn = g === 'tn', base = isTn ? 'tn.' + r.i + '.' : 'cp.' + g + '.' + r.i + '.';
    var bap = g === 'nm' ? monthDay(a.bap) : '';
    // The next ordinance is chosen only for focus names (Nov 19, 2026, evening); a Covenant Path name shows its steps.
    var wc = h('div', { class: 'card-grid wc-plain' }, [
      g === 'nm' ? h('p', { class: 'after-fact full wc-bap' + (bap ? '' : ' unset') }, [h('span', { class: 'after-k', text: 'Baptized' }), bap || 'No date yet (add it in Before Ward Council)']) : null,
      isTn && ordDone(a) ? h('p', { class: 'full ord-done' }, [icon('check'), h('span', { text: str(a.ordinance).trim() + ' is done. Choose the next one.' })]) : null,
      isTn ? ordField('Next ordinance', base + 'ordinance', { full: true }) : null,
      isTn ? ordSuggest(base) : null // no confidential note here: nothing is typed (the user decided, Nov 19, 2026)
    ].filter(Boolean));
    return h('div', { class: 'card wc-card person-wc g-' + g }, [
      focusBox(g, r.i, a), h('div', { class: 'card-zone wc-plain-zone' }, [wc, isTn ? null : nextStepsBox(r, a)]), // a focus name: no next steps list (Nov 20, 2026)
      g === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': r.i }, ['Move to New members']) : null
    ]);
  }
  // "4 next steps on their Covenant Path Report": closed until tapped; checking one off marks it done there too.
  function nextStepsBox(r, a) {
    var src = r.g === 'tn' ? cpOfName(a.name) : CHECKLISTS[r.g] ? { a: a, gid: r.g, i: r.i } : null;
    if (!src || !CHECKLISTS[src.gid]) return null;
    var who = src.gid + '|' + src.i + '|' + norm(src.a.name);
    if (nsFor !== who) { nsFor = who; nsOpen = r.g !== 'tn'; nsKeys = null; } // open on a Covenant Path name (Ask ward council), closed on a focus name
    var open = openChecks(src.a, src.gid);
    if (!nsKeys) nsKeys = open.map(function (c) { return c.k; }); // items checked while the list is open stay in it
    var items = (CHECKLISTS[src.gid] || []).filter(function (c) { return nsKeys.indexOf(c.k) >= 0; });
    if (!items.length) return h('p', { class: 'ns-none' }, [icon('check'), h('span', { text: 'Nothing left on their Covenant Path Report' })]);
    return h('div', { class: 'ns-box' + (nsOpen ? ' is-open' : '') }, [
      h('button', { type: 'button', class: 'ns-head', 'data-action': 'ns-toggle', 'aria-expanded': nsOpen ? 'true' : 'false' }, [
        h('span', { class: 'ns-title', text: open.length ? plural(open.length, 'next step', 'next steps') + ' on their Covenant Path Report' : 'All checked off on their Covenant Path Report' }),
        h('span', { class: 'ns-chev', 'aria-hidden': 'true', text: '›' })]),
      nsOpen ? h('ul', { class: 'ck-list ns-list' }, items.map(function (c) { return ckRow(src.gid, src.i, src.a, c); })) : null
    ]);
  }
  /* ---------- Before ward council's screen for one person ----------
   * Only what the Covenant Path Report tells you: the name, the next ordinance, needs, and temple and
   * sacrament attendance. They are the same fields ward council and the huddle show, so nothing is typed twice. */
  function bwPersonCard(r, a) {
    var g = r.g, base = 'cp.' + g + '.' + r.i + '.';
    return h('div', { class: 'card person-bw g-' + g }, [
      g === 'nm' || g === 'bt' ? h('div', { class: 'card-zone zone-bw-wrap' }, [
        zoneLabel('bw', 'Covenant Path Report'),
        h('div', { class: 'card-grid' }, [
          g === 'nm' ? field('Baptism date', base + 'bap', { type: 'date', full: true }) : null,
          g === 'nm' && !a.temple ? h('ul', { class: 'ck-list full ck-up' }, [ckRow(g, r.i, a, CHECKLISTS.nm.filter(function (c) { return c.temple; })[0])]) : null,
          g === 'nm' && !a.temple ? h('p', { class: 'full temple-why' }, [infoBtn('temple', 'About the temple countdown'), h('span', { text: 'About the countdown' })]) : null,
          g === 'nm' && !a.temple ? infoText('temple', TEMPLE_WHY) : null,
          // Those being taught: a baptism date means they're committed (left blank until they are)
          g === 'bt' ? field('Baptism date', base + 'bap', { type: 'date', full: true }) : null,
          g === 'bt' ? field('Next scheduled appointment', base + 'appt', { type: 'date', full: true }) : null
        ])
      ]) : null,
      checklistZone(g, r.i, a)
    ]);
  }
  // The checklist: one row per item, a check means done; "if applicable" items can be marked Doesn't apply.
  function checklistZone(g, i, a) {
    var cc = checkCount(a, g);
    return h('div', { class: 'card-zone zone-bw-wrap checklist' }, [
      h('div', { class: 'zone-label-row' }, [zoneLabel('bw', 'Check off what’s done'), h('span', { class: 'ck-count', text: cc.done + ' of ' + cc.of + ' done' })]),
      h('ul', { class: 'ck-list' }, (CHECKLISTS[g] || []).filter(function (c) { return !bfdUp(g, a, c); }).map(function (c) { return ckRow(g, i, a, c); }))
    ]);
  }
  // A new member's baptisms for the dead sits right under the baptism date until it's done (the user decided, Nov 18, 2026).
  function bfdUp(g, a, c) { return !!c.temple && g === 'nm' && !a.temple; }
  function ckRow(g, i, a, c) {
        var v = checkOf(a, g, c), sub = null;
        if (c.temple && g === 'nm') { var st = templeStatus(a, state.date); if (!v) sub = h('span', { class: 'ck-sub due', text: st.text }); }
        return h('li', { class: 'ck-li' + (v === true ? ' is-done' : v === 'na' ? ' is-na' : '') + (c.temple && g === 'nm' && !v ? ' is-temple' : '') }, [
          h('button', { type: 'button', class: 'ck-row', role: 'checkbox', 'aria-checked': v === true ? 'true' : 'false', 'data-action': 'check-item', 'data-a': g + '|' + i, 'data-b': c.k, disabled: v === 'na' }, [
            h('span', { class: 'sac-box ck-box', 'aria-hidden': 'true' }, [v === true ? icon('check') : null]),
            h('span', { class: 'ck-text' }, [h('span', { class: 'ck-t', text: c.t }), sub])
          ]),
          c.opt ? h('button', { type: 'button', class: 'ck-na', 'aria-pressed': v === 'na' ? 'true' : 'false', 'data-action': 'check-na', 'data-a': g + '|' + i, 'data-b': c.k, text: 'Doesn’t apply' }) : null
        ]);
  }
  // "Attended sacrament" checkbox in the top right of each name card.
  function sacToggle(path, on) {
    return h('label', { class: 'sac-toggle' }, [
      h('input', { type: 'checkbox', 'data-bind': path, checked: !!on }),
      h('span', { class: 'sac-box', 'aria-hidden': 'true' }, [icon('check')]),
      h('span', { text: 'Attended sacrament' })
    ]);
  }
  // "From the November 8 huddle": which agenda Return and Report came from.
  function renderRRFrom() {
    var rf = $('#rr-from'); if (!rf) return;
    var from = state.rolledFrom || (state.loaded && state.loaded.date) || '';
    var d = parseISO(from);
    rf.hidden = !d;
    if (d) rf.textContent = state.loaded && state.loaded.practice ? 'Practice week: sample assignments' : 'From the last huddle';
  }
  function renderLoadState() {
    renderRRFrom();
    // Load from a PDF and Erase everything are under Settings in Help & training. (Receiving a handoff is under Hand off.)
    $('#load-panel').hidden = true;
    $('#loaded-banner').hidden = !state.loaded;
    $('#loaded-banner').classList.toggle('practice', !!(state.loaded && state.loaded.practice));
    if (state.loaded && state.loaded.practice) {
      $('#loaded-banner .loaded-title').textContent = 'Practice week loaded';
      $('#loaded-sub').textContent = 'Sample names only. Remove it before your real huddle.';
      return;
    }
    $('#loaded-banner .loaded-title').textContent = 'Loaded last week’s huddle report';
    if (state.loaded) {
      var L = state.loaded;
      var bits = [L.fileName || 'Last week’s huddle report'];
      bits.push(L.count + (L.count === 1 ? ' assignment' : ' assignments'));
      $('#loaded-sub').textContent = bits.join(' · ');
    }
  }
  // Return and Report folded: one line per item with its answer.
  function rrShown(r) { return r.prefilled || rrHasInput(r); }
  function foldedRR() {
    var open = state.openOne && state.openOne.rr;
    var many = state.rr.length > 1;
    var rows = state.rr.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return rrShown(x.r); }).map(function (x) {
      var r = x.r;
      if (open === x.i) return openOneRow('rr', x.i, rrCard(r, x.i, many), rrPerson(r) || 'this item');
      var gid = r.prefilled ? groupOf(r) : '';
      var name = gid === 'fn' ? 'Opportunities to invite' : r.prefilled ? (str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim()) : '';
      var what = r.prefilled ? str(r.action).trim() : str(r.plan).trim();
      var ans = r.happened ? h('span', { class: 'fold-tag ans-' + statusOf(r.happened), text: r.happened }) : h('span', { class: 'fold-tag due', text: 'Not marked' });
      var row = foldButton('rr', x.i, name || what || 'this item', [
        h('span', { class: 'fold-line' }, [h('span', { class: 'fold-name', text: name || what || 'Item' }), ans, r.carriedFwd ? h('span', { class: 'fold-tag', text: 'Carried forward' }) : null]),
        name && what ? h('span', { class: 'fold-plan', text: what }) : null,
        str(r.notes).trim() ? h('span', { class: 'fold-plan', text: 'Notes: ' + r.notes.trim() }) : null
      ]);
      if (gid) row.classList.add('g-' + gid);
      return row;
    });
    var head = h('button', { type: 'button', class: 'list-head fold-head', 'data-action': 'list-open', 'data-a': 'rr', 'aria-expanded': 'false', 'aria-label': 'Return and Report is done. Tap to open and edit.' }, [
      h('span', { class: 'list-title' }, [h('span', { class: 'fold-check', 'aria-hidden': 'true' }, [icon('check')]), ' Last huddle’s items']),
      h('span', { class: 'list-count', text: rows.length + (rows.length === 1 ? ' item' : ' items') })
    ]);
    return h('section', { class: 'list-panel rr-folded is-folded', 'aria-label': 'Return and Report' }, [
      head,
      rows.length ? h('ul', { class: 'fold-list' }, rows) : h('p', { class: 'fold-empty', text: 'No items.' }),
      rows.length ? h('p', { class: 'fold-hint', text: 'Tap an item to edit just that one.' }) : null,
      h('button', { type: 'button', class: 'btn-reopen', 'data-action': 'list-open', 'data-a': 'rr', text: 'Edit the whole list' })
    ]);
  }
  function countNamed(gid) { return state.cp[gid].filter(function (it) { return str(it.name).trim(); }).length; }
  function countText(n) { return n === 1 ? '1 person' : n + ' people'; }
  function updateListCount(gid) {
    var el = document.querySelector('.list-' + gid + ' .list-count');
    if (el) el.textContent = countText(countNamed(gid));
  }
  // A list with no one on the Covenant Path Report this week. The huddle confirms it on purpose,
  // so the PDF can tell "reviewed, no one" apart from "not filled in".
  function listEmpty(gid, s) {
    return (s || state).cp[gid].every(function (a) { return !a.sac && !a.temple && !a.committed && !hasText(a, CARD_KEYS); });
  }
  function noneConfirmed(gid, s) { s = s || state; return !!(s.cpNone && s.cpNone[gid]) && listEmpty(gid, s); }
  var showBlank = {};
  function emptyListPanel(g) {
    var ok = noneConfirmed(g.id);
    var body = ok
      ? h('div', { class: 'list-empty confirmed' }, [
          h('p', { class: 'list-empty-text' }, [icon('check'), h('span', { text: 'No one on the Covenant Path Report this week' })]),
          h('button', { type: 'button', class: 'btn-link list-empty-undo', 'data-action': 'cp-none-undo', 'data-a': g.id, 'aria-label': 'Undo none this week for ' + g.title, text: 'Undo' })
        ])
      : h('div', { class: 'list-empty' }, [h('p', { class: 'list-empty-text', text: 'No one in this list yet.' })]);
    var foot = h('div', { class: 'list-empty-foot' }, [
      addButton('cp-add-first', g.id, 'Add a person'),
      ok ? null : h('button', { type: 'button', class: 'btn-none', 'data-action': 'cp-none', 'data-a': g.id }, ['Confirm none this week'])
    ]);
    return h('section', { class: 'list-panel list-' + g.id + ' is-empty', 'data-group': g.id, 'aria-label': g.title }, [
      h('div', { class: 'list-head' }, [
        h('h3', { class: 'list-title', text: g.title }),
        h('span', { class: 'list-count', text: ok ? 'None this week' : countText(0) }),
        howHelpLink(g.id)
      ]), body, foot]);
  }
  /* ---------- How can we help? ---------- */
  // The small link under a list's name in the Huddle.
  function howHelpLink(id) {
    return h('button', { type: 'button', class: 'how-help', 'data-action': 'how-help', 'data-a': id, 'aria-haspopup': 'dialog' },
      [h('span', { text: 'How can we help?' }), h('span', { class: 'how-help-chev', 'aria-hidden': 'true', text: '›' })]);
  }
  // The panel that slides up with that section's questions. It closes with the X, a tap outside, or a swipe down.
  function openHowHelp(id) {
    var q = HOW_HELP[id]; if (!q) return;
    var sheet = $('#howhelp-sheet .sheet'), list = $('#howhelp-list');
    sheet.className = 'sheet help howhelp g-' + id; // the list's own color
    $('#howhelp-kicker').textContent = q.list;
    $('#howhelp-title').textContent = q.title;
    // Each question on its own line, so a card with three questions doesn't read as one block.
    // (A space between them keeps the words read aloud and copied as the manual has them.)
    list.replaceChildren.apply(list, q.items.map(function (t) {
      var parts = t.replace(/\?\s+(?=[A-Z])/g, '?\n').split('\n'), kids = []; // (no lookbehind: older iPhones can't read it)
      parts.forEach(function (x, k) { if (k) kids.push(' '); kids.push(h('span', { class: 'howhelp-q', text: x })); });
      return h('li', { class: parts.length > 1 ? 'many' : null }, kids);
    }));
    openOverlay('#howhelp-sheet', '.sheet-x'); sheet.scrollTop = 0;
  }
  /* ---------- Training slides ----------
   * The training, one slide at a time: a picture of the app with a ring around what to tap, and a few words.
   * Next when ready; nothing moves on by itself. The slides come from this website, like the app's own files. */
  var slides = null, slideAt = 0;
  function openSlides() {
    openOverlay('#slides-sheet', '#slide-next');
    if (slides) { showSlide(slideAt); return; }
    $('#slide-title').textContent = 'Loading…'; $('#slide-body').textContent = ''; $('#slide-kicker').textContent = ''; $('#slide-img').hidden = true;
    fetch('media/slides/slides.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (list) {
      slides = list; showSlide(0);
    }, function () { $('#slide-title').textContent = 'The slides didn’t load'; $('#slide-body').textContent = 'Check the phone’s connection and try again.'; });
  }
  function showSlide(i) {
    if (!slides) return;
    slideAt = Math.max(0, Math.min(slides.length - 1, i));
    var s = slides[slideAt], img = $('#slide-img');
    $('#slide-kicker').textContent = s.kicker; $('#slide-kicker').style.color = s.color;
    $('#slide-title').textContent = s.title; $('#slide-body').textContent = s.body;
    $('#slide-fine').hidden = !s.fine; $('#slide-fine').textContent = s.fine || '';
    img.hidden = false; img.src = 'media/slides/' + s.img; img.alt = 'The app: ' + s.title;
    $('#slides-count').textContent = (slideAt + 1) + ' of ' + slides.length;
    // Where this slide is in the week: the four steps (Send belongs to step 4), then During the week
    var m = /^Step (\d)/.exec(s.kicker || ''), ph = m ? +m[1] : s.kicker === 'Send' ? 4 : s.kicker === 'During the week' ? 5 : 0;
    Array.prototype.forEach.call(document.querySelectorAll('#slides-steps li'), function (li) {
      var p = +li.getAttribute('data-p'); li.classList.toggle('is-now', p === ph); li.classList.toggle('is-past', ph > 0 && p < ph);
      if (p === ph) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    // The label above the title names the part of the week in its color, then the section within it
    var PH = ['', 'Step 1 · Before Ward Council', 'Step 2 · Ward Council', 'Step 3 · The Huddle', 'Step 4 · After the huddle', 'During the week'];
    var part = ph ? String(s.kicker).replace(/^Step \d · /, '') : '', same = !part || /^(The Huddle|Before [Ww]ard [Cc]ouncil|Ward [Cc]ouncil|After the huddle|During the week)$/.test(part);
    var kk = $('#slide-kicker'); kk.textContent = ph ? PH[ph] : s.kicker; if (ph && !same) kk.appendChild(h('span', { class: 'slide-part', text: part }));
    if (ph) { kk.setAttribute('data-p', ph); kk.style.color = ''; } else { kk.removeAttribute('data-p'); kk.style.color = s.color; }
    $('#slide-prev').disabled = slideAt === 0;
    $('#slide-next').textContent = slideAt === slides.length - 1 ? 'Done' : 'Next';
    $('#slides-sheet .sheet').scrollTop = 0;
    if (slides[slideAt + 1]) { var pre = new Image(); pre.src = 'media/slides/' + slides[slideAt + 1].img; } // the next picture is ready when Next is tapped
  }
  /* ---------- Name rows: one line per person; tap to open their screen ---------- */
  function rowTag(text, cls) { return h('span', { class: 'fold-tag' + (cls ? ' ' + cls : ''), text: text }); }
  // A name as a row: the name, one gray line, and one tag at most (the user asked, Nov 19, 2026, evening): the temple
  // countdown, a baptism date and the like go into the gray line, so the lists read as calmly as Ward Council's.
  // Ask ward council and Before Ward Council (the user asked, Nov 19, 2026, night): tapping a name opens its steps right
  // there, one name at a time. Ask ward council shows what's still open; Before Ward Council shows every step (to fix a
  // mistake either way) and Edit details for the name and dates.
  var expOpen = '', expKeys = null;
  function expRow(kind, gid, i, a) {
    var li = personRow(kind, gid, i, a), key = kind + '|' + gid + '|' + i, open = expOpen === key, btn = li.querySelector('.person-row');
    btn.setAttribute('data-action', 'row-toggle'); btn.setAttribute('data-a', key); btn.removeAttribute('data-b'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    li.classList.add('exp-li'); if (open) li.classList.add('is-open');
    var chev = btn.querySelector('.step-chev'); if (chev) { chev.textContent = '›'; chev.classList.add('exp-chev'); }
    var openList = openChecks(a, gid);
    if (kind === 'wc') { var stt = btn.querySelector('.step-status'); if (stt && stt.firstChild && stt.firstChild.nodeType === 3) stt.firstChild.nodeValue = openList.length ? plural(openList.length, 'step', 'steps') + ' open' : 'Every step done'; }
    if (!open) return li;
    var items = (CHECKLISTS[gid] || []).filter(function (c) { return kind === 'bw' || (expKeys || []).indexOf(c.k) >= 0; });
    li.appendChild(h('div', { class: 'exp-body' }, [
      items.length ? h('ul', { class: 'ck-list' }, items.map(function (c) { return ckRow(gid, i, a, c); })) : h('p', { class: 'exp-none', text: 'Every step is done.' }),
      kind === 'bw' ? h('button', { type: 'button', class: 'btn-link exp-edit', 'data-action': 'open-person', 'data-a': gid, 'data-b': i, 'data-kind': 'bw' }, ['Edit details ›']) : null
    ]));
    return li;
  }
  function personRow(kind, gid, i, a) {
    var name = str(a.name).trim(), tags = [], sub, warn = false, bits = [], due = '';
    var isCp = gid !== 'tn' && gid !== 'mr', isFocus = isCp && name && focusIndex(name) >= 0, pr = isCp && !isFocus ? pressingReason(a, gid) : '';
    if (name && cardAge(a) >= STALE_FLAG) tags.push(rowTag('Not updated in 4 weeks', 'due'));
    // A focus name or a suggested one: a thin bar down the row's left edge and one line of words (Nov 19, 2026, night):
    // gold "★ Focus name", red "Suggested focus name · Temple: 3 days left".
    var flag = isFocus ? { cls: 'flag-focus', text: '★ Focus name' } : pr ? { cls: 'flag-sug', text: 'Suggested focus name · ' + pr } : null;
    var temple = function () { if (gid === 'nm' && name) { var ts = templeStatus(a, state.date); if (!ts.done) due = 'Temple: ' + ts.short; else if (kind === 'bw') bits.push('✓ Temple'); } };
    if (kind === 'hd') {
      temple();
      if (gid === 'bt' && a.committed) bits.push(baptismNote(a));
      if (gid === 'bt' && apptNote(a)) bits.push(apptNote(a));
      if (a.sac) bits.push('✓ Sacrament');
      if (a.actionCarried && str(a.action).trim() && !tags.length) tags.push(rowTag('Carried forward', 'carried'));
      sub = [str(a.action).trim(), str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
      if (isCp && !CP_SECTION) { var hcc = checkCount(a, gid); sub = isFocus ? 'Assignment under Focus names' : name ? hcc.done + ' of ' + hcc.of + ' done' : ''; } // the rest of the report, for reference
      else if (!sub && name) { sub = 'Needs an assignment'; warn = true; }
    } else if (kind === 'bw' || (kind === 'wc' && isCp)) {
      // Before Ward Council and Ward Council's Covenant Path Report: how far along their report is, at a glance.
      temple();
      if (gid === 'bt' && baptismNote(a)) bits.push(baptismNote(a));
      if (gid === 'bt' && apptNote(a)) bits.push(apptNote(a));
      if (name) { var bcc = checkCount(a, gid); sub = bcc.done + ' of ' + bcc.of + ' done'; }
    } else {
      // Ward Council's focus names: the next ordinance, or what it needs.
      var ord = ordOf(a, gid);
      sub = ord ? 'Next: ' + ord : '';
      if (gid === 'tn' && name && !ord) { sub = ''; tags = [rowTag('Needs a next ordinance', 'due')]; }
      else if (gid === 'tn' && name && ordDone(a)) { sub = ord + ' is done'; tags = [rowTag('Choose the next ordinance', 'due')]; }
    }
    if (flag && flag.cls === 'flag-sug' && pr.indexOf('Temple') === 0) due = ''; // the suggestion already says it
    if (bits.length || due) sub = [sub].concat(bits).filter(Boolean).join(' · ');
    tags = tags.slice(0, 1);
    if (!name) sub = sub || 'Tap to add';
    var title = name || (gid === 'tn' ? 'Focus name ' + (i + 1) : 'No name yet');
    var swipe = gid === 'tn' && name && kind !== 'bw';
    return h('li', { class: [swipe ? 'swipe-li' : '', flag ? flag.cls : ''].join(' ').trim() || null }, [swipe ? h('button', { type: 'button', class: 'swipe-del', 'data-action': 'swipe-remove-tn', 'data-a': i, 'aria-label': 'Remove ' + name + ' from Focus names', text: 'Remove' }) : null,
      h('button', { type: 'button', class: 'nav-row person-row' + (name ? '' : ' is-blank'), 'data-action': 'open-person', 'data-a': gid, 'data-b': i, 'data-kind': kind,
      'aria-label': title + (flag ? '. ' + flag.text : '') + '. ' + sub + (due ? '. ' + due : '') }, [
      initialsDot(name),
      h('span', { class: 'step-text' }, [
        h('span', { class: 'step-title person-name', text: title }),
        flag ? h('span', { class: 'row-flag', text: flag.text }) : null,
        h('span', { class: 'step-status' + (warn ? ' warn' : '') }, [sub, due ? h('span', { class: 'row-due', text: (sub ? ' · ' : '') + due }) : null]),
        tags.length ? h('span', { class: 'row-tags' }, tags) : null
      ]),
      h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
    ])]);
  }
  // A list as rows, grouped the way an iPhone groups a list: the names, then "Add a name" as the last row.
  // kind 'hd' = the huddle's list (an empty one can be confirmed as "none this week"), 'wc' = ward council's,
  // 'bw' = Before ward council's (the same names, with what the Covenant Path Report says about each).
  function referralRow(kind, i, x) {
    var name = str(x.name).trim(), by = str(x.by).trim(), notes = str(x.notes).trim();
    var sub = [by ? 'Referred by ' + by : '', notes].filter(Boolean).join(' · ') || (name ? 'No details yet' : 'Tap to add');
    return h('li', {}, [h('button', { type: 'button', class: 'nav-row person-row' + (name ? '' : ' is-blank'), 'data-action': 'open-person', 'data-a': 'mr', 'data-b': i, 'data-kind': kind,
      'aria-label': (name || 'No name yet') + '. ' + sub }, [
      initialsDot(name),
      h('span', { class: 'step-text' }, [
        h('span', { class: 'step-title person-name', text: name || 'No name yet' }),
        h('span', { class: 'step-status', text: sub })
      ]),
      h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
    ])]);
  }
  function rowsPanel(kind, gid, title) {
    if (gid === 'mr') {
      var refs = state.referrals.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return !refBlank(o.x); });
      var rrows = refs.map(function (o) { return referralRow(kind, o.i, o.x); });
      rrows.push(h('li', {}, [h('button', { type: 'button', class: 'nav-row add-row', 'data-action': 'add-person', 'data-a': 'mr', 'data-kind': kind, 'aria-label': 'Add a referral' }, [icon('plus'), h('span', { text: 'Add a referral' })])]));
      var mattrs = { class: 'list-panel rows list-mr' + (refs.length ? '' : ' is-empty'), 'aria-label': title };
      mattrs[kind === 'wc' ? 'data-wc' : 'data-group'] = 'mr';
      return h('section', mattrs, [h('div', { class: 'list-head' }, [
        h('h3', { class: 'list-title', text: title }),
        h('span', { class: 'list-count', text: plural(refs.length, 'referral', 'referrals') })
      ]), h('ul', { class: 'steps-list person-rows' }, rrows)]);
    }
    var isTn = gid === 'tn', list = isTn ? state.tn : state.cp[gid];
    var rows = list.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return isTn ? kind !== 'hd' || !!str(x.a.name).trim() : !cardBlank(x.a); }) // the Huddle has no empty focus name spots
      .map(function (x) { return !isTn && (kind === 'bw' || (kind === 'wc' && view === 'wc-cp')) ? expRow(kind, gid, x.i, x.a) : personRow(kind, gid, x.i, x.a); });
    var sh2 = isTn ? swipeHint(rows) : null; if (sh2) rows.push(sh2);
    if (isTn && kind === 'hd' && !rows.length) rows.push(h('li', { class: 'list-empty' }, [h('p', { class: 'list-empty-text', text: 'No focus names yet. Ward Council chooses them.' })]));
    var named = rows.length, ok = !isTn && kind === 'hd' && noneConfirmed(gid);
    if (ok) rows.push(h('li', { class: 'list-empty confirmed' }, [
      h('p', { class: 'list-empty-text' }, [icon('check'), h('span', { text: 'No one on the Covenant Path Report this week' })]),
      h('button', { type: 'button', class: 'btn-link list-empty-undo', 'data-action': 'cp-none-undo', 'data-a': gid, 'aria-label': 'Undo none this week for ' + title, text: 'Undo' })
    ]));
    if (!isTn && kind !== 'wc') { // names are added in Before ward council (the user decided, Nov 19, 2026)
      var add = h('button', { type: 'button', class: 'nav-row add-row', 'data-action': 'add-person', 'data-a': gid, 'data-kind': kind, 'aria-label': 'Add a name to ' + title }, [icon('plus'), h('span', { text: 'Add a name' })]);
      rows.push(h('li', {}, [add]));
      if (kind === 'hd' && !named && !ok) rows.push(h('li', {}, [h('button', { type: 'button', class: 'nav-row none-row', 'data-action': 'cp-none', 'data-a': gid }, [h('span', { text: 'Confirm none this week' })])]));
    }
    var kids = [h('div', { class: 'list-head' }, [
      h('h3', { class: 'list-title', text: title }),
      h('span', { class: 'list-count', text: isTn ? tnCountText() : ok ? 'None this week' : countText(countNamed(gid)) }),
      (kind === 'hd' || kind === 'wc') && HOW_HELP[gid] ? howHelpLink(gid) : null // the Huddle and ward council (not Before ward council)
    ]), h('ul', { class: 'steps-list person-rows' }, rows)];
    if (kind === 'hd' && gid === 'nm' && named) kids.push(h('p', { class: 'temple-goal', text: 'Goal: every new member attends the temple for baptisms for the dead within 30 days of their baptism.' }));
    var attrs = { class: 'list-panel rows list-' + gid + (named ? '' : ' is-empty'), 'aria-label': title };
    attrs[kind === 'wc' ? 'data-wc' : kind === 'bw' ? 'data-bw' : 'data-group'] = gid;
    return h('section', attrs, kids);
  }
  // A referral's fields: the same in the Huddle and in ward council.
  function referralFields(i, nameInHeader) {
    var base = 'referrals.' + i + '.';
    return h('div', { class: 'card-grid' }, [
      nameInHeader ? null : field('Name', base + 'name', { full: true, placeholder: 'Who is being referred', cap: 'words' }),
      field('Referred by', base + 'by', { full: true, placeholder: 'Who gave the referral', cap: 'words' }),
      field('Notes', base + 'notes', { full: true, multi: true, placeholder: 'Anything that helps the missionaries' }),
      h('div', { class: 'assign-actions' }, [h('button', { type: 'button', class: 'btn-text-assign', 'data-action': 'text-referral', 'data-a': i }, [icon('chat'), h('span', { class: 'bta-label', text: 'Text this referral to the missionaries' })])])
    ]);
  }
  // One person's own screen: the huddle's card or ward council's, with a way to take them off the list.
  function renderPerson() {
    var wrap = $('#person-card'); if (!wrap) return;
    var r = personRef, a = isPerson(view) && personOk(r) ? personCard(r) : null;
    if (!a) { wrap.replaceChildren(); return; }
    if (r.g === 'opp') { wrap.replaceChildren.apply(wrap, oppScreen(r.i)); return; }
    var isRef = r.g === 'mr';
    var base = r.g === 'tn' ? 'tn.' + r.i + '.' : 'cp.' + r.g + '.' + r.i + '.';
    var card = isRef ? h('div', { class: 'card ref-card' }, [referralFields(r.i, true)]) : r.kind === 'wc' ? wcPersonCard(r, a) : r.kind === 'bw' ? bwPersonCard(r, a) : hdPersonCard(r, a);
    var remove = h('button', { type: 'button', class: 'btn-link danger person-remove', 'data-action': r.g === 'tn' ? (str(a.name).trim() ? 'swipe-remove-tn' : 'quick-remove-tn') : isRef ? 'remove-mr' : 'remove-cp',
      'data-a': r.g === 'tn' || isRef ? r.i : r.g, 'data-b': r.g === 'tn' || isRef ? '' : r.i,
      hidden: rowBlank(r.g, a) }, [r.g === 'tn' ? (str(a.name).trim() ? 'Remove from Focus names' : 'Clear this focus name') : 'Remove from the list']);
    var attrs = { class: 'list-panel person-panel list-' + r.g, 'aria-label': personTitle(r) };
    attrs[r.kind === 'wc' ? 'data-wc' : r.kind === 'bw' ? 'data-bw' : 'data-group'] = r.g;
    var done = h('button', { type: 'button', class: 'btn-primary full person-done', 'data-action': 'steps-home' }, ['Done']);
    // Ward council's screen asks the 4-week question too (the huddle's card carries its own).
    var note = (r.kind === 'wc' || r.kind === 'bw') && !isRef ? staleNote(base, a, r.g === 'tn') : null;
    // The top of the screen is tinted with their list's color: initials, name, and which list they're on.
    // The name is edited right in the header: tap it (or the pencil on the initials) and it becomes a text box.
    // It is the only place the name is edited, on every person's screen.
    var dot = initialsDot(a.name); dot.appendChild(h('span', { class: 'avatar-pencil', 'aria-hidden': 'true' }, [icon('pencil')]));
    var namePath = isRef ? 'referrals.' + r.i + '.name' : base + 'name';
    var nameBox = h('input', { type: 'text', class: 'person-head-input', 'data-bind': namePath, value: str(a.name), 'aria-label': 'Name',
      placeholder: r.g === 'tn' ? 'Focus name' : isRef ? 'Who is being referred' : 'Name, as in the Covenant Path Report',
      autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done', maxlength: '300' });
    var head = h('div', { class: 'person-head', 'data-action': 'edit-name', role: 'button', tabindex: '0', 'aria-label': 'Edit the name: ' + personTitle(r) }, [dot, h('div', { class: 'person-head-text' }, [
      h('p', { class: 'person-head-name', text: personTitle(r) }), h('p', { class: 'person-head-list', text: LIST_LABEL[r.g] })]), nameBox]);
    wrap.replaceChildren(h('section', attrs, [head, note, card]), done, remove);
    if (r.g === 'nm') updateTemple();
  }
  // Missionary Referrals: one section, shown in the Huddle and in ward council.
  function renderMR() {
    var wrap = $('#mr-list'); if (!wrap) return;
    if (rowsOn) { wrap.replaceChildren(rowsPanel(view === 'wc-mr' ? 'wc' : 'hd', 'mr', 'Referrals')); return; }
    // (Cards-open and one-page layouts: every referral's fields in the list.)
    var cards = state.referrals.map(function (x, i) {
      return h('div', { class: 'card ref-card' }, [
        h('div', { class: 'card-head' }, [h('p', { class: 'fn-assign-label', text: 'Referral ' + (i + 1) }), removeButton('remove-mr', i, '', 'Remove referral ' + (i + 1))]),
        referralFields(i)
      ]);
    });
    wrap.replaceChildren(h('section', { class: 'list-panel list-mr', 'data-group': 'mr', 'aria-label': 'Missionary referrals' },
      cards.concat([h('div', { class: 'list-foot' }, [addButton('add-mr', '', 'Add referral')])])));
  }

  function renderCP() {
    var wrap = $('#cp-groups');
    if (rowsOn) {
      GROUPS.forEach(function (g) { if (!listEmpty(g.id)) state.cpNone[g.id] = false; });
      wrap.replaceChildren.apply(wrap, GROUPS.map(function (g) { return rowsPanel('hd', g.id, g.title); }));
      if (isPerson(view)) renderPerson();
      return;
    }
    wrap.replaceChildren.apply(wrap, GROUPS.map(function (g) {
      var items = state.cp[g.id];
      if (!listEmpty(g.id)) state.cpNone[g.id] = false;
      // (The long all-on-one-page layout, used only for testing, keeps the blank card.)
      if (stepsOn && listEmpty(g.id) && !showBlank[g.id]) return emptyListPanel(g);
      // Every card can be removed; removing the last one brings back the empty-list choice.
      var many = items.length > 1;
      var cards = items.map(function (it, i) { return cpCard(g, it, i, stepsOn || many); });
      var named = countNamed(g.id);
      var head = h('div', { class: 'list-head' }, [
        h('h3', { class: 'list-title', text: g.title }),
        h('span', { class: 'list-count', text: countText(named) }),
        howHelpLink(g.id)
      ]);
      var extra = g.id === 'nm' ? [
        h('p', { class: 'temple-goal', text: 'Goal: every new member attends the temple for baptisms for the dead within 30 days of their baptism.' })
      ] : [];
      if (folded(g.id)) return foldedPanel('list-panel list-' + g.id, g.id, g.title, countText(named), items, { 'data-group': g.id }, function (i) { return cpCard(g, items[i], i, many); });
      return h('section', { class: 'list-panel list-' + g.id, 'data-group': g.id, 'aria-label': g.title }, [head]
        .concat(extra).concat(cards).concat([h('div', { class: 'list-foot' }, [addButton('add-cp', g.id, 'Add action'), doneButton(g.id, g.title)])]));
    }));
    updateTemple();
  }
  function cpCard(g, it, i, many) {
        var base = 'cp.' + g.id + '.' + i + '.';
        return h('div', { class: 'card' }, [
          staleNote(base, it, false),
          h('div', { class: 'card-head name-head' }, [
            h('div', { class: 'card-title' }, [avatar(), nameInput(base + 'name', 'Name'),
              many ? removeButton('remove-cp', g.id, i, 'Remove action ' + (i + 1) + ' for ' + g.title) : null]),
            h('div', { class: 'card-head-right' }, [sacToggle(base + 'sac', it.sac)])
          ]),
          cardFields(base, 'Name', 'From the Covenant Path Report', 'e.g. Sat 9 am', it.carried ? h('span', { class: 'source', text: fromLabel() }) : null, g.id === 'nm' ? 'Baptism date' : g.id === 'bt' ? 'Scheduled baptism date' : '', 'Tap their name in the Covenant Path Report to identify needs', '',
            g.id === 'nm' ? templeBox(base, i, it) : g.id === 'bt' ? committedBox(base, it) : null, FIXED_ORD[g.id]),
          g.id === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': i }, ['Move to New members']) : null
        ]);
  }

  // Red until checked: the Temple attendance box on each New member card.
  function templeBox(base, i, it) {
    var st = templeStatus(it, state.date);
    return h('label', { class: 'temple-box' + (st.done ? ' is-done' : ''), 'data-temple': i }, [
      h('input', { type: 'checkbox', 'data-bind': base + 'temple', checked: !!it.temple }),
      h('span', { class: 'sac-box temple-check', 'aria-hidden': 'true' }, [icon('check')]),
      h('span', { class: 'temple-text' }, [
        h('strong', { text: 'Temple attendance' }),
        h('span', { class: 'temple-sub', text: st.done ? '✓ Baptisms for the dead done' : st.text })
      ])
    ]);
  }
  // Those being taught → New members, keeping everything typed. The baptism date carries over,
  // so the 30-day temple count starts right away.
  function convertToNewMember(i) {
    var it = state.cp.bt[i]; if (!it) return;
    var name = str(it.name).trim();
    if (!name) { toast('Add their name first.'); return; }
    ask({
      title: 'Move ' + name + ' to New members?',
      body: 'Everything entered for them moves too, including the baptism date. The 30-day temple count starts from that date.',
      primary: 'Move to New members',
      onPrimary: function () {
        var c = blankAction();
        CARD_KEYS.forEach(function (k) { c[k] = str(it[k]); });
        c.sac = !!it.sac;
        if (/^baptism$/i.test(str(c.ordinance).trim())) c.ordinance = '';
        state.cp.bt.splice(i, 1); delete state.openOne.bt;
        if (!state.cp.bt.length) state.cp.bt.push(blankAction());
        var nm = state.cp.nm;
        delete state.collapsed.nm;
        if (nm.length === 1 && !nm[0].sac && !hasText(nm[0], CARD_KEYS)) nm.pop();
        nm.push(c);
        if (isPerson(view)) { // their screen follows them to New members
          personRef = { kind: personRef ? personRef.kind : 'hd', g: 'nm', i: nm.length - 1 }; personWcOpen = wcOpenDefault(personRef);
          try { history.replaceState({ hv: view, pushed: true, ref: personRef }, ''); } catch (e) { /* ignore */ }
          $('#step-title').textContent = personTitle(personRef);
        }
        renderCP(); saveDraft();
        var cards = document.querySelectorAll('[data-group="nm"] .card, #person-card [data-wc="nm"] .card');
        var card = cards[cards.length - 1];
        if (card) {
          card.scrollIntoView({ block: 'center', behavior: 'smooth' });
          card.classList.add('just-moved'); setTimeout(function () { card.classList.remove('just-moved'); }, 1600);
          if (!c.bap) { var d = card.querySelector('[data-bind$=".bap"]'); if (d) setTimeout(function () { d.focus({ preventScroll: true }); }, 400); }
        }
        toast(name + ' moved to New members.' + (c.bap ? '' : ' Add the baptism date to start the 30-day temple count.'));
      },
      secondary: 'Cancel'
    });
  }
  function committedBox(base, it) {
    return h('label', { class: 'commit-box' }, [
      h('input', { type: 'checkbox', 'data-bind': base + 'committed', checked: !!it.committed }),
      h('span', { class: 'sac-box commit-check', 'aria-hidden': 'true' }, [icon('check')]),
      h('strong', { text: 'Committed to baptism' })
    ]);
  }
  function updateTemple() {
    state.cp.nm.forEach(function (it, i) {
      var st = templeStatus(it, state.date);
      var box = document.querySelector('[data-group="nm"] [data-temple="' + i + '"], #person-card [data-wc="nm"] [data-temple="' + i + '"], #person-card [data-bw="nm"] [data-temple="' + i + '"]');
      if (box) {
        box.classList.toggle('is-done', st.done);
        box.querySelector('.temple-sub').textContent = st.done ? '✓ Baptisms for the dead done' : st.text;
      }
    });
  }
  function renderTN() {
    var wrap = $('#tn-list');
    if (rowsOn) { wrap.replaceChildren(rowsPanel('hd', 'tn', 'Focus names')); if (isPerson(view)) renderPerson(); return; }
    var cards = state.tn.map(function (n, i) { return tnCard(n, i); });
    var head = h('div', { class: 'list-head' }, [
      h('h3', { class: 'list-title', text: 'Focus names' }),
      h('span', { class: 'list-count', text: tnCountText() })
    ]);
    if (folded('tn')) { wrap.replaceChildren(foldedPanel('list-panel list-tn', 'tn', 'Focus names', tnCountText(), state.tn, {}, function (i) { return tnCard(state.tn[i], i); })); return; }
    wrap.replaceChildren(h('section', { class: 'list-panel list-tn', 'aria-label': 'Focus names' }, [head].concat(cards).concat([h('div', { class: 'list-foot' }, [doneButton('tn', 'Focus names')])])));
  }
  function tnCard(n, i) {
    var base = 'tn.' + i + '.';
    return h('div', { class: 'card' }, [
      staleNote(base, n, true),
      h('div', { class: 'card-head name-head' }, [
        h('div', { class: 'card-title' }, [avatar(), nameInput(base + 'name', 'Focus name ' + (i + 1))]),
        h('div', { class: 'card-head-right' }, [sacToggle(base + 'sac', n.sac)])
      ]),
      cardFields(base, 'Focus name', 'Focus name', 'e.g. Sat 9 am', n.carried ? h('span', { class: 'source', text: fromLabel() }) : null, '', 'e.g. A ride to the temple', 'e.g. Sacrament')
    ]);
  }
  // Opportunities to invite: ward council adds each upcoming opportunity (a name and a date) as a card;
  // the huddle adds assignments under it. Each card starts closed (its name, date and how many assignments) and opens
  // when tapped. In the app itself (rows) each opportunity is a row that opens on its own screen, and there is no
  // "Other ways to invite" (the user took it out); that card stays only in the cards-open layout used by tests.
  // An empty assignment shows the invite ideas as quick picks for "Assignment"; "Assigned to" says who.
  // (The user took the Tip of the week and the source line off these cards on Nov 18, 2026; the Tips sheet keeps its source line.)
  var OPP_STARTERS = ['Special sacrament meeting', 'Christmas sacrament meeting', 'Easter sacrament meeting', 'Member speaking in sacrament meeting', 'Stake conference', 'Ward conference', 'Ward activity', 'Youth activity', 'Dinner or home evening', 'Baptismal service', 'Sports night', 'Self-reliance or other classes', 'Service project'];
  var INVITE_IDEAS = ['Members invite friends and neighbors', 'Members go on a visit with the missionaries', 'Share it on the ward’s activity page'];
  function chips(action, a, list) {
    return h('div', { class: 'idea-chips' }, list.map(function (t) { return h('button', { type: 'button', class: 'idea-chip', 'data-action': action, 'data-a': a, 'data-b': t, text: t }); }));
  }
  var oppOpen = {}; // which opportunity cards are open, by id (not saved)
  function oppSummaryText(o, mine) {
    var bits = [], d = str(o.date).trim(), typed = mine.filter(function (m) { return str(m.x.task).trim(); }).length;
    if (d) bits.push(whenShow(d));
    bits.push(typed ? plural(typed, 'assignment', 'assignments') : 'Needs an assignment');
    return bits.join(' · ');
  }
  function fnAssign(x, i, n) {
      var base = 'find.items.' + i + '.';
      return h('div', { class: 'fn-assign' }, [
        h('div', { class: 'fn-assign-head' }, [
          n === '' ? h('span') : h('p', { class: 'fn-assign-label', text: 'Assignment ' + n }),
          x.carried && str(x.task).trim() ? carriedTag() : null,
          removeButton('remove-fn', i, '', 'Remove assignment ' + n)
        ]),
        h('div', { class: 'fn-fields' }, [
          field('Assignment', base + 'task', { multi: true, placeholder: 'e.g. Invite a friend to come' }),
          str(x.task).trim() ? null : h('div', { class: 'invite-ideas' }, [h('p', { class: 'idea-k', text: 'Ways to invite: tap one' }), chips('invite-idea', i, INVITE_IDEAS)]),
          field('Assigned to', base + 'who', { placeholder: 'e.g. The Rivera family', cap: 'words' }),
          whenField('When', base + 'when', { placeholder: 'e.g. Sat' }),
          h('div', { class: 'assign-actions' }, [textAssignButton(base)])
        ])
      ]);
  }
  // On an opportunity's screen each assignment is one line (what, who and when, and how it went); tap it for its
  // details. An assignment from an earlier huddle keeps its status from Return and Report until the date passes.
  var asgOpen = {};
  var STATUS_WORD = { Yes: 'Done', Partly: 'Partly', No: 'Not done' };
  function fnLine(x, i) {
    var t = str(x.task).trim(), sub = [str(x.who).trim(), whenShow(x.when)].filter(Boolean).join(' · ');
    var tag = x.past ? h('span', { class: 'wc-status', 'data-status': statusOf(x.status) || 'pending', text: STATUS_WORD[x.status] || 'Pending' }) : null;
    var d = h('details', { class: 'fn-line' + (x.past ? ' is-past' : ''), 'data-fid': x.id }, [
      h('summary', { class: 'fn-line-sum' }, [
        h('span', { class: 'fn-line-text' }, [h('span', { class: 'fn-line-title', text: t || 'New assignment' }), sub ? h('span', { class: 'fn-line-sub', text: sub }) : null]),
        tag
      ]),
      fnAssign(x, i, '')
    ]);
    if (asgOpen[x.id] || (!t && !x.past)) d.open = true;
    d.addEventListener('toggle', function () { asgOpen[x.id] = d.open; if (!d.open) { var tt = d.querySelector('.fn-line-title'), ss = d.querySelector('.fn-line-sub');
      tt.textContent = str(x.task).trim() || 'New assignment'; var sb = [str(x.who).trim(), whenShow(x.when)].filter(Boolean).join(' · ');
      if (ss) ss.textContent = sb; else if (sb) tt.parentNode.appendChild(h('span', { class: 'fn-line-sub', text: sb })); } });
    return d;
  }
  function oppItems(id) { return state.find.items.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.opp === id; }); }
  // An opportunity as a row, the way names are rows: a date tile, its name, one status line, a chevron.
  function oppRow(kind, o, k) {
    var t = str(o.title).trim(), d = parseISO(str(o.date));
    var tile = h('span', { class: 'avatar opp-tile' + (d ? '' : ' is-blank'), 'aria-hidden': 'true' }, d ? [h('span', { class: 'opp-tile-m', text: d.toLocaleDateString('en-US', { month: 'short' }) }), h('span', { class: 'opp-tile-d', text: String(d.getDate()) })] : ['+']);
    var mine = oppItems(o.id), typed = mine.filter(function (m) { return str(m.x.task).trim(); }).length;
    // Ward council lists what's coming up; the huddle makes the assignments, so ward council shows only the date.
    var warn = kind !== 'wc' && !typed;
    var sub = kind === 'wc' ? (d ? whenShow(o.date) : 'No date yet') : (d ? whenShow(o.date) + ' · ' : '') + (typed ? plural(typed, 'assignment', 'assignments') : 'Needs an assignment');
    var swipe = !!(t || d || typed);
    return h('li', swipe ? { class: 'swipe-li' } : {}, [swipe ? h('button', { type: 'button', class: 'swipe-del', 'data-action': 'swipe-remove-opp', 'data-a': k, 'aria-label': 'Remove ' + (t || 'this opportunity'), text: 'Remove' }) : null,
      h('button', { type: 'button', class: 'nav-row person-row opp-row' + (t ? '' : ' is-blank'), 'data-action': 'open-person', 'data-a': 'opp', 'data-b': k, 'data-kind': kind, 'aria-label': (t || 'New opportunity') + '. ' + sub }, [
      tile,
      h('span', { class: 'step-text' }, [h('span', { class: 'step-title person-name', text: t || 'New opportunity' }), h('span', { class: 'step-status' + (warn ? ' warn' : ''), text: sub })]),
      h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
    ])]);
  }
  // In the Huddle each opportunity is a card of its own (the user asked, Nov 18, 2026): its name and date at the top
  // (tap to open it), then one line per assignment (what, who and when, how it went), then Add an assignment.
  // Tapping a line opens the opportunity with just that assignment open.
  function oppCard(o, k) {
    var t = str(o.title).trim(), d = parseISO(str(o.date));
    var tile = h('span', { class: 'avatar opp-tile' + (d ? '' : ' is-blank'), 'aria-hidden': 'true' }, d ? [h('span', { class: 'opp-tile-m', text: d.toLocaleDateString('en-US', { month: 'short' }) }), h('span', { class: 'opp-tile-d', text: String(d.getDate()) })] : ['+']);
    var mine = oppItems(o.id).filter(function (m) { return assignHasText(m.x); }).sort(function (p, q) { return (q.x.past ? 1 : 0) - (p.x.past ? 1 : 0); });
    var head = h('button', { type: 'button', class: 'nav-row opp-card-head', 'data-action': 'open-person', 'data-a': 'opp', 'data-b': k, 'data-kind': 'hd', 'aria-label': (t || 'New opportunity') + '. Open it' }, [
      tile, h('span', { class: 'step-text' }, [h('span', { class: 'step-title person-name', text: t || 'New opportunity' }),
        h('span', { class: 'step-status' + (mine.length ? '' : ' warn'), text: (d ? whenShow(o.date) + ' · ' : '') + (mine.length ? plural(mine.length, 'assignment', 'assignments') : 'Needs an assignment') })]),
      h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })]);
    var lines = mine.map(function (m) {
      var x = m.x, sub = [str(x.who).trim(), whenShow(x.when)].filter(Boolean).join(' · ');
      return h('li', {}, [h('button', { type: 'button', class: 'nav-row asg-row', 'data-action': 'open-asg', 'data-a': k, 'data-b': x.id, 'aria-label': (str(x.task).trim() || 'Assignment') + (sub ? '. ' + sub : '') }, [
        h('span', { class: 'step-text' }, [h('span', { class: 'step-title', text: str(x.task).trim() || 'New assignment' }), sub ? h('span', { class: 'step-status', text: sub }) : null]),
        x.past ? h('span', { class: 'wc-status', 'data-status': statusOf(x.status) || 'pending', text: STATUS_WORD[x.status] || 'Pending' }) : null,
        h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })])]);
    });
    lines.push(h('li', {}, [h('button', { type: 'button', class: 'nav-row add-row add-asg-strong', 'data-action': 'add-asg', 'data-a': k, 'aria-label': 'Add an assignment to ' + (t || 'this opportunity') }, [icon('plus'), h('span', { text: 'Add an assignment' })])]));
    return h('section', { class: 'list-panel rows list-fn opp-panel', 'data-opp': o.id, 'aria-label': t || 'Opportunity' }, [h('ul', { class: 'steps-list person-rows' }, [h('li', { class: 'opp-card-top' }, [head])].concat(lines))]);
  }
  // One opportunity's own screen: what's coming up, its date, and its assignments.
  function oppScreen(k) {
    var o = state.find.opps[k], base = 'find.opps.' + k + '.', t = str(o.title).trim(), n = 0;
    var head = h('div', { class: 'person-head opp-head' }, [icon('calendar', 'avatar opp-head-icon'), h('div', { class: 'person-head-text' }, [
      h('p', { class: 'person-head-name', text: t || 'New opportunity' }), h('p', { class: 'person-head-list', text: 'Opportunity to invite' })])]);
    var card = h('div', { class: 'card fn-card opp-card opp-screen', 'data-opp': o.id }, [
      h('div', { class: 'card-grid' }, [
        field('What’s coming up', base + 'title', { full: true, placeholder: 'e.g. Christmas sacrament meeting' }),
        t ? null : h('div', { class: 'full opp-starters' }, [h('p', { class: 'idea-k', text: 'Or tap an idea' }), chips('opp-starter', k, OPP_STARTERS)]),
        field('Event date', base + 'date', { type: 'date', full: true })
      ])
    ].concat(oppItems(o.id).sort(function (p, q) { return (q.x.past ? 1 : 0) - (p.x.past ? 1 : 0); }).map(function (m) { return fnLine(m.x, m.i); })).concat([
      h('div', { class: 'list-foot' }, [addButton('add-fn', o.id, 'Add an assignment')])
    ]));
    return [h('section', { class: 'list-panel person-panel list-fn', 'aria-label': t || 'New opportunity' }, [head, card]),
      h('button', { type: 'button', class: 'btn-primary full person-done', 'data-action': 'steps-home' }, ['Done']),
      h('button', { type: 'button', class: 'btn-link danger person-remove', 'data-action': 'remove-opp', 'data-a': k }, ['Remove this opportunity'])];
  }
  function renderFN() {
    var wrap = $('#fn-list');
    var opps = state.find.opps, items = state.find.items, assign = fnAssign;
    if (!ideasHook) { // the ways to invite hide once "Assignment" has words, and come back if it's emptied (in the list or on an opportunity's screen)
      ideasHook = true;
      document.addEventListener('input', function (e) {
        var t = e.target; if (!t.dataset) return;
        if (/^tn\.\d+\.ordinance$/.test(t.dataset.bind || '') && isPerson(view)) { setTimeout(renderPerson, 0); return; }
        if (/^(?:cp\.\w+|tn)\.\d+\.action$/.test(t.dataset.bind || '')) { var ag = t.closest('.card-grid'), ac = ag && ag.querySelector('.action-chips'); if (ac) ac.hidden = !!t.value.trim(); return; }
        if (/^(?:cp\.\w+|tn)\.\d+\.need$/.test(t.dataset.bind || '')) { var hg = t.closest('.card-grid'), hc = hg && hg.querySelector('.help-chips'); if (hc) hc.hidden = !!t.value.trim(); return; }
        if (/^find\.opps\.\d+\.title$/.test(t.dataset.bind || '')) { var sc = t.closest('.opp-card'), st0 = sc && sc.querySelector('.opp-starters'); if (st0) st0.hidden = !!t.value.trim(); if (t.closest('#person-card')) { var nm0 = t.value.trim() || 'New opportunity', hn = $('#person-card .person-head-name'); if (hn) hn.textContent = nm0; $('#step-title').textContent = nm0; } return; }
        if (!/^find\.items\.\d+\.task$/.test(t.dataset.bind || '')) return;
        var box = t.closest('.fn-assign'), ideas = box && box.querySelector('.invite-ideas');
        if (ideas) ideas.hidden = !!t.value.trim();
      });
    }
    if (rowsOn) {
      var kind = view === 'wc-fn' ? 'wc' : 'hd';
      if (kind === 'hd' && opps.length) { // the Huddle: one card per opportunity, its assignments as lines under it
        wrap.replaceChildren.apply(wrap, opps.map(function (o, k) { return oppCard(o, k); }).concat([
          h('button', { type: 'button', class: 'btn-link btn-add-opp quiet-add', 'data-action': 'add-opp' }, ['+ Add an event'])])); // a small link: the Huddle plans assignments
        return;
      }
      var rows = opps.map(function (o, k) { return oppRow(kind, o, k); });
      var none = !opps.length && state.find.none;
      if (none) rows.push(h('li', { class: 'list-empty confirmed' }, [
        h('p', { class: 'list-empty-text' }, [icon('check'), h('span', { text: 'No upcoming events' })])]));
      else if (!opps.length) rows.push(h('li', { class: 'list-empty opp-empty' }, [
        h('p', { class: 'list-empty-text', text: 'Ward council hasn’t listed any events yet.' }),
        h('p', { class: 'opp-hint', text: 'Add one, or start from an idea.' }),
        chips('opp-starter', '', OPP_STARTERS)]));
      rows.push(h('li', {}, [h('button', { type: 'button', class: 'nav-row add-row', 'data-action': 'add-opp', 'aria-label': 'Add an event' }, [icon('plus'), h('span', { text: 'Add an event' })])]));
      var named = opps.filter(function (o) { return str(o.title).trim(); }).length;
      wrap.replaceChildren(h('section', { class: 'list-panel rows list-fn' + (opps.length ? '' : ' is-empty'), 'aria-label': 'Opportunities to invite' }, [
        h('div', { class: 'list-head' }, [h('h3', { class: 'list-title' }, ['Upcoming', infoBtn('opp-what', 'What counts as an opportunity')]), h('span', { class: 'list-count', text: none ? 'None' : plural(named, 'event', 'events') })]),
        infoText('opp-what', 'Ward activities, special meetings and other events to invite friends to.'),
        h('ul', { class: 'steps-list person-rows' }, rows)]));
      return;
    }
    // (The cards-open layout, used only by tests that fill many cards: every opportunity's card in the list.)
    var mineOf = function (id) {
      return items.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return id ? o.x.opp === id : !opps.some(function (op) { return op.id === o.x.opp; }); });
    };
    var cards = opps.map(function (o, k) {
      var base = 'find.opps.' + k + '.', mine = mineOf(o.id), n = 0, hasTitle = !!str(o.title).trim();
      var sumTitle = h('span', { class: 'fn-assign-title opp-sum-title', text: hasTitle ? o.title.trim() : 'New opportunity' });
      var sumHint = h('span', { class: 'opp-hint opp-sum-hint', text: oppSummaryText(o, mine) });
      var card = h('details', { class: 'card fn-card opp-card opp-fold', 'data-opp': o.id }, [
        h('summary', { class: 'other-ways-sum opp-sum' }, [h('span', { class: 'opp-sum-text' }, [sumTitle, sumHint])]),
        h('div', { class: 'card-grid' }, [
          field('What’s coming up', base + 'title', { full: true, placeholder: 'e.g. Christmas sacrament meeting' }),
          hasTitle ? null : h('div', { class: 'full' }, [h('p', { class: 'idea-k', text: 'Or tap an idea' }), chips('opp-starter', k, OPP_STARTERS)]),
          field('Event date', base + 'date', { type: 'date', full: true })
        ])
      ].concat(mine.map(function (m) { n++; return assign(m.x, m.i, n); })).concat([
        h('div', { class: 'list-foot opp-foot' }, [addButton('add-fn', o.id, 'Add an assignment'), h('button', { type: 'button', class: 'opp-remove', 'data-action': 'remove-opp', 'data-a': k, text: 'Remove' })])
      ]));
      if (oppOpen[o.id]) card.open = true;
      card.addEventListener('toggle', function () {
        oppOpen[o.id] = card.open;
        if (!card.open) { var t = str(o.title).trim(); sumTitle.textContent = t || 'New opportunity'; sumHint.textContent = oppSummaryText(o, mineOf(o.id)); }
      });
      return card;
    });
    if (!opps.length) cards.push(h('div', { class: 'card fn-card opp-empty' }, [
      h('p', { class: 'opp-empty-text', text: 'Ward council hasn’t listed any opportunities yet.' }),
      h('p', { class: 'opp-hint', text: 'Add one here, or start from an idea.' }),
      chips('opp-starter', '', OPP_STARTERS)
    ]));
    // Other ways to invite: assignments not tied to an event, at the bottom and closed until tapped
    var general = mineOf(''), gi = 0;
    var typed = general.some(function (o) { return assignHasText(o.x); });
    var other = h('details', { class: 'card fn-card opp-card other-ways' }, [
      h('summary', { class: 'other-ways-sum' }, [h('span', { class: 'fn-assign-title', text: 'Other ways to invite' }),
        h('span', { class: 'opp-hint', text: typed ? plural(general.filter(function (o) { return assignHasText(o.x); }).length, 'assignment', 'assignments') : 'Not tied to an event' })])
    ].concat(general.map(function (o) { gi++; return assign(o.x, o.i, gi); })).concat([
      h('div', { class: 'list-foot' }, [addButton('add-fn', '', 'Add an assignment')])
    ]));
    if (typed || otherOpen) other.open = true;
    var addOpp = h('button', { type: 'button', class: 'btn-outline full btn-add-opp', 'data-action': 'add-opp' }, ['+ Add an upcoming opportunity']);
    wrap.replaceChildren(h('section', { class: 'list-panel list-fn', 'aria-label': 'Opportunities to invite' }, cards.concat([addOpp, other])));
    other.addEventListener('toggle', function () { otherOpen = other.open; });
  }
  var otherOpen = false, ideasHook = false;
  function fnRedraw() { renderFN(); if (isPerson(view) && personRef && personRef.g === 'opp') renderPerson(); renderSteps(); saveDraft(); }
  /* ---------- Done: fold a finished list to one line per person ---------- */
  // In the four-step view each section is already its own page, so lists don't fold.
  function folded(gid) { return !stepsOn && !!state.collapsed[gid]; }
  function doneButton(gid, title) {
    if (stepsOn) return null;
    var b = h('button', { type: 'button', class: 'btn-done', 'data-action': 'list-done', 'data-a': gid, 'aria-label': 'Done with ' + title });
    b.appendChild(icon('check')); b.appendChild(document.createTextNode(' Done'));
    return b;
  }
  // A tapped name opens as its full card inside the folded list; the rest stay as one line each.
  function openOneRow(gid, i, card, label) {
    return h('li', { class: 'fold-open' }, [
      card,
      h('button', { type: 'button', class: 'btn-outline full btn-close-one', 'data-action': 'close-one', 'data-a': gid }, [icon('check'), ' Done with ' + (label || 'this one')])
    ]);
  }
  function foldButton(gid, i, label, children) {
    return h('li', { class: 'fold-row' }, [
      h('button', { type: 'button', class: 'fold-row-btn', 'data-action': 'edit-one', 'data-a': gid, 'data-b': i, 'aria-label': 'Edit ' + label }, children.concat([
        h('span', { class: 'fold-edit', 'aria-hidden': 'true', text: 'Edit' })
      ]))
    ]);
  }
  function foldedPanel(cls, gid, title, count, items, attrs, cardFor) {
    var open = state.openOne && state.openOne[gid];
    var rows = items.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return str(x.it.name).trim(); }).map(function (x) {
      var it = x.it;
      if (open === x.i && cardFor) return openOneRow(gid, x.i, cardFor(x.i), it.name.trim());
      var tag = null;
      if (gid === 'nm') {
        var st = templeStatus(it, state.date);
        tag = st.done ? null : h('span', { class: 'fold-tag due', text: 'Temple: ' + st.short });
      }
      if (gid === 'bt' && it.committed) tag = h('span', { class: 'fold-tag', text: baptismNote(it) });
      var plan = [str(it.action).trim(), str(it.assigned).trim() ? str(it.assigned).trim() : '', whenShow(it.when)].filter(Boolean).join(' · ');
      return foldButton(gid, x.i, it.name.trim(), [
        h('span', { class: 'fold-line' }, [h('span', { class: 'fold-name', text: it.name.trim() }), tag, it.actionCarried && str(it.action).trim() ? h('span', { class: 'fold-tag carried', text: 'Carried forward' }) : null]),
        h('span', { class: 'fold-plan' + (plan ? '' : ' missing'), text: plan || 'No assignment' })
      ]);
    });
    var head = h('button', { type: 'button', class: 'list-head fold-head', 'data-action': 'list-open', 'data-a': gid, 'aria-expanded': 'false', 'aria-label': title + ' is done. Tap to open and edit.' }, [
      h('span', { class: 'list-title' }, [h('span', { class: 'fold-check', 'aria-hidden': 'true' }, [icon('check')]), ' ' + title]),
      h('span', { class: 'list-count', text: count })
    ]);
    var a = { class: cls + ' is-folded', 'aria-label': title };
    Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return h('section', a, [
      head,
      rows.length ? h('ul', { class: 'fold-list' }, rows) : h('p', { class: 'fold-empty', text: 'No names added.' }),
      rows.length ? h('p', { class: 'fold-hint', text: 'Tap a name to edit just that person.' }) : null,
      h('button', { type: 'button', class: 'btn-reopen', 'data-action': 'list-open', 'data-a': gid, text: 'Edit the whole list' })
    ]);
  }
  function rerenderList(gid) { if (gid === 'rr') renderRR(); else if (gid === 'tn') renderTN(); else renderCP(); }
  function listDone(gid) {
    var finish = function () {
      state.collapsed[gid] = true; delete state.openOne[gid];
      rerenderList(gid);
      saveDraft();
      var el = gid === 'rr' ? $('#rr-list') : gid === 'tn' ? $('#tn-list') : document.querySelector('[data-group="' + gid + '"]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    if (gid === 'rr') {
      var open = state.rr.filter(function (r) { return rrShown(r) && !r.happened; }).length;
      if (open) ask({ title: open === 1 ? '1 item isn’t marked yet' : open + ' items aren’t marked yet', body: 'They don’t have Yes, Partly or No. Mark Return and Report done anyway?', primary: 'Mark done anyway', onPrimary: finish, secondary: 'Keep working' });
      else finish();
      return;
    }
    var items = gid === 'tn' ? state.tn : state.cp[gid];
    var missing = items.filter(function (it) { return str(it.name).trim() && !str(it.action).trim(); }).map(function (it) { return it.name.trim(); });
    if (missing.length) {
      ask({
        title: missing.length === 1 ? missing[0] + ' has no assignment yet' : missing.length + ' people have no assignment yet',
        body: (missing.length === 1 ? '' : missing.join(', ') + '. ') + 'Mark this list done anyway?',
        primary: 'Mark done anyway', onPrimary: finish,
        secondary: 'Keep working'
      });
    } else finish();
  }
  function listOpen(gid) {
    delete state.collapsed[gid]; delete state.openOne[gid];
    rerenderList(gid);
    saveDraft();
  }
  function tnCountText() {
    var n = state.tn.filter(function (x) { return str(x.name).trim(); }).length;
    return n > 3 ? n + ' names' : n + ' of 3 names';
  }
  // Make a Covenant Path name a focus name: the first open spot, or a new one past three (a pressing name can go over).
  // Their next ordinance and needs come along; an action item already on their card moves with them.
  function makeFocus(gid, i) {
    var a = state.cp[gid] && state.cp[gid][i]; if (!a || !str(a.name).trim()) return;
    if (focusIndex(a.name) >= 0) { toast(str(a.name).trim() + ' is already a focus name.'); return; }
    var slot = state.tn.findIndex(function (n) { return !n.sac && !hasText(n, CARD_KEYS); });
    if (slot < 0) { state.tn.push(blankName()); slot = state.tn.length - 1; }
    var t = state.tn[slot];
    t.name = str(a.name).trim(); t.ordinance = ordOf(a, gid); t.need = str(a.need).trim();
    ['action', 'assigned', 'when', 'hneed'].forEach(function (k) { if (str(a[k]).trim() && !str(t[k]).trim()) { t[k] = a[k]; a[k] = ''; } });
    if (a.actionCarried) { t.actionCarried = true; a.actionCarried = false; }
    delete state.collapsed.tn;
    saveDraft(); renderAll();
    toast(t.name + ' is now a focus name.');
  }
  // Sacrament attendance: everyone once (the Covenant Path names, then focus names not on the report), tap to mark.
  // Marking a name marks their focus name card too, so no one is marked twice.
  function saPeople() {
    var out = [], seen = {};
    GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (a, i) { var n = norm(a.name); if (!n || seen[n]) return; seen[n] = 1; out.push({ a: a, gid: g.id, i: i }); }); });
    state.tn.forEach(function (a, i) { var n = norm(a.name); if (!n || seen[n]) return; seen[n] = 1; out.push({ a: a, gid: 'tn', i: i }); });
    return out;
  }
  function setSac(gid, i, on) {
    var a = gid === 'tn' ? state.tn[i] : state.cp[gid] && state.cp[gid][i]; if (!a) return;
    a.sac = on;
    var n = norm(a.name);
    state.tn.forEach(function (t) { if (n && norm(t.name) === n) t.sac = on; });
    GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (c) { if (n && norm(c.name) === n) c.sac = on; }); });
  }
  function renderSA() {
    var wrap = $('#sa-list'); if (!wrap) return;
    var ppl = saPeople();
    var rows = ppl.map(function (x) {
      var name = str(x.a.name).trim(), on = !!x.a.sac;
      return h('li', {}, [h('button', { type: 'button', class: 'nav-row person-row sa-row' + (on ? ' is-on' : ''), 'data-action': 'sa-toggle', 'data-a': x.gid, 'data-b': x.i,
        'aria-pressed': on ? 'true' : 'false', 'aria-label': name + (on ? ', attended' : ', not marked') }, [
        initialsDot(name),
        h('span', { class: 'step-text' }, [h('span', { class: 'step-title person-name', text: name }), h('span', { class: 'step-status', text: LIST_LABEL[x.gid] })]),
        h('span', { class: 'sa-box', 'aria-hidden': 'true' }, [on ? icon('check') : null])
      ])]);
    });
    if (!rows.length) rows.push(h('li', { class: 'list-empty' }, [h('p', { class: 'list-empty-text', text: 'No names yet. Add them in Before Ward Council.' })]));
    wrap.replaceChildren(h('section', { class: 'list-panel rows list-sa', 'aria-label': 'Sacrament attendance' }, [
      h('div', { class: 'list-head' }, [h('h3', { class: 'list-title', text: 'Who attended' }), h('span', { class: 'list-count', text: stepStatus('sa').text })]),
      h('ul', { class: 'steps-list person-rows' }, rows)]));
  }
  // Swipe a focus name left to take it off Focus names (Ward council and the Huddle). They stay on the Covenant Path Report.
  function removeFocus(i) {
    var old = state.tn[i]; if (!old || !str(old.name).trim()) return;
    var copy = JSON.parse(JSON.stringify(old));
    state.tn.splice(i, 1); state.tn = packTn(state.tn); state.tnKept = true; // the spot goes too (and Ward Council has looked at its focus names)
    var redraw = function () { renderTN(); renderWC(); renderBefore(); renderDoors(); renderCP(); renderSA(); renderSteps(); saveDraft(); };
    redraw();
    toast(str(copy.name).trim() + ' is off Focus names.', 5000, { label: 'Undo', run: function () {
      state.tn.splice(Math.min(i, state.tn.length), 0, copy); state.tn = packTn(state.tn);
      redraw();
    } });
  }
  function enableSwipeRemove() {
    var row = null, x0 = 0, y0 = 0, dx = 0, moving = false;
    document.addEventListener('touchstart', function (e) {
      if (e.target.closest && e.target.closest('.swipe-del')) { row = null; return; } // tapping Remove: leave the row open
      var b = e.target.closest && e.target.closest('.swipe-li .person-row');
      Array.prototype.forEach.call(document.querySelectorAll('.swipe-li.is-open'), function (li) { if (!b || li !== b.parentNode) li.classList.remove('is-open'); });
      if (!b || e.touches.length !== 1) { row = null; return; }
      row = b; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; moving = false;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!row) return;
      var mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!moving && Math.abs(my) > Math.abs(mx)) { row = null; return; } // scrolling the page
      moving = true; row.parentNode.classList.add('is-moving'); dx = Math.max(-96, Math.min(0, mx + (row.parentNode.classList.contains('is-open') ? -88 : 0)));
      row.style.transition = 'none'; row.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (!row) return;
      var li = row.parentNode; li.classList.remove('is-moving'); row.style.transition = ''; row.style.transform = '';
      if (moving) { li.classList.toggle('is-open', dx < -44); swallowTap = Date.now(); if (dx < -44) swipeLearned(); }
      row = null;
    });
  }
  var swallowTap = 0;
  function focusBox(g, i, a) {
    if (g === 'tn' || g === 'mr' || !str(a.name).trim()) return null;
    if (focusIndex(a.name) >= 0) return h('p', { class: 'focus-on' }, [icon('check'), h('span', { text: 'A focus name this week. The huddle plans their assignment under Focus names.' })]);
    var pr = pressingReason(a, g);
    return h('div', { class: 'focus-box' + (pr ? ' is-pressing' : '') }, [
      pr ? h('p', { class: 'focus-why' }, ['Suggested focus name · ' + pr, /Temple|temple/.test(pr) ? infoBtn('temple', 'About the temple countdown') : null]) : null,
      pr && /Temple|temple/.test(pr) ? infoText('temple', TEMPLE_WHY) : null,
      h('button', { type: 'button', class: 'btn-outline full btn-focus', 'data-action': 'make-focus', 'data-a': g, 'data-b': i }, ['Make focus name'])
    ]);
  }

  function renderDateHint() {
    var el = $('#date-hint'); if (!el) return;
    var d = parseISO(state.date);
    if (!d) { el.textContent = 'Pick the meeting date.'; return; }
    var day = readMeetingDay();
    var text = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '. Make sure this is the meeting date.';
    if (day !== null && !isNaN(day) && day !== d.getDay()) {
      text += ' Your meetings are usually on ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] + 's.';
    }
    el.textContent = text;
  }
  function renderConducting() {
    Array.prototype.forEach.call(document.querySelectorAll('#conduct-seg button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-a') === state.conducting ? 'true' : 'false');
    });
    var other = $('#conducting-other');
    other.hidden = state.conducting !== 'other';
    other.value = state.conductingOther || '';
  }
  function renderAll() {
    $('#ward').value = state.ward;
    $('#date').value = state.date;
    renderConducting();
    renderDateHint();
    renderAttendees(); renderRR(); renderCP(); renderTN(); renderFN(); renderMR(); renderSA();
    detailsOpen = false; // Huddle Details start closed; tap the box to open them.
    renderDetails(); renderSteps(); renderSent();
  }

  /* ---------- Four steps: the agenda opens as a short checklist ---------- */
  // Return and Report, Covenant Path, Name Next Ordinance, Find New People to Teach, Missionary Referrals.
  // (The PDF's heading for the second one stays "Covenant Path Report Review".)
  // Tap a section to open just that part; "Mark section done" gives it a green check.
  // Return and Report and Sacrament attendance sit at the top with no heading; the Huddle action plan is
  // Focus names and Find New People to Teach. The Covenant Path Report and Missionary Referrals sections are gone.
  var STEPS = [
    { id: 'rr', title: 'Return and Report', band: 'last' },
    { id: 'sa', title: 'Sacrament attendance', band: 'last' },
    { id: 'fn', title: 'Opportunities to invite', band: 'this' },
    { id: 'tn', title: 'Focus names', band: 'this' } // last, so the focus names finish the huddle (the user decided, Nov 19, 2026)
  ];
  // Tests only: 'huddle-cp-section' brings back the Huddle's Covenant Path Report section (action items on each
  // Covenant Path name), so the older checks of those cards, dates and the PDF keep running. Never set for users.
  var CP_SECTION = readFlag('huddle-cp-section');
  if (CP_SECTION) STEPS.splice(2, 0, { id: 'cp', title: 'Covenant Path Report', band: 'this' });
  var VIEW_ALL_KEY = 'huddle-view-all';
  var stepsOn = !readFlag(VIEW_ALL_KEY);
  // Screens: 'start' (the four steps and Send), 'wc' (ward council's two lists, rolled up) with
  // 'wc-cp' and 'wc-tn' (the names in each),
  // 'home' (the huddle's list: details and the four sections) and one screen per section.
  // A link ending in #huddle opens straight to the huddle's list.
  var START = /(^|[#&])huddle($|&)/.test((location.hash || '').replace(/^#/, '')) ? 'home' : 'start';
  var view = START;
  var detailsOpen = false, shownView = '';
  // Lists show one row per name; tapping a name opens that person's own screen ('p-hd' in the huddle,
  // 'p-wc' in ward council). The 'huddle-cards-open' flag keeps every card open in its list instead;
  // it exists for the tests that fill many cards in a row.
  var rowsOn = stepsOn && !readFlag('huddle-cards-open');
  var personRef = null; // { kind: 'hd' | 'wc' | 'bw', g: 'nm' | 'rm' | 'bt' | 'tn', i: index }
  function isPerson(v) { return v === 'p-hd' || v === 'p-wc' || v === 'p-bw'; }
  // Before ward council ('bw') always lists names as rows, so its person screen works in every layout.
  function personOk(r) { return !!(r && (rowsOn || r.kind === 'bw') && personCard(r)); }
  function personList(r) { return r.g === 'opp' ? state.find.opps : r.g === 'tn' ? state.tn : r.g === 'mr' ? state.referrals : state.cp[r.g]; }
  function personCard(r) { var l = r && personList(r); return l ? l[r.i] : null; }
  function personListView(r) {
    if (r.kind === 'bw') return 'bw';
    var sec = r.g === 'opp' ? 'fn' : r.g === 'tn' ? 'tn' : r.g === 'mr' ? 'mr' : 'cp';
    if (r.kind === 'wc' && sec === 'tn') return 'wc'; // the focus names sit on Ward Council's screen
    return r.kind === 'wc' ? 'wc-' + sec : sec;
  }
  function personTitle(r) {
    var a = personCard(r), n = a ? str(r.g === 'opp' ? a.title : a.name).trim() : '';
    if (r.g === 'opp') return n || 'New opportunity';
    return n || (r.g === 'tn' ? 'Focus name ' + (r.i + 1) : r.g === 'mr' ? 'New referral' : 'New name');
  }
  function cardBlank(a) { return !a.sac && !a.temple && !a.committed && !hasText(a, CARD_KEYS); }
  function rowBlank(g, a) { return g === 'opp' ? !str(a.title).trim() && !str(a.date).trim() && !oppItems(a.id).some(function (m) { return assignHasText(m.x); }) : g === 'mr' ? refBlank(a) : cardBlank(a); }
  // The name in a person's header becomes a text box; Done on the keyboard, or tapping elsewhere, puts it back.
  function startNameEdit() {
    var hd = $('#person-card .person-head'), box = hd && hd.querySelector('.person-head-input'); if (!box) return;
    if (hd.classList.contains('editing')) return;
    hd.classList.add('editing'); box._nameWas = str(box.value).trim();
    box.focus({ preventScroll: true }); try { box.setSelectionRange(box.value.length, box.value.length); } catch (e) { /* ignore */ }
    var end = function () {
      box.removeEventListener('blur', end); box.removeEventListener('keydown', key); hd.classList.remove('editing');
      // A changed name: redraw the screen so the parts that follow the name (last huddle's assignment) catch up,
      // unless another box on the screen was just tapped.
      if (norm(box.value) !== norm(box._nameWas || '')) setTimeout(function () { var ae = document.activeElement; if (!(ae && $('#person-card').contains(ae) && ae.matches('input, textarea, select'))) renderPerson(); }, 0);
    };
    var key = function (e) { if (e.key === 'Enter') { e.preventDefault(); box.blur(); } };
    box.addEventListener('blur', end); box.addEventListener('keydown', key);
  }
  function openPerson(kind, g, i, focusName) {
    personRef = { kind: kind, g: g, i: +i }; personWcOpen = wcOpenDefault(personRef); personHdOpen = false;
    showView(kind === 'wc' ? 'p-wc' : kind === 'bw' ? 'p-bw' : 'p-hd', 'push');
    if (focusName) setTimeout(startNameEdit, 60); // a new name: the header is ready to type in
  }
  // Back from a person to the list they're on.
  function leavePerson() {
    if (!isPerson(view)) return;
    var back = personRef ? personListView(personRef) : 'home';
    var st = null; try { st = history.state; } catch (e) { /* ignore */ }
    if (st && isPerson(st.hv) && st.pushed) { try { history.back(); return; } catch (e) { /* fall through */ } }
    showView(back, 'replace');
  }
  // A name that was added but left empty doesn't stay on the list.
  function cleanupPerson() {
    var r = personRef; personRef = null;
    if (!r || r.g === 'tn') return;
    var list = personList(r), a = list[r.i];
    // (A Covenant Path list keeps one blank card as its placeholder; the referral list can be empty.)
    if (a && rowBlank(r.g, a) && list.length > (r.g === 'mr' || r.g === 'opp' ? 0 : 1)) {
      if (r.g === 'opp') state.find.items = state.find.items.filter(function (x) { return x.opp !== a.id; });
      list.splice(r.i, 1); saveDraft();
    }
  }
  function resetView() { view = stepsOn ? START : 'home'; try { history.replaceState({ hv: view }, ''); } catch (e) { /* ignore */ } }
  // The huddle date is today unless someone picked one for this huddle.
  function syncDate() {
    if (state.dateManual || state.date === todayISO()) return false;
    state.date = todayISO(); var df = $('#date'); if (df) df.value = state.date;
    return true;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function stepStatus(id) {
    if (id === 'rr') {
      var items = state.rr.filter(rrShown), n = items.length;
      var from = !!(state.rolledFrom || (state.loaded && state.loaded.date));
      if (!n) return { text: from ? 'Nothing to report from the last huddle' : 'Nothing yet. After your first huddle, the assignments show up here.' };
      var marked = items.filter(function (r) { return r.happened; }).length;
      var carried = items.filter(function (r) { return r.carriedFwd; }).length;
      return { text: (marked === n ? 'All ' + n + ' marked' : marked + ' of ' + n + ' marked') + (carried ? ' · ' + carried + ' carried forward' : ''), warn: marked < n };
    }
    if (id === 'cp' || id === 'tn') {
      var list = id === 'tn' ? state.tn : GROUPS.reduce(function (a, g) { return a.concat(state.cp[g.id]); }, []);
      var named = list.filter(function (a) { return str(a.name).trim(); });
      var missing = named.filter(function (a) { return !str(a.action).trim(); }).length;
      if (!named.length) return { text: id === 'cp' && GROUPS.every(function (g) { return noneConfirmed(g.id); }) ? 'No one on the report this week' : id === 'tn' ? 'None chosen yet' : 'No names yet' };
      if (id === 'cp' && !CP_SECTION) { // the rest of the report, for reference: no action items expected
        var sug = named.filter(function (a) { return focusIndex(a.name) < 0 && GROUPS.some(function (g) { return state.cp[g.id].indexOf(a) >= 0 && pressingReason(a, g.id); }); }).length;
        return { text: plural(named.length, 'person', 'people') + ' · ' + (sug ? sug + ' suggested as focus ' + (sug === 1 ? 'name' : 'names') : 'for reference'), warn: sug > 0 };
      }
      var lead = id === 'tn' ? tnCountText() : plural(named.length, 'person', 'people');
      return { text: lead + ' · ' + (missing ? missing + (missing === 1 ? ' needs' : ' need') + ' an assignment' : 'everyone has an assignment'), warn: missing > 0 };
    }
    if (id === 'sa') {
      var ppl = saPeople(), here = ppl.filter(function (x) { return x.a.sac; }).length;
      return { text: ppl.length ? here + ' of ' + ppl.length + ' attended' : 'No names yet' };
    }
    if (id === 'mr') { var nr = cleanReferrals(state.referrals).length; return { text: nr ? plural(nr, 'referral', 'referrals') : 'None listed' }; }
    // The row names what's coming up and how many still need an assignment: "Christmas sacrament meeting · 1 needs an assignment"
    var named = state.find.opps.filter(function (o) { return str(o.title).trim(); });
    var k = state.find.items.filter(function (x) { return str(x.task).trim(); }).length;
    if (!named.length) return { text: k ? 'No opportunities listed · ' + plural(k, 'assignment', 'assignments') : 'Ward council hasn’t listed any yet', warn: !k };
    var need = named.filter(function (o) { return !state.find.items.some(function (x) { return x.opp === o.id && str(x.task).trim(); }); }).length;
    return { text: named.map(function (o) { return o.title.trim(); }).join(', ') + ' · ' + (need ? need + (need === 1 ? ' needs' : ' need') + ' an assignment' : 'each has an assignment'), warn: need > 0 };
  }
  // Who has an action item (for the Sent message's count).
  function attention() {
    var missing = [], named = 0, temple = null;
    var look = function (g, a, i) { if (!str(a.name).trim()) return; named++; if (!str(a.action).trim()) missing.push({ g: g, i: i, a: a }); };
    GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (a, i) { look(g.id, a, i); }); });
    state.tn.forEach(function (a, i) { look('tn', a, i); });
    state.cp.nm.forEach(function (a, i) {
      if (!str(a.name).trim() || a.temple) return;
      var ts = templeStatus(a, state.date);
      if (ts.left !== undefined && (!temple || ts.left < temple.left)) temple = { g: 'nm', i: i, a: a, left: ts.left };
    });
    return { missing: missing, named: named, temple: temple };
  }
  /* The header card at the top of each of the four steps: the ward, the date and, in the two meetings, how far along
   * things are. The Huddle counts sections marked done; ward council counts names that have a next ordinance. */
  function heroProgress(key) {
    if (key === 'hd') {
      var n = STEPS.filter(function (st) { return state.stepsDone[st.id]; }).length;
      return { done: n, of: STEPS.length, text: n === STEPS.length ? 'All ' + n + ' sections done' : n + ' of ' + STEPS.length + ' sections done' };
    }
    if (key !== 'wc') return null;
    // Ward Council is done when its three cards are: Opportunities to invite, Ask ward council and Focus names.
    var parts = wcParts(), n = ['fn', 'ask', 'tn'].filter(function (k) { return parts.done[k]; }).length;
    if (!n && !focusNamed().length) return null;
    return { done: n, of: 3, text: n === 3 ? 'Ward Council is done' : n + ' of 3 done · next: ' + { fn: 'Opportunities to invite', ask: 'Ask ward council', tn: 'Focus names' }[parts.next] };
  }
  function renderHeroes() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-hero]'), function (el) {
      var key = el.getAttribute('data-hero');
      // The Huddle and After the huddle carry the huddle's own date; the other two happen on the day they're opened.
      var d = (key === 'hd' || key === 'af') && parseISO(state.date) || new Date();
      var hw = el.querySelector('.hero-ward'); // the step's name (or the ward), and the "i" for its instructions
      hw.replaceChildren(h('span', { text: state.ward.trim() || { hd: 'Huddle', wc: 'Ward Council', bw: 'Before Ward Council', af: 'After the huddle' }[key] }), infoBtn('intro-' + key, 'What to do here'));
      hw.lastChild.classList.add('hero-i');
      el.querySelector('.hero-date').textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      var box = el.querySelector('.hero-progress'); if (!box) return;
      var pr = heroProgress(key); box.hidden = !pr; if (!pr) return;
      box.querySelector('.hero-count').textContent = pr.text;
      box.classList.toggle('full', pr.done === pr.of);
      var fill = box.querySelector('.hero-fill'), w = Math.round(100 * pr.done / pr.of) + '%';
      // (Set a moment later, so the bar is seen moving when the page it's on comes back into view.)
      if (fill.getAttribute('data-w') !== w) { fill.setAttribute('data-w', w); setTimeout(function () { fill.style.width = w; }, 60); }
    });
  }
  var justDone = { id: '', at: 0 }; // the section marked done a moment ago: its check pops once
  // Sections open in any order; a finished one gets a green check.
  function renderSteps() {
    if (!$('#steps-home')) return;
    renderHeroes();
    var fc = $('#fn-count'); if (fc) fc.textContent = plural(state.find.items.filter(function (x) { return str(x.task).trim(); }).length, 'assignment', 'assignments');
    // Up next (the user asked, Nov 19, 2026, night): Attendees, then each section in order; the first not done is highlighted.
    var upNext = !state.attendees.length ? 'att' : (STEPS.filter(function (x) { return !state.stepsDone[x.id]; })[0] || {}).id || '';
    var ds = $('#details-summary'); if (ds) { ds.classList.toggle('is-next', upNext === 'att'); ds.classList.toggle('is-done', !!state.attendees.length); }
    var row = function (st) {
      var isDone = !!state.stepsDone[st.id], status = stepStatus(st.id), isNext = upNext === st.id;
      var num = null;
      if (isDone) { num = h('span', { class: 'step-num' + (justDone && justDone.id === st.id && Date.now() - justDone.at < 1500 ? ' pop' : ''), 'aria-hidden': 'true' }); num.appendChild(icon('check')); }
      return h('li', { class: isNext ? 'is-next' : null }, [h('button', { type: 'button', class: 'nav-row step-row' + (isDone ? ' done' : '') + (isNext ? ' is-next' : ''), 'data-action': 'open-step', 'data-a': st.id,
        'aria-label': st.title + (isDone ? ', done' : isNext ? ', up next' : '') + '. ' + status.text }, [
        tile(st.id),
        h('span', { class: 'step-text' }, [
          h('span', { class: 'step-title' }, [st.title, isNext ? h('span', { class: 'row-next', text: 'Up next' }) : null]),
          h('span', { class: 'step-status' + (status.warn ? ' warn' : ''), text: status.text })
        ]),
        num,
        h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
      ])]);
    };
    $('#steps-last').replaceChildren.apply($('#steps-last'), STEPS.filter(function (st) { return st.band === 'last'; }).map(row));
    $('#steps-this').replaceChildren.apply($('#steps-this'), STEPS.filter(function (st) { return st.band === 'this'; }).map(row));
    if (view !== 'home') renderStepFoot();
  }
  // The sections in order, for Next and the link back: the Huddle's, or ward council's three lists.
  function footList() { return isWcList(view) ? WC_LISTS.map(function (l) { return { id: 'wc-' + l.id, title: l.title }; }) : STEPS; }
  function renderStepFoot() {
    var list = footList(), i = list.findIndex(function (st) { return st.id === view; });
    var hint = $('#step-gate-hint'); if (hint) hint.hidden = true;
    // One big button per screen (the user asked, Nov 19, 2026, night): no Next and Back links under it.
    $('#step-next').hidden = true; $('#step-prev').hidden = true;
    if (view === 'wc-pick') { $('#step-done-btn').hidden = true; var ul0 = $('#step-foot .undone-link'); if (ul0) ul0.hidden = true; return; }
    if (i < 0) return;
    var nxt = list[i + 1], prv = list[i - 1], wcSec = isWcList(view), btn = $('#step-done-btn');
    btn.hidden = wcSec && view !== 'wc-fn' && view !== 'wc-cp'; // Opportunities to invite and the Covenant Path Report (Ask ward council) have the button
    btn.classList.remove('is-blocked');
    if (view === 'wc-fn') markDoneBtn(btn, oppsOk(), 'wc-opps-undone', 'steps-home', oppsTitled() ? 'Done' : 'No upcoming events', 'wc-opps-done');
    else if (view === 'wc-cp') markDoneBtn(btn, askOk(), 'wc-ask-undone', 'steps-home', state.ask && state.ask.changed ? 'Done' : 'No changes this week', 'wc-ask-done');
    else if (!wcSec) {
      var gate = state.stepsDone[view] ? null : stepGate(view);
      markDoneBtn(btn, !!state.stepsDone[view], 'step-undone', 'steps-home', 'Mark done', 'step-done');
      // What's still needed is a plain gray line above a gray Mark done (tapping it still opens what's missing).
      if (gate) { btn.classList.add('is-blocked'); btn.setAttribute('data-action', 'step-gate'); btn.setAttribute('aria-label', 'Mark done. ' + gate.text + ' first. Tap to go there.'); if (hint) { hint.textContent = gate.text + ' first.'; hint.hidden = false; } }
    }
    var ul = $('#step-foot .undone-link'); if (ul && wcSec && view !== 'wc-fn' && view !== 'wc-cp') ul.hidden = true;
    var sn = $('#step-next'), sp = $('#step-prev'); // (kept on the page, always hidden now)
    if (nxt) { sn.textContent = 'Next: ' + nxt.title + ' ›'; sn.setAttribute('aria-label', 'Next: ' + nxt.title); }
    if (prv) { sp.textContent = '‹ ' + prv.title; sp.setAttribute('aria-label', 'Go to ' + prv.title); }
  }
  // Which parts of the page show: the step list (home), one step, or everything (view-all).
  // Screens slide in the way they do in an iPhone app: deeper from the right, back from the left.
  function viewDepth(v) { return v === 'start' ? 0 : v === 'home' || v === 'wc' || v === 'bw' || v === 'af' ? 1 : isPerson(v) ? 3 : 2; }
  var navTimer = null;
  function navFeel(d) {
    var b = document.body; b.classList.remove('nav-fwd', 'nav-back'); clearTimeout(navTimer);
    if (!d) return;
    void b.offsetWidth; // restart the animation
    b.classList.add(d > 0 ? 'nav-fwd' : 'nav-back');
    navTimer = setTimeout(function () { b.classList.remove('nav-fwd', 'nav-back'); }, 320);
  }
  function applyView() {
    var all = !stepsOn;
    // A new screen: a field left open on the last one no longer hides the bottom bar
    var fa = document.activeElement; if (fa && fa.matches && fa.matches('#form input, #form textarea') && !(fa.offsetParent)) fa.blur();
    if (!(document.activeElement && document.activeElement.offsetParent && document.activeElement.matches('#form input[type="text"], #form input[type="date"], #form textarea'))) document.body.classList.remove('typing');
    document.body.classList.toggle('steps-on', !all);
    document.body.setAttribute('data-view', all ? 'all' : view);
    var home = all || view === 'home', start = !all && view === 'start', wc = !all && view === 'wc', wcSub = !all && isWcList(view), bw = !all && view === 'bw', af = !all && view === 'af';
    // A person's screen needs a person; anything else (a stale Back, a removed name) falls back to their list.
    if (!all && isPerson(view) && !personOk(personRef)) { view = personRef ? personListView(personRef) : 'home'; personRef = null; return applyView(); }
    var person = !all && isPerson(view);
    // The one-line disclaimer sits on the opening screen only.
    $('header.top').hidden = !home && !start; $('.start-here').hidden = !home && !start; $('.fine-notes').hidden = !all && !start;
    $('#person-view').hidden = !person;
    // Find New People to Teach and Missionary Referrals are one section each, shown in the Huddle and in ward council.
    var stepShown = view === 'wc-fn' ? 'fn' : view === 'wc-mr' ? 'mr' : view;
    $('#start-home').hidden = !start; $('#wc-view').hidden = !wc && !(!all && isWcNames(view)); $('#mode-bar').hidden = all || !(view === 'home' || wc || bw || af);
    $('#bw-view').hidden = !bw; $('#af-view').hidden = !af;
    $('#mode-title').textContent = wc ? 'Ward Council' : bw ? 'Before Ward Council' : af ? 'After the huddle' : 'Huddle';
    $('#hd-hero').hidden = all || view !== 'home'; // the Huddle's header card, with its one line on what to do there
    var stp = STEPS.filter(function (x) { return x.id === view; })[0] || WC_LISTS.filter(function (x) { return 'wc-' + x.id === view; })[0] || (view === 'wc-pick' ? { title: 'Find your focus names' } : null);
    $('#step-title').textContent = person ? personTitle(personRef) : stp ? stp.title : '';
    // Leaving a person's screen: drop a name left empty, then redraw the lists it appears on.
    if (isPerson(shownView) && !person) { cleanupPerson(); renderCP(); renderTN(); renderFN(); }
    // Names edited in ward council show up on the huddle's cards.
    if (isWcList(shownView) && !isWcList(view) && !person) { renderCP(); renderTN(); }
    if (!all && view === 'rr' && shownView !== 'rr') { rrAdding = false; renderRR(); } // names may have changed since it was drawn
    if (!all && shownView && shownView !== view) navFeel(viewDepth(view) - viewDepth(shownView));
    shownView = view;
    renderWC(); renderMR(); renderPerson(); renderChecks(); renderBefore(); if (af) renderAfter();
    if (start) renderDoors();
    $('#steps-home').hidden = all || view !== 'home';
    $('#step-bar').hidden = all || home || start || wc || bw || af; $('#step-foot').hidden = all || home || start || wc || person || bw || af;
    var bar = $('.actionbar'); if (bar) bar.hidden = false; // Hand off, Home and Send: on every screen (Home itself only away from the opening screen)
    var hb = $('.nav-home'); if (hb) hb.classList.toggle('is-here', start || all); // shown everywhere; on the opening screen it scrolls back to the top
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (el) { el.hidden = !all && el.getAttribute('data-step') !== stepShown; });
    Array.prototype.forEach.call(document.querySelectorAll('.week-band'), function (el) { el.hidden = !all; });
    renderDetails(); renderSteps();
  }
  /* ---------- Ward council: every name with only what ward council decides ---------- */
  // The last huddle's assignment for a name, if there was one (its row in Return and Report).
  function lastAction(gid, name) {
    var nm = norm(name); if (!nm) return null;
    for (var i = 0; i < state.rr.length; i++) {
      var r = state.rr[i];
      if (r.prefilled && groupOf(r) === gid && norm(rrPerson(r)) === nm && str(r.action).trim()) return r;
    }
    return null;
  }
  // The read-only boxes under a name: Details, and last huddle's assignment.
  function wcExtras(gid, a) {
    // Read-only here: ward council sees what was assigned and how it went, so it can plan from it. The huddle marks it.
    var r = lastAction(gid, a.name), last = null;
    if (r) {
      var who = [str(r.assigned).trim(), whenShow(r.when)].filter(Boolean).join(' · ');
      var st = { Yes: 'Done', Partly: 'Partly done', No: 'Not done' }[r.happened] || 'Pending';
      last = h('div', { class: 'wc-last' }, [
        h('p', { class: 'wc-last-k' }, ['Last huddle’s assignment', h('span', { class: 'wc-status', 'data-status': statusOf(r.happened) || 'pending', text: st })]),
        h('p', { class: 'wc-last-action', text: str(r.action).trim() + (who ? ' (' + who + ')' : '') })
      ]);
    }
    // Details: what's already known about this person, read-only (it's edited in the huddle).
    var facts = [];
    if (str(a.name).trim()) {
      if (gid === 'nm') {
        if (parseISO(str(a.bap))) facts.push(['Baptized', monthDay(a.bap)]);
        var ts = templeStatus(a, state.date);
        facts.push(['Temple', a.temple ? 'Attended' : parseISO(str(a.bap)) ? 'Not yet · ' + ts.text : 'Not yet', a.temple ? 'yes' : (ts.left !== undefined && ts.left <= 0 ? 'no' : '')]);
      }
      if (gid === 'bt') facts.push(['Baptism', a.committed ? 'Committed' + (monthDay(a.bap) ? ' · scheduled ' + monthDay(a.bap) : ', no date yet') : monthDay(a.bap) ? 'Scheduled ' + monthDay(a.bap) : 'Not committed yet', a.committed ? 'yes' : '']);
      if (a.sac) facts.push(['Sacrament', 'Attended (marked this huddle)', 'yes']);
      else if (a.lastSac === true || a.lastSac === false) facts.push(['Sacrament', a.lastSac ? 'Attended, as of the last huddle' : 'Not marked at the last huddle', a.lastSac ? 'yes' : '']);
      if (str(a.hneed).trim()) facts.push(['Huddle notes', a.hneed.trim()]);
    }
    var details = facts.length ? h('div', { class: 'wc-last wc-details' }, [h('p', { class: 'wc-last-k', text: 'Details' })].concat(facts.map(function (f) {
      return h('p', { class: 'after-fact' + (f[2] ? ' ' + f[2] : '') }, [h('span', { class: 'after-k', text: f[0] }), f[1]]);
    }))) : null;
    return [details, last].filter(Boolean);
  }
  function wcCard(gid, base, a, idx, removable) {
    var extras = wcExtras(gid, a);
    return h('div', { class: 'card wc-card g-' + gid }, [
      h('div', { class: 'wc-card-head' }, [
        field(gid === 'tn' ? 'Focus name' : 'Name', base + 'name', { placeholder: gid === 'tn' ? 'Focus name' : 'From the Covenant Path Report', cap: 'words' }),
        removable ? removeButton('remove-cp', gid, idx, 'Remove ' + (str(a.name).trim() || 'this name')) : null
      ]),
      gid === 'nm' ? field('Baptism date', base + 'bap', { type: 'date' }) : null,
      FIXED_ORD[gid] ? h('div', { class: 'field' }, ['Next ordinance', h('p', { class: 'fixed-value', text: FIXED_ORD[gid] })])
        : ordField('Next ordinance', base + 'ordinance'),
      field('What will help', base + 'need', { multi: true, rows: gid === 'tn' ? '2' : '3', placeholder: gid === 'tn' ? 'What do they need to get there?' : 'Tap their name in the Covenant Path Report to identify needs' }),
      confNote()
    ].concat(extras));
  }
  // Ward council opens to its two lists, rolled up like the huddle's sections; tap one for its names.
  // Ward council's Covenant Path Report list opens with the same Open the Covenant Path Report button as the Huddle had.
  // Ward Council's Covenant Path Report: the Ask ward council question, then a quiet link to the report (opening it
  // is step 1's job, so it's no longer a big button here; the user asked, Nov 19, 2026, evening).
  function reportLink() {
    var a = h('a', { class: 'quiet-link wc-report-link', 'data-tools-link': '', href: toolsHref() }, ['Open the Covenant Path Report in Member Tools ›']);
    return h('div', { class: 'ask-head' }, [
      h('p', { class: 'ask-q' }, [h('strong', { text: 'Ask ward council: ' }), 'has anyone completed a step on their Covenant Path this week? Tap a name to see what’s still open.', infoBtn('ask', 'How this differs from Before Ward Council')]),
      infoText('ask', 'Before Ward Council matches the report in Member Tools. This is for what people in ward council know that the report doesn’t show yet.'),
      a]);
  }
  // Ward council's lists. The last two are the same sections the Huddle has (the same data, entered once).
  // Ward Council's screen, in order (the user decided, Nov 19, 2026): Opportunities to invite, then the two lists to find
  // focus names in (the Covenant Path Report and Part-Member Families), then the focus names themselves, right on the
  // screen. The focus names have no list of their own any more ('wc-tn' still opens, for an old link).
  var WC_LISTS = [{ id: 'fn', title: 'Opportunities to invite' }, { id: 'cp', title: 'Covenant Path Report' }]; // no Missionary Referrals
  // The Ask ward council card opens the Covenant Path Report's lists (Nov 19, 2026, evening): "Has anyone completed a
  // step on their Covenant Path this week?" Its button: No changes this week, or Done once something was checked off.
  var ASK = { id: 'ask', open: 'cp', title: 'Ask ward council' };
  function askOk() { return !!(state.ask && state.ask.done); }
  // A focus name's next ordinance is done once their Covenant Path Report shows it (checked off in Before Ward Council
  // or Ward Council): then Ward Council chooses the next one.
  function ordDone(a) {
    var ord = str(a.ordinance).trim(), src = cpOfName(a.name); if (!ord || !src) return false;
    var g = src.gid, b = src.a, c = function (k) { var it = (CHECKLISTS[g] || []).filter(function (x) { return x.k === k; })[0]; return it ? checkOf(b, g, it) : null; };
    if (ord === 'Baptisms for the dead') return g === 'nm' ? !!b.temple : c('bfd') === true;
    if (ord === 'Priesthood advancement') { var ks = ['aaronic', 'melch'].filter(function (k) { return c(k) !== null && c(k) !== 'na'; }); return ks.length > 0 && ks.every(function (k) { return c(k) === true; }); }
    if (ord === 'Endowment') return c('endow') === true;
    if (ord === 'Sealing') return c('sealparents') === true || c('sealspouse') === true;
    if (ord === 'Sacrament') return c('sacr') === true;
    return false;
  }
  // Ward Council's Opportunities to invite is done when its one button was tapped: Done with events listed, or
  // No upcoming events with none (the user decided, Nov 19, 2026). Adding an event doesn't finish it by itself.
  function oppsTitled() { return state.find.opps.some(function (o) { return str(o.title).trim(); }); }
  function oppsOk() { return oppsTitled() ? !!state.find.done : !!state.find.none; }
  // What a Huddle section still needs before Mark done works: null when it can be marked done, or
  // { text, go } (go opens the first thing missing). Focus names need an assignment, who and when on every name;
  // Opportunities to invite needs one event with an assignment, unless there are no upcoming events.
  function focusMissing() { return state.tn.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return str(x.a.name).trim() && !(str(x.a.action).trim() && str(x.a.assigned).trim() && str(x.a.when).trim()); }); }
  function stepGate(id) {
    if (id === 'tn') {
      var m = focusMissing(); if (!m.length) return null;
      return { text: m.length === 1 ? str(m[0].a.name).trim() + ' needs an assignment' : m.length + ' focus names need an assignment', why: 'Each focus name needs an assignment, who will do it, and when.' };
    }
    return null;
  }
  function focusNamed() { return state.tn.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return str(x.a.name).trim(); }); }
  // What a focus name still needs in Ward Council: a next ordinance (or a new one, once theirs is done).
  function focusNeeds() { return focusNamed().filter(function (x) { return !str(x.a.ordinance).trim() || ordDone(x.a); }); }
  // Focus names starts each week unchecked: Keep these focus names (or adding or removing one) checks it, once every
  // focus name has a next ordinance that isn't done yet (Nov 19, 2026, evening).
  function focusOk() { return !!focusNamed().length && !focusNeeds().length && !!state.tnKept; }
  // Each part's state on Ward Council's screen: done (a green check), and the first one not done is Up next.
  function wcParts() {
    var done = { fn: oppsOk(), ask: askOk(), tn: focusOk() }, order = ['fn', 'ask', 'tn'];
    var next = order.filter(function (id) { return !done[id]; })[0] || '';
    return { done: done, next: next };
  }
  function isWcList(v) { return v === 'wc-cp' || v === 'wc-tn' || v === 'wc-fn' || v === 'wc-mr' || v === 'wc-pick'; }
  function isWcNames(v) { return v === 'wc-cp' || v === 'wc-tn' || v === 'wc-pick'; }
  function wcStatus(id) {
    if (id === 'fn') { // ward council lists what's coming up; the huddle makes the assignments, so no warning here
      var wn = state.find.opps.filter(function (o) { return str(o.title).trim(); });
      return { text: wn.length ? wn.map(function (o) { return o.title.trim() + (parseISO(str(o.date)) ? ' (' + monthDay(o.date) + ')' : ''); }).join(', ') : state.find.none ? 'No upcoming events' : 'None listed yet' };
    }
    if (id === 'mr') return stepStatus(id);
    if (id === 'ask') return { text: askOk() ? (state.ask.changed ? 'Steps checked off this week' : 'No changes this week') : 'Has anyone completed a step on their Covenant Path this week?' };
    if (id === 'cp') { var cpn = 0; GROUPS.forEach(function (g) { cpn += countNamed(g.id); }); return { text: cpn ? plural(cpn, 'person', 'people') : 'No names yet' }; }
    var named = [];
    if (id === 'tn') named = state.tn.filter(function (a) { return str(a.name).trim(); }).map(function (a) { return { a: a, g: 'tn' }; });
    else GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (a) { if (str(a.name).trim()) named.push({ a: a, g: g.id }); }); });
    if (!named.length) return { text: id === 'tn' ? 'None chosen yet' : 'No names yet' };
    var missing = named.filter(function (x) { return !ordOf(x.a, x.g); }).length;
    var lead = id === 'tn' ? tnCountText() : plural(named.length, 'person', 'people');
    return { text: lead + ' · ' + (missing ? missing + (missing === 1 ? ' needs' : ' need') + ' a next ordinance' : 'everyone has a next ordinance'), warn: missing > 0 };
  }
  // A part of Ward Council as a card of its own: its tile, title and one status line, Up next or a green check.
  function wcPartRow(l, parts, inBox) {
    var st = wcStatus(l.id), done = parts.done[l.id] && !inBox, next = parts.next === l.id && !inBox; // in a box, the box carries Up next and the check
    return h('li', {}, [h('button', { type: 'button', class: 'nav-row wc-row' + (done ? ' is-done' : '') + (next ? ' is-next' : ''), 'data-action': 'open-wc-list', 'data-a': l.open || l.id,
      'aria-label': l.title + '. ' + st.text + (done ? '. Done' : next ? '. Up next' : '') }, [
      tile(l.id),
      next ? h('span', { class: 'up-next wc-up-next', 'aria-hidden': 'true', text: 'Up next' }) : null,
      h('span', { class: 'step-text' }, [
        h('span', { class: 'step-title', text: l.title }),
        h('span', { class: 'step-status' + (st.warn && !done && !inBox ? ' warn' : ''), text: st.text }) // (in the box the focus names carry the warning)
      ]),
      done ? icon('check', 'wc-done-tick') : null,
      h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
    ])]);
  }
  var pmfEl = null; // the Part-Member Families link, moved into the Focus names card
  function renderWcCards() {
    var parts = wcParts();
    // Opportunities to invite and Ask ward council: cards with Up next and a check. The Covenant Path Report row in
    // Find your focus names is a tool (no check of its own): that box is where names are found.
    [WC_LISTS[0], ASK].forEach(function (l) {
      var ul = $('#wc-step-' + l.id); if (!ul) return;
      ul.classList.toggle('is-next', parts.next === l.id); ul.classList.toggle('is-done', !!parts.done[l.id]);
      ul.replaceChildren(wcPartRow(l, parts));
    });
    // The focus names, right on the screen: tap one to open it, swipe left to take it off.
    var sec = $('#wc-step-tn'); if (!sec) return;
    var named = focusNamed(), done = parts.done.tn, next = parts.next === 'tn';
    sec.classList.toggle('is-next', next); sec.classList.toggle('is-done', done);
    var rows = named.map(function (x) { return personRow('wc', 'tn', x.i, x.a); });
    var sh = swipeHint(rows); if (sh) rows.push(sh);
    if (!named.length) rows.push(h('li', { class: 'list-empty' }, [h('p', { class: 'list-empty-text', text: 'Choose up to three from the lists above.' })]));
    if (named.length < 3) rows.push(h('li', {}, [h('button', { type: 'button', class: 'nav-row add-row', 'data-action': 'add-focus', 'aria-label': 'Add a focus name' }, [icon('plus'), h('span', { text: 'Add a focus name' })])]));
    // The card's button: gray while a focus name needs a next ordinance (tapping opens it), then Keep these focus names.
    var needs = focusNeeds(), keep = null;
    if (named.length && !done) keep = needs.length
      ? h('button', { type: 'button', class: 'btn-primary full wc-keep is-blocked', 'data-action': 'tn-keep-gate' }, ['Keep these focus names'])
      : h('button', { type: 'button', class: 'btn-primary full wc-keep', 'data-action': 'tn-keep' }, ['Keep these focus names']);
    // Find your focus names, inside the card (Nov 19, 2026, night): two small buttons under the heading.
    pmfEl = pmfEl || $('#wc-pmf');
    var finds = h('div', { class: 'wc-finds' }, [h('span', { class: 'wc-finds-k', text: 'Find names in' }),
      h('button', { type: 'button', class: 'btn-outline wc-mini', 'data-action': 'open-wc-list', 'data-a': 'pick' }, ['Covenant Path Report']), pmfEl]);
    sec.replaceChildren.apply(sec, [
      next ? h('span', { class: 'up-next wc-up-next', 'aria-hidden': 'true', text: 'Up next' }) : null,
      h('div', { class: 'wc-focus-head' }, [tile('tn'), h('span', { class: 'step-text' }, [
        h('span', { class: 'step-title', text: 'Focus names' }),
        h('span', { class: 'step-status' + (done ? ' ok' : ''), text: done ? 'Kept, with a next ordinance for each' : tnCountText() + ' · choose each one’s next ordinance' })
      ]), done ? icon('check', 'wc-done-tick') : null]), finds,
      h('ul', { class: 'steps-list person-rows', 'data-wc': 'tn' }, rows), keep ? h('div', { class: 'wc-keep-wrap' }, [keep]) : null].filter(Boolean));
  }
  // Find your focus names → the Covenant Path Report (the user asked, Nov 19, 2026, night): just each name, a Suggested
  // focus name tag with its reason (the temple countdown, a baptism date), and Add to focus names. No question, no
  // report link: those belong to Ask ward council.
  function pickPanel(gid, title) {
    var rows = state.cp[gid].map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return str(x.a.name).trim(); }).map(function (x) {
      var name = str(x.a.name).trim(), on = focusIndex(name) >= 0, pr = on ? '' : pressingReason(x.a, gid);
      return h('li', { class: 'pick-li' + (on ? ' flag-focus' : pr ? ' flag-sug' : '') }, [h('div', { class: 'nav-row pick-row' }, [
        initialsDot(name),
        h('span', { class: 'step-text' }, [h('span', { class: 'step-title person-name', text: name }),
          pr ? h('span', { class: 'row-flag', text: 'Suggested focus name · ' + pr }) : null]),
        on ? h('span', { class: 'pick-on' }, [icon('check'), h('span', { text: 'Focus name' })])
          : h('button', { type: 'button', class: 'btn-outline pick-add', 'data-action': 'pick-focus', 'data-a': gid, 'data-b': x.i, 'aria-label': 'Add ' + name + ' to focus names' }, ['Add to focus names'])
      ])]);
    });
    if (!rows.length) rows.push(h('li', { class: 'list-empty' }, [h('p', { class: 'list-empty-text', text: 'No names yet.' })]));
    var attrs = { class: 'list-panel rows list-' + gid, 'aria-label': title, 'data-pick': gid };
    return h('section', attrs, [h('div', { class: 'list-head' }, [h('h3', { class: 'list-title', text: title }), h('span', { class: 'list-count', text: countText(countNamed(gid)) })]),
      h('ul', { class: 'steps-list person-rows' }, rows)]);
  }
  function renderWC() {
    var wrap = $('#wc-list'), rows = $('#wc-rows'); if (!wrap || !rows) return;
    rows.hidden = !(stepsOn && view === 'wc');
    var wcHero = $('#wc-hero'); if (wcHero) wcHero.hidden = rows.hidden;
    if (!rows.hidden) renderWcCards();
    if (rowsOn) { // one row per name; the fields are on the person's own screen
      if (!isWcNames(view)) { wrap.replaceChildren(); return; }
      wrap.replaceChildren.apply(wrap, view === 'wc-tn' ? [rowsPanel('wc', 'tn', 'Focus names')] : view === 'wc-pick' ? GROUPS.map(function (g) { return pickPanel(g.id, g.title); }) : [reportLink()].concat(GROUPS.map(function (g) { return rowsPanel('wc', g.id, g.title); })));
      return;
    }
    // (Cards-open layout.) The names are only built while their list is on screen, so each field exists once on the page.
    if (!stepsOn || !isWcNames(view)) { wrap.replaceChildren(); return; }
    var panel = function (gid, title, list, baseOf) {
      return h('section', { class: 'list-panel wc-panel list-' + gid, 'data-wc': gid, 'aria-label': title }, [
        h('h3', { class: 'wc-title', text: title }),
        h('div', { class: 'stack' }, list.map(function (a, i) { return wcCard(gid, baseOf(i), a, i, gid !== 'tn' && (list.length > 1 || hasText(a, CARD_KEYS))); })),
        gid === 'tn' ? null : h('button', { type: 'button', class: 'btn-outline full wc-add', 'data-action': 'wc-add', 'data-a': gid, text: '+ Add a name' })
      ]);
    };
    wrap.replaceChildren.apply(wrap, view === 'wc-tn' ? [panel('tn', 'Focus names', state.tn, function (i) { return 'tn.' + i + '.'; })]
      : GROUPS.map(function (g) { return panel(g.id, g.title, state.cp[g.id], function (i) { return 'cp.' + g.id + '.' + i + '.'; }); }));
  }
  /* ---------- The two Covenant Path Report checks on the opening screen ---------- */
  function allNames() {
    var out = [];
    GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (a, i) { if (str(a.name).trim()) out.push({ gid: g.id, i: i, a: a, base: 'cp.' + g.id + '.' + i + '.' }); }); });
    return out;
  }
  function renderChecks() {
    [['before', 'Match Member Tools', 'Done. Tap to look again.'], ['after', 'Update the Covenant Path Report, then send', 'Done. You can send.']].forEach(function (c) {
      var on = !!state.verified[c[0]], box = $('#' + c[0] + '-box'); if (!box) return;
      box.classList.toggle('done', on); $('#' + c[0] + '-sub').textContent = on ? c[2] : c[1];
      box.setAttribute('aria-label', $('#' + c[0] + '-box .cpr-step-k').textContent + ': ' + $('#' + c[0] + '-box .check-line').textContent + (on ? '. Done.' : '. Not done yet.'));
      // On the step's own screen: Mark done, pinned above the bottom bar. Once done it is green and says Done;
      // tapping it again takes the mark off.
      markDoneBtn($('#' + c[0] + '-done-btn'), on, c[0] + '-undo', 'go-start-done');
    });
    // After the huddle: Mark done waits until every changed name is ticked "Updated in the report" (Nov 19, 2026).
    var ab = $('#after-done-btn'); if (ab) { ab.classList.remove('is-blocked'); var left = state.verified.after ? 0 : afterLeft().length;
      if (left) { ab.classList.add('is-blocked'); ab.setAttribute('data-action', 'after-gate'); ab.querySelector('.mark-label').textContent = plural(left, 'person', 'people') + ' to update'; ab.setAttribute('aria-label', plural(left, 'person', 'people') + ' still to update in the report. Tap to go there.'); } }
  }
  // After the huddle's changed people not yet ticked as updated in the report, by key (list|name).
  function afterChangedKeys() { var w = $('#after-list'); return w ? Array.prototype.map.call(w.querySelectorAll('[data-upd-key]'), function (el) { return el.getAttribute('data-upd-key'); }) : []; }
  function afterLeft() { return afterChangedKeys().filter(function (k) { return !state.afterUpd[k]; });
  }
  // Once done, the green Done keeps it done and just goes back (the user decided, Nov 18, 2026: tapping it again
  // used to take the mark off); a small "Mark as not done" link under it is the only way to undo.
  function markDoneBtn(btn, on, undoAction, backAction, label, doAction) {
    if (!btn) return;
    if (!btn.getAttribute('data-done')) btn.setAttribute('data-done', btn.getAttribute('data-action')); // what Mark done does (from the page)
    if (doAction) btn.setAttribute('data-done', doAction);
    btn.classList.toggle('is-done', on); btn.setAttribute('data-action', on ? backAction : btn.getAttribute('data-done'));
    btn.querySelector('.mark-label').textContent = on ? 'Done' : label || 'Mark done';
    btn.setAttribute('aria-label', on ? 'Done. Tap to go back.' : label || 'Mark done');
    var link = btn.nextElementSibling && btn.nextElementSibling.classList.contains('undone-link') ? btn.nextElementSibling : null;
    if (!link) { link = h('button', { type: 'button', class: 'btn-link undone-link', text: 'Mark as not done' }); btn.parentNode.insertBefore(link, btn.nextSibling); }
    link.setAttribute('data-action', undoAction); link.hidden = !on;
  }
  function setVerified(which, on) { if (which === 'before' && on) takeBwSnap(); state.verified[which] = !!on; renderChecks(); saveDraft(); }
  // Step 1 done: remember how each person looked, so step 4 can show what changed since (in ward council or the
  // huddle) and needs updating in the Covenant Path Report. Kept on this phone only; a new week starts without it.
  var SNAP_KEYS = ['sac', 'temple', 'committed', 'bap', 'ordinance', 'need', 'appt'];
  function snapOf(a) { var o = {}; SNAP_KEYS.forEach(function (k) { o[k] = typeof a[k] === 'boolean' ? a[k] : str(a[k]).trim(); }); o.checks = cleanChecks(a.checks); return o; }
  // Checklist items whose state moved since step 1: [{ c, now }] (now: true done, 'na', or false reopened).
  function checkMoves(a, gid, was) {
    if (!was) return [];
    var wc = was.checks || {};
    return (CHECKLISTS[gid] || []).filter(function (c) { return !c.temple; }).map(function (c) {
      var then = wc[c.k] === true || (wc[c.k] === 'na' && c.opt) ? wc[c.k] : false, now = checkOf(a, gid, c);
      return then !== now ? { c: c, now: now } : null;
    }).filter(Boolean);
  }
  // Done this week, for the PDF: the checklist items checked since step 1 (and baptisms for the dead).
  function doneThisWeek(a, gid, snap) {
    var was = snap ? snap[gid + '|' + norm(a.name)] : null; if (!was) return [];
    var out = checkMoves(a, gid, was).filter(function (m) { return m.now === true; }).map(function (m) { return m.c.t; });
    if (gid === 'nm' && a.temple && !was.temple) out.unshift('Performed baptisms for the dead');
    return out;
  }
  function takeBwSnap() {
    var snap = {};
    allNames().forEach(function (x) { snap[x.gid + '|' + norm(x.a.name)] = snapOf(x.a); });
    state.bwSnap = snap;
  }
  // Before ward council: the three Covenant Path Report lists, one row per person. Tap a name to bring it
  // up to date from the report. (Focus names aren't here: ward council chooses those, not the report.)
  function renderBefore() {
    var wrap = $('#before-list'); if (!wrap) return;
    if (!stepsOn || view !== 'bw') { wrap.replaceChildren(); return; } // built only while it shows, so each row exists once
    wrap.replaceChildren.apply(wrap, GROUPS.map(function (g) { return rowsPanel('bw', g.id, g.title); }));
  }
  // After the huddle: what to carry over to the Covenant Path Report, person by person.
  function renderAfter() {
    var wrap = $('#after-list'); if (!wrap) return;
    var names = allNames();
    var label = { tn: 'Focus name', nm: 'New member', rm: 'Returning member', bt: 'Being taught' };
    var snap = state.bwSnap, changedCount = 0;
    var rows = names.map(function (x) {
      var a = x.a, r = null;
      // What changed since step 1 was marked done gets an "Updated" tag; those people come first.
      var was = snap ? snap[x.gid + '|' + norm(a.name)] : null, now = snapOf(a), isNew = !!snap && !was;
      var moved = function (k) { return !!was && (k === 'bap' ? str(was.bap) !== str(now.bap) || !!was.committed !== !!now.committed : (typeof now[k] === 'boolean' ? !!was[k] !== now[k] : str(was[k]) !== str(now[k]))); };
      var cm = checkMoves(a, x.gid, was);
      var changed = isNew || ['sac', 'temple', 'committed', 'bap', 'appt'].some(moved) || cm.length > 0;
      var upd = function (k) { return moved(k) ? h('span', { class: 'after-upd', text: 'Updated' }) : null; };
      for (var i = 0; i < state.rr.length; i++) { var q = state.rr[i]; if (q.prefilled && groupOf(q) === x.gid && norm(rrPerson(q)) === norm(a.name) && str(q.action).trim()) { r = q; break; } }
      var fact = function (k, v, cls, tag) { return h('p', { class: 'after-fact' + (cls ? ' ' + cls : '') + (tag ? ' is-upd' : '') }, [h('span', { class: 'after-k', text: k }), v, tag || null]); };
      // With step 1's copy to compare against, each person shows only what changed (what goes into the report).
      var only = !!snap && !isNew, show = function (k) { return !only || moved(k); };
      var newDone = isNew ? (CHECKLISTS[x.gid] || []).filter(function (c) { return !c.temple && checkOf(a, x.gid, c) === true; }) : [];
      var ukey = x.gid + '|' + norm(a.name), firstChange = changed && !changedCount++;
      var updBox = snap && changed ? h('button', { type: 'button', class: 'ck-row after-upd-ck' + (state.afterUpd[ukey] ? ' is-done' : ''), role: 'checkbox', 'aria-checked': state.afterUpd[ukey] ? 'true' : 'false', 'data-action': 'after-upd', 'data-a': ukey, 'data-upd-key': ukey }, [
        h('span', { class: 'sac-box ck-box', 'aria-hidden': 'true' }, [state.afterUpd[ukey] ? icon('check') : null]), h('span', { class: 'ck-t', text: 'Updated in the report' })]) : null;
      var card = h('div', { class: 'card after-card g-' + x.gid + (changed ? ' has-change' : '') }, [
        h('p', { class: 'after-name' }, [a.name.trim(), h('span', { class: 'source', text: label[x.gid] }),
          changed ? h('span', { class: 'after-changed', text: isNew ? 'New since step 1' : 'Changed' }) : null, firstChange ? infoBtn('changed', 'What Changed means') : null]),
        firstChange ? infoText('changed', 'Updated in this app since Before Ward Council. Make the same change in the Covenant Path Report, then tick Updated in the report.') : null,
        show('sac') ? fact('Sacrament', a.sac ? 'Attended' : 'Not marked', a.sac ? 'yes' : '', upd('sac')) : null,
        x.gid === 'nm' && show('temple') ? fact('Baptisms for the dead', a.temple ? 'Done' : 'Not yet', a.temple ? 'yes' : '', upd('temple')) : null,
        x.gid === 'bt' && a.committed && show('bap') ? fact('Baptism', 'Committed' + (monthDay(a.bap) ? ' · ' + monthDay(a.bap) : ''), 'yes', upd('bap')) : null,
        x.gid === 'bt' && str(a.appt).trim() && show('appt') ? fact('Appointment', whenShow(a.appt), '', upd('appt')) : null
      ].concat(cm.map(function (m) {
        return fact(m.c.t, m.now === true ? 'Done' : m.now === 'na' ? 'Doesn’t apply' : 'Not done', m.now === true ? 'yes' : '', h('span', { class: 'after-upd', text: 'Updated' }));
      })).concat(newDone.map(function (c) { return fact(c.t, 'Done', 'yes'); })).concat(only ? [] : [
        r ? fact('Reported back', (str(r.action).trim()) + ': ' + ({ Yes: 'Done', Partly: 'Partly done', No: 'Not done' }[r.happened] || 'Pending') + (str(r.notes).trim() ? ' · ' + r.notes.trim() : ''), statusOf(r.happened)) : null
      ]).concat([updBox]));
      return { el: card, changed: changed };
    });
    // With step 1's copy: only the people who changed. Without it (step 1 not marked done): everyone.
    var els = (snap ? rows.filter(function (x) { return x.changed; }) : rows).map(function (x) { return x.el; });
    if (snap && rows.length) els.unshift(h('p', { class: 'after-summary' + (changedCount ? ' has-change' : '') , text: changedCount ? plural(changedCount, 'person changed', 'people changed') + ' since step 1. Update these in the Covenant Path Report.' : 'Nothing changed since step 1.' }));
    wrap.replaceChildren.apply(wrap, els.length ? els : [h('p', { class: 'quick-none', text: 'No one is on the Covenant Path Report lists yet.' })]);
    renderChecks();
  }

  // The two doors on the opening screen say where things stand.
  // The opening screen's four steps as a timeline: each is done, or the first one not done is "Up next".
  // Ward council is done when every focus name has What will help; the Huddle when all its sections are marked done.
  function stepsDoneState() {
    var wc = heroProgress('wc'), hd = heroProgress('hd');
    return [!!state.verified.before, !!(wc && wc.done === wc.of), !!(hd && hd.done === hd.of), !!state.verified.after];
  }
  var wcDoneWas = null;
  function renderDoors() {
    renderChecks();
    var done = stepsDoneState(), next = done.indexOf(false);
    // A new week: step 1 says Start here rather than Up next (Nov 19, 2026).
    var s1 = document.querySelector('.tl-step[data-tl="1"] .up-next'); if (s1) s1.textContent = next === 0 ? 'Start here' : 'Up next';
    // Ward Council finishing on its own screen (its checks come from what's filled in): say what's next.
    if (wcDoneWas === false && done[1] && (view === 'wc' || view === 'p-wc' || isWcList(view))) toast('Step 2 done. Next: Huddle.', 6000, { label: 'Home', run: goStart });
    wcDoneWas = done[1];
    Array.prototype.forEach.call(document.querySelectorAll('.tl-step'), function (el) {
      var i = +el.getAttribute('data-tl') - 1;
      el.classList.toggle('tl-done', done[i]); el.classList.toggle('tl-next', i === next);
      var t = el.querySelector('[data-tile]'); if (t && !t.firstChild) t.innerHTML = TILE_SVG + TILE_ICONS[t.getAttribute('data-tile')] + '</svg>';
    });
    $('#start-ward').textContent = state.ward.trim() || 'Tap to add your ward';
    $('.start-ward').classList.toggle('is-empty', !state.ward.trim());
    $('.start-ward').setAttribute('aria-label', state.ward.trim() ? 'Ward: ' + state.ward.trim() + '. Tap to change it.' : 'Add your ward');
    $('#start-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var send = $('.actionbar [data-action="send"]'); if (send) send.classList.toggle('not-ready', !state.verified.after);
    var names = state.tn.filter(function (a) { return str(a.name).trim(); }).length + GROUPS.reduce(function (n, g) { return n + countNamed(g.id); }, 0);
    $('#door-wc-sub').textContent = names ? plural(names, 'name', 'names') + ' · next ordinances and needs' : 'Names, next ordinances and needs';
    var items = state.rr.filter(rrShown), marked = items.filter(function (r) { return r.happened; }).length;
    $('#door-hd-sub').textContent = items.length ? marked + ' of ' + items.length + ' reported back · then plan the assignments' : 'Report back, take attendance, plan the assignments';
  }

  // mode: 'push' adds a history entry (so Back returns to the list), 'replace' swaps it, otherwise no history change.
  var INTRO_OF = { bw: 'intro-bw', wc: 'intro-wc', home: 'intro-hd', af: 'intro-af' };
  function showView(v, mode) {
    if (!stepsOn) v = 'home';
    view = v;
    // Each step's instructions sit behind the "i" in its header card; the first time a step opens they show open.
    if (INTRO_OF[v]) { var ik = 'huddle-seen-' + INTRO_OF[v], seen = false; try { var ls0 = getStore('localStorage'); seen = !!(ls0 && ls0.getItem(ik)); if (!seen && ls0) ls0.setItem(ik, '1'); } catch (e) { /* ignore */ }
      setInfo(INTRO_OF[v], !seen); }
    try {
      if (mode === 'push') history.pushState({ hv: v, pushed: true, ref: isPerson(v) ? personRef : null }, '');
      else if (mode === 'replace') history.replaceState({ hv: v, ref: isPerson(v) ? personRef : null }, '');
    } catch (e) { /* ignore */ }
    applyView();
    window.scrollTo(0, 0);
  }
  // Back from the huddle's list or ward council to the opening screen.
  // The first list that can be swiped shows a one-time hint (Nov 19, 2026); it goes once someone swipes or taps Got it.
  var SWIPE_HINT_KEY = 'huddle-swipe-hint-seen';
  function swipeHint(list) {
    if (readFlag(SWIPE_HINT_KEY) || !list.some(function (li) { return li && li.classList && li.classList.contains('swipe-li'); })) return null;
    return h('li', { class: 'swipe-hint' }, [h('span', { text: '← Swipe a name left to remove it.' }), h('button', { type: 'button', class: 'btn-link', 'data-action': 'swipe-hint-ok', text: 'Got it' })]);
  }
  function swipeLearned() { if (readFlag(SWIPE_HINT_KEY)) return; writeFlag(SWIPE_HINT_KEY); Array.prototype.forEach.call(document.querySelectorAll('.swipe-hint'), function (x) { x.remove(); }); }
  var afterWard = null; // what waits for the first-time ward question (the welcome)
  function wardClosed() { $('#ward-title').textContent = 'Your ward'; var f = afterWard; afterWard = null; if (f) setTimeout(f, 320); }
  function goStart() {
    if (view === 'start') return;
    var st = null; try { st = history.state; } catch (e) { /* ignore */ }
    if (st && (st.hv === 'home' || st.hv === 'wc' || st.hv === 'bw' || st.hv === 'af') && st.pushed) { try { history.back(); return; } catch (e) { /* fall through */ } }
    showView('start', 'replace');
  }
  function goHome() {
    if (view === 'home') return;
    var st = null; try { st = history.state; } catch (e) { /* ignore */ }
    if (st && st.hv && st.hv !== 'home') { try { history.back(); return; } catch (e) { /* fall through */ } }
    showView('home', 'replace');
  }
  // Ward, date, conducting and attendance: a one-line summary once they're filled in.
  function renderDetails() {
    var full = $('#details-full'), sum = $('#details-summary');
    if (!full) return;
    var open = !stepsOn || detailsOpen;
    full.hidden = !open; sum.hidden = open;
    var doneBtn = full.querySelector('.details-done'); if (doneBtn) doneBtn.hidden = !stepsOn;
    var d = parseISO(state.date);
    $('#details-line').replaceChildren(h('b', { text: state.ward.trim() || 'Ward not set' }));
    $('#details-line').classList.toggle('in-hero', stepsOn && !!state.ward.trim()); // the header card above already names the ward
    var n = state.attendees.length;
    // Attendance shows in the same dark orange as other steps that still need action, until it's taken.
    $('#details-sub').replaceChildren(conductingLabel(state) ? conductingLabel(state) + ' · ' : '', n ? n + ' attended' : h('span', { class: 'warn', text: 'Attendance not taken yet' }));
  }
  function openDetails() { detailsOpen = true; if (view !== 'home') showView('home', 'replace'); renderDetails(); }
  window.HuddleView = {
    show: function (v, details) { detailsOpen = !!details; showView(v || 'home', 'replace'); },
    openDetails: openDetails,
    current: function () { return view; },
    reset: function () { setTourDemo(false); detailsOpen = false; showView(START, 'replace'); },
    tourDemo: function (on) { setTourDemo(on); },
    rows: function () { return rowsOn; },
    // Opens the first named person on a list (for the tour). False when the list has no one.
    person: function (kind, g) {
      var list = g === 'tn' ? state.tn : state.cp[g], i = list.findIndex(function (a) { return str(a.name).trim(); });
      if (!rowsOn || i < 0) return false;
      personRef = { kind: kind, g: g, i: i }; personWcOpen = wcOpenDefault(personRef); detailsOpen = false; showView(kind === 'wc' ? 'p-wc' : 'p-hd', 'replace');
      return true;
    },
    enabled: function () { return stepsOn; }
  };

  /* ---------- toast & sheets ---------- */
  var toastTimer = null;
  function toast(msg, ms, action) {
    var t = $('#toast');
    t.replaceChildren(h('span', { text: msg }));
    if (action) {
      var ab = h('button', { type: 'button', class: 'toast-action', text: action.label });
      ab.addEventListener('click', function () { t.hidden = true; clearTimeout(toastTimer); action.run(); });
      t.appendChild(ab);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3200);
  }

  var lastFocus = null;
  function openOverlay(id, focusSel) {
    lastFocus = document.activeElement;
    var o = $(id); o.hidden = false;
    $('#toast').hidden = true;
    document.body.style.overflow = 'hidden';
    var f = focusSel ? o.querySelector(focusSel) : null;
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeOverlay(id) {
    $(id).hidden = true;
    Array.prototype.forEach.call($(id).querySelectorAll('video'), function (v) { try { v.pause(); } catch (e) { /* ignore */ } });
    if (!document.querySelector('.overlay:not([hidden])')) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  // Removing a card that has anything on it always asks first. Swiping the question away keeps the card.
  function confirmRemove(title, onYes) {
    ask({ title: title, body: 'Everything typed here will be removed from this agenda.', primary: 'Remove', onPrimary: onYes, secondary: 'Keep it' });
  }
  var askSecondary = null;
  function ask(opts) {
    $('#confirm-title').textContent = opts.title;
    // A green check for good news; the amber warning for everything else.
    $('#confirm-sheet .warn-icon').hidden = !!opts.success || !!opts.plain;
    $('#confirm-sheet .ok-icon').hidden = !opts.success;
    $('#confirm-body').textContent = opts.body || '';
    $('#confirm-body').hidden = !opts.body;
    // Sending the huddle gets a small celebration: a bigger check, a few specks of color, and one warm line.
    $('#confirm-sheet .sheet').classList.toggle('celebrate', !!opts.celebrate);
    $('#confirm-sheet .confetti').hidden = !opts.celebrate;
    var cheer = $('#confirm-cheer'); cheer.textContent = opts.cheer || ''; cheer.hidden = !opts.cheer;
    var cl = $('#confirm-link');
    if (cl) { cl.hidden = !opts.link; if (opts.link) cl.textContent = opts.link; }
    var cmp = $('#confirm-compare');
    if (opts.compare && opts.compare.length) {
      cmp.replaceChildren.apply(cmp, opts.compare.map(function (row) {
        return h('div', { class: 'compare-row' }, [h('span', { text: row[0] }), h('span', { text: row[1] })]);
      }));
      cmp.hidden = false;
    } else if (opts.custom) {
      cmp.replaceChildren(opts.custom); cmp.hidden = false;
    } else if (opts.dateField) {
      cmp.replaceChildren(h('label', { class: 'confirm-field' }, [opts.dateField.label,
        h('input', { type: 'date', id: 'confirm-date', value: opts.dateField.value })]));
      cmp.hidden = false;
    } else if (opts.textField) {
      cmp.replaceChildren(h('label', { class: 'confirm-field' }, [opts.textField.label,
        h('textarea', { id: 'confirm-text', rows: '3', placeholder: opts.textField.placeholder || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' })]));
      cmp.hidden = false;
    } else if (opts.jumps && opts.jumps.length) {
      // "Ready to send?": each open item is a row that goes straight to it.
      cmp.replaceChildren.apply(cmp, opts.jumps.map(function (j) {
        var b = h('button', { type: 'button', class: 'jump-row' }, [h('span', { text: j.text }), h('span', { class: 'jump-chev', 'aria-hidden': 'true', text: '›' })]);
        b.addEventListener('click', function () { closeOverlay('#confirm-sheet'); j.go(); });
        return b;
      }));
      cmp.hidden = false;
    } else { cmp.hidden = true; cmp.replaceChildren(); }
    cmp.classList.toggle('jumps', !!(opts.jumps && opts.jumps.length));
    cmp.classList.toggle('fieldwrap', !!(opts.dateField || opts.textField || opts.custom));
    // The explanation reads first when there's a list to tap; a ward/date comparison reads before it.
    var cb = $('#confirm-body'); if (opts.jumps && opts.jumps.length) cb.after(cmp); else cb.before(cmp);
    var p = $('#confirm-primary'), s = $('#confirm-secondary');
    p.textContent = opts.primary || 'OK';
    p.onclick = function () { closeOverlay('#confirm-sheet'); if (opts.onPrimary) opts.onPrimary(); };
    if (opts.secondary) {
      s.hidden = false; s.textContent = opts.secondary;
      askSecondary = function () { closeOverlay('#confirm-sheet'); if (opts.onSecondary) opts.onSecondary(); };
      s.onclick = askSecondary;
    } else { s.hidden = true; s.onclick = null; askSecondary = null; }
    var tb = $('#confirm-tertiary');
    if (tb) {
      tb.hidden = !opts.tertiary;
      if (opts.tertiary) { tb.textContent = opts.tertiary.label; tb.onclick = function () { closeOverlay('#confirm-sheet'); opts.tertiary.run(); }; }
      else tb.onclick = null;
    }
    openOverlay('#confirm-sheet', '#confirm-primary');
  }

  /* ---------- actions ---------- */
  // keepWard keeps the ward name; the Clear button erases it too.
  function clearForm(keepWard) {
    removeKey('sessionStorage', DRAFT_KEY); removeKey('localStorage', LIVE_KEY); removeKey('localStorage', LAST_SENT_KEY);
    if (!keepWard) { removeKey('localStorage', WARD_KEY); removeKey('localStorage', 'huddle-conducting'); }
    state = freshState(); showBlank = {};
    resetView();
    renderAll(); applyView();
    window.scrollTo(0, 0);
  }

  function focusLast(selector) {
    var els = document.querySelectorAll(selector);
    var el = els[els.length - 1];
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Only move the cursor if the person hasn't already tapped into another box.
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || a === document.body || (a.matches && a.matches('button'))) el.focus({ preventScroll: true });
    }, 250);
  }

  function onAction(btn) {
    var act = btn.getAttribute('data-action');
    // a swipe isn't a tap; tapping a swiped-open focus name closes it
    if (act === 'open-person' && btn.parentNode && btn.parentNode.classList && btn.parentNode.classList.contains('swipe-li')) {
      if (Date.now() - swallowTap < 450) return;
      if (btn.parentNode.classList.contains('is-open')) { btn.parentNode.classList.remove('is-open'); return; }
    }
    var a = btn.getAttribute('data-a'), b = btn.getAttribute('data-b');
    switch (act) {
      case 'toggle-att': {
        var i = state.attendees.indexOf(a);
        if (i >= 0) state.attendees.splice(i, 1); else state.attendees.push(a);
        btn.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
        saveDraft(); break;
      }
      case 'happened': {
        var r = state.rr[+a];
        r.happened = r.happened === b ? '' : b;
        if (r.fid) state.find.items.forEach(function (x) { if (x.id === r.fid) x.status = r.happened; }); // the opportunity shows it too
        if (r.carriedFwd && r.happened === 'Yes') {
          var ri = +a;
          setTimeout(function () { confirmUndoCarry(ri, 'Take it off ' + nextPlan() + ' too?'); }, 0);
        }
        Array.prototype.forEach.call(btn.parentNode.children, function (x) {
          x.setAttribute('aria-pressed', x.getAttribute('data-b') === r.happened ? 'true' : 'false');
        });
        var rc = btn.closest('.card'); if (rc) rc.setAttribute('data-status', statusOf(r.happened));
        if (r.prefilled) renderRR();
        saveDraft(); break;
      }
      case 'add-rr':
        // With nothing listed, the first tap shows one blank item in place of the "nothing to report" line.
        if (rrNothing()) { state.rr = [blankRR()]; rrAdding = true; } else state.rr.push(blankRR());
        renderRR(); saveDraft();
        focusLast('#rr-list input[data-bind$=".plan"]'); break;
      case 'remove-rr': {
        var rrIdx = +a, rItem = state.rr[rrIdx];
        var doRemoveRR = function () {
          state.rr.splice(rrIdx, 1); delete state.openOne.rr;
          if (!state.rr.length) { state.rr.push(blankRR()); rrAdding = false; }
          if (state.loaded && !state.rr.some(function (x) { return x.prefilled; })) state.loaded = null;
          renderRR(); saveDraft();
        };
        if (rItem && (rItem.prefilled || rrHasInput(rItem))) {
          var rName = str(rItem.pname).trim() || str(rItem.person).split(' · Next: ')[0].trim();
          confirmRemove(rName ? 'Remove ' + rName + ' from Return and Report?' : 'Remove this Return and Report item?', doRemoveRR);
        } else doRemoveRR();
        break;
      }
      case 'cp-add-first':
        if (rowsOn) { openPerson('hd', a, Math.max(0, state.cp[a].findIndex(cardBlank)), true); break; }
        showBlank[a] = true; state.cpNone[a] = false; renderCP(); saveDraft();
        focusLast('[data-group="' + a + '"] input[data-bind$=".name"]'); break;
      case 'cp-none': state.cpNone[a] = true; showBlank[a] = false; renderCP(); saveDraft(); break;
      case 'cp-none-undo': state.cpNone[a] = false; renderCP(); saveDraft(); break;
      case 'add-cp':
        state.cp[a].push(blankAction()); renderCP(); saveDraft();
        focusLast('[data-group="' + a + '"] input[data-bind$=".name"]'); break;
      case 'convert-nm': convertToNewMember(+a); break;
      case 'make-focus': state.tnKept = true; makeFocus(a, +b); break;
      case 'pick-focus': state.tnKept = true; makeFocus(a, +b); renderWC(); break;
      case 'tn-keep-gate': { var nd = focusNeeds(); ask({ title: 'Choose a next ordinance first', body: nd.length === 1 ? str(nd[0].a.name).trim() + ' needs a next ordinance.' : nd.map(function (x) { return str(x.a.name).trim(); }).join(', ') + ' need a next ordinance.', primary: 'OK' }); break; }
      case 'tn-keep': if (!focusNeeds().length) { state.tnKept = true; saveDraft(); renderWC(); renderDoors(); renderHeroes(); } break;
      case 'wc-ask-done': state.ask = state.ask || {}; state.ask.done = true; saveDraft(); renderStepFoot();
        { var hs1 = null; try { hs1 = history.state; } catch (e) { /* ignore */ } if (hs1 && isWcList(hs1.hv) && hs1.pushed) { try { history.back(); } catch (e) { showView('wc', 'replace'); } } else showView('wc', 'replace'); }
        break;
      case 'wc-ask-undone': state.ask.done = false; saveDraft(); renderStepFoot(); renderWC(); break;
      case 'swipe-remove-tn': {
        var sn = state.tn[+a], sname = sn ? str(sn.name).trim() : '';
        if (!sname) break;
        ask({ title: 'Remove ' + sname + ' from Focus names?', body: 'Their assignment for this huddle is removed too. If they’re on the Covenant Path Report, they stay there.',
          primary: 'Remove', onPrimary: function () { var onScreen = isPerson(view); removeFocus(+a); if (onScreen) leavePerson(); }, secondary: 'Cancel',
          onSecondary: function () { Array.prototype.forEach.call(document.querySelectorAll('.swipe-li.is-open'), function (li) { li.classList.remove('is-open'); }); } });
        break;
      }
      case 'sa-toggle': setSac(a, +b, !(a === 'tn' ? state.tn[+b] : state.cp[a][+b]).sac); renderSA(); renderSteps(); renderCP(); renderTN(); saveDraft(); break;
      case 'list-done': listDone(a); break;
      case 'go-home-screen': if (stepsOn && view === 'start') { window.scrollTo({ top: 0, behavior: 'smooth' }); break; } if (isPerson(view)) cleanupPerson(); showView('start', 'replace'); break;
      case 'add-hneed': {
        var zone = btn.closest('.card-zone');
        var hf = zone && zone.querySelector('[data-bind$=".hneed"]');
        if (hf) { hf.closest('.field').hidden = false; btn.hidden = true; hf.focus(); }
        break;
      }
      case 'list-open': listOpen(a); break;
      case 'open-step': showView(a, 'push'); break;
      case 'open-wc': showView('wc', 'push'); break;
      case 'date-pick': pickDate(a, b); break;
      case 'open-wc-list': showView('wc-' + a, 'push'); break;
      case 'open-huddle': syncDate(); showView('home', 'push'); break;
      case 'go-start': goStart(); break;
      case 'open-before': showView('bw', 'push'); break;
      case 'close-before': goStart(); break;
      case 'go-start-done': goStart(); break; // the green Done on step 1 or 4: it stays done
      case 'before-done': setVerified('before', true); goStart(); toast('Step 1 done. Next: Ward Council.'); break;
      case 'open-after': showView('af', 'push'); break;
      case 'close-after': goStart(); break;
      case 'after-upd': if (state.afterUpd[a]) delete state.afterUpd[a]; else state.afterUpd[a] = true; saveDraft(); renderAfter(); break;
      case 'after-gate': { var aln = afterLeft().length; ask({ title: 'Update the report first', body: 'Tick Updated in the report on ' + plural(aln, 'changed name', 'changed names') + ' once each is updated in the Covenant Path Report.', primary: 'OK' }); break; }
      case 'after-done': if (afterLeft().length) { renderChecks(); break; } setVerified('after', true); goStart(); toast('Step 4 done. Next: Send the huddle report.'); break;
      case 'before-undo': setVerified('before', false); toast('Before Ward Council: marked as not done.', 6000, { label: 'Undo', run: function () { setVerified('before', true); } }); break;
      case 'after-undo': setVerified('after', false); toast('Marked as not done. Send waits until it’s done.', 6000, { label: 'Undo', run: function () { setVerified('after', true); } }); break;
      case 'edit-name': startNameEdit(); break;
      case 'wc-edit-toggle': {
        personWcOpen = !personWcOpen; renderPerson();
        var wt = document.querySelector('#person-card .zone-toggle');
        if (wt) wt.focus({ preventScroll: true });
        break;
      }
      case 'hd-edit-toggle': {
        personHdOpen = !personHdOpen; renderPerson();
        var ht = document.querySelector('#person-card .zone-toggle');
        if (ht) ht.focus({ preventScroll: true });
        break;
      }
      case 'open-person': openPerson(btn.getAttribute('data-kind') || 'hd', a, +b, a !== 'tn' ? false : !str(state.tn[+b].name).trim()); break;
      case 'add-person': {
        var ak = btn.getAttribute('data-kind') || 'hd', al = a === 'mr' ? state.referrals : state.cp[a];
        var ai = al.findIndex(function (x) { return rowBlank(a, x); });
        if (ai < 0) { al.push(a === 'mr' ? blankReferral() : blankAction()); ai = al.length - 1; }
        openPerson(ak, a, ai, true);
        break;
      }
      case 'add-mr': state.referrals.push(blankReferral()); renderMR(); saveDraft(); focusLast('#mr-list input[data-bind$=".name"]'); break;
      case 'remove-mr': {
        var mi = +a, mx = state.referrals[mi];
        var doRemoveMR = function () {
          state.referrals.splice(mi, 1);
          if (isPerson(view)) { personRef = { kind: personRef.kind, g: 'mr', i: -1 }; leavePerson(); }
          renderMR(); renderSteps(); saveDraft();
        };
        if (mx && !refBlank(mx)) confirmRemove(str(mx.name).trim() ? 'Remove ' + mx.name.trim() + '?' : 'Remove this referral?', doRemoveMR); else doRemoveMR();
        break;
      }
      case 'quick-remove-tn': {
        var qn = state.tn[+a], qdo = function () { state.tn.splice(+a, 1); state.tn = packTn(state.tn); renderTN(); renderBefore(); renderDoors(); saveDraft(); if (isPerson(view)) { toast('Focus name cleared.'); leavePerson(); } };
        if (qn && hasText(qn, CARD_KEYS.filter(function (k) { return k !== 'name'; }))) confirmRemove('Remove ' + qn.name.trim() + '?', qdo); else qdo();
        break;
      }
      case 'wc-add': state.cp[a].push(blankAction()); state.cpNone[a] = false; showBlank[a] = true;
        renderCP(); renderWC(); saveDraft(); focusLast('#wc-list [data-wc="' + a + '"] input[data-bind$=".name"]'); break;
      case 'steps-home':
        if (isPerson(view)) leavePerson();
        else if (isWcList(view)) { // back from a ward council list to ward council
          var hs = null; try { hs = history.state; } catch (e) { /* ignore */ }
          if (hs && isWcList(hs.hv) && hs.pushed) { try { history.back(); break; } catch (e) { /* fall through */ } }
          showView('wc', 'replace');
        } else goHome();
        break;
      case 'step-gate': { var gt = stepGate(view); if (gt) ask({ title: gt.text + ' first', body: gt.why || '', primary: 'OK' }); else renderStepFoot(); break; } // a message, not a jump (Nov 19, 2026)
      case 'wc-opps-done': // Ward Council's Opportunities to invite: Done, or No upcoming events; back to Ward Council
        if (oppsTitled()) state.find.done = true; else state.find.none = true;
        saveDraft(); renderStepFoot(); fnRedraw();
        { var hs0 = null; try { hs0 = history.state; } catch (e) { /* ignore */ } if (hs0 && isWcList(hs0.hv) && hs0.pushed) { try { history.back(); } catch (e) { showView('wc', 'replace'); } } else showView('wc', 'replace'); }
        break;
      case 'wc-opps-undone': state.find.done = false; state.find.none = false; saveDraft(); renderStepFoot(); fnRedraw(); renderWC(); break;
      case 'step-done': {
        var doneView = view;
        if (stepGate(doneView)) { renderStepFoot(); break; }
        var fnBare = doneView === 'fn' && !state.find.opps.some(function (o) { return str(o.title).trim() && oppItems(o.id).some(function (q) { return str(q.x.task).trim() && !q.x.past; }); });
        var finish = function () {
          state.stepsDone[doneView] = true; justDone = { id: doneView, at: Date.now() };
          if (doneView === 'fn' && !oppsTitled()) state.find.none = true;
          saveDraft();
          // Back to the Huddle's list (the user decided, Nov 19, 2026, night: Done never jumps ahead); Up next shows what's next.
          goHome();
          var st = STEPS.filter(function (x) { return x.id === doneView; })[0];
          toast(STEPS.every(function (x) { return state.stepsDone[x.id]; }) ? 'Step 3 done. Next: After the huddle.' : (st ? st.title : 'Section') + ' marked done.', 6000, { label: 'Undo', run: function () { delete state.stepsDone[doneView]; saveDraft(); renderSteps(); } });
        };
        // Opportunities to invite can always be marked done; without an assignment it asks first.
        if (fnBare) { ask({ title: oppsTitled() ? 'Mark done without an assignment?' : 'No upcoming events?', body: oppsTitled() ? 'No event has an assignment yet.' : 'Mark Opportunities to invite done with no events.', primary: 'Mark done', onPrimary: finish, secondary: 'Cancel' }); break; }
        finish();
        break;
      }
      case 'step-undone': { var uv = view; delete state.stepsDone[uv]; saveDraft(); renderStepFoot(); toast('Marked as not done.', 6000, { label: 'Undo', run: function () { state.stepsDone[uv] = true; saveDraft(); if (view === uv) renderStepFoot(); } }); break; }
      case 'step-prev': {
        var pl = footList(), pi = pl.findIndex(function (st) { return st.id === view; });
        if (pi > 0) showView(pl[pi - 1].id, 'replace');
        break;
      }
      case 'step-next': {
        var nl = footList(), si = nl.findIndex(function (st) { return st.id === view; });
        if (si >= 0 && nl[si + 1]) showView(nl[si + 1].id, 'replace');
        break;
      }
      case 'open-details': openDetails(); break;
      case 'edit-ward': openOverlay('#ward-sheet', '#ward'); break;
      case 'slides': openSlides(); break;
      case 'slide-next': if (slides && slideAt >= slides.length - 1) closeOverlay('#slides-sheet'); else showSlide(slideAt + 1); break;
      case 'slide-prev': showSlide(slideAt - 1); break;
      case 'close-slides': closeOverlay('#slides-sheet'); break;
      case 'close-ward': closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); wardClosed(); break;
      case 'close-details': detailsOpen = false; renderDetails(); renderSteps(); window.scrollTo(0, 0); break;
      case 'details-done': { // Attendees done: straight on to the next section not done yet (Nov 19, 2026, night)
        detailsOpen = false; renderDetails(); renderSteps(); window.scrollTo(0, 0); // back to the Huddle's list; Up next shows what's next
        break;
      }
      case 'edit-one': {
        state.openOne[a] = +b; rerenderList(a);
        var oc = document.querySelector('.fold-open .card');
        if (oc) oc.scrollIntoView({ block: 'start', behavior: 'smooth' });
        break;
      }
      case 'close-one': {
        delete state.openOne[a]; rerenderList(a);
        var fl = a === 'rr' ? $('#rr-list') : a === 'tn' ? $('#tn-list') : document.querySelector('[data-group="' + a + '"]');
        if (fl) fl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      }
      case 'remove-cp': {
        var cpList = a, cpIdx = +b, cItem = state.cp[a][+b];
        var doRemoveCP = function () {
          state.cp[cpList].splice(cpIdx, 1); delete state.openOne[cpList];
          if (!state.cp[cpList].length) { state.cp[cpList].push(blankAction()); showBlank[cpList] = false; }
          if (isPerson(view)) { personRef = { kind: personRef.kind, g: personRef.g, i: -1 }; leavePerson(); }
          renderCP(); renderWC(); renderBefore(); if (view === 'start') renderDoors(); saveDraft();
        };
        if (cItem && (cItem.sac || cItem.temple || cItem.committed || hasText(cItem, CARD_KEYS))) {
          confirmRemove(str(cItem.name).trim() ? 'Remove ' + cItem.name.trim() + '?' : 'Remove this person?', doRemoveCP);
        } else doRemoveCP();
        break;
      }
      // Load from a PDF goes straight to choosing the file; what it will do is asked once the PDF is read.
      case 'theme': if (window.huddleTheme) window.huddleTheme.set(a); markTheme(); break;
      case 'load-other':
      case 'load': if (!$('#help-sheet').hidden) closeHelp(); pickFile(); break;
      case 'handoff': startHandoff(); break;
      case 'help-handoff': closeHelp(); setTimeout(startHandoff, 250); break;
      case 'handoff-send': sendHandoff(); break;
      case 'handoff-receive': closeOverlay('#handoff-sheet'); pasteHandoff(); break;
      case 'close-handoff': closeOverlay('#handoff-sheet'); break;
      case 'carry-fwd': carryForward(+a); break;
      case 'text-assign': textAssignment(a); break;
      case 'text-referral': textReferral(+a); break;
      case 'stale-keep': setPath(a + 'touched', todayISO()); if (/^tn/.test(a)) renderTN(); else renderCP(); saveDraft(); toast('Kept. It won’t ask again for 4 weeks.'); break;
      case 'stale-remove': {
        var sp = a.split('.');
        if (sp[0] === 'tn') { state.tn[+sp[1]] = blankName(); renderTN(); }
        else {
          state.cp[sp[1]].splice(+sp[2], 1); if (!state.cp[sp[1]].length) { state.cp[sp[1]].push(blankAction()); showBlank[sp[1]] = false; }
          if (isPerson(view) && sp[0] !== 'tn') personRef = { kind: personRef.kind, g: personRef.g, i: -1 };
          renderCP();
        }
        saveDraft(); toast('Removed.');
        if (isPerson(view)) leavePerson();
        break;
      }
      case 'edit-date': openDetails(); setTimeout(function () { var df = $('#date'); if (df) df.focus(); }, 60); break;
      case 'undo-carry': confirmUndoCarry(+a); break;
      case 'conducting':
        state.conducting = state.conducting === a ? '' : a;
        renderConducting(); writeConducting(state); saveDraft();
        if (state.conducting === 'other') $('#conducting-other').focus();
        break;
      // (open-agenda, share-agenda, pick-agenda and delete-all are left from saved agendas, a removed feature; nothing on the page calls them.)
      case 'open-agenda': {
        var orec = savedById[a];
        closeOverlay('#handoff-sheet');
        if (!orec) break;
        var doOpen = function () {
          state = normalizeState(orec.data); state.loaded = null;
          resetView(); renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
          toast('Opened the ' + shortDate(orec.date) + ' agenda. Make your changes, then send or save it again.');
        };
        if (!isEmpty(state)) {
          ask({ title: 'Replace what’s on the form?', body: 'Opening this agenda replaces everything you’ve entered on the form now.', primary: 'Open it', onPrimary: doOpen, secondary: 'Cancel' });
        } else doOpen();
        break;
      }
      case 'share-agenda': {
        var srec = savedById[a];
        closeOverlay('#handoff-sheet');
        if (srec) startSend(normalizeState(srec.data));
        break;
      }
      case 'pick-agenda': {
        var rec = savedById[a];
        closeOverlay('#handoff-sheet');
        if (rec) checkAndApply(rec.data, 'Saved on this phone · ' + shortDate(rec.date), openLoad);
        break;
      }
      case 'load-file': pickFile(); break;
      case 'delete-all':
        closeOverlay('#handoff-sheet');
        ask({
          title: 'Delete all saved agendas?',
          body: 'Every agenda saved on this phone will be erased. Copies you already shared are not affected.',
          primary: 'Delete all', onPrimary: function () {
            deleteAllAgendas().then(function () { toast('Saved agendas deleted.'); }, function () { toast('Couldn’t delete. Try again.'); });
          },
          secondary: 'Cancel'
        });
        break;
      case 'help': openHelp(); break;
      case 'close-help': closeHelp(); break;
      case 'sample': openOverlay('#sample-sheet', '.sample-close'); $('#sample-sheet .sheet').scrollTop = 0; break;
      case 'close-sample': closeOverlay('#sample-sheet'); break;
      case 'how-help': openHowHelp(a); break;
      case 'close-how-help': closeOverlay('#howhelp-sheet'); break;
      case 'find-tips': openOverlay('#find-tips-sheet', '#find-tips-title'); $('#find-tips-sheet .sheet').scrollTop = 0; break;
      case 'close-find-tips': closeOverlay('#find-tips-sheet'); break;
      case 'add-fn': {
        var nx = blankAssign(); nx.opp = a || ''; state.find.items.push(nx); asgOpen[nx.id] = true; if (!a) otherOpen = true; else oppOpen[a] = true; fnRedraw();
        var fe = document.querySelector('[data-bind="find.items.' + (state.find.items.length - 1) + '.task"]'); if (fe) fe.focus();
        break;
      }
      case 'opp-starter': { // a starter idea: a new opportunity named with it (or this one's empty name filled in)
        var tk = a === '' || a === null ? -1 : +a;
        if (tk < 0) { state.find.opps.push({ id: oppId(), title: b, date: '' }); tk = state.find.opps.length - 1; }
        else state.find.opps[tk].title = b;
        state.find.none = false;
        oppOpen[state.find.opps[tk].id] = true;
        if (rowsOn && !isPerson(view)) { saveDraft(); openPerson(view === 'wc-fn' ? 'wc' : 'hd', 'opp', tk); break; }
        fnRedraw();
        var de = document.querySelector('[data-bind="find.opps.' + tk + '.date"]'); if (de) de.scrollIntoView({ block: 'center' });
        break;
      }
      case 'invite-idea': { // a way to invite fills that assignment; the huddle adds who and when
        var ix = state.find.items[+a]; if (!ix) break;
        ix.task = b; asgOpen[ix.id] = true; if (ix.opp) oppOpen[ix.opp] = true; else otherOpen = true;
        fnRedraw();
        var te = document.querySelector('[data-bind="find.items.' + a + '.who"]'); if (te) te.focus();
        break;
      }
      case 'opps-none': state.find.none = true; fnRedraw(); renderWC(); renderDoors(); renderHeroes(); saveDraft(); break;
      case 'opps-none-undo': state.find.none = false; fnRedraw(); renderWC(); renderDoors(); renderHeroes(); saveDraft(); break;
      case 'add-focus': { // Ward Council: a focus name who isn't on either list
        var fs0 = state.tn.findIndex(function (n) { return !n.sac && !hasText(n, CARD_KEYS); });
        if (fs0 < 0) { state.tn.push(blankName()); fs0 = state.tn.length - 1; }
        state.tnKept = true;
        saveDraft(); openPerson('wc', 'tn', fs0, true); break;
      }
      case 'add-opp': {
        var nop = { id: oppId(), title: '', date: '' }; state.find.opps.push(nop); oppOpen[nop.id] = true; state.find.none = false;
        if (rowsOn) { saveDraft(); openPerson(view === 'wc-fn' ? 'wc' : 'hd', 'opp', state.find.opps.length - 1); setTimeout(function () { var t0 = document.querySelector('#person-card [data-bind$=".title"]'); if (t0) t0.focus(); }, 60); break; }
        fnRedraw();
        var oe = document.querySelector('[data-bind="find.opps.' + (state.find.opps.length - 1) + '.title"]'); if (oe) { oe.focus(); oe.scrollIntoView({ block: 'center' }); }
        break;
      }
      case 'remove-opp': {
        var op = state.find.opps[+a];
        var dropOpp = function () { // its assignments go with it
          state.find.items = state.find.items.filter(function (x) { return !(op && x.opp === op.id); });
          if (!state.find.items.length) state.find.items.push(blankAssign());
          state.find.opps.splice(+a, 1);
          if (isPerson(view)) { personRef = { kind: personRef.kind, g: 'opp', i: -1 }; leavePerson(); }
          fnRedraw();
        };
        if (op && (str(op.title).trim() || oppItems(op.id).some(function (m) { return assignHasText(m.x); }))) confirmRemove('Remove “' + (str(op.title).trim() || 'this opportunity') + '” and its assignments?', dropOpp); else dropOpp();
        break;
      }
      case 'ns-toggle': nsOpen = !nsOpen; renderPerson(); break;
      case 'info': toggleInfo(a); break;
      case 'row-toggle': {
        expOpen = expOpen === a ? '' : a;
        if (expOpen) { var rp = a.split('|'), ra = state.cp[rp[1]] && state.cp[rp[1]][+rp[2]]; expKeys = ra ? openChecks(ra, rp[1]).map(function (c) { return c.k; }) : []; }
        if (a.indexOf('bw|') === 0) renderBefore(); else renderWC();
        var rl = document.querySelector('[data-action="row-toggle"][data-a="' + a + '"]'); if (rl && expOpen) rl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      }
      case 'swipe-hint-ok': swipeLearned(); break;
      case 'check-item': case 'check-na': { // the checklist on Before ward council's screen (and Next steps in Ward Council)
        var cg = a.split('|')[0], ci = +a.split('|')[1], ca = state.cp[cg] && state.cp[cg][ci], cc = (CHECKLISTS[cg] || []).filter(function (x) { return x.k === b; })[0];
        if (!ca || !cc) break;
        if (!ca.checks || typeof ca.checks !== 'object') ca.checks = {};
        var cur = checkOf(ca, cg, cc);
        if (act === 'check-na') { if (cur === 'na') delete ca.checks[cc.k]; else ca.checks[cc.k] = 'na'; }
        else if (cc.temple && cg === 'nm') ca.temple = !ca.temple;
        else if (cur === true) delete ca.checks[cc.k]; else ca.checks[cc.k] = true;
        ca.touched = todayISO();
        if (view === 'p-wc' || view === 'wc-cp') { state.ask = state.ask || {}; state.ask.changed = true; } // Ward Council checked off a step
        renderPerson(); renderBefore(); renderCP(); renderWC(); saveDraft();
        break;
      }
      case 'help-chip': case 'ord-suggest': { // a tapped suggestion fills the Action item (or What will help); a suggested ordinance fills Next ordinance
        if (/\.action$/.test(a)) { // the Assignment can hold more than one: each tapped idea is a line of its own; tapping it again takes it out
          var lines = str(getPath(a)).split('\n').filter(function (x) { return x.trim(); }), at = lines.map(function (x) { return x.trim(); }).indexOf(b);
          if (at >= 0) lines.splice(at, 1); else lines.push(b);
          setPath(a, lines.join('\n'));
        } else setPath(a, b);
        saveDraft(); renderPerson(); renderTN(); renderCP();
        if (/\.action$/.test(a)) refreshTextButton(a.replace(/action$/, '')); // the ideas stay in view to add another (no jump to Assigned to)
        break;
      }
      case 'open-asg': case 'add-asg': { // from an opportunity's card in the Huddle: open it with that one assignment open
        var ao = state.find.opps[+a]; if (!ao) break;
        var aid = b;
        if (act === 'add-asg') { var na = blankAssign(); na.opp = ao.id; state.find.items.push(na); aid = na.id; saveDraft(); }
        asgOpen = {}; asgOpen[aid] = true;
        openPerson('hd', 'opp', +a);
        setTimeout(function () { var dd = document.querySelector('#person-card [data-fid="' + aid + '"]'); if (dd) { dd.scrollIntoView({ block: 'center' }); if (act === 'add-asg') { var tf = dd.querySelector('[data-bind$=".task"]'); if (tf) tf.focus({ preventScroll: true }); } } }, 80);
        break;
      }
      case 'swipe-remove-opp': { // swiped left: the same question as Remove this opportunity
        var so = state.find.opps[+a]; if (!so) break;
        var sItems = oppItems(so.id).filter(function (m) { return assignHasText(m.x); }).length;
        ask({ title: 'Remove “' + (str(so.title).trim() || 'this opportunity') + '”?', body: sItems ? 'Its ' + plural(sItems, 'assignment is', 'assignments are') + ' removed too.' : 'It comes off Opportunities to invite.',
          primary: 'Remove', onPrimary: function () {
            state.find.items = state.find.items.filter(function (x) { return x.opp !== so.id; });
            if (!state.find.items.length) state.find.items.push(blankAssign());
            state.find.opps = state.find.opps.filter(function (o) { return o.id !== so.id; }); fnRedraw();
          }, secondary: 'Cancel',
          onSecondary: function () { Array.prototype.forEach.call(document.querySelectorAll('.swipe-li.is-open'), function (li) { li.classList.remove('is-open'); }); } });
        break;
      }
      case 'remove-fn': {
        var fx = state.find.items[+a];
        var dropFn = function () { state.find.items.splice(+a, 1); if (!state.find.items.length) state.find.items.push(blankAssign()); fnRedraw(); };
        if (fx && assignHasText(fx)) confirmRemove('Remove this assignment?', dropFn); else dropFn();
        break;
      }
      case 'tips': openOverlay('#tips-sheet', '#tips-title'); $('#tips-sheet .sheet').scrollTop = 0; break;
      case 'close-tips': closeOverlay('#tips-sheet'); break;
      case 'install': addToHomeScreen(); break;
      case 'hp-copy':
        if (handoffHere) copyText(handoffUrl(handoffHere.code)).then(function () { setHandoffCopied('ok'); }, function () { setHandoffCopied('failed'); });
        break;
      case 'hp-install': openInstallSteps(); break;
      // Loading it here keeps it in the browser's storage, apart from the Home Screen app. The page stays until it's confirmed.
      case 'hp-safari': if (handoffHere) { writeJSON('sessionStorage', 'huddle-safari-once', true); confirmApplyAgenda(handoffHere.s, 'handoff', closeHandoffPage); } break;
      case 'hp-close': closeHandoffPage(); break;
      case 'close-install': closeOverlay('#install-sheet'); break;
      case 'dismiss-install':
        $('#install-banner').hidden = true;
        writeJSON('sessionStorage', 'huddle-install-dismissed', true);
        break;
      case 'unload': {
        if (state.loaded && state.loaded.practice) { confirmRemovePractice(); break; }
        var doUnload = function () {
          state.rr = [blankRR(), blankRR()]; state.loaded = null;
          // Take back carried-over names nobody has added anything to yet.
          GROUPS.forEach(function (g) {
            var keep = state.cp[g.id].filter(function (a) { return !(a.carried && !hasText(a, ['action', 'assigned', 'when'])); });
            state.cp[g.id] = keep.length ? keep : [blankAction()];
          });
          renderRR(); renderCP(); saveDraft();
        };
        if (state.rr.some(function (x) { return x.happened || str(x.notes).trim(); })) {
          ask({ title: 'Remove last week’s items?', body: 'The answers and notes you entered for them will be erased.', primary: 'Remove', onPrimary: doUnload, secondary: 'Cancel' });
        } else doUnload();
        break;
      }
      case 'clear':
        if (!$('#help-sheet').hidden) closeHelp();
        if (isEmpty(state)) { toast('There’s nothing to erase.'); break; }
        ask({
          title: 'Erase everything?',
          body: 'Every name, need and assignment on this phone will be erased, along with the last huddle you sent. The ward name is kept. This can’t be undone.',
          primary: 'Erase everything', onPrimary: function () { removeKey('localStorage', 'huddle-conducting'); clearForm(true); toast('Everything is erased. The ward name is kept.'); },
          secondary: 'Cancel'
        });
        break;
      case 'send': startSend(); break;
      case 'share': sharePdf(); break;
      case 'save-only': saveWithoutSending(); break;
      case 'share-last': shareLast(); break;
      case 'close-send': closeSend(); break;
    }
  }

  /* ---------- Load last week ---------- */
  var fileInput = null;
  function pickFile() { fileInput.value = ''; fileInput.click(); }

  async function readHuddleData(file) {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    var info = doc.getInfoDict();
    var obj = info.lookup(PDFLib.PDFName.of('HuddleData'));
    if (!obj || typeof obj.decodeText !== 'function') return null;
    var data = JSON.parse(obj.decodeText());
    if (!data || data.app !== APP_ID || typeof data.v !== 'number') return null;
    return data;
  }

  /* ---------- Practice week ----------
   * A made-up "last week" so a first-time user can try Load last week, Return and Report and carry forward.
   * One sample person in each Covenant Path list and three focus names. It can't be sent or saved. */
  function isoShift(days) {
    var d = parseISO(state.date) || new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  // Tour only: when New members is empty, the tour shows one sample card so the name card stops have fields to point at.
  // It's never saved, and the real list comes back as soon as the tour moves on or ends.
  var tourDemo = null;
  function setTourDemo(on) {
    if (on && !tourDemo && listEmpty('nm')) {
      clearTimeout(draftTimer); // a save waiting to run must not catch the sample card
      tourDemo = { nm: state.cp.nm };
      state.cp.nm = [Object.assign(blankAction(), { name: 'Daniel Rivera', bap: isoShift(-12), ordinance: 'Baptisms for the dead', need: 'A ride to the temple',
        action: 'Drive him to the temple for baptisms', assigned: 'Bro. Patel', when: 'Sat 9 am' })];
      renderCP();
    } else if (!on && tourDemo) {
      state.cp.nm = tourDemo.nm; tourDemo = null; renderCP(); saveDraft();
    }
  }
  /* ---------- The next huddle and the last one sent ---------- */
  function monthDay(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
  // The last huddle sent from this phone: one copy, so it can be shared again. Replaced at the next send.
  function readLastSent() {
    var ls = readJSON('localStorage', LAST_SENT_KEY);
    return ls && ls.data && parseISO(str(ls.date)) ? ls : null;
  }
  function renderSent() {
    var bands = { 'week-rr': fromLabel(), 'band-plan': planLabel(), 'week-plan': planLabel() }; // no heading over Return and Report
    Object.keys(bands).forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = bands[id]; });
    var md = $('#meeting-date .md-text');
    if (md) { var d = parseISO(state.date); md.textContent = d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Set the date'; }
    var sl = $('#sent-line');
    if (sl) {
      var ls = readLastSent();
      var practice = !!(state.loaded && state.loaded.practice);
      sl.hidden = !ls || practice;
      if (ls && !practice) $('#sent-line-text').textContent = '✓ ' + monthDay(ls.date) + ' huddle sent';
    }
  }
  function shareLast() {
    var ls = readLastSent();
    if (!ls) { toast('There’s no sent huddle to share.'); return; }
    startSend(normalizeState(ls.data));
  }

  // Before sending: what's still open, each with a way to jump to it.
  function openItems() {
    var out = [];
    var go = function (id) { return function () { if (stepsOn) showView(id, 'push'); }; };
    if (!state.attendees.length) out.push({ text: 'Attendance not taken', go: function () { if (stepsOn && view !== 'home') showView('home', 'replace'); openDetails(); } });
    var rr = state.rr.filter(rrShown), unmarked = rr.filter(function (r) { return !r.happened; }).length;
    if (rr.length && unmarked) out.push({ text: 'Return and Report: ' + unmarked + ' not marked', go: go('rr') });
    var needs = function (list) { return list.filter(function (a) { return str(a.name).trim() && !str(a.action).trim(); }).length; };
    // (Action items are planned for focus names only; the Covenant Path Report names are reference.)
    if (CP_SECTION) { var cpN = GROUPS.reduce(function (n, g) { return n + needs(state.cp[g.id]); }, 0);
      if (cpN) out.push({ text: 'Covenant Path Report: ' + cpN + (cpN === 1 ? ' person needs' : ' people need') + ' an assignment', go: go('cp') });
      GROUPS.forEach(function (g) { if (listEmpty(g.id) && !noneConfirmed(g.id)) out.push({ text: g.title + ': not reviewed', go: go('cp') }); }); }
    var tnN = needs(state.tn);
    if (tnN) out.push({ text: 'Focus names: ' + tnN + (tnN === 1 ? ' person needs' : ' people need') + ' an assignment', go: go('tn') });
    if (!state.find.opps.some(function (o) { return str(o.title).trim(); })) out.push({ text: 'Opportunities to invite: none listed yet', go: go('fn') });
    return out;
  }

  function rrFromItem(it, happened) {
    return { prefilled: true, source: it.source, group: it.group, pname: it.pname, ord: it.ord, need: it.need || '', hneed: it.hneed || '', sac: !!it.sac, bap: it.bap || '', temple: !!it.temple, committed: !!it.committed,
      person: it.person, action: it.action, assigned: it.assigned, when: it.when, plan: '', happened: happened || '', notes: '', fid: it.fid || '' };
  }
  // Set up the next huddle from this one: its action items move into Return and Report,
  // names and needs stay, and the weekly parts (attendance, answers, checks) clear.
  function rollForward(next) {
    var data = JSON.parse(JSON.stringify(state));
    sweepStale(data);
    var items = extractActionItems(data);
    var f = freshState();
    f.ward = data.ward; f.conducting = data.conducting; f.conductingOther = data.conductingOther; f.date = next; f.rolledFrom = data.date;
    state = f; showBlank = {};
    state.rr = items.length ? items.map(function (it) { return rrFromItem(it, it.done ? 'Yes' : ''); }) : [blankRR(), blankRR()];
    carryNames(data);
    state.referrals = cleanReferrals(data.referrals); // referrals stay until they're removed
    state.find.opps = ((data.find && data.find.opps) || []).filter(function (o) { return str(o.title).trim() && (!parseISO(str(o.date)) || str(o.date) >= next); })
      .map(function (o) { return { id: o.id, title: o.title, date: o.date }; }); // until its date passes
    var keptOpp = {}; state.find.opps.forEach(function (o) { keptOpp[o.id] = 1; });
    var past = ((data.find && data.find.items) || []).filter(function (x) { return x && keptOpp[x.opp] && str(x.task).trim(); })
      .map(function (x) { return { id: str(x.id) || oppId(), task: str(x.task), who: str(x.who), when: str(x.when), opp: x.opp, past: true, status: x.status || (x.doneMid ? 'Yes' : ''), carried: false }; });
    if (past.length) state.find.items = past.concat(state.find.items.filter(assignHasText)).concat([blankAssign()]);
    resetView();
    renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    return items.length;
  }
  // Sending closes the huddle: a copy is kept to share again, and the app turns to the next huddle.
  // Undo (right after) puts the sent huddle back on screen, for a fix and a resend.
  function closeHuddle(downloaded) {
    var snap = JSON.parse(JSON.stringify(state));
    var prevLast = readJSON('localStorage', LAST_SENT_KEY);
    var sentDate = state.date;
    var planned = attention(); planned = planned.named - planned.missing.length; // people who leave this huddle with an action item
    writeJSON('localStorage', LAST_SENT_KEY, { date: sentDate, ward: state.ward.trim(), sentAt: new Date().toISOString(), data: makePayload(state) });
    var n = rollForward(todayISO());
    ask({
      title: downloaded ? 'Huddle report downloaded' : 'Sent', success: true, celebrate: true,
      cheer: planned ? plural(planned, 'person has', 'people have') + ' a plan this week.' : '',
      body: (downloaded ? 'Attach it to an email or text message to send it. ' : '') +
        'Next week starts with Before Ward Council. ' +
        (n ? 'This huddle’s assignments are now in Return and Report: mark them as people report back. ' : '') +
        'Names and needs stay for ward council to update.',
      primary: 'Done', onPrimary: function () { goStart(); },
      secondary: 'Undo', onSecondary: function () {
        state = normalizeState(snap); showBlank = {};
        if (prevLast) writeJSON('localStorage', LAST_SENT_KEY, prevLast); else removeKey('localStorage', LAST_SENT_KEY);
        resetView();
        renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
        toast('Your huddle is back. Send it again when it’s ready.', 6000);
      }
    });
  }

  // The 4-week check on names: untouched for 4 weeks asks "Still on the Covenant Path Report?"; 5 weeks removes it.
  function cardAge(a) { var t = str(a.touched); return parseISO(t) ? daysBetween(t, todayISO()) : 0; }
  function sweepStale(s) {
    var removed = 0;
    var check = function (a) {
      if (!str(a.name).trim()) return true;
      if (!parseISO(str(a.touched))) { a.touched = todayISO(); return true; }
      if (cardAge(a) >= STALE_DROP) { removed++; return false; }
      return true;
    };
    GROUPS.forEach(function (g) { var keep = s.cp[g.id].filter(check); s.cp[g.id] = keep.length ? keep : [blankAction()]; });
    s.tn = s.tn.map(function (a) { return check(a) ? a : blankName(); });
    return removed;
  }
  function staleNote(base, a, isTn) {
    if (!str(a.name).trim() || cardAge(a) < STALE_FLAG) return null;
    return h('div', { class: 'stale-note' }, [
      h('p', { text: 'Not updated in 4 weeks. ' + (isTn ? 'Still a focus name?' : 'Still on the Covenant Path Report?') }),
      h('div', { class: 'stale-actions' }, [
        h('button', { type: 'button', class: 'btn-small', 'data-action': 'stale-keep', 'data-a': base, text: 'Keep' }),
        h('button', { type: 'button', class: 'btn-small danger', 'data-action': 'stale-remove', 'data-a': base, text: 'Remove' })
      ])
    ]);
  }

  /* ---------- Messages, clipboard ---------- */
  function isPhone() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) ||
      !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var ta = h('textarea', { value: text, readonly: 'readonly' }); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove();
        if (ok) resolve(); else reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }
  // Opens Messages with the text written out (phones); on a computer, copies it instead.
  function openMessages(body) {
    if (isPhone()) {
      var link = document.createElement('a');
      link.href = 'sms:?&body=' + encodeURIComponent(body);
      document.body.appendChild(link); link.click(); link.remove();
      toast('Messages is opening. Pick who to send it to.', 5000);
    } else {
      copyText(body).then(function () { toast('Copied. Paste it into a text message.'); }, function () { toast('Couldn’t copy. Try on your phone.'); });
    }
  }

  /* ---------- Handoff link ----------
   * For when someone else conducts: the whole agenda rides in the link's # part, which browsers never send
   * to the website, so nothing is stored online. Opening the link loads it on the other leader's phone. */
  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function packHandoff(s, practice) {
    var c = JSON.parse(JSON.stringify(s));
    delete c.practiceSnapshot; delete c.loaded; c.sentAt = ''; c.sentSig = ''; c.collapsed = {}; c.openOne = {};
    var obj = { app: APP_ID, kind: 'handoff', v: 1, s: c }; if (practice) obj.practice = true; // a practice handoff loads as a practice week
    var bytes = new TextEncoder().encode(JSON.stringify(obj)), tag = 'j';
    if (window.CompressionStream) {
      try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); tag = 'z'; } catch (e) { /* send uncompressed */ }
    }
    return tag + b64url(bytes);
  }
  async function unpackHandoff(code) {
    var bytes = unb64url(code.slice(1));
    if (code[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    var obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || obj.app !== APP_ID || obj.kind !== 'handoff' || !obj.s) throw new Error('not a handoff');
    if (obj.practice) obj.s.__practice = true;
    return obj.s;
  }
  /* The huddle itself rides after the #, which a phone never sends to the website. Each link also gets a short
   * random tag before the # (it carries nothing about the huddle). Without it every handoff link looks the same
   * up to the #, and Safari can bring forward a Huddle tab that is already open instead of opening the link,
   * so the opening screen shows and the handoff page never does. */
  function handoffUrl(code) {
    var tag = Math.random().toString(36).slice(2, 8);
    return location.origin + location.pathname.replace(/index\.html$/, '') + '?h=' + tag + '#handoff=' + code;
  }
  // Hand off opens two choices: send this huddle (text it), or receive one (paste it).
  var handoffMsg = null, handoffBuild = null;
  function handoffBlocked() {
    return isEmpty(state) && !isPractice() ? 'Nothing to hand off yet.' : '';
  }
  function startHandoff() {
    var why = handoffBlocked(), sub = $('#handoff-send-sub');
    sub.textContent = why ? 'Nothing to hand off yet' : isPractice() ? 'Practice: text it to yourself to try it' : 'Text this huddle to the leader who conducts next';
    sub.classList.toggle('warn', false);
    $('#handoff-send').setAttribute('aria-disabled', why ? 'true' : 'false');
    // Build the link now, so tapping Send a handoff opens Messages right away.
    handoffMsg = null; handoffBuild = null;
    if (!why) handoffBuild = packHandoff(state, isPractice()).then(function (code) {
      var d = parseISO(state.date);
      handoffMsg = isPractice() ? 'Practice handoff (sample names, not a real huddle). Tap the link and follow the steps to try loading it into the Huddle app:\n' + handoffUrl(code) : 'Handoff: the ' + (state.ward.trim() ? state.ward.trim() + ' ' : '') + 'huddle' + (d ? ' for ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '') +
        '. Tap the link and follow the steps to load it into the Huddle app:\n' + handoffUrl(code);
      return handoffMsg;
    });
    openOverlay('#handoff-sheet', '#handoff-title');
  }
  function sendHandoff() {
    if (handoffBlocked()) return; // the row itself says why (a message here would cover Receive a handoff)
    closeOverlay('#handoff-sheet');
    if (handoffMsg) { openMessages(handoffMsg); return; }
    (handoffBuild || Promise.reject()).then(function (msg) { openMessages(msg); }, function () { toast('Couldn’t make the handoff. Try again.'); });
  }
  /* A handoff link opened in an iPhone's browser. iPhone opens links in Safari, never in the Home Screen app,
   * and the two keep their data apart, so the handoff can't land in the app. It gets a page of its own
   * (nothing of the app shows behind it) with one job: copy it, then paste it in the app. */
  var handoffHere = null;   // { code, s } while that page is showing
  var handoffPending = false; // a handoff link is being opened: the first-visit instructions wait
  function showHandoffPage(code, s) {
    var inc = normalizeState(s), day = parseISO(inc.date);
    handoffHere = { code: code, s: s };
    $('#hp-what').textContent = [inc.ward.trim(), day ? 'Huddle for ' + day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''].filter(Boolean).join(' · ') || 'A huddle';
    setHandoffCopied('');
    $('#hp-noapp').open = false;
    document.body.classList.add('handoff-open'); $('#handoff-page').hidden = false;
    window.scrollTo(0, 0);
    try { $('#hp-title').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  // how: '' (not copied yet), 'ok' or 'failed'. The steps stay on screen either way.
  function setHandoffCopied(how) {
    var moved = how !== '';
    $('#hp-copied').hidden = how !== 'ok'; $('#hp-copy-failed').hidden = how !== 'failed';
    $('#hp-copy').textContent = how === 'ok' ? 'Copy again' : 'Copy handoff';
    $('#hp-copy').className = (how === 'ok' ? 'btn-secondary' : 'btn-primary') + ' full';
    $('#hp-step-1').className = 'hp-step' + (how === 'ok' ? ' done' : moved ? '' : ' now');
    $('#hp-step-1 .hp-num').textContent = how === 'ok' ? '✓' : '1';
    $('#hp-step-2').className = 'hp-step' + (moved ? ' now' : '');
    $('#hp-step-3').className = 'hp-step' + (moved ? ' now' : '');
  }
  function closeHandoffPage() {
    handoffHere = null;
    $('#handoff-page').hidden = true; document.body.classList.remove('handoff-open');
    window.scrollTo(0, 0);
  }
  // A handoff link was opened.
  function checkHandoffLink() {
    var m = /[#&]handoff=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) return;
    var code = m[1];
    handoffPending = true;
    try { history.replaceState(history.state, '', location.pathname); } catch (e) { /* ignore */ } // the tag and the huddle both leave the address bar
    unpackHandoff(code).then(function (s) {
      if (isIOS && !isStandalone()) showHandoffPage(code, s);
      else confirmApplyAgenda(s, 'handoff');
    }, function () {
      ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or open Help & training, then Settings, Load a huddle report, and choose the last huddle report that was sent.', primary: 'OK' });
    });
  }
  function pasteHandoff() {
    var manual = function (msg) {
      ask({ title: 'Paste a handoff', body: msg || 'Paste the handoff link you were texted.', textField: { label: 'Handoff link', placeholder: 'https://…#handoff=…' },
        primary: 'Load', onPrimary: function () { useText(($('#confirm-text') || {}).value, true); }, secondary: 'Cancel' });
    };
    var useText = function (text, typed) {
      var m = /handoff=([A-Za-z0-9_-]+)/.exec(text || '');
      if (!m) { if (typed) ask({ title: 'That isn’t a handoff link', body: 'Copy the whole link from the text, then try again.', primary: 'OK' }); else manual('There’s no handoff link on the clipboard. Paste it here:'); return; }
      unpackHandoff(m[1]).then(function (s) { confirmApplyAgenda(s, 'handoff'); }, function () { ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or open Help & training, then Settings, Load a huddle report, and choose the last huddle report that was sent.', primary: 'OK' }); });
    };
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { useText(t, false); }, function () { manual(); });
    else manual();
  }

  // A handoff is a huddle still being planned: it loads as it was.
  // A PDF is a huddle that was sent: loading it sets up the next huddle from it, the same as sending does.
  // Either way, Undo puts this phone's agenda back.
  function confirmApplyAgenda(data, how, after) {
    if (data && data.__practice) {
      ask({ title: 'This was a practice handoff', body: 'It holds sample names from the practice week, which Huddle no longer has. There’s nothing to load.', primary: 'OK' });
      return;
    }
    // A real huddle never loads over a practice week (that would lose the huddle set aside under it).
    if (isPractice()) {
      ask({ title: 'Remove the practice week first', body: 'Your own huddle is set aside while you practice. Remove the practice week, then load this again.',
        primary: 'Remove practice week', onPrimary: removePractice, secondary: 'Cancel' });
      return;
    }
    var incoming = normalizeState(data);
    incoming.loaded = null; incoming.practiceSnapshot = null; incoming.sentAt = ''; incoming.sentSig = '';
    var pdf = how === 'pdf';
    var rows = [['Ward', incoming.ward.trim() || 'Not listed'], [pdf ? 'Sent huddle' : 'Huddle', longDate(incoming.date) || 'No date']];
    if (state.ward.trim() && incoming.ward.trim() && norm(state.ward) !== norm(incoming.ward)) rows.push(['This phone’s ward', state.ward.trim()]);
    var replaces = isEmpty(state) ? '' : ' It replaces the huddle on this phone. You can undo it right after.';
    ask({
      title: pdf ? 'Set up the next huddle from this huddle report?' : 'Load this handoff?', compare: rows,
      body: pdf ? 'Its assignments go into Return and Report, and its names and needs stay.' + replaces : (isEmpty(state) ? 'It becomes the huddle on this phone.' : replaces.trim()),
      primary: pdf ? 'Set up the next huddle' : 'Load it', onPrimary: function () { if (after) after(); applyAgenda(incoming, pdf); }, secondary: 'Cancel'
    });
  }
  function applyAgenda(incoming, fromPdf) {
    var snap = JSON.parse(JSON.stringify(state));
    state = incoming; showBlank = {}; sweepStale(state);
    if (state.ward.trim()) writeWard(state.ward.trim());
    if (fromPdf) rollForward(todayISO());
    resetView();
    renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast(fromPdf ? 'Set up your next huddle from the ' + monthDay(incoming.date) + ' PDF.' : 'Loaded the ' + (monthDay(state.date) ? monthDay(state.date) + ' ' : '') + 'huddle.', 8000,
      { label: 'Undo', run: function () { state = normalizeState(snap); showBlank = {}; resetView(); renderAll(); applyView(); saveDraft(); toast('Your huddle is back.'); } });
  }

  function isPractice() { return !!(state.loaded && state.loaded.practice); }
  // (The guided tour and its practice week were taken out, Nov 18, 2026. A phone that was in the middle of one gets its
  // own huddle back when the app opens; the keys below only clean that up.)
  var COACH_KEY = 'huddle-coach-step', GUIDE_OFFERED_KEY = 'huddle-tour-seen';
  function stopCoach() {
    try { localStorage.removeItem(COACH_KEY); } catch (e) { /* ignore */ }
    var el = document.querySelector('.coach'); if (el) el.remove();
    document.body.classList.remove('coaching'); document.body.style.removeProperty('--coach-h');
  }
  function removePractice() {
    stopCoach();
    var snap = state.practiceSnapshot;
    state = normalizeState(snap || null); state.loaded = null; state.practiceSnapshot = null;
    resetView(); renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast('The practice week is gone. Your own names are back the way they were.');
  }
  function confirmRemovePractice() {
    ask({ title: 'Remove the practice week?', body: 'The sample names and anything you entered while practicing are cleared, and your own names come back the way they were.',
      primary: 'Remove practice week', onPrimary: removePractice, secondary: 'Cancel' });
  }
  function extractActionItems(data) {
    var items = [];
    var cp = data.cp || {};
    GROUPS.forEach(function (g) {
      (Array.isArray(cp[g.id]) ? cp[g.id] : []).forEach(function (a) {
        if (!a || !str(a.action).trim()) return; // a name with no assignment has nothing to report back
        items.push(itemFrom(a, g.id));
      });
    });
    (Array.isArray(data.tn) ? data.tn : []).forEach(function (n) {
      if (!n || !str(n.action).trim()) return;
      items.push(itemFrom(n, 'tn'));
    });
    var fd = data.find && typeof data.find === 'object' ? data.find : {};
    var opps = Array.isArray(fd.opps) ? fd.opps : [];
    (Array.isArray(fd.items) ? fd.items : []).forEach(function (x) {
      if (!x || !str(x.task).trim() || x.past) return;
      var op = opps.find(function (o) { return o && x.opp && o.id === x.opp; }), opT = op ? str(op.title).trim() : '';
      items.push({ source: SOURCE.fn, group: 'fn', pname: '', ord: '', need: '', hneed: '', sac: false, bap: '', temple: false, committed: false,
        person: '', action: str(x.task).trim() + (opT ? ' (' + opT + ')' : ''), assigned: str(x.who).trim(), when: str(x.when).trim(), done: !!x.doneMid, fid: str(x.id) });
    });
    return items;
  }
  // One of last week's name cards, as a Return and Report item (all of its fields come along).
  function itemFrom(a, gid) {
    var name = str(a.name).trim(), ord = ordOf(a, gid);
    return {
      source: SOURCE[gid], group: gid, pname: name, ord: ord, need: str(a.need).trim(), hneed: str(a.hneed).trim(), sac: !!a.sac,
      bap: gid === 'nm' || gid === 'bt' ? str(a.bap) : '', temple: gid === 'nm' && !!a.temple, committed: gid === 'bt' && !!a.committed,
      person: ord ? (name ? name + ' · ' : '') + 'Next: ' + ord : name,
      action: str(a.action).trim(), assigned: str(a.assigned).trim(), when: str(a.when).trim(),
      done: !!a.doneMid && !!str(a.action).trim()
    };
  }

  // Carries last week's names (New members, Returning members, Those being taught) into this
  // week's Covenant Path Report Review with blank action fields. Never overwrites typed entries.
  function carryNames(data) {
    var added = 0;
    var cp = data.cp || {};
    GROUPS.forEach(function (g) {
      var names = [], info = {};
      (Array.isArray(cp[g.id]) ? cp[g.id] : []).forEach(function (a) {
        var n = a && str(a.name).trim();
        if (n && names.every(function (x) { return norm(x) !== norm(n); })) { names.push(n); info[norm(n)] = { checks: cleanChecks(a.checks), ordinance: str(a.ordinance).trim(), need: str(a.need).trim(), hneed: str(a.hneed).trim(), bap: str(a.bap), appt: str(a.appt), temple: !!a.temple, committed: !!a.committed, sac: !!a.sac, touched: parseISO(str(a.touched)) ? str(a.touched) : '' }; }
      });
      if (!names.length) return;
      var cur = state.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      names.forEach(function (n) {
        if (cur.some(function (a) { return norm(a.name) === norm(n); })) return;
        var c = blankAction(); c.name = n; c.ordinance = info[norm(n)].ordinance; c.hneed = info[norm(n)].hneed; c.carried = true; c.touched = info[norm(n)].touched; c.lastSac = info[norm(n)].sac; c.checks = info[norm(n)].checks;
        if (g.id === 'nm') { c.bap = info[norm(n)].bap; c.temple = info[norm(n)].temple; }
        if (g.id === 'bt') { c.bap = info[norm(n)].bap; c.committed = info[norm(n)].committed; c.appt = apptNote({ appt: info[norm(n)].appt }) ? info[norm(n)].appt : ''; }
        cur.push(c);
        added++;
      });
      state.cp[g.id] = cur.length ? cur : [blankAction()];
    });
    // Name Next Ordinance: last week's focus names fill this week's empty spots (never over typed ones).
    (Array.isArray(data.tn) ? data.tn : []).forEach(function (a) {
      var n = a && str(a.name).trim();
      if (!n || state.tn.some(function (t) { return norm(t.name) === norm(n); })) return;
      var slot = state.tn.findIndex(function (t) { return !t.sac && !hasText(t, CARD_KEYS); });
      if (slot < 0) return;
      var c = blankName(); c.name = n; c.ordinance = str(a.ordinance).trim(); c.hneed = str(a.hneed).trim(); c.carried = true; c.lastSac = !!a.sac;
      c.touched = parseISO(str(a.touched)) ? str(a.touched) : '';
      state.tn[slot] = c;
      added++;
    });
    return added;
  }

  function groupOf(r) {
    if (r.group) return r.group;
    return { 'New members': 'nm', 'Returning members': 'rm', 'Those being taught': 'bt', 'Three Names': 'tn', '3 Names': 'tn', 'Name Next Ordinance': 'tn', 'Focus names': 'tn', 'Finding new people': 'fn', 'Opportunities to invite': 'fn' }[r.source] || '';
  }
  // Copies an unfinished item from last week into this week's plan for the same person.
  // Fills only the empty fields on an existing card and remembers which ones, so Undo can clear exactly those.
  function fillEmpty(target, src, keys) {
    var filled = {};
    keys.forEach(function (k) {
      var empty = typeof target[k] === 'boolean' ? !target[k] : !str(target[k]).trim();
      var has = typeof src[k] === 'boolean' ? src[k] : str(src[k]).trim();
      if (empty && has) { target[k] = src[k]; filled[k] = src[k]; }
    });
    return filled;
  }
  // Puts last week's action on a card that may already have one this week: fills it if empty,
  // or adds it on a new line so neither is lost. Returns what Undo needs to take it back out.
  function mergeAction(target, src, keys) {
    var act = str(src.action).trim(), cur = str(target.action).trim();
    var filled = fillEmpty(target, src, keys.filter(function (k) { return k !== 'action'; }).concat(cur ? [] : ['action']));
    var appended = '';
    if (act && cur && norm(cur).indexOf(norm(act)) < 0) { target.action = cur + '\n' + act; appended = act; }
    if (act) target.actionCarried = true;
    return { filled: filled, appended: appended };
  }
  // Is the person this item was for still on their list? (Finding assignments have no person.)
  // Which list is this person on now? Usually the one the item came from; someone converted from
  // Those being taught to New members is followed to their new list. '' = no longer listed.
  function currentGroup(r) {
    var g = groupOf(r); if (g === 'fn') return 'fn';
    var nm = norm(rrPerson(r)); if (!nm || !g) return '';
    var on = function (list) { return (list || []).some(function (a) { return norm(a.name) === nm; }); };
    if (g === 'tn') return on(state.tn) ? 'tn' : '';
    if (on(state.cp[g])) return g;
    var other = GROUPS.filter(function (x) { return x.id !== g && on(state.cp[x.id]); })[0];
    return other ? other.id : '';
  }
  function stillListed(r) { return !!currentGroup(r); }
  // A carried item whose person has since been removed is no longer on this huddle's plan.
  function reconcileCarries() {
    state.rr.forEach(function (r) { if (r.prefilled && r.carriedFwd && !stillListed(r)) { r.carriedFwd = false; delete r.carryUndo; } });
  }
  function carryForward(i) {
    var r = state.rr[i]; if (!r) return;
    if (!stillListed(r)) { renderRR(); return; }
    var g = currentGroup(r);
    var name = str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim();
    var ord = str(r.ord).trim() || (str(r.person).split(' · Next: ')[1] || '').trim();
    var item = blankAction();
    item.name = name; item.ordinance = ord; item.need = str(r.need).trim(); item.hneed = str(r.hneed).trim(); item.action = str(r.action).trim(); item.assigned = str(r.assigned).trim();
    if (g === 'nm') { item.bap = str(r.bap); item.temple = !!r.temple; }
    if (g === 'bt') { item.bap = str(r.bap); item.committed = !!r.committed; }
    var undo = null;
    if (g) delete state.collapsed[g];
    if (g === 'fn') {
      var fl = state.find.items, cop = null, ctask = item.action, made = '';
      state.find.opps.forEach(function (o) { var t = str(o.title).trim(), sfx = ' (' + t + ')'; if (!cop && t && ctask.slice(-sfx.length) === sfx) { cop = o; ctask = ctask.slice(0, -sfx.length).trim(); } });
      if (!cop) {
        cop = state.find.opps.filter(function (o) { return o.title === 'Other assignments'; })[0];
        if (!cop) { cop = { id: oppId(), title: 'Other assignments', date: '' }; state.find.opps.push(cop); made = cop.id; }
      }
      if (!fl.some(function (x) { return x.opp === cop.id && norm(x.task) === norm(ctask); })) {
        if (fl.length === 1 && !assignHasText(fl[0])) fl.pop();
        fl.push({ task: ctask, who: item.assigned, when: '', carried: true, opp: cop.id });
        undo = { g: 'fn', kind: 'new', action: ctask, opp: cop.id, made: made };
      } else undo = { g: 'fn', kind: 'none' };
      renderFN();
    } else if (g) { // every carried assignment comes back as a focus name, past three if need be
      var slot = state.tn.findIndex(function (n) { return name && norm(n.name) === norm(name); });
      if (slot < 0) slot = state.tn.findIndex(function (n) { return !n.sac && !hasText(n, CARD_KEYS); });
      if (slot < 0) { state.tn.push(blankName()); slot = state.tn.length - 1; }
      if (!item.ordinance && g !== 'tn') item.ordinance = FIXED_ORD[g] || '';
      var mt = mergeAction(state.tn[slot], item, ['name', 'ordinance', 'need', 'hneed', 'action', 'assigned']);
      undo = { g: 'tn', kind: 'fill', name: name, filled: mt.filled, appended: mt.appended };
      renderTN(); renderCP();
    } else if (g) {
      var list = state.cp[g];
      var match = list.find(function (a) { return name && norm(a.name) === norm(name); });
      if (match) {
        var mk = ['action', 'assigned', 'ordinance', 'need', 'hneed'].concat(g === 'nm' ? ['bap', 'temple'] : g === 'bt' ? ['bap', 'committed'] : []);
        var mc = mergeAction(match, item, mk);
        undo = { g: g, kind: 'fill', name: name, filled: mc.filled, appended: mc.appended };
      }
      else {
        if (list.length === 1 && !list[0].sac && !hasText(list[0], CARD_KEYS)) list.pop();
        item.carried = true; item.actionCarried = true; list.push(item);
        undo = { g: g, kind: 'new', name: name, action: item.action };
      }
      renderCP();
    } else return;
    r.carriedFwd = true; r.carryUndo = undo;
    renderRR(); saveDraft();
    toast('Added to ' + nextPlan() + '. Update who and when as needed.');
  }

  // Takes a carried item back out of this week's plan: removes the card or assignment it added,
  // or clears just the fields it filled in. Anything typed since then stays.
  function undoCarry(i) {
    var r = state.rr[i]; if (!r || !r.carriedFwd) return;
    var u = r.carryUndo || {}, g = u.g || groupOf(r);
    var name = str(u.name || r.pname).trim();
    if (g === 'fn' && u.kind === 'new') {
      var fl = state.find.items;
      var fi = fl.findIndex(function (x) { return x.carried && norm(x.task) === norm(u.action); });
      if (fi >= 0) fl.splice(fi, 1);
      if (u.made && !fl.some(function (x) { return x.opp === u.made; })) state.find.opps = state.find.opps.filter(function (o) { return o.id !== u.made; });
      if (!fl.length) fl.push(blankAssign());
      renderFN();
    } else if (g === 'tn' || (g && state.cp[g])) {
      var list = g === 'tn' ? state.tn : state.cp[g];
      var idx = list.findIndex(function (a) { return name && norm(a.name) === norm(name) && (a.actionCarried || u.kind === 'fill'); });
      if (idx >= 0) {
        var c = list[idx];
        if (u.kind === 'new' && g !== 'tn') {
          list.splice(idx, 1);
          if (!list.length) list.push(blankAction());
        } else {
          Object.keys(u.filled || {}).forEach(function (k) {
            if (typeof c[k] === 'boolean') { if (c[k] === u.filled[k]) c[k] = false; }
            else if (str(c[k]).trim() === str(u.filled[k]).trim()) c[k] = '';
          });
          // Take back an action that was added below this week's own.
          var ap = str(u.appended).trim(), ca = str(c.action);
          if (ap && ca.slice(-(ap.length + 1)) === '\n' + ap) c.action = ca.slice(0, -(ap.length + 1)).trim();
          c.actionCarried = false;
        }
        delete state.openOne[g];
      }
      if (g === 'tn') renderTN(); else renderCP();
    }
    r.carriedFwd = false; delete r.carryUndo;
    renderRR(); saveDraft();
    toast('Carry forward undone. It’s off ' + nextPlan() + '.');
  }
  function confirmUndoCarry(i, title) {
    var r = state.rr[i]; if (!r) return;
    var who = rrPerson(r);
    ask({
      title: title || 'Undo carry forward?',
      body: 'This takes “' + (str(r.action).trim() || 'this item') + '”' + (who && groupOf(r) !== 'fn' ? ' for ' + who : '') + ' back off ' + nextPlan() + '.',
      primary: 'Undo carry forward', onPrimary: function () { undoCarry(i); },
      secondary: 'Keep it'
    });
  }

  function applyLoad(data, fileName, opts) {
    opts = opts || {};
    var snap = opts.practice ? (state.practiceSnapshot || JSON.parse(JSON.stringify(state))) : null;
    state.collapsed = {}; state.openOne = {};
    var items = extractActionItems(data);
    if (!items.length) {
      ask({ title: 'Nothing to load', body: 'Last week’s huddle report doesn’t have any assignments filled in.', primary: 'OK' });
      return;
    }
    state.rr = items.map(function (it) { return rrFromItem(it, ''); });
    state.loaded = { fileName: fileName, ward: str(data.ward), date: str(data.date), count: items.length, practice: !!opts.practice };
    // the practice week has an upcoming opportunity from ward council, ready for the huddle's assignments
    state.practiceSnapshot = snap;
    if (!opts.practice && !state.ward.trim() && data.ward) { state.ward = str(data.ward); $('#ward').value = state.ward; writeWard(state.ward); }
    var carried = carryNames(data);
    if (opts.practice) state.referrals = cleanReferrals(data.referrals);
    renderRR(); renderCP(); renderTN(); renderMR(); saveDraft();
    toast(opts.practice ? 'Practice week loaded: sample names, with ' + items.length + ' sample assignments in Return and Report.'
      : 'Loaded ' + items.length + (items.length === 1 ? ' assignment' : ' assignments') +
      (carried ? ' and ' + carried + (carried === 1 ? ' name' : ' names') : '') + ' from last week.', opts.practice ? 6000 : undefined);
    if (stepsOn) { var sh = $('#steps-home'); if (sh) sh.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    else { var sec = $('#h-rr'); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (carried && !opts.practice && !readFlag(NAMES_HINT_KEY)) { // (not during the guided tour)
      writeFlag(NAMES_HINT_KEY);
      ask({
        title: 'Check the names that carried over',
        body: 'These names stay from one huddle to the next. Before ward council, compare them to this week’s Covenant Path Report: add anyone new and remove anyone no longer listed.',
        primary: 'Show me the names', onPrimary: function () {
          if (stepsOn) { showView('cp', 'push'); return; }
          var g = $('#cp-groups'); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' });
        },
        secondary: 'Got it'
      });
    }
  }

  async function onFilePicked() {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var data = null;
    try { data = await readHuddleData(f); } catch (e) { data = null; }
    fileInput.value = '';
    if (!data) {
      ask({
        title: 'This huddle report can’t be loaded',
        body: 'It wasn’t made with Huddle. Choose the huddle report (the PDF named “Huddle - [Ward] - [Date]”) from your last huddle.',
        primary: 'Choose a different file', onPrimary: pickFile,
        secondary: 'Cancel'
      });
      return;
    }
    confirmApplyAgenda(data, 'pdf');
  }

  // Ward and date checks before loading. chooseAgain reopens wherever the agenda came from.
  function checkAndApply(data, label, chooseAgain) {
    var formWard = state.ward.trim();
    var wardMismatch = !!(formWard && data.ward && norm(formWard) !== norm(data.ward));
    var age = data.date ? daysBetween(data.date, state.date || todayISO()) : null;
    var tooOld = age !== null && age > MAX_AGE_DAYS;
    var future = age !== null && age < 0;
    if (wardMismatch || tooOld || future) {
      var title = wardMismatch ? 'This huddle report is from a different ward'
        : future ? 'This huddle report is dated after this meeting'
        : 'This huddle report is more than two weeks old';
      var rows = [['Agenda ward', str(data.ward) || 'Not listed']];
      if (formWard) rows.push(['This form', formWard]);
      rows.push(['Agenda date', shortDate(data.date) || 'Not listed']);
      ask({
        title: title, compare: rows,
        body: 'Make sure you picked your ward’s huddle report from last week before loading it.',
        primary: 'Choose a different one', onPrimary: chooseAgain,
        secondary: 'Load it anyway', onSecondary: function () { applyLoad(data, label); }
      });
      return;
    }
    applyLoad(data, label);
  }

  /* ---------- Saved agendas (this phone only) ----------
   * Stores the form data (not the PDF) in this site's private IndexedDB.
   * One entry per ward and date; only the newest KEEP entries are kept. */
  var DB_NAME = 'huddle', STORE = 'agendas', KEEP = 4;
  var savedById = {};
  function openDB() {
    return new Promise(function (resolve, reject) {
      try {
        if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
  }
  function storeReq(db, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode);
      var result;
      var r = fn(t.objectStore(STORE));
      if (r) r.onsuccess = function () { result = r.result; };
      t.oncomplete = function () { resolve(result); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  }
  function newestFirst(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.savedAt < b.savedAt ? 1 : -1;
  }
  var MAX_KEEP_DAYS = 28;
  // An agenda is erased once its meeting date is more than 4 weeks ago.
  function isExpired(r) {
    var age = daysBetween(r && r.date, todayISO());
    return !r || !r.data || r.data.app !== APP_ID || age === null || age > MAX_KEEP_DAYS;
  }
  // Removes expired agendas and anything beyond the newest KEEP. Returns what's left, newest first.
  async function pruneAgendas(db) {
    var all = (await storeReq(db, 'readonly', function (s) { return s.getAll(); }) || []).sort(newestFirst);
    var keep = all.filter(function (r) { return !isExpired(r); }).slice(0, KEEP);
    var gone = all.filter(function (r) { return keep.indexOf(r) < 0; });
    if (gone.length) await storeReq(db, 'readwrite', function (s) { gone.forEach(function (r) { s.delete(r.id); }); return null; });
    return keep;
  }
  async function listAgendas() {
    try {
      var db = await openDB();
      var list = await pruneAgendas(db);
      db.close();
      return list;
    } catch (e) { return null; } // null = this browser won't let the page store anything
  }
  async function saveAgenda(payload) {
    var db = await openDB();
    var rec = { id: norm(payload.ward) + '|' + payload.date, ward: payload.ward, date: payload.date, savedAt: new Date().toISOString(), data: payload };
    writeMeetingDay(payload.date);
    await storeReq(db, 'readwrite', function (s) { return s.put(rec); });
    await pruneAgendas(db);
    db.close();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  }
  async function deleteAllAgendas() {
    var db = await openDB();
    await storeReq(db, 'readwrite', function (s) { return s.clear(); });
    db.close();
  }

  // "Saved today, 6:19 AM", "Saved yesterday, 8:05 PM" or "Saved Oct 29, 7:42 PM"
  function savedLabel(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var day = new Date(d); day.setHours(0, 0, 0, 0);
    var diff = Math.round((today - day) / 86400000);
    var when = diff === 0 ? 'today' : diff === 1 ? 'yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return 'Saved ' + when + ', ' + time;
  }
  async function openLoad() {
    var list = await listAgendas();
    if (list === null) {
      ask({
        title: 'Saved agendas aren’t available',
        body: 'This browser isn’t letting the page save anything (private browsing can do this). You can still load last week’s huddle report from a file.',
        primary: 'Load from a file', onPrimary: pickFile,
        secondary: 'Cancel'
      });
      return;
    }
    if (!list.length) {
      ask({
        title: 'No saved agendas yet',
        body: 'Each agenda you send or save is kept on this phone for 4 weeks. First time? Try a practice week with sample names to see how Load last week works. If last week’s PDF is in your email or Files, choose Load from a file.',
        primary: 'Load from a file', onPrimary: pickFile,
        secondary: 'Cancel'
      });
      return;
    }
    savedById = {};
    var wrap = $('#agenda-list');
    // The practice week is always offered at the end of the list, so it's there even after real agendas are saved.
    var pchev = h('span', { class: 'chev', 'aria-hidden': 'true' });
    pchev.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l5 5-5 5"/></svg>';
    var practiceRow = h('div', { class: 'agenda-entry practice-entry' }, [
      h('button', { type: 'button', class: 'agenda-row', 'data-action': 'practice' }, [
        h('span', { class: 'agenda-row-text' }, [
          h('span', { class: 'agenda-row-title', text: 'Practice week' }),
          h('span', { class: 'agenda-row-sub', text: 'Sample names · 7 assignments · can’t be sent or saved' })
        ]),
        pchev
      ])
    ]);
    wrap.replaceChildren.apply(wrap, list.map(function (r) {
      savedById[r.id] = r;
      var n = extractActionItems(r.data).length;
      var chev = h('span', { class: 'chev', 'aria-hidden': 'true' });
      chev.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l5 5-5 5"/></svg>';
      return h('div', { class: 'agenda-entry' }, [
        h('button', { type: 'button', class: 'agenda-row', 'data-action': 'pick-agenda', 'data-a': r.id }, [
          h('span', { class: 'agenda-row-text' }, [
            h('span', { class: 'agenda-row-title', text: longDate(r.date) || r.date }),
            h('span', { class: 'agenda-row-sub', text: (r.ward || 'Ward not listed') + ' · ' + n + (n === 1 ? ' assignment' : ' assignments') }),
            r.savedAt ? h('span', { class: 'agenda-row-time', text: savedLabel(r.savedAt) }) : null
          ]),
          chev
        ]),
        h('div', { class: 'agenda-entry-actions' }, [
          h('button', { type: 'button', class: 'btn-small', 'data-action': 'open-agenda', 'data-a': r.id, 'aria-label': 'Open the ' + shortDate(r.date) + ' agenda to edit', text: 'Open to edit' }),
          h('button', { type: 'button', class: 'btn-small', 'data-action': 'share-agenda', 'data-a': r.id, 'aria-label': 'Share the ' + shortDate(r.date) + ' huddle report again', text: 'Share again' })
        ])
      ]);
    }).concat([practiceRow]));
    openOverlay('#handoff-sheet', '.agenda-row');
  }

  /* ---------- PDF ---------- */
  function fileName(s) {
    s = s || state;
    var w = s.ward.trim().replace(/[\\/:*?"<>|#%{}~&]+/g, '').replace(/\s+/g, ' ').slice(0, 60) || 'Ward';
    return 'Huddle - ' + w + ' - ' + s.date + '.pdf';
  }

  async function buildPdf(s, opts) {
    opts = opts || {};
    var P = PDFLib;
    var doc = await P.PDFDocument.create();
    var F = {
      reg: await doc.embedFont(P.StandardFonts.Helvetica),
      bold: await doc.embedFont(P.StandardFonts.HelveticaBold),
      ital: await doc.embedFont(P.StandardFonts.HelveticaOblique)
    };
    var rgb = P.rgb;
    var C = {
      navy: rgb(0.122, 0.22, 0.392), blue: rgb(0.18, 0.333, 0.592), dark: rgb(0.133, 0.133, 0.133),
      gray: rgb(0.42, 0.447, 0.502), line: rgb(0.788, 0.808, 0.839), white: rgb(1, 1, 1),
      faint: rgb(0.62, 0.65, 0.70), hudInk: rgb(0.64, 0.29, 0.07)
    };
    // Each Covenant Path list gets its own color on the PDF, matching the form.
    var GROUP_PDF = {
      nm: { fill: rgb(0.929, 0.949, 0.980), ink: rgb(0.18, 0.333, 0.592) },
      rm: { fill: rgb(0.929, 0.965, 0.941), ink: rgb(0.122, 0.42, 0.227) },
      bt: { fill: rgb(0.957, 0.933, 0.976), ink: rgb(0.478, 0.247, 0.62) },
      tn: { fill: rgb(1, 0.973, 0.902), ink: rgb(0.62, 0.42, 0.02) },
      fn: { fill: rgb(0.91, 0.961, 0.961), ink: rgb(0.055, 0.431, 0.451) },
      mr: { fill: rgb(0.98, 0.933, 0.945), ink: rgb(0.659, 0.2, 0.333) }
    };
    var TEMPLE_RED = rgb(0.70, 0.16, 0.16);
    var STATUS_PDF = { Yes: rgb(0.122, 0.42, 0.227), Partly: rgb(0.62, 0.42, 0.02), No: rgb(0.70, 0.16, 0.16) };
    var STATUS_FILL = { Yes: rgb(0.906, 0.957, 0.922), Partly: rgb(1, 0.957, 0.855), No: rgb(0.988, 0.918, 0.918) };
    // A phone-shaped page: it fills a phone screen without zooming, and prints on letter paper as a narrow column.
    var W = 360, H = 780, L = 22, R = 338, TOP = 26, BOTTOM = 40;
    var IN = 23;                              // a block's text sits this far in from its color bar
    var LBL = 80;                             // room for the small labels ("Next ordinance")
    var FS = 12, LH = 14, MS = 10, MLH = 12; // the value text, and the smaller gray lines under it
    var page = null, y = 0, pages = [];
    var wardTxt = s.ward.trim(), dateTxt = longDate(s.date);

    var encCache = {};
    function clean(text, font) {
      text = str(text).replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
      var out = '';
      for (var ch of text) {
        if (ch === '\n') { out += ch; continue; }
        var key = font.name + ch;
        if (!(key in encCache)) {
          try { font.encodeText(ch); encCache[key] = true; } catch (e) { encCache[key] = false; }
        }
        out += encCache[key] ? ch : ''; // e.g. emoji: Helvetica can't print them, so they're left out of the PDF
      }
      return out;
    }
    function tx(x, base, text, font, size, color) {
      text = clean(text, font).replace(/\n/g, ' ');
      if (!text) return x;
      page.drawText(text, { x: x, y: H - base, size: size, font: font, color: color });
      return x + font.widthOfTextAtSize(text, size);
    }
    function width(text, font, size) { return font.widthOfTextAtSize(clean(text, font).replace(/\n/g, ' '), size); }
    function wrap(text, font, size, maxW) {
      var lines = [];
      clean(text, font).split('\n').forEach(function (para) {
        var words = para.split(/ +/), line = '';
        words.forEach(function (w) {
          if (!w) return;
          var test = line ? line + ' ' + w : w;
          if (font.widthOfTextAtSize(test, size) <= maxW) { line = test; return; }
          if (line) lines.push(line);
          while (font.widthOfTextAtSize(w, size) > maxW) {
            var cut = w.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--;
            lines.push(w.slice(0, cut)); w = w.slice(cut);
          }
          line = w;
        });
        lines.push(line);
      });
      while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      return lines.length ? lines : [''];
    }
    function hline(x0, x1, top, color, th) {
      page.drawLine({ start: { x: x0, y: H - top }, end: { x: x1, y: H - top }, thickness: th || 0.6, color: color || C.line });
    }
    function box(x, top, w, hh, opts) {
      page.drawRectangle(Object.assign({ x: x, y: H - top - hh, width: w, height: hh }, opts));
    }
    function rbox(x, top, w, hh, r, fill) {
      var p = 'M ' + r + ' 0 H ' + (w - r) + ' Q ' + w + ' 0 ' + w + ' ' + r + ' V ' + (hh - r) + ' Q ' + w + ' ' + hh + ' ' + (w - r) + ' ' + hh +
        ' H ' + r + ' Q 0 ' + hh + ' 0 ' + (hh - r) + ' V ' + r + ' Q 0 0 ' + r + ' 0 Z';
      page.drawSvgPath(p, { x: x, y: H - top, color: fill });
    }
    function tick(x, top, color) {
      page.drawLine({ start: { x: x + 1.2, y: H - (top + 5) }, end: { x: x + 3.4, y: H - (top + 7.4) }, thickness: 1.5, color: color });
      page.drawLine({ start: { x: x + 3.4, y: H - (top + 7.4) }, end: { x: x + 7.6, y: H - (top + 1.8) }, thickness: 1.5, color: color });
    }
    function newPage() { page = doc.addPage([W, H]); pages.push(page); y = TOP; }
    // The page is built from lines. Lines that belong together (one person's block, or a heading and the
    // first block under it) move to the next page together when they don't fit on this one.
    var lead = []; // headings waiting for the block they sit above
    function line(hh, draw) { return { h: hh, draw: draw }; }
    function space(hh) { return { h: hh, space: true }; }
    function put(rows) {
      rows = lead.concat(rows); lead = [];
      var total = rows.reduce(function (n, r) { return n + r.h; }, 0);
      if (y + total > H - BOTTOM && total <= H - BOTTOM - TOP) newPage();
      var run = null;
      function flush() { if (run) sideLabel(run); run = null; }
      rows.forEach(function (r) {
        if (y + r.h > H - BOTTOM) newPage();
        if (r.space && !r.bar && y === TOP) return; // no empty gap at the top of a page
        if (r.side) {
          if (!run || run.page !== page) { flush(); run = { page: page, top: y, bottom: y, side: r.side }; }
          box(L, y, 14, r.h + 0.3, { color: r.side.color });
        } else if (r.bar) box(L, y, 2.5, r.h + 0.3, { color: r.bar });
        if (r.draw) r.draw(y);
        y += r.h;
        if (r.side && run) run.bottom = y;
      });
      flush();
    }
    // A thin bar in the list's color runs down the left of a block and shows which list it belongs to.
    function barred(rows, color) { rows.forEach(function (r) { r.bar = color; }); return rows; }
    function rule() { return line(5, function (top) { hline(L, R, top + 2.5, C.line, 0.6); }); }
    // Each block carries its section down its left side, turned on its side, in the section's color.
    var SLATE = rgb(0.29, 0.333, 0.408);
    var SIDE = { rr: ['RETURN & REPORT', 'REPORT'], nm: ['NEW MEMBERS', 'NEW'], rm: ['RETURNING', 'RETURNING'], bt: ['BEING TAUGHT', 'TAUGHT'],
      tn: ['FOCUS NAME', 'FOCUS'], fn: ['INVITE', 'INVITE'], mr: ['REFERRAL', 'REFERRAL'] };
    function block(rows, color, key) {
      var side = key ? { label: SIDE[key][0], short: SIDE[key][1], color: color } : null;
      var all = barred([space(4)].concat(rows, [space(4)]), color);
      if (side) all.forEach(function (r) { r.side = side; });
      put(all.concat([rule()]));
    }
    function sideLabel(run) {
      var avail = run.bottom - run.top, t = run.side.label, sz = 7.5;
      if (width(t, F.bold, sz) > avail - 6) t = run.side.short;
      if (width(t, F.bold, sz) > avail - 6) return;
      var tw = width(t, F.bold, sz), pg = page; page = run.page;
      page.drawText(t, { x: L + 9.6, y: H - (run.top + (avail + tw) / 2), size: sz, font: F.bold, color: C.white, rotate: P.degrees(90) });
      page = pg;
    }

    // A part of the report opens with a colored header: 1 · Looking back (Return and Report, slate) and
    // 2 · Looking ahead (the huddle action plan, navy), so the two halves can't be mistaken for each other.
    function partHead(kicker, title, sub, color, gap) {
      lead.push(space(gap === undefined ? 16 : gap));
      lead.push(line(50, function (top) {
        rbox(L, top, R - L, 46, 6, color);
        tx(L + IN, top + 15, kicker, F.bold, 8.5, rgb(0.86, 0.89, 0.94));
        var e = tx(L + IN, top + 34, title, F.bold, 15, C.white);
        if (sub && e + 8 + width(sub, F.ital, 9.5) <= R - IN) tx(e + 8, top + 34, sub, F.ital, 9.5, rgb(0.86, 0.89, 0.94));
      }));
    }
    function heading(label, note) {
      lead.push(space(8));
      lead.push(line(26, function (top) {
        var e = tx(L, top + 13, label, F.bold, 13.5, C.blue);
        if (note && e + 7 + width(note, F.ital, 9.5) <= R) tx(e + 7, top + 13, note, F.ital, 9.5, C.gray);
        hline(L, R, top + 20.5, C.line, 0.8);
      }));
    }
    function groupLabel(title, gid) {
      var gc = GROUP_PDF[gid];
      lead.push(line(23, function (top) {
        box(L, top, R - L, 19, { color: gc.fill });
        box(L, top, 2.5, 19, { color: gc.ink });
        tx(L + IN, top + 12.8, title.toUpperCase(), F.bold, 8.5, gc.ink);
      }));
    }
    function emptyRow(text) {
      put([line(20, function (top) { tx(L + IN, top + 11, text, F.ital, 10.5, C.gray); }), space(6)]);
    }

    function textLines(text, font, size, color, lh, base, maxW) {
      return wrap(text, font, size, maxW).map(function (ln) {
        return line(lh, function (top) { tx(L + IN, top + base, ln, font, size, color); });
      });
    }
    // The name at the top of a block, with an optional piece at the right of its first line (Yes, Partly, No).
    // A typed item with no person's name is a sentence, not a name, so it prints in plain text (plain).
    function titleLines(text, missing, rightW, drawRight, plain) {
      var has = !!str(text).trim();
      var rows = textLines(has ? text : missing, !has ? F.ital : plain ? F.reg : F.bold, plain ? 12.5 : 13.5, has ? C.dark : C.gray, plain ? 15 : 16, 12.5, R - L - IN - (rightW ? rightW + 10 : 0));
      if (drawRight) { var first = rows[0].draw; rows[0].draw = function (top) { first(top); drawRight(top); }; }
      return rows;
    }
    // Short colored notes under a name: the temple count, a baptism commitment, sacrament meeting attendance.
    function tagLines(tags) {
      var out = [], cur = [], cx = L + IN;
      tags.forEach(function (t) {
        var w = width(t.text, F.bold, 9.5) + (t.check ? 12 : 0);
        if (cur.length && cx + w > R) { out.push(cur); cur = []; cx = L + IN; }
        cur.push({ t: t, x: cx }); cx += w + 14;
      });
      if (cur.length) out.push(cur);
      return out.map(function (items) {
        return line(14, function (top) {
          items.forEach(function (it) {
            if (it.t.check) tick(it.x, top + 2, it.t.color);
            tx(it.x + (it.t.check ? 12 : 0), top + 10.5, it.t.text, F.bold, 9.5, it.t.color);
          });
        });
      });
    }
    // One labeled value: a small gray label, the value beside it, and smaller gray lines under it (who and when).
    function field(label, value, metas, quiet) {
      var x = L + IN + LBL, maxW = R - x, rows = [];
      function add(hh, base, draw) {
        var first = !rows.length;
        rows.push(line(hh, function (top) {
          if (first && label) tx(L + IN, top + base, label, F.reg, 9.5, C.gray);
          draw(top);
        }));
      }
      var vf = quiet ? F.ital : F.reg, vc = quiet ? C.gray : C.dark;
      if (str(value).trim()) {
        wrap(str(value).trim(), vf, FS, maxW).forEach(function (ln) { add(LH, 11.5, function (top) { tx(x, top + 11.5, ln, vf, FS, vc); }); });
      }
      (metas || []).forEach(function (m) {
        if (!m || !str(m.text).trim()) return;
        var mf = m.ital ? F.ital : F.reg;
        wrap(m.text, mf, MS, maxW).forEach(function (ln) { add(MLH, 10, function (top) { tx(x, top + 10, ln, mf, MS, C.gray); }); });
      });
      if (rows.length) rows.push(space(2));
      return rows;
    }

    // The Covenant Path Report items not done yet: "Next steps", then two columns with an empty box before each
    // item, so the list can be ticked off on paper or read at a glance.
    function nextSteps(items) {
      var x0 = L + IN, gap = 10, colW = (R - x0 - gap) / 2, bx = 8, tw = colW - bx - 5, rows = [];
      rows.push(line(14, function (top) { tx(x0, top + 10.5, 'Next steps', F.bold, 9.5, C.gray); }));
      for (var i = 0; i < items.length; i += 2) {
        var pair = [items[i], items[i + 1]].map(function (t) { return t ? wrap(t, F.reg, FS, tw) : []; });
        var n = Math.max(pair[0].length, pair[1].length);
        (function (pair, n) {
          rows.push(line(n * LH + 2, function (top) {
            pair.forEach(function (lns, c) {
              if (!lns.length) return;
              var x = x0 + c * (colW + gap);
              box(x, top + 3.2, bx, bx, { borderColor: C.gray, borderWidth: 0.9 });
              lns.forEach(function (ln, k) { tx(x + bx + 5, top + 11.5 + k * LH, ln, F.reg, FS, C.dark); });
            });
          }));
        })(pair, n);
      }
      rows.push(space(2));
      return rows;
    }
    // One person from the Covenant Path lists or Name Next Ordinance.
    function cardBlock(a, gid) {
      var name = str(a.name).trim(), tags = [];
      if (gid === 'nm' && (name || a.bap)) {
        var st = templeStatus(a, s.date);
        tags.push({ text: 'Temple: ' + (st.left === undefined && !st.done ? 'no date' : st.short), color: st.done ? STATUS_PDF.Yes : TEMPLE_RED });
      }
      if (gid === 'bt' && baptismNote(a)) {
        var d = shortDay(str(a.bap));
        tags.push({ text: a.committed ? 'Committed' + (d ? ' · ' + d : '') : 'Scheduled: ' + d, color: GROUP_PDF.bt.ink });
      }
      if (gid === 'bt' && apptNote(a)) tags.push({ text: apptNote(a), color: GROUP_PDF.bt.ink });
      if (a.sac) tags.push({ text: 'Attended sacrament meeting', color: STATUS_PDF.Yes, check: true });
      var ord = ordOf(a, gid), need = str(a.need).trim(), act = str(a.action).trim(), note = str(a.hneed).trim();
      var who = [str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
      var rows = titleLines(name, 'No name').concat(tagLines(tags), [space(3)]);
      if (ord && gid === 'tn') rows = rows.concat(field('Next ordinance', ord)); // (only focus names have one, Nov 19, 2026)
      if (need) rows = rows.concat(field('What will help', need));
      if (gid !== 'tn' && CHECKLISTS[gid]) { var so = (CHECKLISTS[gid] || []).filter(function (c) { return checkOf(a, gid, c) === false; }).map(function (c) { return c.help; });
        if (so.length) rows = rows.concat(nextSteps(so)); }
      if (gid === 'tn') { var src = (function () { var n = norm(a.name), hit = null; GROUPS.forEach(function (g) { (s.cp[g.id] || []).forEach(function (c) { if (!hit && n && norm(c.name) === n) hit = { a: c, gid: g.id }; }); }); return hit; })();
        var dw = src ? doneThisWeek(src.a, src.gid, s.bwSnap) : [];
        if (dw.length) rows = rows.concat(field('Done this week', dw.join(', '))); }
      if (gid === 'tn' || act) rows = rows.concat(field('Assignment', act || 'None yet', [{ text: who }, { text: a.actionCarried && act ? carriedText(s) : '', ital: true }], !act)); // action items are for focus names
      if (note) rows = rows.concat(field('Huddle notes', note));
      block(rows, GROUP_PDF[gid].ink, gid);
    }

    /* ----- page 1 header ----- */
    newPage();
    // Privacy reminder for everyone who receives the huddle report.
    var sx = tx(L, 30, 'Keep this huddle report secure', F.bold, 8.5, C.hudInk);
    tx(sx, 30, ' and delete it when it’s no longer needed.', F.reg, 8.5, C.gray);
    tx(L, 62, 'Weekly', F.bold, 21, C.navy);
    tx(L, 86, 'Huddle Report', F.bold, 21, C.navy);
    y = 100;
    // Only the people who attended are listed, in the order of the form.
    var attended = ATTENDEES.filter(function (a) { return s.attendees.indexOf(a.id) >= 0; }).map(function (a) { return a.label; }).join(', ');
    [['Ward', wardTxt, F.bold], ['Date', dateTxt, F.bold], ['Conducting', conductingLabel(s), F.bold], ['Attended', attended, F.reg]].forEach(function (m) {
      wrap(m[1] || '—', m[2], 11.5, R - L - 70).forEach(function (ln, k) {
        if (!k) tx(L, y + 11, m[0], F.reg, 9.5, C.gray);
        tx(L + 70, y + 11, ln, m[2], 11.5, C.dark);
        y += 15;
      });
      y += 3;
    });
    hline(L, R, y + 7, C.navy, 1.2);
    y += 8;

    /* ----- Coming up, at the top: baptisms, the temple countdown and upcoming opportunities (the user took out the rest
       of At a glance, Nov 18, 2026: the last huddle's counts and the list of focus names) ----- */
    (function () {
      var soon = [];
      s.cp.bt.forEach(function (a) { var n = str(a.name).trim(); if (n && a.bap) soon.push({ who: n, what: 'Baptism ' + shortDay(str(a.bap)), color: GROUP_PDF.bt.ink }); });
      s.cp.nm.forEach(function (a) {
        var n = str(a.name).trim(); if (!n || !a.bap) return;
        var st = templeStatus(a, s.date); if (!st.done && st.left !== undefined) soon.push({ who: n, what: 'Temple: ' + st.short, color: TEMPLE_RED });
      });
      // Upcoming opportunities to invite stay on the list until their date passes (rollForward drops them then).
      (s.find.opps || []).filter(function (o) { return str(o.title).trim(); }).forEach(function (o) {
        soon.push({ who: o.title.trim(), what: parseISO(str(o.date)) ? shortDay(str(o.date)) : '', color: GROUP_PDF.fn.ink });
      });
      if (!soon.length) return;
      lead.push(space(18));
      lead.push(line(26, function (top) {
        tx(L, top + 10, 'COMING UP', F.bold, 8.5, C.navy);
        hline(L, R, top + 22, C.line, 0.6);
      }));
      var rows = [];
      soon.forEach(function (x) {
        rows.push(line(18, function (top) {
          var e = tx(L, top + 12, x.who, F.bold, 10.5, C.dark);
          if (x.what) tx(e + 6, top + 12, x.what, F.bold, 9.5, x.color);
        }));
      });
      put(rows);
    })();

    /* ----- Return and Report ----- */
    partHead('1 · LOOKING BACK · ' + fromLabel(s).replace(/^From the /i, '').toUpperCase(), 'Return and Report', 'Did it happen?', rgb(0.29, 0.333, 0.408), 18);
    lead.push(space(8));
    var rrItems = s.rr.filter(function (r) { return r.prefilled || rrHasInput(r); });
    if (!rrItems.length) emptyRow('Nothing to report from the last huddle.');
    rrItems.forEach(function (r) {
      var gid = r.prefilled ? groupOf(r) : '';
      var name = gid === 'fn' ? 'Opportunities to invite' : r.prefilled ? (str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim()) : '';
      var who = [str(r.assigned).trim(), whenShow(r.when)].filter(Boolean).join(' · ');
      var action = r.prefilled ? str(r.action).trim() : str(r.plan).trim();
      var notes = str(r.notes).trim(), note = str(r.hneed).trim();
      var fwd = r.carriedFwd ? 'Carried forward to ' + (monthDay(s.date) ? 'the ' + monthDay(s.date) + ' plan' : 'this plan') : '';
      // Did it happen? Yes, Partly or No in its color at the right of the name.
      var status = STATUS_PDF[r.happened] ? r.happened : '';
      var sw = width(status || 'Not marked', F.bold, 9.5) + (status ? 16 : 0);
      var rows = titleLines(name || action, 'No assignment written', sw, function (top) {
        if (!status) { tx(R - sw, top + 12.3, 'Not marked', F.bold, 9.5, C.faint); return; }
        rbox(R - sw, top + 1, sw, 16, 8, STATUS_FILL[status]);
        tx(R - sw + 8, top + 12.3, status, F.bold, 9.5, STATUS_PDF[status]);
      }, !name);
      if (gid && gid !== 'fn') rows = rows.concat(tagLines([{ text: SOURCE[gid], color: GROUP_PDF[gid].ink }]));
      rows.push(space(5));
      if (name) rows = rows.concat(field('Assignment', action || 'No assignment written', [{ text: who }], !action));
      else if (who) rows = rows.concat(field('Assigned to', who));
      rows = rows.concat(field(notes ? 'Notes' : '', notes, [{ text: fwd, ital: true }]));
      if (note) rows = rows.concat(field('Huddle notes', note));
      block(rows, SLATE, 'rr');
    });

    /* ----- Focus names first, then the rest of the report for reference ----- */
    partHead('2 · LOOKING AHEAD · ' + (monthDay(s.date) ? monthDay(s.date).toUpperCase() + ' HUDDLE' : 'THIS HUDDLE'), 'This week’s plan', 'Who, what, how and when', C.navy, 22);
    /* ----- Name Next Ordinance ----- */
    heading('Focus names');
    var tnItems = s.tn.filter(function (n) { return n.sac || hasText(n, CARD_KEYS); });
    if (!tnItems.length) emptyRow('None this week');
    tnItems.forEach(function (n) { cardBlock(n, 'tn'); });

    /* ----- Covenant Path Report Review ----- */
    heading('Covenant Path Report', 'For reference');
    // A note to ward council organizations (the user's wording, Nov 20, 2026): tell the ward mission leader as people take
    // their next steps, so he can mark them off on the Covenant Path Report.
    (function () {
      var k = 'Ward council organizations: ', pad = 10, sz = 10.5, lh = 14;
      var lns = wrap(k + WC_NOTE, F.reg, sz, R - L - pad * 2), hh = lns.length * lh + pad * 2 - 3;
      put([line(hh, function (top) {
        rbox(L, top, R - L, hh, 8, rgb(0.925, 0.945, 0.98));
        lns.forEach(function (ln, i) {
          var yy = top + pad + 10 + i * lh;
          if (!i && ln.indexOf(k) === 0) { var e = tx(L + pad, yy, k.trim(), F.bold, sz, C.navy); tx(e + width(' ', F.reg, sz), yy, ln.slice(k.length), F.reg, sz, C.dark); }
          else tx(L + pad, yy, ln, F.reg, sz, C.dark);
        });
      }), space(10)]);
    })();
    GROUPS.forEach(function (g) {
      groupLabel(g.title, g.id);
      var filled = s.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      if (!filled.length) emptyRow(noneConfirmed(g.id, s) ? 'No one on the Covenant Path Report this week' : 'Not reviewed');
      filled.forEach(function (a) { cardBlock(a, g.id); });
    });

    /* ----- Plans to find new people to teach ----- */
    heading('Opportunities to invite', 'This week’s plan');
    var fItems = s.find.items.filter(assignHasText), fOpps = (s.find.opps || []).filter(function (o) { return str(o.title).trim(); });
    if (!fOpps.length && !fItems.length) emptyRow('None this week');
    var fnAssign = function (x) {
      var t = str(x.task).trim();
      block(field('Assignment', t || '—', [{ text: [str(x.who).trim(), whenShow(x.when)].filter(Boolean).join(' · ') }, { text: x.past ? 'From an earlier huddle · ' + ({ Yes: 'Done', Partly: 'Partly done', No: 'Not done' }[x.status] || 'Pending') : '' }, { text: x.carried && t ? carriedText(s) : '', ital: true }]), GROUP_PDF.fn.ink, 'fn');
    };
    fOpps.forEach(function (o) { // each opportunity, then the assignments for it
      var mine = fItems.filter(function (x) { return x.opp === o.id; });
      block(titleLines(str(o.title).trim(), '', 0, null, true).concat(parseISO(str(o.date)) ? field('Event date', whenShow(o.date)) : [], mine.length ? [] : field('Assignment', 'No assignments yet', null, true)), GROUP_PDF.fn.ink, 'fn');
      mine.forEach(fnAssign);
    });
    fItems.filter(function (x) { return !fOpps.some(function (o) { return o.id === x.opp; }); }).forEach(fnAssign);

    // no Missionary Referrals section

    // Footers: the ward and date on every page, so a printed page can be matched to its huddle.
    var total = pages.length;
    pages.forEach(function (pg, i) {
      page = pg;
      var num = total > 1 ? 'Page ' + (i + 1) + ' of ' + total : '';
      var nw = num ? width(num, F.reg, 8) : 0;
      var foot = [wardTxt, shortDate(s.date)].filter(Boolean).join(' · ') || DOC_TITLE;
      tx(L, H - 20, wrap(foot, F.reg, 8, R - L - nw - 14)[0], F.reg, 8, C.gray);
      if (num) tx(R - nw, H - 20, num, F.reg, 8, C.gray);
    });

    // A sample (a practice week) says so across every page, and carries no data to load.
    if (opts.sample) pages.forEach(function (pg) {
      pg.drawText('SAMPLE', { x: 70, y: 250, size: 92, font: F.bold, color: rgb(0.70, 0.16, 0.16), opacity: 0.13, rotate: P.degrees(52) });
      pg.drawText('SAMPLE · practice names, not a real huddle', { x: L, y: H - 14, size: 8, font: F.bold, color: rgb(0.70, 0.16, 0.16) });
    });
    // Metadata and the hidden copy of the form data used by "Load last week"
    doc.setTitle((opts.sample ? 'SAMPLE – ' : '') +DOC_TITLE + ' – ' + (wardTxt || 'Ward') + ' – ' + shortDate(s.date));
    doc.setSubject(DOC_TITLE);
    doc.setKeywords([APP_ID]);
    doc.setCreator('Huddle agenda form');
    doc.setProducer('Huddle agenda form');
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    var payload = makePayload(s);
    if (!opts.sample) doc.getInfoDict().set(P.PDFName.of('HuddleData'), P.PDFHexString.fromText(JSON.stringify(payload)));
    var bytes = await doc.save();
    return { bytes: bytes, pages: total, payload: payload };
  }

  // The form data saved inside the PDF and in this phone's saved agendas.
  function makePayload(s) {
    return JSON.parse(JSON.stringify({
      app: APP_ID, v: DATA_VERSION, ward: s.ward.trim(), date: s.date, rolledFrom: s.rolledFrom || '', createdAt: new Date().toISOString(),
      conducting: s.conducting || '', conductingOther: str(s.conductingOther).trim(),
      attendees: s.attendees.slice(),
      rr: s.rr.map(function (r) {
        return r.prefilled
          ? { prefilled: true, source: r.source, person: r.person, action: r.action, assigned: r.assigned, when: r.when, happened: r.happened, notes: r.notes,
              group: r.group || '', pname: r.pname || '', ord: r.ord || '', need: r.need || '', hneed: r.hneed || '', sac: !!r.sac, bap: r.bap || '', temple: !!r.temple, committed: !!r.committed, carriedFwd: !!r.carriedFwd, carryUndo: r.carryUndo || null, fid: r.fid || '' }
          : { plan: r.plan, happened: r.happened, notes: r.notes };
      }),
      cpDone: s.cpDone, cp: s.cp, cpNone: s.cpNone, tnDone: s.tnDone, tn: s.tn, ftDone: s.ftDone, ask: s.ask, tnKept: s.tnKept,
      find: { plan: str(s.find.plan), items: s.find.items.map(function (x) { return { id: str(x.id), task: str(x.task), who: str(x.who), when: str(x.when), carried: !!x.carried, opp: str(x.opp), past: !!x.past, status: str(x.status) }; }),
        opps: (s.find.opps || []).map(function (o) { return { id: str(o.id), title: str(o.title), date: str(o.date) }; }), none: !!s.find.none, done: !!s.find.done },
      referrals: cleanReferrals(s.referrals)
    }));
  }

  /* ---------- Send (the agenda stays filled in) ---------- */
  var sendFile = null, sendPayload = null, resending = false;
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);

  /* ---------- Help & training ---------- */
  // Flags remember only that someone has seen a message on this device; no agenda data.
  var HELP_KEY = 'huddle-help-seen', NAMES_HINT_KEY = 'huddle-names-hint-seen';
  function readFlag(k) { try { var s = getStore('localStorage'); return !!(s && s.getItem(k)); } catch (e) { return false; } }
  function writeFlag(k) { try { var s = getStore('localStorage'); if (s) s.setItem(k, '1'); } catch (e) { /* ignore */ } }
  function openHelp() {
    // Help & training always opens as the short list of steps. Adding Huddle to the Home Screen is done once, so it
    // sits apart from the weekly steps: in a phone's browser it starts open, since that is the thing to do next,
    // and from the Home Screen app it says it's already done.
    Array.prototype.forEach.call(document.querySelectorAll('#help-sheet details'), function (d) { d.open = false; });
    var install = $('#help-install'), installed = isStandalone();
    if (install && (isIOS || isAndroid) && !installed) install.open = true;
    var installNote = $('#help-install-status');
    if (installNote) installNote.textContent = installed ? 'Already done on this phone' : 'Do this once, before you start';
    markTheme(); $('#more-load-row').hidden = !!(state.loaded && state.loaded.practice); // a practice week has no PDF to load
    openOverlay('#help-sheet', '#help-title');
    var sheet = $('#help-sheet .sheet'); if (sheet) sheet.scrollTop = 0;
  }
  // Settings → Appearance: Automatic follows the phone; Light or Dark stays as chosen on this phone (theme.js)
  function markTheme() {
    var cur = window.huddleTheme ? window.huddleTheme.get() : 'auto';
    Array.prototype.forEach.call(document.querySelectorAll('[data-action="theme"]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-a') === cur)); });
  }
  function closeHelp() {
    writeFlag(HELP_KEY);
    closeOverlay('#help-sheet');
    if (location.hash === '#help') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } }
  }

  /* ---------- Closing pop-up sheets ---------- */
  // Closes a sheet the same way its Close or Cancel button would.
  function dismissSheet(id) {
    if (id === '#confirm-sheet') { if (askSecondary) askSecondary(); else closeOverlay(id); }
    else if (id === '#help-sheet') closeHelp();
    else if (id === '#send-sheet') closeSend();
    else closeOverlay(id);
  }

  // Swipe a sheet down to close it. Works once the sheet is scrolled to the top,
  // so swiping down inside long instructions still scrolls them first.
  function enableSwipeDown() {
    Array.prototype.forEach.call(document.querySelectorAll('.overlay > .sheet'), function (sheet) {
      var overlay = sheet.parentNode;
      var startY = 0, startT = 0, dy = 0, dragging = false, tracking = false;
      function reset() {
        sheet.style.transition = ''; sheet.style.transform = ''; overlay.style.backgroundColor = '';
      }
      sheet.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { tracking = false; return; }
        tracking = true; dragging = false; dy = 0;
        startY = e.touches[0].clientY; startT = Date.now();
        sheet.style.transition = '';
      }, { passive: true });
      sheet.addEventListener('touchmove', function (e) {
        if (!tracking) return;
        var d = e.touches[0].clientY - startY;
        if (!dragging) {
          if (d > 6 && sheet.scrollTop <= 0) { dragging = true; startY = e.touches[0].clientY; d = 0; }
          else { if (d < -6) tracking = false; return; }
        }
        dy = Math.max(0, d);
        if (e.cancelable) e.preventDefault();
        sheet.style.transform = 'translateY(' + dy + 'px)';
        overlay.style.backgroundColor = 'rgba(20, 30, 50, ' + (0.45 * Math.max(0, 1 - dy / 400)).toFixed(3) + ')';
      }, { passive: false });
      function end() {
        if (!tracking) return;
        tracking = false;
        if (!dragging) return;
        dragging = false;
        var speed = dy / Math.max(1, Date.now() - startT);
        if (dy > 110 || (dy > 40 && speed > 0.6)) {
          sheet.style.transition = 'transform 160ms ease-in';
          sheet.style.transform = 'translateY(100%)';
          setTimeout(function () { dismissSheet('#' + overlay.id); reset(); }, 150);
        } else {
          sheet.style.transition = 'transform 180ms ease-out';
          sheet.style.transform = 'translateY(0)';
          overlay.style.backgroundColor = '';
          setTimeout(reset, 200);
        }
      }
      sheet.addEventListener('touchend', end);
      sheet.addEventListener('touchcancel', end);
    });
  }

  /* ---------- Add to Home Screen ---------- */
  var installPrompt = null; // Android/Chrome's own install prompt, when the browser offers one
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function showInstallBanner() {
    if (isStandalone() || readJSON('sessionStorage', 'huddle-install-dismissed')) return;
    if (isIOS) {
      $('#install-banner .install-title').textContent = 'Add to Home Screen first';
      $('#install-banner .install-body').textContent = 'Do this before you fill anything in. What you enter here in Safari won’t carry over to the Home Screen app.';
    }
    $('#install-banner').hidden = false;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installPrompt = e;
    if (document.readyState !== 'loading') showInstallBanner();
  });
  window.addEventListener('appinstalled', function () { $('#install-banner').hidden = true; installPrompt = null; });

  var SHARE_ICON = '<span class="inline-icon" aria-label="Share"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11V2.5M6 5.5L9 2.5l3 3"/><path d="M5 8H4v7.5h10V8h-1"/></svg></span>';
  var MENU_ICON = '<span class="inline-icon" aria-label="menu"><svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><circle cx="9" cy="4" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="9" cy="14" r="1.5"/></svg></span>';
  async function addToHomeScreen() {
    if (installPrompt) {
      var p = installPrompt; installPrompt = null;
      try {
        p.prompt();
        var choice = await p.userChoice;
        if (choice && choice.outcome === 'accepted') {
          $('#install-banner').hidden = true;
          toast('Added. Open it from your Home Screen from now on.');
        }
      } catch (e) { openInstallSteps(); }
      return;
    }
    openInstallSteps();
  }
  function openInstallSteps() {
    var steps = isIOS
      ? ['Tap the Share button ' + SHARE_ICON + ' in the browser toolbar.', 'Scroll down and tap <strong>Add to Home Screen</strong>.', 'Tap <strong>Add</strong>.']
      : ['Tap the browser menu ' + MENU_ICON + ' at the top right.', 'Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.', 'Tap <strong>Add</strong> or <strong>Install</strong>.'];
    // Static, trusted markup only (no user data).
    $('#install-steps').innerHTML = steps.map(function (s) { return '<li><span>' + s + '</span></li>'; }).join('');
    openOverlay('#install-sheet', '[data-action="close-install"]');
  }
  function canShareFiles(file) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }

  var WC_NOTE = 'As you help the people on this list take their next steps, please let the ward mission leader know so he can mark them off on the Covenant Path Report and keep our efforts aligned.';
  var SHARE_HINT = 'Only share via email or text message. Do not share through any other app.';
  function resetSendSheet() {
    sendFile = null; sendPayload = null;
    $('#send-title').textContent = resending ? 'Share this huddle report again' : 'Send this huddle report';
    $('#share-btn').disabled = true; $('#share-btn').textContent = 'Send the huddle report';
    $('#share-hint').textContent = resending ? 'Only share via email or text message. Do not share through any other app. Your current huddle isn’t changed.' : SHARE_HINT;
    var rc = $('#send-recipients'); rc.hidden = false;
    if (!rc.getAttribute('data-html')) rc.setAttribute('data-html', rc.innerHTML); else rc.innerHTML = rc.getAttribute('data-html'); // a sample's note is put back
  }

  // Keep this week's agenda in the phone's saved agendas (newest 4).
  async function rememberAgenda() {
    if (!sendPayload) return false;
    try { await saveAgenda(sendPayload); return true; } catch (e) { return false; }
  }

  // Ward, date and some content are needed before sending or saving.
  function readyToSave(verb) {
    if (isPractice() && verb === 'send') return true; // a practice week sends a sample, stamped SAMPLE
    if (state.loaded && state.loaded.practice) {
      ask({ title: 'Remove the practice week first', body: 'Practice names can’t be ' + (verb === 'save' ? 'saved' : 'sent') + '. Remove the practice week, then fill in your real huddle.',
        primary: 'Remove practice week', onPrimary: removePractice, secondary: 'Cancel' });
      return false;
    }
    if (!state.ward.trim()) {
      ask({ title: 'Add your ward name first', body: 'The ward name goes on the huddle report.', primary: 'Add the ward', onPrimary: function () { setTimeout(function () { openOverlay('#ward-sheet', '#ward'); }, 50); }, secondary: 'Cancel' });
      return false;
    }
    if (!parseISO(state.date)) {
      ask({ title: 'The huddle date is missing', body: 'Close the app, open it again, and tap Send. It’s dated today automatically.', primary: 'OK', onPrimary: function () { window.scrollTo(0, 0); } });
      return false;
    }
    // Report-backs from the last huddle count as something to send, even if every name has since been removed.
    if (isEmpty(state) && !state.rr.some(function (r) { return r.prefilled; })) {
      ask({ title: 'Nothing to ' + verb + ' yet', body: 'Add names under Ward Council first.', primary: 'OK' });
      return false;
    }
    return true;
  }

  // src = a saved agenda to share again; otherwise the form on screen.
  async function startSend(src, checked) {
    resending = !!src;
    if (!resending && syncDate()) saveDraft();
    if (!resending) reconcileCarries();
    if (!resending && !state.verified.after && readyToSave('send')) {
      ask({ title: 'Update the Covenant Path Report first', body: 'Before you send, open step 4, “After the huddle”, on the opening screen and mark it done. It shows what to update for each person.',
        primary: 'Show me what to update', onPrimary: function () { if (stepsOn && view !== 'start') showView('start', 'replace'); showView('af', 'push'); }, secondary: 'Cancel' });
      return;
    }
    if (!resending && !readyToSave('send')) return;
    if (!resending && !checked) {
      var open = openItems();
      if (open.length) {
        ask({ title: 'Ready to send?', body: 'A few things are still open. Tap one to go to it, or send anyway.', jumps: open,
          primary: 'Send anyway', onPrimary: function () { startSend(null, true); }, secondary: 'Go back' });
        return;
      }
    }
    var agenda = src || state;
    resetSendSheet();
    $('#send-title').textContent = resending ? 'Share the ' + (monthDay(agenda.date) || 'last') + ' huddle report again' : 'Send this huddle report';
    $('#send-date-row').hidden = resending;
    // Sharing a sent huddle again changes nothing, so its way out is Close, not Keep editing.
    $('#send-sheet [data-action="close-send"]').textContent = resending ? 'Close' : 'Keep editing';
    $('#send-date-text').textContent = parseISO(agenda.date) ? parseISO(agenda.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'today';
    $('#send-date').value = agenda.date;
    var sample = !resending && isPractice();
    var name = sample ? fileName(agenda).replace(/^Huddle - /, 'Huddle SAMPLE - ') : fileName(agenda);
    $('#send-filename').textContent = name;
    if (sample) {
      $('#send-title').textContent = 'Send a sample huddle report';
      $('#send-recipients').textContent = 'This is a practice: sample names, and SAMPLE across every page. Send it to yourself to see what the huddle report looks like.';
    }
    $('#send-status').textContent = 'Making your huddle report…';
    openOverlay('#send-sheet', '#send-title');
    try {
      var out = await buildPdf(agenda, { sample: sample });
      sendFile = new File([out.bytes], name, { type: 'application/pdf' });
      sendPayload = out.payload;
      $('#send-status').textContent = out.pages + (out.pages === 1 ? ' page' : ' pages') + ' · locked so it can’t be edited';
      if (!canShareFiles(sendFile)) {
        // No share menu for files here (some desktop browsers): download instead.
        $('#share-hint').textContent = 'Saves the huddle report to your Downloads. Attach it to an email or text message.';
        $('#share-btn').textContent = 'Download the huddle report';
      }
      $('#share-btn').disabled = false;
    } catch (err) {
      console.error(err);
      $('#send-status').textContent = 'Couldn’t make the huddle report. Close this and try again.';
    }
  }

  function download(file) {
    var url = URL.createObjectURL(file);
    var a = h('a', { href: url, download: file.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  // No share menu (some desktop browsers): the PDF downloads, and the huddle closes the same as sharing it.
  async function downloadAndClose() {
    download(sendFile);
    if (isPractice()) { closeSend(); sampleSent(); return; }
    closeSend(); closeHuddle(true);
  }
  // A sample changes nothing: the practice week stays as it was.
  function sampleSent() {
    ask({ title: 'Sample sent', success: true, body: 'Open it to see what the weekly huddle report looks like. Nothing changed in your practice week, and your own huddle is still set aside.', primary: 'OK' });
  }

  async function sharePdf() {
    if (!sendFile) return;
    if (resending) {
      if (canShareFiles(sendFile)) {
        try { await navigator.share({ files: [sendFile], title: sendFile.name }); }
        catch (e) { if (e && e.name === 'AbortError') return; download(sendFile); }
      } else download(sendFile);
      closeSend(); toast('Shared again.');
      return;
    }
    if (canShareFiles(sendFile)) {
      try {
        await navigator.share({ files: [sendFile], title: sendFile.name });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // they closed the share menu; keep everything
        await downloadAndClose();
        return;
      }
      if (isPractice()) { closeSend(); sampleSent(); return; }
      closeSend(); closeHuddle();
    } else {
      await downloadAndClose();
    }
  }

  // Keeps this week's agenda in the phone's saved agendas without making or sharing a PDF.
  // The form stays filled in. Saving the same ward and date again replaces the earlier copy.
  async function saveWithoutSending() {
    if (!readyToSave('save')) return;
    try {
      await saveAgenda(makePayload(state));
    } catch (e) {
      ask({ title: 'Couldn’t save on this phone', body: 'This browser isn’t letting the app save anything (private browsing can do this).', primary: 'OK' });
      return;
    }
    toast('Saved on this phone. It will show in Load last week.');
  }

  function closeSend() { closeOverlay('#send-sheet'); sendFile = null; sendPayload = null; resending = false; }

  /* ---------- wiring ---------- */
  function init() {
    if (typeof PDFLib === 'undefined') {
      toast('Something didn’t load. Check your connection and reload the page.');
    }
    fileInput = $('#file-input');
    fileInput.addEventListener('change', onFilePicked);
    syncDate();
    // Change date on the Send screen: re-dates this huddle and remakes the PDF (the Tools box stays as it was).
    $('#send-date').addEventListener('click', function () { try { if (this.showPicker) this.showPicker(); } catch (e) { /* the input still works */ } });
    $('#send-date').addEventListener('change', function () {
      var v = this.value; if (!parseISO(v) || resending || v === state.date) return;
      state.date = v; state.dateManual = true; $('#date').value = v; saveDraft();
      startSend(null, true);
    });
    renderAll();
    datesForWhens(); renderCP(); renderTN(); renderFN();
    if (isPractice()) removePractice(); // the guided tour and its practice week were taken out (Nov 18, 2026): a phone left in one gets its own huddle back
    checkHandoffLink();
    window.addEventListener('hashchange', checkHandoffLink);
    // Tapping the date opens the phone's date picker right there.
    var dateIn = $('#date');
    if (dateIn) dateIn.addEventListener('click', function () { try { if (dateIn.showPicker) dateIn.showPicker(); } catch (e) { /* the input still works */ } });
    // Saved copies of agendas are no longer kept on the phone; clear any left from before.
    if (!readFlag('huddle-saved-cleared')) { try { deleteAllAgendas().then(function () { writeFlag('huddle-saved-cleared'); }, function () { writeFlag('huddle-saved-cleared'); }); } catch (e) { /* ignore */ } }
    var lsOld = readJSON('localStorage', LAST_SENT_KEY);
    if (lsOld && !(lsOld.sentAt && (Date.now() - Date.parse(lsOld.sentAt)) < STALE_DROP * 86400000)) { removeKey('localStorage', LAST_SENT_KEY); renderSent(); }
    if (staleRemoved) { saveDraft(); toast('Removed ' + staleRemoved + (staleRemoved === 1 ? ' name' : ' names') + ' not updated in 5 weeks.', 6000); }
    // Four-step view: start on the step list; the phone's Back gesture returns to it from a step.
    resetView();
    applyView();
    window.addEventListener('popstate', function (e) {
      var v = e.state && e.state.hv;
      if (!stepsOn) return;
      if (isPerson(v)) { personRef = (e.state && e.state.ref) || null; personWcOpen = wcOpenDefault(personRef); }
      view = v === 'home' || v === 'wc' || v === 'bw' || v === 'af' || isWcList(v) || isPerson(v) || v === 'start' || STEPS.some(function (st) { return st.id === v; }) ? v : START;
      applyView(); window.scrollTo(0, 0);
    });

    var onEdit = function (e) {
      var t = e.target;
      var path = t && t.getAttribute && t.getAttribute('data-bind');
      if (!path) return;
      var val = t.type === 'checkbox' ? t.checked : t.value;
      // Before ward council: a name that is already on that list is refused, so no one is listed twice.
      var dup = e.type === 'change' && view === 'p-bw' ? /^cp\.(\w+)\.(\d+)\.name$/.exec(path) : null;
      if (dup && String(val).trim() && state.cp[dup[1]].some(function (x, k) { return k !== +dup[2] && norm(x.name) === norm(val); })) {
        // (The message waits a moment: leaving the field is often a tap on Done, and a message must not land under that tap.)
        var dupName = String(val).trim(); setTimeout(function () { toast(dupName + ' is already on this list.'); }, 350);
        val = str(t._nameWas); t.value = val;
      }
      setPath(path, val);
      if (t.tagName === 'SELECT') t.classList.toggle('is-empty', !t.value);
      if (path === 'ward') { writeWard(String(val).trim()); if (view === 'start') renderDoors(); }
      if (path === 'date') { state.dateManual = true; renderDateHint(); }
      // Before ward council: a baptism date for someone being taught means they're committed; clearing it takes that off
      var cb = view === 'p-bw' ? /^cp\.bt\.(\d+)\.bap$/.exec(path) : null;
      if (cb && state.cp.bt[+cb[1]]) state.cp.bt[+cb[1]].committed = !!String(val).trim();
      // Ward council: once a name is finished being typed, its Details and last assignment follow the new name.
      // (Only those boxes are redrawn, so the field being typed in next keeps its place.)
      var rn = e.type === 'change' ? /^(?:cp\.(\w+)|(tn))\.\d+\.name$/.exec(path) : null;
      if (rn) {
        var rg = rn[1] || 'tn', was = str(t._nameWas).trim(), now = String(val).trim();
        t._nameWas = now;
        var pend = was && now && norm(was) !== norm(now) && !lastAction(rg, now) ? state.rr.filter(function (r) { return r.prefilled && groupOf(r) === rg && norm(rrPerson(r)) === norm(was) && str(r.action).trim(); }) : [];
        if (pend.length) {
          var rcard = t.closest('.wc-card');
          ask({
            title: 'Is this the same person?', compare: [['Was', was], ['Now', now]],
            body: was + ' has an assignment from the last huddle. If you’re fixing the name, it stays with ' + now + '. If this is someone else, it stays under ' + was + '.',
            primary: 'Same person, fix the name', onPrimary: function () {
              pend.forEach(function (r) { r.pname = now; });
              renderRR(); saveDraft();
              if (rcard && (isWcList(view) || view === 'p-wc')) refreshWcBoxes(rcard, rg, getPath(path.replace(/\.name$/, '')) || {});
              toast('Name fixed. The last assignment stays with ' + now + '.');
            },
            secondary: 'Different person'
          });
        }
      }
      // A person's screen is titled with their name; keep it and the Remove button current while typing.
      if (isPerson(view) && personRef && /\.name$/.test(path)) {
        $('#step-title').textContent = personTitle(personRef);
        var prm = $('#person-card .person-remove'), pca = personCard(personRef);
        if (prm && pca) prm.hidden = rowBlank(personRef.g, pca);
        var phd = $('#person-card .person-head');
        if (phd && pca) { // the name and initials at the top follow along
          phd.querySelector('.person-head-name').textContent = personTitle(personRef);
          var pav = phd.querySelector('.avatar'), pin = initials(pca.name), pen = pav.querySelector('.avatar-pencil');
          pav.textContent = pin || '+'; if (pen) pav.appendChild(pen); pav.classList.toggle('is-blank', !pin);
        }
      } else if (isPerson(view) && personRef) { var prm2 = $('#person-card .person-remove'), pc2 = personCard(personRef); if (prm2 && pc2) prm2.hidden = rowBlank(personRef.g, pc2); }
      var wcc = e.type === 'change' && (isWcList(view) || view === 'p-wc') && /\.name$/.test(path) ? t.closest('.wc-card') : null;
      if (wcc) {
        var wp = path.split('.'), wg = wp[0] === 'tn' ? 'tn' : wp[1], wa = getPath(path.replace(/name$/, '').replace(/\.$/, ''));
        refreshWcBoxes(wcc, wg, wa || {});
      }
      if (path === 'conductingOther') writeConducting(state);
      if (/\.name$/.test(path)) {
        var pt = document.querySelector('[data-name-for="' + path + '"]');
        if (pt) { var pv = String(val).trim(); pt.textContent = pv || pt.getAttribute('data-ph'); pt.classList.toggle('empty', !pv); }
      }
      // Text this assignment: appears once there's an action and someone assigned; editing it after texting resets it.
      var tm = /^((?:cp\.\w+|tn|find\.items)\.\d+\.)(name|action|assigned|when|task|who)$/.exec(path);
      if (tm) { if (getPath(tm[1] + 'texted')) setPath(tm[1] + 'texted', false); refreshTextButton(tm[1], t.closest('.card') || document); }
      // Any change to a name card counts as touching it (the 4-week check).
      var tch = /^((?:cp\.\w+|tn)\.\d+\.)(\w+)$/.exec(path);
      if (tch && tch[2] !== 'touched') setPath(tch[1] + 'touched', todayISO());
      if (/\.(action|task)$/.test(path) && !String(val).trim()) {
        setPath(path.replace(/action$/, 'actionCarried').replace(/task$/, 'carried'), false);
        var tagEl = t.closest('.field, .fn-assign'); tagEl = tagEl && tagEl.querySelector('.carried-tag'); if (tagEl) tagEl.remove();
      }
      // Covenant Path Report reminders: sacrament attendance on Covenant Path cards, and a new member's temple attendance.
      // (Not in Before ward council: there the attendance is being copied from the report.)
      if (view !== 'p-bw' && /^cp\.\w+\.\d+\.sac$/.test(path) && val === true) toast('Remember to update sacrament attendance in the Covenant Path Report too.', 7000);
      if (view !== 'p-bw' && /^cp\.nm\.\d+\.temple$/.test(path) && val === true) toast('Remember to update temple attendance in the Covenant Path Report too.', 7000);
      if (/^cp\.\w+\.\d+\.name$/.test(path)) updateListCount(path.split('.')[1]);
      if (/^cp\.nm\.\d+\.(name|bap|temple)$/.test(path) || path === 'date') { updateTemple(); if (path === 'date') renderRR(); }
      if (/^tn\.\d+\.name$/.test(path)) { var tc = document.querySelector('.list-tn .list-count'); if (tc) tc.textContent = tnCountText(); }
      saveDraft();
    };
    // Save the draft right away if the app is closed or put in the background.
    var flushDraft = function () { clearTimeout(draftTimer); if (!tourDemo) writeJSON('localStorage', LIVE_KEY, state); };
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushDraft(); });
    // Remember a name as it was when the field was entered, to notice a rename.
    document.addEventListener('focusin', function (e) { var t = e.target; if (t && t.getAttribute && /\.name$/.test(t.getAttribute('data-bind') || '') && t._nameWas === undefined) t._nameWas = t.value; });
    document.addEventListener('input', onEdit);
    document.addEventListener('change', onEdit);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-action]');
      if (btn && !btn.disabled) { e.preventDefault(); onAction(btn); return; }
      if (e.target.id === 'send-sheet') closeSend();
      if (e.target.id === 'handoff-sheet') closeOverlay('#handoff-sheet');
      if (e.target.id === 'install-sheet') closeOverlay('#install-sheet');
      if (e.target.id === 'help-sheet') closeHelp();
      if (e.target.id === 'tips-sheet') closeOverlay('#tips-sheet');
      if (e.target.id === 'find-tips-sheet') closeOverlay('#find-tips-sheet');
      if (e.target.id === 'howhelp-sheet') closeOverlay('#howhelp-sheet');
      if (e.target.id === 'slides-sheet') closeOverlay('#slides-sheet');
      if (e.target.id === 'ward-sheet') { closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); wardClosed(); }
      if (e.target.id === 'sample-sheet') closeOverlay('#sample-sheet');
      if (e.target.id === 'confirm-sheet' && askSecondary) askSecondary();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var top = ['#confirm-sheet', '#sample-sheet', '#handoff-sheet', '#install-sheet', '#help-sheet', '#tips-sheet', '#find-tips-sheet', '#howhelp-sheet', '#ward-sheet', '#slides-sheet', '#send-sheet'].filter(function (id) { return !$(id).hidden; })[0];
      if (top) dismissSheet(top);
    });
    enableSwipeDown(); enableSwipeRemove();
    window.__huddleReady = true; // theme.js shows a message instead of a blank screen if this never happens
    // The opening picture stays a moment (about a second and a half from launch), then fades away.
    var splash = $('#splash');
    if (splash) setTimeout(function () { splash.classList.add('out'); setTimeout(function () { splash.remove(); }, 450); }, 1100);

    // While the keyboard is up, the bottom bar stops floating so it doesn't jump around.
    var typingTimer = null;
    document.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('#form input[type="text"], #form input[type="date"], #form textarea')) {
        clearTimeout(typingTimer);
        document.body.classList.add('typing');
      }
    });
    document.addEventListener('focusout', function () {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () {
        var a = document.activeElement;
        if (!(a && a.matches && a.matches('#form input[type="text"], #form input[type="date"], #form textarea'))) document.body.classList.remove('typing');
      }, 150);
    });

    // Phones opened in the browser (not the Home Screen app) get the Add to Home Screen banner.
    if ((isIOS || isAndroid) && !isStandalone()) showInstallBanner();

    // Erase saved agendas older than 4 weeks each time the app opens.
    listAgendas();

    // iPhone and iPad Safari: only the way to the Home Screen app (the user decided, Nov 19, 2026). What's typed in
    // Safari stays in Safari, apart from the app. A handoff link still opens here (its page moves the huddle into the app,
    // or "Use it in Safari this once" lets it run here for this visit). Tests turn it on with the huddle-gate-test flag.
    var gated = isIOS && !isStandalone() && (!navigator.webdriver || readFlag('huddle-gate-test')) && !readFlag('huddle-gate-off') && !handoffPending && !readJSON('sessionStorage', 'huddle-safari-once');
    if (gated) {
      $('#safari-gate').hidden = false; document.body.classList.add('gated');
      $('#safari-gate').classList.toggle('is-ipad', /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      // Where Safari keeps Share (Nov 19, 2026): iOS 26 puts the page menu (≡) at the left of the address bar;
      // iOS 18 and earlier put Share in the middle of the bottom toolbar.
      var sv = /Version\/(\d+)/.exec(navigator.userAgent), sMajor = sv ? +sv[1] : 0;
      $('#safari-gate').classList.toggle('is-ios26', sMajor >= 26);
      $('#safari-gate').classList.toggle('is-ios18', sMajor > 0 && sMajor < 26);
    }
    // Instructions: open on the first visit on this device, or when the link ends in #help.
    // First visit on a device: in a phone’s browser, Help & training opens (it starts with Add to Home Screen).
    // The first time from the Home Screen app, the step-by-step guide is offered once.
    if (gated) { /* nothing over the Safari screen */ }
    else if (location.hash === '#help') openHelp();
    else if (location.hash === '#tour') openSlides(); // (the guided tour was taken out; the step-by-step guide takes its place)
    else if (!navigator.webdriver && !handoffPending) { // a handoff link comes first; the instructions wait for the next visit
      var phoneBrowser = (isIOS || isAndroid) && !isStandalone();
      if (phoneBrowser) { if (!readFlag(HELP_KEY)) openHelp(); }
      else if (!readFlag(GUIDE_OFFERED_KEY)) { // the first time from the Home Screen: offer the step-by-step guide once
        writeFlag(GUIDE_OFFERED_KEY);
        var welcome = function () { ask({ title: 'Welcome to Huddle', body: 'The step-by-step guide walks through one week, a few minutes at your own pace.',
          primary: 'Open the guide', onPrimary: openSlides, secondary: 'Not now' }); };
        // The ward name comes first (the user asked, Nov 19, 2026); the welcome follows once it's closed.
        if (!state.ward.trim()) { afterWard = welcome; $('#ward-title').textContent = 'Welcome! What’s your ward?'; openOverlay('#ward-sheet', '#ward'); } else welcome();
      }
    }
    window.addEventListener('hashchange', function () { if (location.hash === '#help') openHelp(); });
    // Training slides: swipe left for the next one, right for the one before.
    (function () {
      var el = $('#slide'), x0 = null, y0 = 0;
      if (!el) return;
      el.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
      el.addEventListener('touchend', function (e) {
        if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) showSlide(slideAt + (dx < 0 ? 1 : -1));
      }, { passive: true });
      document.addEventListener('keydown', function (e) {
        if ($('#slides-sheet').hidden) return;
        if (e.key === 'ArrowRight') showSlide(slideAt + 1); else if (e.key === 'ArrowLeft') showSlide(slideAt - 1);
      });
    })();
    // Enter moves to the next field instead of doing nothing
    document.addEventListener('keydown', function (e) { // Done on the keyboard closes the ward box
      if (e.key === 'Enter' && e.target && e.target.id === 'ward') { e.preventDefault(); closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); wardClosed(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('#form input[type="text"], #form textarea')) return;
      e.preventDefault();
      var inputs = Array.prototype.slice.call(document.querySelectorAll('#form input[type="text"], #form input[type="date"], #form textarea'));
      var next = inputs[inputs.indexOf(e.target) + 1];
      if (next) next.focus(); else e.target.blur();
    });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () { /* offline support is optional */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
