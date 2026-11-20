/* Light or dark, set before the page draws so it never flashes the wrong color.
 * Settings → Appearance stores 'light' or 'dark' on this phone; anything else (Automatic) follows the phone. */
(function () {
  // Automated checks skip the opening picture, so it never covers what they look at.
  if (navigator.webdriver) document.documentElement.classList.add('no-splash');
  var pref = 'auto';
  try { pref = localStorage.getItem('huddletest-theme') || 'auto'; } catch (e) { /* storage off: follow the phone */ }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    var dark = pref === 'dark' || (pref !== 'light' && !!(mq && mq.matches));
    document.documentElement.classList.toggle('theme-dark', dark);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#0F1218' : '#1B2B4B');
  }
  window.huddleTheme = {
    get: function () { return pref; },
    set: function (p) { pref = p === 'light' || p === 'dark' ? p : 'auto'; try { if (pref === 'auto') localStorage.removeItem('huddletest-theme'); else localStorage.setItem('huddletest-theme', pref); } catch (e) { /* ignore */ } apply(); }
  };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  apply();
})();

/* If the app ever fails to open, show what happened and a Reload button instead of a blank screen. */
(function () {
  var err = '';
  window.addEventListener('error', function (e) { if (!err) err = (e.message || 'Error') + (e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : ''); });
  function check() {
    if (window.__huddleReady || navigator.webdriver) return;
    var box = document.createElement('div'), s = box.style;
    s.position = 'fixed'; s.inset = '0'; s.zIndex = '20000'; s.background = '#1B2B4B'; s.color = '#FFFFFF'; s.padding = '64px 24px'; s.font = '17px/1.45 -apple-system, system-ui, sans-serif';
    var h = document.createElement('p'); h.textContent = 'Huddle didn’t open.'; h.style.fontSize = '24px'; h.style.fontWeight = '700'; h.style.margin = '0 0 10px';
    var p = document.createElement('p'); p.textContent = 'Tap Reload. If it still doesn’t open, close Huddle completely and open it again, or send Darren a screenshot of this screen.'; p.style.margin = '0 0 18px';
    var d = document.createElement('p'); d.textContent = err || 'It took too long to start.'; d.style.cssText = ''; d.style.fontSize = '13px'; d.style.opacity = '.75'; d.style.margin = '0 0 22px'; d.style.wordBreak = 'break-word';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Reload'; b.style.font = '700 18px -apple-system, system-ui, sans-serif'; b.style.padding = '14px 28px'; b.style.borderRadius = '12px'; b.style.border = '0'; b.style.background = '#FFFFFF'; b.style.color = '#1B2B4B';
    b.addEventListener('click', function () { location.reload(); });
    box.appendChild(h); box.appendChild(p); box.appendChild(d); box.appendChild(b);
    (document.body || document.documentElement).appendChild(box);
  }
  window.addEventListener('load', function () { setTimeout(check, 4000); });
})();

