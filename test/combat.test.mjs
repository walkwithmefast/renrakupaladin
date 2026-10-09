// Typed ammunition in weapon stats (engine/weapons.js) and situational combat modifiers (engine/combatMods.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { weaponStats } = await import('../src/engine/weapons.js');
const cm = await import('../src/engine/combatMods.js');

const pistol = idx('weapons', 'weapons').list.find((w) => w.name === 'Ares Predator V'); // 8P, AP -1, SA
const ammo = (n) => idx('gear', 'gears').list.find((g) => g.name === `Ammo: ${n}`);
const stats = (ammoName) => weaponStats(pistol, derive(newCharacter()), { uid: 'w', id: pistol.id, ammo: ammoName ? ammo(ammoName).id : undefined });

test('loaded ammo changes damage / AP / type (SR5 p.434)', () => {
  assert.deepEqual([stats().dmg, stats().ap], ['8P', '-1'], 'regular rounds');
  const apds = stats('APDS');
  assert.deepEqual([apds.dmg, apds.ap], ['8P', '-5']);
  assert.match(apds.apTip, /-4 APDS/);
  const flech = stats('Flechette Rounds');
  assert.deepEqual([flech.dmg, flech.ap], ['10P(f)', '4']);
  const sns = stats('Stick-n-Shock');
  assert.deepEqual([sns.dmg, sns.ap], ['6S(e)', '-5'], 'damage -2, type S(e), AP replaced with -5');
  assert.equal(stats('Gel Rounds').dmg, '8S');
  assert.equal(sns.ammoName, 'Stick-n-Shock');
});

test('environment: the worst condition counts; two at the same level move a row (p.175-176)', () => {
  assert.equal(cm.environmentModifier({ visibility: 'Clear' }).mod, 0);
  assert.equal(cm.environmentModifier({ range: 'Long' }).mod, -3);
  assert.equal(cm.environmentModifier({ visibility: 'Light rain / fog / smoke', wind: 'Light winds' }).mod, -3, "the book's example: two -1s make -3");
  assert.equal(cm.environmentModifier({ visibility: 'Heavy rain / fog / smoke', light: 'Total darkness' }).mod, -10);
  // compensation
  assert.equal(cm.environmentModifier({ wind: 'Moderate winds' }, new Set(['smartlink'])).mod, -1, 'smartlink moves wind a row up');
  assert.equal(cm.environmentModifier({ light: 'Dim light' }, new Set(['lowlight'])).mod, 0, 'low-light treats dim light as full');
  assert.equal(cm.environmentModifier({ light: 'Moderate glare' }, new Set(['flare'])).mod, 0, 'flare compensation: glare two rows up');
  assert.equal(cm.environmentModifier({ light: 'Total darkness' }, new Set(['ultrasound'])).mod, 0);
});

test('recoil: 1 + STR/3 (up) + weapon RC, minus bullets fired (p.175)', () => {
  assert.deepEqual(cm.recoilPenalty(4, 2, 3), { rc: 5, penalty: 0 });
  assert.deepEqual(cm.recoilPenalty(4, 2, 9), { rc: 5, penalty: -4 });
});

test('combining ranged / melee / defense modifiers', () => {
  const r = cm.combatModifier('ranged', new Set(['running', 'called', 'smartgun']), { wound: 2, env: { range: 'Medium' }, str: 3, rc: 0, bullets: 3 });
  // running -2, called -4, smartgun +1, wound -2, range -1, recoil (1+1+0 - 3 = -1)
  assert.equal(r.total, -2 - 4 + 1 - 2 - 1 - 1);
  const m = cm.combatModifier('melee', new Set(['charge', 'friends']), { env: { light: 'Dim light', range: 'Extreme' } });
  assert.equal(m.total, 2 + 1 - 3, 'melee uses light/visibility only (p.187), not range');
  const d = cm.combatModifier('defense', new Set(['partCover', 'burst']), { previousDefenses: 2, reach: 1 });
  assert.equal(d.total, 2 - 2 - 2 - 1);
  assert.deepEqual(cm.exclusiveWith('goodCover'), ['partCover']);
});
