// Verify the new interactive "mods & add-ons" editors in the Inspector drawer: weapon accessories,
// armor mods, a cyberdeck's Attribute Array + running programs, and the read-only "Comes with" list -
// plus that the Gear tab table's own inline editors (now sharing the same components) still work,
// and that everything goes read-only in Play mode.
import { resolve } from 'node:path';
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const file = resolve('../Chummer5.226.0/saves/autosave/Ten-Twelve Inazuma.chum5');
  const doc = await send('DOM.getDocument', { depth: 1 });
  const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: [file] });
  await sleep(1200);
  await click('.modal button.primary', 'Done'); await sleep(300);

  // ---- Build mode, Gear tab: weapon accessories in the drawer ------------------------------
  await click('.tab-btn', 'Gear'); await sleep(300);
  console.log('gear subtabs:', await q(`[...document.querySelectorAll('.subtab')].map(b=>b.textContent).join(' | ')`));

  const clickInPanel = (title, text) => q(`(() => {
    const panel = [...document.querySelectorAll('.panel')].find(p => p.querySelector('header h3')?.textContent.includes(${JSON.stringify(title)}));
    if (!panel) return 'NO PANEL: ${title}';
    const el = [...panel.querySelectorAll('.linkname')].find(e => e.textContent.includes(${JSON.stringify(text)}));
    if (!el) return 'NOT FOUND: ${title} / ${text}';
    el.click(); return 'ok';
  })()`);

  console.log('open weapon inspector:', await clickInPanel('Weapons', 'Beretta Northstar'));
  await sleep(300);
  console.log('drawer title:', await q(`document.querySelector('.drawer h3')?.textContent`));
  console.log('drawer sections:', await q(`[...document.querySelectorAll('.drawer section h4')].map(h=>h.textContent).join(' | ')`));
  console.log('Yours rows (no stray Accessories text row expected):', await q(`[...document.querySelectorAll('.drawer .own dt')].map(d=>d.textContent).join(' | ')`));
  console.log('accessory chips before:', await q(`[...document.querySelectorAll('.drawer .mods .chip.on')].map(c=>c.textContent).join(' | ')`));
  console.log('accuracy stat before:', await q(`[...document.querySelectorAll('.drawer dl')].map(dl=>dl.textContent).join('\\n')`).then((s) => (s.match(/Accuracy[^|]*/) || [''])[0]));

  console.log('click + accessory:', await click('.drawer .mods button', '+ accessory'));
  await sleep(250);
  console.log('picker visible above drawer:', await q(`(() => { const p = document.querySelector('.modal-back'); const d = document.querySelector('.drawer'); if (!p || !d) return 'missing'; const pz = getComputedStyle(p).zIndex, dz = getComputedStyle(d).zIndex; return 'picker z=' + pz + ' drawer z=' + dz + ' -> ' + (Number(pz) > Number(dz)); })()`));
  await q(`(() => { const i = document.querySelector('.picker-bar input.search'); i.value = 'smartgun'; i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await sleep(200);
  console.log('picker matches:', await q(`document.querySelector('.picker-bar .count')?.textContent`));
  console.log('pick Smartgun:', await click('.modal.wide .tbl.pick tbody tr td .primary.sm'));
  await sleep(300);
  console.log('accessory chips after add:', await q(`[...document.querySelectorAll('.drawer .mods .chip.on')].map(c=>c.textContent.trim()).join(' | ')`));
  console.log('accuracy stat after (should show +2 tooltip):', await q(`[...document.querySelectorAll('.drawer dl div')].find(d=>d.textContent.includes('Accuracy'))?.textContent`));

  console.log('gear-tab table reflects the same add (dice pool cell):', await q(`document.querySelector('.weapons tbody tr td.strong')?.textContent.trim()`));

  console.log('remove accessory in drawer:', await click('.drawer .mods .chip.on button'));
  await sleep(250);
  console.log('accessory chips after remove:', await q(`[...document.querySelectorAll('.drawer .mods .chip.on')].map(c=>c.textContent).join(' | ') || '(none)'`));
  await q(`document.querySelector('.drawer button[aria-label="Close details"]').click()`);
  await sleep(200);

  // ---- Build mode: cyberdeck attribute array + programs + bundle list ---------------------
  console.log('open deck inspector:', await clickInPanel('Gear', 'Renraku Tsurugi'));
  await sleep(300);
  console.log('drawer sections (deck):', await q(`[...document.querySelectorAll('.drawer section h4')].map(h=>h.textContent).join(' | ')`));
  console.log('attribute array selects:', await q(`[...document.querySelectorAll('.drawer .deck-config select')].map(s=>s.value).join(',')`));
  console.log('array ok? (no bad hint expected):', await q(`!document.querySelector('.drawer .deck-config .hint.bad')`));
  console.log('comes-with chips:', await q(`(() => { const h = [...document.querySelectorAll('.drawer h4')].find(h=>h.textContent==='Comes with'); if (!h) return 'MISSING'; return [...h.nextElementSibling.querySelectorAll('.chip')].map(c=>c.textContent).join(' | '); })()`));

  // change the deck's Attack/Sleaze assignment and confirm it round-trips
  const before = await q(`[...document.querySelectorAll('.drawer .deck-config select')].map(s=>s.value)`);
  await q(`(() => { const sels = [...document.querySelectorAll('.drawer .deck-config select')]; const a = sels[0], s = sels[1]; const av = a.value, sv = s.value; a.value = sv; a.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await sleep(250);
  console.log('array before swap A/S:', before.join(','), '-> after:', await q(`[...document.querySelectorAll('.drawer .deck-config select')].map(s=>s.value).join(',')`));

  await click('.subtab', 'Programs'); await sleep(300);
  console.log('gear-tab MatrixPanel select reflects the swap too:', await q(`(() => { const row = [...document.querySelectorAll('table.devices tbody tr')].find(r=>r.textContent.includes('Renraku')); return row ? [...row.querySelectorAll('select')].map(s=>s.value).join(',') : 'no row'; })()`));
  await click('.subtab', 'Weapons, armor'); await sleep(300);

  await q(`document.querySelector('.drawer button[aria-label="Close details"]').click()`);
  await sleep(150);

  // ---- Play mode: same drawer sections, but read-only ---------------------------------------
  await click('.mode-opt', 'Play'); await sleep(400);
  console.log('play tabs:', await q(`[...document.querySelectorAll('.tab-btn')].map(b=>b.textContent).join(' | ')`));
  // find a weapon link on the sheet/gear read view and open it
  const openedWeapon = await q(`(() => { const el = [...document.querySelectorAll('.linkname')].find(e=>e.textContent.includes('Beretta')); if (!el) return false; el.click(); return true; })()`);
  console.log('opened Beretta in play:', openedWeapon);
  await sleep(300);
  console.log('play: accessory + button present (should be false):', await q(`!![...document.querySelectorAll('.drawer .mods button')].find(b=>b.textContent.includes('+ accessory'))`));
  console.log('play: accessory remove x present (should be false):', await q(`!![...document.querySelectorAll('.drawer .mods .chip button')]`).then((v) => v && q(`document.querySelectorAll('.drawer .mods .chip.removable button').length`)));
  await shot('mods-play-weapon', { full: true });
  await q(`document.querySelector('.drawer button[aria-label="Close details"]')?.click()`);
  await sleep(150);

  const openedDeck = await q(`(() => { const el = [...document.querySelectorAll('.linkname')].find(e=>e.textContent.includes('Renraku')); if (!el) return false; el.click(); return true; })()`);
  console.log('opened deck in play:', openedDeck);
  await sleep(300);
  console.log('play deck sections:', await q(`[...document.querySelectorAll('.drawer section h4')].map(h=>h.textContent).join(' | ')`));
  console.log('play: array rendered as plain text, no selects (should be 0):', await q(`document.querySelectorAll('.drawer .deck-config select').length`));
  console.log('play: array values shown:', await q(`[...document.querySelectorAll('.drawer .deck-config .stat b')].map(b=>b.textContent).join(',')`));
  await shot('mods-play-deck', { full: true });
}
