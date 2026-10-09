// Verify foci in the browser: bond a Power Focus, see the Karma cost, and the Force-vs-Magic warning
// when it's over. Creates a real character via the app's own "New" flow, then patches just the priority
// fields needed to make it a magician (rather than hand-rolling a character object, which is missing
// fields derive() expects) and reloads so the app re-reads it from localStorage.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);

  await click('button', 'Create a new runner'); await sleep(400);

  const patched = await q(`(() => {
    try {
      const KEY = 'chummer-remake.v1';
      const st = JSON.parse(localStorage.getItem(KEY));
      const ch = st.chars[st.currentId];
      ch.pri.talent = 'A';
      ch.talent = 'Magician';
      ch.tradition = 'Hermetic';
      localStorage.setItem(KEY, JSON.stringify(st));
      return 'ok: ' + ch.id;
    } catch (e) { return 'ERR: ' + e.message; }
  })()`);
  console.log('patched character:', patched);

  await q(`location.reload()`);
  await sleep(1200);

  await click('.tab-btn', 'Magic'); await sleep(300);
  console.log('Bonded focus Force stat visible (confirms MAG is enabled)?', await q(`[...document.querySelectorAll('.stat .lbl')].some(l=>l.textContent.includes('Bonded focus Force'))`));

  await click('.tab-btn', 'Gear'); await sleep(300);
  console.log('click + Add on Gear panel:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent === 'Gear');
    if (!panel) return 'NO PANEL';
    panel.querySelector('button.primary').click();
    return 'ok';
  })()`));
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.picker-bar input.search'); i.value = 'Power Focus'; i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await sleep(200);
  console.log('picker matches:', await q(`document.querySelector('.picker-bar .count')?.textContent`));
  console.log('pick Power Focus:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r=>r.textContent.includes('Power Focus')); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return 'ok'; })()`));
  await sleep(300);

  console.log('Bonding row present:', await q(`!!document.querySelector('.focus-bond')`));
  console.log('bonding text before check:', await q(`document.querySelector('.focus-bond .dim')?.textContent`));

  console.log('bump rating stepper up to 8 (over Magic 6):', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent === 'Gear');
    const input = panel.querySelector('.stepper input');
    if (!input) return 'NOT FOUND';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 8);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`));
  await sleep(200);
  console.log('bonding text after rating bump:', await q(`document.querySelector('.focus-bond .dim')?.textContent`));

  console.log('check Bonded:', await q(`(() => { const cb = document.querySelector('.focus-bond input[type=checkbox]'); cb.click(); return cb.checked; })()`));
  await sleep(200);
  console.log('over-limit pip shown:', await q(`!!document.querySelector('.focus-bond .pip.bad')`));

  await click('.tab-btn', 'Magic'); await sleep(300);
  console.log('Bonded focus Force stat:', await q(`(() => { const s = [...document.querySelectorAll('.stat')].find(x=>x.textContent.includes('Bonded focus Force')); return s ? s.textContent.replace(/\\s+/g,' ') : 'NOT FOUND'; })()`));
  console.log('stat has .bad class (over limit):', await q(`(() => { const s = [...document.querySelectorAll('.stat')].find(x=>x.textContent.includes('Bonded focus Force')); return s ? s.classList.contains('bad') : 'n/a'; })()`));

  // open the Inspector too, and check the same info + rulebook link show there
  await click('.tab-btn', 'Gear'); await sleep(300);
  console.log('open inspector:', await q(`(() => { const el = [...document.querySelectorAll('.linkname')].find(e=>e.textContent.includes('Power Focus')); if (!el) return 'NOT FOUND'; el.click(); return 'ok'; })()`));
  await sleep(300);
  console.log('drawer Bonding section:', await q(`[...document.querySelectorAll('.drawer h4')].map(h=>h.textContent).join(' | ')`));
  console.log('drawer bonding link href:', await q(`document.querySelector('.drawer .focus-bond a')?.getAttribute('href')`));

  await shot('foci-check', { full: true });
}
