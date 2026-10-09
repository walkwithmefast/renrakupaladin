import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;

const mentorQuality = () => idx('qualities', 'qualities').byName.get('mentor spirit');

test('picking a mentor without the Mentor Spirit quality has no effect', () => {
  const ch = newCharacter();
  ch.mentor = 'Bear';
  const d = derive(ch);
  assert.equal(d.mentor.hasQuality, false);
  assert.equal(d.mentor.def, null);
});

test('with the quality and a mentor picked, the mentor advantage actually applies (Bear: +2 damage resistance)', () => {
  const ch = newCharacter();
  const q = mentorQuality();
  ch.qualities.push({ uid: 'm1', id: q.id, name: q.name, choice: {} });
  const before = derive(ch).pools.damageResist;
  ch.mentor = 'Bear';
  const after = derive(ch);
  assert.equal(after.mentor.hasQuality, true);
  assert.equal(after.mentor.def.name, 'Bear');
  assert.equal(after.pools.damageResist, before + 2);
});

test('the chosen mentor sub-option also applies (Cat: +2 dice on a chosen skill, once the skill has a rank)', () => {
  const gymId = idx('skills', 'skills').byName.get('gymnastics').id;
  const ch = newCharacter();
  const q = mentorQuality();
  ch.qualities.push({ uid: 'm1', id: q.id, name: q.name, choice: {} });
  ch.skills[gymId] = { p: 1, k: 0, a: 0, spec: '' }; // needs a rank before a skill bonus shows in its pool
  const before = derive(ch).skills.find((s) => s.name === 'Gymnastics').pool;
  ch.mentor = 'Cat';
  ch.mentorChoice = '+2 dice on Gymnastics Tests';
  const after = derive(ch).skills.find((s) => s.name === 'Gymnastics').pool;
  assert.equal(after, before + 2);
});

test('an unknown mentor name resolves to nothing rather than throwing', () => {
  const ch = newCharacter();
  const q = mentorQuality();
  ch.qualities.push({ uid: 'm1', id: q.id, name: q.name, choice: {} });
  ch.mentor = 'Not A Real Mentor';
  const d = derive(ch);
  assert.ok(!d.mentor.def);
});
