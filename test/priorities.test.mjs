// Street Scum stat lines (BCDEE / CCDDE, SR5 core p.354) vs the standard one-of-each-letter priorities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

const { newCharacter, derive } = engine;
const pr = await import('../src/engine/priorities.js');
const act = await import('../src/engine/actions.js');
const letters = (ch) => ['heritage', 'talent', 'attributes', 'skills', 'resources'].map((c) => ch.pri[c]).join('');
const streetWarning = (ch) => derive(ch).warnings.find((w) => /priorities must be/.test(w.msg));

test('stat lines per table', () => {
  assert.deepEqual(pr.priorityLines('Standard'), ['ABCDE']);
  assert.deepEqual(pr.priorityLines('Prime Runner'), ['ABCDE']);
  assert.deepEqual(pr.priorityLines('Street Level'), ['ABCDE'], 'Street Level only changes the nuyen');
  assert.deepEqual(pr.priorityLines('Street Scum'), ['BCDEE', 'CCDDE']);
  assert.equal(pr.hasLineChoice('Street Scum'), true);
  assert.equal(pr.hasLineChoice('Street Level'), false);
  assert.equal(pr.hasLineChoice('Standard'), false);
});

test('switching to Street Scum re-letters the columns to BCDEE, keeping their order', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'D', talent: 'E', attributes: 'A', skills: 'B', resources: 'C' };
  act.setPriorityTable(ch, 'Street Scum');
  assert.equal(ch.priTable, 'Street Scum');
  assert.equal(letters(ch), 'EEBCD'); // A->B, B->C, C->D, D->E, E->E
  assert.equal(streetWarning(ch), undefined);
});

test('choosing the CCDDE line; back to Standard gives one of each letter in the same order', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'D', talent: 'E', attributes: 'A', skills: 'B', resources: 'C' };
  act.setPriorityTable(ch, 'Street Scum');
  act.setPriorityLine(ch, 'CCDDE');
  assert.equal(pr.priorityLineOf(ch.pri), 'CCDDE');
  assert.equal(letters(ch), 'DECCD'); // order: attributes, skills, resources, heritage, talent
  act.setPriorityTable(ch, 'Standard');
  // ties (the two Cs, the two Ds) break by column order: attributes before skills, heritage before resources
  assert.equal(letters(ch), 'CEABD');
});

test('on Street Scum, letters outside the line are refused and a used-up letter swaps', () => {
  const ch = newCharacter();
  act.setPriorityTable(ch, 'Street Scum');
  act.setPriorityLine(ch, 'BCDEE');
  const before = letters(ch);
  act.setPriority(ch, 'heritage', 'A');
  assert.equal(letters(ch), before, 'A is not in BCDEE');
  const eCol = ['heritage', 'talent', 'attributes', 'skills', 'resources'].find((c) => ch.pri[c] === 'E');
  const bCol = ['heritage', 'talent', 'attributes', 'skills', 'resources'].find((c) => ch.pri[c] === 'B');
  act.setPriority(ch, eCol, 'B');
  assert.equal(ch.pri[eCol], 'B');
  assert.equal(ch.pri[bCol], 'E');
  assert.equal(pr.priorityLineOf(ch.pri), 'BCDEE');
});

test('Standard still swaps exactly as before', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'A', talent: 'B', attributes: 'C', skills: 'D', resources: 'E' };
  act.setPriority(ch, 'resources', 'A');
  assert.equal(letters(ch), 'EBCDA');
});

test('an off-line Street Scum character (e.g. imported) gets an error during creation', () => {
  const ch = newCharacter();
  ch.priTable = 'Street Scum';
  ch.pri = { heritage: 'A', talent: 'B', attributes: 'C', skills: 'D', resources: 'E' };
  const w = streetWarning(ch);
  assert.ok(w && w.sev === 'error', 'warned');
  assert.match(w.msg, /B C D E E or C C D D E/);
  assert.equal(pr.letterAllowed(ch.pri, ch.priTable, 'heritage', 'E'), true, 'free to fix it any way');
});

test('Street Scum is offered as a table and uses the Standard resources rows', () => {
  assert.ok(pr.priorityTables().includes('Street Scum'));
  assert.ok(pr.priorityTables().includes('Street Level'));
  for (const L of ['B', 'C', 'D', 'E']) {
    assert.equal(engine.priorityRow('Resources', L, 'Street Scum').resources, engine.priorityRow('Resources', L, 'Standard').resources);
  }
  const ch = newCharacter();
  act.setPriorityTable(ch, 'Street Scum');
  assert.equal(derive(ch).pri.resourceNuyen, Number(engine.priorityRow('Resources', ch.pri.resources, 'Standard').resources));
});

test('Street Level is back to one of each letter (it only changes the nuyen)', () => {
  const ch = newCharacter();
  const before = letters(ch);
  act.setPriorityTable(ch, 'Street Level');
  assert.equal(letters(ch), before);
  act.setPriority(ch, 'heritage', 'A');
  assert.equal(pr.priorityLineOf(ch.pri), 'ABCDE');
});
