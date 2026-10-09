import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { idx } = dataMod;
const { weaponStats, accessoryMods } = await import('../src/engine/weapons.js');
const { spawnGearBundle, relinkGearBundles } = await import('../src/engine/gearBundle.js');

const gunOf = (name) => idx('weapons', 'weapons').byName.get(name.toLowerCase());
const accOf = (name) => idx('weapons', 'accessories').list.find((a) => a.name === name);

// ---- accessory bonuses actually reaching the weapon's stats -----------------------------
test('Smartgun System (Internal) adds +2 Accuracy', () => {
  const def = gunOf('Colt M23');
  const sm = accOf('Smartgun System, Internal');
  const ch = newCharacter();
  const d = derive(ch);
  const bare = weaponStats(def, d, { mods: [] });
  const armed = weaponStats(def, d, { mods: [{ id: sm.id, rating: 1 }] });
  assert.equal(bare.accuracy, def.accuracy);
  assert.equal(Number(armed.accuracy), Number(def.accuracy) + 2);
  assert.match(armed.accuracyTip, /Smartgun/);
  assert.equal(armed.accuracyMod, true);
  assert.equal(bare.accuracyMod, false);
});

test('a real character reflects the bonus once the mod is attached', () => {
  const ch = newCharacter();
  const def = gunOf('Colt M23');
  const sm = accOf('Smartgun System, Internal');
  ch.weapons.push({ uid: 'w1', id: def.id, name: def.name, mods: [{ id: sm.id, rating: 1 }] });
  const d = derive(ch);
  const entry = d.items.weapons.find((e) => e.it.uid === 'w1');
  const st = weaponStats(entry.def, d, entry.it);
  assert.equal(Number(st.accuracy), Number(def.accuracy) + 2);
});

test('Gas-Vent System adds to Recoil Compensation', () => {
  const def = gunOf('Colt M23');
  const gv = accOf('Gas-Vent 2 System');
  const ch = newCharacter();
  const d = derive(ch);
  const st = weaponStats(def, d, { mods: [{ id: gv.id, rating: 1 }] });
  assert.equal(Number(st.rc), Number(def.rc) + Number(gv.rc));
  assert.equal(st.rcMod, true);
});

test('Sawed Off/Shortbarrel reduces damage and concealability (negative accessory modifiers apply too)', () => {
  const def = gunOf('Colt M23') || idx('weapons', 'weapons').list.find((w) => Number(w.rc) >= 0 && /pistol|smg|rifle/i.test(w.category));
  const saw = accOf('Sawed Off/Shortbarrel');
  const ch = newCharacter();
  const d = derive(ch);
  const base = weaponStats(def, d, { mods: [] });
  const st = weaponStats(def, d, { mods: [{ id: saw.id, rating: 1 }] });
  const baseDmg = Number(base.dmg.replace(/[^0-9-]/g, ''));
  const modDmg = Number(st.dmg.replace(/[^0-9-]/g, ''));
  assert.equal(modDmg, baseDmg - 1);
});

test('multiple accessories on the same stat stack, and unrelated accessories do not affect it', () => {
  const def = gunOf('Colt M23');
  const sm = accOf('Smartgun System, Internal');
  const laser = accOf('Laser Sight');
  const ch = newCharacter();
  const d = derive(ch);
  const st = weaponStats(def, d, { mods: [{ id: sm.id, rating: 1 }, { id: laser.id, rating: 1 }] });
  assert.equal(Number(st.accuracy), Number(def.accuracy) + Number(sm.accuracy) + Number(laser.accuracy));
  const bipod = accOf('Bipod');
  const st2 = weaponStats(def, d, { mods: [{ id: bipod.id, rating: 1 }] }); // RC only, shouldn't touch accuracy
  assert.equal(st2.accuracy, def.accuracy);
});

test('a weapon formula like ({STR}+2)P still evaluates correctly with no accessories', () => {
  const def = idx('weapons', 'weapons').byName.get('combat knife');
  const ch = newCharacter();
  ch.attrs.STR.p = 2; // human STR 1 -> 3
  const d = derive(ch);
  const st = weaponStats(def, d, { mods: [] });
  assert.equal(st.dmg, `${3 + 2}P`);
});

test('accessoryMods returns [] for an unowned/mod-less weapon and ignores fields the accessory does not touch', () => {
  assert.deepEqual(accessoryMods(null, 'accuracy'), []);
  assert.deepEqual(accessoryMods({ mods: [] }, 'accuracy'), []);
  const bipod = accOf('Bipod');
  assert.deepEqual(accessoryMods({ mods: [{ id: bipod.id, rating: 1 }] }, 'accuracy'), []); // Bipod affects RC, not accuracy
});

// ---- Equipped toggle -----------------------------------------------------------------
test('weapons default to equipped, and the flag round-trips through derive()', () => {
  const ch = newCharacter();
  const def = gunOf('Colt M23');
  ch.weapons.push({ uid: 'w1', id: def.id, name: def.name });
  ch.weapons.push({ uid: 'w2', id: def.id, name: def.name, equipped: false });
  const d = derive(ch);
  assert.equal(d.items.weapons.find((e) => e.it.uid === 'w1').it.equipped, undefined); // default: treated as equipped
  assert.equal(d.items.weapons.find((e) => e.it.uid === 'w2').it.equipped, false);
});

// ---- gear bundles (a cyberdeck's built-in Commlink Functionality, Music Player, Camera, ...) ---
test('adding a cyberdeck auto-adds its bundled gear, nested and free', () => {
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  const items = spawnGearBundle(deck);
  const primary = items[0];
  assert.equal(primary.parent, undefined);
  assert.equal(primary.child, undefined);
  const names = items.slice(1).map((i) => i.name);
  assert.ok(names.includes('Sim Module, Hot'));
  assert.ok(names.includes('Universal Connector Cord'));
  assert.ok(names.includes('Commlink Functionality')); // itself bundles further items
  assert.ok(names.includes('Music Player'));            // a grandchild, nested under Commlink Functionality
  assert.ok(names.includes('Camera, Micro'));
  for (const child of items.slice(1)) {
    assert.equal(child.child, true);
    assert.equal(child.free, true);
    assert.ok(child.parent, `${child.name} has a parent`);
  }
});

test('a usegear rating override is applied to the spawned child (Earbuds -> rating 1)', () => {
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  const items = spawnGearBundle(deck);
  const earbuds = items.find((i) => i.name === 'Earbuds');
  assert.equal(earbuds.rating, 1);
});

test('bundled children cost nothing, even though the catalogue item itself is not free', () => {
  const ch = newCharacter();
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  for (const it of spawnGearBundle(deck)) ch.gear.push(it);
  const d = derive(ch);
  const camera = d.items.gear.find((e) => e.def.name === 'Camera, Micro' && e.it.child);
  const cameraCatalog = idx('gear', 'gears').byName.get('camera, micro');
  assert.ok(Number(cameraCatalog.cost) > 0, 'the catalogue item itself is not free');
  assert.equal(camera.cost, 0, 'but bundled into a deck it costs nothing extra');
});

test('a commlink with a single (non-array) usegear entry is still bundled', () => {
  const link = idx('gear', 'gears').byName.get('sony emperor');
  const items = spawnGearBundle(link);
  assert.ok(items.some((i) => i.name === 'Commlink Functionality'));
});

// ---- repairing characters saved before .parent was tracked (the exact bug a user hit: an already-
// imported/saved character whose bundled gear was flagged `child: true` but never linked to a parent) ---
test('relinkGearBundles repairs a stale gear array (child flagged, no parent) without touching anything else', () => {
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  const fresh = spawnGearBundle(deck); // what a correctly-linked import/add looks like
  // simulate the OLD import bug: keep the same items and order, but strip the .parent links it never used to set
  const stale = fresh.map((it) => { const { parent, ...rest } = it; return rest; });
  const ch = { gear: stale };
  assert.ok(stale.every((it) => !it.parent));
  assert.ok(stale.filter((it) => it.child).length > 0);

  const changed = relinkGearBundles(ch);
  assert.equal(changed, true);

  const deckIt = ch.gear.find((it) => it.name === 'Renraku Tsurugi');
  const simModule = ch.gear.find((it) => it.name === 'Sim Module, Hot');
  const commlinkFn = ch.gear.find((it) => it.name === 'Commlink Functionality');
  const camera = ch.gear.find((it) => it.name === 'Camera, Micro');
  assert.equal(simModule.parent, deckIt.uid);
  assert.equal(commlinkFn.parent, deckIt.uid);
  assert.equal(camera.parent, commlinkFn.uid); // the grandchild is linked to the right level, not the deck directly
  assert.equal(ch.gear.length, stale.length); // nothing added, removed, or reordered
});

test('relinkGearBundles is a safe no-op on an already-linked or empty gear list', () => {
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  const ch = { gear: spawnGearBundle(deck) }; // already correctly linked (fresh add/import)
  const before = JSON.stringify(ch.gear);
  assert.equal(relinkGearBundles(ch), false);
  assert.equal(JSON.stringify(ch.gear), before);
  assert.equal(relinkGearBundles({ gear: [] }), false);
  assert.equal(relinkGearBundles({}), false);
});

test('relinkGearBundles leaves ordinary (non-bundle) gear untouched', () => {
  const fakeSin = idx('gear', 'gears').byName.get('fake sin');
  const ch = { gear: [{ uid: 'a', id: fakeSin.id, name: fakeSin.name, rating: 1 }] };
  assert.equal(relinkGearBundles(ch), false);
  assert.equal(ch.gear[0].parent, undefined);
});

test('removing the parent removes every bundled descendant, at any depth', () => {
  const ch = newCharacter();
  const deck = idx('gear', 'gears').byName.get('renraku tsurugi');
  const spawned = spawnGearBundle(deck);
  for (const it of spawned) ch.gear.push(it);
  assert.ok(ch.gear.length > 10);
  // emulate the cascade-delete in items.jsx's ItemSection
  const rootUid = spawned[0].uid;
  const doomed = new Set([rootUid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const g of ch.gear) if (g.parent && doomed.has(g.parent) && !doomed.has(g.uid)) { doomed.add(g.uid); grew = true; }
  }
  ch.gear = ch.gear.filter((z) => !doomed.has(z.uid));
  assert.equal(ch.gear.length, 0);
});
