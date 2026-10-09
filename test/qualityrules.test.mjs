// v27: Adept Ways (Street Grimoire p.176-178), aspect-style spell / spirit restrictions (Forbidden Arcana p.43-47),
// Infected & drake optional powers, and the one-off qualities (engine/qualityRules.js + derive()).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const rules = await import('../src/engine/qualityRules.js');
const { unavailabilityChecker } = await import('../src/engine/purchasable.js');
const { weaponStats } = await import('../src/engine/weapons.js');

const Q = (n) => { const q = idx('qualities', 'qualities').list.find((x) => x.name === n); assert.ok(q, n); return q; };
const withQ = (ch, n, extra = {}) => { const q = Q(n); ch.qualities.push({ uid: `q${ch.qualities.length}`, id: q.id, name: q.name, choice: {}, note: '', ...extra }); return ch; };
const power = (n) => idx('powers', 'powers').list.find((p) => p.name === n);
const gear = (n) => idx('gear', 'gears').list.find((g) => g.name === n && !g.hide);
const skillId = (n) => idx('skills', 'skills').list.find((s) => s.name === n).id;
const warned = (d, re) => d.warnings.some((w) => re.test(w.msg));
function adept(mag = 'B') {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: mag, attributes: 'A', skills: 'C', resources: 'D' };
  ch.talent = 'Adept';
  return ch;
}
function mage() {
  const ch = newCharacter();
  ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
  ch.talent = 'Magician';
  ch.tradition = 'Hermetic';
  return ch;
}

test("Ways: half cost on one level of a listed power per 2 Magic; free Mentor Spirit; -2 Karma to bond; Burnout's alphaware", () => {
  const ch = withQ(adept(), "The Warrior's Way");
  const cs = power('Critical Strike'); // 0.5 PP, on the Warrior's list
  ch.powers.push({ uid: 'p1', id: cs.id, name: cs.name, level: 1, choice: { skill: 'Blades' }, wayDiscount: true });
  let d = derive(ch);
  assert.equal(d.way.name, "The Warrior's Way");
  assert.equal(d.way.slots, Math.floor(d.attr.MAG.total / 2));
  assert.equal(d.magic.ppUsed, 0.25);
  const ir = power('Analytics'); // not on the Warrior's list
  ch.powers.push({ uid: 'p2', id: ir.id, name: ir.name, level: 1, wayDiscount: true });
  assert.ok(warned(derive(ch), /isn't on The Warrior's Way's list/));
  // Warrior's Way: bonding a weapon focus costs 2 Karma less
  ch.gear.push({ uid: 'wf', id: gear('Weapon Focus').id, name: 'Weapon Focus', rating: 2, bonded: true });
  d = derive(ch);
  assert.equal(d.magic.fociKarma, 2 * 3 - 2);
  // the Spiritual Way: Mentor Spirit is free
  const sp = withQ(adept(), 'The Spiritual Way');
  withQ(sp, 'Mentor Spirit');
  assert.equal(derive(sp).qualities.find((q) => q.name === 'Mentor Spirit').karma, 0);
  // Burnout's Way: standard-grade Essence x0.8
  const bo = adept();
  const cw = idx('cyberware', 'cyberwares').list.find((c) => c.name === 'Datajack');
  bo.cyberware.push({ uid: 'c', id: cw.id, name: cw.name, grade: 'Standard' });
  const plain = 6 - derive(bo).essence;
  withQ(bo, "The Burnout's Way");
  assert.equal(Math.round((6 - derive(bo).essence) * 100), Math.round(plain * 0.8 * 100));
});

test('Hedge Witch / Elementalist / Apprentice: spells and spirits limited to the pick', () => {
  const ch = withQ(mage(), 'Hedge Witch/Wizard', { choice: { category: 'Combat' } });
  const heal = idx('spells', 'spells').list.find((s) => s.name === 'Heal');
  const bolt = idx('spells', 'spells').list.find((s) => s.name === 'Manabolt');
  const why = unavailabilityChecker('spells', ch, derive(ch));
  assert.equal(why(heal), 'Hedge Witch/Wizard: only Combat spells');
  assert.equal(why(bolt), null);
  ch.spells.push({ uid: 's', id: heal.id, name: heal.name });
  assert.ok(warned(derive(ch), /Heal: Hedge Witch\/Wizard can only use Combat spells/));
  // Elementalist (Fire) for a Hermetic: Fire spirits are the Combat spirits -> Combat spells, Spirit of Fire only
  const el = withQ(mage(), 'Elementalist (Fire)');
  const lim = derive(el).magicLimits[0];
  assert.deepEqual([lim.spellCats, lim.spirits], [['Combat'], ['Spirit of Fire']]);
  // Apprentice without picks is told to pick
  assert.ok(warned(derive(withQ(mage(), 'Apprentice')), /Apprentice: pick the spell category/));
});

test('Infected / drake optional powers: the type\'s list with Karma, bought powers cost Karma', () => {
  const ch = withQ(newCharacter(), 'Infected: Goblin');
  const d = derive(ch);
  const choices = rules.optionalPowerChoices(d.qualities);
  const smell = choices.find((c) => c.name === 'Enhanced Senses' && c.select === 'Smell');
  assert.ok(smell && smell.karma === 3, JSON.stringify(choices.slice(0, 3).map((c) => [c.name, c.select, c.karma])));
  assert.ok(choices.some((c) => c.def.category === 'Infected' && c.karma > 0), 'Dark Terrors advanced powers with their Karma');
  const before = d.karma.spent.critterPowers;
  ch.critterPowers.push({ uid: 'o', id: smell.def.id, name: smell.name, extra: 'Smell', karma: 3, bought: true });
  assert.equal(derive(ch).karma.spent.critterPowers, before + 3);
  const drake = withQ(newCharacter(), 'Dracoform (Western Drake)');
  assert.ok(rules.optionalPowerChoices(derive(drake).qualities).some((c) => c.name === 'Flight' && c.karma === 14));
});

test('career skill costs: Linguist -1 per rank from 3, Jack of All Trades -1 up to 5 / +2 above; Uneducated, Incompetent', () => {
  assert.equal(rules.adjustedStepCost(2, 2, 1, [{ val: -1, min: 3 }]), (3 - 1) + (4 - 1));
  assert.equal(rules.adjustedStepCost(4, 2, 2, [{ val: -1, max: 5 }, { val: 2, min: 6 }]), (10 - 1) + (12 + 2));
  const ch = withQ(newCharacter(), 'Jack of All Trades Master of None');
  ch.mode = 'career';
  ch.career = { earned: 100, log: [] };
  ch.skills[skillId('Pistols')] = { p: 0, k: 0, a: 2, spec: '' }; // 0 -> 2 in career: rank x 2 Karma each, -1 each
  assert.equal(derive(ch).skills.find((s) => s.name === 'Pistols').aCost, (1 * 2 - 1) + (2 * 2 - 1));
  const un = withQ(newCharacter(), 'Uneducated');
  assert.equal(derive(un).skills.find((s) => s.name === 'Hardware').defaultable, false);
  const inc = withQ(newCharacter(), 'Incompetent', { choice: { group: 'Firearms' } });
  assert.equal(derive(inc).skills.find((s) => s.name === 'Pistols').pool, 0);
});

test('one-offs: Spellslinger, Friends in High Places, Erased, Dealer Connection, Restricted Gear, Redliner, Empathic Listener, Bilingual', () => {
  const sl = withQ(mage(), 'Dedicated Spellslinger');
  sl.skills[skillId('Spellcasting')] = { p: 4, k: 0, a: 0, spec: '' };
  const dsl = derive(sl);
  assert.equal(dsl.magic.spellFree, derive(mage()).magic.spellFree + 4);
  assert.equal(dsl.magic.spellCost, 4);
  const fh = withQ(newCharacter(), 'Friends in High Places');
  fh.attrs.CHA.p = 2; // CHA 3: 12 more Karma for Connection 8+ contacts, 9 for the rest
  fh.contacts.push({ uid: 'c', name: 'Exec', connection: 8, loyalty: 1 });
  assert.equal(derive(fh).contacts.paid, 0, 'CHA x 4 covers a Connection 8 contact');
  const er = withQ(newCharacter(), 'Erased');
  er.reputationAdj = { publicAwareness: 5 };
  er.lifestyles.push({ uid: 'l', id: idx('lifestyles', 'lifestyles').byName.get('high').id, name: 'High', months: 1 });
  const der = derive(er);
  assert.equal(der.reputation.publicAwareness, 1);
  assert.ok(warned(der, /Erased character can't keep a lifestyle above Middle/));
  const dc = withQ(newCharacter(), 'Dealer Connection', { choice: { classes: ['Drones'] } });
  const drone = idx('vehicles', 'vehicles').list.find((v) => /^Drones/.test(v.category) && Number(v.cost) > 1000);
  dc.vehicles.push({ uid: 'v', id: drone.id, name: drone.name });
  assert.equal(derive(dc).items.vehicles[0].cost, Math.round(Number(drone.cost) * 0.9));
  const rg = withQ(newCharacter(), 'Restricted Gear');
  const hot = idx('weapons', 'weapons').list.find((w) => parseInt(w.avail, 10) > 12 && parseInt(w.avail, 10) <= 24);
  rg.weapons.push({ uid: 'w', id: hot.id, name: hot.name });
  assert.ok(!warned(derive(rg), /Availability/), 'one item up to 24 allowed');
  const el = withQ(newCharacter(), 'Empathic Listener');
  assert.equal(derive(el).skills.find((s) => s.name === 'Etiquette').attr, 'INT');
  const bl = newCharacter();
  bl.know.push({ uid: 'a', name: 'English', cat: 'Language', native: true, p: 0, k: 0, a: 0 }, { uid: 'b', name: 'Japanese', cat: 'Language', native: true, p: 0, k: 0, a: 0 });
  assert.ok(warned(derive(bl), /native languages/));
  assert.ok(!warned(derive(withQ(bl, 'Bilingual')), /native languages/));
  const rl = withQ(newCharacter(), 'Redliner');
  const arm = idx('cyberware', 'cyberwares').list.find((c) => c.name === 'Obvious Full Arm');
  rl.cyberware.push({ uid: 'a1', id: arm.id, name: arm.name, grade: 'Standard' }, { uid: 'a2', id: arm.id, name: arm.name, grade: 'Standard' });
  const drl = derive(rl);
  assert.equal(drl.attr.STR.bonus, derive({ ...rl, qualities: [] }).attr.STR.bonus + 1);
  assert.equal(drl.cm.physical, derive({ ...rl, qualities: [] }).cm.physical - 3);
});

test('Death Dealer (Adept) adds DV to the chosen melee skill; Overclocker adds 1 to the chosen deck attribute', () => {
  const ch = withQ(adept(), 'Death Dealer (Adept)', { choice: { skill: 'Blades' } });
  ch.skills[skillId('Blades')] = { p: 2, k: 0, a: 0, spec: '' };
  const kat = idx('weapons', 'weapons').list.find((w) => w.name === 'Katana');
  ch.weapons.push({ uid: 'k', id: kat.id, name: kat.name });
  const d = derive(ch);
  const base = weaponStats(kat, derive({ ...ch, qualities: [] }), ch.weapons[0]).dmg;
  assert.equal(parseInt(weaponStats(kat, d, ch.weapons[0]).dmg, 10), parseInt(base, 10) + 1);
  const oc = withQ(newCharacter(), 'Overclocker');
  oc.gear.push({ uid: 'deck', id: gear('Renraku Tsurugi').id, name: 'Renraku Tsurugi', overclock: 's' });
  assert.equal(derive(oc).matrix.devices[0].s, 5 + 1);
});

test('Infected attribute picks are separate +1 slots from their own lists (Goblin: 2 of BOD/REA/STR, 2 of WIL/INT)', () => {
  const base = derive(withQ(newCharacter(), 'Infected: Goblin'));
  const ch = withQ(newCharacter(), 'Infected: Goblin', { choice: { attrs: ['BOD', 'STR', 'WIL', 'CHA'] } }); // CHA isn't allowed there
  const d = derive(ch);
  assert.equal(d.attr.BOD.bonus, base.attr.BOD.bonus + 1);
  assert.equal(d.attr.STR.bonus, base.attr.STR.bonus + 1);
  assert.equal(d.attr.WIL.bonus, base.attr.WIL.bonus + 1);
  assert.equal(d.attr.CHA.bonus, base.attr.CHA.bonus, 'a pick outside the slot list is ignored');
  assert.equal(d.attr.BOD.max, base.attr.BOD.max, 'no maximum change (that is Exceptional Attribute)');
});
