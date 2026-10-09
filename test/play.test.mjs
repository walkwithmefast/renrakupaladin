import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const actions = await import('../src/engine/actions.js');
const edge = await import('../src/engine/edge.js');
const { idx } = dataMod;
const skillId = (n) => idx('skills', 'skills').byName.get(n.toLowerCase()).id;

// ---- skill groups ------------------------------------------------------------
test('group is not broken until a member differs or is specialized', () => {
  const ch = newCharacter();
  ch.groups.Firearms = { p: 2, k: 0, a: 0 };
  let d = derive(ch);
  assert.equal(d.groups.find((g) => g.name === 'Firearms').broken, false);
  // Automatics has its own ranks, the other members do not -> broken
  ch.skills[skillId('Automatics')] = { p: 0, k: 1, a: 0, spec: '' };
  d = derive(ch);
  const g = d.groups.find((x) => x.name === 'Firearms');
  assert.equal(g.broken, true);
  assert.match(g.brokenWhy, /Automatics/);
  // give every member the same individual rank -> the group is whole again
  for (const n of ['Pistols', 'Longarms']) ch.skills[skillId(n)] = { p: 0, k: 1, a: 0, spec: '' };
  d = derive(ch);
  assert.equal(d.groups.find((x) => x.name === 'Firearms').broken, false);
});

test('a specialization breaks the group permanently', () => {
  const ch = newCharacter();
  ch.groups.Firearms = { p: 1, k: 0, a: 0 };
  for (const n of ['Automatics', 'Pistols', 'Longarms']) ch.skills[skillId(n)] = { p: 0, k: 0, a: 0, spec: n === 'Pistols' ? 'Revolvers' : '' };
  ch.skills[skillId('Pistols')].spec = 'Revolvers';
  const d = derive(ch);
  const g = d.groups.find((x) => x.name === 'Firearms');
  assert.equal(g.broken, true);
  assert.match(g.brokenWhy, /specialization/);
});

test('broken groups refuse to be raised or lowered as a whole', () => {
  const ch = newCharacter();
  ch.groups.Firearms = { p: 2, k: 0, a: 0 };
  ch.skills[skillId('Pistols')] = { p: 0, k: 1, a: 0, spec: '' };
  const d = derive(ch);
  const g = d.groups.find((x) => x.name === 'Firearms');
  assert.equal(g.broken, true);
  actions.setGroupRating(ch, d, g, 4);
  assert.equal(ch.groups.Firearms.p, 2);
  assert.equal(ch.groups.Firearms.k, 0);
});

test('during creation, individual skill points cannot raise a skill in a bought group (needs Karma)', () => {
  const ch = newCharacter();
  ch.pri.skills = 'A';
  ch.groups.Firearms = { p: 2, k: 0, a: 0 };
  const d = derive(ch);
  const pistols = d.skills.find((s) => s.name === 'Pistols');
  assert.equal(pistols.rating, 2);
  actions.setSkillRating(ch, d, pistols, 3);
  const t = ch.skills[skillId('Pistols')];
  assert.equal(t.p, 0, 'no skill points spent');
  assert.equal(t.k, 1, 'bought with Karma instead');
  // an ungrouped skill still uses skill points
  const archery = d.skills.find((s) => s.name === 'Archery');
  actions.setSkillRating(ch, d, archery, 2);
  assert.equal(ch.skills[skillId('Archery')].p, 2);
});

// ---- Edge --------------------------------------------------------------------
const withEdge = () => { const ch = newCharacter(); ch.attrs.EDG.p = 2; return ch; }; // human: 2 + 2 = 4

test('Edge: spend, regain and never exceed the maximum', () => {
  const ch = withEdge();
  let d = derive(ch);
  assert.equal(d.attr.EDG.total, 4);
  assert.ok(edge.spendEdge(ch, d, 'push'));
  assert.ok(edge.spendEdge(ch, d, 'second'));
  d = derive(ch);
  assert.equal(edge.edgeAvailable(d, ch.play), 2);
  assert.ok(edge.regainEdge(ch, 'rest'));
  assert.ok(edge.regainEdge(ch, 'gm'));
  assert.equal(edge.regainEdge(ch, 'gm'), false, 'nothing left to regain');
  d = derive(ch);
  assert.equal(edge.edgeAvailable(d, ch.play), 4);
  assert.equal(ch.play.edgeLog.length, 4);
});

test('Edge: cannot spend with none left; unknown effects are rejected', () => {
  const ch = newCharacter(); // Edge 2
  let d = derive(ch);
  edge.spendEdge(ch, d, 'push'); edge.spendEdge(ch, d, 'push');
  d = derive(ch);
  assert.equal(edge.spendEdge(ch, d, 'push'), false);
  assert.equal(edge.spendEdge(ch, d, 'nope'), false);
});

// ---- Karma carryover (user report: "leftover Karma from creation doesn't carry to career") ------------------
test('finalize: exactly R.karmaCarryover Karma left at creation carries in full (the boundary case, not just the cap)', async () => {
  const { newCustomQuality } = await import('../src/engine/custom.js');
  const ch = newCharacter();
  let d = derive(ch);
  assert.equal(d.R.karmaCarryover, 7, 'default house rule');
  // 25 build Karma - 18 spent = exactly 7 left, exactly the carryover cap
  ch.qualities.push(newCustomQuality({ name: 'Custom Pos', category: 'Positive', karma: 18 }));
  d = derive(ch);
  assert.equal(d.karma.left, 7);
  actions.finalize(ch, d);
  assert.equal(ch.career.earned, 7, 'the full 7 should carry, not be truncated at the boundary');
  d = derive(ch);
  assert.equal(d.karma.left, 7);
});

// ---- back to creation ---------------------------------------------------------
test('finalize -> backToCreation is a round trip: mode, nuyen, priority table all restored', () => {
  const ch = newCharacter();
  ch.attrs.AGI.p = 2; // spend some priority points during creation
  let d = derive(ch);
  const beforePri = { ...ch.pri };
  actions.finalize(ch, d);
  assert.equal(ch.mode, 'career');
  d = derive(ch);
  // finishing creation already forfeits unspent nuyen above the carry-over cap (same as Karma); that's not
  // reversed here - backToCreation preserves whatever total you had right before reverting, not before finalizing
  const nuyenRightBeforeReverting = d.nuyen.left;
  actions.backToCreation(ch, d);
  assert.equal(ch.mode, 'create');
  assert.deepEqual(ch.pri, beforePri);
  const after = derive(ch);
  assert.equal(after.nuyen.left, nuyenRightBeforeReverting);
  assert.equal(after.karma.left, after.R.buildKarma + after.karma.negCounted - after.karma.spentTotal + after.karma.left - after.karma.left + 0, after.karma.left); // sanity: formula runs without throwing
});

test('career advancement survives the round trip at the same Karma cost (attributes, skills, groups, knowledge)', () => {
  const ch = newCharacter();
  let d = derive(ch);
  actions.finalize(ch, d);
  d = derive(ch);
  const pistols = d.skills.find((s) => s.name === 'Pistols');
  actions.setSkillRating(ch, d, pistols, 3); // advancement (career) purchase
  actions.setAttrRating(ch, derive(ch), 'BOD', 3);
  // a different group than Pistols' own (Firearms), so raising Pistols individually hasn't broken it
  const beforeGroups = derive(ch).groups.find((g) => g.name === 'Athletics');
  actions.setGroupRating(ch, derive(ch), beforeGroups, 2);
  const careerD = derive(ch);
  const pistolsBefore = careerD.skills.find((s) => s.name === 'Pistols');
  const groupBefore = careerD.groups.find((g) => g.name === 'Athletics');
  assert.equal(groupBefore.broken, false);
  assert.equal(ch.skills[pistols.id].a, 3);
  assert.equal(ch.attrs.BOD.a, 2); // human base 1 -> 3
  // the cost actually charged in career mode, per item (this is the number that must not change)
  const chargedBefore = careerD.attr.BOD.aCost + pistolsBefore.aCost + groupBefore.aCost;

  actions.backToCreation(ch, careerD);
  assert.equal(ch.mode, 'create');
  assert.equal(ch.skills[pistols.id].a, 0);
  assert.equal(ch.skills[pistols.id].k, 3); // merged into the creation (Karma) tier
  assert.equal(ch.attrs.BOD.a, 0);
  assert.equal(ch.attrs.BOD.k, 2);
  const after = derive(ch);
  const pistolsAfter = after.skills.find((s) => s.name === 'Pistols');
  const groupAfter = after.groups.find((g) => g.name === 'Athletics');
  assert.equal(pistolsAfter.rating, 3); // rating unchanged by the merge
  assert.equal(after.attr.BOD.total, 3);
  assert.equal(groupAfter.rating, 2);
  // cost-neutral under the default rules: the same ranks cost the same Karma whichever tier they're tracked in
  const chargedAfter = after.attr.BOD.kCost + pistolsAfter.kCost + groupAfter.kCost;
  assert.equal(chargedAfter, chargedBefore);
});

test('nuyen total is preserved exactly even after spending some in career mode', () => {
  const ch = newCharacter();
  let d = derive(ch);
  actions.finalize(ch, d);
  d = derive(ch);
  const totalBefore = d.nuyen.total;
  const gear = dataMod.idx('gear', 'gears').byName.get('fake sin');
  ch.gear.push({ uid: 'g1', id: gear.id, name: gear.name, rating: 2, qty: 1 });
  const spentD = derive(ch);
  assert.ok(spentD.nuyen.spent > 0);
  actions.backToCreation(ch, spentD);
  const after = derive(ch);
  assert.equal(after.nuyen.total, totalBefore); // same total pool as right before reverting
  assert.equal(after.nuyen.left, spentD.nuyen.left); // same amount left, since the same gear is still owned
});

test('editing is unlocked again: an attribute can be raised and lowered like a fresh creation-mode character', () => {
  const ch = newCharacter();
  let d = derive(ch);
  actions.finalize(ch, d);
  d = derive(ch);
  actions.backToCreation(ch, d);
  d = derive(ch);
  actions.setAttrRating(ch, d, 'AGI', 4);
  assert.equal(derive(ch).attr.AGI.total, 4);
  d = derive(ch);
  actions.setAttrRating(ch, d, 'AGI', 1);
  assert.equal(derive(ch).attr.AGI.total, 1); // lowering works again (career mode locks this once spent)
});

test('backToCreation on a character still in creation is a no-op', () => {
  const ch = newCharacter();
  ch.attrs.AGI.p = 1;
  const d = derive(ch);
  actions.backToCreation(ch, d);
  assert.equal(ch.mode, 'create');
  assert.equal(ch.attrs.AGI.p, 1);
});

test('a quality bought during career is Karma-neutral after reverting, and not double-charged on a second career stint', () => {
  const ch = newCharacter();
  let d = derive(ch);
  actions.finalize(ch, d);
  d = derive(ch);
  const q = dataMod.idx('qualities', 'qualities').byName.get('toughness'); // 9 Karma, doublecareer by default
  ch.qualities.push({ uid: 'q1', id: q.id, name: q.name, a: true, choice: {}, note: '' });
  const careerD = derive(ch);
  assert.equal(careerD.karma.spent.advancement, 18); // doubled in career mode

  actions.backToCreation(ch, careerD);
  assert.equal(ch.qualities[0].a, false);
  const afterD = derive(ch);
  assert.equal(afterD.karma.spent.qualities, 9); // single (creation) cost now

  actions.finalize(ch, afterD); // a second career stint
  const secondD = derive(ch);
  assert.equal(secondD.karma.spent.advancement, 0); // not re-charged for the old quality
});

test('Edge: burning permanently lowers the attribute; undo and restore bring it back', () => {
  const ch = withEdge();
  let d = derive(ch);
  assert.ok(edge.burnEdge(ch, d, 'smackdown'));
  d = derive(ch);
  assert.equal(d.attr.EDG.total, 3);
  assert.equal(d.attr.EDG.burned, 1);
  assert.equal(edge.edgeAvailable(d, ch.play), 3);
  // burning consumes an available point, so it cannot burn what is already spent
  edge.spendEdge(ch, d, 'push'); edge.spendEdge(ch, derive(ch), 'push'); edge.spendEdge(ch, derive(ch), 'push');
  assert.equal(edge.burnEdge(ch, derive(ch), 'notdead'), false);
  assert.ok(edge.undoEdge(ch)); // undo the last spend
  assert.ok(edge.undoEdge(ch)); assert.ok(edge.undoEdge(ch));
  assert.ok(edge.undoEdge(ch)); // undo the burn
  d = derive(ch);
  assert.equal(d.attr.EDG.total, 4);
  edge.burnEdge(ch, d, 'notdead');
  assert.ok(edge.restoreBurnedEdge(ch));
  assert.equal(derive(ch).attr.EDG.total, 4);
});
