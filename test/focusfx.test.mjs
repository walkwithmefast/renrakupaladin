// v24: bonded foci apply their bonuses (SR5 core p.318-320) and weapon attack pools use the skill's full pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { weaponStats } = await import('../src/engine/weapons.js');

const gear = (n) => idx('gear', 'gears').list.find((g) => g.name === n && !g.hide);
const power = (n) => idx('powers', 'powers').list.find((p) => p.name === n);
const skill = (d, n) => d.skills.find((s) => s.name === n);

function mage() {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
  ch.talent = 'Magician'; // Magic 6
  const id = (n) => idx('skills', 'skills').list.find((s) => s.name === n).id;
  ch.skills[id('Spellcasting')] = { p: 4, k: 0, a: 0, spec: '' };
  ch.skills[id('Summoning')] = { p: 3, k: 0, a: 0, spec: '' };
  return ch;
}
const give = (ch, name, rating, extra = {}) => { const g = gear(name); const it = { uid: `f${ch.gear.length}`, id: g.id, name, rating, bonded: true, ...extra }; ch.gear.push(it); return it; };

test('Power Focus adds its Force to Magic-linked skills, only while bonded', () => {
  const ch = mage();
  const base = derive(ch);
  const pf = give(ch, 'Power Focus', 3, { bonded: false });
  assert.equal(skill(derive(ch), 'Spellcasting').pool, skill(base, 'Spellcasting').pool, 'unbonded: nothing');
  pf.bonded = true;
  const d = derive(ch);
  assert.equal(skill(d, 'Spellcasting').pool, skill(base, 'Spellcasting').pool + 3);
  assert.equal(skill(d, 'Summoning').pool, skill(base, 'Summoning').pool + 3);
  assert.equal(skill(d, 'Spellcasting').focusSrc, 'Power Focus 3');
  assert.equal(d.attr.MAG.total, base.attr.MAG.total, 'Magic itself (limits, drain, PP) is unchanged');
});

test('Spellcasting Focus: +Force to its category only; only the biggest focus counts per test', () => {
  const ch = mage();
  const base = skill(derive(ch), 'Spellcasting').pool;
  give(ch, 'Spellcasting Focus, Combat', 4);
  let d = derive(ch);
  assert.equal(d.magic.spellPool('Combat').pool, base + 4);
  assert.equal(d.magic.spellPool('Health').pool, base);
  assert.equal(skill(d, 'Spellcasting').pool, base, 'the generic skill pool has no category');
  give(ch, 'Power Focus', 2);
  d = derive(ch);
  assert.equal(d.magic.spellPool('Combat').pool, base + 4, 'Combat: the Force 4 spellcasting focus, not 4 + 2');
  assert.equal(d.magic.spellPool('Combat').focusSrc, 'Spellcasting Focus, Combat 4');
  assert.equal(d.magic.spellPool('Health').pool, base + 2, 'Health: the power focus');
});

test('bonding limits: count <= Magic, total Force <= Magic x 5 (Force above Magic alone is fine)', () => {
  const ch = mage();
  give(ch, 'Power Focus', 4);
  give(ch, 'Spellcasting Focus, Combat', 3); // total 7 > Magic 6, but well under 30
  let d = derive(ch);
  assert.ok(!d.warnings.some((w) => /Bonded foci|bonded foci/.test(w.msg)), JSON.stringify(d.warnings.map((w) => w.msg)));
  assert.equal(d.magic.fociLimits.addictionRisk, true);
  for (let i = 0; i < 5; i++) give(ch, 'Sustaining Focus, Combat', 1); // 7 foci > Magic 6
  d = derive(ch);
  assert.ok(d.warnings.some((w) => /7 bonded foci/.test(w.msg)));
});

test('weapon attack pool = the skill pool (Improved Ability counts); a Weapon Focus adds to its weapon', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' };
  ch.talent = 'Adept';
  const id = (n) => idx('skills', 'skills').list.find((s) => s.name === n).id;
  ch.skills[id('Pistols')] = { p: 3, k: 0, a: 0, spec: '' };
  ch.skills[id('Blades')] = { p: 2, k: 0, a: 0, spec: '' };
  const pistol = idx('weapons', 'weapons').list.find((w) => w.name === 'Ares Predator V');
  const sword = idx('weapons', 'weapons').list.find((w) => w.name === 'Katana');
  ch.weapons.push({ uid: 'w1', id: pistol.id, name: pistol.name }, { uid: 'w2', id: sword.id, name: sword.name });
  let d = derive(ch);
  const before = weaponStats(pistol, d, ch.weapons[0]).pool;
  ch.powers.push({ uid: 'ia', id: power('Improved Ability (skill)').id, name: 'Improved Ability (skill)', level: 2, choice: { skill: 'Pistols' } });
  d = derive(ch);
  assert.equal(weaponStats(pistol, d, ch.weapons[0]).pool, before + 2);
  assert.equal(weaponStats(pistol, d, ch.weapons[0]).pool, skill(d, 'Pistols').pool);
  const swordBefore = weaponStats(sword, d, ch.weapons[1]).pool;
  give(ch, 'Weapon Focus', 3, { choice: { weapon: 'w2' } });
  d = derive(ch);
  assert.equal(weaponStats(sword, d, ch.weapons[1]).pool, swordBefore + 3);
  assert.equal(weaponStats(pistol, d, ch.weapons[0]).pool, before + 2, 'other weapons unaffected');
});
