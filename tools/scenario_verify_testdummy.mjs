// Read-only verification of the real "Test Dummy" character file: loads its exact JSON into a fresh browser
// profile's localStorage (never touches the real characters/ folder) and checks it renders cleanly plus
// reproduces the Customized (Drone) pricing bug as expected.
import fs from 'node:fs';
export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  const chJson = fs.readFileSync('characters/Test Dummy.rp.json', 'utf8');
  await sleep(300);
  const setup = await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const ch = ${chJson};
    localStorage.setItem(KEY, JSON.stringify({ v: 1, chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, settings: { focusPages: { drone: true, magic: true } } }));
    return true;
  })()`);
  console.log('setup:', setup);
  await q(`location.reload()`);
  await sleep(1500);
  await q(`window.addEventListener('error', (e) => { (window.__errs ||= []).push(e.message); });`);
  for (const t of ['Build', 'Skills', 'Qualities', 'Magic', 'Augments', 'Gear', 'Life', 'Sheet', 'Settings']) {
    await click('.tab-btn', t);
    await sleep(300);
  }
  const errs = await q(`window.__errs || []`);
  console.log('console/page errors after touring every tab:', JSON.stringify(errs));
  await click('.tab-btn', 'Gear');
  await sleep(400);
  const bodyText = await q(`document.body.innerText`);
  const nuyenIdx = bodyText.indexOf('Nuyen:');
  console.log('nuyen line:', JSON.stringify(bodyText.slice(nuyenIdx, nuyenIdx + 60)));
  const scootIdx = bodyText.indexOf('Dodge Scoot');
  console.log('Dodge Scoot area:', JSON.stringify(scootIdx === -1 ? 'not found' : bodyText.slice(scootIdx, scootIdx + 250)));
}
