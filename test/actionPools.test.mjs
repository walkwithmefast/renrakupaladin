import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { skillWith, magicActionPools, matrixActionPools } = await import('../src/engine/actionPools.js');

function withSkill(ch, name, p) {
  const d0 = derive(ch);
  const def = d0.skills.find((s) => s.name === name);
  ch.skills = { ...(ch.skills || {}), [def.id]: { p, k: 0, a: 0 } };
  return derive(ch);
}

test('skillWith swaps in the attribute the action names', () => {
  const ch = newCharacter();
  const d = withSkill(ch, 'Computer', 4);
  const sk = d.skills.find((s) => s.name === 'Computer');
  const w = skillWith(d, 'Computer', 'INT');
  assert.equal(w.pool, 4 + d.attr.INT.pool + (sk.pool - sk.rating - d.attr[sk.attr].pool));
  assert.equal(w.defaulting, false);
});

test('an unranked defaultable skill defaults to attribute - 1; a non-defaultable one is null', () => {
  const d = derive(newCharacter());
  const per = skillWith(d, 'Perception', 'INT');
  assert.equal(per.defaulting, true);
  assert.equal(per.pool, Math.max(0, d.attr.INT.pool - 1));
  assert.equal(skillWith(d, 'Electronic Warfare', 'LOG'), null);
});

test('no persona -> no Matrix action rows; magic pools empty for a mundane', () => {
  const d = derive(newCharacter());
  assert.deepEqual(matrixActionPools(d), []);
  assert.deepEqual(magicActionPools(d), []);
});
