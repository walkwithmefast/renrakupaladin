// A real drone and a real (non-drone) vehicle: confirm they land on separate Play-mode tabs.
export default async function ({ evalJS, click, sleep, shot }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);

  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const D = window.SR5DATA;
    const drone = D.vehicles.vehicles.find((v) => v.name === 'Ocular Drone');
    const car = D.vehicles.vehicles.find((v) => v.name === 'Dodge Scoot (Scooter)');
    ch.vehicles.push({ uid: 'd1', id: drone.id, name: drone.name, mods: [] });
    ch.vehicles.push({ uid: 'v1', id: car.id, name: car.name, mods: [] });
    ch.mode = 'career'; ch.career = { earned: 10, log: [], nuyenEarned: 0 };
    st.settings = { ...(st.settings || {}), focusPages: { drone: true, magic: false } };
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.mode-opt.play', ''); await sleep(500);

  const tabs = await q(`[...document.querySelectorAll('.tab-btn')].map((b) => b.textContent)`);
  check('both Drones and Vehicles tabs appear', tabs.includes('Drones') && tabs.includes('Vehicles'), JSON.stringify(tabs));

  await click('.tab-btn', 'Drones'); await sleep(400);
  const droneBody = await q(`document.body.innerText`);
  check('Drones tab shows the Ocular Drone', droneBody.includes('Ocular Drone'));
  check('Drones tab does NOT show the Dodge Scoot', !droneBody.includes('Dodge Scoot'));
  await shot('vehicles-split-drones');

  await click('.tab-btn', 'Vehicles'); await sleep(400);
  const vehicleBody = await q(`document.body.innerText`);
  check('Vehicles tab shows the Dodge Scoot', vehicleBody.includes('Dodge Scoot'));
  check('Vehicles tab does NOT show the Ocular Drone', !vehicleBody.includes('Ocular Drone'));
  await shot('vehicles-split-vehicles');

  const gearBody = await q(`(async () => { document.querySelector('.tab-btn')?.click(); return ''; })()`);
  await click('.tab-btn', 'Gear'); await sleep(400);
  const gearText = await q(`document.body.innerText`);
  check('the compact Gear-tab table still lists both (unchanged)', gearText.includes('Ocular Drone') && gearText.includes('Dodge Scoot'));
}
