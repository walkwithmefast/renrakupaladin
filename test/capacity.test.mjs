// Cyberware capacity (engine/augCapacity.js): enhancements in cybereyes / cyberlimbs use capacity, not Essence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const cap = await import('../src/engine/augCapacity.js');
const cw = (n) => idx('cyberware', 'cyberwares').list.find((c) => c.name === n);

test('parents provide capacity; enhancements cost it; what fits where', () => {
  const eyes = cw('Cybereyes Basic System');
  const llv = cw('Low-Light Vision');
  assert.equal(cap.capacityProvided(eyes, 3), 12, 'Rating x 4');
  assert.equal(cap.capacityCost(llv, 1), 2);
  assert.ok(cap.isEnhancement(llv) && !cap.isEnhancement(eyes));
  assert.ok(cap.fitsIn(llv, eyes), 'eyeware goes in cybereyes');
  const gyro = cw('Cyberarm Gyromount');
  const fullArm = idx('cyberware', 'cyberwares').list.find((c) => /Full Arm/.test(c.name) && c.allowsubsystems);
  const leg = idx('cyberware', 'cyberwares').list.find((c) => /Full Leg/.test(c.name) && c.allowsubsystems);
  assert.ok(fullArm && leg, 'found a full arm and a full leg');
  assert.ok(cap.fitsIn(gyro, fullArm));
  assert.ok(!cap.fitsIn(gyro, leg), 'a Gyromount needs a full or lower arm');
  assert.ok(!cap.fitsIn(llv, fullArm), 'eyeware does not go in an arm');
});

test('installed enhancements use capacity instead of Essence; over capacity warns', () => {
  const ch = newCharacter();
  const eyes = cw('Cybereyes Basic System');
  const llv = cw('Low-Light Vision');
  ch.cyberware.push({ uid: 'e', id: eyes.id, name: eyes.name, rating: 1 }, { uid: 'l', id: llv.id, name: llv.name });
  const loose = derive(ch);
  ch.cyberware[1] = { ...ch.cyberware[1], parent: 'e', child: true };
  const d = derive(ch);
  assert.equal(Math.round((d.essence - loose.essence) * 100) / 100, 0.1, 'installed, Low-Light Vision stops costing its 0.1 Essence');
  const e = d.augs.find((a) => a.it.uid === 'e');
  assert.deepEqual([e.cap.total, e.cap.used], [4, 2]);
  const flare = cw('Flare Compensation');
  const thermo = cw('Thermographic Vision');
  ch.cyberware.push({ uid: 'f', id: flare.id, name: flare.name, parent: 'e', child: true }, { uid: 't', id: thermo.id, name: thermo.name, parent: 'e', child: true });
  assert.ok(derive(ch).warnings.some((w) => /Cybereyes Basic System holds more than its capacity/.test(w.msg)));
});
