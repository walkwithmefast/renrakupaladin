// v28: weapons that come with a quality (Claws, Fangs...) or an implant (Hand Razors, cyber pistols...) - Chummer's
// `addweapon` - show up as weapons: free, always carried, attack pool from their skill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { weaponStats } = await import('../src/engine/weapons.js');

test('a quality weapon (Razor Claws) and an implant weapon (Hand Razors) are listed, free, with a pool', () => {
  const ch = newCharacter();
  const q = idx('qualities', 'qualities').list.find((x) => x.name === 'Razor Claws');
  ch.qualities.push({ uid: 'q1', id: q.id, name: q.name, choice: {} });
  const hr = idx('cyberware', 'cyberwares').list.find((c) => c.name === 'Hand Razors');
  ch.cyberware.push({ uid: 'c1', id: hr.id, name: hr.name, grade: 'Standard' });
  ch.skills[idx('skills', 'skills').list.find((s) => s.name === 'Unarmed Combat').id] = { p: 3, k: 0, a: 0, spec: '' };
  const d = derive(ch);
  const auto = d.items.weapons.filter((w) => w.it.auto);
  assert.deepEqual(auto.map((w) => [w.def.name, w.it.from, w.cost]).sort(), [['Hand Razors', 'Hand Razors', 0], ['Razor Claws', 'Razor Claws', 0]]);
  for (const w of auto) {
    const st = weaponStats(w.def, d, w.it);
    assert.ok(st.pool > 0 && /P|S/.test(st.dmg), `${w.def.name}: ${st.pool} ${st.dmg}`);
  }
  // removing the implant removes its weapon
  ch.cyberware = [];
  assert.equal(derive(ch).items.weapons.filter((w) => w.it.auto).length, 1);
});

test('armor encumbrance (SR5 p.169): accessories count up to STR; each 2 full points over = -1 AGI and REA', () => {
  const ch = newCharacter(); // STR 1
  const acc = idx('armor', 'armors').list.filter((a) => /^\+/.test(String(a.armor)));
  const helmet = acc.find((a) => a.name === 'Helmet') || acc[0];
  const shield = acc.find((a) => a.name === 'Ballistic Shield') || acc[1];
  const base = derive(ch);
  ch.armor.push({ uid: 'h', id: helmet.id, name: helmet.name, equipped: true }, { uid: 's', id: shield.id, name: shield.name, equipped: true });
  const d = derive(ch);
  const add = Number(String(helmet.armor).replace('+', '')) + Number(String(shield.armor).replace('+', ''));
  assert.equal(d.armor.total - base.armor.total, Math.min(add, 1));
  const pen = Math.max(0, Math.floor((add - 1) / 2));
  assert.equal(d.attr.AGI.total, Math.max(0, base.attr.AGI.total - pen));
  assert.equal(d.attr.REA.total, Math.max(0, base.attr.REA.total - pen));
  assert.ok(pen === 0 || d.warnings.some((w) => /Armor accessories/.test(w.msg)));
});
