/* Light or dark, set before the page draws so it never flashes the wrong color.
 * Settings → Appearance stores 'light' or 'dark' on this phone; anything else (Automatic) follows the phone. */
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('huddle-theme') || 'auto'; } catch (e) { /* storage off: follow the phone */ }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    var dark = pref === 'dark' || (pref !== 'light' && !!(mq && mq.matches));
    document.documentElement.classList.toggle('theme-dark', dark);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#0F1218' : '#1B2B4B');
  }
  window.huddleTheme = {
    get: function () { return pref; },
    set: function (p) { pref = p === 'light' || p === 'dark' ? p : 'auto'; try { if (pref === 'auto') localStorage.removeItem('huddle-theme'); else localStorage.setItem('huddle-theme', pref); } catch (e) { /* ignore */ } apply(); }
  };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  apply();
})();
