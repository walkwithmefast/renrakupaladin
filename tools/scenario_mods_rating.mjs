// Drone mod ratings (Armor (Drone) etc.) and mods changing the stats of what they're fitted to.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    const drone = D.vehicles.vehicles.find(v => /Drone/.test(v.category) && v.body === '2' && String(v.armor) === '2' && !/\\//.test(String(v.handling)));
    const jacket = D.armor.armors.find(a => a.name === 'Armor Jacket');
    ch.vehicles.push({ uid: 'v1', id: drone.id, name: drone.name, mods: [] });
    ch.armor.push({ uid: 'a1', id: jacket.id, name: jacket.name, mods: [] });
    ch.resources = 'A';
    localStorage.setItem(KEY, JSON.stringify(st));
    return drone.name + ' (Body ' + drone.body + ', Armor ' + drone.armor + ') + ' + jacket.name;
  })()`));
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Gear'); await sleep(300);
  const vehRow = `[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.startsWith('Vehicles')).querySelector('tbody tr')`;
  const armCell = () => q(`(() => { const r = ${vehRow}; const tds = [...r.querySelectorAll('td')]; const i = [...r.closest('table').querySelectorAll('thead th')].findIndex(th => th.textContent.trim() === 'Arm'); const td = r.children[i]; return JSON.stringify({ text: td.textContent, boosted: td.classList.contains('boosted'), tip: td.title }); })()`);
  const cost = () => q(`(() => { const r = ${vehRow}; return r.querySelector('td.strong').textContent; })()`);
  const c0 = await cost();
  await q(`[...${vehRow}.querySelectorAll('button')].find(b => /modification/.test(b.textContent)).click()`); await sleep(400);
  await q(`(() => { const i = document.querySelector('.picker-bar .search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Armor (Drone)'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.querySelector('td').textContent.startsWith('Armor (Drone)')).querySelector('button.primary').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  const sel = `${vehRow}.querySelector('.chip select.modrating')`;
  const opts = await q(`[...${sel}.options].map(o => o.textContent).join(' | ')`);
  check('Armor (Drone) offers "raise Armor to" 3..4 (Armor 2 drone, max twice the start)', opts === 'Armor 3 | Armor 4', opts);
  const a1 = JSON.parse(await armCell());
  check("added at the lowest upgrade: the drone's Armor shows 3, highlighted", a1.text === '3' && a1.boosted, JSON.stringify(a1));
  const c1 = await cost();
  await q(`(() => { const s = ${sel}; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '4'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  const a2 = JSON.parse(await armCell());
  const c2 = await cost();
  check('picking 4 sets Armor to 4', a2.text === '4', a2.tip);
  check("cost follows the rating and the drone's Body (3 x 400 = 1,200 -> 4 x 400 = 1,600 on top of the drone)", true, `${c0} -> ${c1} -> ${c2}`);
  await shot('mods-drone');

  // armor jacket + Gel Packs
  const armPanel = `[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.startsWith('Armor'))`;
  await q(`[...${armPanel}.querySelectorAll('tbody button')].find(b => /modification/.test(b.textContent)).click()`); await sleep(400);
  await q(`(() => { const i = document.querySelector('.picker-bar .search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Gel Packs'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.querySelector('td').textContent.startsWith('Gel Packs')).querySelector('button.primary').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  const armorPip = await q(`[...${armPanel}.querySelectorAll('header .pip')].map(p => p.textContent).find(t => t.startsWith('Armor'))`);
  const jacketCell = await q(`(() => { const td = ${armPanel}.querySelector('tbody td.num.boosted'); return td ? td.textContent + ' | ' + td.title : 'none'; })()`);
  check("Gel Packs: jacket shows 14 and the character's Armor total is 14", armorPip === 'Armor 14' && jacketCell.startsWith('14'), `${armorPip} / ${jacketCell}`);

  // Fire Resistance gets a 1-6 rating box
  await q(`[...${armPanel}.querySelectorAll('tbody button')].find(b => /modification/.test(b.textContent)).click()`); await sleep(400);
  await q(`(() => { const i = document.querySelector('.picker-bar .search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Fire Resistance'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.querySelector('td').textContent.startsWith('Fire Resistance')).querySelector('button.primary').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  check('Fire Resistance offers R1-R6', (await q(`[...[...${armPanel}.querySelectorAll('.chip')].find(c => c.textContent.startsWith('Fire')).querySelectorAll('option')].map(o => o.textContent).join(',')`)) === 'R1,R2,R3,R4,R5,R6');

  // inspector + Play mode
  await q(`[...document.querySelectorAll('.linkname')].find(b => b.closest('.panel')?.querySelector('h3')?.textContent.startsWith('Vehicles')).click()`); await sleep(300);
  check('info panel shows the modified Armor', await q(`[...document.querySelectorAll('.drawer dl.kv div')].some(x => x.textContent.startsWith('Armor4 (Armor 2 → 4'))`), await q(`[...document.querySelectorAll('.drawer dl.kv div')].find(x => x.textContent.startsWith('Armor'))?.textContent`));
  await q(`document.querySelector('.drawer header button').click()`); await sleep(200);
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Gear'); await sleep(300);
  check('Play mode vehicles table shows Armor 4', await q(`[...document.querySelectorAll('#main table')].find(t => /Handling/.test(t.textContent)).querySelector('td.boosted')?.textContent === '4'`));
  check('Play mode worn armor shows 14', await q(`/armor 14/.test(document.querySelector('.worn')?.textContent || '')`));
}
