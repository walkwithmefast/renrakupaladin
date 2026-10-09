// Vehicle modification slots / drone Mod Points (Rigger 5.0 p.122-123, p.151) and elemental armor from worn armor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { modSlots, applyVehicleMods, armorProtection } = await import('../src/engine/mods.js');

const veh = (name) => idx('vehicles', 'vehicles').list.find((v) => v.name === name);
const mod = (name) => idx('vehicles', 'mods').list.find((m) => m.name === name);
const fit = (def, list) => { const fitted = list.map(([n, r]) => ({ md: mod(n), rating: r })); return modSlots(def, fitted, applyVehicleMods(def, fitted)); };

test('drones: Mod Points = Body, or the data\'s Body X(Y) when a model has less free', () => {
  const lynx = veh('Steel Lynx Combat Drone (Large)'); // Body 6, Armor 12, no modslots
  assert.deepEqual(fit(lynx, []), { drone: true, total: 6, used: 0, left: 6 });
  // Armor 12 -> 16: the first +3 is free, so 1 point (p.122)
  assert.equal(fit(lynx, [['Armor (Drone)', 16]]).used, 1);
  const sentry = veh('Ares Arms Sentry V (Small)'); // Body 2 but modslots 0: no room at all
  assert.equal(fit(sentry, []).total, 0);
});

test('downgrades give at most one Mod Point in total; Fragile nets 1 per Body lost', () => {
  const lynx = veh('Steel Lynx Combat Drone (Large)');
  assert.equal(fit(lynx, [['Handling Downgrade (Drone)', 1], ['Speed Downgrade (Drone)', 1]]).left, 7, 'two downgrades still +1 only (p.123)');
  const fragile = fit(lynx, [['Fragile (Drone)', 2]]); // Body 6 -> 4: pool 6 - 2 = 4, Fragile gives back 4
  assert.equal(fragile.total, 4);
  assert.equal(fragile.left, 6 + 2, 'net +1 per Body point lost: 6 free before, 8 after');
});

test('other vehicles: Body slots per category, plus the data\'s per-category adjustments (p.151)', () => {
  const bulldog = veh('GMC Bulldog Step-Van (Van)'); // Body 16, bodymodslots +4
  const s = fit(bulldog, []);
  assert.equal(s.drone, false);
  assert.deepEqual(Object.fromEntries(s.cats.map((c) => [c.cat, c.total])), { Powertrain: 16, Protection: 16, Weapons: 16, Body: 20, Electromagnetic: 16, Cosmetic: 16 });
  const prowler = veh('Krime Prowler'); // powertrainmodslots -14 = none
  assert.equal(fit(prowler, []).cats.find((c) => c.cat === 'Powertrain').total, 0);
  const armored = fit(bulldog, [['Armor (Standard)', 4]]);
  assert.equal(armored.cats.find((c) => c.cat === 'Protection').used, 8, 'Rating x 2 slots');
});

test('over the budget shows up in the character warnings', () => {
  const ch = newCharacter();
  const sentry = veh('Ares Arms Sentry V (Small)');
  ch.vehicles.push({ uid: 'v1', id: sentry.id, name: sentry.name, mods: [{ id: mod('Gecko Grips (Drone)').id, rating: 1 }] });
  assert.ok(derive(ch).warnings.some((w) => /more modifications than it has room for \(1 Mod Point over\)/.test(w.msg)));
});

test('elemental armor and resistances from worn armor + mods; immunities', () => {
  const jacket = idx('armor', 'armors').list.find((a) => a.name === 'Armor Jacket');
  const am = (n) => idx('armor', 'mods').list.find((m) => m.name === n);
  const worn = [{ uid: 'a1', id: jacket.id, name: jacket.name, mods: [{ id: am('Fire Resistance').id, rating: 4 }, { id: am('Chemical Protection').id, rating: 3 }, { id: am('Chemical Seal').id, rating: 1 }] }];
  const p = armorProtection(worn, idx('armor', 'armors'), idx('armor', 'mods'));
  assert.equal(p.fire, 4);
  assert.equal(p.toxinContact, 3);
  assert.equal(p.pathogenContact, 3);
  assert.ok(p.immune.includes('contact toxins') && p.immune.includes('inhaled pathogens'));
  assert.deepEqual(p.sources.fire, ['Armor Jacket: Fire Resistance +4']);
  const ch = newCharacter();
  ch.armor.push({ ...worn[0], equipped: false });
  assert.equal(derive(ch).armor.protection.fire, undefined, 'only worn armor counts');
});
