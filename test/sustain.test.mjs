import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter } = engine;
const { addSustained, removeSustained, sustainPenalty, SUSTAIN_PENALTY, SUSTAIN_PAGE } = await import('../src/engine/sustain.js');
const { playState } = await import('../src/engine/edge.js');

test('playState defaults sustained to []', () => {
  assert.deepEqual(playState(newCharacter()).sustained, []);
});

test('addSustained adds a named entry', () => {
  const ch = newCharacter();
  addSustained(ch, 'Armor');
  assert.equal(playState(ch).sustained.length, 1);
  assert.equal(playState(ch).sustained[0].name, 'Armor');
});

test('addSustained ignores a blank name', () => {
  const ch = newCharacter();
  addSustained(ch, '   ');
  assert.equal(playState(ch).sustained.length, 0);
});

test('removeSustained removes only the matching entry', () => {
  const ch = newCharacter();
  addSustained(ch, 'Armor');
  addSustained(ch, 'Levitate');
  const uid = playState(ch).sustained[0].uid;
  removeSustained(ch, uid);
  assert.equal(playState(ch).sustained.length, 1);
  assert.equal(playState(ch).sustained[0].name, 'Levitate');
});

test('sustainPenalty is SUSTAIN_PENALTY per sustained spell', () => {
  const ch = newCharacter();
  assert.equal(sustainPenalty(ch), 0);
  addSustained(ch, 'Armor');
  addSustained(ch, 'Levitate');
  assert.equal(sustainPenalty(ch), 2 * SUSTAIN_PENALTY);
});

test('constants match SR5 core', () => {
  assert.equal(SUSTAIN_PENALTY, 2);
  assert.equal(SUSTAIN_PAGE, 166);
});
