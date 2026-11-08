/* Weekly Coordination Meeting Agenda
 * Everything runs on the device. Nothing is sent to a server.
 * - The agenda stays filled in on this phone (localStorage) from week to week. Send shares the PDF
 *   without clearing it; "Start a new agenda" moves last week's actions into Return and Report.
 *   Names not touched in 5 weeks are removed, so nothing stays longer than the saved copies do.
 * - The ward name is remembered on this device (localStorage) for convenience.
 * - Send builds a flattened PDF with pdf-lib and hands it to the phone's share menu.
 *   A copy of the form data is tucked into the PDF so "Load last week" can read it back.
 */
'use strict';
(function () {
  var APP_ID = 'huddle-agenda';
  var DATA_VERSION = 1;
  var DRAFT_KEY = 'huddle-draft-v1', LIVE_KEY = 'huddle-agenda-v1';
  var STALE_FLAG = 28, STALE_DROP = 35; // days: ask after 4 weeks untouched, remove after 5
  var WARD_KEY = 'huddle-ward';
  var DOC_TITLE = 'Weekly Coordination Meeting Agenda';
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
      find: blankFind(),
      practiceSnapshot: null,
      sentAt: '', sentSig: '', rolledFrom: '',
      ftDone: false
    };
  }
  function cleanList(list, maker, keys) {
    if (!Array.isArray(list)) return [maker()];
    var out = list.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      var o = maker();
      keys.forEach(function (k) { o[k] = str(x[k]); });
      o.sac = !!x.sac; o.temple = !!x.temple; o.committed = !!x.committed; o.actionCarried = !!x.actionCarried; o.texted = !!x.texted;
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
    f.sentAt = str(s.sentAt); f.sentSig = str(s.sentSig); f.rolledFrom = parseISO(str(s.rolledFrom)) ? str(s.rolledFrom) : '';
    // Lists marked Done stay folded only within the draft; a saved agenda always opens fully.
    var sd = s.stepsDone && typeof s.stepsDone === 'object' ? s.stepsDone : {};
    ['rr', 'cp', 'tn', 'fn'].forEach(function (k) { if (sd[k] === true) f.stepsDone[k] = true; });
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
  function rrHasInput(r) { return !!r.happened || hasText(r, ['plan', 'notes']); }
  function isEmpty(s) {
    if (s.attendees.length || s.cpDone || s.tnDone || s.ftDone || s.loaded) return false;
    if (GROUPS.some(function (g) { return s.cpNone && s.cpNone[g.id]; })) return false;
    if (s.rr.some(rrHasInput)) return false;
    if (GROUPS.some(function (g) { return s.cp[g.id].some(function (a) { return a.sac || hasText(a, CARD_KEYS); }); })) return false;
    if (s.tn.some(function (n) { return n.sac || hasText(n, CARD_KEYS); })) return false;
    if (str(s.find.plan).trim() || s.find.items.some(assignHasText)) return false;
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
    if (str(r.when).trim()) bits.push(r.when.trim());
    return bits.join(' · ');
  }

  function renderRR() {
    var list = $('#rr-list');
    $('#rr-foot').hidden = folded('rr');
    if (folded('rr')) { list.replaceChildren(foldedRR()); renderLoadState(); return; }
    var many = state.rr.length > 1;
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
          gid ? h('span', { class: 'group-tag', text: SOURCE[gid] }) : null,
          // Name and next ordinance share a line; a long name pushes the tag to the next line.
          ordTag ? h('div', { class: 'person-line' }, [ordTag]) : null,
          facts.length ? h('div', { class: 'facts' }, facts) : null,
          h('p', { class: 'prefill-action' }, [h('span', { class: 'prefill-k', text: 'Action: ' }), str(r.action).trim() || 'No action item was written.']),
          meta ? h('p', { class: 'prefill-meta', text: meta }) : null
        ]);
      } else {
        body = field('Last week’s plan', 'rr.' + i + '.plan', { placeholder: 'What did we plan to do?' });
      }
      var seg = h('div', {}, [
        h('p', { class: 'seg-label', text: 'Happened?' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Did item ' + (i + 1) + ' happen?' }, ['Yes', 'Partly', 'No'].map(function (v) {
          return h('button', { type: 'button', 'data-action': 'happened', 'data-a': i, 'data-b': v, 'aria-pressed': r.happened === v ? 'true' : 'false', text: v });
        }))
      ]);
      var carry = null;
      if (r.prefilled && r.carriedFwd) {
        carry = h('div', { class: 'carried-row' }, [
          h('p', { class: 'carried-note', text: '✓ Added to this week’s plan' }),
          h('button', { type: 'button', class: 'btn-undo', 'data-action': 'undo-carry', 'data-a': i, 'aria-label': 'Undo carry forward' }, ['Undo'])
        ]);
      } else if (r.prefilled && (r.happened === 'Partly' || r.happened === 'No') && groupOf(r)) {
        {
          carry = h('button', { type: 'button', class: 'btn-outline full btn-carry', 'data-action': 'carry-fwd', 'data-a': i, text: 'Carry forward to this week' });
        }
      }
      return h('div', { class: 'card rr-card' + (gid ? ' g-' + gid : ''), 'data-status': statusOf(r.happened) }, [head, body,
        // Happened? and the notes stay together so the tour can point at them.
        h('div', { class: 'rr-answer' }, [seg, carry, field('Notes for ward council', 'rr.' + i + '.notes', { placeholder: 'Optional' })])]);
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
  var CARRIED_TEXT = 'Carried over from last week';
  function carriedTag() { return h('span', { class: 'source carried-tag', text: CARRIED_TEXT }); }
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
    return ['Your assignment from the ' + (ward ? ward + ' ' : '') + 'coordination huddle:',
      who ? 'For: ' + who : null, 'What: ' + act, when ? 'When: ' + when : null,
      'Please report back. Thank you!'].filter(Boolean).join('\n');
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
  function textAssignment(base) {
    if (tourDemo || (state.loaded && state.loaded.practice)) { toast('Texting is turned off for sample names.'); return; }
    if (!textReady(base)) return;
    openMessages(assignmentText(base));
    setPath(base + 'texted', true); refreshTextButton(base); saveDraft();
  }
  function cardFields(base, nameLabel, namePh, whenPh, tag, withBap, needPh, ordPh, wcExtra, fixedOrd) {
    var hneedVal = str(getPath(base + 'hneed')).trim();
    var hneedField = field('Huddle notes', base + 'hneed', { full: true, multi: true, placeholder: 'Anything to relay back to ward council' });
    if (!hneedVal) hneedField.hidden = true;
    var hneedLink = h('button', { type: 'button', class: 'link-add', 'data-action': 'add-hneed', hidden: !!hneedVal }, ['+ Add a note for ward council']);
    return h('div', { class: 'card-zones' }, [
      wcExtra || null,
      h('div', { class: 'card-zone zone-wc-wrap' }, [
        tag ? h('div', { class: 'zone-label-row' }, [zoneLabel('wc', 'Ward Council · Who & What'), tag]) : zoneLabel('wc', 'Ward Council · Who & What'),
        h('div', { class: 'card-grid' }, [
          withBap ? field(withBap, base + 'bap', { type: 'date', full: true }) : null,
          fixedOrd ? h('div', { class: 'field full' }, ['Next ordinance', h('p', { class: 'fixed-value', text: fixedOrd })])
            : field('Next ordinance', base + 'ordinance', { placeholder: ordPh || 'e.g. Baptism', full: true }),
          field('Needs', base + 'need', { full: true, multi: true, placeholder: needPh || 'e.g. A ride to church' })
        ])
      ]),
      h('div', { class: 'card-zone zone-hd-wrap' }, [
        zoneLabel('hd', 'Huddle · How & When'),
        h('div', { class: 'card-grid' }, [
          field('Action item for this week', base + 'action', { full: true, multi: true, rows: '3', placeholder: 'What might you do to assist them in being worthy and prepared for their next ordinance?',
            tag: getPath(base + 'actionCarried') && str(getPath(base + 'action')).trim() ? carriedTag() : null }),
          // Assigned to gets the wider share of its row; When is usually a day or two words.
          h('div', { class: 'assign-row' }, [
            field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
            field('When', base + 'when', { placeholder: whenPh })
          ]),
          h('div', { class: 'assign-actions' }, [textAssignButton(base), completedButton(base)]),
          hneedField
        ]),
        hneedLink
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
    if (d) rf.textContent = (state.loaded && state.loaded.practice ? 'Practice week: from the ' : 'From the ') + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' huddle';
  }
  function renderLoadState() {
    renderRRFrom();
    // Once the agenda has anything in it, the weekly button is Start a new agenda; Load stays for someone else's agenda.
    var practice = !!(state.loaded && state.loaded.practice);
    var live = !isEmpty(state) && !practice;
    var nw = $('#newweek-panel');
    if (nw) {
      nw.hidden = !live;
    }
    // Once the huddle date has passed, a nudge by the date points to next week.
    var nudge = $('#date-nudge');
    if (nudge) {
      var d = parseISO(state.date), due = live && d && d < parseISO(todayISO());
      nudge.hidden = !due;
      if (due) nudge.textContent = 'The ' + monthDay(state.date) + ' huddle has passed. Tap the date, or here, to start next week.';
    }
    $('#load-panel').hidden = !!state.loaded || live;
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
      h('span', { class: 'list-title' }, [h('span', { class: 'fold-check', 'aria-hidden': 'true' }, [icon('check')]), ' Last week’s items']),
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
        h('span', { class: 'list-count', text: ok ? 'None this week' : countText(0) })
      ]), body, foot]);
  }
  function renderCP() {
    var wrap = $('#cp-groups');
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
        h('span', { class: 'list-count', text: countText(named) })
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
          cardFields(base, 'Name', 'From the Covenant Path Report', 'e.g. Tue', it.carried ? h('span', { class: 'source', text: 'From last week' }) : null, g.id === 'nm' ? 'Baptism date' : g.id === 'bt' ? 'Scheduled baptismal date' : '', 'Identify a need from the Covenant Path Report', '',
            g.id === 'nm' ? templeBox(base, i, it) : g.id === 'bt' ? committedBox(base, it) : null, FIXED_ORD[g.id]),
          g.id === 'bt' ? h('button', { type: 'button', class: 'btn-convert', 'data-action': 'convert-nm', 'data-a': i }, ['Convert to new member']) : null
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
      body: 'Everything on this card moves with them, including the baptism date. The 30-day temple count starts from that date.',
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
        renderCP(); saveDraft();
        var cards = document.querySelectorAll('[data-group="nm"] .card');
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
      var box = document.querySelector('[data-group="nm"] [data-temple="' + i + '"]');
      if (box) {
        box.classList.toggle('is-done', st.done);
        box.querySelector('.temple-sub').textContent = st.done ? '✓ Baptisms for the dead done' : st.text;
      }
    });
  }
  function renderTN() {
    var wrap = $('#tn-list');
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
      cardFields(base, 'Focus name', 'Focus name', 'e.g. Sun', n.carried ? h('span', { class: 'source', text: 'From last week' }) : null, '', 'e.g. A ride to the temple', 'e.g. Sacrament')
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
          field('When', base + 'when', { placeholder: 'e.g. Sat' })
        ]),
        completedButton(base)
      ]);
    });
    wrap.replaceChildren(h('section', { class: 'list-panel list-fn', 'aria-label': 'Plans to find new people to teach' }, [
      h('div', { class: 'card fn-card' }, [
        h('div', { class: 'card-grid' }, [field('Plan', 'find.plan', { full: true, multi: true, placeholder: 'What will the ward do this week to find new people to teach?' })]),
        h('p', { class: 'fn-assign-title', text: 'Assignments' })
      ].concat(rows).concat([h('div', { class: 'list-foot' }, [addButton('add-fn', '', 'Add assignment')])]))
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
      var plan = [str(it.action).trim(), str(it.assigned).trim() ? str(it.assigned).trim() : '', str(it.when).trim()].filter(Boolean).join(' · ');
      return foldButton(gid, x.i, it.name.trim(), [
        h('span', { class: 'fold-line' }, [h('span', { class: 'fold-name', text: it.name.trim() }), tag, it.actionCarried && str(it.action).trim() ? h('span', { class: 'fold-tag carried', text: 'Carried over' }) : null]),
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
    renderAttendees(); renderRR(); renderCP(); renderTN(); renderFN();
    detailsOpen = false; // Huddle Details start closed; tap the box to open them.
    renderDetails(); renderSteps(); renderSent();
  }

  /* ---------- Four steps: the agenda opens as a short checklist ---------- */
  // Return and Report, Covenant Path Report Review, Name Next Ordinance, Find New People to Teach.
  // Tap a section to open just that part; "Mark section done" gives it a green check.
  var STEPS = [
    { id: 'rr', title: 'Return and Report', band: 'last' },
    { id: 'cp', title: 'Covenant Path Report Review', band: 'this' },
    { id: 'tn', title: 'Name Next Ordinance', band: 'this' },
    { id: 'fn', title: 'Find New People to Teach', band: 'this' }
  ];
  var VIEW_ALL_KEY = 'huddle-view-all';
  var stepsOn = !readFlag(VIEW_ALL_KEY);
  var view = 'home';
  var detailsOpen = false;
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function stepStatus(id) {
    if (id === 'rr') {
      var items = state.rr.filter(rrShown), n = items.length;
      if (!n) return { text: state.loaded || state.rolledFrom ? 'Nothing to report from last week' : isEmpty(state) ? 'Load last week to fill this in' : 'Fills in when you start next week’s agenda' };
      var marked = items.filter(function (r) { return r.happened; }).length;
      var carried = items.filter(function (r) { return r.carriedFwd; }).length;
      return { text: plural(n, 'item', 'items') + ' · ' + (marked === n ? 'all marked' : marked + ' of ' + n + ' marked') + (carried ? ' · ' + carried + ' carried forward' : ''), warn: marked < n };
    }
    if (id === 'cp' || id === 'tn') {
      var list = id === 'tn' ? state.tn : GROUPS.reduce(function (a, g) { return a.concat(state.cp[g.id]); }, []);
      var named = list.filter(function (a) { return str(a.name).trim(); });
      var missing = named.filter(function (a) { return !str(a.action).trim(); }).length;
      if (!named.length) return { text: id === 'cp' && GROUPS.every(function (g) { return noneConfirmed(g.id); }) ? 'No one on the report this week' : 'No names yet' };
      var lead = id === 'tn' ? named.length + ' of 3 focus names' : plural(named.length, 'person', 'people');
      return { text: lead + ' · ' + (missing ? missing + (missing === 1 ? ' needs' : ' need') + ' an action' : 'everyone has a plan'), warn: missing > 0 };
    }
    var plan = str(state.find.plan).trim(), k = state.find.items.filter(function (x) { return str(x.task).trim(); }).length;
    if (!plan && !k) return { text: 'Not started' };
    return { text: (plan ? 'Plan written' : 'No plan yet') + ' · ' + plural(k, 'assignment', 'assignments'), warn: !plan || !k };
  }
  // Sections open in any order; a finished one gets a green check.
  function renderSteps() {
    if (!$('#steps-home')) return;
    var row = function (st) {
      var isDone = !!state.stepsDone[st.id], status = stepStatus(st.id);
      var num = h('span', { class: 'step-num', 'aria-hidden': 'true' });
      if (isDone) num.appendChild(icon('check'));
      return h('li', {}, [h('button', { type: 'button', class: 'step-row' + (isDone ? ' done' : ''), 'data-action': 'open-step', 'data-a': st.id,
        'aria-label': st.title + (isDone ? ', done' : '') + '. ' + status.text }, [
        num,
        h('span', { class: 'step-text' }, [
          h('span', { class: 'step-title', text: st.title }),
          h('span', { class: 'step-status' + (status.warn ? ' warn' : ''), text: status.text })
        ]),
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
  function applyView() {
    var all = !stepsOn;
    document.body.classList.toggle('steps-on', !all);
    document.body.setAttribute('data-view', all ? 'all' : view);
    var home = all || view === 'home';
    // Load last week sits on the home screen, above the meeting details and the four sections.
    $('header.top').hidden = !home; $('.start-here').hidden = !home; $('.fine-notes').hidden = !home;
    $('#steps-home').hidden = all || view !== 'home';
    $('#step-bar').hidden = all || home; $('#step-foot').hidden = all || home;
    // Save and Send live on the home screen, where all four sections come together; inside a section they're hidden.
    var bar = $('.actionbar'); if (bar) bar.hidden = !all && !home;
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (el) { el.hidden = !all && el.getAttribute('data-step') !== view; });
    Array.prototype.forEach.call(document.querySelectorAll('.week-band'), function (el) { el.hidden = !all; });
    renderDetails(); renderSteps();
  }
  // mode: 'push' adds a history entry (so Back returns to the list), 'replace' swaps it, otherwise no history change.
  function showView(v, mode) {
    if (!stepsOn) v = 'home';
    view = v;
    try {
      if (mode === 'push') history.pushState({ hv: v }, '');
      else if (mode === 'replace') history.replaceState({ hv: v }, '');
    } catch (e) { /* ignore */ }
    applyView();
    window.scrollTo(0, 0);
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
    var n = state.attendees.length;
    // Attendance shows in the same dark orange as other steps that still need action, until it's taken.
    $('#details-sub').replaceChildren(conductingLabel(state) ? conductingLabel(state) + ' · ' : '', n ? n + ' attended' : h('span', { class: 'warn', text: 'Attendance not taken yet' }));
  }
  function openDetails() { detailsOpen = true; if (view !== 'home') showView('home', 'replace'); renderDetails(); }
  window.HuddleView = {
    show: function (v, details) { detailsOpen = !!details; showView(v || 'home', 'replace'); },
    openDetails: openDetails,
    current: function () { return view; },
    reset: function () { setTourDemo(false); detailsOpen = false; showView('home', 'replace'); },
    tourDemo: function (on) { setTourDemo(on); },
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
    ask({ title: title, body: 'This card and everything typed on it will be removed from this week’s agenda.', primary: 'Remove', onPrimary: onYes, secondary: 'Keep it' });
  }
  var askSecondary = null;
  function ask(opts) {
    $('#confirm-title').textContent = opts.title;
    // A green check for good news; the amber warning for everything else.
    $('#confirm-sheet .warn-icon').hidden = !!opts.success;
    $('#confirm-sheet .ok-icon').hidden = !opts.success;
    $('#confirm-body').textContent = opts.body || '';
    $('#confirm-body').hidden = !opts.body;
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
    removeKey('sessionStorage', DRAFT_KEY); removeKey('localStorage', LIVE_KEY);
    if (!keepWard) { removeKey('localStorage', WARD_KEY); removeKey('localStorage', 'huddle-conducting'); }
    state = freshState(); showBlank = {};
    view = 'home';
    try { history.replaceState({ hv: 'home' }, ''); } catch (e) { /* ignore */ }
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
          setTimeout(function () { confirmUndoCarry(ri, 'Take it off this week’s plan too?'); }, 0);
        }
        Array.prototype.forEach.call(btn.parentNode.children, function (x) {
          x.setAttribute('aria-pressed', x.getAttribute('data-b') === r.happened ? 'true' : 'false');
        });
        var rc = btn.closest('.card'); if (rc) rc.setAttribute('data-status', statusOf(r.happened));
        if (r.prefilled) renderRR();
        saveDraft(); break;
      }
      case 'add-rr':
        state.rr.push(blankRR()); renderRR(); saveDraft();
        focusLast('#rr-list input[data-bind$=".plan"]'); break;
      case 'remove-rr': {
        var rrIdx = +a, rItem = state.rr[rrIdx];
        var doRemoveRR = function () {
          state.rr.splice(rrIdx, 1); delete state.openOne.rr;
          if (!state.rr.length) state.rr.push(blankRR());
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
        showBlank[a] = true; state.cpNone[a] = false; renderCP(); saveDraft();
        focusLast('[data-group="' + a + '"] input[data-bind$=".name"]'); break;
      case 'cp-none': state.cpNone[a] = true; showBlank[a] = false; renderCP(); saveDraft(); break;
      case 'cp-none-undo': state.cpNone[a] = false; renderCP(); saveDraft(); break;
      case 'add-cp':
        state.cp[a].push(blankAction()); renderCP(); saveDraft();
        focusLast('[data-group="' + a + '"] input[data-bind$=".name"]'); break;
      case 'convert-nm': convertToNewMember(+a); break;
      case 'list-done': listDone(a); break;
      case 'tour':
        closeHelp();
        if (window.HuddleTour) window.HuddleTour.start();
        break;
      case 'add-hneed': {
        var zone = btn.closest('.card-zone');
        var hf = zone && zone.querySelector('[data-bind$=".hneed"]');
        if (hf) { hf.closest('.field').hidden = false; btn.hidden = true; hf.focus(); }
        break;
      }
      case 'list-open': listOpen(a); break;
      case 'open-step': showView(a, 'push'); break;
      case 'steps-home': goHome(); break;
      case 'step-done': {
        var doneView = view;
        var finish = function () {
          state.stepsDone[doneView] = true; saveDraft(); goHome();
          var st = STEPS.filter(function (x) { return x.id === doneView; })[0];
          toast((st ? st.title : 'Section') + ' marked done.', 6000, { label: 'Undo', run: function () { delete state.stepsDone[doneView]; saveDraft(); } });
        };
        // Covenant Path Report Review: check the report in Tools was updated before checking it off.
        var hasPeople = GROUPS.some(function (g) { return countNamed(g.id) > 0; });
        if (doneView === 'cp' && !state.stepsDone.cp && hasPeople) {
          ask({
            title: 'Did you update the Covenant Path Report in Tools?',
            body: 'Update sacrament attendance, temple attendance and anything else that changed for the people in this section.',
            primary: 'Yes, mark done', onPrimary: finish,
            link: 'Open the Covenant Path Report',
            secondary: 'Not yet', onSecondary: function () { toast('Update it in Tools, then tap Mark section done.', 5000); }
          });
        } else finish();
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
      case 'open-details': openDetails(); var wf = $('#ward'); if (wf && !state.ward.trim()) wf.focus(); break;
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
          renderCP(); saveDraft();
        };
        if (cItem && (cItem.sac || cItem.temple || cItem.committed || hasText(cItem, CARD_KEYS))) {
          confirmRemove(str(cItem.name).trim() ? 'Remove ' + cItem.name.trim() + '?' : 'Remove this card?', doRemoveCP);
        } else doRemoveCP();
        break;
      }
      case 'load-other':
      case 'load': openOverlay('#load-sheet', '#load-title'); break;
      case 'paste-handoff': closeOverlay('#load-sheet'); pasteHandoff(); break;
      case 'handoff': startHandoff(); break;
      case 'carry-fwd': carryForward(+a); break;
      case 'text-assign': textAssignment(a); break;
      case 'toggle-completed': {
        var on = !getPath(a + 'doneMid');
        setPath(a + 'doneMid', on);
        if (!/^find/.test(a)) setPath(a + 'touched', todayISO());
        saveDraft(); refreshCompleted(a);
        if (on) toast('Marked completed. It will show as Yes in next week’s Return and Report.', 5000);
        break;
      }
      case 'stale-keep': setPath(a + 'touched', todayISO()); if (/^tn/.test(a)) renderTN(); else renderCP(); saveDraft(); toast('Kept. It won’t ask again for 4 weeks.'); break;
      case 'stale-remove': {
        var sp = a.split('.');
        if (sp[0] === 'tn') { state.tn[+sp[1]] = blankName(); renderTN(); }
        else { state.cp[sp[1]].splice(+sp[2], 1); if (!state.cp[sp[1]].length) { state.cp[sp[1]].push(blankAction()); showBlank[sp[1]] = false; } renderCP(); }
        saveDraft(); toast('Removed.');
        break;
      }
      case 'edit-date': openDetails(); setTimeout(function () { var df = $('#date'); if (df) df.focus(); }, 60); break;
      case 'new-agenda': confirmNewAgenda(); break;
      case 'next-week': askNewWeek(nextMeetingDate(state.date)); break;
      case 'undo-carry': confirmUndoCarry(+a); break;
      case 'conducting':
        state.conducting = state.conducting === a ? '' : a;
        renderConducting(); writeConducting(state); saveDraft();
        if (state.conducting === 'other') $('#conducting-other').focus();
        break;
      case 'open-agenda': {
        var orec = savedById[a];
        closeOverlay('#load-sheet');
        if (!orec) break;
        var doOpen = function () {
          state = normalizeState(orec.data); state.loaded = null;
          view = 'home'; renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
          toast('Opened the ' + shortDate(orec.date) + ' agenda. Make your changes, then send or save it again.');
        };
        if (!isEmpty(state)) {
          ask({ title: 'Replace what’s on the form?', body: 'Opening this agenda replaces everything you’ve entered on the form now.', primary: 'Open it', onPrimary: doOpen, secondary: 'Cancel' });
        } else doOpen();
        break;
      }
      case 'share-agenda': {
        var srec = savedById[a];
        closeOverlay('#load-sheet');
        if (srec) startSend(normalizeState(srec.data));
        break;
      }
      case 'pick-agenda': {
        var rec = savedById[a];
        closeOverlay('#load-sheet');
        if (rec) checkAndApply(rec.data, 'Saved on this phone · ' + shortDate(rec.date), openLoad);
        break;
      }
      case 'load-file': closeOverlay('#load-sheet'); pickFile(); break;
      case 'practice': ['#load-sheet', '#help-sheet'].forEach(function (id) { if (!$(id).hidden) closeOverlay(id); }); startPractice(); break;
      case 'close-load': closeOverlay('#load-sheet'); break;
      case 'delete-all':
        closeOverlay('#load-sheet');
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
        if (isEmpty(state)) { toast('The form is already clear.'); break; }
        ask({
          title: 'Clear the whole form?',
          body: 'Everything except the ward name will be erased. This can’t be undone.',
          primary: 'Clear form', onPrimary: function () { removeKey('localStorage', 'huddle-conducting'); clearForm(true); toast('Form cleared. The ward name is kept.'); },
          secondary: 'Cancel'
        });
        break;
      case 'send': startSend(); break;
      case 'share': sharePdf(); break;
      case 'save-only': saveWithoutSending(); break;
      case 'clear-now': closeSend(); sentDone(true); break;
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
        nm: [card({ name: 'Daniel Rivera', bap: isoShift(-12), ordinance: 'Temple baptisms', need: 'A ride to the temple', action: 'Invite him on the ward temple trip Saturday', assigned: 'Bro. Patel', when: 'Sat' })],
        rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun' })],
        bt: [card({ name: 'Marcus Hill', bap: isoShift(10), committed: true, need: 'Get to know ward members', action: 'Invite him to the ward dinner Friday', assigned: 'Elders quorum', when: 'Fri' })]
      },
      tn: [
        card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names', action: 'Family history consultant visits to prepare names', assigned: 'Sister Nguyen', when: 'Thu' }),
        card({ name: 'Samuel Ortiz', ordinance: 'Melchizedek Priesthood', need: 'Someone to study with', action: 'Elders quorum president meets with him', assigned: 'Bro. Young', when: 'Tue' }),
        card({ name: 'Emma Walsh', ordinance: 'Endowment', need: 'Temple preparation class', action: 'Invite her to the temple prep class', assigned: 'Sister Lee', when: 'Sun' })
      ],
      find: { plan: 'Invite friends to the ward Christmas devotional', items: [{ task: 'Each family invites one friend', when: 'Sun', carried: false }] }
    };
  }
  // Tour only: when New members is empty, the tour shows one sample card so the name card stops have fields to point at.
  // It's never saved, and the real list comes back as soon as the tour moves on or ends.
  var tourDemo = null;
  function setTourDemo(on) {
    if (on && !tourDemo && listEmpty('nm')) {
      clearTimeout(draftTimer); // a save waiting to run must not catch the sample card
      tourDemo = { nm: state.cp.nm };
      state.cp.nm = [Object.assign(blankAction(), { name: 'Daniel Rivera', bap: isoShift(-12), ordinance: 'Temple baptisms', need: 'A ride to the temple',
        action: 'Drive him to the temple for baptisms', assigned: 'Bro. Patel', when: 'Sat 9 am' })];
      renderCP();
    } else if (!on && tourDemo) {
      state.cp.nm = tourDemo.nm; tourDemo = null; renderCP(); saveDraft();
    }
  }
  /* ---------- Sent line, meeting date and the weekly agenda ---------- */
  function hashStr(s) { var x = 5381; for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x >>> 0); }
  function cardSig(a) { return [str(a.name).trim(), str(a.bap), str(a.ordinance).trim(), str(a.need).trim(), str(a.hneed).trim(), str(a.action).trim(), str(a.assigned).trim(), str(a.when).trim(), !!a.sac, !!a.temple, !!a.committed]; }
  // Everything that goes on the PDF. Follow-up marks (Completed, Texted) and section checks don't count as changes.
  function agendaSig(s) {
    return hashStr(JSON.stringify([s.ward.trim(), s.date, s.conducting, str(s.conductingOther).trim(), s.attendees.slice().sort(),
      s.rr.map(function (r) { return [str(r.person), str(r.action), str(r.assigned), str(r.when), str(r.plan).trim(), r.happened, str(r.notes).trim(), !!r.carriedFwd]; }),
      GROUPS.map(function (g) { return s.cp[g.id].map(cardSig); }), GROUPS.map(function (g) { return !!(s.cpNone && s.cpNone[g.id]); }),
      s.tn.map(cardSig), str(s.find.plan).trim(), s.find.items.map(function (x) { return [str(x.task).trim(), str(x.when).trim()]; })]));
  }
  function markSent() { state.sentAt = new Date().toISOString(); state.sentSig = agendaSig(state); saveDraft(); }
  function changedSinceSent() { return !!state.sentAt && state.sentSig !== agendaSig(state); }
  function monthDay(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
  function renderSent() {
    var md = $('#meeting-date .md-text');
    if (md) { var d = parseISO(state.date); md.textContent = d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Set the date'; }
    var sl = $('#sent-line');
    if (sl) {
      if (!state.sentAt) sl.hidden = true;
      else {
        var t = new Date(state.sentAt);
        var when = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
        var ch = changedSinceSent();
        sl.hidden = false; sl.className = 'sent-line' + (ch ? ' changed' : '');
        sl.textContent = ch ? 'Changed since sent ' + when + '. Send again to update.' : '✓ Sent ' + when;
      }
    }
    var lbl = $('#send-label'); if (lbl) lbl.textContent = state.sentAt ? 'Send again' : 'Send';
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
    if (cpN) out.push({ text: 'Covenant Path Report Review: ' + cpN + (cpN === 1 ? ' person needs' : ' people need') + ' an action', go: go('cp') });
    GROUPS.forEach(function (g) { if (listEmpty(g.id) && !noneConfirmed(g.id)) out.push({ text: g.title + ': not reviewed', go: go('cp') }); });
    var tnN = needs(state.tn);
    if (tnN) out.push({ text: 'Name Next Ordinance: ' + tnN + (tnN === 1 ? ' person needs' : ' people need') + ' an action', go: go('tn') });
    if (!str(state.find.plan).trim()) out.push({ text: 'Find New People to Teach: no plan yet', go: go('fn') });
    return out;
  }

  // Start a new agenda: last week's actions move into Return and Report (with anything marked Completed as Yes),
  // names and needs stay, and the weekly parts clear. Undo puts everything back.
  function nextMeetingDate(prev) {
    var today = parseISO(todayISO()), d = parseISO(prev) || parseISO(todayISO());
    d.setDate(d.getDate() + 7);
    while (d < today) d.setDate(d.getDate() + 7);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function rrFromItem(it, happened) {
    return { prefilled: true, source: it.source, group: it.group, pname: it.pname, ord: it.ord, need: it.need || '', hneed: it.hneed || '', sac: !!it.sac, bap: it.bap || '', temple: !!it.temple, committed: !!it.committed,
      person: it.person, action: it.action, assigned: it.assigned, when: it.when, plan: '', happened: happened || '', notes: '' };
  }
  function confirmNewAgenda() {
    var next = nextMeetingDate(state.date);
    var n = extractActionItems(state).length;
    var note = !state.sentAt ? ' This agenda hasn’t been sent.' : changedSinceSent() ? ' You’ve changed this agenda since you sent it.' : '';
    ask({
      title: 'Start a new agenda?',
      body: 'Keeps your names and needs. ' + (n ? n + (n === 1 ? ' action item moves' : ' action items move') + ' into Return and Report. ' : '') + 'Attendance, answers and checks clear.' + note,
      dateField: { label: 'This week’s huddle', value: next },
      primary: 'Start new agenda', onPrimary: function () { var v = ($('#confirm-date') || {}).value; startNewAgenda(parseISO(v) ? v : next); }, secondary: 'Cancel'
    });
  }
  // Changing the date to a new week (4+ days later) on a filled-in agenda is how a new week starts.
  function isWeekJump(prev, next) {
    if (isEmpty(state) || (state.loaded && state.loaded.practice)) return false;
    var gap = parseISO(prev) && parseISO(next) ? daysBetween(prev, next) : null;
    return gap !== null && gap >= 4;
  }
  function setDateOnly(next) {
    state.date = next; var df = $('#date'); if (df) df.value = next;
    renderDateHint(); updateTemple(); renderRR(); saveDraft();
    toast('Date changed to ' + monthDay(next) + '.');
  }
  function askNewWeek(next) {
    var n = extractActionItems(state).length;
    var note = !state.sentAt ? ' This agenda hasn’t been sent.' : changedSinceSent() ? ' You’ve changed this agenda since you sent it.' : '';
    ask({
      title: 'Start the ' + monthDay(next) + ' agenda?',
      body: 'Keeps your names and needs. ' + (n ? n + (n === 1 ? ' action item moves' : ' action items move') + ' into Return and Report. ' : '') + 'Attendance, answers and checks clear.' + note,
      primary: 'Start the ' + monthDay(next) + ' agenda', onPrimary: function () { startNewAgenda(next); },
      secondary: 'Just change the date', onSecondary: function () { setDateOnly(next); },
      tertiary: { label: 'Load a handoff instead', run: function () { openOverlay('#load-sheet', '#load-title'); } }
    });
  }

  function startNewAgenda(next) {
    var snap = JSON.parse(JSON.stringify(state));
    var data = JSON.parse(JSON.stringify(state));
    sweepStale(data);
    var items = extractActionItems(data);
    var f = freshState();
    f.ward = data.ward; f.conducting = data.conducting; f.conductingOther = data.conductingOther; f.date = next; f.rolledFrom = data.date;
    state = f; showBlank = {};
    state.rr = items.length ? items.map(function (it) { return rrFromItem(it, it.done ? 'Yes' : ''); }) : [blankRR(), blankRR()];
    carryNames(data);
    view = 'home';
    try { history.replaceState({ hv: 'home' }, ''); } catch (e) { /* ignore */ }
    renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    var done = items.filter(function (it) { return it.done; }).length;
    toast('Started the ' + monthDay(next) + ' agenda.' + (items.length ? ' ' + items.length + (items.length === 1 ? ' item is' : ' items are') + ' in Return and Report' + (done ? ', ' + done + ' already marked Yes' : '') + '.' : ''), 8000,
      { label: 'Undo', run: function () { state = normalizeState(snap); showBlank = {}; view = 'home'; renderAll(); applyView(); saveDraft(); toast('Back to the ' + monthDay(snap.date) + ' agenda.'); } });
  }

  // Completed: a quick mark during the week when someone finishes their assignment.
  function completedButton(base) {
    var on = !!getPath(base + 'doneMid');
    var has = str(getPath(base + (/^find/.test(base) ? 'task' : 'action'))).trim();
    return h('button', { type: 'button', class: 'btn-completed' + (on ? ' on' : ''), 'data-action': 'toggle-completed', 'data-a': base, 'aria-pressed': on ? 'true' : 'false', hidden: !has },
      [icon(on ? 'check' : 'circle'), h('span', { text: on ? 'Completed' : 'Mark completed' })]);
  }
  function refreshCompleted(base) {
    var old = document.querySelector('.btn-completed[data-a="' + base + '"]');
    if (old) old.replaceWith(completedButton(base));
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
  async function packHandoff(s) {
    var c = JSON.parse(JSON.stringify(s));
    delete c.practiceSnapshot; delete c.loaded; c.sentAt = ''; c.sentSig = ''; c.collapsed = {}; c.openOne = {};
    var bytes = new TextEncoder().encode(JSON.stringify({ app: APP_ID, kind: 'handoff', v: 1, s: c })), tag = 'j';
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
    return obj.s;
  }
  function handoffUrl(code) { return location.origin + location.pathname.replace(/index\.html$/, '') + '#handoff=' + code; }
  function startHandoff() {
    if (state.loaded && state.loaded.practice) { toast('Remove the practice week before handing off.'); return; }
    if (isEmpty(state)) { toast('Nothing to hand off yet.'); return; }
    // Build the link first, so tapping the button opens Messages right away.
    packHandoff(state).then(function (code) {
      var d = parseISO(state.date);
      var msg = 'Handoff: the ' + (state.ward.trim() ? state.ward.trim() + ' ' : '') + 'coordination agenda' + (d ? ' for ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '') +
        '. Tap the link to load it into the Weekly Coordination Meeting Agenda app:\n' + handoffUrl(code);
      ask({
        title: 'Hand off this agenda?',
        body: 'For when someone else conducts. This texts them a link that loads this agenda on their phone. Send it only to the leader filling in.',
        primary: 'Text the handoff', onPrimary: function () { openMessages(msg); }, secondary: 'Cancel'
      });
    }, function () { toast('Couldn’t make the handoff. Try again.'); });
  }
  // A handoff link was opened.
  function checkHandoffLink() {
    var m = /[#&]handoff=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) return;
    var code = m[1];
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    unpackHandoff(code).then(function (s) {
      var ua = navigator.userAgent || '';
      var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
      var standalone = navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      if (ios && !standalone) {
        ask({
          title: 'Open this handoff in the app',
          body: 'On iPhone, links open in Safari instead of your Home Screen app. Tap Copy handoff, open the app from your Home Screen, then tap Load a handoff or PDF → Paste a handoff.',
          primary: 'Copy handoff', onPrimary: function () {
            copyText(handoffUrl(code)).then(function () { toast('Copied. Now open the app from your Home Screen.', 8000); }, function () { toast('Couldn’t copy. Press and hold the link in Messages to copy it.', 8000); });
          },
          secondary: 'Load it here in Safari', onSecondary: function () { confirmApplyAgenda(s, 'handoff'); }
        });
      } else confirmApplyAgenda(s, 'handoff');
    }, function () {
      ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or load the agenda from its PDF.', primary: 'OK' });
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
      unpackHandoff(m[1]).then(function (s) { confirmApplyAgenda(s, 'handoff'); }, function () { ask({ title: 'This handoff link didn’t work', body: 'Ask for the link again, or load the agenda from its PDF.', primary: 'OK' }); });
    };
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { useText(t, false); }, function () { manual(); });
    else manual();
  }

  // Loading a handoff or a PDF puts that agenda on this phone as it was (Undo puts yours back).
  function confirmApplyAgenda(data, how) {
    var incoming = normalizeState(data);
    incoming.loaded = null; incoming.practiceSnapshot = null; incoming.sentAt = ''; incoming.sentSig = '';
    var rows = [['Ward', incoming.ward.trim() || 'Not listed'], ['Huddle', longDate(incoming.date) || 'No date']];
    if (state.ward.trim() && incoming.ward.trim() && norm(state.ward) !== norm(incoming.ward)) rows.push(['This phone’s ward', state.ward.trim()]);
    ask({
      title: how === 'handoff' ? 'Load this handoff?' : 'Load this agenda?', compare: rows,
      body: isEmpty(state) ? 'It becomes the agenda on this phone.' : 'It replaces the agenda on this phone. You can undo it right after.',
      primary: 'Load it', onPrimary: function () { applyAgenda(incoming); }, secondary: 'Cancel'
    });
  }
  function applyAgenda(incoming) {
    var snap = JSON.parse(JSON.stringify(state));
    state = incoming; showBlank = {}; sweepStale(state);
    if (state.ward.trim()) writeWard(state.ward.trim());
    view = 'home';
    try { history.replaceState({ hv: 'home' }, ''); } catch (e) { /* ignore */ }
    renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast('Loaded the ' + (monthDay(state.date) || '') + ' agenda.', 8000,
      { label: 'Undo', run: function () { state = normalizeState(snap); showBlank = {}; view = 'home'; renderAll(); applyView(); saveDraft(); toast('Your agenda is back.'); } });
  }

  function startPractice() { applyLoad(practiceData(), 'Practice week', { practice: true }); }
  function removePractice() {
    var snap = state.practiceSnapshot;
    state = normalizeState(snap || null); state.loaded = null; state.practiceSnapshot = null;
    view = 'home'; renderAll(); applyView(); saveDraft(); window.scrollTo(0, 0);
    toast('Practice week removed. The form is back the way it was.');
  }
  function confirmRemovePractice() {
    ask({ title: 'Remove the practice week?', body: 'The sample names and anything you entered while practicing are cleared, and the form goes back to how it was.',
      primary: 'Remove practice week', onPrimary: removePractice, secondary: 'Cancel' });
  }
  function extractActionItems(data) {
    var items = [];
    var cp = data.cp || {};
    GROUPS.forEach(function (g) {
      (Array.isArray(cp[g.id]) ? cp[g.id] : []).forEach(function (a) {
        if (!a || !hasText(a, ['name', 'action'])) return;
        items.push(itemFrom(a, g.id));
      });
    });
    (Array.isArray(data.tn) ? data.tn : []).forEach(function (n) {
      if (!n || !hasText(n, ['name', 'action'])) return;
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
        if (n && names.every(function (x) { return norm(x) !== norm(n); })) { names.push(n); info[norm(n)] = { ordinance: str(a.ordinance).trim(), need: str(a.need).trim(), hneed: str(a.hneed).trim(), bap: str(a.bap), temple: !!a.temple, committed: !!a.committed, touched: parseISO(str(a.touched)) ? str(a.touched) : '' }; }
      });
      if (!names.length) return;
      var cur = state.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      names.forEach(function (n) {
        if (cur.some(function (a) { return norm(a.name) === norm(n); })) return;
        var c = blankAction(); c.name = n; c.ordinance = info[norm(n)].ordinance; c.need = info[norm(n)].need; c.hneed = info[norm(n)].hneed; c.carried = true; c.touched = info[norm(n)].touched;
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
      var c = blankName(); c.name = n; c.ordinance = str(a.ordinance).trim(); c.need = str(a.need).trim(); c.hneed = str(a.hneed).trim(); c.carried = true;
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
  function carryForward(i) {
    var r = state.rr[i]; if (!r) return;
    var g = groupOf(r);
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
      if (slot < 0) { toast('All three Name Next Ordinance spots are already filled.'); return; }
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
    toast('Added to this week’s plan. Update who and when as needed.');
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
    toast('Carry forward undone. It’s off this week’s plan.');
  }
  function confirmUndoCarry(i, title) {
    var r = state.rr[i]; if (!r) return;
    var who = rrPerson(r);
    ask({
      title: title || 'Undo carry forward?',
      body: 'This takes “' + (str(r.action).trim() || 'this item') + '”' + (who && groupOf(r) !== 'fn' ? ' for ' + who : '') + ' back off this week’s plan.',
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
    renderRR(); renderCP(); renderTN(); saveDraft();
    toast(opts.practice ? 'Practice week loaded: ' + items.length + ' sample action items are in Return and Report, and the names carried over.'
      : 'Loaded ' + items.length + (items.length === 1 ? ' action item' : ' action items') +
      (carried ? ' and ' + carried + (carried === 1 ? ' name' : ' names') : '') + ' from last week.', opts.practice ? 6000 : undefined);
    if (stepsOn) { var sh = $('#steps-home'); if (sh) sh.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    else { var sec = $('#h-rr'); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (carried && !readFlag(NAMES_HINT_KEY)) {
      writeFlag(NAMES_HINT_KEY);
      ask({
        title: 'Check the names that carried over',
        body: 'Last week’s names are now in Covenant Path Report Review and Name Next Ordinance. Compare them to this week’s Covenant Path Report and ward council’s focus names: add anyone new and remove anyone no longer listed.',
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
        body: 'It wasn’t made with this agenda form. Choose the PDF named “Huddle - [Ward] - [Date]” from last week.',
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
          h('button', { type: 'button', class: 'btn-small', 'data-action': 'share-agenda', 'data-a': r.id, 'aria-label': 'Share the ' + shortDate(r.date) + ' agenda again', text: 'Share again' })
        ])
      ]);
    }).concat([practiceRow]));
    openOverlay('#load-sheet', '.agenda-row');
  }

  /* ---------- PDF ---------- */
  function fileName(s) {
    s = s || state;
    var w = s.ward.trim().replace(/[\\/:*?"<>|#%{}~&]+/g, '').replace(/\s+/g, ' ').slice(0, 60) || 'Ward';
    return 'Huddle - ' + w + ' - ' + s.date + '.pdf';
  }

  async function buildPdf(s) {
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
      gray: rgb(0.42, 0.447, 0.502), line: rgb(0.788, 0.808, 0.839), head: rgb(0.933, 0.949, 0.973),
      group: rgb(0.965, 0.972, 0.984), white: rgb(1, 1, 1),
      councilFill: rgb(0.902, 0.937, 0.98), councilLine: rgb(0.18, 0.455, 0.788),
      faint: rgb(0.62, 0.65, 0.70), hudFill: rgb(0.988, 0.929, 0.898), hudLine: rgb(0.878, 0.4, 0.18), hudInk: rgb(0.64, 0.29, 0.07), amber: rgb(1, 0.973, 0.902), amberLine: rgb(0.922, 0.796, 0.478)
    };
    // Each Covenant Path list gets its own color on the PDF, matching the form.
    var GROUP_PDF = {
      nm: { fill: rgb(0.929, 0.949, 0.980), ink: rgb(0.18, 0.333, 0.592) },
      rm: { fill: rgb(0.929, 0.965, 0.941), ink: rgb(0.122, 0.42, 0.227) },
      bt: { fill: rgb(0.957, 0.933, 0.976), ink: rgb(0.478, 0.247, 0.62) },
      tn: { fill: rgb(1, 0.973, 0.902), ink: rgb(0.62, 0.42, 0.02) },
      fn: { fill: rgb(0.91, 0.961, 0.961), ink: rgb(0.055, 0.431, 0.451) }
    };
    // Name card tables: Name | Attended sacrament | Next ordinance | Need | Action | Assigned to | When
    // Name | Next ordinance | Need  (Ward Council)  ·  Attended sacrament | Action | Assigned to | When  (Huddle)
    var CARD_COLS = [48, 132, 194, 270, 332, 450, 516];
    var CARD_HEADS = ['NEXT\nORDINANCE', 'NEEDS', 'ATTENDED\nSACRAMENT', 'ACTION ITEM\nFOR THIS WEEK', 'ASSIGNED\nTO', 'WHEN'];
    var CARD_GROUPS = [{ text: 'WARD COUNCIL · WHO & WHAT', from: 0, to: 3, kind: 'wc' }, { text: 'HUDDLE · HOW & WHEN', from: 3, to: 7, kind: 'hd' }];
    var TEMPLE_RED = rgb(0.70, 0.16, 0.16);
    function cardRow(a, gid) {
      var sub = null;
      if (gid === 'nm' && (str(a.name).trim() || a.bap)) {
        var st = templeStatus(a, s.date);
        sub = { text: 'Temple: ' + (st.left === undefined && !st.done ? 'no date' : st.short), color: st.done ? STATUS_PDF.Yes : TEMPLE_RED };
      }
      if (gid === 'bt' && baptismNote(a)) {
        var d = shortDay(str(a.bap));
        sub = { text: a.committed ? 'Committed' + (d ? ' · ' + d : '') : 'Scheduled: ' + d, color: GROUP_PDF.bt.ink };
      }
      var act = str(a.action).trim();
      return { boldFirst: true, sub: sub, note: str(a.hneed).trim(), cells: [str(a.name).trim(), ordOf(a, gid), str(a.need).trim(), { check: !!a.sac, mark: true },
        a.actionCarried && act ? { text: act, meta: CARRIED_TEXT, metaItal: true } : act, str(a.assigned).trim(), str(a.when).trim()] };
    }
    var STATUS_PDF = { Yes: rgb(0.122, 0.42, 0.227), Partly: rgb(0.62, 0.42, 0.02), No: rgb(0.70, 0.16, 0.16) };
    var W = 612, H = 792, L = 48, R = 564, TOP = 40, BOTTOM = 46;
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
    function vline(x, t0, t1) {
      page.drawLine({ start: { x: x, y: H - t0 }, end: { x: x, y: H - t1 }, thickness: 0.6, color: C.line });
    }
    function box(x, top, w, hh, opts) {
      page.drawRectangle(Object.assign({ x: x, y: H - top - hh, width: w, height: hh }, opts));
    }
    function rbox(x, top, w, hh, r, fill, stroke, bw) {
      var p = 'M ' + r + ' 0 H ' + (w - r) + ' Q ' + w + ' 0 ' + w + ' ' + r + ' V ' + (hh - r) + ' Q ' + w + ' ' + hh + ' ' + (w - r) + ' ' + hh +
        ' H ' + r + ' Q 0 ' + hh + ' 0 ' + (hh - r) + ' V ' + r + ' Q 0 0 ' + r + ' 0 Z';
      page.drawSvgPath(p, { x: x, y: H - top, color: fill, borderColor: stroke, borderWidth: bw || 0 });
    }
    function checkbox(x, base, checked) {
      box(x, base - 8.1, 9.2, 9.2, { color: C.white, borderColor: C.gray, borderWidth: 0.8 });
      if (checked) {
        var p = 'M 1.9 4.9 L 3.9 7.2 L 7.6 2';
        page.drawSvgPath(p, { x: x, y: H - (base - 8.1), borderColor: C.navy, borderWidth: 1.4 });
      }
    }
    function bullet(base) { page.drawCircle({ x: 53, y: H - (base - 3.3), size: 1.9, color: C.dark }); }
    function newPage(cont) {
      page = doc.addPage([W, H]); pages.push(page); y = TOP;
      if (cont) {
        tx(L, y + 9, DOC_TITLE + (wardTxt ? ' · ' + wardTxt : '') + (dateTxt ? ' · ' + dateTxt : '') + ' (continued)', F.bold, 9, C.gray);
        y += 20;
      }
    }
    function ensure(need) { if (y + need > H - BOTTOM) newPage(true); }
    // A slim band that groups sections: LAST WEEK (looking back) and THIS WEEK'S PLAN (looking ahead).
    function band(label, sub) {
      ensure(70);
      box(L, y, R - L, 17, { color: C.navy });
      var e = tx(L + 8, y + 12, label, F.bold, 8.5, C.white);
      if (sub) tx(e + 8, y + 12, sub, F.ital, 8.5, rgb(0.82, 0.87, 0.94));
      y += 17 + 8;
    }
    function heading(label, note) {
      ensure(40);
      var e = tx(L, y + 9, label, F.bold, 11.5, C.blue);
      if (note) tx(e + 6, y + 9, note, F.ital, 9, C.gray);
      hline(L, R, y + 14);
      y += 14;
    }

    // Tables
    function table(cols, headers, rows, groups) {
      var edges = cols.concat([R]);
      var FS = 8.5, LH = 10.5;
      // A header can take two lines ("ATTENDED\nSACRAMENT") so narrow columns stay readable.
      var headLines = headers.map(function (t) { return t.split('\n'); });
      var HH = headLines.some(function (l) { return l.length > 1; }) ? 23 : 14;
      var GH = groups ? 13 : 0;
      function drawHeader() {
        // Optional labels above the header: which group fills in which columns.
        if (groups) {
          groups.forEach(function (g) {
            var col = g.kind === 'hd' ? C.hudInk : C.blue;
            tx(edges[g.from] + 5, y + 8.5, g.text, F.bold, 6.8, col);
            page.drawLine({ start: { x: edges[g.from] + (g.from ? 2 : 0), y: H - (y + GH - 1.5) }, end: { x: edges[g.to] - (g.to < edges.length - 1 ? 2 : 0), y: H - (y + GH - 1.5) }, thickness: 1.6, color: col });
          });
          y += GH;
        }
        box(L, y, R - L, HH, { color: C.head });
        headLines.forEach(function (ls, i) { ls.forEach(function (t, k) { tx(edges[i] + 5, y + 10 + k * 9, t, F.bold, 8, C.navy); }); });
        hline(L, R, y); hline(L, R, y + HH);
        vline(L, y, y + HH); vline(R, y, y + HH);
        y += HH;
      }
      // A cell is plain text, or a list of {t, bold} pieces when only part of it is bold.
      function segWrap(segs, maxW) {
        var sp = F.reg.widthOfTextAtSize(' ', FS), words = [];
        segs.forEach(function (sg) {
          var font = sg.bold ? F.bold : F.reg;
          clean(sg.t, font).replace(/\n/g, ' ').split(/ +/).filter(Boolean).forEach(function (w) {
            while (font.widthOfTextAtSize(w, FS) > maxW && w.length > 1) {
              var cut = w.length - 1;
              while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), FS) > maxW) cut--;
              words.push({ t: w.slice(0, cut), font: font, w: font.widthOfTextAtSize(w.slice(0, cut), FS) }); w = w.slice(cut);
            }
            words.push({ t: w, font: font, w: font.widthOfTextAtSize(w, FS) });
          });
        });
        var lines = [], cur = [], cw = 0;
        words.forEach(function (wd) {
          var add = (cur.length ? sp : 0) + wd.w;
          if (cur.length && cw + add > maxW) { lines.push(cur); cur = []; cw = 0; add = wd.w; }
          cur.push(wd); cw += add;
        });
        if (cur.length) lines.push(cur);
        return { seg: true, sp: sp, lines: lines.length ? lines : [[]] };
      }
      function rowLayout(row) {
        if (row.group) return { h: 15 };
        if (row.empty) return { h: 18 };
        var cells = row.cells.map(function (c, i) {
          var maxW = edges[i + 1] - edges[i] - 10;
          if (c && typeof c === 'object' && 'check' in c) return { box: true, on: !!c.check, mark: !!c.mark, lines: [] };
          // Main text, with a smaller gray line underneath (who and when, or a short status).
          if (c && typeof c === 'object' && 'meta' in c) {
            var main = wrap(str(c.text), F.reg, FS, maxW), meta = str(c.meta) ? wrap(c.meta, c.metaItal ? F.ital : F.reg, 7.8, maxW) : [];
            return { font: F.reg, lines: str(c.text) ? main : [], meta: meta, metaItal: !!c.metaItal, extra: meta.length * 0.9 };
          }
          if (Array.isArray(c)) return segWrap(c, maxW);
          var font = row.boldFirst && i === 0 ? F.bold : F.reg;
          return { font: font, lines: wrap(c, font, FS, maxW) };
        });
        var n = Math.max.apply(null, cells.map(function (c) { return c.lines.length + (c.extra || 0); }));
        var subLines = null;
        if (row.sub) {
          subLines = wrap(row.sub.text, F.bold, 7.5, edges[1] - edges[0] - 10);
          n = Math.max(n, cells[0].lines.length + subLines.length * 0.85);
        }
        var cellH = Math.max(18, Math.ceil(n * LH + 7));
        // Huddle notes get their own full-width line under the row.
        var noteLines = null, noteH = 0, noteLabelW = 0;
        if (row.note) {
          noteLabelW = F.bold.widthOfTextAtSize('Huddle notes: ', 8);
          noteLines = wrap(row.note, F.reg, 8, R - L - 34 - noteLabelW);
          noteH = noteLines.length * 10 + 11;
        }
        return { h: cellH + noteH, cellH: cellH, cells: cells, subLines: subLines, noteLines: noteLines, noteLabelW: noteLabelW };
      }
      var first = rows.length ? rowLayout(rows[0]) : { h: 18 };
      ensure(GH + HH + first.h + 4);
      drawHeader();
      rows.forEach(function (row, ri) {
        var lay = rowLayout(row);
        // A list label never sits alone at the bottom of a page: keep it with its first person.
        var keep = row.group && rows[ri + 1] ? rowLayout(rows[ri + 1]).h : 0;
        if (y + lay.h + keep > H - BOTTOM) { newPage(true); drawHeader(); }
        if (row.empty) {
          tx(L + 8, y + 11.5, row.empty, F.ital, 8.5, C.gray);
          vline(L, y, y + lay.h); vline(R, y, y + lay.h);
        } else if (row.group) {
          var gc = GROUP_PDF[row.gid] || { fill: C.group, ink: C.blue };
          box(L, y, R - L, lay.h, { color: gc.fill });
          box(L, y, 3, lay.h, { color: gc.ink });
          tx(L + 8, y + 10.5, row.group.toUpperCase(), F.bold, 7.5, gc.ink);
          vline(L, y, y + lay.h); vline(R, y, y + lay.h);
        } else {
          // A thin bar in the list's color marks where each row came from.
          if (row.gid && GROUP_PDF[row.gid]) box(L, y, 3, lay.h, { color: GROUP_PDF[row.gid].ink });
          lay.cells.forEach(function (c, i) {
            if (c.box) {
              // A green tick when the person attended sacrament meeting (an empty box only on blank forms).
              var bx = (edges[i] + edges[i + 1]) / 2 - 4.5, by = y + 4.5;
              if (!c.mark) page.drawRectangle({ x: bx, y: H - (by + 9), width: 9, height: 9, borderColor: C.gray, borderWidth: 0.8 });
              if (c.on) {
                page.drawLine({ start: { x: bx + 1.8, y: H - (by + 4.8) }, end: { x: bx + 3.8, y: H - (by + 7) }, thickness: 1.4, color: STATUS_PDF.Yes });
                page.drawLine({ start: { x: bx + 3.8, y: H - (by + 7) }, end: { x: bx + 7.6, y: H - (by + 2) }, thickness: 1.4, color: STATUS_PDF.Yes });
              }
              return;
            }
            c.lines.forEach(function (ln, k) {
              if (!c.seg) {
                var isStatus = row.status && i === (row.statusCol || 1) && STATUS_PDF[row.status];
                tx(edges[i] + 5, y + 11.5 + k * LH, ln, isStatus ? F.bold : c.font, FS, isStatus ? STATUS_PDF[row.status] : C.dark);
                return;
              }
              var x = edges[i] + 5;
              ln.forEach(function (wd, j) {
                if (j) x += c.sp;
                page.drawText(wd.t, { x: x, y: H - (y + 11.5 + k * LH), size: FS, font: wd.font, color: C.dark });
                x += wd.w;
              });
            });
          });
          lay.cells.forEach(function (c, i) {
            if (!c.meta || !c.meta.length) return;
            var my = y + 11.5 + c.lines.length * LH - (c.lines.length ? 0.5 : 0);
            c.meta.forEach(function (ln, k) { tx(edges[i] + 5, my + k * 9.5, ln, c.metaItal ? F.ital : F.reg, 7.8, C.gray); });
          });
          if (lay.subLines) {
            var sy = y + 11.5 + lay.cells[0].lines.length * LH;
            lay.subLines.forEach(function (ln, k) { tx(edges[0] + 5, sy + k * 9, ln, F.bold, 7.5, row.sub.color); });
          }
          // Outer border only; rows are separated by horizontal rules, which reads cleaner on paper.
          vline(L, y, y + lay.h); vline(R, y, y + lay.h);
          if (lay.noteLines) {
            // The note sits inside the same row, tucked under the name with a connector,
            // so it reads as belonging to that person.
            var ny = y + lay.cellH - 1, nh = lay.h - lay.cellH - 3;
            rbox(L + 18, ny, R - L - 24, nh, 3, C.hudFill, C.hudLine, 0.5);
            page.drawLine({ start: { x: L + 9, y: H - (y + lay.cellH - 3) }, end: { x: L + 9, y: H - (ny + nh / 2) }, thickness: 0.9, color: C.hudLine });
            page.drawLine({ start: { x: L + 9, y: H - (ny + nh / 2) }, end: { x: L + 18, y: H - (ny + nh / 2) }, thickness: 0.9, color: C.hudLine });
            tx(L + 24, ny + 10.5, 'Huddle notes:', F.bold, 8, C.hudInk);
            lay.noteLines.forEach(function (ln, k) { tx(L + 24 + lay.noteLabelW, ny + 10.5 + k * 10, ln, F.reg, 8, C.dark); });
          }
        }
        hline(L, R, y + lay.h);
        y += lay.h;
      });
    }

    /* ----- page 1 header ----- */
    newPage(false);
    // Privacy reminder for everyone who receives the agenda.
    var sx = tx(L, 27, 'Keep this PDF secure', F.bold, 8, C.hudInk);
    tx(sx, 27, ' and delete it when it’s no longer needed.', F.reg, 8, C.gray);
    tx(L, 54, 'Weekly Coordination', F.bold, 21, C.navy);
    tx(L, 77, 'Meeting Agenda', F.bold, 21, C.navy);
    var lx = tx(L, 96, 'Ward', F.reg, 9, C.gray);
    tx(L + 58, 96, wardTxt || '—', F.bold, 10, C.dark);
    tx(L, 111, 'Date', F.reg, 9, C.gray);
    tx(L + 58, 111, dateTxt || '—', F.bold, 10, C.dark);
    tx(L, 126, 'Conducting', F.reg, 9, C.gray);
    tx(L + 58, 126, conductingLabel(s) || '—', F.bold, 10, C.dark);
    void lx;

    // Who/What · How/When diagram
    [[41, 'Who'], [61, 'What'], [91, 'How'], [111, 'When']].forEach(function (p) {
      rbox(346, p[0], 46, 16, 4, C.white, C.line, 0.8);
      var tw = F.bold.widthOfTextAtSize(p[1], 8);
      tx(369 - tw / 2, p[0] + 10.8, p[1], F.bold, 8, C.navy);
    });
    [[41, 77, 59], [91, 127, 109]].forEach(function (b) {
      page.drawLine({ start: { x: 396, y: H - b[0] }, end: { x: 402, y: H - b[0] }, thickness: 0.8, color: C.gray });
      page.drawLine({ start: { x: 402, y: H - b[0] }, end: { x: 402, y: H - b[1] }, thickness: 0.8, color: C.gray });
      page.drawLine({ start: { x: 396, y: H - b[1] }, end: { x: 402, y: H - b[1] }, thickness: 0.8, color: C.gray });
      page.drawLine({ start: { x: 402, y: H - b[2] }, end: { x: 430, y: H - b[2] }, thickness: 0.8, color: C.gray });
      page.drawSvgPath('M 0 0 L 6 3 L 0 6 Z', { x: 430, y: H - (b[2] - 3), color: C.gray });
    });
    // Detail text may mark bold words with *asterisks*; lines are centered word by word.
    function richWrap(text, size, maxW) {
      var words = clean(text, F.reg).split(/ +/).filter(Boolean).map(function (w) {
        var bold = /^\*.*\*[.,]?$/.test(w);
        var t = bold ? w.replace(/\*/g, '') : w;
        var font = bold ? F.bold : F.reg;
        return { t: t, font: font, w: font.widthOfTextAtSize(t, size) };
      });
      var sp = F.reg.widthOfTextAtSize(' ', size), lines = [], cur = [], cw = 0;
      words.forEach(function (wd) {
        var add = (cur.length ? sp : 0) + wd.w;
        if (cur.length && cw + add > maxW) { lines.push({ words: cur, w: cw }); cur = []; cw = 0; add = wd.w; }
        cur.push(wd); cw += add;
      });
      if (cur.length) lines.push({ words: cur, w: cw });
      // Avoid a single word alone on the last line.
      var n = lines.length;
      if (n > 1 && lines[n - 1].words.length === 1 && lines[n - 2].words.length > 2) {
        var moved = lines[n - 2].words.pop();
        lines[n - 2].w -= moved.w + sp;
        lines[n - 1].words.unshift(moved);
        lines[n - 1].w += moved.w + sp;
      }
      return { lines: lines, sp: sp };
    }
    function infoBox(top, hh, fill, stroke, title, detail) {
      rbox(436, top, 128, hh, 5, fill, stroke, 1.2);
      var tl = wrap(title, F.bold, 9, 118), dl = richWrap(detail, 7, 118);
      var total = tl.length * 10.5 + dl.lines.length * 8.4;
      var b = top + (hh - total) / 2 + 8;
      tl.forEach(function (ln) { tx(500 - F.bold.widthOfTextAtSize(ln, 9) / 2, b, ln, F.bold, 9, C.navy); b += 10.5; });
      dl.lines.forEach(function (ln) {
        var x = 500 - ln.w / 2;
        ln.words.forEach(function (wd, i) {
          if (i) x += dl.sp;
          page.drawText(wd.t, { x: x, y: H - b, size: 7, font: wd.font, color: wd.font === F.bold ? C.navy : C.dark });
          x += wd.w;
        });
        b += 8.4;
      });
    }
    infoBox(37, 48, C.councilFill, C.councilLine, 'Ward Council', 'Reviews the Covenant Path Report, then selects *who* to focus on and *what* each person’s next ordinance is.');
    infoBox(89, 44, C.hudFill, C.hudLine, 'Weekly Coordination Meeting', 'Huddles decide *how* and *when* to help.');
    hline(L, R, 139, C.navy, 1.2);
    y = 152;

    /* ----- Attendees ----- */
    // A label like Ward, Date and Conducting, not a section heading: it's about the meeting, not a topic.
    var al = tx(L, y + 3, 'Attendees', F.reg, 9, C.gray);
    tx(al + 6, y + 3, 'Make an extra effort to involve the youth', F.ital, 8.5, C.gray);
    y += 5;
    var arows = [ATTENDEES.slice(0, 4), ATTENDEES.slice(4, 8), ATTENDEES.slice(8)];
    var fontFor = function (a) { return a.youth ? F.bold : F.reg; };
    var colw = [0, 1, 2, 3].map(function (i) {
      return Math.max.apply(null, arows.filter(function (r) { return r[i]; }).map(function (r) { return fontFor(r[i]).widthOfTextAtSize(r[i].label, 9.5); }));
    });
    var gap = (R - 48.4 - 4 * 14.6 - colw.reduce(function (a, b) { return a + b; }, 0)) / 3;
    var xs = [48.4];
    for (var ci = 0; ci < 3; ci++) xs.push(xs[ci] + 14.6 + colw[ci] + gap);
    var ab = y + 13;
    arows.forEach(function (r) {
      r.forEach(function (a, i) {
        var here = s.attendees.indexOf(a.id) >= 0;
        checkbox(xs[i], ab, here);
        tx(xs[i] + 14.6, ab, a.label, fontFor(a), 9.5, here || !s.attendees.length ? C.dark : C.faint);
      });
      ab += 14;
    });
    y = ab - 14 + 8;

    /* ----- Return and Report ----- */
    y += 12;
    band('LAST WEEK', 'Did it happen?');
    heading('Return and Report');
    y += 7;
    var rrRows = s.rr.filter(function (r) { return r.prefilled || rrHasInput(r); }).map(function (r) {
      var gid = r.prefilled ? groupOf(r) : '';
      var name = gid === 'fn' ? 'Finding new people' : r.prefilled ? (str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim()) : '';
      var who = [str(r.assigned).trim(), str(r.when).trim()].filter(Boolean).join(' · ');
      var action = r.prefilled ? (str(r.action).trim() || 'No action item written') : str(r.plan).trim();
      var notes = str(r.notes).trim();
      return {
        gid: gid, boldFirst: true, status: r.happened || '', statusCol: 2,
        sub: gid && gid !== 'fn' ? { text: SOURCE[gid], color: GROUP_PDF[gid].ink } : null,
        note: str(r.hneed).trim(),
        cells: [name, { text: action, meta: who }, r.happened || '—', { text: notes, meta: r.carriedFwd ? 'Carried forward to this week' : '', metaItal: true }]
      };
    });
    if (!rrRows.length) rrRows = [{ empty: 'Nothing carried from last week.' }];
    table([48, 140, 352, 418], ['PERSON', 'LAST WEEK’S ACTION', 'HAPPENED?', 'NOTES'], rrRows);

    /* ----- Covenant Path Report Review ----- */
    y += 18;
    band('THIS WEEK’S PLAN', 'Who and what from ward council; how and when from the huddle');
    heading('Covenant Path Report Review');
    // The PDF keeps only the table; the how-to lines live on the form.
    y += 7;
    var cpRows = [];
    GROUPS.forEach(function (g) {
      cpRows.push({ group: g.title, gid: g.id });
      var filled = s.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      if (!filled.length) cpRows.push({ empty: noneConfirmed(g.id, s) ? 'No one on the Covenant Path Report this week' : 'Not reviewed' });
      filled.forEach(function (a) { cpRows.push(cardRow(a, g.id)); });
    });
    table(CARD_COLS, ['NAME'].concat(CARD_HEADS), cpRows, CARD_GROUPS);

    // Three Names (same header style as Covenant Path Report Review)
    y += 13;
    ensure(95); // keep the heading with its table
    heading('Name Next Ordinance (Ward Council Focus Names)');
    y += 7;
    table(CARD_COLS, ['FOCUS NAME'].concat(CARD_HEADS),
      (function () {
        var tnRows = s.tn.filter(function (n) { return n.sac || hasText(n, CARD_KEYS); }).map(function (n) { var row = cardRow(n); row.gid = 'tn'; return row; });
        return tnRows.length ? tnRows : [{ empty: 'None this week' }];
      })(), CARD_GROUPS);

    /* ----- Plans to find new people to teach ----- */
    y += 13;
    ensure(70); // keep the heading with its table
    heading('Plans to Find New People to Teach');
    y += 7;
    var fPlan = str(s.find.plan).trim();
    var fRows = s.find.items.filter(assignHasText).map(function (x) {
      var t = str(x.task).trim();
      return { gid: 'fn', cells: [x.carried && t ? { text: t, meta: CARRIED_TEXT, metaItal: true } : t, str(x.when).trim()] };
    });
    if (fPlan) { table([48], ['PLAN'], [{ gid: 'fn', cells: [fPlan] }]); y += 8; }
    if (fRows.length || !fPlan) table([48, 470], ['ASSIGNMENT', 'WHEN'], fRows.length ? fRows : [{ empty: fPlan ? 'No assignments yet' : 'None this week' }]);

    y += 12;

    // Footers
    var total = pages.length;
    pages.forEach(function (pg, i) {
      page = pg;
      var foot = DOC_TITLE + (wardTxt ? ' · ' + wardTxt : '') + (dateTxt ? ' · ' + dateTxt : '') + (total > 1 ? ' · Page ' + (i + 1) + ' of ' + total : '');
      tx(L, H - 22, foot, F.reg, 7.5, C.gray);
    });

    // Metadata and the hidden copy of the form data used by "Load last week"
    doc.setTitle(DOC_TITLE + ' – ' + (wardTxt || 'Ward') + ' – ' + shortDate(s.date));
    doc.setSubject(DOC_TITLE);
    doc.setKeywords([APP_ID]);
    doc.setCreator('Huddle agenda form');
    doc.setProducer('Huddle agenda form');
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    var payload = makePayload(s);
    doc.getInfoDict().set(P.PDFName.of('HuddleData'), P.PDFHexString.fromText(JSON.stringify(payload)));
    var bytes = await doc.save();
    return { bytes: bytes, pages: total, payload: payload };
  }

  // The form data saved inside the PDF and in this phone's saved agendas.
  function makePayload(s) {
    return JSON.parse(JSON.stringify({
      app: APP_ID, v: DATA_VERSION, ward: s.ward.trim(), date: s.date, createdAt: new Date().toISOString(),
      conducting: s.conducting || '', conductingOther: str(s.conductingOther).trim(),
      attendees: s.attendees.slice(),
      rr: s.rr.map(function (r) {
        return r.prefilled
          ? { prefilled: true, source: r.source, person: r.person, action: r.action, assigned: r.assigned, when: r.when, happened: r.happened, notes: r.notes,
              group: r.group || '', pname: r.pname || '', ord: r.ord || '', need: r.need || '', hneed: r.hneed || '', sac: !!r.sac, bap: r.bap || '', temple: !!r.temple, committed: !!r.committed, carriedFwd: !!r.carriedFwd, carryUndo: r.carryUndo || null }
          : { plan: r.plan, happened: r.happened, notes: r.notes };
      }),
      cpDone: s.cpDone, cp: s.cp, cpNone: s.cpNone, tnDone: s.tnDone, tn: s.tn, ftDone: s.ftDone,
      find: { plan: str(s.find.plan), items: s.find.items.map(function (x) { return { task: str(x.task), when: str(x.when), carried: !!x.carried }; }) }
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
      $('#install-banner .install-body').textContent = 'Do this before you fill anything in. Agendas saved here in Safari won’t carry over to the Home Screen app.';
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
    $('#send-title').textContent = resending ? 'Share this agenda again' : 'Send this week’s agenda';
    $('#share-btn').disabled = true; $('#share-btn').textContent = 'Share PDF';
    $('#share-hint').textContent = resending ? 'Only share via email or text message. Do not share through any other app. The form on your screen isn’t changed.' : SHARE_HINT;
    $('#send-recipients').hidden = false;
    $('#after-download').hidden = true;
  }

  // Keep this week's agenda in the phone's saved agendas (newest 4).
  async function rememberAgenda() {
    if (!sendPayload) return false;
    try { await saveAgenda(sendPayload); return true; } catch (e) { return false; }
  }

  // Ward, date and some content are needed before sending or saving.
  function readyToSave(verb) {
    if (state.loaded && state.loaded.practice) {
      ask({ title: 'Remove the practice week first', body: 'Practice names can’t be ' + (verb === 'save' ? 'saved' : 'sent') + '. Remove the practice week, then fill in your real huddle.',
        primary: 'Remove practice week', onPrimary: removePractice, secondary: 'Cancel' });
      return false;
    }
    if (!state.ward.trim()) {
      ask({ title: 'Add your ward name first', body: 'The ward name goes on the PDF and helps you load the right agenda next week.', primary: 'OK', onPrimary: function () { openDetails(); $('#ward').focus(); } });
      return false;
    }
    if (!parseISO(state.date)) {
      ask({ title: 'Add this week’s huddle date first', body: 'Tap the date at the top to set it.', primary: 'OK', onPrimary: function () { window.scrollTo(0, 0); } });
      return false;
    }
    if (isEmpty(state)) {
      ask({ title: 'Nothing to ' + verb + ' yet', body: 'Fill in the agenda first.', primary: 'OK' });
      return false;
    }
    return true;
  }

  // src = a saved agenda to share again; otherwise the form on screen.
  async function startSend(src, checked) {
    resending = !!src;
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
    var name = fileName(agenda);
    $('#send-filename').textContent = name;
    $('#send-status').textContent = 'Making your PDF…';
    openOverlay('#send-sheet', '#send-title');
    try {
      var out = await buildPdf(agenda);
      sendFile = new File([out.bytes], name, { type: 'application/pdf' });
      sendPayload = out.payload;
      $('#send-status').textContent = out.pages + (out.pages === 1 ? ' page' : ' pages') + ' · locked so it can’t be edited';
      if (!canShareFiles(sendFile)) {
        // No share menu for files here (some desktop browsers): download instead.
        $('#share-hint').textContent = resending ? 'Saves the PDF to your Downloads. Attach it to an email or message.'
          : 'Saves the PDF to your Downloads. Attach it to an email or message.';
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

  async function downloadAndRemember() {
    download(sendFile);
    if (!resending) markSent();
    $('#after-download').hidden = false;
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
        await downloadAndRemember();
        return;
      }
      markSent(); closeSend();
      sentDone();
    } else {
      await downloadAndRemember();
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

  // After sending: a clear confirmation that it went out; the agenda stays for follow-up.
  function sentDone(saved) {
    ask({
      title: 'Sent successfully', success: true,
      body: 'The agenda stays filled in for follow-up this week. When it’s time for the next ward council, tap Start a new agenda. Tip: include yourself when you send it, so you always have a copy of the PDF.',
      primary: 'Done'
    });
  }
  function closeSend() { closeOverlay('#send-sheet'); sendFile = null; sendPayload = null; resending = false; }

  /* ---------- wiring ---------- */
  function init() {
    if (typeof PDFLib === 'undefined') {
      toast('Something didn’t load. Check your connection and reload the page.');
    }
    fileInput = $('#file-input');
    fileInput.addEventListener('change', onFilePicked);
    renderAll();
    checkHandoffLink();
    window.addEventListener('hashchange', checkHandoffLink);
    // Tapping the date opens the phone's date picker right there.
    var dateIn = $('#date');
    if (dateIn) dateIn.addEventListener('click', function () { try { if (dateIn.showPicker) dateIn.showPicker(); } catch (e) { /* the input still works */ } });
    // Saved copies of agendas are no longer kept on the phone; clear any left from before.
    if (!readFlag('huddle-saved-cleared')) { try { deleteAllAgendas().then(function () { writeFlag('huddle-saved-cleared'); }, function () { writeFlag('huddle-saved-cleared'); }); } catch (e) { /* ignore */ } }
    if (staleRemoved) { saveDraft(); toast('Removed ' + staleRemoved + (staleRemoved === 1 ? ' name' : ' names') + ' not updated in 5 weeks.', 6000); }
    // Four-step view: start on the step list; the phone's Back gesture returns to it from a step.
    try { history.replaceState({ hv: 'home' }, ''); } catch (e) { /* ignore */ }
    applyView();
    window.addEventListener('popstate', function (e) {
      var v = e.state && e.state.hv;
      if (!stepsOn) return;
      view = v && v !== 'home' && STEPS.some(function (st) { return st.id === v; }) ? v : 'home';
      applyView(); window.scrollTo(0, 0);
    });

    var onEdit = function (e) {
      var t = e.target;
      var path = t && t.getAttribute && t.getAttribute('data-bind');
      if (!path) return;
      var val = t.type === 'checkbox' ? t.checked : t.value;
      // Moving this week's date forward to a new week asks whether to start a new agenda.
      // Wait for the picker to close (the change event), and leave the date as it was until they choose.
      if (path === 'date' && isWeekJump(state.date, String(val))) {
        if (e.type === 'change') {
          var nd = String(val);
          t.value = state.date;
          try { t.blur(); } catch (err) { /* ignore */ }
          setTimeout(function () { askNewWeek(nd); }, 200);
        }
        return;
      }
      setPath(path, val);
      if (path === 'ward') writeWard(String(val).trim());
      if (path === 'date') renderDateHint();
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
      var ta = /^((?:cp\.\w+|tn)\.\d+\.)action$/.exec(path) || /^(find\.items\.\d+\.)task$/.exec(path);
      if (ta) refreshCompleted(ta[1]);
      if (/\.(action|task)$/.test(path) && !String(val).trim()) {
        setPath(path.replace(/action$/, 'actionCarried').replace(/task$/, 'carried'), false);
        var tagEl = t.closest('.field, .fn-assign'); tagEl = tagEl && tagEl.querySelector('.carried-tag'); if (tagEl) tagEl.remove();
      }
      // Covenant Path Report reminders: sacrament attendance on Covenant Path cards, and a new member's temple attendance.
      if (/^cp\.\w+\.\d+\.sac$/.test(path) && val === true) toast('Remember to update sacrament attendance in the Covenant Path Report too.', 7000);
      if (/^cp\.nm\.\d+\.temple$/.test(path) && val === true) toast('Remember to update temple attendance in the Covenant Path Report too.', 7000);
      if (/^cp\.\w+\.\d+\.name$/.test(path)) updateListCount(path.split('.')[1]);
      if (/^cp\.nm\.\d+\.(name|bap|temple)$/.test(path) || path === 'date') { updateTemple(); if (path === 'date') renderRR(); }
      if (/^tn\.\d+\.name$/.test(path)) { var tc = document.querySelector('.list-tn .list-count'); if (tc) tc.textContent = tnCountText(); }
      saveDraft();
    };
    // Save the draft right away if the app is closed or put in the background.
    var flushDraft = function () { clearTimeout(draftTimer); if (!tourDemo) writeJSON('localStorage', LIVE_KEY, state); };
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushDraft(); });
    document.addEventListener('input', onEdit);
    document.addEventListener('change', onEdit);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-action]');
      if (btn && !btn.disabled) { e.preventDefault(); onAction(btn); return; }
      if (e.target.id === 'send-sheet') closeSend();
      if (e.target.id === 'load-sheet') closeOverlay('#load-sheet');
      if (e.target.id === 'install-sheet') closeOverlay('#install-sheet');
      if (e.target.id === 'help-sheet') closeHelp();
      if (e.target.id === 'tips-sheet') closeOverlay('#tips-sheet');
      if (e.target.id === 'find-tips-sheet') closeOverlay('#find-tips-sheet');
      if (e.target.id === 'sample-sheet') closeOverlay('#sample-sheet');
      if (e.target.id === 'confirm-sheet' && askSecondary) askSecondary();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var top = ['#confirm-sheet', '#sample-sheet', '#load-sheet', '#install-sheet', '#help-sheet', '#tips-sheet', '#find-tips-sheet', '#send-sheet'].filter(function (id) { return !$(id).hidden; })[0];
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
    else if (location.hash === '#tour' && window.HuddleTour) window.HuddleTour.start();
    else if (!navigator.webdriver) {
      var phoneBrowser = (isIOS || isAndroid) && !isStandalone();
      if (phoneBrowser) { if (!readFlag(HELP_KEY)) openHelp(); }
      else if (window.HuddleTour && !window.HuddleTour.seen()) window.HuddleTour.start();
    }
    window.addEventListener('hashchange', function () { if (location.hash === '#help') openHelp(); });
    // Enter moves to the next field instead of doing nothing
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
