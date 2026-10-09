// Made Man and Trust Fund (Run Faster p.148 / p.151): the bonuses that aren't stat changes (engine/qualityPerks.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const perks = await import('../src/engine/qualityPerks.js');
const { unavailabilityChecker } = await import('../src/engine/purchasable.js');
const { importChum5 } = await import('../src/engine/chummerImport.js');

const quality = (n) => idx('qualities', 'qualities').list.find((q) => q.name === n);
const addQ = (ch, n) => { const q = quality(n); ch.qualities.push({ uid: `q${ch.qualities.length}`, id: q.id, name: q.name, choice: {}, note: '' }); };
const life = (n) => idx('lifestyles', 'lifestyles').list.find((l) => l.name === n);

test('Made Man: its syndicate contact is free (no contact Karma) and it adds the black-market note', () => {
  const ch = newCharacter();
  addQ(ch, 'Made Man');
  let d = derive(ch);
  assert.deepEqual(d.madeMan, { loyalty: 3, has: false });
  assert.ok(d.situational.some((s) => s.what === 'Availability tests' && s.v === 1 && /syndicate/.test(s.condition)));
  ch.contacts.push(perks.madeManContact('c1'));
  d = derive(ch);
  assert.equal(d.madeMan.has, true);
  assert.equal(d.contacts.spent, 0, 'a Loyalty 3 syndicate contact costs no Karma');
  ch.contacts.push({ uid: 'c2', name: 'Fixer', connection: 3, loyalty: 2 });
  assert.equal(derive(ch).contacts.spent, 5);
});

test('Trust Fund: needs a SINner (named in the picker); pays its lifestyle tier; one lifestyle only', () => {
  const ch = newCharacter();
  const why = () => unavailabilityChecker('qualities', ch, derive(ch))(quality('Trust Fund II'));
  assert.equal(why(), 'Needs SINner (National) or SINner (Corporate)');
  addQ(ch, 'SINner (National)');
  assert.equal(why(), null);
  addQ(ch, 'Trust Fund II');
  assert.equal(unavailabilityChecker('qualities', ch, derive(ch))(quality('Trust Fund III')), "Can't be combined with Trust Fund II");
  ch.lifestyles.push({ uid: 'l1', id: life('Low').id, name: 'Low', months: 1 }, { uid: 'l2', id: life('Medium').id, name: 'Medium', months: 1 });
  let d = derive(ch);
  assert.deepEqual(d.trustFund, { level: 2, lifestyle: 'Low', paid: false });
  const before = d.nuyen.spent;
  ch.lifestyles[0].trustFund = true;
  d = derive(ch);
  assert.equal(d.trustFund.paid, true);
  assert.equal(d.nuyen.spent, before - 2000, 'the Low lifestyle is free');
  assert.ok(!d.warnings.some((w) => /Trust Fund/.test(w.msg)));
  // wrong tier -> still paid, but warned
  ch.lifestyles[0].trustFund = false; ch.lifestyles[1].trustFund = true;
  assert.ok(derive(ch).warnings.some((w) => /pays a Low lifestyle, not Medium/.test(w.msg)));
  // no quality -> not free, warned
  ch.qualities = ch.qualities.filter((q) => !/Trust Fund/.test(q.name));
  d = derive(ch);
  assert.equal(d.trustFund, null);
  assert.ok(d.warnings.some((w) => /no Trust Fund quality/.test(w.msg)));
});

test('trust fund payouts: flat for I / III, rolled for II / IV', () => {
  assert.deepEqual([1, 3].map((l) => perks.trustFundPayout(l).amt), [500, 1000]);
  const sixes = () => 0.999; // every die a 6
  assert.equal(perks.trustFundPayout(2, sixes).amt, 2000 + 18 * 100);
  assert.equal(perks.trustFundPayout(4, sixes).amt, 3000 + 36 * 100);
  assert.match(perks.trustFundPayout(2, sixes).note, /Trust fund \(II\): 2,000 \+ 3D6 \[6, 6, 6\] × 100/);
  assert.equal(perks.trustFundIncomeText(2), '2,000 + 3D6 × 100');
});

test('.chum5 import keeps a free / Made Man contact and a trust-fund lifestyle', () => {
  const low = life('Low');
  const xml = `<character><created>True</created><buildmethod>Priority</buildmethod><name>T</name><metatype>Human</metatype>
    <contacts><contact><name>The Family</name><role>Mafia</role><connection>4</connection><loyalty>3</loyalty><type>Contact</type><free>True</free><mademan>True</mademan></contact></contacts>
    <lifestyles><lifestyle><name>Mom's place</name><baselifestyle>Low</baselifestyle><sourceid>${low.id}</sourceid><months>1</months><trustfund>True</trustfund></lifestyle></lifestyles>
  </character>`;
  const { ch } = importChum5(xml, new DOMParser());
  assert.deepEqual([ch.contacts[0].free, ch.contacts[0].mademan, ch.contacts[0].group], [true, true, true]);
  assert.equal(ch.lifestyles[0].trustFund, true);
});
