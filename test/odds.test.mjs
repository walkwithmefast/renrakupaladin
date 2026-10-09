import test from 'node:test';
import assert from 'node:assert/strict';
import { chanceAtLeast, oddsFor, KNOWLEDGE_TIERS, LANGUAGE_TIERS } from '../src/engine/odds.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('single die: hits on 5-6, so 1/3', () => {
  close(chanceAtLeast(1, 1), 1 / 3);
  close(chanceAtLeast(1, 2), 0);
});

test('at least one hit = 1 - (2/3)^n', () => {
  for (const n of [1, 2, 3, 6, 10]) close(chanceAtLeast(n, 1), 1 - (2 / 3) ** n);
});

test('all dice must hit: (1/3)^n', () => {
  close(chanceAtLeast(3, 3), (1 / 3) ** 3);
  close(chanceAtLeast(6, 6), (1 / 3) ** 6);
});

test('edge cases: empty pool, zero threshold, more hits than dice', () => {
  assert.equal(chanceAtLeast(0, 1), 0);
  assert.equal(chanceAtLeast(5, 0), 1);
  assert.equal(chanceAtLeast(3, 4), 0);
});

test('known value: 6 dice, at least 2 hits = 1 - (2/3)^6 - 6*(1/3)*(2/3)^5', () => {
  close(chanceAtLeast(6, 2), 1 - (2 / 3) ** 6 - 6 * (1 / 3) * (2 / 3) ** 5);
});

test('odds only fall as the threshold rises, and the tiers match the core book tables', () => {
  assert.deepEqual(KNOWLEDGE_TIERS.map((t) => t.hits), [1, 2, 4, 6]);   // p.149
  assert.deepEqual(LANGUAGE_TIERS.map((t) => t.hits), [1, 2, 3, 4]);    // p.151
  for (const pool of [3, 7, 12]) {
    const rows = oddsFor(pool, KNOWLEDGE_TIERS);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i].chance <= rows[i - 1].chance);
  }
});
