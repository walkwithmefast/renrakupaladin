import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { totalGradeKarma, totalMetamagicKarma, INITIATION_PAGE, SUBMERSION_PAGE, metamagicDef, metamagicDefById } = await import('../src/engine/metamagic.js');
const { resolveInspect, describeItem } = await import('../src/engine/describe.js');

const R = { initiationKarma: 3, initiationFlat: 10, metamagicKarma: 15 };

test('totalGradeKarma: grade 0 costs nothing', () => {
  assert.equal(totalGradeKarma(R, 0), 0);
});

test('totalGradeKarma: grade 1 costs 1*3+10', () => {
  assert.equal(totalGradeKarma(R, 1), 13);
});

test('totalGradeKarma: grade 2 is cumulative (grade 1 + grade 2 steps)', () => {
  // step 1: 1*3+10=13, step 2: 2*3+10=16, total 29
  assert.equal(totalGradeKarma(R, 2), 13 + 16);
});

test('totalMetamagicKarma: each grade includes one technique (SR5 p.325); only extras cost metamagicKarma', () => {
  assert.equal(totalMetamagicKarma(R, 1, 1), 13);
  assert.equal(totalMetamagicKarma(R, 2, 1), 13 + 16);
  assert.equal(totalMetamagicKarma(R, 1, 3), 13 + 2 * 15);
  assert.equal(totalMetamagicKarma(R, 0, 0), 0);
});

test('page constants point at the Initiation/Submersion sections', () => {
  assert.equal(INITIATION_PAGE, 326);
  assert.equal(SUBMERSION_PAGE, 258);
});

// ---- wired into derive() -----------------------------------------------------------------------
test('an initiated character with metamagics spends real Karma for it', () => {
  const ch = newCharacter();
  ch.initGrade = 2;
  ch.metamagics = [{ uid: 'a', name: 'Centering' }];
  const d = derive(ch);
  const expected = totalMetamagicKarma(d.R, 2, 1);
  assert.equal(d.karma.spent.initiation, expected);
});

test('metamagics known above the current grade raise a warning', () => {
  const ch = newCharacter();
  ch.initGrade = 1;
  ch.metamagics = [{ uid: 'a', name: 'Centering' }, { uid: 'b', name: 'Masking' }];
  const d = derive(ch);
  assert.ok(d.warnings.some((w) => /metamagic/i.test(w.msg) && /grade/i.test(w.msg)), JSON.stringify(d.warnings));
});

test('an ungraded character (0/0) costs and warns nothing', () => {
  const ch = newCharacter();
  const d = derive(ch);
  assert.equal(d.karma.spent.initiation, 0);
  assert.ok(!d.warnings.some((w) => /metamagic/i.test(w.msg)));
});

// ---- Inspector wiring (there is no single "metamagics" catalogue - metamagic / Art / power enhancement / echo
// are four different files, disambiguated by the owned entry's `.kind`; used to have no drawer popup at all) ----
test('metamagicDef resolves an owned entry through its .kind, across all four catalogues', () => {
  const metamagic = idx('metamagic', 'metamagics').list[0];
  const art = idx('metamagic', 'arts').list[0];
  const enh = idx('powers', 'enhancements').list[0];
  const echo = idx('echoes', 'echoes').list[0];
  assert.equal(metamagicDef({ name: metamagic.name, kind: 'metamagic' }).id, metamagic.id);
  assert.equal(metamagicDef({ name: art.name, kind: 'art' }).id, art.id);
  assert.equal(metamagicDef({ name: enh.name, kind: 'enhancement' }).id, enh.id);
  assert.equal(metamagicDef({ name: echo.name, kind: 'echo' }).id, echo.id);
  assert.equal(metamagicDef({ name: 'nope', kind: 'bogus' }), null);
});

test('metamagicDefById finds the right catalogue and kind by id alone (the Picker only passes an id)', () => {
  const enh = idx('powers', 'enhancements').list.find((e) => e.power);
  const hit = metamagicDefById(enh.id);
  assert.equal(hit.kind, 'enhancement');
  assert.equal(hit.def.id, enh.id);
});

test('resolveInspect + describeItem: an owned metamagic/Art/enhancement/echo now has a real drawer view', () => {
  const enh = idx('powers', 'enhancements').list.find((e) => e.power);
  const ch = newCharacter();
  ch.metamagics = [{ uid: 'm1', name: enh.name, kind: 'enhancement' }];
  const d = derive(ch);
  const found = resolveInspect(ch, 'metamagics', { uid: 'm1' });
  assert.ok(found, 'used to return null - no case for "metamagics" in itemDef()');
  const info = describeItem('metamagics', found.def, found.it, d);
  assert.equal(info.title, enh.name);
  assert.equal(info.sub, 'Power enhancement');
  assert.deepEqual(info.stats.find(([k]) => k === 'Enhances'), ['Enhances', [].concat(enh.power).join(', ')]);
  // and the un-owned Picker-row view (only an id, no owned entry) resolves the same way
  const catFound = resolveInspect(ch, 'metamagics', { id: enh.id });
  assert.equal(catFound.def.id, enh.id);
});
