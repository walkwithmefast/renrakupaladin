// Managing a character during sessions: the money/Karma ledger (engine/money.js) and custom items (engine/custom.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const money = await import('../src/engine/money.js');
const custom = await import('../src/engine/custom.js');
const { weaponStats } = await import('../src/engine/weapons.js');

function careerChar() {
  const ch = newCharacter();
  ch.mode = 'career';
  ch.career = { earned: 0, log: [], nuyenEarned: 0 };
  ch.nuyenAdjust = 1000;
  return ch;
}

test('earning, spending and Karma go through the ledger and the totals', () => {
  const ch = careerChar();
  const n0 = derive(ch).nuyen.left;
  money.addEntry(ch, 'nuyen', 5000, 'Run payment');
  money.addEntry(ch, 'nuyen', -300, 'Bribe');
  money.addEntry(ch, 'karma', 4, 'Session');
  const d = derive(ch);
  assert.equal(d.nuyen.left, n0 + 4700);
  assert.equal(d.karma.left, 4);
  assert.deepEqual(ch.career.log.map((e) => [e.kind, e.amt, e.note]), [['nuyen', 5000, 'Run payment'], ['nuyen', -300, 'Bribe'], ['karma', 4, 'Session']]);
  assert.equal(money.entryAmount(ch.career.log[1], (n) => `${n}¥`), '−300¥');
});

test('undo reverses an entry', () => {
  const ch = careerChar();
  const n0 = derive(ch).nuyen.left;
  const e = money.addEntry(ch, 'nuyen', 5000, 'typo');
  money.undoEntry(ch, e.t);
  assert.equal(derive(ch).nuyen.left, n0);
  assert.equal(ch.career.log.length, 0);
});

test('paying rent adds a month to each lifestyle (so derive charges it) and can be undone', () => {
  const ch = careerChar();
  const med = idx('lifestyles', 'lifestyles').list.find((l) => l.name === 'Medium');
  ch.lifestyles.push({ uid: 'l1', id: med.id, name: med.name, months: 1 });
  const d0 = derive(ch);
  const rent = money.monthlyRent(d0);
  assert.equal(rent, 5000);
  const e = money.payRent(ch, d0);
  assert.equal(ch.lifestyles[0].months, 2);
  assert.equal(derive(ch).nuyen.left, d0.nuyen.left - 5000);
  assert.equal(e.amt, -5000);
  money.undoEntry(ch, e.t);
  assert.equal(ch.lifestyles[0].months, 1);
  assert.equal(derive(ch).nuyen.left, d0.nuyen.left);
});

test('a custom weapon works like a catalogue one: stats, skill, attack pool', () => {
  const ch = newCharacter();
  const it = custom.newCustomItem('weapons', { name: 'Prototype Ares', category: 'Heavy Pistols', type: 'Ranged', damage: '9P', ap: '-2', accuracy: '6', mode: 'SA', ammo: '12(c)' });
  ch.weapons.push(it);
  const d = derive(ch);
  const e = d.items.weapons[0];
  assert.equal(e.def.name, 'Prototype Ares');
  assert.equal(e.cost, 0, 'a GM gift by default');
  const st = weaponStats(e.def, d, e.it);
  assert.equal(st.dmg, '9P');
  assert.equal(String(st.accuracy), '6');
  assert.equal(st.skillName, 'Pistols');
});

test('custom armor, cyberware (Essence + attribute bonus) and a custom drone', () => {
  const ch = newCharacter();
  ch.armor.push(custom.newCustomItem('armor', { name: 'Dragon-scale coat', armor: '14' }));
  ch.cyberware.push(custom.newCustomItem('cyberware', { name: 'Experimental reflex booster', ess: '1.5', attrs: [{ attr: 'REA', val: 2 }] }));
  ch.vehicles.push(custom.newCustomItem('vehicles', { name: 'Salvaged roto', drone: true, category: 'Medium', body: '4', armor: '6', pilot: '3', handling: '4', sensor: '3' }));
  const d = derive(ch);
  assert.equal(d.armor.total, 14);
  assert.equal(d.essence, 4.5);
  assert.equal(d.attr.REA.total, 1 + 2);
  const v = d.items.vehicles[0];
  assert.equal(v.stats.stats.armor, 6);
  assert.match(v.def.category, /^Drones/);
});

test('editing a custom item, and paying for one', () => {
  const ch = newCharacter();
  const it = custom.newCustomItem('gear', { name: 'Odd trinket', paid: true, cost: 750 });
  ch.gear.push(it);
  assert.equal(derive(ch).items.gear[0].cost, 750);
  custom.editCustomItem(ch.gear[0], { ...custom.customForm(ch.gear[0]), name: 'Cursed trinket', paid: false });
  const g = derive(ch).items.gear[0];
  assert.equal(g.def.name, 'Cursed trinket');
  assert.equal(g.cost, 0);
});

test('selling credits what you got, not the full price; undo puts it back', () => {
  const ch = careerChar();
  const jacket = idx('armor', 'armors').list.find((a) => a.name === 'Armor Jacket');
  ch.armor.push({ uid: 'a1', id: jacket.id, name: jacket.name });
  const d0 = derive(ch);
  const left0 = d0.nuyen.left; // the jacket's 1,000 is already spent
  const e = money.sellItem(ch, d0, 'armor', 'a1', 400);
  assert.equal(ch.armor.length, 0);
  assert.equal(derive(ch).nuyen.left, left0 + 400, 'got 400 back, not the 1,000 list price');
  assert.equal(e.note, 'Sold Armor Jacket');
  money.undoEntry(ch, e.t);
  assert.equal(ch.armor.length, 1);
  assert.equal(derive(ch).nuyen.left, left0);
});

test('deleting keeps the money spent; gear takes its bundled parts with it; undo restores all', () => {
  const ch = careerChar();
  const link = idx('gear', 'gears').list.find((g) => g.category === 'Commlinks' && g.name === 'Meta Link');
  const kid = idx('gear', 'gears').list.find((g) => g.category === 'Tools');
  ch.gear.push({ uid: 'g1', id: link.id, name: link.name }, { uid: 'g2', id: kid.id, name: kid.name, parent: 'g1', child: true, free: true });
  const d0 = derive(ch);
  const e = money.discardItem(ch, d0, 'gear', 'g1');
  assert.equal(ch.gear.length, 0, 'the bundled part went too');
  assert.equal(derive(ch).nuyen.left, d0.nuyen.left, 'no refund');
  assert.equal(money.entryAmount(e, (n) => n), 'Deleted');
  money.undoEntry(ch, e.t);
  assert.deepEqual(ch.gear.map((g) => g.uid).sort(), ['g1', 'g2']);
  assert.equal(derive(ch).nuyen.left, d0.nuyen.left);
});

test('custom qualities: Karma as entered (not doubled), positive limit, attribute bonus, negative gives Karma', () => {
  const ch = newCharacter();
  ch.qualities.push(custom.newCustomQuality({ name: 'Marked by the Dragon', category: 'Positive', karma: 7, attrs: [{ attr: 'CHA', val: 1 }], description: 'Dragons notice you.' }, false));
  ch.qualities.push(custom.newCustomQuality({ name: 'Hunted', category: 'Negative', karma: 10 }, false));
  const d = derive(ch);
  const pos = d.qualities.find((q) => q.name === 'Marked by the Dragon');
  const neg = d.qualities.find((q) => q.name === 'Hunted');
  assert.equal(pos.karma, 7);
  assert.equal(pos.def.category, 'Positive');
  assert.equal(neg.karma, -10);
  assert.equal(d.attr.CHA.total, 2);
  assert.equal(d.karma.pos, 7);
  // bought after creation: the entered cost stands
  const car = careerChar();
  car.qualities.push(custom.newCustomQuality({ name: 'Gift', category: 'Positive', karma: 5 }, true));
  assert.equal(derive(car).qualities.find((q) => q.name === 'Gift').karma, 5);
  // edit in place
  custom.editCustomQuality(ch.qualities[0], { ...custom.customQualityForm(ch.qualities[0]), karma: 3 });
  assert.equal(derive(ch).qualities.find((q) => q.name === 'Marked by the Dragon').karma, 3);
});

test('ledger entries made in the same millisecond still get distinct ids, and undo removes the right one', () => {
  const ch = careerChar();
  const a = money.addEntry(ch, 'nuyen', 100, 'a');
  const b = money.addEntry(ch, 'nuyen', 200, 'b');
  assert.notEqual(a.t, b.t);
  money.undoEntry(ch, b.t);
  assert.deepEqual(ch.career.log.map((e) => e.note), ['a']);
  assert.equal(ch.career.nuyenEarned, 100);
});

test('older Karma entries without a kind (creation carry-over, sidebar award) read and undo as Karma', () => {
  const ch = careerChar();
  ch.career.earned = 7;
  ch.career.log = [{ t: 1, amt: 7, note: 'Carried over from creation' }];
  assert.equal(money.entryAmount(ch.career.log[0], (n) => `${n}¥`), '+7 Karma');
  money.undoEntry(ch, 1);
  assert.equal(ch.career.earned, 0);
});
