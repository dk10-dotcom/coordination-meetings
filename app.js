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
  var STAKE = 'Riverton Utah South Stake';
  var DOC_TITLE = 'Weekly Coordination Meeting Agenda';
  var MAX_AGE_DAYS = 14;

  var ATTENDEES = [
    { id: 'pqa', label: 'Priests quorum assistants', youth: true },
    { id: 'gol', label: 'Gatherers of Light reps', youth: true },
    { id: 'rs', label: 'Relief Society' },
    { id: 'eq', label: 'Elders Quorum' },
    { id: 'pp', label: 'Primary presidency rep.' },
    { id: 'wm', label: 'Ward missionaries' },
    { id: 'ftm', label: 'Full-time missionaries' },
    { id: 'wml', label: 'Ward mission leader' },
    { id: 'tfhl', label: 'TFH leader' },
    { id: 'tfhc', label: 'TFH consultants' }
  ];
  var GROUPS = [
    { id: 'nm', title: 'New members' },
    { id: 'rm', title: 'Returning members' },
    { id: 'bt', title: 'Those being taught' }
  ];
  var SOURCE = { nm: 'New members', rm: 'Returning members', bt: 'Those being taught', tn: 'Three Names' };

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

  /* ---------- state ---------- */
  function blankRR() { return { plan: '', happened: '', notes: '' }; }
  function blankAction() { return { name: '', action: '', assigned: '', when: '' }; }
  function blankName() { return { name: '', ordinance: '', action: '', assigned: '', when: '' }; }
  function freshState() {
    return {
      ward: readWard(), date: todayISO(), attendees: [],
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
      return o;
    });
    return out.length ? out : [maker()];
  }
  function normalizeState(s) {
    var f = freshState();
    if (!s || typeof s !== 'object') return f;
    f.ward = str(s.ward) || f.ward;
    f.date = parseISO(s.date) ? s.date : f.date;
    f.attendees = Array.isArray(s.attendees) ? s.attendees.filter(function (id) { return ATTENDEES.some(function (a) { return a.id === id; }); }) : [];
    if (Array.isArray(s.rr) && s.rr.length) {
      f.rr = s.rr.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
        var o = { plan: str(r.plan), happened: ['Yes', 'Partly', 'No'].indexOf(r.happened) >= 0 ? r.happened : '', notes: str(r.notes) };
        if (r.prefilled) {
          o.prefilled = true; o.source = str(r.source); o.person = str(r.person);
          o.action = str(r.action); o.assigned = str(r.assigned); o.when = str(r.when);
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
    GROUPS.forEach(function (g) { f.cp[g.id] = cleanList(cp[g.id], blankAction, ['name', 'action', 'assigned', 'when']); });
    var tn = cleanList(s.tn, blankName, ['name', 'ordinance', 'action', 'assigned', 'when']);
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
    if (GROUPS.some(function (g) { return s.cp[g.id].some(function (a) { return hasText(a, ['name', 'action', 'assigned', 'when']); }); })) return false;
    if (s.tn.some(function (n) { return hasText(n, ['name', 'ordinance', 'action', 'assigned', 'when']); })) return false;
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
      label,
      h('input', {
        type: 'text', 'data-bind': path, value: str(getPath(path)), placeholder: opts.placeholder || '',
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
      var head = h('div', { class: 'card-head' }, [
        h('p', { class: 'card-label', text: 'Plan item ' + (i + 1) }),
        h('div', { class: 'card-head-right' }, [
          r.prefilled && r.source ? h('span', { class: 'source', text: r.source }) : null,
          many ? removeButton('remove-rr', i, '', 'Remove plan item ' + (i + 1)) : null
        ])
      ]);
      var body;
      if (r.prefilled) {
        var meta = prefillMeta(r);
        body = h('div', { class: 'prefill' }, [
          str(r.person).trim() ? h('p', { class: 'prefill-person', text: r.person.trim() }) : null,
          h('p', { text: str(r.action).trim() || 'No action item was written.' }),
          meta ? h('p', { class: 'prefill-meta', text: meta }) : null
        ]);
      } else {
        body = field('Last week’s plan', 'rr.' + i + '.plan', { placeholder: 'What did we plan to do?' });
      }
      var seg = h('div', {}, [
        h('p', { class: 'seg-label', text: 'Happened?' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Did plan item ' + (i + 1) + ' happen?' }, ['Yes', 'Partly', 'No'].map(function (v) {
          return h('button', { type: 'button', 'data-action': 'happened', 'data-a': i, 'data-b': v, 'aria-pressed': r.happened === v ? 'true' : 'false', text: v });
        }))
      ]);
      return h('div', { class: 'card' }, [head, body, seg, field('Notes', 'rr.' + i + '.notes', { placeholder: 'Optional' })]);
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

  function renderCP() {
    var wrap = $('#cp-groups');
    wrap.replaceChildren.apply(wrap, GROUPS.map(function (g) {
      var items = state.cp[g.id];
      var many = items.length > 1;
      var cards = items.map(function (it, i) {
        var base = 'cp.' + g.id + '.' + i + '.';
        return h('div', { class: 'card' }, [
          many ? h('div', { class: 'card-head' }, [
            h('p', { class: 'card-label', text: 'Action ' + (i + 1) }),
            removeButton('remove-cp', g.id, i, 'Remove action ' + (i + 1) + ' for ' + g.title)
          ]) : null,
          h('div', { class: 'card-grid' }, [
            field('Name', base + 'name', { full: true, placeholder: 'Person from the list', cap: 'words' }),
            field('Action item for this week', base + 'action', { full: true, placeholder: 'One next step' }),
            field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
            field('When', base + 'when', { placeholder: 'e.g. Tue evening' })
          ])
        ]);
      });
      return h('div', { class: 'stack', 'data-group': g.id }, [h('p', { class: 'group-title', text: g.title })]
        .concat(cards).concat([addButton('add-cp', g.id, 'Add action')]));
    }));
  }

  function renderTN() {
    var wrap = $('#tn-list');
    wrap.replaceChildren.apply(wrap, state.tn.map(function (n, i) {
      var base = 'tn.' + i + '.';
      return h('div', { class: 'card' }, [
        h('p', { class: 'card-label', text: 'Name ' + (i + 1) + ' of 3' }),
        h('div', { class: 'card-grid' }, [
          field('Focus name', base + 'name', { placeholder: 'Full name', cap: 'words' }),
          field('Next ordinance', base + 'ordinance', { placeholder: 'e.g. Baptism' }),
          field('Action item for this week', base + 'action', { full: true, placeholder: 'One next step' }),
          field('Assigned to', base + 'assigned', { placeholder: 'Who will do it', cap: 'words' }),
          field('When', base + 'when', { placeholder: 'e.g. Sunday' })
        ])
      ]);
    }));
  }

  function renderAll() {
    $('#ward').value = state.ward;
    $('#date').value = state.date;
    $('#cp-done').checked = state.cpDone;
    $('#tn-done').checked = state.tnDone;
    $('#ft-done').checked = state.ftDone;
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
    if ($('#send-sheet').hidden && $('#confirm-sheet').hidden) document.body.style.overflow = '';
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
  function clearForm() {
    removeKey('sessionStorage', DRAFT_KEY);
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
            title: 'Replace the plan items below?',
            body: 'Loading last week replaces what you’ve typed in Return and Report.',
            primary: 'Choose last week’s PDF', onPrimary: pickFile,
            secondary: 'Cancel'
          });
        } else pickFile();
        break;
      case 'unload': {
        var doUnload = function () { state.rr = [blankRR(), blankRR()]; state.loaded = null; renderRR(); saveDraft(); };
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
          primary: 'Clear form', onPrimary: function () { clearForm(); toast('Form cleared.'); },
          secondary: 'Cancel'
        });
        break;
      case 'send': startSend(); break;
      case 'save-copy': saveCopy(); break;
      case 'skip-save': enableShare(); break;
      case 'share': sharePdf(); break;
      case 'clear-now': closeSend(); clearForm(); toast('Form cleared for next week.'); break;
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
        items.push({ source: SOURCE[g.id], person: str(a.name).trim(), action: str(a.action).trim(), assigned: str(a.assigned).trim(), when: str(a.when).trim() });
      });
    });
    (Array.isArray(data.tn) ? data.tn : []).forEach(function (n) {
      if (!n || !hasText(n, ['name', 'action'])) return;
      var person = str(n.name).trim();
      var ord = str(n.ordinance).trim();
      if (ord) person = (person ? person + ' · ' : '') + 'Next: ' + ord;
      items.push({ source: SOURCE.tn, person: person, action: str(n.action).trim(), assigned: str(n.assigned).trim(), when: str(n.when).trim() });
    });
    return items;
  }

  function applyLoad(data, fileName) {
    var items = extractActionItems(data);
    if (!items.length) {
      ask({ title: 'Nothing to load', body: 'Last week’s agenda doesn’t have any action items filled in.', primary: 'OK' });
      return;
    }
    state.rr = items.map(function (it) {
      return { prefilled: true, source: it.source, person: it.person, action: it.action, assigned: it.assigned, when: it.when, plan: '', happened: '', notes: '' };
    });
    state.loaded = { fileName: fileName, ward: str(data.ward), date: str(data.date), count: items.length };
    if (!state.ward.trim() && data.ward) { state.ward = str(data.ward); $('#ward').value = state.ward; writeWard(state.ward); }
    renderRR(); saveDraft();
    toast('Loaded ' + items.length + (items.length === 1 ? ' action item' : ' action items') + ' from last week.');
    var sec = $('#h-rr'); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
    var formWard = state.ward.trim();
    var wardMismatch = !!(formWard && data.ward && norm(formWard) !== norm(data.ward));
    var age = data.date ? daysBetween(data.date, state.date || todayISO()) : null;
    var tooOld = age !== null && age > MAX_AGE_DAYS;
    var future = age !== null && age < 0;
    if (wardMismatch || tooOld || future) {
      var title = wardMismatch ? 'This PDF is from a different ward'
        : future ? 'This PDF is dated after this meeting'
        : 'This PDF is more than two weeks old';
      var rows = [['PDF ward', str(data.ward) || 'Not listed']];
      if (formWard) rows.push(['This form', formWard]);
      rows.push(['PDF date', shortDate(data.date) || 'Not listed']);
      ask({
        title: title, compare: rows,
        body: 'Make sure you picked your ward’s agenda from last week before loading it.',
        primary: 'Choose a different file', onPrimary: pickFile,
        secondary: 'Load it anyway', onSecondary: function () { applyLoad(data, f.name); }
      });
      return;
    }
    applyLoad(data, f.name);
  }

  /* ---------- PDF ---------- */
  function fileName() {
    var w = state.ward.trim().replace(/[\\/:*?"<>|#%{}~&]+/g, '').replace(/\s+/g, ' ').slice(0, 60) || 'Ward';
    return 'Huddle - ' + w + ' - ' + state.date + '.pdf';
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
      var HH = 14, FS = 8.5, LH = 10.5;
      function drawHeader() {
        box(L, y, R - L, HH, { color: C.head });
        headers.forEach(function (t, i) { tx(edges[i] + 5, y + 10, t, F.bold, 8, C.navy); });
        hline(L, R, y); hline(L, R, y + HH);
        edges.forEach(function (x) { vline(x, y, y + HH); });
        y += HH;
      }
      function rowLayout(row) {
        if (row.group) return { h: 15 };
        var cells = row.cells.map(function (c, i) {
          var font = row.boldFirst && i === 0 ? F.bold : F.reg;
          return { font: font, lines: wrap(c, font, FS, edges[i + 1] - edges[i] - 10) };
        });
        var n = Math.max.apply(null, cells.map(function (c) { return c.lines.length; }));
        return { h: Math.max(18, n * LH + 7), cells: cells };
      }
      var first = rows.length ? rowLayout(rows[0]) : { h: 18 };
      ensure(HH + first.h + 4);
      drawHeader();
      rows.forEach(function (row) {
        var lay = rowLayout(row);
        if (y + lay.h > H - BOTTOM) { newPage(true); drawHeader(); }
        if (row.group) {
          box(L, y, R - L, lay.h, { color: C.group });
          tx(L + 5, y + 10.5, row.group.toUpperCase(), F.bold, 7.5, C.blue);
          vline(L, y, y + lay.h); vline(R, y, y + lay.h);
        } else {
          lay.cells.forEach(function (c, i) {
            c.lines.forEach(function (ln, k) { tx(edges[i] + 5, y + 11.5 + k * LH, ln, c.font, FS, C.dark); });
          });
          edges.forEach(function (x) { vline(x, y, y + lay.h); });
        }
        hline(L, R, y + lay.h);
        y += lay.h;
      });
    }

    /* ----- page 1 header ----- */
    newPage(false);
    tx(L, 54, STAKE, F.bold, 21, C.navy);
    tx(L, 73, DOC_TITLE, F.reg, 12.5, C.blue);
    var lx = tx(L, 96, 'Ward', F.reg, 9, C.gray);
    tx(L + 30, 96, wardTxt || '—', F.bold, 10, C.dark);
    tx(L, 111, 'Date', F.reg, 9, C.gray);
    tx(L + 30, 111, dateTxt || '—', F.bold, 10, C.dark);
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
    function infoBox(top, hh, fill, stroke, title, detail) {
      rbox(436, top, 128, hh, 5, fill, stroke, 1.2);
      var tl = wrap(title, F.bold, 9, 118), dl = wrap(detail, F.reg, 7, 118);
      var total = tl.length * 10.5 + dl.length * 8.4;
      var b = top + (hh - total) / 2 + 8;
      tl.forEach(function (ln) { tx(500 - F.bold.widthOfTextAtSize(ln, 9) / 2, b, ln, F.bold, 9, C.navy); b += 10.5; });
      dl.forEach(function (ln) { tx(500 - F.reg.widthOfTextAtSize(ln, 7) / 2, b, ln, F.reg, 7, C.dark); b += 8.4; });
    }
    infoBox(37, 44, C.councilFill, C.councilLine, 'Ward Council', 'Reviews the Covenant Path Report, then selects who to focus on and each person’s next ordinance');
    infoBox(89, 40, C.hudFill, C.hudLine, 'Weekly Coordination Meeting', 'Huddles decide how and when to help');
    hline(L, R, 136, C.navy, 1.2);
    y = 150;

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
    var qe = tx(L, qb, 'Did last week’s plan happen?', F.bold, 9.5, C.dark);
    var guide = 'Report back to ward council (under the bishop’s guidance).';
    if (qe + 12 + width(guide, F.reg, 9) <= R) tx(qe + 12, qb, guide, F.reg, 9, C.gray);
    else { qb += 12; tx(L, qb, guide, F.reg, 9, C.gray); }
    y = qb + 8;
    var rrRows = s.rr.filter(function (r) { return r.prefilled || rrHasInput(r); }).map(function (r) {
      var plan;
      if (r.prefilled) {
        var who = str(r.person).trim();
        plan = (who ? who + ' (' + r.source + '): ' : r.source + ': ') + (str(r.action).trim() || 'No action item written');
        var meta = [];
        if (str(r.assigned).trim()) meta.push('Assigned to ' + r.assigned.trim());
        if (str(r.when).trim()) meta.push(r.when.trim());
        if (meta.length) plan += ' — ' + meta.join(', ');
      } else plan = str(r.plan).trim();
      return { cells: [plan, r.happened || '', str(r.notes).trim()] };
    });
    if (!rrRows.length) rrRows = [{ cells: ['', '', ''] }];
    table([48, 318, 388], ['LAST WEEK’S PLAN', 'HAPPENED?', 'NOTES'], rrRows);

    /* ----- Plan ----- */
    y += 16;
    heading('Plan', '10 min');
    ensure(20);
    var b2 = y + 13;
    bullet(b2); tx(63, b2, 'Opening prayer', F.bold, 9.5, C.dark);
    y = b2 + 6;

    // Covenant Path Report
    ensure(64);
    b2 = y + 15;
    checkbox(48, b2, s.cpDone);
    var e2 = tx(63, b2, 'Covenant Path Report', F.bold, 9.5, C.dark);
    e2 = tx(e2 + 2.6, b2, '(found in tools)', F.reg, 9.5, C.dark);
    tx(e2 + 8, b2, '6 min', F.ital, 9, C.gray);
    b2 += 13;
    var e3 = tx(63, b2, 'Review each list: new members, returning members, those being taught.', F.reg, 9, C.dark) + 2.5;
    var e4 = tx(e3, b2, 'Mark sacrament attendance', F.reg, 9, C.dark);
    hline(e3, e4, b2 + 1.4, C.dark, 0.6);
    tx(e4, b2, '.', F.reg, 9, C.dark);
    b2 += 12;
    tx(63, b2, 'Make a plan: What is one action item this week to help their next step? Who will do it, and when?', F.reg, 9, C.gray);
    y = b2 + 9;
    var cpRows = [];
    GROUPS.forEach(function (g) {
      cpRows.push({ group: g.title });
      var filled = s.cp[g.id].filter(function (a) { return hasText(a, ['name', 'action', 'assigned', 'when']); });
      if (!filled.length) cpRows.push({ cells: ['', '', '', ''] });
      filled.forEach(function (a) { cpRows.push({ boldFirst: true, cells: [a.name.trim(), a.action.trim(), a.assigned.trim(), a.when.trim()] }); });
    });
    table([48, 168, 398, 488], ['NAME', 'ACTION ITEM FOR THIS WEEK', 'ASSIGNED TO', 'WHEN'], cpRows);

    // Three Names
    y += 6;
    ensure(64);
    b2 = y + 15;
    checkbox(48, b2, s.tnDone);
    e2 = tx(63, b2, 'Three Names', F.bold, 9.5, C.dark);
    e2 = tx(e2 + 2.6, b2, '(spreadsheet)', F.reg, 9.5, C.dark);
    tx(e2 + 8, b2, '3 min', F.ital, 9, C.gray);
    b2 += 13;
    tx(63, b2, 'Review 3 focus names and their next needed ordinance.', F.reg, 9, C.dark);
    b2 += 12;
    tx(63, b2, 'Make a plan: What is one action item this week to help their next step? Who will do it, and when?', F.reg, 9, C.gray);
    y = b2 + 9;
    table([48, 158, 248, 418, 498], ['FOCUS NAME', 'NEXT ORDINANCE', 'ACTION ITEM FOR THIS WEEK', 'ASSIGNED TO', 'WHEN'],
      s.tn.map(function (n) { return { boldFirst: true, cells: [n.name.trim(), n.ordinance.trim(), n.action.trim(), n.assigned.trim(), n.when.trim()] }; }));

    // Follow-Through, closing prayer
    y += 6;
    ensure(52);
    b2 = y + 15;
    checkbox(48, b2, s.ftDone);
    e2 = tx(63, b2, 'Mark off the Follow-Through Report', F.bold, 9.5, C.dark);
    tx(e2 + 2.6, b2, '(spreadsheet)', F.reg, 9.5, C.dark);
    b2 += 13;
    e2 = tx(63, b2, 'Important: ', F.bold, 9, C.dark);
    tx(e2, b2, 'Report back to the stake using the Follow-Through Report.', F.reg, 9, C.dark);
    b2 += 18;
    bullet(b2); tx(63, b2, 'Pray and go to work', F.bold, 9.5, C.dark);
    y = b2 + 10;

    // Principles
    var principles = [
      ['Meet weekly & stay connected:', 'Brief weekly meetings; use chats between meetings.'],
      ['Take notes & make specific plans:', 'Record assignments and concrete weekly steps.'],
      ['Follow up & act beyond meetings:', 'Regularly check progress and fulfill commitments during the week.'],
      ['Involve youth:', 'Give youth responsibilities; coordinate with ward council, temple, & family history leaders.'],
      ['Share experiences:', 'Share inspiring stories and blessings.']
    ];
    var boxH = 15 + 13 + 10.5 * (principles.length - 1) + 7;
    // Reference text only: include it when it fits, rather than starting a page just for it.
    if (y + boxH <= H - BOTTOM) {
    rbox(L, y, R - L, boxH, 6, C.head, C.line, 0.6);
    var pb = y + 15;
    tx(62, pb, 'Principles for Effective Coordination', F.bold, 9.5, C.blue);
    pb += 13;
    principles.forEach(function (p) {
      page.drawCircle({ x: 66, y: H - (pb - 2.9), size: 1.4, color: C.blue });
      var e = tx(74, pb, p[0], F.bold, 8.5, C.dark);
      tx(e + 4, pb, p[1], F.reg, 8.5, C.dark);
      pb += 10.5;
    });
    y += boxH;
    }

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
    var payload = {
      app: APP_ID, v: DATA_VERSION, stake: STAKE, ward: wardTxt, date: s.date, createdAt: new Date().toISOString(),
      attendees: s.attendees.slice(),
      rr: s.rr.map(function (r) {
        return r.prefilled
          ? { prefilled: true, source: r.source, person: r.person, action: r.action, assigned: r.assigned, when: r.when, happened: r.happened, notes: r.notes }
          : { plan: r.plan, happened: r.happened, notes: r.notes };
      }),
      cpDone: s.cpDone, cp: s.cp, tnDone: s.tnDone, tn: s.tn, ftDone: s.ftDone
    };
    doc.getInfoDict().set(P.PDFName.of('HuddleData'), P.PDFHexString.fromText(JSON.stringify(payload)));
    var bytes = await doc.save();
    return { bytes: bytes, pages: total };
  }

  /* ---------- Send & Clear ---------- */
  var sendFile = null, saved = false;
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function canShareFiles(file) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }

  function resetSendSheet() {
    saved = false; sendFile = null;
    $('#step-save').hidden = false;
    $('#step-save').classList.remove('done');
    $('#step-save .step-num').textContent = '1';
    $('#step-share .step-num').textContent = '2';
    $('#save-btn').disabled = true; $('#save-btn').textContent = 'Save a copy';
    $('#save-hint').textContent = 'Saves the PDF to this phone so you can load it next week.';
    $('#share-btn').disabled = true; $('#share-btn').textContent = 'Share PDF';
    $('#share-title').textContent = 'Share the PDF';
    $('#share-hint').textContent = 'Your share menu opens. Pick Mail, Messages, or any app you use. The form clears after it’s shared.';
    $('#skip-save').hidden = false;
    $('#after-download').hidden = true;
  }

  async function startSend() {
    if (!state.ward.trim()) {
      ask({ title: 'Add your ward name first', body: 'The ward name goes on the PDF and helps you load the right file next week.', primary: 'OK', onPrimary: function () { $('#ward').focus(); } });
      return;
    }
    if (!parseISO(state.date)) {
      ask({ title: 'Add the meeting date first', primary: 'OK', onPrimary: function () { $('#date').focus(); } });
      return;
    }
    if (isEmpty(state)) {
      ask({ title: 'Nothing to send yet', body: 'Fill in the agenda, then tap Send & Clear.', primary: 'OK' });
      return;
    }
    resetSendSheet();
    var name = fileName();
    $('#send-filename').textContent = name;
    $('#send-status').textContent = 'Making your PDF…';
    openOverlay('#send-sheet', '#send-title');
    try {
      var out = await buildPdf(state);
      sendFile = new File([out.bytes], name, { type: 'application/pdf' });
      $('#send-status').textContent = out.pages + (out.pages === 1 ? ' page' : ' pages') + ' · locked so it can’t be edited';
      if (canShareFiles(sendFile)) {
        if (isIOS) $('#save-hint').textContent = 'In the menu that opens, tap “Save to Files.” You’ll load it from there next week.';
        $('#save-btn').disabled = false;
      } else {
        // No share menu for files here (some desktop browsers): one download step.
        $('#step-save').hidden = true;
        $('#step-share .step-num').textContent = '1';
        $('#share-title').textContent = 'Download the PDF';
        $('#share-hint').textContent = 'Saves the PDF to your Downloads. Attach it to an email or message, then clear the form.';
        $('#share-btn').textContent = 'Download PDF';
        $('#skip-save').hidden = true;
        $('#share-btn').disabled = false;
      }
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

  function markSaved(msg) {
    saved = true;
    $('#step-save').classList.add('done');
    $('#step-save .step-num').textContent = '✓';
    $('#save-btn').disabled = true;
    $('#save-btn').textContent = 'Saved';
    $('#save-hint').textContent = msg;
    enableShare();
  }
  function enableShare() {
    $('#share-btn').disabled = false;
    $('#skip-save').hidden = true;
  }

  async function saveCopy() {
    if (!sendFile) return;
    if (isIOS && canShareFiles(sendFile)) {
      try {
        await navigator.share({ files: [sendFile] });
        markSaved('Saved. Next week, find it in the Files app.');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        download(sendFile);
        markSaved('Saved to Downloads in the Files app.');
      }
    } else {
      download(sendFile);
      markSaved('Saved to your Downloads folder.');
    }
  }

  async function sharePdf() {
    if (!sendFile) return;
    if (canShareFiles(sendFile)) {
      try {
        await navigator.share({ files: [sendFile], title: sendFile.name });
        closeSend(); clearForm();
        toast('Shared. The form is cleared for next week.');
      } catch (e) {
        if (e && e.name === 'AbortError') return; // they closed the share menu; keep everything
        download(sendFile);
        $('#after-download').hidden = false;
      }
    } else {
      download(sendFile);
      $('#after-download').hidden = false;
    }
  }

  function closeSend() { closeOverlay('#send-sheet'); sendFile = null; }

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
      saveDraft();
    };
    document.addEventListener('input', onEdit);
    document.addEventListener('change', onEdit);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-action]');
      if (btn && !btn.disabled) { e.preventDefault(); onAction(btn); return; }
      if (e.target.id === 'send-sheet') closeSend();
      if (e.target.id === 'confirm-sheet' && askSecondary) askSecondary();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#confirm-sheet').hidden) { if (askSecondary) askSecondary(); else closeOverlay('#confirm-sheet'); }
      else if (!$('#send-sheet').hidden) closeSend();
    });
    // Enter moves to the next field instead of doing nothing
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('#form input[type="text"]')) return;
      e.preventDefault();
      var inputs = Array.prototype.slice.call(document.querySelectorAll('#form input[type="text"], #form input[type="date"]'));
      var next = inputs[inputs.indexOf(e.target) + 1];
      if (next) next.focus(); else e.target.blur();
    });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
