// Name families (src/engine/families.js): "Area Knowledge: Seattle", "Allergy (Uncommon, Mild)", ...
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataMod } from './helpers.mjs';

const { splitName, joinName, groupFamilies, familyFor } = await import('../src/engine/families.js');
const { idx, arr, D } = dataMod;

test('splitName / joinName', () => {
  assert.deepEqual(splitName('Area Knowledge: Seattle'), { base: 'Area Knowledge', desc: 'Seattle', sep: 'colon' });
  assert.deepEqual(splitName('Allergy (Uncommon, Mild)'), { base: 'Allergy', desc: 'Uncommon, Mild', sep: 'paren' });
  assert.deepEqual(splitName('Infected: Ghoul (Human)'), { base: 'Infected: Ghoul', desc: 'Human', sep: 'paren' }, 'parenthesis wins');
  assert.equal(splitName('Ambidextrous'), null);
  assert.equal(joinName('Area Knowledge', 'Boston'), 'Area Knowledge: Boston');
  assert.equal(joinName('Allergy', 'Common, Severe', 'paren'), 'Allergy (Common, Severe)');
  assert.equal(joinName('Area Knowledge', '  '), 'Area Knowledge', 'no descriptor -> just the base');
});

test('knowledge skills: Area Knowledge and Corporation become one suggestion each', () => {
  const list = arr(D.skills.knowledgeskills);
  const { families, rows } = groupFamilies(list);
  assert.ok(families.get('Area Knowledge').variants.length >= 10);
  assert.ok(families.get('Corporation').variants.some((v) => v.desc === 'Ares Macrotechnology'));
  assert.equal(rows.filter((r) => r.family && r.family.base === 'Corporation').length, 1);
  assert.equal(rows.length, list.length - [...families.values()].reduce((s, f) => s + f.variants.length - 1, 0));
});

test('qualities: each family keeps its real variants (own Karma, own id)', () => {
  const pos = idx('qualities', 'qualities').list.filter((q) => q.category === 'Positive');
  const neg = idx('qualities', 'qualities').list.filter((q) => q.category === 'Negative');
  const p = groupFamilies(pos);
  const n = groupFamilies(neg);
  const fis = p.families.get('Free Insect Spirit');
  assert.equal(fis.variants.length, 25);
  assert.ok(fis.variants.find((v) => v.desc === 'Bee').def.id);
  const allergy = n.families.get('Allergy');
  assert.ok(new Set(allergy.variants.map((v) => v.def.karma)).size > 1, 'variants differ in Karma');
  assert.equal(familyFor('Allergy (Common, Severe)', n.families), allergy);
  assert.equal(familyFor('Ambidextrous', p.families), null);
  // Ghoul variants form their own family instead of being lumped into "Infected"
  assert.ok(p.families.get('Infected: Ghoul').variants.every((v) => v.def.name.startsWith('Infected: Ghoul (')));
  assert.ok(!p.families.get('Infected').variants.some((v) => v.def.name.startsWith('Infected: Ghoul')));
});

test('a plain entry named like its family base joins the family as the standard variant', () => {
  const list = [{ id: 'a', name: 'Rank' }, { id: 'b', name: 'Rank (1)' }, { id: 'c', name: 'Rank (2)' }, { id: 'd', name: 'Other' }];
  const { families, rows } = groupFamilies(list);
  assert.deepEqual(families.get('Rank').variants.map((v) => v.desc), ['', '1', '2']);
  assert.deepEqual(rows.map((r) => (r.family ? `fam:${r.family.base}` : r.def.name)), ['fam:Rank', 'Other']);
});
