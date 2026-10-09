// Drones in play (src/engine/drones.js): condition monitors, dice pools, control modes, tracked state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const dr = await import('../src/engine/drones.js');
const { playState } = await import('../src/engine/edge.js');

const gear = (name) => idx('gear', 'gears').list.find((g) => g.name === name);
const drone = idx('vehicles', 'vehicles').list.find((v) => /Drone/.test(v.category) && v.body === '2' && v.pilot === '3' && !/\//.test(String(v.handling)));
const car = idx('vehicles', 'vehicles').list.find((v) => v.category === 'Cars' && Number(v.body) >= 10);

function rigger({ rig = 0, autosofts = {} } = {}) {
  const ch = newCharacter();
  ch.vehicles.push({ uid: 'v1', id: drone.id, name: drone.name });
  for (const [name, rating] of Object.entries(autosofts)) {
    const g = gear(name);
    ch.gear.push({ uid: `a-${name}`, id: g.id, name: g.name, rating });
  }
  if (rig) {
    const cr = idx('cyberware', 'cyberwares').list.find((c) => c.name === 'Control Rig');
    ch.cyberware.push({ uid: 'cr', id: cr.id, name: cr.name, rating: rig });
  }
  const d = derive(ch);
  return { ch, d, e: d.items.vehicles[0] };
}

test('condition monitors: drones 6 + Body/2, other vehicles 12 + Body/2 (p.199); Matrix 8 + Pilot/2 (p.228, p.269)', () => {
  assert.ok(drone && car, 'found a Body 2 / Pilot 3 drone and a car');
  assert.equal(dr.physicalBoxes(drone, 2), 7);
  assert.equal(dr.physicalBoxes(drone, 3), 8, 'half rounded up');
  assert.equal(dr.physicalBoxes(car, Number(car.body)), 12 + Math.ceil(Number(car.body) / 2));
  assert.equal(dr.matrixBoxes(3), 10);
});

test('autonomous: Pilot + autosoft [limit], Initiative Pilot x 2 + 4D6 (p.270, p.205)', () => {
  const { d, e } = rigger({ autosofts: { '[Model] Evasion Autosoft': 4 } });
  const { init, tests } = dr.droneTests(e.stats, d);
  const t = Object.fromEntries(tests.map((x) => [x.id, x]));
  assert.deepEqual(init, { base: 6, dice: 4, text: 'Pilot × 2 + 4D6' });
  assert.equal(t.defense.pool, 3 + 4);
  assert.equal(t.defense.limit, e.stats.stats.handling.on);
  assert.equal(t.perception.pool, 3, 'no Clearsight: Pilot alone');
  assert.match(t.perception.note, /no Clearsight autosoft/);
  assert.equal(t.perception.limit, e.stats.stats.sensor);
  assert.equal(t.soak.pool, e.stats.stats.body + e.stats.stats.armor);
  assert.equal(t.matrix.pool, 6, 'Device Rating + Firewall, both = Pilot');
});

test('jumped in: rigger skills, VR Initiative, control rig dice + limits, hot-sim +1 (p.270, p.452, p.266)', () => {
  const { d, e } = rigger({ rig: 2 });
  const hot = dr.droneTests(e.stats, d, { mode: 'jumped', sim: 'hot' });
  const cold = dr.droneTests(e.stats, d, { mode: 'jumped', sim: 'cold' });
  const t = Object.fromEntries(hot.tests.map((x) => [x.id, x]));
  const c = Object.fromEntries(cold.tests.map((x) => [x.id, x]));
  assert.equal(hot.rig, 2);
  assert.deepEqual([hot.init.base, hot.init.dice], [d.init.matrixHot.base, d.init.matrixHot.dice]);
  assert.deepEqual([cold.init.base, cold.init.dice], [d.init.matrixCold.base, d.init.matrixCold.dice]);
  assert.equal(t.vehicle.pool - c.vehicle.pool, 1, 'hot-sim +1 on vehicle actions');
  assert.equal(t.vehicle.limit, e.stats.stats.handling.on + 2, 'control rig raises Handling');
  assert.equal(t.perception.limit, e.stats.stats.sensor + 2);
  assert.match(t.vehicle.formula, /defaulting −1/, 'no Pilot skill ranks -> defaulting');
  assert.equal(t.defense.pool, d.attr.REA.total + d.attr.INT.total);
  assert.match(t.vehicle.note, /thresholds −2/);
});

test('drone state: one jumped-in drone at a time, and it survives other play-state changes', () => {
  const ch = newCharacter();
  dr.setDroneState(ch, 'v1', { phys: 3, mode: 'jumped' });
  dr.setDroneState(ch, 'v2', { mode: 'jumped' });
  assert.equal(dr.droneState(ch, 'v1').mode, 'auto', 'jumping into v2 drops you out of v1');
  assert.equal(dr.droneState(ch, 'v2').mode, 'jumped');
  // the sheet's damage tracker rewrites ch.play from playState(): drone damage must come along
  ch.play = { ...playState(ch), phys: 2 };
  assert.equal(dr.droneState(ch, 'v1').phys, 3);
});

test('how a drone moves decides the Pilot skill; guessed from the data, overridable', () => {
  const v = (n) => idx('vehicles', 'vehicles').list.find((x) => x.name === n);
  assert.equal(dr.guessMoves(v('Horizon Flying Eye (Minidrone)')), 'Aircraft');
  assert.equal(dr.guessMoves(v('Sony Goldfish (Microdrone)')), 'Watercraft');
  assert.equal(dr.guessMoves(v('Steel Lynx Combat Drone (Large)')), 'Ground');
  const boat = idx('vehicles', 'vehicles').list.find((x) => x.category === 'Boats');
  assert.equal(dr.guessMoves(boat), 'Watercraft', 'ordinary vehicles go by category');
  assert.equal(dr.movesOf(v('Steel Lynx Combat Drone (Large)'), { moves: 'Walker' }), 'Walker');
  assert.equal(dr.pilotSkillFor('Aircraft'), 'Pilot Aircraft');
});

test('remote control (Control Device, p.238): your skill + usual attribute, limits capped by Data Processing', () => {
  const { ch, e } = rigger();
  const link = idx('gear', 'gears').list.find((g) => g.category === 'Commlinks' && g.name === 'Meta Link');
  ch.gear.push({ uid: 'cl', id: link.id, name: link.name });
  const d = derive(ch);
  const dp = d.matrix.persona && d.matrix.persona.dp;
  assert.ok(dp > 0, 'a commlink gives a persona with Data Processing');
  const { tests, init } = dr.droneTests(e.stats, d, { mode: 'remote', moves: 'Aircraft' });
  const t = Object.fromEntries(tests.map((x) => [x.id, x]));
  assert.match(t.gunnery.formula, /^Gunnery \(defaulting −1\) \+ Agility/, 'the book\'s example: Gunnery + Agility');
  assert.equal(t.gunnery.pool, -1 + d.attr.AGI.total < 0 ? 0 : -1 + d.attr.AGI.total);
  assert.match(t.vehicle.formula, /^Pilot Aircraft/);
  assert.equal(t.perception.limit, Math.min(e.stats.stats.sensor, dp));
  assert.deepEqual([init.base, init.dice], [d.init.base, d.init.dice]);
});
