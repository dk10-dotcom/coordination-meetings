/* Weekly Coordination Meeting Agenda
 * Everything runs on the device. Nothing is sent to a server.
 * - The form keeps a temporary draft in this browser tab only (sessionStorage),
 *   so a reload mid-meeting doesn't lose work. It is erased by Send & Clear or Clear.
 * - The ward name is remembered on this device (localStorage) for convenience.
 * - Send builds a flattened PDF with pdf-lib and hands it to the phone's share menu.
 *   A copy of the form data is tucked into the PDF so "Load last week" can read it back.
 */
'use strict';
(function () {
  var APP_ID = 'huddle-agenda';
  var DATA_VERSION = 1;
  var DRAFT_KEY = 'huddle-draft-v1';
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
    { id: 'hc', label: 'High Councilman' }
  ];
  var GROUPS = [
    { id: 'nm', title: 'New members' },
    { id: 'rm', title: 'Returning members' },
    { id: 'bt', title: 'Those being taught' }
  ];
  var SOURCE = { nm: 'New members', rm: 'Returning members', bt: 'Those being taught', tn: '3 Names' };

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
  // Every name card (Covenant Path lists and 3 Names) has the same fields.
  var CARD_KEYS = ['name', 'bap', 'ordinance', 'need', 'action', 'assigned', 'when'];
  function blankAction() { return { name: '', sac: false, bap: '', temple: false, ordinance: '', need: '', action: '', assigned: '', when: '' }; }
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
      tnDone: false, tn: [blankName(), blankName(), blankName()],
      ftDone: false
    };
  }
  function cleanList(list, maker, keys) {
    if (!Array.isArray(list)) return [maker()];
    var out = list.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      var o = maker();
      keys.forEach(function (k) { o[k] = str(x[k]); });
      o.sac = !!x.sac; o.temple = !!x.temple;
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
          o.group = ['nm', 'rm', 'bt', 'tn'].indexOf(r.group) >= 0 ? r.group : '';
          o.pname = str(r.pname); o.ord = str(r.ord); o.need = str(r.need); o.sac = !!r.sac; o.bap = str(r.bap); o.temple = !!r.temple; o.carriedFwd = !!r.carriedFwd;
        }
        return o;
      });
      if (!f.rr.length) f.rr = [blankRR()];
    }
    f.loaded = s.loaded && typeof s.loaded === 'object'
      ? { fileName: str(s.loaded.fileName), ward: str(s.loaded.ward), date: str(s.loaded.date), count: +s.loaded.count || 0 }
      : null;
    f.cpDone = !!s.cpDone; f.tnDone = !!s.tnDone; f.ftDone = !!s.ftDone;
    var cp = s.cp || {};
    GROUPS.forEach(function (g) {
      var raw = Array.isArray(cp[g.id]) ? cp[g.id] : [];
      f.cp[g.id] = cleanList(raw, blankAction, CARD_KEYS);
      f.cp[g.id].forEach(function (a, i) { if (raw[i] && raw[i].carried) a.carried = true; });
    });
    var tn = cleanList(s.tn, blankName, CARD_KEYS);
    while (tn.length < 3) tn.push(blankName());
    f.tn = tn.slice(0, 3);
    return f;
  }

  var state = normalizeState(readJSON('sessionStorage', DRAFT_KEY));
  var draftTimer = null;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () { writeJSON('sessionStorage', DRAFT_KEY, state); }, 250);
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
    if (s.rr.some(rrHasInput)) return false;
    if (GROUPS.some(function (g) { return s.cp[g.id].some(function (a) { return a.sac || hasText(a, CARD_KEYS); }); })) return false;
    if (s.tn.some(function (n) { return n.sac || hasText(n, CARD_KEYS); })) return false;
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
    check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 5l8 8M13 5l-8 8"/></svg>'
  };
  function icon(name, cls) { var s = h('span', { class: cls || null, 'aria-hidden': 'true' }); s.innerHTML = ICONS[name]; return s; }
  function field(label, path, opts) {
    opts = opts || {};
    return h('label', { class: 'field' + (opts.full ? ' full' : '') }, [
      opts.tag ? h('span', { class: 'label-row' }, [label, opts.tag]) : label,
      h('input', {
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
    var many = state.rr.length > 1;
    list.replaceChildren.apply(list, state.rr.map(function (r, i) {
      var gid = r.prefilled ? groupOf(r) : '';
      var head = h('div', { class: 'card-head' }, [
        // "Return and Report" on every card, so a long list still says where you are.
        h('div', { class: 'card-title' }, [
          avatar(),
          h('div', { class: 'card-title-text' }, [
            h('p', { class: 'card-kicker', text: 'Return and Report' }),
            h('p', { class: 'card-item', text: 'Item ' + (i + 1) })
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
          str(r.need).trim() ? h('span', { class: 'fact' }, [h('b', { text: 'Need: ' }), r.need.trim()]) : null,
          r.sac ? h('span', { class: 'fact sac' }, ['✓ Attended sacrament']) : null,
          gid === 'nm' ? (function () {
            var st = templeStatus(r, state.date);
            return h('span', { class: 'fact ' + (st.done ? 'sac' : 'temple-due') }, st.done ? ['✓ Temple attendance done'] : [h('b', { text: 'Temple attendance: ' }), st.short]);
          })() : null
        ].filter(Boolean);
        body = h('div', { class: 'prefill' }, [
          gid ? h('span', { class: 'group-tag', text: SOURCE[gid] }) : null,
          // Name and next ordinance share a line; a long name pushes the tag to the next line.
          pname || ordTag ? h('div', { class: 'person-line' }, [pname ? h('p', { class: 'prefill-person', text: pname }) : null, ordTag]) : null,
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
      if (r.prefilled && (r.happened === 'Partly' || r.happened === 'No') && groupOf(r)) {
        if (r.carriedFwd) {
          carry = h('p', { class: 'carried-note', text: '✓ Added to this week’s plan' });
        } else {
          carry = h('button', { type: 'button', class: 'btn-outline full btn-carry', 'data-action': 'carry-fwd', 'data-a': i, text: 'Carry forward to this week' });
        }
      }
      return h('div', { class: 'card rr-card' + (gid ? ' g-' + gid : ''), 'data-status': statusOf(r.happened) }, [head, body, seg, carry, field('Notes', 'rr.' + i + '.notes', { placeholder: 'Optional' })]);
    }));
    $('#load-panel').hidden = !!state.loaded;
    $('#loaded-banner').hidden = !state.loaded;
    if (state.loaded) {
      var L = state.loaded;
      var bits = [L.fileName || 'Last week’s PDF'];
      bits.push(L.count + (L.count === 1 ? ' action item' : ' action items'));
      $('#loaded-sub').textContent = bits.join(' · ');
    }
  }

  function statusOf(v) { return { Yes: 'yes', Partly: 'partly', No: 'no' }[v] || ''; }
  // A numbered circle plus a small label at the top of each card.
  // A person icon in the list's color marks each name card.
  function avatar() {
    var a = h('span', { class: 'card-num card-avatar', 'aria-hidden': 'true' });
    a.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="6.6" r="3.6"/><path d="M2.8 17.4c.7-3.6 3.6-5.8 7.2-5.8s6.5 2.2 7.2 5.8c.1.5-.3.9-.8.9H3.6c-.5 0-.9-.4-.8-.9z"/></svg>';
    return a;
  }
  function cardLabel(n, label, extra) {
    return h('div', { class: 'card-title' }, [
      avatar(),
      label ? h('p', { class: 'card-label', text: label }) : null,
      extra || null
    ]);
  }
  // The fields on every name card, in meeting order.
  function cardFields(base, nameLabel, namePh, whenPh, tag, withBap) {
    return h('div', { class: 'card-grid' }, [
      field(nameLabel, base + 'name', { placeholder: namePh, cap: 'words', full: true, tag: tag }),
      withBap ? field('Baptism date', base + 'bap', { type: 'date', full: true }) : null,
      field('Next ordinance', base + 'ordinance', { placeholder: 'e.g. Baptism', full: true }),
      field('Need', base + 'need', { full: true, placeholder: 'e.g. A ride to church' }),
      field('Action item for this week', base + 'action', { full: true, placeholder: 'What will we do to help?' }),
      // Assigned to gets the wider share of its row; When is usually a day or two words.
      h('div', { class: 'assign-row' }, [
        field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
        field('When', base + 'when', { placeholder: whenPh })
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
  function countNamed(gid) { return state.cp[gid].filter(function (it) { return str(it.name).trim(); }).length; }
  function countText(n) { return n === 1 ? '1 person' : n + ' people'; }
  function updateListCount(gid) {
    var el = document.querySelector('.list-' + gid + ' .list-count');
    if (el) el.textContent = countText(countNamed(gid));
  }
  function renderCP() {
    var wrap = $('#cp-groups');
    wrap.replaceChildren.apply(wrap, GROUPS.map(function (g) {
      var items = state.cp[g.id];
      var many = items.length > 1;
      var cards = items.map(function (it, i) {
        var base = 'cp.' + g.id + '.' + i + '.';
        return h('div', { class: 'card' }, [
          h('div', { class: 'card-head' }, [
            cardLabel(i + 1, ''),
            h('div', { class: 'card-head-right' }, [
              sacToggle(base + 'sac', it.sac),
              many ? removeButton('remove-cp', g.id, i, 'Remove action ' + (i + 1) + ' for ' + g.title) : null
            ])
          ]),
          g.id === 'nm' ? templeBox(base, i, it) : null,
          cardFields(base, 'Name', 'Person from the list', 'e.g. Tue', it.carried ? h('span', { class: 'source', text: 'From last week' }) : null, g.id === 'nm')
        ]);
      });
      var named = countNamed(g.id);
      var head = h('div', { class: 'list-head' }, [
        h('h3', { class: 'list-title', text: g.title }),
        h('span', { class: 'list-count', text: countText(named) })
      ]);
      var extra = g.id === 'nm' ? [
        h('p', { class: 'temple-goal', text: 'Goal: every new member attends the temple for baptisms for the dead within 30 days of their baptism.' }),
        h('p', { class: 'temple-summary', id: 'temple-summary', hidden: true })
      ] : [];
      return h('section', { class: 'list-panel list-' + g.id, 'data-group': g.id, 'aria-label': g.title }, [head]
        .concat(extra).concat(cards).concat([addButton('add-cp', g.id, 'Add action')]));
    }));
    updateTemple();
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
  function updateTemple() {
    var waiting = 0, late = 0;
    state.cp.nm.forEach(function (it, i) {
      var st = templeStatus(it, state.date);
      var box = document.querySelector('[data-group="nm"] [data-temple="' + i + '"]');
      if (box) {
        box.classList.toggle('is-done', st.done);
        box.querySelector('.temple-sub').textContent = st.done ? '✓ Baptisms for the dead done' : st.text;
      }
      if (str(it.name).trim() && !st.done) { waiting++; if (st.left !== undefined && st.left < 0) late++; }
    });
    var sum = $('#temple-summary');
    if (sum) {
      sum.hidden = !waiting;
      sum.textContent = waiting + (waiting === 1 ? ' new member needs' : ' new members need') + ' temple attendance' + (late ? ' · ' + late + ' past 30 days' : '');
    }
  }
  function renderTN() {
    var wrap = $('#tn-list');
    var cards = state.tn.map(function (n, i) {
      var base = 'tn.' + i + '.';
      return h('div', { class: 'card' }, [
        h('div', { class: 'card-head' }, [
          cardLabel(i + 1, 'Name ' + (i + 1)),
          h('div', { class: 'card-head-right' }, [sacToggle(base + 'sac', n.sac)])
        ]),
        cardFields(base, 'Focus name', 'Full name', 'e.g. Sun')
      ]);
    });
    var head = h('div', { class: 'list-head' }, [
      h('h3', { class: 'list-title', text: 'Focus names' }),
      h('span', { class: 'list-count', text: tnCountText() })
    ]);
    wrap.replaceChildren(h('section', { class: 'list-panel list-tn', 'aria-label': '3 Names Next Ordinance' }, [head].concat(cards)));
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
    renderAttendees(); renderRR(); renderCP(); renderTN();
  }

  /* ---------- toast & sheets ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
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
    if (!document.querySelector('.overlay:not([hidden])')) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  var askSecondary = null;
  function ask(opts) {
    $('#confirm-title').textContent = opts.title;
    $('#confirm-body').textContent = opts.body || '';
    $('#confirm-body').hidden = !opts.body;
    var cmp = $('#confirm-compare');
    if (opts.compare && opts.compare.length) {
      cmp.replaceChildren.apply(cmp, opts.compare.map(function (row) {
        return h('div', { class: 'compare-row' }, [h('span', { text: row[0] }), h('span', { text: row[1] })]);
      }));
      cmp.hidden = false;
    } else { cmp.hidden = true; cmp.replaceChildren(); }
    var p = $('#confirm-primary'), s = $('#confirm-secondary');
    p.textContent = opts.primary || 'OK';
    p.onclick = function () { closeOverlay('#confirm-sheet'); if (opts.onPrimary) opts.onPrimary(); };
    if (opts.secondary) {
      s.hidden = false; s.textContent = opts.secondary;
      askSecondary = function () { closeOverlay('#confirm-sheet'); if (opts.onSecondary) opts.onSecondary(); };
      s.onclick = askSecondary;
    } else { s.hidden = true; s.onclick = null; askSecondary = null; }
    openOverlay('#confirm-sheet', '#confirm-primary');
  }

  /* ---------- actions ---------- */
  // keepWard: Send & Clear keeps the ward for next week; the Clear button erases it too.
  function clearForm(keepWard) {
    removeKey('sessionStorage', DRAFT_KEY);
    if (!keepWard) { removeKey('localStorage', WARD_KEY); removeKey('localStorage', 'huddle-conducting'); }
    state = freshState();
    renderAll();
    window.scrollTo(0, 0);
  }

  function focusLast(selector) {
    var els = document.querySelectorAll(selector);
    var el = els[els.length - 1];
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { el.focus({ preventScroll: true }); }, 250); }
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
      case 'remove-rr':
        state.rr.splice(+a, 1);
        if (!state.rr.length) state.rr.push(blankRR());
        if (state.loaded && !state.rr.some(function (x) { return x.prefilled; })) state.loaded = null;
        renderRR(); saveDraft(); break;
      case 'add-cp':
        state.cp[a].push(blankAction()); renderCP(); saveDraft();
        focusLast('[data-group="' + a + '"] input[data-bind$=".name"]'); break;
      case 'remove-cp':
        state.cp[a].splice(+b, 1);
        if (!state.cp[a].length) state.cp[a].push(blankAction());
        renderCP(); saveDraft(); break;
      case 'load':
        if (state.rr.some(rrHasInput)) {
          ask({
            title: 'Replace the items below?',
            body: 'Loading last week replaces what you’ve typed in Return and Report.',
            primary: 'Choose last week', onPrimary: openLoad,
            secondary: 'Cancel'
          });
        } else openLoad();
        break;
      case 'carry-fwd': carryForward(+a); break;
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
          renderAll(); saveDraft(); window.scrollTo(0, 0);
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
      case 'tips': openOverlay('#tips-sheet', '#tips-title'); $('#tips-sheet .sheet').scrollTop = 0; break;
      case 'close-tips': closeOverlay('#tips-sheet'); break;
      case 'install': addToHomeScreen(); break;
      case 'close-install': closeOverlay('#install-sheet'); break;
      case 'dismiss-install':
        $('#install-banner').hidden = true;
        writeJSON('sessionStorage', 'huddle-install-dismissed', true);
        break;
      case 'unload': {
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
          body: 'Everything you’ve entered will be erased. This can’t be undone.',
          primary: 'Clear form', onPrimary: function () { clearForm(false); toast('Form cleared.'); },
          secondary: 'Cancel'
        });
        break;
      case 'send': startSend(); break;
      case 'share': sharePdf(); break;
      case 'save-only': saveWithoutSending(); break;
      case 'clear-now': closeSend(); clearForm(true); toast('Form cleared for next week.'); break;
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
    return items;
  }
  // One of last week's name cards, as a Return and Report item (all of its fields come along).
  function itemFrom(a, gid) {
    var name = str(a.name).trim(), ord = str(a.ordinance).trim();
    return {
      source: SOURCE[gid], group: gid, pname: name, ord: ord, need: str(a.need).trim(), sac: !!a.sac,
      bap: gid === 'nm' ? str(a.bap) : '', temple: gid === 'nm' && !!a.temple,
      person: ord ? (name ? name + ' · ' : '') + 'Next: ' + ord : name,
      action: str(a.action).trim(), assigned: str(a.assigned).trim(), when: str(a.when).trim()
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
        if (n && names.every(function (x) { return norm(x) !== norm(n); })) { names.push(n); info[norm(n)] = { ordinance: str(a.ordinance).trim(), need: str(a.need).trim(), bap: str(a.bap), temple: !!a.temple }; }
      });
      if (!names.length) return;
      var cur = state.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      names.forEach(function (n) {
        if (cur.some(function (a) { return norm(a.name) === norm(n); })) return;
        var c = blankAction(); c.name = n; c.ordinance = info[norm(n)].ordinance; c.need = info[norm(n)].need; c.carried = true;
        if (g.id === 'nm') { c.bap = info[norm(n)].bap; c.temple = info[norm(n)].temple; }
        cur.push(c);
        added++;
      });
      state.cp[g.id] = cur.length ? cur : [blankAction()];
    });
    return added;
  }

  function groupOf(r) {
    if (r.group) return r.group;
    return { 'New members': 'nm', 'Returning members': 'rm', 'Those being taught': 'bt', 'Three Names': 'tn', '3 Names': 'tn' }[r.source] || '';
  }
  // Copies an unfinished item from last week into this week's plan for the same person.
  function carryForward(i) {
    var r = state.rr[i]; if (!r) return;
    var g = groupOf(r);
    var name = str(r.pname).trim() || str(r.person).split(' · Next: ')[0].trim();
    var ord = str(r.ord).trim() || (str(r.person).split(' · Next: ')[1] || '').trim();
    var item = blankAction();
    item.name = name; item.ordinance = ord; item.need = str(r.need).trim(); item.action = str(r.action).trim(); item.assigned = str(r.assigned).trim();
    if (g === 'nm') { item.bap = str(r.bap); item.temple = !!r.temple; }
    if (g === 'tn') {
      var slot = state.tn.findIndex(function (n) { return name && norm(n.name) === norm(name); });
      if (slot < 0) slot = state.tn.findIndex(function (n) { return !n.sac && !hasText(n, CARD_KEYS); });
      if (slot < 0) { toast('All three 3 Names spots are already filled.'); return; }
      var t = state.tn[slot];
      t.name = t.name || name; t.ordinance = t.ordinance || ord; t.need = t.need || item.need;
      if (!str(t.action).trim()) { t.action = item.action; t.assigned = t.assigned || item.assigned; }
      renderTN();
    } else if (g) {
      var list = state.cp[g];
      var match = list.find(function (a) { return name && norm(a.name) === norm(name) && !hasText(a, ['action']); });
      if (match) {
        match.action = item.action; match.assigned = match.assigned || item.assigned;
        match.ordinance = match.ordinance || item.ordinance; match.need = match.need || item.need;
        if (g === 'nm') { match.bap = match.bap || item.bap; match.temple = match.temple || item.temple; }
      }
      else {
        if (list.length === 1 && !list[0].sac && !hasText(list[0], CARD_KEYS)) list.pop();
        item.carried = true; list.push(item);
      }
      renderCP();
    } else return;
    r.carriedFwd = true;
    renderRR(); saveDraft();
    toast('Added to this week’s plan. Update who and when as needed.');
  }

  function applyLoad(data, fileName) {
    var items = extractActionItems(data);
    if (!items.length) {
      ask({ title: 'Nothing to load', body: 'Last week’s agenda doesn’t have any action items filled in.', primary: 'OK' });
      return;
    }
    state.rr = items.map(function (it) {
      return { prefilled: true, source: it.source, group: it.group, pname: it.pname, ord: it.ord, need: it.need || '', sac: !!it.sac, bap: it.bap || '', temple: !!it.temple, person: it.person, action: it.action, assigned: it.assigned, when: it.when, plan: '', happened: '', notes: '' };
    });
    state.loaded = { fileName: fileName, ward: str(data.ward), date: str(data.date), count: items.length };
    if (!state.ward.trim() && data.ward) { state.ward = str(data.ward); $('#ward').value = state.ward; writeWard(state.ward); }
    var carried = carryNames(data);
    renderRR(); renderCP(); saveDraft();
    toast('Loaded ' + items.length + (items.length === 1 ? ' action item' : ' action items') +
      (carried ? ' and ' + carried + (carried === 1 ? ' name' : ' names') : '') + ' from last week.');
    var sec = $('#h-rr'); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (carried && !readFlag(NAMES_HINT_KEY)) {
      writeFlag(NAMES_HINT_KEY);
      ask({
        title: 'Check the names that carried over',
        body: 'Last week’s names are now in Covenant Path Report Review. Compare them to this week’s Covenant Path Report: add anyone new and remove anyone no longer listed.',
        primary: 'Show me the names', onPrimary: function () {
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
    checkAndApply(data, f.name, pickFile);
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
        title: 'No saved agendas to load',
        body: 'There are no agendas saved on this phone yet. Each agenda you send is saved here for 4 weeks. If last week’s PDF is in your email or Files, choose Load from a file.',
        primary: 'OK',
        secondary: 'Load from a file', onSecondary: pickFile
      });
      return;
    }
    savedById = {};
    var wrap = $('#agenda-list');
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
    }));
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
      hudFill: rgb(0.988, 0.929, 0.898), hudLine: rgb(0.878, 0.4, 0.18), amber: rgb(1, 0.973, 0.902), amberLine: rgb(0.922, 0.796, 0.478)
    };
    // Each Covenant Path list gets its own color on the PDF, matching the form.
    var GROUP_PDF = {
      nm: { fill: rgb(0.929, 0.949, 0.980), ink: rgb(0.18, 0.333, 0.592) },
      rm: { fill: rgb(0.929, 0.965, 0.941), ink: rgb(0.122, 0.42, 0.227) },
      bt: { fill: rgb(0.957, 0.933, 0.976), ink: rgb(0.478, 0.247, 0.62) },
      tn: { fill: rgb(1, 0.973, 0.902), ink: rgb(0.62, 0.42, 0.02) }
    };
    // Name card tables: Name | Attended sacrament | Next ordinance | Need | Action | Assigned to | When
    var CARD_COLS = [48, 132, 194, 256, 332, 450, 516];
    var CARD_HEADS = ['ATTENDED\nSACRAMENT', 'NEXT\nORDINANCE', 'NEED', 'ACTION ITEM\nFOR THIS WEEK', 'ASSIGNED\nTO', 'WHEN'];
    var TEMPLE_RED = rgb(0.70, 0.16, 0.16);
    function cardRow(a, gid) {
      var sub = null;
      if (gid === 'nm' && (str(a.name).trim() || a.bap)) {
        var st = templeStatus(a, s.date);
        sub = { text: 'Temple: ' + (st.left === undefined && !st.done ? 'no date' : st.short), color: st.done ? STATUS_PDF.Yes : TEMPLE_RED };
      }
      return { boldFirst: true, sub: sub, cells: [str(a.name).trim(), { check: !!a.sac }, str(a.ordinance).trim(), str(a.need).trim(), str(a.action).trim(), str(a.assigned).trim(), str(a.when).trim()] };
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
    function heading(label, note) {
      ensure(40);
      var e = tx(L, y + 9, label, F.bold, 11.5, C.blue);
      if (note) tx(e + 6, y + 9, note, F.ital, 9, C.gray);
      hline(L, R, y + 14);
      y += 14;
    }

    // Tables
    function table(cols, headers, rows) {
      var edges = cols.concat([R]);
      var FS = 8.5, LH = 10.5;
      // A header can take two lines ("ATTENDED\nSACRAMENT") so narrow columns stay readable.
      var headLines = headers.map(function (t) { return t.split('\n'); });
      var HH = headLines.some(function (l) { return l.length > 1; }) ? 23 : 14;
      function drawHeader() {
        box(L, y, R - L, HH, { color: C.head });
        headLines.forEach(function (ls, i) { ls.forEach(function (t, k) { tx(edges[i] + 5, y + 10 + k * 9, t, F.bold, 8, C.navy); }); });
        hline(L, R, y); hline(L, R, y + HH);
        edges.forEach(function (x) { vline(x, y, y + HH); });
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
        var cells = row.cells.map(function (c, i) {
          var maxW = edges[i + 1] - edges[i] - 10;
          if (c && typeof c === 'object' && 'check' in c) return { box: true, on: !!c.check, lines: [] };
          if (Array.isArray(c)) return segWrap(c, maxW);
          var font = row.boldFirst && i === 0 ? F.bold : F.reg;
          return { font: font, lines: wrap(c, font, FS, maxW) };
        });
        var n = Math.max.apply(null, cells.map(function (c) { return c.lines.length; }));
        var subLines = null;
        if (row.sub) {
          subLines = wrap(row.sub.text, F.bold, 7.5, edges[1] - edges[0] - 10);
          n = Math.max(n, cells[0].lines.length + subLines.length * 0.85);
        }
        return { h: Math.max(18, Math.ceil(n * LH + 7)), cells: cells, subLines: subLines };
      }
      var first = rows.length ? rowLayout(rows[0]) : { h: 18 };
      ensure(HH + first.h + 4);
      drawHeader();
      rows.forEach(function (row) {
        var lay = rowLayout(row);
        if (y + lay.h > H - BOTTOM) { newPage(true); drawHeader(); }
        if (row.group) {
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
              // A small box, ticked when the person attended sacrament meeting.
              var bx = (edges[i] + edges[i + 1]) / 2 - 4.5, by = y + 4.5;
              page.drawRectangle({ x: bx, y: H - (by + 9), width: 9, height: 9, borderColor: C.gray, borderWidth: 0.8 });
              if (c.on) {
                page.drawLine({ start: { x: bx + 1.8, y: H - (by + 4.8) }, end: { x: bx + 3.8, y: H - (by + 7) }, thickness: 1.4, color: STATUS_PDF.Yes });
                page.drawLine({ start: { x: bx + 3.8, y: H - (by + 7) }, end: { x: bx + 7.6, y: H - (by + 2) }, thickness: 1.4, color: STATUS_PDF.Yes });
              }
              return;
            }
            c.lines.forEach(function (ln, k) {
              if (!c.seg) {
                var isStatus = row.status && i === 1 && STATUS_PDF[row.status];
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
          if (lay.subLines) {
            var sy = y + 11.5 + lay.cells[0].lines.length * LH;
            lay.subLines.forEach(function (ln, k) { tx(edges[0] + 5, sy + k * 9, ln, F.bold, 7.5, row.sub.color); });
          }
          edges.forEach(function (x) { vline(x, y, y + lay.h); });
        }
        hline(L, R, y + lay.h);
        y += lay.h;
      });
    }

    /* ----- page 1 header ----- */
    newPage(false);
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
    heading('Attendees', 'Make an extra effort to involve the youth');
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
        checkbox(xs[i], ab, s.attendees.indexOf(a.id) >= 0);
        tx(xs[i] + 14.6, ab, a.label, fontFor(a), 9.5, C.dark);
      });
      ab += 14;
    });
    y = ab - 14 + 8;

    /* ----- Return and Report ----- */
    y += 12;
    heading('Return and Report');
    var qb = y + 13;
    tx(L, qb, 'Did last week’s plan happen?', F.bold, 9.5, C.dark);
    y = qb + 8;
    var rrRows = s.rr.filter(function (r) { return r.prefilled || rrHasInput(r); }).map(function (r) {
      var plan;
      if (r.prefilled) {
        // The person's name is bold, like the names in the other tables.
        var parts = str(r.person).split(' · Next: ');
        var name = (str(r.pname).trim() || parts[0]).trim();
        var ord = (str(r.ord).trim() || (parts[1] || '')).trim();
        var info = [r.source];
        if (ord) info.push('next: ' + ord);
        if (str(r.need).trim()) info.push('need: ' + r.need.trim());
        if (r.sac) info.push('attended sacrament');
        if (groupOf(r) === 'nm') { var tst = templeStatus(r, s.date); info.push('temple attendance: ' + tst.short); }
        var rest = (name ? ' (' + info.join('; ') + '): ' : info.join('; ') + ': ') + (str(r.action).trim() || 'No action item written');
        var meta = [];
        if (str(r.assigned).trim()) meta.push('Assigned to ' + r.assigned.trim());
        if (str(r.when).trim()) meta.push(r.when.trim());
        if (meta.length) rest += ' — ' + meta.join(', ');
        plan = name ? [{ t: name, bold: true }, { t: rest, bold: false }] : [{ t: rest, bold: false }];
      } else plan = str(r.plan).trim();
      return { gid: r.prefilled ? groupOf(r) : '', status: r.happened || '', cells: [plan, r.happened || '', str(r.notes).trim()] };
    });
    if (!rrRows.length) rrRows = [{ cells: ['', '', ''] }];
    table([48, 318, 388], ['LAST WEEK’S PLAN', 'HAPPENED?', 'NOTES'], rrRows);

    /* ----- Covenant Path Report Review ----- */
    y += 16;
    heading('Covenant Path Report Review');
    ensure(74);
    var b2 = y + 13;
    // Each line starts with a bold lead-in, like the form.
    function lead(boldText, rest) {
      var e = tx(L, b2, boldText, F.bold, 9, C.dark);
      tx(e + 2.5, b2, rest, F.reg, 9, C.dark);
      b2 += 12;
    }
    lead('Open the Covenant Path Report', '(found in Tools).');
    lead('Review each list:', 'New Members, Returning Members, and Those Being Taught.');
    lead('For each person,', 'check Attended sacrament if they were there.');
    tx(L, b2, 'Open their details to identify their next ordinance and identify a need.', F.reg, 9, C.dark);
    b2 += 12;
    lead('Make a plan:', 'What is one thing we can do this week to help? Who will do it, and when?');
    b2 -= 12;
    y = b2 + 9;
    var cpRows = [];
    GROUPS.forEach(function (g) {
      cpRows.push({ group: g.title, gid: g.id });
      var filled = s.cp[g.id].filter(function (a) { return a.sac || hasText(a, CARD_KEYS); });
      if (!filled.length) cpRows.push(cardRow(blankAction()));
      filled.forEach(function (a) { cpRows.push(cardRow(a, g.id)); });
    });
    table(CARD_COLS, ['NAME'].concat(CARD_HEADS), cpRows);

    // Three Names (same header style as Covenant Path Report Review)
    y += 13;
    heading('3 Names Next Ordinance (Ward Council Focus Names)');
    ensure(50);
    b2 = y + 13;
    tx(L, b2, 'Open the 3 Names Next Ordinance spreadsheet.', F.reg, 9, C.dark);
    b2 += 12;
    var e2;
    tx(L, b2, 'Review each name and add it below with its next ordinance.', F.reg, 9, C.dark);
    b2 += 12;
    tx(L, b2, 'Make a plan: What is one action we can take to help them progress? Who will do it, and when?', F.reg, 9, C.gray);
    y = b2 + 9;
    table(CARD_COLS, ['FOCUS NAME'].concat(CARD_HEADS),
      s.tn.map(function (n) { var row = cardRow(n); row.gid = 'tn'; return row; }));

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
              group: r.group || '', pname: r.pname || '', ord: r.ord || '', need: r.need || '', sac: !!r.sac, bap: r.bap || '', temple: !!r.temple, carriedFwd: !!r.carriedFwd }
          : { plan: r.plan, happened: r.happened, notes: r.notes };
      }),
      cpDone: s.cpDone, cp: s.cp, tnDone: s.tnDone, tn: s.tn, ftDone: s.ftDone
    }));
  }

  /* ---------- Send & Clear ---------- */
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

  var SHARE_HINT = 'Your share menu opens. Pick Mail, Messages, or any app you use. A copy is saved in this app for 4 weeks, then the form clears.';
  function resetSendSheet() {
    sendFile = null; sendPayload = null;
    $('#send-title').textContent = resending ? 'Share this agenda again' : 'Send this week’s agenda';
    $('#share-btn').disabled = true; $('#share-btn').textContent = 'Share PDF';
    $('#share-hint').textContent = resending ? 'Your share menu opens. The form on your screen isn’t changed.' : SHARE_HINT;
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
    if (!state.ward.trim()) {
      ask({ title: 'Add your ward name first', body: 'The ward name goes on the PDF and helps you load the right agenda next week.', primary: 'OK', onPrimary: function () { $('#ward').focus(); } });
      return false;
    }
    if (!parseISO(state.date)) {
      ask({ title: 'Add the meeting date first', primary: 'OK', onPrimary: function () { $('#date').focus(); } });
      return false;
    }
    if (isEmpty(state)) {
      ask({ title: 'Nothing to ' + verb + ' yet', body: 'Fill in the agenda first.', primary: 'OK' });
      return false;
    }
    return true;
  }

  // src = a saved agenda to share again; otherwise the form on screen.
  async function startSend(src) {
    resending = !!src;
    if (!resending && !readyToSave('send')) return;
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
          : 'Saves the PDF to your Downloads. Attach it to an email or message, then clear the form. A copy is also saved in this app for 4 weeks.';
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
    var ok = await rememberAgenda();
    $('#after-download').hidden = false;
    if (!ok) toast('This phone couldn’t keep a saved copy.');
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
      var ok = await rememberAgenda();
      closeSend(); clearForm(true);
      toast(ok ? 'Shared and saved. The form is cleared for next week.' : 'Shared. This phone couldn’t keep a saved copy.');
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

  function closeSend() { closeOverlay('#send-sheet'); sendFile = null; sendPayload = null; resending = false; }

  /* ---------- wiring ---------- */
  function init() {
    if (typeof PDFLib === 'undefined') {
      toast('Something didn’t load. Check your connection and reload the page.');
    }
    fileInput = $('#file-input');
    fileInput.addEventListener('change', onFilePicked);
    renderAll();

    var onEdit = function (e) {
      var t = e.target;
      var path = t && t.getAttribute && t.getAttribute('data-bind');
      if (!path) return;
      var val = t.type === 'checkbox' ? t.checked : t.value;
      setPath(path, val);
      if (path === 'ward') writeWard(String(val).trim());
      if (path === 'date') renderDateHint();
      if (path === 'conductingOther') writeConducting(state);
      if (/^cp\.\w+\.\d+\.name$/.test(path)) updateListCount(path.split('.')[1]);
      if (/^cp\.nm\.\d+\.(name|bap|temple)$/.test(path) || path === 'date') { updateTemple(); if (path === 'date') renderRR(); }
      if (/^tn\.\d+\.name$/.test(path)) { var tc = document.querySelector('.list-tn .list-count'); if (tc) tc.textContent = tnCountText(); }
      saveDraft();
    };
    // Save the draft right away if the app is closed or put in the background.
    var flushDraft = function () { clearTimeout(draftTimer); writeJSON('sessionStorage', DRAFT_KEY, state); };
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
      if (e.target.id === 'confirm-sheet' && askSecondary) askSecondary();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var top = ['#confirm-sheet', '#load-sheet', '#install-sheet', '#help-sheet', '#tips-sheet', '#send-sheet'].filter(function (id) { return !$(id).hidden; })[0];
      if (top) dismissSheet(top);
    });
    enableSwipeDown();

    // While the keyboard is up, the bottom bar stops floating so it doesn't jump around.
    var typingTimer = null;
    document.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('#form input[type="text"], #form input[type="date"]')) {
        clearTimeout(typingTimer);
        document.body.classList.add('typing');
      }
    });
    document.addEventListener('focusout', function () {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () {
        var a = document.activeElement;
        if (!(a && a.matches && a.matches('#form input[type="text"], #form input[type="date"]'))) document.body.classList.remove('typing');
      }, 150);
    });

    // Phones opened in the browser (not the Home Screen app) get the Add to Home Screen banner.
    if ((isIOS || isAndroid) && !isStandalone()) showInstallBanner();

    // Erase saved agendas older than 4 weeks each time the app opens.
    listAgendas();

    // Instructions: open on the first visit on this device, or when the link ends in #help.
    if (location.hash === '#help' || (!readFlag(HELP_KEY) && !navigator.webdriver)) openHelp();
    window.addEventListener('hashchange', function () { if (location.hash === '#help') openHelp(); });
    // Enter moves to the next field instead of doing nothing
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('#form input[type="text"]')) return;
      e.preventDefault();
      var inputs = Array.prototype.slice.call(document.querySelectorAll('#form input[type="text"], #form input[type="date"]'));
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
