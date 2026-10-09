// Typed ammo in the weapons table + the situational-modifier section of the roll tray.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const D = window.SR5DATA;
    const w = D.weapons.weapons.find(x => x.name === 'Ares Predator V');
    const am = (n) => D.gear.gears.find(g => g.name === 'Ammo: ' + n);
    ch.weapons.push({ uid: 'w1', id: w.id, name: w.name });
    ch.gear.push({ uid: 'g1', id: am('APDS').id, name: am('APDS').name, qty: 10 }, { uid: 'g2', id: am('Stick-n-Shock').id, name: am('Stick-n-Shock').name, qty: 10 });
    ch.attrs.AGI = { p: 3, k: 0, a: 0 }; const pis = D.skills.skills.find(k => k.name === 'Pistols'); ch.skills[pis.id] = { p: 4, k: 0, a: 0 };
    ch.play = { phys: 3 }; st.viewModes = { [ch.id]: 'play' };
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  const row = `[...document.querySelectorAll('.weapons tbody tr')].find(r => r.textContent.includes('Ares Predator V'))`;
  const dvap = () => q(`(() => { const t = [...${row}.querySelectorAll('td')]; return t[1].textContent + ' / ' + t[2].textContent; })()`);
  const loadAmmo = (label) => q(`(() => { const s = ${row}.querySelector('select.ammosel'); const o = [...s.options].find(o => o.textContent === ${JSON.stringify(label)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  check('regular rounds: 8P / -1', (await dvap()) === '8P / -1', await dvap());
  await loadAmmo('APDS'); await sleep(250);
  check('APDS loaded: 8P / -5', (await dvap()) === '8P / -5', await dvap());
  await loadAmmo('Stick-n-Shock'); await sleep(250);
  check('Stick-n-Shock: 6S(e) / -5', (await dvap()) === '6S(e) / -5', await dvap());

  await q(`${row}.querySelector('.rollbtn').click()`); await sleep(300);
  const base = Number(await q(`document.querySelector('.roll-pool b').textContent`));
  check('attack tray has the situation section, wound modifier applied (3 boxes = -1)', await q(`!!document.querySelector('.combatmods') && /Wound modifier/.test(document.querySelector('.cm-grid').textContent)`), `pool ${base}`);
  const tick = (label) => q(`[...document.querySelectorAll('.cm-grid label')].find(l => l.textContent.includes(${JSON.stringify(label)})).querySelector('input').click()`);
  await tick('You are running'); await sleep(100);
  await tick('Wireless smartgun: gear'); await sleep(100);
  await q(`(() => { const s = [...document.querySelectorAll('.cm-env select')][3]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'Long'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(200);
  const pip = await q(`document.querySelector('.combatmods summary .pip').textContent`);
  check('running -2, smartgun +1, wound -1, long range -3 = -5', pip === '-5 dice', pip);
  await shot('combat-tray');
  await q(`document.querySelector('.modal header button').click()`); await sleep(200);

  await click('.tab-btn', 'Sheet'); await sleep(300);
  await q(`[...document.querySelectorAll('.pool-tile')].find(t => t.textContent.startsWith('Defense')).querySelector('.rollbtn').click()`); await sleep(300);
  await q(`[...document.querySelectorAll('.cm-grid label')].find(l => l.textContent.includes('Good cover')).querySelector('input').click()`); await sleep(100);
  await q(`[...document.querySelectorAll('.cm-grid label')].find(l => l.textContent.includes('Partial cover')).querySelector('input').click()`); await sleep(100);
  const defPip = await q(`document.querySelector('.combatmods summary .pip').textContent`);
  check('defense: good and partial cover are exclusive (+2 partial, -1 wound)', defPip === '+1 dice' && !(await q(`[...document.querySelectorAll('.cm-grid label')].find(l => l.textContent.includes('Good cover')).querySelector('input').checked`)), defPip);
}
