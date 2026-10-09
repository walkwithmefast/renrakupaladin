import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { sheetFields } = await import('../src/engine/pdfExport.js');

function rob() {
  const ch = newCharacter();
  ch.info.name = 'Rob';
  ch.info.alias = 'The Fixer';
  ch.metatype = 'Troll';
  ch.pri = { heritage: 'B', talent: 'E', attributes: 'A', skills: 'C', resources: 'D' };
  ch.attrs.BOD.p = 4; ch.attrs.AGI.p = 3; ch.attrs.REA.p = 2; ch.attrs.STR.p = 6;
  ch.attrs.CHA.p = 2; ch.attrs.INT.p = 2; ch.attrs.LOG.p = 2; ch.attrs.WIL.p = 3;
  return ch;
}

test('sheetFields: header/bio fields map from ch.info', () => {
  const ch = rob();
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.equal(text['CHARACTER'], 'Rob');
  assert.equal(text['Name/Alias'], 'The Fixer');
  assert.equal(text['Metatype'], 'Troll');
});

test('sheetFields: attributes come from d.attr totals', () => {
  const ch = rob();
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.equal(text['Body'], String(d.attr.BOD.total));
  assert.equal(text['Strength'], String(d.attr.STR.total));
  assert.equal(text['Essence'], '6.00');
});

test('sheetFields: MagicResonance is left out for a mundane character', () => {
  const ch = rob();
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.equal(text['MagicResonance'], undefined);
});

test('sheetFields: MagicResonance fills from Magic when a magician', () => {
  const ch = newCharacter();
  ch.pri.talent = 'A';
  ch.talent = 'Magician';
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.equal(text['MagicResonance'], String(d.attr.MAG.total));
});

test('sheetFields: condition monitor checkboxes reflect current play-state damage, not track capacity', () => {
  const ch = rob();
  ch.play = { phys: 3, stun: 5, overflow: 1 };
  const d = derive(ch);
  const { check, text } = sheetFields(ch, d);
  assert.equal(check['Physical DMG1'], true);
  assert.equal(check['Physical DMG3'], true);
  assert.equal(check['Physical DMG4'], undefined);
  assert.equal(check['Stun DMG5'], true);
  assert.equal(check['Stun DMG'], undefined); // box #7, only ticked at 7+ stun damage
  assert.equal(text['Overflow'], '1');
});

test('sheetFields: the 7th stun box is the oddly-named "Stun DMG" field', () => {
  const ch = rob();
  ch.play = { phys: 0, stun: 7, overflow: 0 };
  const d = derive(ch);
  const { check } = sheetFields(ch, d);
  assert.equal(check['Stun DMG6'], true);
  assert.equal(check['Stun DMG'], true);
  assert.equal(check['Stun DMG8'], undefined);
});

test('sheetFields: Edge Pts checkboxes match the Edge attribute rating', () => {
  const ch = rob();
  const d = derive(ch);
  const { check } = sheetFields(ch, d);
  const ticked = Object.keys(check).filter((k) => k.startsWith('Edge Pts.')).length;
  assert.equal(ticked, d.attr.EDG.total);
});

test('sheetFields: ranked skills fill the two-column grid, unranked skills are skipped', () => {
  const ch = rob();
  const pistols = idx('skills', 'skills').byName.get('pistols');
  ch.skills[pistols.id] = { p: 3, k: 0, a: 0, spec: '' };
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  const found = Object.entries(text).find(([k, v]) => k.startsWith('Skill.') && v === 'Pistols');
  assert.ok(found, 'Pistols should appear somewhere in the skill grid');
  const [key] = found;
  const [, row, col] = key.split('.');
  assert.equal(text[`Rating.${row}.${col}`], String(pistols_rating(d)));
  function pistols_rating(d) { return d.skills.find((s) => s.name === 'Pistols').rating; }
});

test('sheetFields: a weapon with an accessory shows its modified stats, not the base ones', () => {
  const ch = rob();
  const gun = idx('weapons', 'weapons').byName.get('colt m23');
  const smartgun = idx('weapons', 'accessories').list.find((a) => a.name === 'Smartgun System, Internal');
  ch.weapons.push({ uid: 'w1', id: gun.id, name: gun.name, mods: [{ id: smartgun.id, rating: 1 }] });
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.equal(text['Ranged Weapon.0'], gun.name);
  assert.equal(Number(text['Ranged Acc.0']), Number(gun.accuracy) + 2);
});

test('sheetFields: an unarmed/mundane character has no MagicResonance and no spells', () => {
  const ch = rob();
  const d = derive(ch);
  const { text } = sheetFields(ch, d);
  assert.ok(!Object.keys(text).some((k) => k.startsWith('Spell.')));
});

test('sheetFields: never throws on a completely blank fresh character', () => {
  const ch = newCharacter();
  const d = derive(ch);
  assert.doesNotThrow(() => sheetFields(ch, d));
});
