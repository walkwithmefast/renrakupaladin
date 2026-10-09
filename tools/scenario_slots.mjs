// Mod Points / slots on vehicles, and elemental armor on the Sheet.
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const rigger = JSON.parse(readFileSync(new URL('../../Dez Calloway (Torque).crm.json', import.meta.url), 'utf8'));
  await q(`(() => {
    const D = window.SR5DATA; const ch = ${JSON.stringify(rigger)};
    const car = D.vehicles.vehicles.find(v => v.name === 'GMC Bulldog Step-Van (Van)');
    const armorStd = D.vehicles.mods.find(m => m.name === 'Armor (Standard)');
    ch.vehicles.push({ uid: 'car1', id: car.id, name: car.name, mods: [{ id: armorStd.id, rating: 4 }] });
    const jacket = D.armor.armors.find(a => a.name === 'Armor Jacket');
    const am = (n) => D.armor.mods.find(m => m.name === n).id;
    ch.armor.push({ uid: 'aj', id: jacket.id, name: jacket.name, mods: [{ id: am('Fire Resistance'), rating: 4 }, { id: am('Chemical Seal'), rating: 1 }] });
    localStorage.setItem('chummer-remake.v1', JSON.stringify({ chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: {}, settings: { books: null, rules: {} } }));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Gear'); await sleep(400);
  const pips = await q(`[...document.querySelectorAll('.slotpip')].map(p => p.textContent).join(' | ')`);
  console.log('   slot pips:', pips);
  check('drones show Mod Points', /Mod Points \d+\/\d+/.test(pips));
  check('the van shows Protection 8/16 (Armor Standard 4 = 8 slots)', /Protection 8\/16/.test(pips));
  await q(`[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.startsWith('Vehicles')).scrollIntoView()`); await sleep(200);
  await shot('slots-vehicles');
  await click('.tab-btn', 'Sheet'); await sleep(400);
  const prot = await q(`document.querySelector('.protection')?.textContent`);
  check('Sheet shows fire armor with its soak pool, and the chemical seal immunity', !!prot && /Fire \+4/.test(prot) && /soak \d+/.test(prot) && /Immune: contact toxins/.test(prot), prot);
  await q(`document.querySelector('.protection').scrollIntoView({ block: 'center' })`); await sleep(200);
  await shot('slots-protection');
}
