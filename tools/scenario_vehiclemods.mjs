export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Gear'); await sleep(300);

  console.log('click + Add on Vehicles panel:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    if (!panel) return 'NO PANEL';
    panel.querySelector('button.primary').click();
    return 'ok';
  })()`));
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.picker-bar input.search'); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(i, 'Ares Roadmaster'); i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await sleep(200);
  console.log('pick a vehicle:', await q(`(() => { const row = document.querySelector('.tbl.pick tbody tr'); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return row.textContent.trim().slice(0,40); })()`));
  await sleep(300);

  console.log('mods editor present:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    return !!panel.querySelector('.mods');
  })()`));
  console.log('vehicle cost before mod:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    return panel.querySelector('tbody tr .strong')?.textContent;
  })()`));

  console.log('click + modification:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    const b = [...panel.querySelectorAll('.mods button')].find(x=>x.textContent.includes('+ modification'));
    if (!b) return 'NOT FOUND'; b.click(); return 'ok';
  })()`));
  await sleep(300);
  console.log('mod picker rows:', await q(`document.querySelectorAll('.tbl.pick tbody tr').length`));
  console.log('pick a mod:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r => !r.textContent.includes('Requirements')); if (!row) return 'NOT FOUND'; const name = row.querySelector('td').textContent; row.querySelector('.primary.sm').click(); return name; })()`));
  await sleep(300);
  await q(`document.querySelector('.modal button[aria-label="close"]')?.click()`);
  await sleep(200);

  console.log('mod chip shown:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    return panel.querySelector('.chip.on')?.textContent.trim();
  })()`));
  console.log('vehicle cost after mod:', await q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.startsWith('Vehicles'));
    return panel.querySelector('tbody tr .strong')?.textContent;
  })()`));

  // open the Inspector too
  console.log('open inspector:', await q(`(() => { const el = document.querySelector('.owned .linkname'); if (!el) return 'NOT FOUND'; el.click(); return 'ok'; })()`));
  await sleep(300);
  console.log('drawer Modifications section:', await q(`[...document.querySelectorAll('.drawer h4')].map(h=>h.textContent).join(' | ')`));

  await shot('vehiclemods-check', { full: true });
}
