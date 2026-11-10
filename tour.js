/* Guided tour: dims the page, highlights one part at a time, and explains it in a bubble.
   Runs once on a new device (from the Home Screen app), and again from "Take the tour" in How to use.
   Stores only a "seen" flag on the phone; no agenda data. */
(function () {
  'use strict';

  var SEEN_KEY = 'huddle-tour-seen';

  // Each stop: what to highlight (first visible match) and what to say. No target = a centered message.
  var STEPS = [
    { view: 'start', title: 'Welcome!', text: 'This quick tour shows how the weekly process works. It takes about a minute. Tap **Start** to begin.' },
    { target: '#start-home', view: 'start', title: 'Four steps, in order', text: '**1. Before ward council:** match the names to the Covenant Path Report.\n**2. Ward council:** who to focus on, and what each person’s next ordinance is.\n**3. Huddle:** how and when to help.\n**4. After the huddle:** update the Covenant Path Report.\nThen tap **Send**. Steps 1 and 4 turn green once you open them and tap **Mark done**.' },
    { target: '.top-buttons', view: 'start', title: 'Help is always here', text: '**How to use** has the step-by-step instructions, and this tour. **Tips for an effective meeting**, the principles for a great huddle, is at the top of the Huddle screen.' },
    { target: ['#wc-view', '#wc-rows'], view: 'wc', title: 'Ward council', text: 'Tap **Ward council** before the huddle. It has two lists, each with a count: **Covenant Path Report lists** and **Name Next Ordinance** (the focus names ward council chooses). A list turns orange if someone needs a next ordinance. Tap a list to see its names, then tap a name to open it. The reminder under the lists applies to everything you type.' },
    { target: ['#person-card .wc-card', '#person-card', '#wc-list'], view: 'wc-cp', sample: true, person: ['wc', 'nm'], title: 'Names and needs', text: 'Each person has only what ward council decides: the name, the next ordinance and the need. **For the Covenant Path Report lists, tap the person’s name in the report to find a need.** Focus names aren’t on the report; their needs come from ward council. Details and the last huddle’s assignment show underneath, to plan from. Tap **Done** to go back to the list.' },
    { target: '#details-full', details: true, title: 'Huddle Details', text: 'At the meeting, tap **Huddle**, then **Huddle Details**. Add your ward (it’s remembered), select who’s conducting, and tap everyone who came. The youth are listed first: make an extra effort to involve them. **The person conducting fills out this entire agenda and sends it to the bishop-approved list, the stake presidency and the full-time missionaries.**' },
    { target: '#steps-home', stepsOnly: true, title: 'Four sections', text: 'The huddle has four sections. Go down the list, or open them in any order. **Mark section done** checks each one off as you finish it; the checks clear when you send. Orange means something is still missing.' },
    { target: ['#rr-list .card .rr-answer', '#rr-list .card', '#rr-list'], view: 'rr', title: 'Return and Report', text: 'The assignments from your last huddle show up here. Tap **Yes**, **Partly** or **No** for each. If someone reports back during the week, mark it then; the huddle confirms the rest. Use **Notes for ward council** to say how it went.',
      demo: '<p class="tour-demo-cap">Tap Partly or No and this button appears:</p><span class="tour-demo-btn">Carry forward to this huddle</span><p class="tour-demo-cap">It adds the item to this huddle’s plan without retyping.</p>' },
    { target: '.btn-tools', view: 'cp', sample: true, title: 'Jump to the Covenant Path Report', text: 'Tap **Open the Covenant Path Report** to go straight to the Member Tools app, then tap **Reports → Covenant Path Progress**. On a computer it opens the report in Leader and Clerk Resources.' },
    { target: ['[data-group="nm"] .person-rows', '[data-group="nm"]', '#cp-groups'], view: 'cp', sample: true, stepsOnly: true, title: 'One row per name', text: 'Each list shows its names, with the action item under each one. **Orange means that person still needs an action item.** Tap a name to open it, and **Add a name** to add someone. **Back** or **Done** returns to this list.' },
    { target: ['#person-card .zone-wc-wrap', '[data-group="nm"] .card .zone-wc-wrap', '#cp-groups'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'A person: ward council’s half', text: 'Each person’s screen has two halves. The top is ward council’s: next ordinance and needs. **It’s already filled in from what you entered under Ward council.**',
      demoClass: 'important', demo: '<p class="tour-callout"><span class="tour-callout-icon" aria-hidden="true">!</span><span><strong>Never add confidential information to this agenda.</strong></span></p>' },
    { target: ['#person-card .zone-hd-wrap', '[data-group="nm"] .card .zone-hd-wrap', '#cp-groups'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'A person: the huddle’s half', text: 'The bottom half is the huddle’s: one action item, who will do it, and when. After you send, each action item moves into Return and Report for the next huddle.' },
    { target: ['.btn-text-assign', '#person-card .card', '[data-group="nm"] .card', '#cp-groups'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'Text the assignment', text: 'Once a person has an action item and someone assigned, tap **Text this assignment** before everyone leaves. Messages opens with the name, the action and when. Pick who to send it to, and it shows **Texted**.',
      demo: '<span class="tour-demo-btn">Text this assignment</span><p class="tour-demo-cap">Needs and notes are never included in the text.</p>' },
    { target: ['#person-card .temple-box', '[data-group="nm"] .temple-box'], view: 'cp', sample: true, person: ['hd', 'nm'], title: 'The 30-day temple goal', text: 'Our goal is to help every new member attend the temple for baptisms for the dead within **30 days of their baptism**. Enter the baptism date and this box counts down the days. It stays red until it’s checked off, so the huddle stays focused on helping them get there.',
      demoClass: 'tip', demo: '<p class="tour-callout"><span class="tour-callout-icon" aria-hidden="true">✓</span><span><strong>Reminder:</strong> When they’ve been to the temple, also update the Covenant Path Report in Tools.</span></p>' },
    { target: '[data-group="nm"] .btn-done', view: 'cp', sample: true, allOnly: true, title: 'Done with a list?', text: 'Tap **Done** to collapse a finished list to one line per person. This helps you see what you’ve finished and where to stay focused during the meeting. Tap a name to edit just that person, or tap the title to open the whole list.' },
    { target: '#tn-list .list-panel', view: 'tn', title: 'Name Next Ordinance', text: 'The focus names from Ward council are already here, with each person’s next ordinance and need. Tap a name and plan an action the same way. The huddle can add more needs in the same Needs box, and add a note to relay anything back to ward council.' },
    { target: ['.btn-find-tips', '#h-fn'], view: 'fn', title: 'Finding new people to teach', text: 'Write the ward’s plan to find new people to teach, then add any applicable assignments. Tap **Tips for finding new people to teach** for ideas.' },
    { target: '.actionbar [data-action="handoff"]', view: 'start', title: 'Someone else conducting?', text: 'Tap **Hand off** to text this agenda to the leader filling in. They tap the link and it loads on their phone, ready to run the huddle. When they send it, load their PDF with **Load a handoff or PDF** to set up your next huddle.' },
    { target: '#after-box', view: 'start', title: 'Update the Covenant Path Report', text: '**After the huddle, update the Covenant Path Report in Tools.** Tap this box to see each person’s sacrament attendance, temple attendance, needs and assignment, with a button that opens the report. When it’s done, tap **It’s all updated · Mark done** at the bottom of that list. A current report is what makes next week’s huddle work.' },
    { target: '.actionbar', view: 'start', title: 'Send', text: 'Then tap **Send**. It works once **After the huddle, before you send** is marked done. Then share the PDF with the bishop-approved list, the stake presidency and the full-time missionaries. **Sending finishes the huddle:** its assignments move into Return and Report for next time.',
      demoClass: 'tip', demo: '<p class="tour-callout"><span class="tour-callout-icon" aria-hidden="true">✓</span><span><strong>Tip:</strong> Include yourself when you send it, so you always have a copy of the PDF.</span></p>' },
    { view: 'start', title: 'You’re all set', text: 'Four steps, then Send. Everything stays on your phone, and nothing is saved online. How to use has the training video, this tour, a sample agenda and a practice week whenever you need them. Sent something and need it again? **Share again** is on this screen.' }
  ];

  var el = {}, idx = 0, active = false, targetEl = null, ACTIVE = STEPS;
  // The four-step view adds a stop about the steps and drops the one about folding lists.
  function activeSteps() {
    var on = window.HuddleView && window.HuddleView.enabled();
    return STEPS.filter(function (st) { return on ? !st.allOnly : !st.stepsOnly; });
  }
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
