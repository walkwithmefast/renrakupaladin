import test from 'node:test';
import assert from 'node:assert/strict';
import { expr } from './helpers.mjs';

const { evalExpr, evalAvail, variableRange } = expr;

test('plain numbers and arithmetic', () => {
  assert.equal(evalExpr('12'), 12);
  assert.equal(evalExpr('Rating * 100', { Rating: 3 }), 300);
  assert.equal(evalExpr('(Rating * 3) + 2', { Rating: 4 }), 14);
  assert.equal(evalExpr('{STR} + 2', { STR: 5 }), 7);
  assert.equal(evalExpr('(Rating*Rating)*10', { Rating: 3 }), 90);
});

test('FixedValues picks by rating', () => {
  assert.equal(evalExpr('FixedValues(100,200,300)', { Rating: 2 }), 200);
  assert.equal(evalExpr('FixedValues(100,200,300)', { Rating: 9 }), 300);
});

test('number(cond) and multiword vars', () => {
  assert.equal(evalExpr('10 * Rating - 5 * number(Rating > 2)', { Rating: 3 }), 25);
  assert.equal(evalExpr('Gear Cost * 2', { 'Gear Cost': 500 }), 1000);
  assert.equal(evalExpr('(Rating - MinRating + 1) * 5000', { Rating: 3, MinRating: 2 }), 10000);
});

test('availability strings', () => {
  assert.deepEqual(evalAvail('12R'), { n: 12, flag: 'R', mod: false });
  assert.deepEqual(evalAvail('(Rating * 3)F', { Rating: 3 }), { n: 9, flag: 'F', mod: false });
  assert.deepEqual(evalAvail('+2'), { n: 2, flag: '', mod: true });
  assert.deepEqual(evalAvail('FixedValues(4R,8R,12F)', { Rating: 3 }), { n: 12, flag: 'F', mod: false });
});

test('Variable range', () => {
  assert.deepEqual(variableRange('Variable(500-1000)'), { min: 500, max: 1000 });
  assert.equal(variableRange('12'), null);
});

test('garbage returns NaN, never throws', () => {
  assert.ok(Number.isNaN(evalExpr('foo(')));
  assert.ok(Number.isNaN(evalExpr('1 +')));
});
