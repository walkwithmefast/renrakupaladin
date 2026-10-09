// Choice-type and situational bonuses (engine/effects.js): pick-a-skill, pick-an-attribute, skill categories/groups,
// and conditional bonuses that become notes instead of changing pools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const Q = dataMod.idx('qualities', 'qualities').byName;
const S = dataMod.idx('skills', 'skills').byName;
const P = dataMod.idx('powers', 'powers').byName;
const pool = (d, n) => d.skills.find((s) => s.name === n).pool;

test('City Slicker: conditional bonuses become situational notes; the unconditional one still applies', () => {
  const ch = newCharacter();
  ch.attrs.INT.p = 2; ch.attrs.LOG.p = 2;
  ch.skills[S.get('perception').id] = { p: 3, k: 0, a: 0 };
  ch.skills[S.get('survival').id] = { p: 3, k: 0, a: 0 };
  const before = derive(ch);
  ch.qualities.push({ uid: 'c', name: Q.get('city slicker').name });
  const d = derive(ch);
  assert.equal(pool(d, 'Perception'), pool(before, 'Perception'), 'Perception -1 only when not urban');
  assert.equal(pool(d, 'Survival'), pool(before, 'Survival') - 1, 'Survival -1 always');
  const notes = d.situational.filter((n) => n.src === 'City Slicker');
  assert.ok(notes.some((n) => n.what === 'Perception' && n.v === -1 && n.condition === 'Not Urban'));
  assert.ok(notes.some((n) => n.what === 'Survival' && n.v === 2 && n.condition === 'Urban'));
  assert.ok(notes.some((n) => /Outdoors group/.test(n.what) && n.v === 1));
});

test('First Impression is a situational note, not a Social pool change', () => {
  const ch = newCharacter();
  ch.skills[S.get('negotiation').id] = { p: 3, k: 0, a: 0 };
  const before = pool(derive(ch), 'Negotiation');
  ch.qualities.push({ uid: 'f', name: Q.get('first impression').name });
  const d = derive(ch);
  assert.equal(pool(d, 'Negotiation'), before);
  assert.ok(d.situational.some((n) => n.src === 'First Impression' && n.what === 'Social Active skills' && n.v === 2));
});

test('Aptitude raises the chosen skill\'s creation maximum to 7', () => {
  const ch = newCharacter();
  ch.skills[S.get('pistols').id] = { p: 0, k: 7, a: 0 };
  const over = (d) => d.warnings.some((w) => /Pistols is above the creation maximum/.test(w.msg || w.text || w));
  assert.ok(over(derive(ch)), 'rating 7 is over the max without Aptitude');
  ch.qualities.push({ uid: 'a', name: Q.get('aptitude').name, choice: { skill: 'Pistols' } });
  assert.ok(!over(derive(ch)), 'Aptitude (Pistols) allows 7');
  ch.qualities[0].choice = { skill: 'Archery' };
  assert.ok(over(derive(ch)), 'Aptitude on another skill does not');
});

test('adept powers: Improved Ability adds its level to the chosen skill; Improved Physical Attribute to the chosen attribute', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' };
  ch.talent = 'Adept';
  ch.skills[S.get('pistols').id] = { p: 3, k: 0, a: 0 };
  const before = derive(ch);
  const ia = P.get('improved ability (skill)'), ipa = P.get('improved physical attribute');
  ch.powers.push({ uid: 'p1', id: ia.id, name: ia.name, level: 2, choice: { skill: 'Pistols' } });
  ch.powers.push({ uid: 'p2', id: ipa.id, name: ipa.name, level: 1, choice: { attr: 'AGI' } });
  const d = derive(ch);
  assert.equal(d.attr.AGI.total, before.attr.AGI.total + 1);
  assert.equal(pool(d, 'Pistols'), pool(before, 'Pistols') + 2 + 1, '+2 Improved Ability, +1 from AGI');
});
