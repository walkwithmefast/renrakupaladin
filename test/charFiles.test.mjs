// The characters folder (electron/charFiles.cjs): naming, renaming, collisions, bad files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const files = createRequire(import.meta.url)('../electron/charFiles.cjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'rp-chars-'));
const ch = (name, extra = {}) => ({ id: 'id-' + name, attrs: {}, pri: {}, info: { name }, ...extra });

test('file name: name, else alias, else "Unnamed runner"; Windows-unsafe characters removed', () => {
  assert.equal(files.baseNameFor(ch('Vesper Ashgrove')), 'Vesper Ashgrove');
  assert.equal(files.baseNameFor({ info: { name: '', alias: 'Torque' } }), 'Torque');
  assert.equal(files.baseNameFor({ info: {} }), 'Unnamed runner');
  assert.equal(files.baseNameFor(ch('Dez "Torque": C/alloway?')), 'Dez Torque C alloway');
  assert.equal(files.baseNameFor(ch('  trailing dots... ')), 'trailing dots');
  assert.equal(files.baseNameFor(ch('CON')), 'CON (character)');
});

test('save creates <Name>.rp.json holding the whole character, and reads back', () => {
  const dir = tmp();
  const c = ch('Vesper', { play: { phys: 2 } });
  assert.equal(files.save(dir, c, null), 'Vesper.rp.json');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'Vesper.rp.json'), 'utf8')), c);
  const { chars, errors } = files.loadAll(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(chars, [{ file: 'Vesper.rp.json', ch: c }]);
});

test('same name twice gets "(2)"; saving again keeps its own file; renaming moves the file', () => {
  const dir = tmp();
  assert.equal(files.save(dir, ch('Bob'), null), 'Bob.rp.json');
  const b2 = { ...ch('Bob'), id: 'other' };
  assert.equal(files.save(dir, b2, null), 'Bob (2).rp.json');
  assert.equal(files.save(dir, b2, 'Bob (2).rp.json'), 'Bob (2).rp.json');
  assert.equal(files.save(dir, { ...b2, info: { name: 'Robert' } }, 'Bob (2).rp.json'), 'Robert.rp.json');
  assert.deepEqual(readdirSync(dir).sort(), ['Bob.rp.json', 'Robert.rp.json']);
});

test('unreadable files are reported, not fatal; other files are ignored; duplicate ids are cleared', () => {
  const dir = tmp();
  files.save(dir, ch('A'), null);
  writeFileSync(join(dir, 'broken.rp.json'), '{ nope');
  writeFileSync(join(dir, 'notes.txt'), 'hi');
  writeFileSync(join(dir, 'A copy.rp.json'), JSON.stringify(ch('A')));
  const { chars, errors } = files.loadAll(dir);
  assert.deepEqual(errors.map((e) => e.file), ['broken.rp.json']);
  assert.equal(chars.length, 2);
  assert.equal(chars.filter((x) => x.ch.id === null).length, 1);
});

test('safeName only accepts plain .rp.json names inside the folder', () => {
  assert.equal(files.safeName('Bob.rp.json'), 'Bob.rp.json');
  assert.equal(files.safeName('../Bob.rp.json'), null);
  assert.equal(files.safeName('C:/x/Bob.rp.json'), null);
  assert.equal(files.safeName('Bob.txt'), null);
});
