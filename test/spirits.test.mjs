import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { spiritOptions, spiritDef, spiritStats, totalForce, totalBoundKarma, SPIRITS_PAGE, SPRITES_PAGE } = await import('../src/engine/spirits.js');

test('spiritOptions: a Hermetic mage gets the 5 category-mapped spirit types', () => {
  const opts = spiritOptions('Hermetic', false);
  assert.equal(opts.length, 5);
  assert.ok(opts.some((o) => o.name === 'Spirit of Fire' && o.category === 'combat'));
  assert.ok(opts.some((o) => o.name === 'Spirit of Air' && o.category === 'detection'));
});

test('spiritOptions: technomancers (streams) get the flat sprite list regardless of name', () => {
  const opts = spiritOptions('', true);
  assert.ok(opts.length > 0);
  assert.ok(opts.every((o) => o.category === ''));
  assert.ok(opts.some((o) => o.name === 'Courier Sprite'));
});

test('spiritOptions: an unknown/blank tradition returns nothing rather than throwing', () => {
  assert.deepEqual(spiritOptions('Not A Real Tradition', false), []);
  assert.deepEqual(spiritOptions('', false), []);
});

test('spiritDef resolves the catalogue stat block by name', () => {
  const def = spiritDef('Spirit of Fire', false);
  assert.ok(def);
  assert.equal(def.name, 'Spirit of Fire');
  const sprite = spiritDef('Courier Sprite', true);
  assert.ok(sprite);
});

test('spiritStats scales attributes by Force and never goes below 0', () => {
  const def = spiritDef('Spirit of Air', false); // bod: F-2, agi: F+3, str: F-3
  const s3 = spiritStats(def, 3);
  assert.equal(s3.attrs.bod, 1); // 3-2
  assert.equal(s3.attrs.agi, 6); // 3+3
  assert.equal(s3.attrs.str, 0); // 3-3 = 0
  const s1 = spiritStats(def, 1);
  assert.equal(s1.attrs.str, 0); // 1-3 clamped to 0, not negative
});

test('spiritStats computes initiative from the formula too', () => {
  const def = spiritDef('Spirit of Air', false); // ini: (F*2)+4
  const s = spiritStats(def, 5);
  assert.equal(s.ini, 14);
});

test('spiritStats is null for a missing def', () => {
  assert.equal(spiritStats(null, 4), null);
});

test('totalForce sums every entry on the character, defaulting missing force to 0', () => {
  const ch = newCharacter();
  ch.spirits.push({ uid: 'a', name: 'Spirit of Fire', force: 4 });
  ch.spirits.push({ uid: 'b', name: 'Spirit of Air', force: 2 });
  assert.equal(totalForce(ch), 6);
  assert.equal(totalForce(newCharacter()), 0);
});

test('rulebook page constants point at the summoning/compiling sections', () => {
  assert.equal(SPIRITS_PAGE, 300);
  assert.equal(SPRITES_PAGE, 256);
});

test('totalBoundKarma only counts bound/registered entries, Force x boundSpiritKarma each', () => {
  const R = { boundSpiritKarma: 1 };
  const ch = newCharacter();
  ch.spirits.push({ uid: 'a', name: 'Spirit of Fire', force: 4, bound: true });
  ch.spirits.push({ uid: 'b', name: 'Spirit of Air', force: 2, bound: false });
  assert.equal(totalBoundKarma(ch, R), 4);
});

// ---- the character object accepts a spirits list without derive() choking on it ------------------
test('derive() does not error with spirits on the sheet, magician or not', () => {
  const ch = newCharacter();
  ch.spirits.push({ uid: 'a', name: 'Spirit of Fire', force: 4, services: 2, bound: true });
  const d = derive(ch); // mundane character; just shouldn't throw
  assert.ok(d);
});

test('a bound spirit spends real Karma via derive()', () => {
  const ch = newCharacter();
  ch.pri.talent = 'A';
  ch.talent = 'Magician';
  ch.spirits.push({ uid: 'a', name: 'Spirit of Fire', force: 3, bound: true });
  const d = derive(ch);
  assert.equal(d.karma.spent.spirits, 3 * d.R.boundSpiritKarma);
});
