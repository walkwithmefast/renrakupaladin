import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { isFocus, bondMultiplier, bondKarma, bondedForce, totalBondKarma, FOCUS_TABLE_PAGE } = await import('../src/engine/foci.js');

const focusOf = (name) => idx('gear', 'gears').byName.get(name.toLowerCase());

test('isFocus only matches the Foci category', () => {
  assert.equal(isFocus(focusOf('Power Focus')), true);
  assert.equal(isFocus(idx('weapons', 'weapons').list[0]), false);
  assert.equal(isFocus(null), false);
});

test('bondMultiplier follows the Focus table (SR5 core p.318)', () => {
  assert.equal(bondMultiplier(focusOf('Power Focus')), 6);
  assert.equal(bondMultiplier(focusOf('Weapon Focus')), 3);
  assert.equal(bondMultiplier(focusOf('Sustaining Focus, Combat')), 2); // spell focus
  assert.equal(bondMultiplier(focusOf('Alchemical Focus')), 3); // enchanting focus
  assert.equal(bondMultiplier(focusOf('Centering Focus')), 3); // metamagic focus
  assert.equal(bondMultiplier(focusOf('Summoning Focus')), 2); // spirit focus
  assert.equal(bondMultiplier(focusOf('Qi Focus')), 2);
});

test('bondMultiplier matches by longest name prefix, not a substring anywhere', () => {
  // "Ritual Spellcasting Focus, Combat" does NOT start with "Weapon Focus" or any x3/x6 entry -> default
  assert.equal(bondMultiplier(focusOf('Ritual Spellcasting Focus, Combat')), 2);
});

test('bondKarma = Force x multiplier, clamped at 0 for a negative/missing Force', () => {
  const power = focusOf('Power Focus');
  assert.equal(bondKarma(power, 4), 24);
  assert.equal(bondKarma(power, 0), 0);
  assert.equal(bondKarma(power, -3), 0);
});

test('bondedForce / totalBondKarma only count foci that are actually bonded', () => {
  const power = focusOf('Power Focus');
  const sustaining = focusOf('Sustaining Focus, Combat');
  const entries = [
    { def: power, it: { rating: 3, bonded: true } },
    { def: sustaining, it: { rating: 2, bonded: false } }, // owned but not bonded: doesn't count
    { def: sustaining, it: { rating: 4, bonded: true } },
  ];
  assert.equal(bondedForce(entries), 3 + 4);
  assert.equal(totalBondKarma(entries), 3 * 6 + 4 * 2);
});

test('bondedForce/totalBondKarma are safe on an empty or missing list', () => {
  assert.equal(bondedForce([]), 0);
  assert.equal(bondedForce(undefined), 0);
  assert.equal(totalBondKarma([]), 0);
});

test('FOCUS_TABLE_PAGE points at the rulebook page so the UI can link straight to it', () => {
  assert.equal(FOCUS_TABLE_PAGE, 318);
});

// ---- wired into derive(): karma cost and the Force-vs-Magic warning -----------------------------
test('a bonded focus costs real Karma, taken out of the build (create mode)', () => {
  const ch = newCharacter();
  const power = focusOf('Power Focus');
  ch.gear.push({ uid: 'f1', id: power.id, name: power.name, rating: 2, bonded: true });
  const d = derive(ch);
  assert.equal(d.karma.spent.foci, 2 * 6);
  assert.ok(d.magic.fociKarma === 12);
  assert.ok(d.magic.fociForce === 2);
});

test('an unbonded focus costs nothing, even if owned', () => {
  const ch = newCharacter();
  const power = focusOf('Power Focus');
  ch.gear.push({ uid: 'f1', id: power.id, name: power.name, rating: 5, bonded: false });
  const d = derive(ch);
  assert.equal(d.karma.spent.foci, 0);
  assert.equal(d.magic.fociForce, 0);
});

test('bonded foci over Magic x 5 total Force raise a warning citing SR5 core p.318', () => {
  const ch = newCharacter();
  ch.pri.talent = 'A';
  ch.talent = 'Magician'; // Magic 6 at priority A (see talentOptions)
  const power = focusOf('Power Focus');
  ch.gear.push({ uid: 'f1', id: power.id, name: power.name, rating: 99, bonded: true }); // absurdly high on purpose
  const d = derive(ch);
  assert.equal(d.attr.MAG.enabled, true, 'sanity check: this character should actually be a magic user');
  assert.ok(d.warnings.some((w) => /Bonded foci/.test(w.msg) && /p\.318/.test(w.msg)), JSON.stringify(d.warnings));
});

test('bonded foci within the Magic cap raise no such warning', () => {
  const ch = newCharacter();
  ch.pri.talent = 'A';
  ch.talent = 'Magician';
  const power = focusOf('Power Focus');
  ch.gear.push({ uid: 'f1', id: power.id, name: power.name, rating: 3, bonded: true }); // well under Magic 6
  const d = derive(ch);
  assert.equal(d.attr.MAG.enabled, true);
  assert.ok(!d.warnings.some((w) => /Bonded foci/.test(w.msg)));
});

test('career mode: bonded focus Karma counts against advancement, same as create mode', () => {
  const ch = newCharacter();
  ch.mode = 'career';
  ch.career = { earned: 100, log: [] };
  const power = focusOf('Power Focus');
  ch.gear.push({ uid: 'f1', id: power.id, name: power.name, rating: 2, bonded: true });
  const d = derive(ch);
  assert.equal(d.karma.left, 100 - 12);
});
