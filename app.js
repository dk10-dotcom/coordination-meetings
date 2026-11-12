/* Huddle: the Ward Mission Leader Process app (the weekly coordination meeting agenda)
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
  var SOURCE = { nm: 'New members', rm: 'Returning members', bt: 'Those being taught', tn: 'Name Next Ordinance', fn: 'Finding new people' };
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
    fn: { list: 'Find New People to Teach', title: 'How can we find more people to teach?', items: [
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
  var CARD_KEYS = ['name', 'bap', 'ordinance', 'need', 'hneed', 'action', 'assigned', 'when'];
  var REF_KEYS = ['name', 'by', 'notes']; // a missionary referral (set up here, before the saved huddle is read)
  function blankAction() { return { name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '' }; }
  function shortDay(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
  // Those being taught: "Committed to baptism" and the baptism date, in a few words.
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
  function blankAssign() { return { task: '', when: '' }; }
  function blankFind() { return { plan: '', items: [blankAssign()] }; }
  function assignHasText(x) { return hasText(x, ['task', 'when']); }
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
      sentAt: '', sentSig: '', rolledFrom: '', dateManual: false, verified: { before: false, after: false },
      ftDone: false
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
          o.pname = str(r.pname); o.ord = str(r.ord); o.need = str(r.need); o.hneed = str(r.hneed); o.sac = !!r.sac; o.bap = str(r.bap); o.temple = !!r.temple; o.committed = !!r.committed; o.carriedFwd = !!r.carriedFwd;
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
    f.dateManual = !!s.dateManual; f.verified = { before: !!(s.verified && s.verified.before), after: !!(s.verified && s.verified.after) }; f.sentAt = str(s.sentAt); f.sentSig = str(s.sentSig); f.rolledFrom = parseISO(str(s.rolledFrom)) ? str(s.rolledFrom) : '';
    // Lists marked Done stay folded only within the draft; a saved agenda always opens fully.
    var sd = s.stepsDone && typeof s.stepsDone === 'object' ? s.stepsDone : {};
    ['rr', 'cp', 'tn', 'fn', 'mr'].forEach(function (k) { if (sd[k] === true) f.stepsDone[k] = true; });
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
    f.tn = tn.slice(0, 3);
    var fd = s.find && typeof s.find === 'object' ? s.find : {};
    f.find.plan = str(fd.plan);
    var fi = Array.isArray(fd.items) ? fd.items.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) { return { task: str(x.task), when: str(x.when), carried: !!x.carried, doneMid: !!x.doneMid }; }) : [];
    f.find.items = fi.length ? fi : [blankAssign()];
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
    if (str(s.find.plan).trim() || s.find.items.some(assignHasText)) return false;
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
    circle: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="8" r="5.6"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4.5h12v7.5H8l-3.5 3v-3H3z"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 5l8 8M13 5l-8 8"/></svg>'
  };
  function icon(name, cls) { var s = h('span', { class: cls || null, 'aria-hidden': 'true' }); s.innerHTML = ICONS[name]; return s; }
  /* A livelier look: each section's row starts with a white drawing on a tile of that section's own color
   * (the color its list and its PDF heading use), and each name starts with a circle of initials. */
  var TILE_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var TILE_ICONS = {
    rr: '<path d="M7.5 5l-4 4 4 4"/><path d="M3.5 9H12a4.5 4.5 0 0 1 4.5 4.5V15"/>',                                  // an arrow coming back: return and report
    cp: '<circle cx="7.2" cy="7" r="2.7"/><path d="M2.4 16c0-2.7 2.1-4.6 4.8-4.6S12 13.3 12 16"/><circle cx="14.2" cy="7.8" r="2.1"/><path d="M13.6 11.6c2.3-.2 4.1 1.5 4.1 3.9"/>', // people
    tn: '<path d="M10 2.9l2.2 4.5 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9L2.9 8.1l4.9-.7z"/>',                    // a star: the names to focus on
    fn: '<circle cx="8.8" cy="8.8" r="5.3"/><path d="M12.8 12.8l4.2 4.2"/>',                                        // a magnifying glass: finding
    mr: '<path d="M17 3L3 8.8l5.6 2.6L11.2 17z"/><path d="M17 3l-8.4 8.4"/>',
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
    return h('label', { class: 'field' + (opts.full ? ' full' : '') }, [
      opts.tag ? h('span', { class: 'label-row' }, [h('span', { class: 'label-text', text: label }), opts.tag]) : label,
      opts.multi ? h('textarea', {
        'data-bind': path, value: str(getPath(path)), placeholder: opts.placeholder || '', rows: opts.rows || '2',
        autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'next', maxlength: '300'
      }) : h('input', {
        type: opts.type || 'text', 'data-bind': path, value: str(getPath(path)), placeholder: opts.placeholder || '',
        autocomplete: 'off', autocapitalize: opts.cap || 'sentences', enterkeyhint: 'next', maxlength: '300'
      })
    ]);
  }
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
          str(r.need).trim() ? h('span', { class: 'fact' }, [h('b', { text: 'Needs: ' }), r.need.trim()]) : null,
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
          h('p', { class: 'prefill-action' }, [h('span', { class: 'prefill-k', text: 'Action: ' }), str(r.action).trim() || 'No action item was written.']),
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
        h('div', { class: 'rr-answer' }, [seg, carry, field('Notes', 'rr.' + i + '.notes', { placeholder: 'How did it go?' })])]);
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
  function planLabel() { return 'This huddle’s plan'; }
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
  function assignmentText(base) {
    var who = str(getPath(base + 'name')).trim(), act = str(getPath(base + 'action')).trim(), when = str(getPath(base + 'when')).trim();
    var ward = state.ward.trim();
    // The action comes first, then who it is for and when, with the date written out.
    return [act,
      who ? 'For: ' + who : null,
      when ? 'When: ' + (ISO_DAY.test(when) && parseISO(when) ? parseISO(when).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : whenLine(when, parseWhen(when))) : null,
      'From the ' + (ward ? ward + ' ' : '') + 'huddle. Please report back. Thank you!'].filter(Boolean).join('\n');
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
  function textReady(base) { return !!(str(getPath(base + 'action')).trim() && str(getPath(base + 'assigned')).trim()); }
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
        field('Needs', base + 'need', { full: true, multi: true, placeholder: needPh || 'e.g. A ride to church' })
      ])
    ]);
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
        field('Action item', base + 'action', { full: true, multi: true, rows: '3', placeholder: 'What might you do to assist them in being worthy and prepared for their next ordinance?',
          tag: getPath(base + 'actionCarried') && str(getPath(base + 'action')).trim() ? carriedTag() : null }),
        // Assigned to gets the wider share of its row; When is usually a day or two words.
        h('div', { class: 'assign-row' }, [
          field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
          whenField('When', base + 'when', { placeholder: whenPh })
        ]),
        h('div', { class: 'assign-actions' }, [textAssignButton(base)]),
        hneedField
      ]),
      hneedLink
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
  function wcSummary(r, a) {
    var ord = ordOf(a, r.g), need = str(a.need).trim(), bap = monthDay(a.bap);
    var facts = [['Next ordinance', ord || 'Not set yet', !ord], ['Needs', need || 'None listed yet', !need]];
    if (r.g === 'nm') facts.push(['Baptized', bap || 'No date yet', !bap]);
    return h('div', { class: 'wc-summary' }, [
      h('div', { class: 'zone-label-row' }, [zoneLabel('wc', 'Ward Council · Who & What'),
        h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'wc-edit-toggle', 'aria-label': 'Edit the name, next ordinance and needs', 'aria-expanded': 'false', text: 'Edit' })])
    ].concat(facts.map(function (f) {
      return h('p', { class: 'after-fact' + (f[2] ? ' unset' : '') }, [h('span', { class: 'after-k', text: f[0] }), f[1]]);
    })));
  }
  function hdPersonCard(r, a) {
    var g = r.g, isTn = g === 'tn', base = isTn ? 'tn.' + r.i + '.' : 'cp.' + g + '.' + r.i + '.';
    var named = !!str(a.name).trim(), top;
    if (personWcOpen) {
      var tools = named ? h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'wc-edit-toggle', 'aria-label': 'Hide the name, next ordinance and needs', 'aria-expanded': 'true', text: 'Hide' }) : null;
      top = h('div', { class: 'wc-edit' }, [
        h('div', { class: 'card-head name-head' }, [h('div', { class: 'card-title' }, [avatar(), nameInput(base + 'name', isTn ? 'Focus name ' + (r.i + 1) : 'Name')])]),
        // A new member's baptism date is ward council's; a scheduled baptism sits with Committed to baptism, below.
        wcZone(base, tools, g === 'nm' ? 'Baptism date' : '', isTn ? 'e.g. A ride to the temple' : 'Tap their name in the Covenant Path Report to identify needs', isTn ? 'e.g. Sacrament' : '', FIXED_ORD[g])
      ]);
    } else top = wcSummary(r, a);
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
      sacToggle(base + 'sac', a.sac),
      g === 'nm' ? templeBox(base, i, a) : null,
      g === 'bt' ? committedBox(base, a) : null,
      g === 'bt' ? field('Scheduled baptism date', base + 'bap', { type: 'date', full: true }) : null
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
    facts.push(['Action item', act || 'None yet', act ? '' : 'unset']);
    if (str(a.hneed).trim()) facts.push(['Huddle notes', a.hneed.trim()]);
    return h('div', { class: 'wc-summary hd-summary' }, [
      h('div', { class: 'zone-label-row' }, [zoneLabel('hd', 'Huddle · How & When'),
        h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'hd-edit-toggle', 'aria-label': 'Edit sacrament attendance and the action item', 'aria-expanded': 'false', text: 'Edit' })])
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
    (card.classList.contains('person-wc') ? [wcLast(gid, a)].filter(Boolean) : wcExtras(gid, a)).forEach(function (x) { card.appendChild(x); });
  }
  function wcPersonCard(r, a) {
    var g = r.g, isTn = g === 'tn', base = isTn ? 'tn.' + r.i + '.' : 'cp.' + g + '.' + r.i + '.';
    var wc = h('div', { class: 'card-zone zone-wc-wrap' }, [
      zoneLabel('wc', 'Ward Council · Who & What'),
      h('div', { class: 'card-grid' }, [
        field(isTn ? 'Focus name' : 'Name', base + 'name', { full: true, placeholder: isTn ? 'Focus name' : 'From the Covenant Path Report', cap: 'words' }),
        g === 'nm' ? field('Baptism date', base + 'bap', { type: 'date', full: true }) : null,
        FIXED_ORD[g] ? h('div', { class: 'field full' }, ['Next ordinance', h('p', { class: 'fixed-value', text: FIXED_ORD[g] })])
          : ordField('Next ordinance', base + 'ordinance', { full: true }),
        field('Needs', base + 'need', { full: true, multi: true, rows: isTn ? '2' : '3', placeholder: isTn ? 'What do they need to get there?' : 'Tap their name in the Covenant Path Report to identify needs' })
      ])
    ]);
    var hd = personHdOpen
      ? hdZone(base, 'e.g. Sat 9 am', hdChecks(g, base, r.i, a),
          h('button', { type: 'button', class: 'zone-toggle', 'data-action': 'hd-edit-toggle', 'aria-label': 'Hide sacrament attendance and the action item', 'aria-expanded': 'true', text: 'Hide' }))
      : hdSummary(r, a);
    return h('div', { class: 'card wc-card person-wc g-' + g }, [
      wc, hd,
      g === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': r.i }, ['Move to New members']) : null,
      wcLast(g, a)
    ]);
  }
  /* ---------- Before ward council's screen for one person ----------
   * Only what the Covenant Path Report tells you: the name, the next ordinance, needs, and temple and
   * sacrament attendance. They are the same fields ward council and the huddle show, so nothing is typed twice. */
  function bwPersonCard(r, a) {
    var g = r.g, base = 'cp.' + g + '.' + r.i + '.';
    return h('div', { class: 'card person-bw g-' + g }, [
      h('div', { class: 'card-zone zone-bw-wrap' }, [
        zoneLabel('bw', 'Covenant Path Report'),
        h('div', { class: 'card-grid' }, [
          field('Name', base + 'name', { full: true, placeholder: 'From the Covenant Path Report', cap: 'words' }),
          g === 'nm' ? field('Baptism date', base + 'bap', { type: 'date', full: true }) : null,
          FIXED_ORD[g] ? h('div', { class: 'field full' }, ['Next ordinance', h('p', { class: 'fixed-value', text: FIXED_ORD[g] })])
            : ordField('Next ordinance', base + 'ordinance', { full: true }),
          field('Needs', base + 'need', { full: true, multi: true, rows: '3', placeholder: 'Tap their name in the Covenant Path Report to identify needs' })
        ]),
        h('div', { class: 'hd-checks' }, [g === 'nm' ? templeBox(base, r.i, a) : null, sacToggle(base + 'sac', a.sac)])
      ])
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
    // Load from a PDF is a quiet link under the four steps. (Receiving a handoff is under Hand off.)
    var practice = !!(state.loaded && state.loaded.practice);
    var live = !isEmpty(state) && !practice;
    var nw = $('#newweek-panel');
    if (nw) {
      nw.hidden = !live;
    }
    if (nw) nw.hidden = practice;
    $('#load-panel').hidden = true;
    $('#loaded-banner').hidden = !state.loaded;
    $('#loaded-banner').classList.toggle('practice', !!(state.loaded && state.loaded.practice));
    if (state.loaded && state.loaded.practice) {
      $('#loaded-banner .loaded-title').textContent = 'Practice week loaded';
      $('#loaded-sub').textContent = 'Sample names only. Remove it before your real huddle.';
      return;
    }
    $('#loaded-banner .loaded-title').textContent = 'Loaded last week’s agenda';
    if (state.loaded) {
      var L = state.loaded;
      var bits = [L.fileName || 'Last week’s PDF'];
      bits.push(L.count + (L.count === 1 ? ' action item' : ' action items'));
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
      var name = gid === 'fn' ? 'Finding new people' : r.prefilled ? (str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim()) : '';
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
      var parts = t.split(/(?<=\?)\s+(?=[A-Z])/), kids = [];
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
    $('#slides-fill').style.width = Math.round(100 * (slideAt + 1) / slides.length) + '%';
    $('#slide-prev').disabled = slideAt === 0;
    $('#slide-next').textContent = slideAt === slides.length - 1 ? 'Done' : 'Next';
    $('#slides-sheet .sheet').scrollTop = 0;
    if (slides[slideAt + 1]) { var pre = new Image(); pre.src = 'media/slides/' + slides[slideAt + 1].img; } // the next picture is ready when Next is tapped
  }
  /* ---------- Name rows: one line per person; tap to open their screen ---------- */
  function rowTag(text, cls) { return h('span', { class: 'fold-tag' + (cls ? ' ' + cls : ''), text: text }); }
  function personRow(kind, gid, i, a) {
    var name = str(a.name).trim(), tags = [], sub, warn = false;
    if (name && cardAge(a) >= STALE_FLAG) tags.push(rowTag('Not updated in 4 weeks', 'due'));
    if (kind === 'hd') {
      if (gid === 'nm' && name) { var ts = templeStatus(a, state.date); if (!ts.done) tags.push(rowTag('Temple: ' + ts.short, 'due')); }
      if (gid === 'bt' && a.committed) tags.push(rowTag(baptismNote(a)));
      if (a.sac) tags.push(rowTag('✓ Sacrament', 'ok'));
      if (a.actionCarried && str(a.action).trim()) tags.push(rowTag('Carried forward', 'carried'));
      sub = [str(a.action).trim(), str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
      if (!sub && name) { sub = 'Needs an action item'; warn = true; }
    } else if (kind === 'bw') {
      // Before ward council: what the Covenant Path Report says about them, at a glance.
      var bord = ordOf(a, gid), bneed = str(a.need).trim();
      if (gid === 'nm' && name) { var bts = templeStatus(a, state.date); tags.push(bts.done ? rowTag('✓ Temple', 'ok') : rowTag('Temple: ' + bts.short, 'due')); }
      if (a.sac) tags.push(rowTag('✓ Sacrament', 'ok'));
      if (name) { sub = (bord ? 'Next: ' + bord : 'Needs a next ordinance') + ' · ' + (bneed ? 'Needs: ' + bneed : 'No needs listed'); warn = !bord; }
    } else {
      var ord = ordOf(a, gid);
      sub = ord ? 'Next: ' + ord : '';
      if (!sub && name) { sub = 'Needs a next ordinance'; warn = true; }
    }
    if (!name) sub = sub || 'Tap to add';
    var title = name || (gid === 'tn' ? 'Focus name ' + (i + 1) : 'No name yet');
    return h('li', {}, [h('button', { type: 'button', class: 'nav-row person-row' + (name ? '' : ' is-blank'), 'data-action': 'open-person', 'data-a': gid, 'data-b': i, 'data-kind': kind,
      'aria-label': title + '. ' + sub }, [
      initialsDot(name),
      h('span', { class: 'step-text' }, [
        h('span', { class: 'step-title person-name', text: title }),
        h('span', { class: 'step-status' + (warn ? ' warn' : ''), text: sub }),
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
    var rows = list.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) { return isTn || !cardBlank(x.a); })
      .map(function (x) { return personRow(kind, gid, x.i, x.a); });
    var named = rows.length, ok = !isTn && kind === 'hd' && noneConfirmed(gid);
    if (ok) rows.push(h('li', { class: 'list-empty confirmed' }, [
      h('p', { class: 'list-empty-text' }, [icon('check'), h('span', { text: 'No one on the Covenant Path Report this week' })]),
      h('button', { type: 'button', class: 'btn-link list-empty-undo', 'data-action': 'cp-none-undo', 'data-a': gid, 'aria-label': 'Undo none this week for ' + title, text: 'Undo' })
    ]));
    if (!isTn) {
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
  function referralFields(i) {
    var base = 'referrals.' + i + '.';
    return h('div', { class: 'card-grid' }, [
      field('Name', base + 'name', { full: true, placeholder: 'Who is being referred', cap: 'words' }),
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
    var isRef = r.g === 'mr';
    var base = r.g === 'tn' ? 'tn.' + r.i + '.' : 'cp.' + r.g + '.' + r.i + '.';
    var card = isRef ? h('div', { class: 'card ref-card' }, [referralFields(r.i)]) : r.kind === 'wc' ? wcPersonCard(r, a) : r.kind === 'bw' ? bwPersonCard(r, a) : hdPersonCard(r, a);
    var remove = h('button', { type: 'button', class: 'btn-link danger person-remove', 'data-action': r.g === 'tn' ? 'quick-remove-tn' : isRef ? 'remove-mr' : 'remove-cp',
      'data-a': r.g === 'tn' || isRef ? r.i : r.g, 'data-b': r.g === 'tn' || isRef ? '' : r.i,
      hidden: rowBlank(r.g, a) }, [r.g === 'tn' ? 'Clear this focus name' : 'Remove from the list']);
    var attrs = { class: 'list-panel person-panel list-' + r.g, 'aria-label': personTitle(r) };
    attrs[r.kind === 'wc' ? 'data-wc' : r.kind === 'bw' ? 'data-bw' : 'data-group'] = r.g;
    var done = h('button', { type: 'button', class: 'btn-primary full person-done', 'data-action': 'steps-home' }, ['Done']);
    // Ward council's screen asks the 4-week question too (the huddle's card carries its own).
    var note = (r.kind === 'wc' || r.kind === 'bw') && !isRef ? staleNote(base, a, r.g === 'tn') : null;
    // The top of the screen is tinted with their list's color: initials, name, and which list they're on.
    var head = h('div', { class: 'person-head' }, [initialsDot(a.name), h('div', { class: 'person-head-text' }, [
      h('p', { class: 'person-head-name', text: personTitle(r) }), h('p', { class: 'person-head-list', text: LIST_LABEL[r.g] })])]);
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
    wrap.replaceChildren(h('section', { class: 'list-panel list-tn', 'aria-label': 'Name Next Ordinance' }, [head].concat(cards).concat([h('div', { class: 'list-foot' }, [doneButton('tn', 'Focus names')])])));
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
  function renderFN() {
    var wrap = $('#fn-list');
    var items = state.find.items, many = items.length > 1;
    var rows = items.map(function (x, i) {
      var base = 'find.items.' + i + '.';
      return h('div', { class: 'fn-assign' }, [
        h('div', { class: 'fn-assign-head' }, [
          h('p', { class: 'fn-assign-label', text: 'Assignment ' + (i + 1) }),
          x.carried && str(x.task).trim() ? carriedTag() : null,
          many ? removeButton('remove-fn', i, '', 'Remove assignment ' + (i + 1)) : null
        ]),
        h('div', { class: 'fn-fields' }, [
          field('Who will do what', base + 'task', { multi: true, placeholder: 'e.g. Bro. Lee invites a neighbor to the ward party' }),
          whenField('When', base + 'when', { placeholder: 'e.g. Sat' })
        ])
      ]);
    });
    wrap.replaceChildren(h('section', { class: 'list-panel list-fn', 'aria-label': 'Plans to find new people to teach' }, [
      h('div', { class: 'card fn-card' }, [
        h('div', { class: 'card-grid' }, [field('Plan', 'find.plan', { full: true, multi: true, placeholder: 'What will the ward do this week to find new people to teach?' })]),
        h('p', { class: 'fn-assign-title', text: 'Assignments' })
      ].concat(rows).concat([h('div', { class: 'list-foot' }, [addButton('add-fn', '', 'Add an assignment')])]))
    ]));
  }
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
        h('span', { class: 'fold-plan' + (plan ? '' : ' missing'), text: plan || 'No action item' })
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
        title: missing.length === 1 ? missing[0] + ' has no action item yet' : missing.length + ' people have no action item yet',
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
    return state.tn.filter(function (n) { return str(n.name).trim(); }).length + ' of 3 names';
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
    renderAttendees(); renderRR(); renderCP(); renderTN(); renderFN(); renderMR();
    detailsOpen = false; // Huddle Details start closed; tap the box to open them.
    renderDetails(); renderSteps(); renderSent();
  }

  /* ---------- Four steps: the agenda opens as a short checklist ---------- */
  // Return and Report, Covenant Path, Name Next Ordinance, Find New People to Teach, Missionary Referrals.
  // (The PDF's heading for the second one stays "Covenant Path Report Review".)
  // Tap a section to open just that part; "Mark section done" gives it a green check.
  var STEPS = [
    { id: 'rr', title: 'Return and Report', band: 'last' },
    { id: 'cp', title: 'Covenant Path Report', band: 'this' },
    { id: 'tn', title: 'Focus names', band: 'this' },
    { id: 'fn', title: 'Find New People to Teach', band: 'this' },
    { id: 'mr', title: 'Missionary Referrals', band: 'this' }
  ];
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
  function personList(r) { return r.g === 'tn' ? state.tn : r.g === 'mr' ? state.referrals : state.cp[r.g]; }
  function personCard(r) { var l = r && personList(r); return l ? l[r.i] : null; }
  function personListView(r) {
    if (r.kind === 'bw') return 'bw';
    var sec = r.g === 'tn' ? 'tn' : r.g === 'mr' ? 'mr' : 'cp';
    return r.kind === 'wc' ? 'wc-' + sec : sec;
  }
  function personTitle(r) {
    var a = personCard(r), n = a ? str(a.name).trim() : '';
    return n || (r.g === 'tn' ? 'Focus name ' + (r.i + 1) : r.g === 'mr' ? 'New referral' : 'New name');
  }
  function cardBlank(a) { return !a.sac && !a.temple && !a.committed && !hasText(a, CARD_KEYS); }
  function rowBlank(g, a) { return g === 'mr' ? refBlank(a) : cardBlank(a); }
  function openPerson(kind, g, i, focusName) {
    personRef = { kind: kind, g: g, i: +i }; personWcOpen = wcOpenDefault(personRef); personHdOpen = false;
    showView(kind === 'wc' ? 'p-wc' : kind === 'bw' ? 'p-bw' : 'p-hd', 'push');
    if (focusName) setTimeout(function () { var f = document.querySelector('#person-card input[data-bind$=".name"]'); if (f) f.focus(); }, 60);
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
    if (a && rowBlank(r.g, a) && list.length > (r.g === 'mr' ? 0 : 1)) { list.splice(r.i, 1); saveDraft(); }
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
      var lead = id === 'tn' ? named.length + ' of 3 names' : plural(named.length, 'person', 'people');
      return { text: lead + ' · ' + (missing ? missing + (missing === 1 ? ' needs' : ' need') + ' an action item' : 'everyone has an action item'), warn: missing > 0 };
    }
    if (id === 'mr') { var nr = cleanReferrals(state.referrals).length; return { text: nr ? plural(nr, 'referral', 'referrals') : 'None listed' }; }
    var plan = str(state.find.plan).trim(), k = state.find.items.filter(function (x) { return str(x.task).trim(); }).length;
    if (!plan && !k) return { text: 'Not started' };
    return { text: (plan ? 'Plan written' : 'No plan yet') + ' · ' + plural(k, 'assignment', 'assignments'), warn: !plan || !k };
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
    var named = allNames().map(function (x) { return { a: x.a, g: x.gid }; }).concat(state.tn.filter(function (a) { return str(a.name).trim(); }).map(function (a) { return { a: a, g: 'tn' }; }));
    if (!named.length) return null;
    var have = named.filter(function (x) { return ordOf(x.a, x.g); }).length, all = have === named.length;
    return { done: have, of: named.length, text: all ? (have === 1 ? 'The 1 name has a next ordinance' : 'All ' + have + ' names have a next ordinance') : have + ' of ' + named.length + ' names have a next ordinance' };
  }
  function renderHeroes() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-hero]'), function (el) {
      var key = el.getAttribute('data-hero');
      // The Huddle and After the huddle carry the huddle's own date; the other two happen on the day they're opened.
      var d = (key === 'hd' || key === 'af') && parseISO(state.date) || new Date();
      el.querySelector('.hero-ward').textContent = state.ward.trim() || { hd: 'Huddle', wc: 'Ward council', bw: 'Before ward council', af: 'After the huddle' }[key];
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
    var row = function (st) {
      var isDone = !!state.stepsDone[st.id], status = stepStatus(st.id);
      var num = null;
      if (isDone) { num = h('span', { class: 'step-num' + (justDone && justDone.id === st.id && Date.now() - justDone.at < 1500 ? ' pop' : ''), 'aria-hidden': 'true' }); num.appendChild(icon('check')); }
      return h('li', {}, [h('button', { type: 'button', class: 'nav-row step-row' + (isDone ? ' done' : ''), 'data-action': 'open-step', 'data-a': st.id,
        'aria-label': st.title + (isDone ? ', done' : '') + '. ' + status.text }, [
        tile(st.id),
        h('span', { class: 'step-text' }, [
          h('span', { class: 'step-title', text: st.title }),
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
  function renderStepFoot() {
    var i = STEPS.findIndex(function (st) { return st.id === view; });
    if (i < 0) return;
    var nxt = STEPS[i + 1], prv = STEPS[i - 1];
    $('#step-done-label').textContent = state.stepsDone[view] ? 'Section done · Back' : 'Mark section done';
    var und = $('.step-undone'); if (und) und.hidden = !state.stepsDone[view];
    var sn = $('#step-next'), sp = $('#step-prev');
    sn.hidden = !nxt; sp.hidden = !prv;
    // A quiet shortcut line, not steps: "‹ Return and Report · Name Next Ordinance ›"
    if (nxt) { sn.textContent = nxt.title + ' ›'; sn.setAttribute('aria-label', 'Go to ' + nxt.title); }
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
    document.body.classList.toggle('steps-on', !all);
    document.body.setAttribute('data-view', all ? 'all' : view);
    var home = all || view === 'home', start = !all && view === 'start', wc = !all && view === 'wc', wcSub = !all && isWcList(view), bw = !all && view === 'bw', af = !all && view === 'af';
    // A person's screen needs a person; anything else (a stale Back, a removed name) falls back to their list.
    if (!all && isPerson(view) && !personOk(personRef)) { view = personRef ? personListView(personRef) : 'home'; personRef = null; return applyView(); }
    var person = !all && isPerson(view);
    // Erase everything and the footer sit on the opening screen only.
    $('header.top').hidden = !home && !start; $('.start-here').hidden = !home && !start; $('.fine-notes').hidden = !all && !start;
    $('#person-view').hidden = !person;
    // Find New People to Teach and Missionary Referrals are one section each, shown in the Huddle and in ward council.
    var stepShown = view === 'wc-fn' ? 'fn' : view === 'wc-mr' ? 'mr' : view;
    $('#start-home').hidden = !start; $('#wc-view').hidden = !wc && !(!all && isWcNames(view)); $('#mode-bar').hidden = all || !(view === 'home' || wc || bw || af);
    $('#bw-view').hidden = !bw; $('#af-view').hidden = !af;
    $('#mode-title').textContent = wc ? 'Ward council' : bw ? 'Before ward council' : af ? 'After the huddle' : 'Huddle';
    $('#hd-hero').hidden = all || view !== 'home'; // the Huddle's header card, with its one line on what to do there
    var stp = STEPS.filter(function (x) { return x.id === view; })[0] || WC_LISTS.filter(function (x) { return 'wc-' + x.id === view; })[0];
    $('#step-title').textContent = person ? personTitle(personRef) : stp ? stp.title : '';
    // Leaving a person's screen: drop a name left empty, then redraw the lists it appears on.
    if (isPerson(shownView) && !person) { cleanupPerson(); renderCP(); renderTN(); }
    // Names edited in ward council show up on the huddle's cards.
    if (isWcList(shownView) && !isWcList(view) && !person) { renderCP(); renderTN(); }
    if (!all && view === 'rr' && shownView !== 'rr') { rrAdding = false; renderRR(); } // names may have changed since it was drawn
    if (!all && shownView && shownView !== view) navFeel(viewDepth(view) - viewDepth(shownView));
    shownView = view;
    renderWC(); renderMR(); renderPerson(); renderChecks(); renderBefore(); if (af) renderAfter();
    if (start) renderDoors();
    $('#steps-home').hidden = all || view !== 'home';
    $('#step-bar').hidden = all || home || start || wc || bw || af; $('#step-foot').hidden = all || home || start || wc || wcSub || person || bw || af;
    // Hand off and Send live on the opening screen and the huddle's list; inside a section they're hidden.
    var bar = $('.actionbar'); if (bar) bar.hidden = !all && !start;
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
      field('Needs', base + 'need', { multi: true, rows: gid === 'tn' ? '2' : '3', placeholder: gid === 'tn' ? 'What do they need to get there?' : 'Tap their name in the Covenant Path Report to identify needs' })
    ].concat(extras));
  }
  // Ward council opens to its two lists, rolled up like the huddle's sections; tap one for its names.
  // Ward council's lists. The last two are the same sections the Huddle has (the same data, entered once).
  var WC_LISTS = [{ id: 'cp', title: 'Covenant Path Report' }, { id: 'tn', title: 'Focus names' },
    { id: 'fn', title: 'Find New People to Teach' }, { id: 'mr', title: 'Missionary Referrals' }];
  function isWcList(v) { return v === 'wc-cp' || v === 'wc-tn' || v === 'wc-fn' || v === 'wc-mr'; }
  function isWcNames(v) { return v === 'wc-cp' || v === 'wc-tn'; }
  function wcStatus(id) {
    if (id === 'fn' || id === 'mr') return stepStatus(id);
    var named = [];
    if (id === 'tn') named = state.tn.filter(function (a) { return str(a.name).trim(); }).map(function (a) { return { a: a, g: 'tn' }; });
    else GROUPS.forEach(function (g) { state.cp[g.id].forEach(function (a) { if (str(a.name).trim()) named.push({ a: a, g: g.id }); }); });
    if (!named.length) return { text: id === 'tn' ? 'None chosen yet' : 'No names yet' };
    var missing = named.filter(function (x) { return !ordOf(x.a, x.g); }).length;
    var lead = id === 'tn' ? named.length + ' of 3 names' : plural(named.length, 'person', 'people');
    return { text: lead + ' · ' + (missing ? missing + (missing === 1 ? ' needs' : ' need') + ' a next ordinance' : 'everyone has a next ordinance'), warn: missing > 0 };
  }
  function renderWC() {
    var wrap = $('#wc-list'), rows = $('#wc-rows'); if (!wrap || !rows) return;
    rows.hidden = !(stepsOn && view === 'wc');
    var wcHero = $('#wc-hero'); if (wcHero) wcHero.hidden = rows.hidden;
    if (!rows.hidden) rows.replaceChildren.apply(rows, WC_LISTS.map(function (l) {
      var st = wcStatus(l.id);
      return h('li', {}, [h('button', { type: 'button', class: 'nav-row wc-row', 'data-action': 'open-wc-list', 'data-a': l.id, 'aria-label': l.title + '. ' + st.text }, [
        tile(l.id),
        h('span', { class: 'step-text' }, [
          h('span', { class: 'step-title', text: l.title }),
          h('span', { class: 'step-status' + (st.warn ? ' warn' : ''), text: st.text })
        ]),
        h('span', { class: 'step-chev', 'aria-hidden': 'true', text: '›' })
      ])]);
    }));
    $('#wc-note').hidden = rows.hidden;
    if (rows.hidden) rows.replaceChildren();
    if (rowsOn) { // one row per name; the fields are on the person's own screen
      if (!isWcNames(view)) { wrap.replaceChildren(); return; }
      wrap.replaceChildren.apply(wrap, view === 'wc-tn' ? [rowsPanel('wc', 'tn', 'Focus names')] : GROUPS.map(function (g) { return rowsPanel('wc', g.id, g.title); }));
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
    [['before', 'Update each person from the Covenant Path Report', 'Done. Tap to look again.'], ['after', 'Update the Covenant Path Report, then send', 'Done. You can send.']].forEach(function (c) {
      var on = !!state.verified[c[0]], box = $('#' + c[0] + '-box'); if (!box) return;
      box.classList.toggle('done', on); $('#' + c[0] + '-sub').textContent = on ? c[2] : c[1];
      box.setAttribute('aria-label', $('#' + c[0] + '-box .cpr-step-k').textContent + ': ' + $('#' + c[0] + '-box .check-line').textContent + (on ? '. Done.' : '. Not done yet.'));
      // On the step's own screen: mark it done at the bottom, or take the mark back off.
      var doneBtn = $('#' + c[0] + '-done-btn'), otherBtn = $('#' + c[0] + '-other-btn');
      // Once it's done, the main button just goes back; taking the mark off is the quieter choice under it.
      // ("Not yet" is the Back button at the top of the screen.)
      if (!doneBtn.getAttribute('data-label')) doneBtn.setAttribute('data-label', doneBtn.textContent);
      doneBtn.textContent = on ? 'Done · Back' : doneBtn.getAttribute('data-label');
      doneBtn.setAttribute('data-action', on ? 'close-' + c[0] : c[0] + '-done');
      otherBtn.hidden = !on;
      $('#' + c[0] + '-state').hidden = !on;
    });
  }
  function setVerified(which, on) { state.verified[which] = !!on; renderChecks(); saveDraft(); }
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
    var rows = names.map(function (x) {
      var a = x.a, r = null;
      for (var i = 0; i < state.rr.length; i++) { var q = state.rr[i]; if (q.prefilled && groupOf(q) === x.gid && norm(rrPerson(q)) === norm(a.name) && str(q.action).trim()) { r = q; break; } }
      var fact = function (k, v, cls) { return h('p', { class: 'after-fact' + (cls ? ' ' + cls : '') }, [h('span', { class: 'after-k', text: k }), v]); };
      var who = [str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
      return h('div', { class: 'card after-card g-' + x.gid }, [
        h('p', { class: 'after-name' }, [a.name.trim(), h('span', { class: 'source', text: label[x.gid] })]),
        fact('Sacrament', a.sac ? 'Attended' : 'Not marked', a.sac ? 'yes' : ''),
        x.gid === 'nm' ? fact('Temple', a.temple ? 'Attended' : 'Not yet', a.temple ? 'yes' : '') : null,
        x.gid === 'bt' && a.committed ? fact('Baptism', 'Committed' + (monthDay(a.bap) ? ' · ' + monthDay(a.bap) : ''), 'yes') : null,
        str(a.ordinance).trim() ? fact('Next ordinance', a.ordinance.trim()) : null,
        str(a.need).trim() ? fact('Needs', a.need.trim()) : null,
        r ? fact('Reported back', (str(r.action).trim()) + ': ' + ({ Yes: 'Done', Partly: 'Partly done', No: 'Not done' }[r.happened] || 'Pending') + (str(r.notes).trim() ? ' · ' + r.notes.trim() : ''), statusOf(r.happened)) : null,
        str(a.action).trim() ? fact('New assignment', a.action.trim() + (who ? ' (' + who + ')' : '')) : null,
        str(a.hneed).trim() ? fact('Huddle notes', a.hneed.trim()) : null
      ]);
    });
    wrap.replaceChildren.apply(wrap, rows.length ? rows : [h('p', { class: 'quick-none', text: 'No one is on the Covenant Path Report lists yet.' })]);
  }

  // The two doors on the opening screen say where things stand.
  // The opening screen's four steps as a timeline: each is done, or the first one not done is "Up next".
  // Ward council is done when every name has a next ordinance; the Huddle when all five sections are marked done.
  function stepsDoneState() {
    var wc = heroProgress('wc'), hd = heroProgress('hd');
    return [!!state.verified.before, !!(wc && wc.done === wc.of), !!(hd && hd.done === hd.of), !!state.verified.after];
  }
  function renderDoors() {
    renderChecks();
    var done = stepsDoneState(), next = done.indexOf(false);
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
  function showView(v, mode) {
    if (!stepsOn) v = 'home';
    view = v;
    try {
      if (mode === 'push') history.pushState({ hv: v, pushed: true, ref: isPerson(v) ? personRef : null }, '');
      else if (mode === 'replace') history.replaceState({ hv: v, ref: isPerson(v) ? personRef : null }, '');
    } catch (e) { /* ignore */ }
    applyView();
    window.scrollTo(0, 0);
  }
  // Back from the huddle's list or ward council to the opening screen.
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
    $('#confirm-sheet .warn-icon').hidden = !!opts.success;
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
    cmp.classList.toggle('fieldwrap', !!(opts.dateField || opts.textField));
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
      case 'list-done': listDone(a); break;
      case 'tour': closeHelp(); startPractice(); break; // the guided tour is a practice week with sample names
      case 'go-home-screen': if (isPerson(view)) cleanupPerson(); showView('start', 'replace'); break;
      case 'add-hneed': {
        var zone = btn.closest('.card-zone');
        var hf = zone && zone.querySelector('[data-bind$=".hneed"]');
        if (hf) { hf.closest('.field').hidden = false; btn.hidden = true; hf.focus(); }
        break;
      }
      case 'list-open': listOpen(a); break;
      case 'open-step': showView(a, 'push'); break;
      case 'open-wc': showView('wc', 'push'); break;
      case 'open-wc-list': showView('wc-' + a, 'push'); break;
      case 'open-huddle': syncDate(); showView('home', 'push'); break;
      case 'go-start': goStart(); break;
      case 'open-before': showView('bw', 'push'); break;
      case 'close-before': goStart(); break;
      case 'before-done': setVerified('before', true); goStart(); toast('Before ward council: done.'); break;
      case 'open-after': showView('af', 'push'); break;
      case 'close-after': goStart(); break;
      case 'after-done': setVerified('after', true); goStart(); toast('Covenant Path Report updated. You can send.'); break;
      case 'before-undo': setVerified('before', false); toast('Before ward council: marked as not done.'); break;
      case 'after-undo': setVerified('after', false); toast('Marked as not done. Send waits until it’s done.'); break;
      case 'wc-edit-toggle': {
        personWcOpen = !personWcOpen; renderPerson();
        var wt = document.querySelector('#person-card ' + (personWcOpen ? '.card-name-input' : '.zone-toggle'));
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
        var qn = state.tn[+a], qdo = function () { state.tn[+a] = blankName(); renderTN(); renderBefore(); renderDoors(); saveDraft(); if (isPerson(view)) { toast('Focus name cleared.'); leavePerson(); } };
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
      case 'step-done': {
        var doneView = view;
        var finish = function () {
          state.stepsDone[doneView] = true; justDone = { id: doneView, at: Date.now() }; saveDraft(); goHome();
          var st = STEPS.filter(function (x) { return x.id === doneView; })[0];
          toast((st ? st.title : 'Section') + ' marked done.', 6000, { label: 'Undo', run: function () { delete state.stepsDone[doneView]; saveDraft(); } });
        };
        finish();
        break;
      }
      case 'step-undone': delete state.stepsDone[view]; saveDraft(); renderStepFoot(); toast('Marked as not done.'); break;
      case 'step-prev': {
        var pi = STEPS.findIndex(function (st) { return st.id === view; });
        if (pi > 0) showView(STEPS[pi - 1].id, 'replace');
        break;
      }
      case 'step-next': {
        var si = STEPS.findIndex(function (st) { return st.id === view; });
        if (si >= 0 && STEPS[si + 1]) showView(STEPS[si + 1].id, 'replace');
        break;
      }
      case 'open-details': openDetails(); break;
      case 'edit-ward': openOverlay('#ward-sheet', '#ward'); break;
      case 'coach-skip': if (coachAt >= 0) { coachAt++; writeCoach(); drawCoach(); } break;
      case 'coach-finish': removePractice(); break;
      case 'coach-end': confirmRemovePractice(); break;
      case 'slides': openSlides(); break;
      case 'slide-next': if (slides && slideAt >= slides.length - 1) closeOverlay('#slides-sheet'); else showSlide(slideAt + 1); break;
      case 'slide-prev': showSlide(slideAt - 1); break;
      case 'close-slides': closeOverlay('#slides-sheet'); break;
      case 'close-ward': closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); break;
      case 'close-details': detailsOpen = false; renderDetails(); window.scrollTo(0, 0); break;
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
      case 'load-other':
      case 'load': pickFile(); break;
      case 'handoff': startHandoff(); break;
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
      case 'practice': ['#handoff-sheet', '#help-sheet'].forEach(function (id) { if (!$(id).hidden) closeOverlay(id); }); startPractice(); break;
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
      case 'add-fn':
        state.find.items.push(blankAssign()); renderFN(); saveDraft();
        focusLast('#fn-list input[data-bind$=".task"]'); break;
      case 'remove-fn': {
        var fx = state.find.items[+a];
        var dropFn = function () { state.find.items.splice(+a, 1); if (!state.find.items.length) state.find.items.push(blankAssign()); renderFN(); saveDraft(); };
        if (fx && assignHasText(fx)) confirmRemove('Remove assignment ' + (+a + 1) + '?', dropFn); else dropFn();
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
      case 'hp-safari': if (handoffHere) confirmApplyAgenda(handoffHere.s, 'handoff', closeHandoffPage); break;
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
  function practiceData() {
    var card = function (o) { return Object.assign(blankAction(), o); };
    return {
      app: APP_ID, v: DATA_VERSION, ward: 'Sample Ward', date: isoShift(-7), conducting: 'wml', attendees: [], rr: [],
      cp: {
        nm: [card({ name: 'Daniel Rivera', bap: isoShift(-12), ordinance: 'Baptisms for the dead', need: 'A ride to the temple', action: 'Invite him on the ward temple trip Saturday', assigned: 'Bro. Patel', when: 'Sat' })],
        rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun' })],
        bt: [card({ name: 'Marcus Hill', bap: isoShift(10), committed: true, need: 'Get to know ward members', action: 'Invite him to the ward dinner Friday', assigned: 'Elders quorum', when: 'Fri' })]
      },
      tn: [
        card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names', action: 'Family history consultant visits to prepare names', assigned: 'Sister Nguyen', when: 'Thu' }),
        card({ name: 'Samuel Ortiz', ordinance: '', need: 'Someone to study with', action: 'Elders quorum president meets with him', assigned: 'Bro. Young', when: 'Tue' }),
        card({ name: 'Emma Walsh', ordinance: 'Endowment', need: 'Temple preparation class', action: 'Invite her to the temple prep class', assigned: 'Sister Lee', when: 'Sun' })
      ],
      find: { plan: 'Invite friends to the ward Christmas devotional', items: [{ task: 'Each family invites one friend', when: 'Sun', carried: false }] },
      referrals: [{ name: 'Marcus Bell', by: 'Sister Diaz', notes: 'A friend from work who asked about the Book of Mormon' }]
    };
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
    var bands = { 'band-rr': fromLabel(), 'week-rr': fromLabel(), 'band-plan': planLabel(), 'week-plan': planLabel() };
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
    var cpN = GROUPS.reduce(function (n, g) { return n + needs(state.cp[g.id]); }, 0);
    if (cpN) out.push({ text: 'Covenant Path Report: ' + cpN + (cpN === 1 ? ' person needs' : ' people need') + ' an action item', go: go('cp') });
    GROUPS.forEach(function (g) { if (listEmpty(g.id) && !noneConfirmed(g.id)) out.push({ text: g.title + ': not reviewed', go: go('cp') }); });
    var tnN = needs(state.tn);
    if (tnN) out.push({ text: 'Focus names: ' + tnN + (tnN === 1 ? ' person needs' : ' people need') + ' an action item', go: go('tn') });
    if (!str(state.find.plan).trim()) out.push({ text: 'Find New People to Teach: no plan yet', go: go('fn') });
    return out;
  }

  function rrFromItem(it, happened) {
    return { prefilled: true, source: it.source, group: it.group, pname: it.pname, ord: it.ord, need: it.need || '', hneed: it.hneed || '', sac: !!it.sac, bap: it.bap || '', temple: !!it.temple, committed: !!it.committed,
      person: it.person, action: it.action, assigned: it.assigned, when: it.when, plan: '', happened: happened || '', notes: '' };
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
      title: downloaded ? 'PDF downloaded' : 'Sent successfully', success: true, celebrate: true,
      cheer: planned ? plural(planned, 'person has', 'people have') + ' a plan this week.' : '',
      body: (downloaded ? 'Attach it to an email or text message to send it. ' : '') +
        'You’re set for your next huddle. ' +
        (n ? 'This huddle’s assignments are now in Return and Report: mark them as people report back. ' : '') +
        'Names and needs stay for ward council to update.',
      primary: 'Done',
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
    if (handoffMsg) { openMessages(handoffMsg); coachMark('handoff'); return; }
    (handoffBuild || Promise.reject()).then(function (msg) { openMessages(msg); coachMark('handoff'); }, function () { toast('Couldn’t make the handoff. Try again.'); });
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
      ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or tap Load from a PDF and choose the last PDF that was sent.', primary: 'OK' });
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
      unpackHandoff(m[1]).then(function (s) { confirmApplyAgenda(s, 'handoff'); }, function () { ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or tap Load from a PDF and choose the last PDF that was sent.', primary: 'OK' }); });
    };
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { useText(t, false); }, function () { manual(); });
    else manual();
  }

  // A handoff is a huddle still being planned: it loads as it was.
  // A PDF is a huddle that was sent: loading it sets up the next huddle from it, the same as sending does.
  // Either way, Undo puts this phone's agenda back.
  function confirmApplyAgenda(data, how, after) {
    if (data && data.__practice) {
      var practiceIn = normalizeState(data);
      ask({ title: 'Try this practice handoff?', body: 'It opens as a practice week with sample names. Your own huddle is set aside and comes back when you remove the practice week.',
        primary: 'Load the practice', onPrimary: function () { if (after) after(); loadPracticeHandoff(practiceIn); }, secondary: 'Cancel' });
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
      title: pdf ? 'Set up the next huddle from this PDF?' : 'Load this handoff?', compare: rows,
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
  // A practice week is guided: a small card at the bottom gives one task at a time and moves on once it's done.
  function startPractice() {
    // The practice starts from a blank form with only the sample names, so none of this phone's real names are in it
    // (or in a practice handoff). The real huddle is set aside whole and comes back when the practice is removed.
    if (!isPractice()) {
      var real = JSON.parse(JSON.stringify(state));
      state = normalizeState(null); state.ward = real.ward; state.practiceSnapshot = real; showBlank = {};
    }
    applyLoad(practiceData(), 'Practice week', { practice: true });
    if (!isPractice()) return;
    // A fresh week to practice on (the real one, set aside, keeps its own marks).
    state.verified = { before: false, after: false }; state.stepsDone = {}; state.attendees = [];
    resetView(); renderAll(); applyView(); saveDraft();
    startCoach(0);
  }
  var COACH_KEY = 'huddle-coach-step', GUIDE_OFFERED_KEY = 'huddle-tour-seen';
  var COACH = [
    { k: 'Welcome', t: 'This tour walks you through one week with **sample names**. Each card gives one thing to do and moves on once it’s done. Anything already on this phone is set aside and comes back at the end.', start: true },
    { k: 'Step 1 · Before ward council', t: 'The opening screen has four steps, in order. Tap **Step 1 · Before ward council**.', target: '#before-box', done: function () { return view === 'bw' || state.verified.before; } },
    { k: 'Step 1 · Before ward council', t: 'Before ward council, bring each name up to date from the Covenant Path Report. Tap a name to see what’s there, then tap **All up to date · Mark done** at the bottom.', target: '#before-done-btn', done: function () { return !!state.verified.before; } },
    { k: 'Step 2 · Ward council', t: 'Step 1 has its green check. Now tap **Step 2 · Ward council**.', target: '.door-wc', done: function () { return view === 'wc' || isWcList(view) || view === 'p-wc'; } },
    { k: 'Step 2 · Ward council', t: 'Ward council decides who to focus on and each next ordinance. Tap **Focus names**, then **Samuel Ortiz**, and choose his next ordinance. Never add confidential information to this huddle report.', target: ['[data-wc="tn"] [data-b="1"]', '[data-action="open-wc-list"][data-a="tn"]', '#person-card select'], done: function () { var a = state.tn[1]; return !!(a && ORDINANCES.indexOf(str(a.ordinance)) >= 0); } },
    { k: 'Step 3 · Huddle', t: 'Every name has a next ordinance, so Step 2 is done. Tap **Home** at the top, then **Step 3 · Huddle**.', target: ['.bar-home', '#mode-bar .step-back', '.door-hd'], done: function () { return view === 'home'; } },
    { k: 'Step 3 · Huddle', t: 'Tap **Huddle Attendees** and tap who came. Tap **both youth**, the priests quorum assistant and the Gatherers of Light representative: including the youth matters.', target: ['#attendee-list', '#details-summary'], done: function () { return state.attendees.indexOf('pqa') >= 0 && state.attendees.indexOf('gol') >= 0; } },
    { k: 'Step 3 · Return and Report', t: 'Tap **Done**, then **Return and Report**. Mark one assignment **Yes**, one **Partly** and one **No**.', target: ['[data-action="open-step"][data-a="rr"]', '#rr-list'], done: function () { var h = state.rr.map(function (r) { return r.happened; }); return h.indexOf('Yes') >= 0 && h.indexOf('Partly') >= 0 && h.indexOf('No') >= 0; } },
    { k: 'Step 3 · Return and Report', t: 'On the one marked **No**, tap **Carry forward to this huddle**. It moves onto this week’s plan, so it isn’t forgotten.', target: '.btn-carry', done: function () { return state.rr.some(function (r) { return r.carriedFwd; }); } },
    { k: 'Step 3 · Return and Report', t: 'Scroll down and tap **Mark section done**.', target: '[data-action="step-done"]', done: function () { return !!state.stepsDone.rr; } },
    { k: 'Step 3 · Covenant Path Report', t: 'Tap **Covenant Path Report**, then **Daniel Rivera**. Check **Attended sacrament**, then add an action item, who will do it, and a date.', target: ['[data-action="open-step"][data-a="cp"]', '[data-group="nm"] [data-b="0"]', '#person-card .zone-hd-wrap'], done: function () { var a = state.cp.nm[0]; return !!(a && str(a.action).trim() && str(a.assigned).trim() && str(a.when).trim()); } },
    { k: 'Step 3 · Covenant Path Report', t: 'Tap **Text this assignment** and send it to yourself. In a real huddle, text each person before everyone leaves.', target: '#person-card [data-action="text-assign"]', done: function () { var a = state.cp.nm[0]; return !!(a && a.texted); }, skip: true },
    { k: 'Step 3 · Covenant Path Report', t: 'Tap **Done**, then **Mark section done**. Tip 👆 not sure what to plan? Tap **How can we help?** under a list’s name.', target: ['#person-view .person-done', '[data-action="step-done"]'], done: function () { return !!state.stepsDone.cp; } },
    { k: 'Step 3 · Huddle', t: 'Open **Focus names**, **Find New People to Teach** and **Missionary Referrals**, and tap **Mark section done** on each.', target: ['[data-action="step-done"]', '#steps-this'], done: function () { return STEPS.every(function (x) { return state.stepsDone[x.id]; }); } },
    { k: 'Step 4 · After the huddle', t: 'All five sections are done, so Step 3 is too. Tap **Home** at the top, then **Step 4 · After the huddle**.', target: ['.bar-home', '#mode-bar .step-back', '#after-box'], done: function () { return view === 'af' || state.verified.after; } },
    { k: 'Step 4 · After the huddle', t: 'This page lists what happened for each person. Update the Covenant Path Report in Member Tools to match, then tap **It’s all updated · Mark done**.', target: '#after-done-btn', done: function () { return !!state.verified.after; } },
    { k: 'Send', t: 'All four steps have green checks. Tap **Send**, then **Share PDF**, and send the sample to yourself.', target: '.actionbar [data-action="send"]', done: function () { return coachFlag('sent'); } },
    { k: 'Hand off', t: 'When someone else will conduct, you hand the huddle off. Try it: tap **Hand off**, then **Send a handoff**, and text it to yourself.', target: '.actionbar [data-action="handoff"]', done: function () { return coachFlag('handoff'); }, skip: true },
    { k: 'All done', t: 'You’ve practiced a whole week. Tap **Finish** to remove the sample names; anything you had before comes back as it was.', end: true }
  ];
  var coachAt = -1, coachEl = null, coachTimer = null, coachMoving = false, coachFlags = {};
  function coachFlag(k) { return !!coachFlags[k]; }
  function coachMark(k) { if (coachAt >= 0) coachFlags[k] = true; }
  function coachText(t) { var d = document.createElement('span'); d.textContent = t; return d.innerHTML.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function startCoach(i) {
    coachAt = i; coachFlags = {}; writeCoach();
    if (!coachEl) {
      coachEl = h('div', { class: 'coach', role: 'status', 'aria-live': 'polite' }, [
        h('div', { class: 'coach-top' }, [h('span', { class: 'coach-k' }), h('span', { class: 'coach-n' }),
          h('button', { type: 'button', class: 'coach-end', 'data-action': 'coach-end', text: 'End practice' })]),
        h('p', { class: 'coach-t' }),
        h('div', { class: 'coach-btns' }, [h('button', { type: 'button', class: 'btn-link coach-skip', 'data-action': 'coach-skip', text: 'Skip this step' }),
          h('button', { type: 'button', class: 'btn-primary coach-start', 'data-action': 'coach-skip', text: 'Start' }),
          h('button', { type: 'button', class: 'btn-primary coach-finish', 'data-action': 'coach-finish', text: 'Finish' })])
      ]);
      document.body.appendChild(coachEl);
    }
    document.body.classList.add('coaching');
    drawCoach(); clearInterval(coachTimer); coachTimer = setInterval(coachTick, 400);
  }
  function drawCoach() {
    var c = COACH[coachAt]; if (!c || !coachEl) return;
    coachEl.classList.remove('done');
    coachEl.querySelector('.coach-k').textContent = 'Practice · ' + c.k;
    coachEl.querySelector('.coach-n').textContent = c.start ? '' : coachAt + ' of ' + (COACH.length - 1);
    coachEl.querySelector('.coach-t').innerHTML = coachText(c.t);
    coachEl.querySelector('.coach-skip').hidden = !c.skip;
    coachEl.querySelector('.coach-finish').hidden = !c.end;
    coachEl.querySelector('.coach-start').hidden = !c.start;
    coachEl.querySelector('.coach-end').hidden = !!c.end;
    sizeCoach();
  }
  function sizeCoach() { if (coachEl) document.body.style.setProperty('--coach-h', coachEl.offsetHeight + 'px'); }
  function coachTick() {
    if (coachAt < 0 || !coachEl) return;
    if (!isPractice()) { stopCoach(); return; }
    // Out of the way while a panel or the tour is open.
    coachEl.hidden = !!document.querySelector('.overlay:not([hidden])') || document.body.classList.contains('touring') || document.body.classList.contains('handoff-open');
    var c = COACH[coachAt];
    ringTarget(c && !coachMoving && !coachEl.hidden ? c.target : null);
    if (coachMoving || !c || c.end || c.start || !c.done()) return;
    coachMoving = true; coachEl.classList.add('done');
    coachEl.querySelector('.coach-t').innerHTML = '✓ ' + coachText(c.t);
    setTimeout(function () { coachMoving = false; coachAt++; writeCoach(); drawCoach(); }, 1100);
  }
  // A ring around the thing to tap next (the first one of its list that is on screen).
  var ringed = null;
  function ringTarget(t) {
    var el = null;
    (Array.isArray(t) ? t : t ? [t] : []).some(function (sel) {
      var all = document.querySelectorAll(sel);
      for (var k = 0; k < all.length; k++) { var r = all[k].getBoundingClientRect(); if (r.width && r.height) { el = all[k]; return true; } }
      return false;
    });
    if (el === ringed) return;
    if (ringed) ringed.classList.remove('coach-target');
    ringed = el; if (el) el.classList.add('coach-target');
  }
  function writeCoach() { try { if (coachAt >= 0) localStorage.setItem(COACH_KEY, String(coachAt)); else localStorage.removeItem(COACH_KEY); } catch (e) { /* ignore */ } }
  function stopCoach() {
    coachAt = -1; writeCoach(); clearInterval(coachTimer); ringTarget(null);
    if (coachEl) coachEl.remove(); coachEl = null;
    document.body.classList.remove('coaching'); document.body.style.removeProperty('--coach-h');
  }
  function resumeCoach() { // the app was reopened in the middle of a guided practice
    var n = null; try { n = localStorage.getItem(COACH_KEY); } catch (e) { /* ignore */ }
    if (n !== null && isPractice() && COACH[+n]) startCoach(+n); else if (n !== null) { coachAt = -1; writeCoach(); }
  }
  // A practice handoff opened on this phone: a practice week too. This phone's own huddle is set aside.
  function loadPracticeHandoff(incoming) {
    var snap = isPractice() ? state.practiceSnapshot : JSON.parse(JSON.stringify(state));
    state = incoming; showBlank = {};
    state.loaded = { fileName: 'Practice handoff', ward: str(incoming.ward), date: str(incoming.date), count: state.rr.filter(rrShown).length, practice: true };
    state.practiceSnapshot = snap;
    resetView(); renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast('Practice handoff loaded. When you’re done, remove the practice week and your own huddle comes back.', 8000);
  }
  function removePractice() {
    stopCoach();
    var snap = state.practiceSnapshot;
    state = normalizeState(snap || null); state.loaded = null; state.practiceSnapshot = null;
    resetView(); renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast('Practice week removed. Your own names are back the way they were.');
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
    (Array.isArray(fd.items) ? fd.items : []).forEach(function (x) {
      if (!x || !str(x.task).trim()) return;
      items.push({ source: SOURCE.fn, group: 'fn', pname: '', ord: '', need: '', hneed: '', sac: false, bap: '', temple: false, committed: false,
        person: '', action: str(x.task).trim(), assigned: '', when: str(x.when).trim(), done: !!x.doneMid });
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
        if (n && names.every(function (x) { return norm(x) !== norm(n); })) { names.push(n); info[norm(n)] = { ordinance: str(a.ordinance).trim(), need: str(a.need).trim(), hneed: str(a.hneed).trim(), bap: str(a.bap), temple: !!a.temple, committed: !!a.committed, sac: !!a.sac, touched: parseISO(str(a.touched)) ? str(a.touched) : '' }; }
      });
      if (!names.length) return;
      var cur = state.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      names.forEach(function (n) {
        if (cur.some(function (a) { return norm(a.name) === norm(n); })) return;
        var c = blankAction(); c.name = n; c.ordinance = info[norm(n)].ordinance; c.need = info[norm(n)].need; c.hneed = info[norm(n)].hneed; c.carried = true; c.touched = info[norm(n)].touched; c.lastSac = info[norm(n)].sac;
        if (g.id === 'nm') { c.bap = info[norm(n)].bap; c.temple = info[norm(n)].temple; }
        if (g.id === 'bt') { c.bap = info[norm(n)].bap; c.committed = info[norm(n)].committed; }
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
      var c = blankName(); c.name = n; c.ordinance = str(a.ordinance).trim(); c.need = str(a.need).trim(); c.hneed = str(a.hneed).trim(); c.carried = true; c.lastSac = !!a.sac;
      c.touched = parseISO(str(a.touched)) ? str(a.touched) : '';
      state.tn[slot] = c;
      added++;
    });
    return added;
  }

  function groupOf(r) {
    if (r.group) return r.group;
    return { 'New members': 'nm', 'Returning members': 'rm', 'Those being taught': 'bt', 'Three Names': 'tn', '3 Names': 'tn', 'Name Next Ordinance': 'tn', 'Finding new people': 'fn' }[r.source] || '';
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
      var fl = state.find.items;
      if (!fl.some(function (x) { return norm(x.task) === norm(item.action); })) {
        if (fl.length === 1 && !assignHasText(fl[0])) fl.pop();
        fl.push({ task: item.action, when: '', carried: true });
        undo = { g: 'fn', kind: 'new', action: item.action };
      } else undo = { g: 'fn', kind: 'none' };
      renderFN();
    } else if (g === 'tn') {
      var slot = state.tn.findIndex(function (n) { return name && norm(n.name) === norm(name); });
      if (slot < 0) slot = state.tn.findIndex(function (n) { return !n.sac && !hasText(n, CARD_KEYS); });
      if (slot < 0) { toast('All three focus names are already filled.'); return; }
      var mt = mergeAction(state.tn[slot], item, ['name', 'ordinance', 'need', 'hneed', 'action', 'assigned']);
      undo = { g: 'tn', kind: 'fill', name: name, filled: mt.filled, appended: mt.appended };
      renderTN();
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
      ask({ title: 'Nothing to load', body: 'Last week’s agenda doesn’t have any action items filled in.', primary: 'OK' });
      return;
    }
    state.rr = items.map(function (it) { return rrFromItem(it, ''); });
    state.loaded = { fileName: fileName, ward: str(data.ward), date: str(data.date), count: items.length, practice: !!opts.practice };
    state.practiceSnapshot = snap;
    if (!opts.practice && !state.ward.trim() && data.ward) { state.ward = str(data.ward); $('#ward').value = state.ward; writeWard(state.ward); }
    var carried = carryNames(data);
    if (opts.practice) state.referrals = cleanReferrals(data.referrals);
    renderRR(); renderCP(); renderTN(); renderMR(); saveDraft();
    toast(opts.practice ? 'Practice week loaded: sample names, with ' + items.length + ' sample assignments in Return and Report.'
      : 'Loaded ' + items.length + (items.length === 1 ? ' action item' : ' action items') +
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
        title: 'This PDF can’t be loaded',
        body: 'It wasn’t made with Huddle. Choose the PDF named “Huddle - [Ward] - [Date]” from your last huddle.',
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
      var title = wardMismatch ? 'This agenda is from a different ward'
        : future ? 'This agenda is dated after this meeting'
        : 'This agenda is more than two weeks old';
      var rows = [['Agenda ward', str(data.ward) || 'Not listed']];
      if (formWard) rows.push(['This form', formWard]);
      rows.push(['Agenda date', shortDate(data.date) || 'Not listed']);
      ask({
        title: title, compare: rows,
        body: 'Make sure you picked your ward’s agenda from last week before loading it.',
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
        body: 'This browser isn’t letting the page save anything (private browsing can do this). You can still load last week’s PDF from a file.',
        primary: 'Load from a file', onPrimary: pickFile,
        secondary: 'Cancel'
      });
      return;
    }
    if (!list.length) {
      ask({
        title: 'No saved agendas yet',
        body: 'Each agenda you send or save is kept on this phone for 4 weeks. First time? Try a practice week with sample names to see how Load last week works. If last week’s PDF is in your email or Files, choose Load from a file.',
        primary: 'Try a practice week', onPrimary: startPractice,
        secondary: 'Load from a file', onSecondary: pickFile
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
          h('span', { class: 'agenda-row-sub', text: 'Sample names · 7 action items · can’t be sent or saved' })
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
            h('span', { class: 'agenda-row-sub', text: (r.ward || 'Ward not listed') + ' · ' + n + (n === 1 ? ' action item' : ' action items') }),
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
    var IN = 11;                              // a block's text sits this far in from its color bar
    var LBL = 80;                             // room for the small labels ("Next ordinance")
    var FS = 12, LH = 15.5, MS = 10, MLH = 13; // the value text, and the smaller gray lines under it
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
      rows.forEach(function (r) {
        if (y + r.h > H - BOTTOM) newPage();
        if (r.space && !r.bar && y === TOP) return; // no empty gap at the top of a page
        if (r.bar) box(L, y, 2.5, r.h + 0.3, { color: r.bar });
        if (r.draw) r.draw(y);
        y += r.h;
      });
    }
    // A thin bar in the list's color runs down the left of a block and shows which list it belongs to.
    function barred(rows, color) { rows.forEach(function (r) { r.bar = color; }); return rows; }
    function rule() { return line(7, function (top) { hline(L, R, top + 3.5, C.line, 0.6); }); }
    function block(rows, color) { put(barred([space(3)].concat(rows, [space(3)]), color).concat([rule()])); }

    // A slim band groups the sections: from the last huddle (looking back) and this huddle's plan (looking ahead).
    function band(label, sub, gap) {
      lead.push(space(gap === undefined ? 18 : gap));
      lead.push(line(22, function (top) {
        box(L, top, R - L, 22, { color: C.navy });
        var e = tx(L + IN, top + 14.8, label, F.bold, 9.5, C.white);
        if (sub && e + 8 + width(sub, F.ital, 9.5) <= R - IN) tx(e + 8, top + 14.8, sub, F.ital, 9.5, rgb(0.82, 0.87, 0.94));
      }));
    }
    function heading(label, note) {
      lead.push(space(14));
      lead.push(line(30, function (top) {
        var e = tx(L, top + 13, label, F.bold, 13.5, C.blue);
        if (note && e + 7 + width(note, F.ital, 9.5) <= R) tx(e + 7, top + 13, note, F.ital, 9.5, C.gray);
        hline(L, R, top + 20.5, C.line, 0.8);
      }));
    }
    function groupLabel(title, gid) {
      var gc = GROUP_PDF[gid];
      lead.push(line(26, function (top) {
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
      var rows = textLines(has ? text : missing, !has ? F.ital : plain ? F.reg : F.bold, plain ? 12.5 : 13.5, has ? C.dark : C.gray, plain ? 16 : 17.5, 13, R - L - IN - (rightW ? rightW + 10 : 0));
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
      if (rows.length) rows.push(space(4));
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
      if (a.sac) tags.push({ text: 'Attended sacrament meeting', color: STATUS_PDF.Yes, check: true });
      var ord = ordOf(a, gid), need = str(a.need).trim(), act = str(a.action).trim(), note = str(a.hneed).trim();
      var who = [str(a.assigned).trim(), whenShow(a.when)].filter(Boolean).join(' · ');
      var rows = titleLines(name, 'No name').concat(tagLines(tags), [space(5)]);
      if (ord) rows = rows.concat(field('Next ordinance', ord));
      if (need) rows = rows.concat(field('Needs', need));
      rows = rows.concat(field('Action item', act || 'None yet', [{ text: who }, { text: a.actionCarried && act ? carriedText(s) : '', ital: true }], !act));
      if (note) rows = rows.concat(field('Huddle notes', note));
      block(rows, GROUP_PDF[gid].ink);
    }

    /* ----- page 1 header ----- */
    newPage();
    // Privacy reminder for everyone who receives the huddle report.
    var sx = tx(L, 30, 'Keep this PDF secure', F.bold, 8.5, C.hudInk);
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

    /* ----- Return and Report ----- */
    band(fromLabel(s).toUpperCase(), 'Did it happen?', 14);
    heading('Return and Report');
    var rrItems = s.rr.filter(function (r) { return r.prefilled || rrHasInput(r); });
    if (!rrItems.length) emptyRow('Nothing to report from the last huddle.');
    rrItems.forEach(function (r) {
      var gid = r.prefilled ? groupOf(r) : '';
      var name = gid === 'fn' ? 'Finding new people' : r.prefilled ? (str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim()) : '';
      var who = [str(r.assigned).trim(), whenShow(r.when)].filter(Boolean).join(' · ');
      var action = r.prefilled ? str(r.action).trim() : str(r.plan).trim();
      var notes = str(r.notes).trim(), note = str(r.hneed).trim();
      var fwd = r.carriedFwd ? 'Carried forward to ' + (monthDay(s.date) ? 'the ' + monthDay(s.date) + ' plan' : 'this plan') : '';
      // Did it happen? Yes, Partly or No in its color at the right of the name.
      var status = STATUS_PDF[r.happened] ? r.happened : '';
      var sw = width(status || 'Not marked', F.bold, 9.5) + (status ? 16 : 0);
      var rows = titleLines(name || action, 'No action item written', sw, function (top) {
        if (!status) { tx(R - sw, top + 12.3, 'Not marked', F.bold, 9.5, C.faint); return; }
        rbox(R - sw, top + 1, sw, 16, 8, STATUS_FILL[status]);
        tx(R - sw + 8, top + 12.3, status, F.bold, 9.5, STATUS_PDF[status]);
      }, !name);
      if (gid && gid !== 'fn') rows = rows.concat(tagLines([{ text: SOURCE[gid], color: GROUP_PDF[gid].ink }]));
      rows.push(space(5));
      if (name) rows = rows.concat(field('Action item', action || 'No action item written', [{ text: who }], !action));
      else if (who) rows = rows.concat(field('Assigned to', who));
      rows = rows.concat(field(notes ? 'Notes' : '', notes, [{ text: fwd, ital: true }]));
      if (note) rows = rows.concat(field('Huddle notes', note));
      block(rows, gid && GROUP_PDF[gid] ? GROUP_PDF[gid].ink : C.faint);
    });

    /* ----- Covenant Path Report Review ----- */
    band(monthDay(s.date) ? monthDay(s.date).toUpperCase() + ' HUDDLE PLAN' : 'THIS HUDDLE’S PLAN');
    heading('Covenant Path Report Review');
    GROUPS.forEach(function (g) {
      groupLabel(g.title, g.id);
      var filled = s.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      if (!filled.length) emptyRow(noneConfirmed(g.id, s) ? 'No one on the Covenant Path Report this week' : 'Not reviewed');
      filled.forEach(function (a) { cardBlock(a, g.id); });
    });

    /* ----- Name Next Ordinance ----- */
    heading('Name Next Ordinance', 'Ward council focus names');
    var tnItems = s.tn.filter(function (n) { return n.sac || hasText(n, CARD_KEYS); });
    if (!tnItems.length) emptyRow('None this week');
    tnItems.forEach(function (n) { cardBlock(n, 'tn'); });

    /* ----- Plans to find new people to teach ----- */
    heading('Plans to Find New People to Teach');
    var fPlan = str(s.find.plan).trim();
    var fItems = s.find.items.filter(assignHasText);
    if (!fPlan && !fItems.length) emptyRow('None this week');
    if (fPlan) block(field('Plan', fPlan), GROUP_PDF.fn.ink);
    if (fPlan && !fItems.length) block(field('Assignment', 'No assignments yet', null, true), GROUP_PDF.fn.ink);
    fItems.forEach(function (x) {
      var t = str(x.task).trim();
      block(field('Assignment', t || '—', [{ text: whenShow(x.when) }, { text: x.carried && t ? carriedText(s) : '', ital: true }]), GROUP_PDF.fn.ink);
    });

    /* ----- Missionary referrals ----- */
    var refs = cleanReferrals(s.referrals);
    heading('Missionary Referrals');
    // With no referrals, the section prints "None listed" only where there's room: it never starts a page by itself.
    if (!refs.length) {
      if (y + 44 + 26 <= H - BOTTOM) emptyRow('None listed'); else lead = [];
    }
    refs.forEach(function (x) {
      var rows = titleLines(str(x.name).trim(), 'No name').concat([space(5)], field('Referred by', str(x.by).trim()), field('Notes', str(x.notes).trim()));
      block(rows, GROUP_PDF.mr.ink);
    });

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
              group: r.group || '', pname: r.pname || '', ord: r.ord || '', need: r.need || '', hneed: r.hneed || '', sac: !!r.sac, bap: r.bap || '', temple: !!r.temple, committed: !!r.committed, carriedFwd: !!r.carriedFwd, carryUndo: r.carryUndo || null }
          : { plan: r.plan, happened: r.happened, notes: r.notes };
      }),
      cpDone: s.cpDone, cp: s.cp, cpNone: s.cpNone, tnDone: s.tnDone, tn: s.tn, ftDone: s.ftDone,
      find: { plan: str(s.find.plan), items: s.find.items.map(function (x) { return { task: str(x.task), when: str(x.when), carried: !!x.carried }; }) },
      referrals: cleanReferrals(s.referrals)
    }));
  }

  /* ---------- Send (the agenda stays filled in) ---------- */
  var sendFile = null, sendPayload = null, resending = false;
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);

  /* ---------- How to use ---------- */
  // Flags remember only that someone has seen a message on this device; no agenda data.
  var HELP_KEY = 'huddle-help-seen', NAMES_HINT_KEY = 'huddle-names-hint-seen';
  function readFlag(k) { try { var s = getStore('localStorage'); return !!(s && s.getItem(k)); } catch (e) { return false; } }
  function writeFlag(k) { try { var s = getStore('localStorage'); if (s) s.setItem(k, '1'); } catch (e) { /* ignore */ } }
  function openHelp() {
    // How to use always opens as the short list of steps. Adding Huddle to the Home Screen is done once, so it
    // sits apart from the weekly steps: in a phone's browser it starts open, since that is the thing to do next,
    // and from the Home Screen app it says it's already done.
    Array.prototype.forEach.call(document.querySelectorAll('#help-sheet details'), function (d) { d.open = false; });
    var install = $('#help-install'), installed = isStandalone();
    if (install && (isIOS || isAndroid) && !installed) install.open = true;
    var installNote = $('#help-install-status');
    if (installNote) installNote.textContent = installed ? 'Already done on this phone' : 'Do this once, before you start';
    openOverlay('#help-sheet', '#help-title');
    var sheet = $('#help-sheet .sheet'); if (sheet) sheet.scrollTop = 0;
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

  var SHARE_HINT = 'Only share via email or text message. Do not share through any other app.';
  function resetSendSheet() {
    sendFile = null; sendPayload = null;
    $('#send-title').textContent = resending ? 'Share this huddle report again' : 'Send this huddle report';
    $('#share-btn').disabled = true; $('#share-btn').textContent = 'Share PDF';
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
      ask({ title: 'Add your ward name first', body: 'The ward name goes on the PDF.', primary: 'Add the ward', onPrimary: function () { setTimeout(function () { openOverlay('#ward-sheet', '#ward'); }, 50); }, secondary: 'Cancel' });
      return false;
    }
    if (!parseISO(state.date)) {
      ask({ title: 'The huddle date is missing', body: 'Close the app, open it again, and tap Send. It’s dated today automatically.', primary: 'OK', onPrimary: function () { window.scrollTo(0, 0); } });
      return false;
    }
    // Report-backs from the last huddle count as something to send, even if every name has since been removed.
    if (isEmpty(state) && !state.rr.some(function (r) { return r.prefilled; })) {
      ask({ title: 'Nothing to ' + verb + ' yet', body: 'Add names under Ward council first.', primary: 'OK' });
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
    $('#send-status').textContent = 'Making your PDF…';
    openOverlay('#send-sheet', '#send-title');
    try {
      var out = await buildPdf(agenda, { sample: sample });
      sendFile = new File([out.bytes], name, { type: 'application/pdf' });
      sendPayload = out.payload;
      $('#send-status').textContent = out.pages + (out.pages === 1 ? ' page' : ' pages') + ' · locked so it can’t be edited';
      if (!canShareFiles(sendFile)) {
        // No share menu for files here (some desktop browsers): download instead.
        $('#share-hint').textContent = 'Saves the PDF to your Downloads. Attach it to an email or text message.';
        $('#share-btn').textContent = 'Download PDF';
      }
      $('#share-btn').disabled = false;
    } catch (err) {
      console.error(err);
      $('#send-status').textContent = 'Couldn’t make the PDF. Close this and try again.';
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
    coachMark('sent');
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
    datesForWhens(); renderCP(); renderTN(); renderFN(); resumeCoach();
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
          var pav = phd.querySelector('.avatar'), pin = initials(pca.name); pav.textContent = pin || '+'; pav.classList.toggle('is-blank', !pin);
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
      var tm = /^((?:cp\.\w+|tn)\.\d+\.)(name|action|assigned|when)$/.exec(path);
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
      if (e.target.id === 'ward-sheet') { closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); }
      if (e.target.id === 'sample-sheet') closeOverlay('#sample-sheet');
      if (e.target.id === 'confirm-sheet' && askSecondary) askSecondary();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var top = ['#confirm-sheet', '#sample-sheet', '#handoff-sheet', '#install-sheet', '#help-sheet', '#tips-sheet', '#find-tips-sheet', '#howhelp-sheet', '#ward-sheet', '#slides-sheet', '#send-sheet'].filter(function (id) { return !$(id).hidden; })[0];
      if (top) dismissSheet(top);
    });
    enableSwipeDown();

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

    // Instructions: open on the first visit on this device, or when the link ends in #help.
    // First visit on a device: in a phone's browser, How to use opens (it starts with Add to Home Screen).
    // Everywhere else, including the Home Screen app, the guided tour starts once.
    if (location.hash === '#help') openHelp();
    else if (location.hash === '#tour') startPractice();
    else if (!navigator.webdriver && !handoffPending) { // a handoff link comes first; the instructions wait for the next visit
      var phoneBrowser = (isIOS || isAndroid) && !isStandalone();
      if (phoneBrowser) { if (!readFlag(HELP_KEY)) openHelp(); }
      else if (!readFlag(GUIDE_OFFERED_KEY) && !isPractice()) { // the first time from the Home Screen: offer the guided tour once
        writeFlag(GUIDE_OFFERED_KEY);
        ask({ title: 'Welcome to Huddle', body: 'Take the guided tour? You practice one week with sample names, step by step. It takes about 5 minutes. Anything already on this phone is set aside and comes back at the end.',
          primary: 'Start the tour', onPrimary: startPractice, secondary: 'Not now' });
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
      if (e.key === 'Enter' && e.target && e.target.id === 'ward') { e.preventDefault(); closeOverlay('#ward-sheet'); renderDoors(); renderSteps(); }
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
