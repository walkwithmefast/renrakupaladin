// Mods that change what they're fitted to (src/engine/mods.js) + their cost with the parent's stats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive, priceItem } = engine;
const { idx } = dataMod;
const { modRatingRange, applyVehicleMods, vehicleBase, vehicleVars, armorWithMods } = await import('../src/engine/mods.js');

const vmod = (name) => idx('vehicles', 'mods').list.find((m) => m.name === name);
const vehicle = (pred) => idx('vehicles', 'vehicles').list.find(pred);
const drone = vehicle((v) => /Drone/.test(v.category) && v.body === '2' && String(v.armor) === '2' && !/\//.test(String(v.handling)));

test('Armor (Drone): rating = the new Armor, from Armor + 1 up to twice the starting value (Rigger 5.0 p.123)', () => {
  assert.ok(drone, 'found a Body 2 / Armor 2 drone');
  const r = modRatingRange('vehicles', vmod('Armor (Drone)'), drone);
  assert.deepEqual(r, { min: 3, max: 4, upgraded: 'armor' });
  const out = applyVehicleMods(drone, [{ md: vmod('Armor (Drone)'), rating: 4 }]);
  assert.equal(out.stats.armor, 4, 'sets Armor to the rating, not +4');
  assert.deepEqual(out.changed.armor, ['Armor (Drone)']);
});

test("drone upgrade cost uses the drone's Body (the book's Speed 5 on Body 2 = 4,000 nuyen)", () => {
  const speed = vmod('Speed (Drone)');
  const p = priceItem('vehicles', speed, { rating: 5 }, { vars: vehicleVars(drone) });
  assert.equal(p.cost, 4000);
  const a = priceItem('vehicles', vmod('Armor (Drone)'), { rating: 4 }, { vars: vehicleVars(drone) });
  assert.equal(a.cost, 4 * 2 * 200);
});

test('flat mods add; downgrades stack on top of upgrades; on-road-only keys move both handling values', () => {
  const car = vehicle((v) => v.category === 'Cars' && /\//.test(String(v.handling)));
  const base = vehicleBase(car);
  const plus = applyVehicleMods(car, [{ md: vmod('Armor (Standard)'), rating: 2 }]);
  assert.equal(plus.stats.armor, base.armor + 2);
  const both = applyVehicleMods(drone, [{ md: vmod('Armor Downgrade (Drone)'), rating: 1 }, { md: vmod('Armor (Drone)'), rating: 4 }]);
  assert.equal(both.stats.armor, 1, 'upgrade to 4 applied first, then -3');
  const pod = idx('vehicles', 'mods').list.find((m) => /Horseman Cargo Pod/.test(m.name));
  const podded = applyVehicleMods(car, [{ md: pod, rating: 1 }]);
  assert.equal(podded.stats.handling.on, base.handling.on - 1);
  assert.equal(podded.stats.handling.off, base.handling.off - 1);
  const offroad = applyVehicleMods(car, [{ md: vmod('Off-Road Suspension'), rating: 1 }]);
  assert.equal(offroad.stats.handling.on, base.handling.on - 1);
  assert.equal(offroad.stats.handling.off, base.handling.off + 1);
  assert.equal(offroad.text.handling, `${base.handling.on - 1}/${base.handling.off + 1}`);
});

test('rating ranges for the other kinds', () => {
  assert.deepEqual(modRatingRange('vehicles', vmod('Armor (Standard)'), drone), { min: 1, max: 2 }, 'rating "body" = up to the Body');
  assert.equal(modRatingRange('vehicles', vmod('Off-Road Suspension'), drone), null, 'unrated');
  const fire = idx('armor', 'mods').list.find((m) => m.name === 'Fire Resistance');
  assert.deepEqual(modRatingRange('armor', fire), { min: 1, max: 6 });
  const bow = idx('weapons', 'accessories').list.find((m) => m.name === 'Collapsible Traditional Bow');
  assert.deepEqual(modRatingRange('weapons', bow), { min: 1, max: 10 });
});

test("armor mods add to the armor piece and to the character's total", () => {
  const jacket = idx('armor', 'armors').list.find((a) => a.name === 'Armor Jacket');
  const gel = idx('armor', 'mods').list.find((m) => m.name === 'Gel Packs');
  const it = { uid: 'a1', id: jacket.id, name: jacket.name, mods: [{ id: gel.id, rating: 1 }] };
  const aw = armorWithMods(jacket, it, idx('armor', 'mods'));
  assert.equal(aw.value, 12 + 2);
  assert.deepEqual(aw.fromMods, ['Gel Packs']);
  const ch = newCharacter();
  ch.armor.push(it);
  assert.equal(derive(ch).armor.total, 14);
});

test('owned vehicles carry their modified stats, and mod costs use the vehicle', () => {
  const ch = newCharacter();
  ch.vehicles.push({ uid: 'v1', id: drone.id, name: drone.name, mods: [{ id: vmod('Armor (Drone)').id, rating: 4 }] });
  const e = derive(ch).items.vehicles[0];
  assert.equal(e.stats.stats.armor, 4);
  assert.equal(e.cost, priceItem('vehicles', drone, {}).cost + 1600);
});

test('a Variable(min-max) mod without a picked price used to evaluate as min-max nuyen (a refund) - it must cost within its range', () => {
  const customized = vmod('Customized (Drone)'); // Variable(10-10000), Rigger 5.0 p.125
  const drone2 = vehicle((v) => /Drone/.test(v.category));
  const ch = newCharacter();
  ch.vehicles.push({ uid: 'v1', id: drone2.id, name: drone2.name, mods: [{ id: customized.id, rating: 1, variable: 250 }] });
  const e = derive(ch).items.vehicles[0];
  assert.equal(e.cost, priceItem('vehicles', drone2, {}).cost + 250, 'the picked price is charged, not min-max');
  // and without a variable picked at all, the character.js call site must fall back sanely rather than the raw formula
  const ch2 = newCharacter();
  ch2.vehicles.push({ uid: 'v2', id: drone2.id, name: drone2.name, mods: [{ id: customized.id, rating: 1 }] });
  const e2 = derive(ch2).items.vehicles[0];
  assert.ok(e2.cost >= priceItem('vehicles', drone2, {}).cost, 'never a net refund for owning a mod');
});

test('"Children Cost" (Distributed Deck, CA p.139: "Children Cost * 0.1") sums its owned bundled children, not 0', () => {
  const gearOf = (name) => idx('gear', 'gears').list.find((g) => g.name === name && !g.hide);
  const dd = gearOf('Distributed Deck');
  const syringe = gearOf('Throwing Syringe'); // 40¥, unrelated flat-cost item, just standing in as "a child"
  const shaft = gearOf('Seeker Shaft'); // 45¥
  const ch = newCharacter();
  ch.gear.push(
    { uid: 'dd', id: dd.id, name: dd.name },
    { uid: 'c1', id: syringe.id, name: syringe.name, parent: 'dd' },
    { uid: 'c2', id: shaft.id, name: shaft.name, parent: 'dd' },
  );
  const items = derive(ch).items.gear;
  const ddItem = items.find((e) => e.it.uid === 'dd');
  assert.equal(ddItem.cost, Math.round((40 + 45) * 0.1), 'not 0 - "Children Cost" is an unresolved formula var, not a catalogue field');
  // nested: a second Distributed Deck parented under the first is itself priced off ITS OWN children (a direct
  // child of a direct child) - proves the recursion resolves bottom-up, not just one level.
  const uranium = gearOf('Ammo: Depleted Uranium');
  const uraniumCost = priceItem('gear', uranium, { uid: 'c3' }).cost; // ammo is costfor-adjusted; don't hardcode it
  ch.gear.push(
    { uid: 'dd2', id: dd.id, name: dd.name, parent: 'dd' },
    { uid: 'c3', id: uranium.id, name: uranium.name, parent: 'dd2' },
  );
  const items2 = derive(ch).items.gear;
  const dd2Item = items2.find((e) => e.it.uid === 'dd2');
  assert.equal(dd2Item.cost, Math.round(uraniumCost * 0.1), "the inner deck's own Children Cost resolves too");
  const ddItem2 = items2.find((e) => e.it.uid === 'dd');
  assert.equal(ddItem2.cost, Math.round((40 + 45 + dd2Item.cost) * 0.1), "the outer deck counts the inner deck's resolved price, not 0");
});

test('armor capacity and weapon accessory mounts (v28)', async () => {
  const { armorCapacity, weaponMounts, armorModCapacity } = await import('../src/engine/mods.js');
  const { dataMod } = await import('./helpers.mjs');
  const I = dataMod.idx;
  const jacket = I('armor', 'armors').byName.get('armor jacket');
  const fire = I('armor', 'mods').list.find((m) => m.name === 'Fire Resistance');
  assert.equal(armorModCapacity(fire, 4), 4);
  assert.deepEqual(armorCapacity(jacket, { mods: [{ id: fire.id, rating: 6 }, { id: fire.id, rating: 6 }] }, I('armor', 'mods')), { total: 12, used: 12 });
  const pred = I('weapons', 'weapons').byName.get('ares predator v'); // Barrel, Top, Stock, Side
  const acc = I('weapons', 'accessories');
  const topOnly = acc.list.filter((a) => a.mount === 'Top');
  const r = weaponMounts(pred, { mods: [{ id: topOnly[0].id }, { id: topOnly[1].id }] }, acc);
  assert.equal(r.placed.length, 1);
  assert.equal(r.conflicts.length, 1, 'two top-only accessories: one has nowhere to go');
  const tu = acc.list.find((a) => a.mount === 'Top/Under');
  assert.equal(weaponMounts(pred, { mods: [{ id: tu.id }] }, acc).conflicts.length, 0, 'Top/Under fits the free Top');
});
