// Picker column sorting (src/pickerSort.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asNumber, sortValue, isNumericColumn, compareBy, nextSort } from '../src/pickerSort.js';

const names = (list) => list.map((x) => x.name).join(',');
const sorted = (list, col, dir) => [...list].sort(compareBy(col, isNumericColumn(col, list), dir));

test('asNumber reads leading numbers only', () => {
  assert.equal(asNumber('12R'), 12);
  assert.equal(asNumber('2,000¥'), 2000);
  assert.equal(asNumber('0.25'), 0.25);
  assert.equal(asNumber(-5), -5);
  assert.ok(Number.isNaN(asNumber('var.')));
  assert.ok(Number.isNaN(asNumber('Rating * 350')));
  assert.ok(Number.isNaN(asNumber('F-3')));
});

test('karma column: numeric, highest first on the first click, reversed on the second', () => {
  const karma = { key: 'karma', label: 'Karma', cls: 'num', get: (q) => Math.abs(Number(q.karma)) };
  const qs = [{ name: 'A', karma: '4' }, { name: 'B', karma: '-20' }, { name: 'C', karma: '10' }];
  assert.equal(isNumericColumn(karma, qs), true);
  let s = nextSort(null, 'karma', true);
  assert.deepEqual(s, { key: 'karma', dir: -1 });
  assert.equal(names(sorted(qs, karma, s.dir)), 'B,C,A'); // 20, 10, 4 (shown as absolute values)
  s = nextSort(s, 'karma', true);
  assert.equal(names(sorted(qs, karma, s.dir)), 'A,C,B');
});

test('name column: text, A-Z first; a different header starts fresh', () => {
  const name = { key: 'name', label: 'Quality' };
  const qs = [{ name: 'beta' }, { name: 'Alpha' }, { name: 'gamma 10' }, { name: 'gamma 9' }];
  assert.equal(isNumericColumn(name, qs), false);
  assert.deepEqual(nextSort({ key: 'karma', dir: -1 }, 'name', false), { key: 'name', dir: 1 });
  assert.equal(names(sorted(qs, name, 1)), 'Alpha,beta,gamma 9,gamma 10');
  assert.equal(names(sorted(qs, name, -1)), 'gamma 10,gamma 9,beta,Alpha');
});

test('book column sorts by book code, then page number, even though it renders a link', () => {
  const book = { key: 'source', label: 'Book', get: () => ({ type: 'SourceRef' }) };
  const qs = [{ name: 'x', source: 'SR5', page: '71' }, { name: 'y', source: 'RF', page: '145' }, { name: 'z', source: 'SR5', page: '9' }, { name: 'w', source: 'CA', page: '150' }];
  assert.deepEqual(sortValue(book, qs[0]), ['SR5', 71]);
  assert.equal(names(sorted(qs, book, 1)), 'w,y,z,x');
  assert.equal(names(sorted(qs, book, -1)), 'x,z,y,w');
});

test('costs: numbers by value, "var." and formulas always last', () => {
  const cost = { key: 'cost', label: 'Cost', cls: 'num', get: (x) => x.cost };
  const gs = [{ name: 'a', cost: '500' }, { name: 'b', cost: 'var.' }, { name: 'c', cost: '2,000' }, { name: 'd', cost: '50' }];
  assert.equal(names(sorted(gs, cost, -1)), 'c,a,d,b');
  assert.equal(names(sorted(gs, cost, 1)), 'd,a,c,b');
});

test('avail without cls counts as numeric when most values are numbers ("12R")', () => {
  const avail = { key: 'avail', label: 'Avail' };
  const gs = [{ name: 'a', avail: '4' }, { name: 'b', avail: '12R' }, { name: 'c', avail: '8F' }, { name: 'd', avail: '' }];
  assert.equal(isNumericColumn(avail, gs), true);
  assert.equal(names(sorted(gs, avail, -1)), 'b,c,a,d');
});
