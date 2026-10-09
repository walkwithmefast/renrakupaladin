// Cyberlimb Strength/Agility (SR5 core p.455-456; engine/cyberlimbs.js) - a cyberlimb's own STR/AGI, base 3,
// raised by Customized (sets the base) and Enhanced (adds on top) mods; "best available" feeds melee/unarmed/
// thrown weapon damage and "Combat Active" (weapon-skill) pools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { isCyberlimb, isArmOrHand, cyberlimbStats, bestStr, bestAgi } = await import('../src/engine/cyberlimbs.js');
const { weaponStats } = await import('../src/engine/weapons.js');
const { describeItem, resolveInspect } = await import('../src/engine/describe.js');

const cw = (n) => idx('cyberware', 'cyberwares').list.find((c) => c.name === n);
const fullArm = cw('Obvious Full Arm');
const fullLeg = cw('Obvious Full Leg');
const custStr = cw('Customized Strength');
const custAgi = cw('Customized Agility');
const enhStr = cw('Enhanced Strength');
const enhAgi = cw('Enhanced Agility');

test('isCyberlimb: arms/legs/hands/feet count, torso/skull and modular connectors/gear-mounts don\'t', () => {
  assert.ok(isCyberlimb(fullArm));
  assert.ok(isCyberlimb(fullLeg));
  assert.ok(isCyberlimb(cw('Obvious Hand')));
  assert.ok(isCyberlimb(cw('Obvious Foot')));
  assert.ok(isCyberlimb(cw('Obvious Lower Arm')));
  assert.ok(!isCyberlimb(cw('Obvious Torso')), 'a shell, not a limb (SR5 p.455)');
  assert.ok(!isCyberlimb(cw('Obvious Skull')));
  assert.ok(!isCyberlimb(cw('Modular Connector, Shoulder')), 'a socket, not a limb itself');
  assert.ok(!isCyberlimb(cw('Modular Gear (Hand)')), 'a gear-mount adapter, not a limb');
  assert.ok(isCyberlimb(cw('Obvious Full Arm, Modular')), 'the swapped-in piece IS a real limb');
  assert.ok(!isCyberlimb(custStr), 'a Cyberlimb Enhancement child, not a limb itself');
});

test('isArmOrHand: arms/hands wield weapons, legs/feet don\'t', () => {
  assert.ok(isArmOrHand(fullArm));
  assert.ok(isArmOrHand(cw('Obvious Hand')));
  assert.ok(isArmOrHand(cw('Obvious Lower Arm')));
  assert.ok(!isArmOrHand(fullLeg));
  assert.ok(!isArmOrHand(cw('Obvious Foot')));
});

test('cyberlimbStats: base 3, Customized sets the base, Enhanced adds on top (each independently for STR/AGI)', () => {
  const arm = { it: { uid: 'a1' }, def: fullArm };
  const bare = cyberlimbStats([arm]);
  assert.deepEqual([bare[0].str, bare[0].agi], [3, 3], 'no mods installed: base 3/3');

  const withCustom = cyberlimbStats([arm, { it: { uid: 'c1', parent: 'a1', rating: 6 }, def: custStr }]);
  assert.deepEqual([withCustom[0].str, withCustom[0].agi], [6, 3], 'Customized Strength 6 sets STR, AGI stays base');

  const withBoth = cyberlimbStats([
    arm,
    { it: { uid: 'c1', parent: 'a1', rating: 6 }, def: custStr },
    { it: { uid: 'c2', parent: 'a1', rating: 5 }, def: custAgi },
    { it: { uid: 'e1', parent: 'a1', rating: 2 }, def: enhStr },
    { it: { uid: 'e2', parent: 'a1', rating: 1 }, def: enhAgi },
  ]);
  assert.deepEqual([withBoth[0].str, withBoth[0].agi], [8, 6], 'Customized sets the base, Enhanced adds on top (6+2, 5+1)');

  // a child parented to a DIFFERENT limb doesn't leak across
  const twoLimbs = cyberlimbStats([
    arm, { it: { uid: 'l1' }, def: fullLeg },
    { it: { uid: 'c1', parent: 'a1', rating: 6 }, def: custStr },
  ]);
  const leg = twoLimbs.find((l) => l.uid === 'l1');
  assert.deepEqual([leg.str, leg.agi], [3, 3], "the leg's own rating is untouched by the arm's mod");
});

test('bestStr / bestAgi: the highest available, natural or any limb - AGI only from arms/hands', () => {
  const limbs = [
    { str: 8, agi: 3, arm: true }, // cyberarm, Customized Strength 8
    { str: 3, agi: 7, arm: false }, // cyberleg, Customized Agility 7 (irrelevant to weapon pools)
  ];
  assert.equal(bestStr(4, limbs), 8, 'the arm\'s Strength beats natural 4');
  assert.equal(bestStr(9, limbs), 9, 'natural already beats every limb');
  assert.equal(bestAgi(5, limbs), 5, "the leg's higher Agility doesn't count - legs don't wield weapons");
});

// ---- wired into derive(): melee weapon damage and Combat Active skill pools -----------------------------------
test("a cyberarm's Customized/Enhanced Strength raises melee weapon damage ({STR} in weapons.js)", () => {
  const sword = idx('weapons', 'weapons').byName.get("ares 'one' monosword"); // "({STR}+3)P"
  assert.ok(sword);
  const ch = newCharacter(); // natural STR 1
  const baseline = weaponStats(sword, derive(ch));
  assert.equal(baseline.dmg, '4P', 'natural STR 1: (1+3)P');

  ch.cyberware.push(
    { uid: 'arm', id: fullArm.id, name: fullArm.name },
    { uid: 'str', id: custStr.id, name: custStr.name, rating: 6, parent: 'arm', child: true },
    { uid: 'enh', id: enhStr.id, name: enhStr.name, rating: 2, parent: 'arm', child: true },
  );
  const d = derive(ch);
  assert.equal(d.strCombat, 8, 'best available: the cyberarm\'s 6 (Customized) + 2 (Enhanced) beats natural 1');
  const boosted = weaponStats(sword, d);
  assert.equal(boosted.dmg, '11P', '(8+3)P - the cyberarm\'s Strength, not the meat body\'s');
});

test('a cyberarm\'s Customized Agility raises "Combat Active" weapon-skill pools, not unrelated AGI skills', () => {
  const ch = newCharacter();
  const pistolsId = idx('skills', 'skills').byName.get('pistols').id;
  const palmingId = idx('skills', 'skills').byName.get('palming').id; // also AGI-linked, but not a weapon skill
  ch.skills = { [pistolsId]: { k: 3, p: 0, a: 0, spec: '' }, [palmingId]: { k: 3, p: 0, a: 0, spec: '' } };
  const before = derive(ch);
  const pistolsBefore = before.skills.find((s) => s.name === 'Pistols').pool;
  const palmingBefore = before.skills.find((s) => s.name === 'Palming').pool;

  ch.cyberware.push(
    { uid: 'arm', id: fullArm.id, name: fullArm.name },
    { uid: 'agi', id: custAgi.id, name: custAgi.name, rating: 6, parent: 'arm', child: true },
  );
  const after = derive(ch);
  assert.equal(after.agiCombat, 6, "the cyberarm's Customized Agility 6 beats natural AGI");
  const pistolsAfter = after.skills.find((s) => s.name === 'Pistols').pool;
  const palmingAfter = after.skills.find((s) => s.name === 'Palming').pool;
  assert.equal(pistolsAfter - pistolsBefore, after.agiCombat - before.attr.AGI.pool, 'Pistols (Combat Active) picks up the cyberarm\'s Agility');
  assert.equal(palmingAfter, palmingBefore, "Palming (not Combat Active) is untouched - it's AGI-linked but not a weapon skill");
});

test('a cyberLEG\'s Strength still counts for melee/unarmed damage (kicks), but its Agility never feeds weapon pools', () => {
  const ch = newCharacter();
  ch.cyberware.push(
    { uid: 'leg', id: fullLeg.id, name: fullLeg.name },
    { uid: 'str', id: custStr.id, name: custStr.name, rating: 6, parent: 'leg', child: true },
    { uid: 'agi', id: custAgi.id, name: custAgi.name, rating: 6, parent: 'leg', child: true },
  );
  const d = derive(ch);
  assert.equal(d.strCombat, 6, "the leg's Strength counts (a kick is unarmed damage too)");
  assert.equal(d.agiCombat, d.attr.AGI.pool, "the leg's Agility is ignored for weapon pools - it doesn't hold a gun");
});

test('Inspector: an owned cyberlimb shows its own Strength/Agility (used to show nothing about them at all)', () => {
  const ch = newCharacter();
  ch.cyberware.push(
    { uid: 'arm', id: fullArm.id, name: fullArm.name },
    { uid: 'str', id: custStr.id, name: custStr.name, rating: 5, parent: 'arm', child: true },
  );
  const d = derive(ch);
  const found = resolveInspect(ch, 'cyberware', { uid: 'arm' });
  const info = describeItem('cyberware', found.def, found.it, d);
  assert.deepEqual(info.own.find(([k]) => k === 'Strength'), ['Strength', '5']);
  assert.deepEqual(info.own.find(([k]) => k === 'Agility'), ['Agility', '3']);
  // the Customized Strength child itself isn't a limb, so it gets no Strength/Agility row of its own
  const childFound = resolveInspect(ch, 'cyberware', { uid: 'str' });
  const childInfo = describeItem('cyberware', childFound.def, childFound.it, d);
  assert.equal(childInfo.own.find(([k]) => k === 'Strength'), undefined);
});
