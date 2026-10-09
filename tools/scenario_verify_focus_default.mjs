// A fresh character (settings never touched) with a drone, a vehicle and Magic: Drones/Vehicles/the richer
// Magic tab should all appear with no trip to Settings. Then explicitly opting out of one keeps it off.
export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);

  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const D = window.SR5DATA;
    const drone = D.vehicles.vehicles.find((v) => v.name === 'Ocular Drone');
    const car = D.vehicles.vehicles.find((v) => v.name === 'Dodge Scoot (Scooter)');
    ch.vehicles.push({ uid: 'd1', id: drone.id, name: drone.name, mods: [] });
    ch.vehicles.push({ uid: 'v1', id: car.id, name: car.name, mods: [] });
    ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' }; ch.talent = 'Magician';
    ch.mode = 'career'; ch.career = { earned: 10, log: [], nuyenEarned: 0 };
    // note: st.settings.focusPages is deliberately left untouched (undefined) - the point of this check
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.mode-opt.play', ''); await sleep(500);

  const tabs = await q(`[...document.querySelectorAll('.tab-btn')].map((b) => b.textContent)`);
  check('Drones and Vehicles both appear with no Settings visit', tabs.includes('Drones') && tabs.includes('Vehicles'), JSON.stringify(tabs));
  await click('.tab-btn', 'Magic'); await sleep(400);
  const hasSustain = await q(`document.body.innerText.includes('Sustain')`);
  check('the richer Magic tab (Sustained tracker) shows by default too', hasSustain);

  // now opt out of drones/vehicles in Settings and confirm they disappear
  await click('.mode-opt.build', ''); await sleep(400);
  await click('.tab-btn', 'Settings'); await sleep(400);
  await q(`(() => { const c = [...document.querySelectorAll('input[type=checkbox]')].find((c) => /drone/i.test(c.closest('label')?.textContent || '')); c.click(); })()`);
  await sleep(400);
  await click('.mode-opt.play', ''); await sleep(500);
  const tabs2 = await q(`[...document.querySelectorAll('.tab-btn')].map((b) => b.textContent)`);
  check('opting out in Settings removes both tabs', !tabs2.includes('Drones') && !tabs2.includes('Vehicles'), JSON.stringify(tabs2));
}
