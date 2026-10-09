import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { describeItem } = await import('../src/engine/describe.js');
const { idx } = dataMod;

const have = globalThis.SR5DRUGS && Object.keys(globalThis.SR5DRUGS).length > 0;
const skip = !have && 'no drug entries built on this machine (run tools/extract_drugs.py)';
const drugOf = (name, source = 'SR5') => {
  const def = idx('gear', 'gears').list.find((g) => g.category === 'Drugs' && g.name === name && g.source === source);
  return describeItem('gear', def, null, derive(newCharacter())).drug;
};
const row = (drug, label) => (drug.rows.find(([k]) => k === label) || [])[1];

test('Cram: the full stat block and flavor text from the core book', { skip }, () => {
  const d = drugOf('Cram');
  assert.equal(row(d, 'Vector'), 'Ingestion, Inhalation');
  assert.equal(row(d, 'Speed'), '10 minutes');
  assert.equal(row(d, 'Duration'), '(12 × Body) hours, minimum 1 hour');   // the book's multiplication sign, not a dash
  assert.equal(row(d, 'Addiction type'), 'Psychological');
  assert.equal(d.effect, '+1 Reaction, +1D6 Initiative Dice');
  assert.match(d.flavor, /^Cram is an extremely popular stimulant/);
  assert.match(d.flavor, /6 Stun damage/);
});

test('addiction rating and threshold come from the book\'s Addiction Table', { skip }, () => {
  const k = drugOf('Kamikaze');
  assert.equal(row(k, 'Addiction rating'), '9');
  assert.equal(row(k, 'Addiction threshold'), '3');
  const b = drugOf('Bliss');
  assert.equal(row(b, 'Addiction rating'), '5');
  assert.equal(row(b, 'Addiction threshold'), '3');
  const j = drugOf('Jazz');
  assert.equal(row(j, 'Addiction rating'), '8');
});

test('effects that wrap onto a second line are joined and de-hyphenated', { skip }, () => {
  // the book prints minus signs as en dashes; the quote keeps them as printed
  assert.equal(drugOf('Bliss').effect, '\u20131 Reaction, +1 to all thresholds, \u20131 to all Limits, High Pain Tolerance 3 (p. 74)');
  const k = drugOf('Kamikaze').effect;
  assert.match(k, /\+1 Willpower/);     // was "Willpow- er"
  assert.doesNotMatch(k, /- [a-z]/);
});

test('flavor text does not start with the tail of the effect line', { skip }, () => {
  assert.match(drugOf('Bliss').flavor, /^A tranquilizing narcotic, bliss is an opiate/);
});

test('other books: bulleted stat blocks and wrapped titles are read too', { skip }, () => {
  const buff = drugOf('Buffout', 'LCD');
  assert.equal(row(buff, 'Addiction type'), 'Physiological');
  assert.match(buff.effect, /^\+6 Strength for Lift\/Carry and Grappling/);
  const aisa = drugOf('Aisa', 'CF');
  assert.equal(row(aisa, 'Vector'), 'Ingestion');
});

test('a drug shows the drug profile, not the generic excerpt', { skip }, () => {
  const def = idx('gear', 'gears').list.find((g) => g.category === 'Drugs' && g.name === 'Cram' && g.source === 'SR5');
  const info = describeItem('gear', def, null, derive(newCharacter()));
  assert.ok(info.drug);
  assert.equal(info.excerpt, null);
  assert.ok(info.cost.some(([k]) => k === 'Availability'));   // price and availability still shown
});
