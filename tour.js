/* Guided tour: dims the page, highlights one part at a time, and explains it in a bubble.
   Runs once on a new device (from the Home Screen app), and again from "Take the tour" in How to use.
   Stores only a "seen" flag on the phone; no agenda data. */
(function () {
  'use strict';

  var SEEN_KEY = 'huddle-tour-seen';

  // Each stop: what to highlight (first visible match) and what to say. No target = a centered message.
  var STEPS = [
    { title: 'Welcome!', text: 'This quick tour shows how the agenda works, top to bottom. It takes about a minute. Tap Next to begin.' },
    { target: '.info-pair', title: 'Who decides what', text: 'Ward council decides who to focus on and what each person’s next ordinance is. The huddle decides how and when to help. The whole agenda follows that split.' },
    { target: '.top-buttons', title: 'Help is always here', text: 'How to use has the step-by-step instructions (and this tour). Tips for an effective meeting has the principles for a great huddle.' },
    { target: 'header .grid-2', title: 'Ward and date', text: 'Your ward is remembered on this phone. The date starts on your usual meeting day, so check it if you prepare ahead.' },
    { target: '#conduct-seg', title: 'Who’s conducting', text: 'Usually the ward mission leader. If he isn’t there, the elders quorum representative conducts. It prints on the agenda.' },
    { target: '.attendees-field', title: 'Take attendance', text: 'At the meeting, tap everyone who came. The youth are listed first: make an extra effort to involve them.' },
    { target: ['#load-panel', '#loaded-banner'], title: 'Load last week', text: 'Before the meeting, tap Load last week and pick last week’s agenda. Its action items fill in Return and Report, and its names carry over to this week.' },
    { target: ['#rr-list .card', '#rr-list'], title: 'Return and Report', text: 'For each of last week’s items, tap Yes, Partly or No. If it didn’t happen, Carry forward adds it to this week’s plan without retyping.' },
    { target: ['[data-group="nm"] .card', '#cp-groups'], title: 'Name cards', text: 'Each person’s card has two halves. The top is from ward council: name, next ordinance and need. The bottom is the huddle’s: one action item, who will do it, and when.' },
    { target: '[data-group="nm"] .temple-box', title: 'The 30-day temple goal', text: 'For new members, enter the baptism date. This box counts down 30 days to baptisms for the dead and stays red until you check it.' },
    { target: '[data-group="nm"] .btn-done', title: 'Done with a list?', text: 'Tap Done to fold a finished list to one line per person. Tap its title to open it again. The PDF always shows everything.' },
    { target: '#tn-list .list-panel', title: '3 Names', text: 'Add the focus names from ward council, with each person’s next ordinance and need, then plan an action the same way.' },
    { target: '.actionbar', title: 'Save or send', text: 'Save without sending keeps your work while you prepare. After the huddle, Send & Clear makes the PDF and opens your share menu. Send it to the bishop-approved list.' },
    { title: 'You’re all set', text: 'Everything stays on your phone, and nothing is saved online. You can replay this tour anytime from How to use.' }
  ];

  var el = {}, idx = 0, active = false, targetEl = null;

  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function markSeen() { try { var s = store(); if (s) s.setItem(SEEN_KEY, '1'); } catch (e) { /* ignore */ } }
  function seen() { try { var s = store(); return !!(s && s.getItem(SEEN_KEY)); } catch (e) { return false; } }

  function visible(node) {
    if (!node) return false;
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }
  function findTarget(step) {
    if (!step.target) return null;
    var sels = Array.isArray(step.target) ? step.target : [step.target];
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var j = 0; j < nodes.length; j++) if (visible(nodes[j])) return nodes[j];
    }
    return null;
  }

  function build() {
    if (el.root) return;
    el.root = document.createElement('div');
    el.root.className = 'tour';
    el.root.setAttribute('role', 'dialog');
    el.root.setAttribute('aria-modal', 'true');
    el.root.setAttribute('aria-labelledby', 'tour-title');
    el.root.innerHTML =
      '<div class="tour-shield"></div>' +
      '<div class="tour-spot" aria-hidden="true"></div>' +
      '<div class="tour-bubble">' +
        '<p class="tour-count"></p>' +
        '<h2 class="tour-title" id="tour-title"></h2>' +
        '<p class="tour-text"></p>' +
        '<div class="tour-actions">' +
          '<button type="button" class="tour-skip">Skip tour</button>' +
          '<span class="tour-nav">' +
            '<button type="button" class="tour-back">Back</button>' +
            '<button type="button" class="tour-next">Next</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el.root);
    el.spot = el.root.querySelector('.tour-spot');
    el.bubble = el.root.querySelector('.tour-bubble');
    el.count = el.root.querySelector('.tour-count');
    el.title = el.root.querySelector('.tour-title');
    el.text = el.root.querySelector('.tour-text');
    el.next = el.root.querySelector('.tour-next');
    el.back = el.root.querySelector('.tour-back');
    el.root.querySelector('.tour-skip').addEventListener('click', end);
    el.next.addEventListener('click', function () { go(idx + 1); });
    el.back.addEventListener('click', function () { go(idx - 1); });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (!active) return;
      if (e.key === 'Escape') end();
      else if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
    });
  }

  // Scroll the highlighted part into a comfortable spot, then draw the spotlight and bubble.
  function show() {
    var step = STEPS[idx];
    targetEl = findTarget(step);
    el.count.textContent = (idx + 1) + ' of ' + STEPS.length;
    el.title.textContent = step.title;
    el.text.textContent = step.text;
    el.back.hidden = idx === 0;
    el.next.textContent = idx === STEPS.length - 1 ? 'Finish' : (idx === 0 ? 'Start' : 'Next');
    if (targetEl && getComputedStyle(targetEl).position !== 'fixed') {
      // Bring the part near the top so the bubble has room underneath it.
      var r = targetEl.getBoundingClientRect();
      window.scrollTo(0, Math.max(0, window.scrollY + r.top - 64));
    }
    place();
    setTimeout(function () { el.next.focus({ preventScroll: true }); }, 30);
  }

  function place() {
    if (!active) return;
    var vw = window.innerWidth, vh = window.innerHeight, pad = 8;
    var bw = Math.min(360, vw - 32);
    el.bubble.style.width = bw + 'px';
    if (!targetEl) {
      el.spot.style.opacity = '0';
      el.spot.style.left = (vw / 2) + 'px'; el.spot.style.top = (vh / 2) + 'px';
      el.spot.style.width = '0px'; el.spot.style.height = '0px';
      el.bubble.style.left = ((vw - bw) / 2) + 'px';
      el.bubble.style.top = Math.max(16, (vh - el.bubble.offsetHeight) / 2) + 'px';
      el.bubble.className = 'tour-bubble center';
      return;
    }
    var r = targetEl.getBoundingClientRect();
    var bh0 = el.bubble.offsetHeight;
    var top = Math.max(r.top - pad, 6), bottom = Math.min(r.bottom + pad, vh - 6);
    // A tall part (a long list, a whole card): light up its top portion and keep the bubble below it.
    var fixedTarget = getComputedStyle(targetEl).position === 'fixed';
    var room = vh - bh0 - 12 - 16;
    if (!fixedTarget && bottom > room && room - top > 90) bottom = room;
    el.spot.style.opacity = '1';
    el.spot.style.left = Math.max(r.left - pad, 4) + 'px';
    el.spot.style.width = Math.min(r.width + pad * 2, vw - 8) + 'px';
    el.spot.style.top = top + 'px';
    el.spot.style.height = Math.max(bottom - top, 10) + 'px';
    var bh = el.bubble.offsetHeight, gap = 12, bt, cls;
    if (bottom + gap + bh <= vh - 8) { bt = bottom + gap; cls = 'below'; }
    else if (top - gap - bh >= 8) { bt = top - gap - bh; cls = 'above'; }
    else { bt = vh - bh - 16; cls = 'over'; }
    var bl = Math.min(Math.max(r.left + r.width / 2 - bw / 2, 16), vw - bw - 16);
    el.bubble.style.left = bl + 'px';
    el.bubble.style.top = bt + 'px';
    el.bubble.className = 'tour-bubble ' + cls;
    el.bubble.style.setProperty('--arrow-x', Math.min(Math.max(r.left + r.width / 2 - bl, 24), bw - 24) + 'px');
  }

  function go(n) {
    if (n < 0) return;
    if (n >= STEPS.length) { end(); return; }
    idx = n;
    show();
  }

  function start() {
    build();
    // Close any open sheet so the page underneath is what gets explained.
    Array.prototype.forEach.call(document.querySelectorAll('.overlay:not([hidden])'), function (o) { o.hidden = true; });
    document.body.style.overflow = '';
    active = true;
    el.root.hidden = false;
    document.body.classList.add('touring');
    go(0);
  }

  function end() {
    active = false;
    markSeen();
    if (el.root) el.root.hidden = true;
    document.body.classList.remove('touring');
  }

  window.HuddleTour = { start: start, end: end, seen: seen, steps: STEPS.length };
})();
