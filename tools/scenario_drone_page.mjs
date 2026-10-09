// The Drones focus page in play: damage tracks, control modes, pools, mounted weapon + ammo, notes, status strip.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('setup:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    const drones = D.vehicles.vehicles.filter(v => /Drone/.test(v.category) && v.pilot === '3' && !/\\//.test(String(v.handling)));
    const a = drones.find(v => v.body === '2'), b = drones.find(v => v.body !== '2');
    const armorUp = D.vehicles.mods.find(m => m.name === 'Armor (Drone)');
    ch.info.name = 'Torque';
    ch.vehicles.push({ uid: 'd1', id: a.id, name: a.name, mods: [{ id: armorUp.id, rating: Number(a.armor) + 1 }] }, { uid: 'd2', id: b.id, name: b.name, mods: [] });
    for (const [n, r] of [['[Model] Evasion Autosoft', 3], ['Clearsight Autosoft', 3], ['[Weapon] Targeting Autosoft', 4]]) { const g = D.gear.gears.find(x => x.name === n); ch.gear.push({ uid: 'as' + r + n.length, id: g.id, name: g.name, rating: r }); }
    const cr = D.cyberware.cyberwares.find(c => c.name === 'Control Rig'); ch.cyberware.push({ uid: 'cr', id: cr.id, name: cr.name, rating: 1 });
    const w = D.weapons.weapons.find(x => x.name === 'Ingram Smartgun X' ) || D.weapons.weapons.find(x => x.category === 'Submachine Guns');
    ch.weapons.push({ uid: 'w1', id: w.id, name: w.name });
    st.settings.focusPages = { drone: true };
    ch.mode = 'career'; st.viewModes = { ...(st.viewModes || {}), [ch.id]: 'play' };
    localStorage.setItem(KEY, JSON.stringify(st));
    return a.name + ' (Body ' + a.body + ', Armor ' + a.armor + ' -> +1) + ' + b.name + ' + ' + w.name;
  })()`));
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Drones'); await sleep(400);
  const card = (i) => `document.querySelectorAll('.drone-card')[${i}]`;
  const info = (i) => q(`(() => { const c = ${card(i)}; const t = {}; c.querySelectorAll('.dtest').forEach(x => { t[x.querySelector('.lbl').textContent] = x.querySelector('b').textContent; }); return JSON.stringify({ boxes: [...c.querySelectorAll('.monitor')].map(m => m.querySelector('.lbl').textContent.trim()), init: [...c.querySelectorAll('.stat')].find(s => s.textContent.startsWith('Initiative'))?.querySelector('b').textContent, tests: t }); })()`);
  check('status strip lists both drones', (await q(`document.querySelectorAll('.dchip').length`)) === 2);
  const a0 = JSON.parse(await info(0));
  console.log('   drone 1 (autonomous):', JSON.stringify(a0));
  check('Physical 7 boxes (6 + Body 2/2), Matrix 10 (8 + Pilot 3/2)', a0.boxes.join('|') === 'Physical 0/7|Matrix 0/10', a0.boxes.join(' | '));
  check('autonomous Initiative Pilot x 2 + 4D6', a0.init === '6 + 4D6', a0.init);
  check('Defense uses the Evasion autosoft (Pilot 3 + 3)', a0.tests.Defense.startsWith('6'), a0.tests.Defense);

  // damage: tick 3 boxes on drone 1
  await q(`${card(0)}.querySelectorAll('.monitor')[0].querySelectorAll('.box')[2].click()`); await sleep(250);
  check('ticking damage shows in the strip', (await q(`document.querySelector('.dchip').textContent`)).includes('Phys 3/7'), await q(`document.querySelector('.dchip').textContent`));

  // jump in
  await q(`[...${card(0)}.querySelectorAll('.mode-opt')].find(b => b.textContent === 'Jumped in').click()`); await sleep(300);
  const j = JSON.parse(await info(0));
  console.log('   drone 1 (jumped in):', JSON.stringify(j));
  check('jumped in: VR hot-sim Initiative, sim choice + control rig note', await q(`!!${card(0)}.querySelector('.simrow') && /control rig 1/.test(${card(0)}.querySelector('.simrow').textContent)`), j.init);
  check('jumped-in Handling shows the +1 from the control rig', await q(`[...${card(0)}.querySelectorAll('.stat')].find(s => s.textContent.startsWith('Handling')).textContent.includes('+1')`));
  await q(`[...${card(1)}.querySelectorAll('.mode-opt')].find(b => b.textContent === 'Jumped in').click()`); await sleep(300);
  check('jumping into drone 2 drops you out of drone 1', await q(`[...${card(0)}.querySelectorAll('.mode-opt')].find(b => b.classList.contains('on')).textContent === 'Autonomous'`));

  // mount the weapon on drone 1, fire a burst
  await q(`(() => { const s = ${card(0)}.querySelector('select[aria-label^="Mount"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'w1'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  const wtxt = await q(`${card(0)}.querySelector('.dweapon')?.textContent`);
  check('mounted weapon shows DV/AP/Attack (Pilot 3 + Targeting 4 = 7) and ammo', /Attack7/.test(wtxt.replace(/\s/g, '')) && /\d+\/\d+/.test(wtxt), wtxt);
  const before = await q(`${card(0)}.querySelector('.dweapon .ammo-ctl b').textContent`);
  await q(`[...${card(0)}.querySelectorAll('.dweapon .ammo-ctl button')].find(b => b.textContent === '−3').click()`); await sleep(250);
  const after = await q(`${card(0)}.querySelector('.dweapon .ammo-ctl b').textContent`);
  check('firing a burst uses ammo', before !== after, `${before} -> ${after}`);

  // a plain text <input>'s onChange needs the native 'input' event to fire reliably (unlike a <select>, where
  // 'change' is enough) - 'change' alone silently no-ops on it, which used to make the last check below false-fail.
  await q(`(() => { const i = ${card(0)}.querySelector('.dfoot input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Overwatch on the roof, silent running'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(250);
  await shot('drone-page');

  // the character's own damage tracker must not wipe drone damage
  await click('.tab-btn', 'Sheet'); await sleep(300);
  await q(`document.querySelectorAll('.monitor')[0].querySelectorAll('.box')[1].click()`); await sleep(250);
  await click('.tab-btn', 'Drones'); await sleep(300);
  check('drone damage + notes survive taking damage yourself', (await q(`document.querySelector('.dchip').textContent`)).includes('Phys 3/7') && (await q(`${card(0)}.querySelector('.dfoot input').value`)).startsWith('Overwatch'));
}
