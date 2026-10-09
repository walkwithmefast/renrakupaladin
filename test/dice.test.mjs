import test from 'node:test';
import assert from 'node:assert/strict';

const {
  summarize, rollPool, rollPushLimit, rerollSecondChance, calledShotPool, CALLED_SHOT_PENALTY, CALLED_SHOT_PAGE,
} = await import('../src/engine/dice.js');

// a deterministic "rng" that returns a fixed queue of [0,1) values, one per d6() call
const queue = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// convenience: face -> the [0,1) value that 1+floor(x*6) maps to that face
const face = (n) => (n - 1) / 6 + 0.001;

test('summarize: counts 5s and 6s as hits', () => {
  const r = summarize([1, 2, 3, 4, 5, 6]);
  assert.equal(r.hits, 2);
  assert.equal(r.ones, 1);
});

test('summarize: glitch when at least half the dice show 1, critical glitch needs zero hits too', () => {
  assert.equal(summarize([1, 1, 2, 3]).glitch, true); // 2 of 4 ones = half
  assert.equal(summarize([1, 1, 2, 3]).critical, true); // ...and no hits
  assert.equal(summarize([1, 1, 6, 3]).glitch, true);
  assert.equal(summarize([1, 1, 6, 3]).critical, false); // has a hit, so not critical
  assert.equal(summarize([1, 2, 3, 4]).glitch, false); // only 1 of 4 ones
});

test('summarize: an empty pool (0 dice) is never a glitch', () => {
  const r = summarize([]);
  assert.equal(r.hits, 0);
  assert.equal(r.glitch, false);
  assert.equal(r.critical, false);
});

test('rollPool: rolls exactly `pool` dice and clamps negative pools to 0', () => {
  assert.equal(rollPool(5, queue([face(6), face(6), face(6), face(6), face(6)])).dice.length, 5);
  assert.equal(rollPool(-3).dice.length, 0);
  assert.equal(rollPool(0).dice.length, 0);
});

test('rollPushLimit: adds Edge to the pool before rolling', () => {
  const rng = queue([face(1), face(1), face(1), face(1), face(1)]); // no 6s: nothing explodes
  const r = rollPushLimit(3, 2, rng);
  assert.equal(r.dice.length, 5); // 3 pool + 2 edge, no explosions
});

test('rollPushLimit: a 6 explodes into one extra die, which can explode again', () => {
  // pool 1: first die is a 6 (explodes), second die is a 6 too (explodes again), third die is a 3 (stops)
  const rng = queue([face(6), face(6), face(3)]);
  const r = rollPushLimit(1, 0, rng);
  assert.deepEqual(r.dice, [6, 6, 3]);
  assert.equal(r.hits, 2); // both 6s count as hits, the 3 does not
});

test('rerollSecondChance: rerolls only the dice that did not hit, keeps the hits', () => {
  const prevDice = [6, 5, 1, 2, 3]; // 2 hits, 3 non-hits to reroll
  const rng = queue([face(6), face(6), face(6)]); // all three rerolls come up 6
  const r = rerollSecondChance(prevDice, rng);
  assert.equal(r.dice.length, 5);
  assert.equal(r.hits, 5); // the 2 original hits + 3 new 6s
});

test('rerollSecondChance: cannot fix a glitch - the verdict stays whatever the original roll was', () => {
  const prevDice = [1, 1, 1, 2]; // critical glitch: 3 of 4 ones, 0 hits
  const rng = queue([face(6), face(6), face(6)]); // reroll turns every non-hit into a hit...
  const r = rerollSecondChance(prevDice, rng);
  assert.equal(r.hits, 4); // ...but the glitch verdict is locked to the original roll
  assert.equal(r.glitch, true);
  assert.equal(r.critical, true);
});

test('calledShotPool: flat -4, clamped at 0, matching SR5 core p.195', () => {
  assert.equal(CALLED_SHOT_PENALTY, 4);
  assert.equal(CALLED_SHOT_PAGE, 195);
  assert.equal(calledShotPool(10), 6);
  assert.equal(calledShotPool(3), 0);
  assert.equal(calledShotPool(0), 0);
});

test('rerollSecondChance: does not reroll dice that already hit', () => {
  const prevDice = [6, 6, 6];
  const rng = queue([face(1)]); // if this were consulted, we'd see a 1 appear - it should never be called
  const r = rerollSecondChance(prevDice, rng);
  assert.deepEqual(r.dice, [6, 6, 6]);
});
