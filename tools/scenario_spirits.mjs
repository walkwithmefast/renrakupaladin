// Verify Spirits/Sprites: patch a fresh character into a Hermetic mage, summon a spirit, adjust services.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);

  console.log('patched:', await q(`(() => {
    try {
      const KEY = 'chummer-remake.v1';
      const st = JSON.parse(localStorage.getItem(KEY));
      const ch = st.chars[st.currentId];
      ch.pri.talent = 'A';
      ch.talent = 'Magician';
      ch.tradition = 'Hermetic';
      localStorage.setItem(KEY, JSON.stringify(st));
      return 'ok';
    } catch (e) { return 'ERR: ' + e.message; }
  })()`));
  await q(`location.reload()`);
  await sleep(1200);

  await click('.tab-btn', 'Magic'); await sleep(300);
  console.log('all panel titles on Magic tab:', await q(`[...document.querySelectorAll('.panel h3')].map(h=>h.textContent).join(' | ')`));
  console.log('Spirits panel present:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Spirits'))`));

  console.log('click + Add:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Spirits'));
    panel.querySelector('button.primary').click();
    return 'ok';
  })()`));
  await sleep(300);
  console.log('picker categories (should include combat/detection/etc.):', await q(`document.querySelector('.picker-bar select')?.textContent.replace(/\\s+/g,' ')`));
  console.log('pick Spirit of Fire:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r=>r.textContent.includes('Spirit of Fire')); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return 'ok'; })()`));
  await sleep(300);

  console.log('spirit row present:', await q(`!!document.querySelector('.spirit-row')`));
  console.log('spirit stats shown:', await q(`document.querySelector('.spirit-row .stat-grid')?.textContent.replace(/\\s+/g,' ')`));
  console.log('powers listed:', await q(`document.querySelector('.spirit-row').textContent.includes('Powers:')`));

  // bump Force via the stepper input, check stats rescale
  console.log('bump Force to 6:', await q(`(() => {
    const row = document.querySelector('.spirit-row');
    const input = row.querySelector('.stepper input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`));
  await sleep(200);
  console.log('stats after Force 6:', await q(`document.querySelector('.spirit-row .stat-grid')?.textContent.replace(/\\s+/g,' ')`));

  // bump services owed
  console.log('bump services:', await q(`(() => {
    const row = document.querySelector('.spirit-row');
    const steppers = row.querySelectorAll('.stepper');
    const inc = steppers[1].querySelector('button[aria-label="increase"]');
    inc.click(); inc.click();
    return 'ok';
  })()`));
  await sleep(200);
  console.log('services value:', await q(`document.querySelectorAll('.spirit-row .stepper input')[1]?.value`));

  console.log('check Bound:', await q(`(() => { const cb = document.querySelector('.spirit-row input[type=checkbox]'); cb.click(); return cb.checked; })()`));
  await sleep(200);

  // Force way above Magic 6 to trigger the warning
  console.log('bump Force to 20 (over Magic 6):', await q(`(() => {
    const row = document.querySelector('.spirit-row');
    const input = row.querySelector('.stepper input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 20);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`));
  await sleep(200);
  console.log('over-Magic hint shown:', await q(`!!document.querySelector('.spirit-row .hint.bad')`));

  await shot('spirits-check', { full: true });

  console.log('remove spirit:', await q(`(() => { const b = document.querySelector('.spirit-row button.ghost.sm'); if (!b) return 'NOT FOUND'; b.click(); return 'ok'; })()`));
  await sleep(200);
  console.log('row gone:', await q(`!document.querySelector('.spirit-row')`));

  // Play mode should show it too
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Magic'); await sleep(300);
  console.log('Spirits panel present in Play:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Spirits'))`));
}
