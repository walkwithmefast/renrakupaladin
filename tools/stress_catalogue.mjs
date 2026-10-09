// Stress test (v28 rules/bug pass): put every catalogue item, one at a time, on a test character and derive it -
// catches crashes, NaN / Infinity / negative numbers, and Inspector (describeItem) failures. Usage:
//   node tools/stress_catalogue.mjs            (all kinds)
//   node tools/stress_catalogue.mjs gear       (one kind)
import { engine, dataMod } from '../test/helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { describeItem } = await import('../src/engine/describe.js');
const { weaponStats } = await import('../src/engine/weapons.js');
const only = process.argv[2];

function base(kind) {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
  ch.talent = kind === 'complexForms' ? 'Technomancer' : 'Mystic Adept';
  ch.mysPP = 3;
  ch.tradition = 'Hermetic';
  for (const a of ['BOD', 'AGI', 'REA', 'STR', 'CHA', 'INT', 'LOG', 'WIL']) ch.attrs[a].p = 2;
  return ch;
}

// walk a derived object for bad numbers (skip huge catalogue refs)
function badNumbers(obj, path = 'd', out = [], seen = new Set(), depth = 0) {
  if (obj == null || depth > 6) return out;
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(`${path}=${obj}`); return out; }
  if (typeof obj !== 'object' || seen.has(obj)) return out;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (['def', 'mt', 'R', 'fx', 'talent', 'md'].includes(k)) continue;
    badNumbers(v, `${path}.${k}`, out, seen, depth + 1);
  }
  return out;
}

const KINDS = {
  qualities: { list: () => idx('qualities', 'qualities').list, add: (ch, x) => ch.qualities.push({ uid: 'x', id: x.id, name: x.name, choice: {}, note: '' }) },
  powers: { list: () => idx('powers', 'powers').list, add: (ch, x) => ch.powers.push({ uid: 'x', id: x.id, name: x.name, level: 1, choice: {} }) },
  spells: { list: () => idx('spells', 'spells').list, add: (ch, x) => ch.spells.push({ uid: 'x', id: x.id, name: x.name }) },
  complexForms: { list: () => idx('complexforms', 'complexforms').list, add: (ch, x) => ch.complexForms.push({ uid: 'x', id: x.id, name: x.name }) },
  gear: { list: () => idx('gear', 'gears').list, add: (ch, x) => ch.gear.push({ uid: 'x', id: x.id, name: x.name, qty: 1, rating: Math.max(1, Number(x.minrating) || 1) }) },
  weapons: { list: () => idx('weapons', 'weapons').list, add: (ch, x) => ch.weapons.push({ uid: 'x', id: x.id, name: x.name, equipped: true }) },
  armor: { list: () => idx('armor', 'armors').list, add: (ch, x) => ch.armor.push({ uid: 'x', id: x.id, name: x.name, equipped: true, rating: 1 }) },
  cyberware: { list: () => idx('cyberware', 'cyberwares').list, add: (ch, x) => ch.cyberware.push({ uid: 'x', id: x.id, name: x.name, grade: 'Standard', rating: Math.max(1, Number(x.minrating) || 1) }) },
  bioware: { list: () => idx('bioware', 'biowares').list, add: (ch, x) => ch.bioware.push({ uid: 'x', id: x.id, name: x.name, grade: 'Standard', rating: Math.max(1, Number(x.minrating) || 1) }) },
  vehicles: { list: () => idx('vehicles', 'vehicles').list, add: (ch, x) => ch.vehicles.push({ uid: 'x', id: x.id, name: x.name }) },
  vehiclemods: { list: () => idx('vehicles', 'mods').list, add: (ch, x) => { const v = idx('vehicles', 'vehicles').list.find((z) => /Roto-Drone|Dodge Scoot/.test(z.name)); ch.vehicles.push({ uid: 'v', id: v.id, name: v.name, mods: [{ id: x.id, rating: 1 }] }); } },
  accessories: { list: () => idx('weapons', 'accessories').list, add: (ch, x) => { const w = idx('weapons', 'weapons').byName.get('ares predator v'); ch.weapons.push({ uid: 'w', id: w.id, name: w.name, mods: [{ id: x.id, rating: 1 }] }); } },
  armormods: { list: () => idx('armor', 'mods').list, add: (ch, x) => { const a = idx('armor', 'armors').byName.get('armor jacket'); ch.armor.push({ uid: 'a', id: a.id, name: a.name, equipped: true, mods: [{ id: x.id, rating: 1 }] }); } },
  lifestyles: { list: () => idx('lifestyles', 'lifestyles').list, add: (ch, x) => ch.lifestyles.push({ uid: 'x', id: x.id, name: x.name, months: 1 }) },
  critterPowers: { list: () => idx('critterpowers', 'powers').list, add: (ch, x) => ch.critterPowers.push({ uid: 'x', id: x.id, name: x.name, rating: 1 }) },
  metamagics: { list: () => idx('metamagic', 'metamagics').list, add: (ch, x) => { ch.initGrade = 1; ch.metamagics.push({ uid: 'x', name: x.name }); } },
  martialArts: { list: () => idx('martialarts', 'martialarts').list, add: (ch, x) => ch.martialArts.push({ uid: 'x', name: x.name, techniques: [] }) },
};

const report = {};
for (const [kind, spec] of Object.entries(KINDS)) {
  if (only && only !== kind) continue;
  const issues = [];
  let n = 0;
  for (const x of spec.list()) {
    n++;
    const ch = base(kind);
    try {
      spec.add(ch, x);
      const d = derive(ch);
      const bad = badNumbers({ attr: d.attr, pools: d.pools, limits: d.limits, init: d.init, cm: d.cm, essence: d.essence, nuyen: d.nuyen, karma: d.karma, skills: d.skills.map((s) => s.pool), armor: d.armor, move: d.move, magic: { pp: d.magic.ppUsed, ppT: d.magic.ppTotal }, items: Object.fromEntries(Object.entries(d.items).map(([k, l]) => [k, l.map((e) => e.cost)])), augs: d.augs.map((a) => [a.cost, a.ess]) });
      if (bad.length) issues.push(`${x.name}: ${bad.slice(0, 3).join('; ')}`);
      for (const [k, l] of Object.entries(d.items)) for (const e of l) if (e.cost < 0) issues.push(`${x.name}: negative ${k} cost ${e.cost}`);
      // (Essence Antihole / Revitalization legitimately give Essence back)
      for (const a of d.augs) if ((a.ess < 0 && !/Antihole|Revit/.test(a.def.name)) || a.cost < 0) issues.push(`${x.name}: negative aug ${a.ess}/${a.cost}`);
      if (kind === 'weapons' || kind === 'accessories') {
        for (const e of d.items.weapons) {
          const st = weaponStats(e.def, d, e.it);
          if (/NaN|undefined/.test(`${st.dmg} ${st.ap} ${st.accuracy} ${st.rc}`)) issues.push(`${x.name}: weaponStats ${st.dmg} ${st.ap} ${st.accuracy} ${st.rc}`);
        }
      }
      // the Inspector: describe the catalogue entry and (where it exists) the owned item
      const insKind = { vehiclemods: null, accessories: null, armormods: null, metamagics: null, martialArts: null }[kind] === null ? null : kind;
      if (insKind) {
        const owned = (ch[insKind] || [])[0];
        const info = describeItem(insKind, x, owned && owned.uid === 'x' ? owned : null, d);
        if (!info || typeof info !== 'object') issues.push(`${x.name}: describeItem returned ${info}`);
        else if (/NaN|undefined|\[object Object\]/.test(JSON.stringify(info))) issues.push(`${x.name}: Inspector text has ${(JSON.stringify(info).match(/NaN|undefined|\[object Object\]/) || [])[0]}`);
      }
    } catch (err) {
      issues.push(`${x.name}: THROWS ${err.message.split('\n')[0]}`);
    }
  }
  report[kind] = { n, issues };
  console.log(`${kind.padEnd(14)} ${String(n).padStart(5)} items  ${issues.length} issue${issues.length === 1 ? '' : 's'}`);
  for (const i of issues.slice(0, 12)) console.log('    ', i);
  if (issues.length > 12) console.log(`     ... ${issues.length - 12} more`);
}
