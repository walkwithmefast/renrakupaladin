// v23 choice-type bonuses: free powers from a Qi Focus / mentor adept option (engine/grantedPowers.js), Arts and power
// enhancements in initiation + the requirement checks that need them, and Attribute Boost (engine/boost.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const grants = await import('../src/engine/grantedPowers.js');
const boost = await import('../src/engine/boost.js');
const { blockedReason, reqContext } = await import('../src/engine/requirements.js');
const { unavailabilityChecker } = await import('../src/engine/purchasable.js');
const { playState } = await import('../src/engine/edge.js');

const power = (n) => idx('powers', 'powers').list.find((p) => p.name === n);
const gear = (n) => idx('gear', 'gears').list.find((g) => g.name === n && !g.hide);

function adept() {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' };
  ch.talent = 'Adept';
  return ch;
}

test('Qi Focus: Force x 0.25 PP buys levels; only while bonded; bonuses apply, no Power Points', () => {
  const spec = grants.selectPowerSpec(gear('Qi Focus').bonus);
  assert.equal(spec.perLevel, 0.25);
  assert.equal(grants.grantLevel(spec, power('Improved Reflexes'), 6), 1); // 1.5 PP per level
  assert.equal(grants.grantLevel(spec, power('Improved Reflexes'), 5), 0);
  assert.equal(grants.grantLevel(spec, power('Killing Hands'), 2), 1); // 0.5 PP, no levels
  assert.equal(grants.grantLevel(spec, power('Combat Sense'), 6), 3); // 0.5 PP per level

  const ch = adept();
  ch.gear.push({ uid: 'qi', id: gear('Qi Focus').id, name: 'Qi Focus', rating: 6, choice: { power: power('Improved Reflexes').id } });
  let d = derive(ch);
  assert.equal(d.powerGrants.length, 0, 'unbonded focus does nothing');
  const initBefore = d.init.dice;
  ch.gear[0].bonded = true;
  d = derive(ch);
  assert.equal(d.powerGrants.length, 1);
  assert.equal(d.powerGrants[0].level, 1);
  assert.equal(d.init.dice, initBefore + 1, 'Improved Reflexes 1: +1D6');
  assert.equal(d.magic.ppUsed, 0, 'free power costs no PP');
});

test('mentor adept option grants a power from its short list', () => {
  const ch = adept();
  const mq = idx('qualities', 'qualities').list.find((q) => q.name === 'Mentor Spirit');
  ch.qualities.push({ uid: 'm', id: mq.id, name: mq.name, choice: {} });
  ch.mentor = 'Holy Text';
  const mentor = idx('mentors', 'mentors').list.find((m) => m.name === 'Holy Text');
  ch.mentorChoice = mentor.choices.find((c) => c.bonus && c.bonus.selectpowers).name;
  const spec = grants.selectPowerSpec(derive(ch).mentor.pick.bonus);
  assert.deepEqual(grants.grantablePowers(spec).map((x) => x.def.name).sort(), ['Empathic Healing', 'Mystic Armor']);
  assert.equal(grants.grantLevel(spec, power('Improved Reflexes')), 0, 'not on the list');
  ch.mentorPower = power('Mystic Armor').id;
  const d = derive(ch);
  assert.deepEqual(d.powerGrants.map((g) => [g.def.name, g.level, g.from]), [['Mystic Armor', 1, 'mentor']]);
});

test('Arts, metamagics and powers satisfy requirements; the picker names what is missing', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
  ch.talent = 'Magician';
  const mm = (n) => idx('metamagic', 'metamagics').list.find((m) => m.name === n);
  const why = () => unavailabilityChecker('metamagic', ch, derive(ch));
  assert.equal(why()(mm('Quickening')), 'Needs the Art Quickening');
  assert.equal(why()(mm('Anchoring')), 'Needs the Art Quickening and the metamagic Quickening');
  ch.metamagics = [{ uid: '1', name: 'Quickening', kind: 'art' }];
  assert.equal(why()(mm('Quickening')), null);
  assert.equal(why()(mm('Anchoring')), 'Needs the metamagic Quickening');
  ch.metamagics.push({ uid: '2', name: 'Quickening', kind: 'metamagic' });
  assert.equal(why()(mm('Anchoring')), null);
  // enhancements need their power
  const enh = idx('powers', 'enhancements').list.find((e) => e.name === 'Air Walking');
  const ctx = reqContext(ch, derive(ch));
  assert.ok(blockedReason(enh, ctx));
  // the initiation count includes Arts
  assert.equal(derive(ch).magic.metamagicCount, 2);
});

test('Attribute Boost: dice pools only, capped at augmented max, 2 x hits turns, Drain = level at the end', () => {
  const ch = adept();
  ch.attrs.AGI.p = 3; // AGI 4 (max 6, augmented max 10)
  ch.powers.push({ uid: 'ab', id: power('Attribute Boost').id, name: 'Attribute Boost', level: 2, choice: { attr: 'AGI' } });
  let d = derive(ch);
  const agi = d.attr.AGI.total;
  const physLimit = d.limits.physical;
  const init = d.init.base;
  const b = boost.startBoost(ch, d, { attr: 'AGI', hits: 3, level: 2 });
  assert.deepEqual([b.v, b.turns, b.drain], [3, 6, 2]);
  d = derive(ch);
  assert.equal(d.attr.AGI.total, agi, 'the attribute itself is unchanged');
  assert.equal(d.attr.AGI.pool, agi + 3);
  assert.equal(d.limits.physical, physLimit);
  assert.equal(d.init.base, init);
  // capped at the augmented maximum
  assert.equal(boost.boostAmount(d, 'AGI', 99), d.attr.AGI.augMax - agi);
  // counting down
  for (let i = 0; i < 5; i++) assert.deepEqual(boost.tickBoosts(ch), []);
  assert.deepEqual(boost.tickBoosts(ch).map((x) => [x.attr, x.drain]), [['AGI', 2]]);
  assert.equal(playState(ch).boosts.length, 0);
  assert.equal(derive(ch).attr.AGI.pool, agi);
});
