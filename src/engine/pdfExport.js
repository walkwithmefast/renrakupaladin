// Maps a character + its derived stats onto the field names of the fillable character-sheet PDF the user
// added to the project root (SR5-Character-Sheet-Form-20120717.pdf - a fan-made form, embedded at build
// time as dist/sheetTemplate.js; see build.mjs and PROJECT_STATUS.md's "Distributing a copy to someone
// else" for why that's a *different* redistribution question than the rulebook-excerpt one).
//
// Pure mapping only - no PDF library here, so this is unit-testable without pdf-lib or a browser. Returns
// {text: {fieldName: string}, check: {fieldName: true}}; a field simply isn't a key if there's nothing to
// put there. The actual PDF-filling (pdf-lib, Blob, download) lives in src/pdfFill.js, which isn't
// unit-tested the same way since it needs a real PDF library and browser APIs.
import { arr, num } from './data.js';
import { itemDef } from './character.js';
import { weaponStats } from './weapons.js';
import { isProgramDef } from './matrix.js';
import { playState } from './edge.js';

const money = (n) => Math.round(num(n)).toLocaleString('en-US');

const PHYS_DMG = Array.from({ length: 18 }, (_, i) => `Physical DMG${i + 1}`);
// field #7 in this column is oddly just "Stun DMG" (no number) in the PDF itself, not a typo here
const STUN_DMG = ['Stun DMG1', 'Stun DMG2', 'Stun DMG3', 'Stun DMG4', 'Stun DMG5', 'Stun DMG6', 'Stun DMG', 'Stun DMG8', 'Stun DMG9', 'Stun DMG10', 'Stun DMG11', 'Stun DMG12'];

export function sheetFields(ch, d) {
  const text = {};
  const check = {};
  const set = (name, v) => { const s = v == null ? '' : String(v).trim(); if (s && s !== '0') text[name] = s; };
  const setNum = (name, v) => { if (v != null && !Number.isNaN(v)) text[name] = String(v); };
  const tick = (name) => { check[name] = true; };

  // ---- header / bio
  set('CHARACTER', ch.info.name);
  set('PLAYER', ch.info.player);
  set('Name/Alias', ch.info.alias);
  set('Metatype', (d.mt && d.mt.name) || ch.metatype);
  set('Age', ch.info.age);
  set('Gender', ch.info.gender);
  set('Height', ch.info.height);
  set('Weight', ch.info.weight);
  set('NOTES', ch.info.notes);
  setNum('Karma', d.karma.left);
  setNum('Total Karma', d.karma.total);
  set('Nuyen', money(d.nuyen.left));

  // ---- attributes
  setNum('Body', d.attr.BOD.total);
  setNum('Agility', d.attr.AGI.total);
  setNum('Reaction', d.attr.REA.total);
  setNum('Strength', d.attr.STR.total);
  setNum('Willpower', d.attr.WIL.total);
  setNum('Logic', d.attr.LOG.total);
  setNum('Intuition', d.attr.INT.total);
  setNum('Charisma', d.attr.CHA.total);
  setNum('Edge', d.attr.EDG.total);
  set('Essence', d.essence.toFixed(2));
  if (d.attr.MAG.enabled) setNum('MagicResonance', d.attr.MAG.total);
  else if (d.attr.RES.enabled) setNum('MagicResonance', d.attr.RES.total);

  set('Initiative', `${d.init.base}+${d.init.dice}D6`);
  if (d.matrix.persona) {
    const p = d.matrix.persona;
    const hotDice = p.living ? 4 : 3;
    set('Matrix Initiative', `${p.dp + d.attr.INT.total}+${hotDice}D6`);
  }
  if (d.attr.MAG.enabled) set('Astral Initiative', `${d.init.astral.base}+${d.init.astral.dice}D6`);

  setNum('Composure', d.pools.composure);
  setNum('Judge Intentions', d.pools.judge);
  setNum('Memory', d.pools.memory);
  setNum('LiftCarry', d.pools.liftCarry);
  setNum('Physical Limit', d.limits.physical);
  setNum('Mental Limit', d.limits.mental);
  setNum('Social Limit', d.limits.social);
  set('Movement', `${d.move.walk}/${d.move.run}`);

  // Edge rating as dots (like the other attributes - not "currently available", which changes turn to turn)
  for (let i = 0; i < Math.min(8, d.attr.EDG.total); i++) tick(`Edge Pts.${i}`);

  // condition monitor: boxes checked = damage currently marked, from play state, not the track's max size
  const play = playState(ch);
  for (let i = 0; i < Math.min(PHYS_DMG.length, play.phys); i++) tick(PHYS_DMG[i]);
  for (let i = 0; i < Math.min(STUN_DMG.length, play.stun); i++) tick(STUN_DMG[i]);
  setNum('Overflow', play.overflow);

  // ---- skills (ranked active skills only, spread across the sheet's two 18-row columns)
  const ranked = d.skills.filter((s) => s.rating > 0).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  ranked.slice(0, 36).forEach((s, i) => {
    const col = i < 18 ? 0 : 1;
    const row = i % 18;
    set(`Skill.${row}.${col}`, s.spec ? `${s.name} (${s.spec})` : s.name);
    setNum(`Rating.${row}.${col}`, s.rating);
    set(`Type.${row}.${col}`, s.attr);
  });

  // ---- qualities
  const quals = d.qualities.filter((q) => !q.auto);
  quals.slice(0, 10).forEach((q, i) => {
    set(`Quality.${i}`, q.note ? `${q.name}: ${q.note}` : q.name);
    set(`QNotes.${i}`, q.def.source && q.def.page ? `${q.def.source} ${q.def.page}` : '');
    set(`QType.${i}`, q.def.category);
  });

  // ---- contacts
  (ch.contacts || []).slice(0, 5).forEach((c, i) => {
    set(`Name.${i}`, c.name);
    setNum(`Loyalty.${i}`, c.loyalty);
    setNum(`Connection.${i}`, c.connection);
    set(`Favor.${i}`, c.notes);
  });

  // ---- lifestyle
  const life = d.items.lifestyles[0];
  if (life) set('Primary Lifestyle', `${life.it.label || life.def.name} (${life.it.months || 1} mo.)`);

  // ---- weapons: split ranged/melee, first one also doubles onto the "Primary ___" fields
  const weapons = d.items.weapons.filter((e) => e.it.equipped !== false);
  const ranged = weapons.filter((e) => e.def.type !== 'Melee');
  const melee = weapons.filter((e) => e.def.type === 'Melee');
  ranged.slice(0, 6).forEach((e, i) => {
    const st = weaponStats(e.def, d, e.it);
    set(`Ranged Weapon.${i}`, e.def.name);
    set(`Ranged DMG.${i}`, st.dmg);
    set(`Ranged Acc.${i}`, st.accuracy);
    set(`Ranged AP.${i}`, st.ap);
    set(`Ranged Mode.${i}`, e.def.mode);
    set(`Ranged RC.${i}`, st.rc);
    set(`Ranged Ammo.${i}`, e.def.ammo);
  });
  melee.slice(0, 6).forEach((e, i) => {
    const st = weaponStats(e.def, d, e.it);
    set(`Melee Weapon.${i}`, e.def.name);
    set(`Melee Reach.${i}`, e.def.reach);
    set(`Melee DMG.${i}`, st.dmg);
    set(`Melee Acc.${i}`, st.accuracy);
    set(`Melee AP.${i}`, st.ap);
  });
  if (ranged[0]) {
    const st = weaponStats(ranged[0].def, d, ranged[0].it);
    set('Primary Ranged Weapon', ranged[0].def.name);
    set('PRW DMG', st.dmg); set('PRW Acc', st.accuracy); set('PRW AP', st.ap); set('PRW Mode', ranged[0].def.mode); set('PRW RC', st.rc); set('Ammo', ranged[0].def.ammo);
  }
  if (melee[0]) {
    const st = weaponStats(melee[0].def, d, melee[0].it);
    set('Primary Melee Weapon', melee[0].def.name);
    set('PMW Reach', melee[0].def.reach); set('PMW DMG', st.dmg); set('PMW Acc', st.accuracy); set('PMW AP', st.ap);
  }

  // ---- armor
  const armor = d.items.armor.filter((e) => e.it.equipped !== false);
  armor.slice(0, 6).forEach((e, i) => {
    set(`Armor.${i}`, e.def.name);
    set(`Armor Rating.${i}`, arr(e.def.armor).join(' '));
    set(`Armor Notes.${i}`, (e.it.mods || []).length ? `+${e.it.mods.length} mod(s)` : '');
  });
  if (armor[0]) { set('Primary Armor', armor[0].def.name); set('Primary Armor Rating', arr(armor[0].def.armor).join(' ')); }

  // ---- augmentations (cyberware/bioware)
  d.augs.slice(0, 7).forEach((a, i) => {
    set(`Augmentation.${i}`, a.def.name);
    setNum(`AUG Rating.${i}`, a.it.rating);
    set(`AUG Notes.${i}`, a.it.grade && a.it.grade !== 'Standard' ? a.it.grade : '');
    set(`AUG Essence.${i}`, a.ess ? a.ess.toFixed(2) : '');
  });
  set('AUG_Essence_Total', d.essence.toFixed(2));
  set('Base Essence', '6.00');

  // ---- gear (non-weapon/armor/vehicle, non-program)
  const gear = d.items.gear.filter((e) => !isProgramDef(e.def) && !e.it.child);
  gear.slice(0, 19).forEach((e, i) => {
    set(`Gear.${i}`, e.it.qty > 1 ? `${e.def.name} x${e.it.qty}` : e.def.name);
    setNum(`Gear Rating.${i}`, e.it.rating);
  });

  // ---- vehicle (first owned)
  const veh = d.items.vehicles[0];
  if (veh) {
    set('Vehicle', veh.def.name);
    set('Vehicle Handling', veh.def.handling); set('Vehicle Acceleration', veh.def.accel); set('Vehicle Speed', veh.def.speed);
    set('Vehicle Pilot', veh.def.pilot); set('Vehicle Body', veh.def.body); set('Vehicle Armor', arr(veh.def.armor).join(''));
    set('Vehicle Sensors', veh.def.sensor);
  }

  // ---- cyberdeck + matrix condition + running programs
  const deck = d.matrix.devices.find((x) => x.kind === 'deck') || d.matrix.devices[0];
  if (deck) {
    set('Cyberdeck Model', deck.name);
    setNum('Cyberdeck Attack', deck.a); setNum('Cyberdeck Sleaze', deck.s);
    setNum('Cyberdeck Rating', deck.dr); setNum('Cyberdeck Processing', deck.dp); setNum('Cyberdeck Firewall', deck.f);
    const running = d.items.gear.filter((e) => isProgramDef(e.def) && e.it.device === deck.uid);
    running.slice(0, 9).forEach((e, i) => { set(`Cyberdeck Programs.${Math.floor(i / 3)}.${i % 3}`, e.def.name); });
  }
  // Matrix monitor: the deck's damage taken (play state, since v23) - not its capacity, same as the other tracks
  if (deck) {
    const hit = Math.min(12, Math.max(0, Number(playState(ch).matrixDmg[deck.uid]) || 0));
    for (let i = 0; i < hit; i++) tick(`Matrix monitor.${i}`);
  }

  // ---- spells
  (ch.spells || []).slice(0, 8).forEach((s, i) => {
    const def = itemDef('spells', s);
    if (!def) return;
    set(`Spell.${i}`, def.name);
    set(`Spell Type.${i}`, def.type === 'P' ? 'P' : def.type === 'M' ? 'M' : def.type);
    set(`Spell Range.${i}`, def.range);
    set(`Spell Duration.${i}`, def.duration === 'I' ? 'I' : def.duration === 'S' ? 'S' : def.duration === 'P' ? 'P' : def.duration);
    set(`Spell Drain.${i}`, def.dv);
  });

  // ---- adept powers
  (ch.powers || []).slice(0, 8).forEach((p, i) => {
    const def = itemDef('powers', p);
    if (!def) return;
    set(`Adept Power.${i}`, def.name);
    setNum(`Adept Rating.${i}`, p.level > 1 ? p.level : '');
    set(`Adept Notes.${i}`, def.action || '');
  });

  // ---- licenses/fake IDs (a free-text catch-all line on this form)
  const fakeSins = d.items.gear.filter((e) => /fake sin/i.test(e.def.name));
  // "Won Justice (Fake SIN R4, BURNED)" - the name on the SIN is the item's notes (first line)
  const sinName = (e) => String(e.it.notes || '').split(/\r?\n/)[0].trim();
  if (fakeSins.length) set('Licenses', fakeSins.map((e) => `${sinName(e) ? `${sinName(e)} ` : ''}(${e.def.name} R${e.it.rating || 1}${e.it.burned ? ', BURNED' : ''})`).join(', '));

  return { text, check };
}
