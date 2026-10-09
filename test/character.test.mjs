import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive, priorityRow, heritageOptions, talentOptions } = engine;

function setAttrs(ch, pts) { for (const [k, p] of Object.entries(pts)) ch.attrs[k].p = p; }

// SR5 core p.67: Rob's troll street samurai (Attributes A = 24 points)
function rob() {
  const ch = newCharacter();
  ch.metatype = 'Troll';
  ch.pri = { heritage: 'B', talent: 'E', attributes: 'A', skills: 'C', resources: 'D' };
  setAttrs(ch, { BOD: 4, AGI: 3, REA: 2, STR: 6, CHA: 2, INT: 2, LOG: 2, WIL: 3 });
  return ch;
}

test('priority table matches the book (p.65)', () => {
  assert.equal(Number(priorityRow('Attributes', 'A').attributes), 24);
  assert.equal(Number(priorityRow('Attributes', 'E').attributes), 12);
  assert.equal(Number(priorityRow('Skills', 'A').skills), 46);
  assert.equal(Number(priorityRow('Skills', 'A').skillgroups), 10);
  assert.equal(Number(priorityRow('Resources', 'A').resources), 450000);
  assert.equal(Number(priorityRow('Resources', 'E').resources), 6000);
  const b = heritageOptions('B');
  assert.equal(Number(b.find((m) => m.name === 'Troll').value), 0);
  assert.equal(Number(b.find((m) => m.name === 'Human').value), 7);
  const a = heritageOptions('A');
  assert.equal(Number(a.find((m) => m.name === 'Human').value), 9);
  assert.ok(talentOptions('A').some((t) => t.value === 'Magician' && t.magic === '6' && t.spells === '10'));
});

test("Rob the troll: attribute totals, limits and monitors match the book (p.100-102)", () => {
  const d = derive(rob());
  assert.equal(d.attr.BOD.total, 9);
  assert.equal(d.attr.STR.total, 11);  // 5 + 6 (requires Exceptional Attribute in the book)
  assert.equal(d.attr.AGI.total, 4);
  assert.equal(d.pri.attrPtsTotal, 24);
  assert.equal(d.used.attrPts, 24);
  assert.equal(d.limits.mental, 5);
  assert.equal(d.limits.physical, 12);
  assert.equal(d.limits.social, 6);
  assert.equal(d.init.base, 6);
  assert.equal(d.init.dice, 1);
  assert.equal(d.cm.physical, 13);
  assert.equal(d.cm.stun, 10);
  assert.equal(d.cm.overflow, 9);
});

test('Troll gets Thermographic Vision and +1 Reach / +1 armor from the metatype', () => {
  const d = derive(rob());
  assert.ok(d.qualities.some((q) => q.name === 'Thermographic Vision' && q.auto));
  assert.equal(d.armor.bonus, 1);
});

test("Kyra the elf: limits and monitors match the book", () => {
  const ch = newCharacter();
  ch.metatype = 'Elf';
  ch.pri = { heritage: 'D', talent: 'A', attributes: 'B', skills: 'C', resources: 'E' };
  ch.talent = 'Magician';
  // Body 3 Agi 6 Rea 3 Str 2 Cha 6 Int 4 Log 3 Wil 4 with elf minimums (agi 2, cha 3)
  setAttrs(ch, { BOD: 2, AGI: 4, REA: 2, STR: 1, CHA: 3, INT: 3, LOG: 2, WIL: 3 });
  const d = derive(ch);
  assert.equal(d.attr.CHA.total, 6);
  assert.equal(d.attr.AGI.total, 6);
  assert.equal(d.attr.MAG.total, 6);
  assert.equal(d.limits.mental, 5);
  assert.equal(d.limits.physical, 4);
  assert.equal(d.limits.social, 8);
  assert.equal(d.cm.physical, 10);
  assert.equal(d.used.attrPts, 20);
  assert.equal(d.pri.attrPtsTotal, 20);
});

test('essence loss reduces Magic by 1 per fraction lost (p.97, p.278)', () => {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'A', attributes: 'A', skills: 'C', resources: 'D' };
  ch.talent = 'Magician';
  const before = derive(ch);
  assert.equal(before.attr.MAG.total, 6);
  ch.cyberware.push({ uid: 'x', name: 'Cybereyes Basic System', rating: 1, grade: 'Standard' });
  const eyes = dataMod.idx('cyberware', 'cyberwares').byName.get('cybereyes basic system');
  assert.ok(eyes, 'cybereyes found in data');
  const d = derive(ch);
  assert.equal(d.essence, 5.8);
  assert.equal(d.attr.MAG.total, 5);
  assert.equal(d.magLoss, 1);
});

test('karma budget: 25 base, negative qualities add up to 25, positive cost', () => {
  const ch = newCharacter();
  let d = derive(ch);
  assert.equal(d.karma.total, 25);
  assert.equal(d.karma.left, 25);
  const q = dataMod.idx('qualities', 'qualities').byName;
  ch.qualities.push({ uid: 'a', name: q.get('ambidextrous').name });
  d = derive(ch);
  assert.equal(d.karma.left, 21);
});

test('skill karma costs follow 2 x new rating; groups 5 x new rating', () => {
  const ch = newCharacter();
  const skill = dataMod.idx('skills', 'skills').byName.get('archery');
  ch.skills[skill.id] = { p: 0, k: 3, a: 0 };
  let d = derive(ch);
  assert.equal(d.skills.find((s) => s.name === 'Archery').rating, 3);
  assert.equal(d.karma.spent.skills, 2 + 4 + 6);
  ch.groups['Firearms'] = { p: 0, k: 2, a: 0 };
  d = derive(ch);
  assert.equal(d.karma.spent.skills, 12 + 5 + 10);
});

test('attribute karma: new rating x 5', () => {
  const ch = newCharacter();
  ch.attrs.AGI = { p: 0, k: 2, a: 0 }; // 1 -> 3 : 10 + 15
  const d = derive(ch);
  assert.equal(d.karma.spent.attributes, 25);
});

test('knowledge points come from (INT+LOG)*2 and overflow eats skill points', () => {
  const ch = newCharacter();
  ch.attrs.INT.p = 2; ch.attrs.LOG.p = 2; // INT 3, LOG 3 -> 12 free
  ch.know.push({ uid: 'k1', name: 'Seattle', cat: 'Street', p: 14, k: 0, a: 0 });
  const d = derive(ch);
  assert.equal(d.used.knowPool, 12);
  assert.equal(d.used.knowOverflow, 2);
});

test('vehicle modifications add to the vehicle\'s cost and availability, like weapon/armor mods do', () => {
  const vdef = dataMod.idx('vehicles', 'vehicles').list.find((v) => Number(v.cost) > 0);
  const mod = dataMod.idx('vehicles', 'mods').list.find((m) => Number(m.cost) > 0 && !m.required);
  const ch = newCharacter();
  ch.vehicles.push({ uid: 'v1', id: vdef.id, name: vdef.name, mods: [] });
  const bare = derive(ch).items.vehicles.find((e) => e.it.uid === 'v1').cost;
  ch.vehicles[0].mods.push({ id: mod.id, rating: 1 });
  const withMod = derive(ch).items.vehicles.find((e) => e.it.uid === 'v1').cost;
  assert.ok(withMod > bare, `expected ${withMod} > ${bare}`);
});

test('data sanity: all core sections load', () => {
  for (const [file, sec, min] of [['gear', 'gears', 1000], ['weapons', 'weapons', 300], ['qualities', 'qualities', 500], ['spells', 'spells', 300], ['cyberware', 'cyberwares', 200]]) {
    assert.ok(dataMod.idx(file, sec).list.length >= min, `${file}.${sec}`);
  }
});
