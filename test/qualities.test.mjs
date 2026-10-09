// v26 quality audit: every quality bonus Chummer encodes either changes the numbers or shows as a note. One test per rule
// family, checked against the book's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { woundModifier } = await import('../src/engine/edge.js');

const qdef = (n) => { const q = idx('qualities', 'qualities').list.find((x) => x.name === n); assert.ok(q, n); return q; };
const withQ = (ch, n, extra = {}) => { const q = qdef(n); ch.qualities.push({ uid: `q${ch.qualities.length}`, id: q.id, name: q.name, choice: {}, note: '', ...extra }); return ch; };
const fresh = () => newCharacter();
const note = (d, re) => d.situational.find((s) => re.test(s.what));

test('levels: Karma x level; "Rating" bonuses use the level; plain ones repeat per level', () => {
  const ch = withQ(fresh(), 'Dimmer Bulb', { level: 2 }); // -5 Karma per level, memory -Rating
  let d = derive(ch);
  const q = d.qualities.find((x) => x.name === 'Dimmer Bulb');
  assert.equal(q.karma, -10);
  assert.equal(d.pools.memory, derive(fresh()).pools.memory - 2);
  const tough = withQ(fresh(), 'Tough as Nails (Physical)', { level: 3 });
  d = derive(tough);
  assert.equal(d.cm.physical, derive(fresh()).cm.physical + 3);
  assert.equal(d.qualities.find((x) => x.name === 'Tough as Nails (Physical)').karma, 15);
  // level is capped at the quality's limit
  assert.equal(derive(withQ(fresh(), 'High Pain Tolerance', { level: 9 })).qualities[0].level, 3);
});

test('High Pain Tolerance: ignored boxes before wound modifiers (SR5 core p.74)', () => {
  const d = derive(withQ(fresh(), 'High Pain Tolerance', { level: 2 }));
  assert.equal(d.woundIgnore, 2);
  assert.equal(woundModifier({ phys: 5, stun: 0 }, d), 1); // (5 - 2) / 3
  assert.equal(woundModifier({ phys: 5, stun: 0 }, derive(fresh())), 1);
  assert.equal(woundModifier({ phys: 4, stun: 0 }, d), 0);
});

test('money at creation: In Debt pays 5,000 per level instead of Karma; Born Rich raises the Karma -> nuyen cap to 40', () => {
  const base = derive(fresh()).nuyen.total;
  const debt = derive(withQ(fresh(), 'In Debt', { level: 4 }));
  assert.equal(debt.nuyen.total, base + 20000);
  assert.equal(debt.qualities.find((q) => q.name === 'In Debt').karma, 0);
  assert.equal(derive(fresh()).karmaNuyenMax, 10);
  const rich = withQ(fresh(), 'Born Rich');
  rich.karmaConverted = 40;
  const d = derive(rich);
  assert.equal(d.karmaNuyenMax, 40);
  assert.equal(d.nuyen.total, base + 40 * 2000);
});

test("Essence: Biocompatibility x0.9 rounded down to the tenth, Sensitive System doubles cyberware, Crystal qualities cost Magic only", () => {
  const cw = idx('cyberware', 'cyberwares').list.find((c) => c.name === 'Cybereyes Basic System' || c.name === 'Datajack');
  const add = (ch) => { ch.cyberware.push({ uid: 'c1', id: cw.id, name: cw.name, rating: 1, grade: 'Standard' }); return ch; };
  const plain = derive(add(fresh())).essence;
  const used = 6 - plain;
  assert.equal(derive(add(withQ(fresh(), 'Biocompatibility (Cyberware)'))).essence, 6 - Math.floor(used * 0.9 * 10 + 1e-9) / 10);
  assert.equal(Math.round((6 - derive(add(withQ(fresh(), 'Sensitive System'))).essence) * 100), Math.round(used * 2 * 100));
  const mage = withQ(fresh(), 'Crystal Eye (One Eye)');
  mage.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
  mage.talent = 'Magician';
  const d = derive(mage);
  assert.equal(d.essence, 5, 'the crystal costs 1 Essence (Forbidden Arcana p.133)');
  assert.equal(d.attr.MAG.lost, 0, '...but Magic is unaffected');
  // and an Infected ghoul LOSES a point of Essence (it used to gain one)
  assert.equal(derive(withQ(fresh(), 'Infected: Ghoul (Human)')).essence, 5);
});

test('Infected: the attribute table is replaced and the critter powers come with it', () => {
  const d = derive(withQ(fresh(), 'Infected: Ghoul (Human)'));
  const tbl = qdef('Infected: Ghoul (Human)').bonus.replaceattributes.find((r) => r.name === 'STR');
  assert.equal(d.attr.STR.max, Number(tbl.max));
  assert.ok(d.critterPowers.some((c) => c.auto && /Ghoul/.test(c.it.from)), 'critter powers granted');
});

test('qualities that bring qualities; Notoriety / Street Cred (SR5 p.372); Consummate Professional divides by 20', () => {
  let d = derive(withQ(fresh(), 'Ex-Con'));
  assert.ok(d.qualities.some((q) => q.name === 'SINner (Criminal)' && q.auto && q.grantedBy === 'Ex-Con'));
  assert.equal(d.reputation.notoriety, 1, 'SINner (Criminal) +1');
  const vet = fresh();
  vet.mode = 'career'; vet.career = { earned: 47, log: [] };
  assert.equal(derive(vet).reputation.streetCred, 4);
  withQ(vet, 'Consummate Professional');
  assert.equal(derive(vet).reputation.streetCred, 2);
  vet.reputationAdj = { publicAwareness: 1 };
  assert.equal(derive(vet).reputation.publicAwareness, 1);
});

test('skills and knowledge: Aged (+5 knowledge points, physical max -1 per level), College Education, Uncouth', () => {
  const aged = derive(withQ(fresh(), 'Aged', { level: 2 }));
  const base = derive(fresh());
  assert.equal(aged.used.knowPool, base.used.knowPool + 10);
  assert.equal(aged.attr.AGI.max, base.attr.AGI.max - 2);
  const college = fresh(); // the College Education that halves Academic costs (there are two with that name)
  { const q = idx('qualities', 'qualities').list.find((x) => x.name === 'College Education' && x.bonus && x.bonus.skillcategorypointcostmultiplier);
    college.qualities.push({ uid: 'ce', id: q.id, name: q.name, choice: {}, note: '' }); }
  college.know.push({ uid: 'k1', name: 'History', cat: 'Academic', p: 4, k: 0, a: 0 });
  assert.equal(derive(college).used.knowUsed, 2, 'Academic at half cost');
  const uncouth = withQ(fresh(), 'Uncouth');
  uncouth.skills[idx('skills', 'skills').list.find((s) => s.name === 'Con').id] = { p: 3, k: 0, a: 0, spec: '' };
  assert.equal(derive(uncouth).used.skillPts, 6, 'Social skills cost double');
});

test('conditional limit modifiers are notes, not always-on (Fame: Local +1 Social limit only in your sprawl)', () => {
  const d = derive(withQ(fresh(), 'Fame: Local'));
  assert.equal(d.limits.social, derive(fresh()).limits.social);
  assert.ok(d.situational.some((s) => s.what === 'Social limit' && s.v === 1 && /home sprawl/.test(s.condition)));
});

test('movement, memory, persona, Power Points, resistances and situational notes', () => {
  assert.equal(derive(withQ(fresh(), 'Celerity')).move.runMult, 6);
  assert.equal(derive(withQ(fresh(), 'Photographic Memory')).pools.memory, derive(fresh()).pools.memory + 2);
  const tox = derive(withQ(fresh(), 'Resistance to Toxins'));
  assert.ok(Object.keys(tox.drugResist).some((k) => k.startsWith('toxin:')));
  const adept = withQ(fresh(), "Mentor's Mask");
  adept.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' };
  adept.talent = 'Adept';
  assert.equal(derive(adept).magic.ppTotal, derive({ ...adept, qualities: [] }).magic.ppTotal + 1);
  assert.ok(note(derive(withQ(fresh(), 'Quick Healer')), /Healing Physical/));
  assert.ok(note(derive(withQ(fresh(), 'Honest Face')), /Judge Intentions/));
  assert.ok(note(derive(withQ(fresh(), 'Sensitive System')), /bioware/));
});

test('a situational bonus switched on applies for real (Fame: Local +1 Social limit in your home sprawl)', async () => {
  const { conditionKey } = await import('../src/engine/character.js');
  const ch = withQ(fresh(), 'Fame: Local');
  let d = derive(ch);
  const base = d.limits.social;
  const n = d.situational.find((s) => s.what === 'Social limit');
  assert.ok(n.canApply && !n.active);
  ch.activeConditions = [n.key];
  d = derive(ch);
  assert.equal(d.limits.social, base + 1);
  assert.ok(d.situational.find((s) => s.what === 'Social limit').active);
  ch.activeConditions = [];
  assert.equal(derive(ch).limits.social, base);
  assert.equal(typeof conditionKey, 'function');
});
