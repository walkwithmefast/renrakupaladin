import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { importChum5 } = await import('../src/engine/chummerImport.js');
const { describeItem, resolveInspect } = await import('../src/engine/describe.js');
const { idx } = dataMod;

const gearByName = (n) => idx('gear', 'gears').list.find((g) => g.name === n && !g.hide);
const give = (ch, name, extra = {}) => {
  const def = gearByName(name);
  assert.ok(def, `gear "${name}" exists`);
  const it = { uid: 'u' + ch.gear.length + name, id: def.id, name, qty: 1, ...extra };
  ch.gear.push(it);
  return it;
};

test('cyberdeck: default array order, program limit and loaded count', () => {
  const ch = newCharacter();
  const deck = give(ch, 'Renraku Tsurugi');
  const hammer = give(ch, 'Hammer', { device: deck.uid });
  give(ch, 'Browse', { device: deck.uid });
  const d = derive(ch);
  const dev = d.matrix.devices.find((x) => x.uid === deck.uid);
  assert.equal(dev.kind, 'deck');
  assert.equal(dev.limit, 3);
  assert.equal(dev.loaded, 2);
  assert.deepEqual([dev.a, dev.s, dev.dp, dev.f], [6, 5, 5, 3]); // array order A,S,D,F until reconfigured
  assert.equal(d.matrix.persona.name, 'Renraku Tsurugi');
  assert.equal(d.matrix.init.hot.dice, 4);
  assert.equal(d.matrix.init.hot.base, dev.dp + d.attr.INT.total);
  assert.ok(hammer);
});

test('reconfiguring the array changes persona stats; an invalid split is flagged', () => {
  const ch = newCharacter();
  const deck = give(ch, 'Renraku Tsurugi', { asdf: { a: 6, s: 5, d: 3, f: 5 } });
  let d = derive(ch);
  const dev = d.matrix.devices[0];
  assert.deepEqual([dev.a, dev.s, dev.dp, dev.f], [6, 5, 3, 5]);
  assert.ok(!d.warnings.some((w) => /attribute-array/.test(w.msg)));
  deck.asdf = { a: 6, s: 6, d: 3, f: 5 };
  d = derive(ch);
  assert.ok(d.warnings.some((w) => /attribute-array/.test(w.msg)));
});

test('running more programs than the deck allows warns; storage is unlimited', () => {
  const ch = newCharacter();
  const deck = give(ch, 'Erika MCD-1'); // program limit 1
  give(ch, 'Hammer', { device: deck.uid });
  give(ch, 'Shell', { device: deck.uid });
  give(ch, 'Track'); // in storage
  const d = derive(ch);
  assert.equal(d.matrix.devices[0].limit, 1);
  assert.equal(d.matrix.devices[0].loaded, 2);
  assert.ok(d.warnings.some((w) => /limit is 1/.test(w.msg)));
  ch.gear.find((g) => g.name === 'Shell').device = '';
  assert.ok(!derive(ch).warnings.some((w) => /limit is/.test(w.msg)));
});

test('two copies of one program on a device warn; hacking program on a commlink warns', () => {
  const ch = newCharacter();
  const deck = give(ch, 'Renraku Tsurugi');
  give(ch, 'Hammer', { device: deck.uid });
  give(ch, 'Hammer', { device: deck.uid });
  assert.ok(derive(ch).warnings.some((w) => /more than one copy of Hammer/.test(w.msg)));
  const ch2 = newCharacter();
  const link = give(ch2, 'Sony Emperor');
  give(ch2, 'Exploit', { device: link.uid });
  assert.ok(derive(ch2).warnings.some((w) => /needs a cyberdeck/.test(w.msg)));
});

test('commlink persona and technomancer Living Persona', () => {
  const ch = newCharacter();
  give(ch, 'Erika Elite');
  let d = derive(ch);
  assert.equal(d.matrix.persona.dr, 4);
  assert.equal(d.matrix.cm, 8 + 2);
  const t = newCharacter();
  t.pri = { heritage: 'E', talent: 'A', attributes: 'A', skills: 'C', resources: 'D' };
  t.talent = 'Technomancer';
  d = derive(t);
  assert.ok(d.matrix.persona.living);
  assert.equal(d.matrix.persona.dr, d.attr.RES.total);
  assert.equal(d.matrix.persona.dp, d.attr.LOG.total);
});

test('inspector facts: weapon, cyberware, quality, spell', () => {
  const ch = newCharacter();
  const w = idx('weapons', 'weapons').list.find((x) => x.name === 'Colt M23');
  ch.weapons.push({ uid: 'w1', id: w.id, name: w.name });
  ch.attrs.AGI.p = 3;
  ch.skills[idx('skills', 'skills').byName.get('automatics').id] = { p: 4, k: 0, a: 0, spec: '' };
  const cy = idx('cyberware', 'cyberwares').list.find((x) => x.name === 'Wired Reflexes');
  ch.cyberware.push({ uid: 'c1', id: cy.id, name: cy.name, rating: 2, grade: 'Alphaware' });
  const d = derive(ch);
  const row = (info, label) => [...info.stats, ...info.own, ...info.cost].find(([k]) => k === label);

  let r = resolveInspect(ch, 'weapons', { uid: 'w1' });
  let info = describeItem('weapons', r.def, r.it, d);
  assert.equal(info.title, 'Colt M23');
  assert.equal(row(info, 'Damage')[1], '9P');
  assert.equal(row(info, 'Dice pool')[1], String(d.attr.AGI.total + 4));
  assert.equal(info.book.source, 'SR5');
  assert.equal(row(info, 'Cost')[1], '550¥');

  r = resolveInspect(ch, 'cyberware', { uid: 'c1' });
  info = describeItem('cyberware', r.def, r.it, d);
  assert.equal(row(info, 'Grade')[1], 'Alphaware');
  assert.ok(Number(row(info, 'Essence cost')[1]) > 0);
  assert.ok(info.effects.some((e) => /Init/.test(e)), 'shows initiative effect: ' + JSON.stringify(info.effects));

  const q = idx('qualities', 'qualities').byName.get('ambidextrous');
  r = resolveInspect(ch, 'qualities', { id: q.id }); // catalogue view (not owned)
  info = describeItem('qualities', r.def, null, d);
  assert.equal(row(info, 'Karma')[1], '4 (costs Karma)');

  const sp = idx('spells', 'spells').byName.get('fireball');
  info = describeItem('spells', sp, null, d);
  assert.equal(row(info, 'Type')[1], 'Physical');
  assert.equal(row(info, 'Duration')[1], 'Instant');
  assert.equal(row(info, 'Damage')[1], 'Physical', 'a Combat spell shows its real damage type, spelled out');

  // most spells (and even a couple of Combat ones, like Evil Eye) have a literal "0" in the data's damage field
  // because it doesn't apply to them - showing that as "Damage: 0" was the bug; there should be no Damage row at all.
  const heal = idx('spells', 'spells').byName.get('heal');
  assert.equal(describeItem('spells', heal, null, d).stats.find(([k]) => k === 'Damage'), undefined, "a Health spell shouldn't show a fake Damage row");
});

test('inspector: unowned catalogue lookups resolve for every kind', () => {
  const ch = newCharacter();
  const samples = {
    weapons: idx('weapons', 'weapons').list[0], armor: idx('armor', 'armors').list[0], gear: idx('gear', 'gears').list[0],
    cyberware: idx('cyberware', 'cyberwares').list[0], bioware: idx('bioware', 'biowares').list[0], vehicles: idx('vehicles', 'vehicles').list[0],
    qualities: idx('qualities', 'qualities').list[0], spells: idx('spells', 'spells').list[0], powers: idx('powers', 'powers').list[0],
    complexForms: idx('complexforms', 'complexforms').list[0], lifestyles: idx('lifestyles', 'lifestyles').list[1], skills: idx('skills', 'skills').list[0],
  };
  const d = derive(ch);
  for (const [kind, def] of Object.entries(samples)) {
    const r = resolveInspect(ch, kind, { id: def.id });
    assert.ok(r, kind + ' resolves');
    const info = describeItem(kind, r.def, null, d);
    assert.ok(info.title && info.kindLabel, kind + ' describes');
    assert.ok(info.stats.length + info.cost.length > 0, kind + ' has facts');
  }
});

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(here, '..', '..', 'Chummer5.226.0', 'saves', 'autosave', 'Ten-Twelve Inazuma.chum5');
test('import keeps the deck arrangement and active device from Chummer', { skip: !fs.existsSync(sample) }, () => {
  const { ch } = importChum5(fs.readFileSync(sample, 'utf8'), new DOMParser());
  const deck = ch.gear.find((g) => g.name === 'Renraku Tsurugi');
  assert.deepEqual(deck.asdf, { a: 6, s: 5, d: 3, f: 5 });
  assert.equal(ch.activeDevice, deck.uid);
  const d = derive(ch);
  assert.equal(d.matrix.persona.name, 'Renraku Tsurugi');
  assert.deepEqual([d.matrix.persona.a, d.matrix.persona.s, d.matrix.persona.dp, d.matrix.persona.f], [6, 5, 3, 5]);
});
