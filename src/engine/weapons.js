// Weapon helpers shared by the Gear tab, the Sheet/Play weapons panel and the item inspector.
import { idx, arr, txt } from './data.js';
import { evalExpr } from './expr.js';

export const SKILL_BY_CAT = {
  'tasers': 'Pistols', 'holdouts': 'Pistols', 'light pistols': 'Pistols', 'heavy pistols': 'Pistols',
  'machine pistols': 'Automatics', 'submachine guns': 'Automatics', 'assault rifles': 'Automatics', 'carbines': 'Automatics',
  'shotguns': 'Longarms', 'sniper rifles': 'Longarms', 'sporting rifles': 'Longarms',
  'light machine guns': 'Heavy Weapons', 'medium machine guns': 'Heavy Weapons', 'heavy machine guns': 'Heavy Weapons',
  'assault cannons': 'Heavy Weapons', 'grenade launchers': 'Heavy Weapons', 'missile launchers': 'Heavy Weapons',
  'bows': 'Archery', 'crossbows': 'Archery', 'blades': 'Blades', 'clubs': 'Clubs', 'improvised weapons': 'Clubs',
  'exotic melee weapons': 'Exotic Melee Weapon', 'exotic ranged weapons': 'Exotic Ranged Weapon',
  'flamethrowers': 'Exotic Ranged Weapon', 'laser weapons': 'Exotic Ranged Weapon', 'unarmed': 'Unarmed Combat',
  'gear': 'Throwing Weapons', 'cyberweapon': 'Unarmed Combat', 'bio-weapon': 'Unarmed Combat',
};

// Accessory fields that modify a weapon's own stats (SR5 core p.428-433: Smartgun System +2 Accuracy,
// Gas-Vent System +N RC, Long Barrel +1 Accuracy/+1 Concealability, Sawed-Off -1 Damage, etc).
const MOD_FIELDS = ['damage', 'ap', 'rc', 'conceal', 'accuracy'];

/** [{name, v}] non-zero contributions from an owned weapon's mounted accessories for one stat field. */
export function accessoryMods(it, field) {
  if (!it || !it.mods || !it.mods.length) return [];
  const ax = idx('weapons', 'accessories');
  const out = [];
  for (const m of it.mods) {
    const md = ax.byId.get(m.id);
    if (!md || md[field] === undefined) continue;
    const v = evalExpr(txt(md[field]), { Rating: m.rating || 1 });
    if (!Number.isNaN(v) && v !== 0) out.push({ name: md.name, v });
  }
  return out;
}
const sumMods = (list) => list.reduce((s, x) => s + x.v, 0);
const tipOf = (list) => list.map((x) => `${x.v > 0 ? '+' : ''}${x.v} ${x.name}`).join(', ');

/** "9P" / "(3+2)P" (STR already substituted) -> bump the leading number/formula, keep the rest ("P", "S(e)", " (-2/m)", ...). */
function bumpLeadingNumber(raw, bonus) {
  const m = /^(\(([^)]+)\)|(-?\d+(?:\.\d+)?))/.exec(raw);
  if (!m) return { text: raw, changed: false };
  const base = m[2] !== undefined ? evalExpr(m[2]) : Number(m[3]);
  if (Number.isNaN(base)) return { text: raw, changed: false };
  const rest = raw.slice(m[0].length);
  return { text: `${base + bonus}${rest}`, changed: bonus !== 0 };
}

/** plain signed-number fields (AP, RC, Concealability). "-" means 0 (no inherent rating); non-numeric text (e.g. "Special") passes through untouched. */
function bumpPlainNumber(raw, bonus) {
  const s = String(raw ?? '').trim();
  if (!bonus) return { text: s, changed: false };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { text: String(Number(s) + bonus), changed: true };
  if (s === '-') return { text: String(bonus), changed: true };
  return { text: s, changed: false };
}

/** Accuracy is a plain number, or "Physical"/"Missile" (optionally with its own +N/-N, e.g. thrown weapons using STR). */
function bumpAccuracy(raw, bonus) {
  const s = String(raw ?? '').trim();
  if (!bonus) return { text: s, changed: false };
  if (/^-?\d+$/.test(s)) return { text: String(Number(s) + bonus), changed: true };
  const m = /^(Physical|Missile)([+-]\d+)?$/.exec(s);
  if (m) {
    const total = (m[2] ? Number(m[2]) : 0) + bonus;
    return { text: total ? `${m[1]}${total > 0 ? '+' : ''}${total}` : m[1], changed: true };
  }
  return { text: s, changed: false };
}

// ---- loaded ammunition (Chummer gear, category "Ammunition": `weaponbonus`) - SR5 core p.433-434 ----------------
// damage / ap / accuracy add; damagetype replaces the damage type ("S", "S(e)", "P(f)"); apreplace / damagereplace /
// accuracyreplace / modereplace replace the stat outright (Stick-n-Shock AP -5, Taurus Omni-6 Heavy 7P SS).
export const isAmmo = (g) => g && g.category === 'Ammunition';
/** the ammo loaded into an owned weapon (`it.ammo` = an ammunition gear id), or null for regular rounds */
export function loadedAmmo(it) {
  if (!it || !it.ammo) return null;
  const g = idx('gear', 'gears').byId.get(it.ammo);
  return isAmmo(g) ? g : null;
}
const clean = (n) => String(n).replace(/^Ammo:\s*/, '');

/**
 * A weapon's stats as actually worn: base stats plus whatever its mounted accessories contribute.
 * `it` (the owned weapon, with `.mods`) is optional; omit it to see the unmodified catalogue stats.
 */
export function weaponStats(def, d, it) {
  const skillName = def.useskill || SKILL_BY_CAT[String(def.category).toLowerCase()] || '';
  const sk = d.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  // melee/unarmed/thrown damage: the character's best available Strength, natural or any cyberlimb (SR5 core
  // p.455-456; engine/cyberlimbs.js) - falls back to natural STR if `d` wasn't derived with it (e.g. an older
  // snapshot passed straight in)
  const str = d.strCombat != null ? d.strCombat : d.attr.STR.total;

  const mods = Object.fromEntries(MOD_FIELDS.map((f) => [f, accessoryMods(it, f)]));
  const ammo = def.type !== 'Melee' ? loadedAmmo(it) : null;
  const wb = (ammo && ammo.weaponbonus) || {};
  const aName = ammo ? clean(ammo.name) : '';
  const addAmmo = (field, key) => { const v = Number(txt(wb[key])); if (wb[key] != null && !Number.isNaN(v) && v) mods[field].push({ name: aName, v }); };
  addAmmo('damage', 'damage'); addAmmo('ap', 'ap'); addAmmo('accuracy', 'accuracy');
  // Death Dealer (Adept), Forbidden Arcana: +DV with melee weapons of the chosen skill
  const qdv = d.weaponDV && d.weaponDV[skillName];
  if (qdv && def.type === 'Melee') mods.damage.push({ name: 'Death Dealer', v: qdv });
  let base = String(txt(def.damage)).replace(/\{STR\}/g, String(str));
  if (wb.damagereplace) base = String(txt(wb.damagereplace));
  let dmgR = bumpLeadingNumber(base, sumMods(mods.damage));
  if (wb.damagetype) {
    // swap the damage type letters that follow the number: "8P" -> "8S(e)"
    const t = String(txt(wb.damagetype));
    const swapped = dmgR.text.replace(/^(-?\d+(?:\.\d+)?)\s*[PS](\([^)]*\))?/, `$1${t}`);
    if (swapped !== dmgR.text) dmgR = { text: swapped, changed: true };
  }
  const apBase = wb.apreplace != null ? String(txt(wb.apreplace)) : def.ap;
  const apR = bumpPlainNumber(apBase, sumMods(mods.ap));
  if (wb.apreplace != null) apR.changed = true;
  const rcR = bumpPlainNumber(def.rc, sumMods(mods.rc));
  const concealR = bumpPlainNumber(def.conceal, sumMods(mods.conceal));
  const accR = bumpAccuracy(wb.accuracyreplace != null ? String(txt(wb.accuracyreplace)) : def.accuracy, sumMods(mods.accuracy));
  const ammoTip = ammo ? `${aName} loaded` : '';
  const withAmmo = (tip, touched) => (touched && ammoTip && !tip.includes(aName) ? [tip, ammoTip].filter(Boolean).join(', ') : tip);

  // the skill's own pool: its attribute (with any Attribute Boost), rating, and every bonus to that skill (Improved
  // Ability, qualities, cyberware...) - it used to be just Agility + rating. A bonded Weapon Focus that IS this weapon
  // adds its Force (SR5 core p.320) unless a bigger focus already counts for the skill.
  const rating = sk ? sk.rating : 0;
  const weaponFocus = (d.magic && d.magic.weaponFoci && it && d.magic.weaponFoci[it.uid]) || 0;
  const extraFocus = sk ? Math.max(0, weaponFocus - (sk.focusBonus || 0)) : 0;
  const pool = sk && (rating > 0 || sk.defaultable) ? sk.pool + extraFocus : null;
  return {
    skillName, pool, spec: sk && sk.spec, rating,
    dmg: dmgR.text, dmgTip: withAmmo(tipOf(mods.damage), !!(wb.damagetype || wb.damagereplace)), dmgMod: dmgR.changed,
    ap: apR.text, apTip: withAmmo(tipOf(mods.ap), wb.apreplace != null), apMod: apR.changed,
    mode: wb.modereplace ? String(txt(wb.modereplace)) : def.mode, ammoName: aName,
    rc: rcR.text, rcTip: tipOf(mods.rc), rcMod: rcR.changed,
    conceal: concealR.text, concealTip: tipOf(mods.conceal), concealMod: concealR.changed,
    accuracy: accR.text, accuracyTip: tipOf(mods.accuracy), accuracyMod: accR.changed,
  };
}

/** magazine size from Chummer's ammo string: "30(c)" -> 30, "2(b)" -> 2; 0 when there's no magazine */
export const parseAmmo = (s) => { const m = /^(\d+)\(/.exec(String(s || '')); return m ? Number(m[1]) : 0; };
