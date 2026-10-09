// "Hide what this character can't take" (src/engine/purchasable.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx, num } = dataMod;
const { unavailabilityChecker, bestGradeEss } = await import('../src/engine/purchasable.js');
const { evalAvail } = await import('../src/engine/expr.js');

const plainAvail = (list, pred) => list.find((x) => !/Rating/i.test(String(x.avail)) && pred(evalAvail(x.avail, {}).n));

test('availability over the creation limit is unavailable during creation only', () => {
  const ch = newCharacter();
  const d = derive(ch);
  const gear = idx('gear', 'gears').list;
  const high = plainAvail(gear, (n) => n > 12);
  const ok = plainAvail(gear, (n) => n > 0 && n <= 12);
  const check = unavailabilityChecker('gear', ch, d);
  assert.match(check(high), /^Availability \d+ \(max 12 at creation\)$/);
  assert.equal(check(ok), null);
  const career = { ...ch, mode: 'career' };
  assert.equal(unavailabilityChecker('gear', career, derive(career))(high), null, 'anything can be sourced after creation');
});

test('rated items are judged at their lowest rating', () => {
  const ch = newCharacter();
  const check = unavailabilityChecker('gear', ch, derive(ch));
  // an item whose availability grows with Rating, over the limit at max rating but not at rating 1
  const rated = idx('gear', 'gears').list.find((g) => /Rating/.test(String(g.avail)) && num(g.rating) > 1
    && evalAvail(g.avail, { Rating: Math.max(1, num(g.minrating, 1)) }).n <= 12 && evalAvail(g.avail, { Rating: num(g.rating) }).n > 12);
  assert.ok(rated, 'found a test item');
  assert.equal(check(rated), null);
});

test('needs Magic: a mundane character can\'t take magic-only qualities', () => {
  const ch = newCharacter();
  const check = unavailabilityChecker('qualities', ch, derive(ch));
  const magicOnly = idx('qualities', 'qualities').list.find((q) => q.name === 'Adept Healer'); // required: allof magenabled + ...
  assert.ok(magicOnly && /magenabled/.test(JSON.stringify(magicOnly.required)), 'found a magic-only quality');
  assert.equal(check(magicOnly), 'Needs a Magic rating');
});

test('positive qualities past the creation Karma limit', () => {
  const ch = newCharacter();
  const d = derive(ch);
  const pos = idx('qualities', 'qualities').list.filter((q) => q.category === 'Positive' && !q.required && !q.forbidden);
  const cheap = pos.find((q) => num(q.karma) === 5);
  const big = pos.find((q) => num(q.karma) >= 20 && num(q.karma) <= 25);
  // pretend 20 Karma of positive qualities are already taken
  const d2 = { ...d, qualities: [{ auto: false, karma: 20, def: { category: 'Positive' }, name: 'x' }] };
  const check = unavailabilityChecker('qualities', ch, d2);
  assert.equal(check(cheap), null, '20 + 5 = 25 is still within the limit');
  assert.match(check(big), /^Over the 25 Karma limit for positive qualities \(20 used\)$/);
});

test('SR5 core p.71: the positive limit stretches by Negative Karma taken beyond ITS OWN 25-Karma limit', () => {
  const ch = newCharacter();
  const d = derive(ch);
  const pos = idx('qualities', 'qualities').list.filter((q) => q.category === 'Positive' && !q.required && !q.forbidden);
  const cheap = pos.find((q) => num(q.karma) === 5);
  // 30 Positive Karma already spent (already over the base 25) + 35 Negative Karma taken (10 over its own 25 limit,
  // still only ever giving 25 bonus Karma - see character.js's negCounted) => positive limit extends 25 -> 35.
  const d2 = { ...d, qualities: [
    { auto: false, karma: 30, def: { category: 'Positive' }, name: 'x' },
    { auto: false, karma: -35, def: { category: 'Negative' }, name: 'y' },
  ] };
  const check = unavailabilityChecker('qualities', ch, d2);
  assert.equal(check(cheap), null, '30 + 5 = 35 <= 35 (25 base + 10 Negative-Karma excess) - allowed');
  // without any matching Negative excess, the base 25 still applies
  const d3 = { ...d, qualities: [{ auto: false, karma: 30, def: { category: 'Positive' }, name: 'x' }] };
  assert.match(unavailabilityChecker('qualities', ch, d3)(cheap), /^Over the 25 Karma limit for positive qualities \(30 used\)$/);
});

test('SR5 core p.71 at the real derive() validator, not just the picker filter: 30 Positive Karma is a hard error alone, but not once matched by 10+ Karma of Negative qualities beyond their own 25-Karma limit', async () => {
  const { newCustomQuality } = await import('../src/engine/custom.js');
  const posOnly = newCharacter();
  posOnly.qualities.push(newCustomQuality({ name: 'Custom Pos', category: 'Positive', karma: 30 }));
  const d1 = derive(posOnly);
  assert.ok(d1.warnings.some((w) => w.sev === 'error' && /Positive qualities cost 30 Karma \(limit 25\)/.test(w.msg)));

  const balanced = newCharacter();
  balanced.qualities.push(
    newCustomQuality({ name: 'Custom Pos', category: 'Positive', karma: 30 }),
    newCustomQuality({ name: 'Custom Neg', category: 'Negative', karma: -35 }), // 10 Karma beyond Negative's own 25 limit
  );
  const d2 = derive(balanced);
  assert.ok(!d2.warnings.some((w) => w.sev === 'error' && /Positive qualities cost/.test(w.msg)),
    '25 base + 10 Negative-Karma excess = 35 limit, 30 spent - no error');
  assert.ok(d2.warnings.some((w) => /Negative qualities give 35 Karma \(only 25 counts/.test(w.msg)),
    'the excess Negative Karma still gives no bonus Karma - it only unlocked more Positive spending');
});

test('Essence: blocked only when even the best allowed grade would take Essence to 0', () => {
  const ch = newCharacter();
  const d = derive(ch);
  const best = bestGradeEss('cyberware', d.R);
  assert.ok(best < 1 && best >= 0.7, `best ordinary grade multiplier ${best} (Alphaware 0.8 / Greyware 0.75 - not the Adapsin variants)`);
  const item = idx('cyberware', 'cyberwares').list.find((c) => !c.required && !c.forbidden && String(c.ess) === '0.5' && evalAvail(c.avail, {}).n <= 12);
  assert.ok(item, 'found a 0.5 Essence item');
  const need = Math.round(0.5 * best * 100) / 100;
  const at = (essence, R = d.R) => unavailabilityChecker('cyberware', ch, { ...d, essence, R });
  assert.equal(at(6)(item), null);
  assert.equal(at(need + 0.05)(item), null, 'the best grade still fits');
  assert.equal(at(need)(item), `Needs ${need} Essence (${need.toFixed(2)} left)`, 'exactly 0 Essence left would kill the character');
  const onlyStandard = { ...d.R, bannedGrades: ['Alphaware', 'Betaware', 'Deltaware', 'Gammaware', 'Greyware', 'Omegaware'] };
  assert.equal(bestGradeEss('cyberware', onlyStandard), 1);
  assert.match(at(0.45, onlyStandard)(item), /^Needs 0\.5 Essence/, 'house rules banning the good grades count');
});
