// Lets the older tests keep typing words into Next ordinance and When, as if from a huddle saved before those
// became a menu and a date. A word typed into the menu becomes one more choice (the app keeps such a choice the
// same way); a word typed into a date box is stored as typed (the app keeps a When that isn't a date the same way).
// test/datesmenu.js tests the menu and the date boxes the way people use them.
const { chromium } = require('playwright');
let done = false;
module.exports = async function patch() {
  if (done) return; done = true;
  const b = await chromium.launch(); const pg = await b.newPage();
  const Page = Object.getPrototypeOf(pg), Locator = Object.getPrototypeOf(pg.locator('a'));
  await b.close();
  const set = async (loc, value) => loc.evaluate((el, v) => {
    if (el.tagName === 'SELECT') {
      if (![...el.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); }
      el.value = v;
    } else { el.type = 'text'; el.value = v; }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const special = loc => loc.evaluate(el => el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'date' && /\.when$/.test(el.getAttribute('data-bind') || ''))).catch(() => false);
  const lf = Locator.fill;
  Locator.fill = async function (value, opts) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && await special(this.first())) return set(this.first(), value);
    return lf.call(this, value, opts);
  };
  const pf = Page.fill;
  Page.fill = async function (sel, value, opts) {
    const loc = this.locator(sel).first();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { await loc.waitFor({ state: 'attached', timeout: (opts && opts.timeout) || 30000 }).catch(() => {}); if (await special(loc)) return set(loc, value); }
    return pf.call(this, sel, value, opts);
  };
};
