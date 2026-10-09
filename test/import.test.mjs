import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import './helpers.mjs';

const { importChum5, rtfToText } = await import('../src/engine/chummerImport.js');
const { derive } = await import('../src/engine/character.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(here, '..', '..', 'Chummer5.226.0', 'saves', 'autosave', 'Ten-Twelve Inazuma.chum5');
const has = fs.existsSync(sample);

test('rtfToText strips RTF markup', () => {
  const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}\pard Hello\par World \'e9\par}`;
  assert.equal(rtfToText(rtf), 'Hello\nWorld é');
  assert.equal(rtfToText('plain'), 'plain');
});

test('rejects files that are not Chummer characters', () => {
  assert.throws(() => importChum5('<foo/>', new DOMParser()), /Chummer character/);
});

test('imports the sample .chum5 and matches Chummer\'s own numbers', { skip: !has }, () => {
  const { ch, report } = importChum5(fs.readFileSync(sample, 'utf8'), new DOMParser());
  assert.equal(ch.info.name, 'Inazuma 10:12');
  assert.equal(ch.metatype, 'Human');
  assert.equal(ch.mode, 'create');
  assert.deepEqual(ch.pri, { heritage: 'E', attributes: 'C', talent: 'E', skills: 'D', resources: 'B' });
  const d = derive(ch);
  // attributes: Chummer's totalvalue for each
  assert.equal(d.attr.BOD.total, 4);
  assert.equal(d.attr.INT.total, 5);
  assert.equal(d.attr.LOG.total, 6);
  assert.equal(d.attr.CHA.total, 2);
  assert.equal(d.attr.EDG.total, 3);
  // every self-check against Chummer's saved values passes
  const bad = report.checks.filter((c) => !c.ok);
  assert.deepEqual(bad, [], 'checks: ' + JSON.stringify(report.checks));
  // skills / qualities / gear came across
  const sk = (n) => d.skills.find((s) => s.name === n);
  assert.equal(sk('Hacking').rating, 6);
  assert.equal(sk('Cybercombat').rating, 6);
  assert.equal(sk('Sneaking').rating, 3);
  assert.equal(sk('Longarms').spec, 'Shotguns');
  assert.ok(d.qualities.some((q) => q.name === 'Codeslinger'));
  assert.ok(ch.weapons.some((w) => w.name === 'Beretta Northstar' && w.mods.length === 0));
  assert.ok(ch.cyberware.some((c) => c.name === 'Skilljack' && c.grade === 'Used'));
  assert.ok(ch.gear.some((g) => g.name === 'Renraku Tsurugi'));
  // bundled children (Sim Module, Commlink Functionality, and what it in turn bundles) are linked to their
  // parent, not just flagged as a child - that's what lets the app nest them under the deck instead of losing them
  const deck = ch.gear.find((g) => g.name === 'Renraku Tsurugi');
  const simModule = ch.gear.find((g) => g.name === 'Sim Module, Hot');
  assert.equal(simModule.parent, deck.uid);
  assert.equal(simModule.child, true);
  const commlinkFn = ch.gear.find((g) => g.name === 'Commlink Functionality');
  assert.equal(commlinkFn.parent, deck.uid);
  const camera = ch.gear.find((g) => g.name === 'Camera, Micro');
  assert.equal(camera.parent, commlinkFn.uid); // a grandchild: nested under Commlink Functionality, not the deck directly
  assert.ok(ch.know.some((k) => k.name === 'Japanese' && k.cat === 'Language'));
  assert.equal(ch.contacts[0].name, 'Cheg');
  assert.deepEqual(report.unmatched, [], 'unmatched: ' + JSON.stringify(report.unmatched));
});

test('imports foci, spirits, initiation, metamagics, martial arts, mentor, vehicle mods and custom improvements', async () => {
  const { dataMod } = await import('./helpers.mjs');
  const I = dataMod.idx;
  const focus = I('gear', 'gears').list.find((g) => g.name === 'Power Focus');
  const style = I('martialarts', 'martialarts').list.find((m) => (m.techniques || []).length);
  const tech = [].concat(style.techniques)[0].name;
  const mentor = I('mentors', 'mentors').list.find((m) => [].concat(m.choices || []).length);
  const choice = [].concat(mentor.choices)[0].name;
  const drone = I('vehicles', 'vehicles').list.find((v) => /Roto-Drone/.test(v.name)) || I('vehicles', 'vehicles').list[0];
  const mod = I('vehicles', 'mods').list.find((m) => m.name === 'Smuggling Compartment') || I('vehicles', 'mods').list[0];
  const mq = I('qualities', 'qualities').byName.get('mentor spirit');
  const xml = `<character><created>True</created><buildmethod>Priority</buildmethod><name>Test</name><metatype>Human</metatype>
    <adept>True</adept><magician>True</magician><initiategrade>2</initiategrade>
    <qualities><quality><name>Mentor Spirit</name><sourceid>${mq.id}</sourceid><qualitysource>Selected</qualitysource></quality></qualities>
    <gears><gear><guid>AAAA-1</guid><name>Power Focus</name><sourceid>${focus.id}</sourceid><rating>2</rating><qty>1</qty></gear></gears>
    <foci><focus><gearid>aaaa-1</gearid><name>Power Focus</name><rating>2</rating></focus></foci>
    <spirits><spirit><name>Spirit of Air</name><force>4</force><services>3</services><bound>True</bound><type>Spirit</type></spirit></spirits>
    <metamagics><metamagic><name>Masking</name></metamagic></metamagics>
    <martialarts><martialart><name>${style.name}</name><martialarttechniques><martialarttechnique><name>${tech}</name></martialarttechnique></martialarttechniques></martialart></martialarts>
    <mentorspirits><mentorspirit><name>${mentor.name}</name><mentortype>Mentor Spirit</mentortype><extra>${choice}</extra></mentorspirit></mentorspirits>
    <vehicles><vehicle><name>${drone.name}</name><sourceid>${drone.id}</sourceid><mods>
      <mod><name>${mod.name}</name><sourceid>${mod.id}</sourceid><rating>1</rating><included>False</included></mod>
      <mod><name>Factory thing</name><included>True</included></mod></mods></vehicle></vehicles>
    <improvements><improvement><improvementsource>Custom</improvementsource><customname>GM gift</customname><improvementttype>Attribute</improvementttype><improvedname>STR</improvedname><aug>1</aug><enabled>True</enabled></improvement>
      <improvement><improvementsource>Custom</improvementsource><customname>GM gift</customname><improvementttype>Skill</improvementttype><improvedname>Pistols</improvedname><val>2</val><enabled>True</enabled></improvement></improvements>
  </character>`;
  const { ch, report } = importChum5(xml, new DOMParser());
  assert.equal(ch.gear[0].bonded, true, 'focus bonded');
  assert.deepEqual(ch.spirits.map((s) => [s.name, s.force, s.services, s.bound]), [['Spirit of Air', 4, 3, true]]);
  assert.equal(ch.initGrade, 2);
  assert.deepEqual(ch.metamagics.map((m) => m.name), ['Masking']);
  assert.deepEqual(ch.martialArts.map((m) => [m.name, m.techniques.map((t) => t.name)]), [[style.name, [tech]]]);
  assert.equal(ch.mentor, mentor.name);
  assert.equal(ch.mentorChoice, choice);
  assert.deepEqual(ch.vehicles[0].mods, [{ id: mod.id, rating: 1 }], 'bought mod kept, factory one skipped');
  const gift = ch.qualities.find((q) => q.name === 'GM gift');
  assert.ok(gift && gift.custom.attrs[0].attr === 'STR' && /Skill \(Pistols\) \+2/.test(gift.custom.description));
  const d = derive(ch);
  assert.equal(d.attr.STR.bonus, 1, 'custom attribute improvement applies');
  assert.ok(!report.notes.some((n) => /not supported yet/.test(n)), report.notes.join(' | '));
});

test('importing a Variable-cost item uses the price Chummer actually saved, not the catalogue minimum', async () => {
  const { dataMod } = await import('./helpers.mjs');
  const I = dataMod.idx;
  const cloth = I('armor', 'armors').list.find((a) => a.name === 'Clothing'); // Variable(20-100000)
  const xml = `<character><created>True</created><buildmethod>Priority</buildmethod><name>Test</name><metatype>Human</metatype>
    <armors><armor><name>Clothing</name><sourceid>${cloth.id}</sourceid><cost>500</cost><equipped>True</equipped></armor></armors>
  </character>`;
  const { ch } = importChum5(xml, new DOMParser());
  assert.equal(ch.armor[0].variable, 500, 'the actually-paid cost is preserved, not the Variable() minimum');

  const xmlNoCost = `<character><created>True</created><buildmethod>Priority</buildmethod><name>Test</name><metatype>Human</metatype>
    <armors><armor><name>Clothing</name><sourceid>${cloth.id}</sourceid><equipped>True</equipped></armor></armors>
  </character>`;
  const { ch: ch2 } = importChum5(xmlNoCost, new DOMParser());
  assert.equal(ch2.armor[0].variable, 20, 'falls back to the range minimum when no cost was saved');
  assert.ok(derive(ch2).items.armor[0].cost >= 0, 'never a negative/refund cost');
});

test('imports Arts, enhancements, stacked foci, critter powers, A.I. programs, custom drugs and a Qi Focus power (v23)', async () => {
  const { dataMod } = await import('./helpers.mjs');
  const I = dataMod.idx;
  const g = (n) => I('gear', 'gears').list.find((x) => x.name === n && !x.hide);
  const art = I('metamagic', 'arts').list.find((a) => a.name === 'Quickening');
  const enh = I('powers', 'enhancements').list[0];
  const cp = I('critterpowers', 'powers').list.find((p) => p.name === 'Natural Weapon') || I('critterpowers', 'powers').list[0];
  const ai = I('programs', 'programs').list.find((p) => p.category === 'Advanced Programs') || I('programs', 'programs').list[0];
  const xml = `<character><created>True</created><buildmethod>Priority</buildmethod><name>Test</name><metatype>Human</metatype>
    <adept>True</adept><magician>True</magician><initiategrade>3</initiategrade>
    <gears><gear><guid>SF-1</guid><name>Stacked Focus</name><extra>Power Focus, Qi Focus</extra></gear>
      <gear><name>Qi Focus</name><sourceid>${g('Qi Focus').id}</sourceid><rating>6</rating><extra>Improved Reflexes</extra><bonded>True</bonded></gear></gears>
    <stackedfoci><stackedfocus><guid>X</guid><gearid>sf-1</gearid><bonded>True</bonded><gears>
      <gear><name>Power Focus</name><sourceid>${g('Power Focus').id}</sourceid><rating>2</rating></gear>
      <gear><name>Spellcasting Focus, Combat</name><sourceid>${g('Spellcasting Focus, Combat').id}</sourceid><rating>1</rating></gear>
    </gears></stackedfocus></stackedfoci>
    <arts><art><name>${art.name}</name><sourceid>${art.id}</sourceid></art></arts>
    <powers><power><name>Light Body</name><enhancements><enhancement><name>${enh.name}</name><sourceid>${enh.id}</sourceid></enhancement></enhancements></power></powers>
    <critterpowers><critterpower><name>${cp.name}</name><sourceid>${cp.id}</sourceid><rating>2</rating><extra>Claws</extra></critterpower></critterpowers>
    <aiprograms><aiprogram><name>${ai.name}</name><sourceid>${ai.id}</sourceid></aiprogram></aiprograms>
    <drugs><drug><name>Red Mist</name><category>Custom Drug</category><qty>3</qty><cost>150</cost><avail>6R</avail><duration>1d6 hours</duration>
      <drugcomponents><drugcomponent><name>Jazz Base</name></drugcomponent><drugcomponent><name>Cram Foundation</name></drugcomponent></drugcomponents></drug></drugs>
  </character>`;
  const { ch, report } = importChum5(xml, new DOMParser());
  assert.deepEqual(ch.metamagics.map((m) => [m.name, m.kind]), [[art.name, 'art'], [enh.name, 'enhancement']]);
  const stack = ch.gear.filter((x) => /stacked focus/.test(x.notes || ''));
  assert.deepEqual(stack.map((x) => [x.name, x.rating, x.bonded]), [['Power Focus', 2, true], ['Spellcasting Focus, Combat', 1, true]]);
  assert.ok(!report.unmatched.some((u) => /Stacked Focus/.test(u.name)), 'synthetic stack item not reported missing');
  const qi = ch.gear.find((x) => x.name === 'Qi Focus');
  assert.equal(I('powers', 'powers').byId.get(qi.choice.power).name, 'Improved Reflexes');
  assert.deepEqual(ch.critterPowers.map((x) => [x.name, x.rating, x.extra]), [[cp.name, 2, 'Claws']]);
  assert.deepEqual(ch.aiPrograms.map((x) => x.name), [ai.name]);
  const drug = ch.gear.find((x) => x.name === 'Red Mist');
  assert.ok(drug.custom && drug.qty === 3 && drug.custom.cost === 150 && /Jazz Base, Cram Foundation/.test(drug.custom.description) && /Duration: 1d6 hours/.test(drug.custom.description));
  assert.ok(!report.notes.some((n) => /not supported yet/.test(n)), report.notes.join(' | '));
  const d = derive(ch);
  assert.equal(d.magic.fociForce, 6 + 2 + 1, 'stack parts count toward bonded Force');
  assert.equal(d.powerGrants[0].def.name, 'Improved Reflexes');
  assert.equal(d.critterPowers.length, 1);
});
