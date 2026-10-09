// v23: fake SIN identity (engine/identity.js) and the Matrix deck card rules (engine/matrix.js): running programs that
// raise attributes / add slots / add resist dice, load blockers, attribute swaps, Matrix damage as play state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const identity = await import('../src/engine/identity.js');
const matrix = await import('../src/engine/matrix.js');
const { playState } = await import('../src/engine/edge.js');
const { sheetFields } = await import('../src/engine/pdfExport.js');

const gear = (name) => idx('gear', 'gears').list.find((g) => g.name === name && !g.hide);
const give = (ch, name, extra = {}) => {
  const def = gear(name);
  assert.ok(def, name);
  const it = { uid: `u${ch.gear.length}`, id: def.id, name, ...extra };
  ch.gear.push(it);
  return it;
};

test('fake SINs: names from notes, licenses nested under them, active one is play state', () => {
  const ch = newCharacter();
  const a = give(ch, 'Fake SIN', { rating: 4, notes: 'Won Justice' });
  const b = give(ch, 'Fake SIN', { rating: 2 });
  give(ch, 'Fake License', { rating: 4, parent: a.uid, child: true, notes: 'Concealed carry' });
  let sins = identity.fakeSins(derive(ch).items.gear);
  assert.deepEqual(sins.map((s) => [s.label, s.rating, s.licenses]), [['Won Justice', 4, ['Concealed carry']], ['Fake SIN #2', 2, []]]);
  assert.equal(identity.activeSin(ch, derive(ch).items.gear), null);
  identity.setActiveSin(ch, a.uid);
  assert.equal(identity.activeSin(ch, derive(ch).items.gear).label, 'Won Justice');
  assert.equal(playState(ch).sin, a.uid);
  // the SIN is gone (sold, burned and deleted): back to your own identity
  ch.gear = ch.gear.filter((g) => g.uid !== a.uid);
  assert.equal(identity.activeSin(ch, derive(ch).items.gear), null);
  identity.setActiveSin(ch, b.uid);
  identity.setActiveSin(ch, '');
  assert.equal(playState(ch).sin, '');
});

test('running programs boost the deck: attributes, slots, resist pools', () => {
  const ch = newCharacter();
  const deck = give(ch, 'Renraku Tsurugi'); // 6,5,5,3 - 3 programs, DR 3
  for (const n of ['Toolbox', 'Encryption', 'Armor', 'Shell', 'Stealth']) give(ch, n);
  const load = (n) => matrix.setProgramDevice(ch, ch.gear.find((g) => g.name === n).uid, deck.uid);
  load('Toolbox'); load('Encryption'); load('Armor');
  let d = derive(ch);
  let dev = d.matrix.devices[0];
  assert.deepEqual([dev.a, dev.s, dev.dp, dev.f, dev.limit], [6, 5, 6, 4, 3]);
  assert.deepEqual(dev.base, { a: 6, s: 5, dp: 5, f: 3 });
  assert.deepEqual(dev.boosts, { dp: ['Toolbox +1'], f: ['Encryption +1'] });
  assert.equal(d.matrix.pools.matrix.n, 3 + 4 + 2); // DR + Firewall + Armor
  assert.equal(d.matrix.init.cold.base, 6 + d.attr.INT.total); // Toolbox's DP feeds VR initiative
  // the deck is full
  assert.match(matrix.loadBlocker(d.matrix, gear('Shell'), deck.uid), /full/);
  // Virtual Machine: two more slots
  give(ch, 'Virtual Machine', { device: deck.uid });
  d = derive(ch);
  dev = d.matrix.devices[0];
  assert.equal(dev.limit, 5);
  assert.equal(matrix.loadBlocker(d.matrix, gear('Shell'), deck.uid), null);
  load('Shell');
  d = derive(ch);
  assert.equal(d.matrix.pools.matrix.n, 3 + 4 + 2 + 1);
  assert.equal(d.matrix.pools.bio.n, d.attr.WIL.total + 4 + 1);
  assert.match(matrix.loadBlocker(d.matrix, gear('Toolbox'), deck.uid), /already running/);
});

test('hacking programs need a deck; swapping two attributes; Matrix damage per device', () => {
  const ch = newCharacter();
  const link = give(ch, 'Meta Link');
  const deck = give(ch, 'Renraku Tsurugi');
  let d = derive(ch);
  assert.match(matrix.loadBlocker(d.matrix, gear('Hammer'), link.uid), /cyberdeck/);
  assert.equal(matrix.loadBlocker(d.matrix, gear('Browse'), link.uid), null);
  const dev = d.matrix.devices.find((x) => x.uid === deck.uid);
  matrix.swapAsdf(ch, deck.uid, dev.cfg, 'a', 'f');
  d = derive(ch);
  const after = d.matrix.devices.find((x) => x.uid === deck.uid);
  assert.deepEqual([after.a, after.f, after.cfg.ok], [3, 6, true]);
  matrix.setMatrixDamage(ch, deck.uid, 4);
  assert.equal(matrix.matrixDamage(playState(ch), deck.uid), 4);
  assert.equal(matrix.matrixDamage(playState(ch), link.uid), 0);
  // other play-state writers keep it (playState carries matrixDmg)
  ch.play = { ...playState(ch), phys: 2 };
  assert.equal(playState(ch).matrixDmg[deck.uid], 4);
  // and the PDF sheet ticks the deck's Matrix monitor
  const f = sheetFields(ch, derive(ch));
  assert.equal(Object.keys(f.check).filter((k) => k.startsWith('Matrix monitor.')).length, 4);
});

test('burning a fake SIN: flag on the item, still selectable, shown on the PDF line; un-burn clears it', () => {
  const ch = newCharacter();
  const a = give(ch, 'Fake SIN', { rating: 4, notes: 'Won Justice' });
  identity.setActiveSin(ch, a.uid);
  identity.setSinBurned(ch, a.uid, true);
  assert.equal(ch.gear[0].burned, true);
  const s = identity.activeSin(ch, derive(ch).items.gear);
  assert.deepEqual([s.label, s.burned], ['Won Justice', true], 'a burned SIN can stay in use');
  assert.equal(sheetFields(ch, derive(ch)).text.Licenses, 'Won Justice (Fake SIN R4, BURNED)');
  identity.setSinBurned(ch, a.uid, false);
  assert.equal('burned' in ch.gear[0], false);
  assert.equal(sheetFields(ch, derive(ch)).text.Licenses, 'Won Justice (Fake SIN R4)');
});
