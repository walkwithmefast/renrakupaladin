import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter } = engine;
const {
  MARK_MAX, OS_CONVERGENCE, addMarkTarget, setMarks, removeMarkTarget, setOverwatch, addOverwatch, resetOverwatch,
} = await import('../src/engine/overwatch.js');
const { playState } = await import('../src/engine/edge.js');

test('playState defaults marks to [] and overwatch to 0 on a fresh character', () => {
  const ch = newCharacter();
  const p = playState(ch);
  assert.deepEqual(p.marks, []);
  assert.equal(p.overwatch, 0);
});

test('addMarkTarget adds a new target at 1 mark', () => {
  const ch = newCharacter();
  addMarkTarget(ch, 'Renraku host');
  assert.equal(playState(ch).marks.length, 1);
  assert.equal(playState(ch).marks[0].target, 'Renraku host');
  assert.equal(playState(ch).marks[0].marks, 1);
});

test('addMarkTarget ignores an empty/blank name', () => {
  const ch = newCharacter();
  addMarkTarget(ch, '   ');
  addMarkTarget(ch, '');
  assert.equal(playState(ch).marks.length, 0);
});

test('setMarks clamps to [0, MARK_MAX]', () => {
  const ch = newCharacter();
  addMarkTarget(ch, 'Target A');
  const uid = playState(ch).marks[0].uid;
  setMarks(ch, uid, 99);
  assert.equal(playState(ch).marks[0].marks, MARK_MAX);
  setMarks(ch, uid, -5);
  assert.equal(playState(ch).marks[0].marks, 0);
  setMarks(ch, uid, 2);
  assert.equal(playState(ch).marks[0].marks, 2);
});

test('removeMarkTarget removes only the matching entry', () => {
  const ch = newCharacter();
  addMarkTarget(ch, 'A');
  addMarkTarget(ch, 'B');
  const uidA = playState(ch).marks[0].uid;
  removeMarkTarget(ch, uidA);
  assert.equal(playState(ch).marks.length, 1);
  assert.equal(playState(ch).marks[0].target, 'B');
});

test('addOverwatch accumulates and never goes below 0', () => {
  const ch = newCharacter();
  addOverwatch(ch, 5);
  addOverwatch(ch, 3);
  assert.equal(playState(ch).overwatch, 8);
  addOverwatch(ch, -100);
  assert.equal(playState(ch).overwatch, 0);
});

test('setOverwatch sets an exact value, clamped at 0', () => {
  const ch = newCharacter();
  setOverwatch(ch, 25);
  assert.equal(playState(ch).overwatch, 25);
  setOverwatch(ch, -10);
  assert.equal(playState(ch).overwatch, 0);
});

test('resetOverwatch zeroes it', () => {
  const ch = newCharacter();
  addOverwatch(ch, 40);
  resetOverwatch(ch);
  assert.equal(playState(ch).overwatch, 0);
});

test('OS_CONVERGENCE is the SR5 core p.232 threshold', () => {
  assert.equal(OS_CONVERGENCE, 40);
});
