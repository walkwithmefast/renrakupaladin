import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { styleKarma, totalMartialArtKarma, MARTIAL_ARTS_PAGE } = await import('../src/engine/martialarts.js');

const R = { martialArtKarma: 7, freeTechniques: 2, techniqueKarma: 5 };

test('styleKarma: base cost with 0, 1 or exactly the free number of techniques', () => {
  assert.equal(styleKarma(R, 0), 7);
  assert.equal(styleKarma(R, 1), 7);
  assert.equal(styleKarma(R, 2), 7);
});

test('styleKarma: techniques beyond the free allotment cost extra', () => {
  assert.equal(styleKarma(R, 3), 7 + 5);
  assert.equal(styleKarma(R, 4), 7 + 10);
});

test('totalMartialArtKarma sums every style', () => {
  const styles = [{ techniques: [] }, { techniques: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }];
  assert.equal(totalMartialArtKarma(R, styles), 7 + (7 + 5));
  assert.equal(totalMartialArtKarma(R, []), 0);
  assert.equal(totalMartialArtKarma(R, undefined), 0);
});

test('page constant points at the Martial Arts section', () => {
  assert.equal(MARTIAL_ARTS_PAGE, 148);
});

test('a martial art style spends real Karma via derive()', () => {
  const ch = newCharacter();
  ch.martialArts.push({ uid: 'a', name: 'Aikido', techniques: [{ uid: 't1', name: 'Throw Person' }] });
  const d = derive(ch);
  assert.equal(d.karma.spent.martialArts, d.R.martialArtKarma);
});
