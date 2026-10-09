// describeEffects() (engine/effects.js): the one-line "what does this actually do" summary shown next to a
// quality/power. Regression coverage for two display gaps found in a bug sweep: a skill effect's raised
// maximum (Aptitude) was silently dropped, and situational/category/group effects fell through to a generic
// "<internal type> <value>" line instead of naming what they apply to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const { describeEffects } = await import('../src/engine/effects.js');

test('a skill effect with only a raised max (Aptitude) shows the max, not a misleading "+0"', () => {
  assert.equal(describeEffects([{ t: 'skill', name: 'Pistols', v: 0, max: 1 }]), 'Pistols max +1');
});

test('a skill effect with a pool bonus and no max shows just the bonus (Improved Ability)', () => {
  assert.equal(describeEffects([{ t: 'skill', name: 'Pistols', v: 1, max: 0 }]), 'Pistols +1');
});

test('a skill effect with both a bonus and a max shows both', () => {
  assert.equal(describeEffects([{ t: 'skill', name: 'Pistols', v: 2, max: 1 }]), 'Pistols +2, Pistols max +1');
});

test('a negative skill effect with no max (Loss of Confidence) still shows the sign', () => {
  assert.equal(describeEffects([{ t: 'skill', name: 'Intimidation', v: -2, max: 0 }]), 'Intimidation -2');
});

test('unconditional category/group bonuses name the category/group (Linguist, Trustworthy)', () => {
  assert.equal(describeEffects([{ t: 'skillcat', cat: 'Language', v: 1, exclude: [] }]), 'Language skills +1');
  assert.equal(describeEffects([{ t: 'skillgrp', group: 'Influence', v: 1, exclude: [] }]), 'Influence group +1');
});

test('a situational note names what it applies to and when (City Slicker, First Impression)', () => {
  assert.equal(
    describeEffects([{ t: 'situational', what: 'Perception', v: -1, condition: 'Not Urban' }]),
    'Perception -1 (Not Urban)',
  );
  assert.equal(
    describeEffects([{ t: 'situational', what: 'Social Active skills', v: 2, condition: 'Meeting people the first time' }]),
    'Social Active skills +2 (Meeting people the first time)',
  );
});

test('several effects on one quality join in order (City Slicker: two situational, one unconditional)', () => {
  const list = [
    { t: 'situational', what: 'Perception', v: -1, condition: 'Not Urban' },
    { t: 'skillgrp', group: 'Outdoors', v: 1, exclude: ['Survival'] },
    { t: 'situational', what: 'Survival', v: 2, condition: 'Urban' },
  ];
  const text = describeEffects(list);
  assert.equal(text, 'Perception -1 (Not Urban), Outdoors group +1, Survival +2 (Urban)');
});

test('an attribute effect with both a bonus and a raised max still renders both (unchanged behavior)', () => {
  assert.equal(describeEffects([{ t: 'attr', a: 'AGI', v: 1, max: 1 }]), 'AGI +1, AGI max +1');
});
