/* Guided tour: dims the page, highlights one part at a time, and explains it in a bubble.
   Runs once on a new device (from the Home Screen app), and again from "Take the tour" in How to use.
   Stores only a "seen" flag on the phone; no agenda data. */
(function () {
  'use strict';

  var SEEN_KEY = 'huddle-tour-seen';

  // Each stop: what to highlight (first visible match) and what to say. No target = a centered message.
  var STEPS = [
    { view: 'start', title: 'Welcome!', text: 'This tour shows how the weekly process works. It takes about 2 minutes. Tap **Start** to begin.' },
    { target: '#start-home', view: 'start', title: 'Four steps, in order', text: '**1. Before ward council:** update each person from the Covenant Path Report.\n**2. Ward council:** who to focus on, and each next ordinance.\n**3. Huddle:** how and when to help.\n**4. After the huddle:** update the Covenant Path Report.\nThen tap **Send**. **Up next** shows where you are.' },
    { target: ['#before-list', '#bw-view'], view: 'bw', sample: true, title: 'Before ward council', text: 'Open the Covenant Path Report in Member Tools, then bring each name up to date here: next ordinance, needs, temple and sacrament attendance. Tap **Add a name** for anyone new. When everyone matches the report, tap **All up to date · Mark done**.' },
    { target: ['#wc-view', '#wc-rows'], view: 'wc', title: 'Ward council', text: 'Ward council decides who and what. **Covenant Path Report** and **Focus names** hold the names: tap a row, then a name, and enter the next ordinance and needs. Ward council chooses the three focus names.',
      demoClass: 'important', demo: '<p class="tour-callout"><span class="tour-callout-icon" aria-hidden="true">!</span><span><strong>Never add confidential information to this agenda.</strong></span></p>' },
    { target: '#details-full', details: true, title: 'Huddle Details', text: 'At the huddle, tap **Huddle**. The bar at the top fills as you mark each section done. Then tap **Huddle Details**. Choose who’s conducting and tap everyone who attended. **The person conducting fills in the whole agenda and sends it.**' },
    { target: ['#rr-list .card .rr-answer', '#rr-list .card', '#rr-list'], view: 'rr', title: 'Return and Report', text: 'The last huddle’s assignments show up here. Tap **Yes**, **Partly** or **No** for each, during the week or at the huddle. For an unfinished one, tap **Carry forward to this huddle**.' },
    { target: ['#person-card .zone-hd-wrap', '[data-group="nm"] .card .zone-hd-wrap', '#cp-groups'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'A plan for each name', text: 'Under **Covenant Path Report** and **Focus names**, tap a name. Ward council’s part is the summary on top. The highlighted part is the huddle’s: sacrament attendance, one action item, who will do it, and the date. Then tap **Text this assignment**. For questions to discuss, tap **How can we help?** under a list’s name.' },
    { target: ['#person-card .temple-box', '[data-group="nm"] .temple-box'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'The 30-day temple goal', text: 'The goal: every new member attends the temple for baptisms for the dead within **30 days of their baptism**. This box counts down from the baptism date and stays red until it’s checked.' },
    { target: '#after-box', view: 'start', title: 'After the huddle', text: '**After the huddle, update the Covenant Path Report in Member Tools.** Tap this box to see what to update for each person, then tap **It’s all updated · Mark done**. Send works only after this.' },
    { target: '.actionbar', view: 'start', title: 'Send', text: 'Tap **Send** and share the PDF with the bishop-approved list, the stake presidency and the full-time missionaries. Include yourself, so you keep a copy. **Sending finishes the huddle:** its assignments move into Return and Report for next time. For anything else, tap **How to use**.' }
  ];

  var el = {}, idx = 0, active = false, targetEl = null, ACTIVE = STEPS;
  function activeSteps() { return STEPS; }
  // In the four-step view, open the part of the agenda each stop talks about.
  function setView(step) {
    var hv = window.HuddleView;
    if (!hv || !hv.enabled()) return;
    // Stops about a person show a sample name when New members is empty, so there is someone to look at.
    if (hv.tourDemo) hv.tourDemo(!!step.sample);
    // A stop about one person opens that person's screen (when names are listed as rows).
    if (step.person && hv.rows && hv.rows() && hv.person(step.person[0], step.person[1])) return;
    hv.show(step.view || 'home', !!step.details);
  }

  // **words** in a step become bold and a line break starts a new line; everything else is plain text.
  function fmt(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
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
        '<div class="tour-demo" hidden></div>' +
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
    el.demo = el.root.querySelector('.tour-demo');
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
    var step = ACTIVE[idx];
    setView(step);
    targetEl = findTarget(step);
    el.count.textContent = (idx + 1) + ' of ' + ACTIVE.length;
    el.title.textContent = step.title;
    el.text.innerHTML = fmt(step.text);
    var demo = typeof step.demo === 'function' ? step.demo() : step.demo;
    el.demo.innerHTML = demo || '';
    el.demo.className = 'tour-demo' + (step.demoClass ? ' ' + step.demoClass : '');
    el.demo.hidden = !step.demo;
    el.back.hidden = idx === 0;
    el.next.textContent = idx === ACTIVE.length - 1 ? 'Finish' : (idx === 0 ? 'Start' : 'Next');
    if (targetEl && getComputedStyle(targetEl).position !== 'fixed') {
      // Bring the part near the top so the bubble has room underneath it.
      // On a short screen with a long bubble, sit it closer to the top so both fit.
      var r = targetEl.getBoundingClientRect();
      el.bubble.style.width = Math.min(360, window.innerWidth - 32) + 'px';
      var offset = (64 + r.height + 20 + el.bubble.offsetHeight + 8 > window.innerHeight) ? 16 : 64;
      // Never tuck the target under the sticky Back bar.
      ['step-bar', 'mode-bar'].forEach(function (id) {
        var bar = document.getElementById(id);
        if (bar && !bar.hidden) offset = Math.max(offset, bar.getBoundingClientRect().height + 8);
      });
      window.scrollTo(0, Math.max(0, window.scrollY + r.top - offset));
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
      // Nothing to point at: keep the page dimmed behind a centered message.
      el.spot.style.opacity = '1'; el.spot.style.outlineWidth = '0px';
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
    el.spot.style.opacity = '1'; el.spot.style.outlineWidth = '';
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
    if (n >= ACTIVE.length) { end(); return; }
    idx = n;
    show();
  }

  function start() {
    build();
    ACTIVE = activeSteps();
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
    if (window.HuddleView && window.HuddleView.enabled()) window.HuddleView.reset();
  }

  window.HuddleTour = { start: start, end: end, seen: seen };
  Object.defineProperty(window.HuddleTour, 'steps', { get: function () { return activeSteps().length; } });
})();
