// Add-ons that change the thing they're attached to: vehicle/drone modifications (Handling, Speed, Accel, Body,
// Armor, Pilot, Sensor, Seats), armor modifications (Armor), and the rating ranges every rated add-on can take.
//
// Chummer's convention for a mod's <bonus> values: a signed value ("+Rating", "-1", "+Seats * 0.5") adds to the
// stat; an unsigned one ("Rating", "0") sets it. Drone attribute upgrades (Rigger 5.0 p.123) are the "sets" kind:
// Armor (Drone) at rating 6 means the drone's Armor becomes 6, its minimum rating is the drone's Armor + 1, and
// "a drone's attributes can never be higher than twice their starting value" (a 0 counts as 0.5 for that math).
import { arr, num, txt } from './data.js';
import { evalNum } from './expr.js';

export const VEHICLE_STATS = ['handling', 'speed', 'accel', 'body', 'armor', 'pilot', 'sensor', 'seats'];
export const STAT_LABEL = { handling: 'Handling', speed: 'Speed', accel: 'Acceleration', body: 'Body', armor: 'Armor', pilot: 'Pilot', sensor: 'Sensor', seats: 'Seats' };
const OFFROAD = { handling: 'offroadhandling', speed: 'offroadspeed', accel: 'offroadaccel' };
const STAT_OF_KEY = { handling: 'handling', offroadhandling: 'handling', speed: 'speed', offroadspeed: 'speed', accel: 'accel', offroadaccel: 'accel', body: 'body', armor: 'armor', pilot: 'pilot', sensor: 'sensor', seats: 'seats' };

const firstNum = (v) => { const m = /-?\d+(\.\d+)?/.exec(String(txt(v) ?? '')); return m ? Number(m[0]) : 0; };

/** a vehicle's own stats: {handling: {on, off}, speed: {on, off}, accel: {on, off}, body, armor, pilot, sensor, seats} */
export function vehicleBase(def) {
  const pair = (v) => {
    const parts = String(txt(v) ?? '').split('/');
    const on = firstNum(parts[0]);
    return { on, off: parts.length > 1 ? firstNum(parts[1]) : on, split: parts.length > 1 };
  };
  return {
    handling: pair(def.handling), speed: pair(def.speed), accel: pair(def.accel),
    body: firstNum(def.body), armor: firstNum(arr(def.armor).join('')), pilot: firstNum(def.pilot),
    sensor: firstNum(def.sensor), seats: firstNum(def.seats),
  };
}

/** formula variables for a vehicle's mods (cost / slots / min rating formulas use these) */
export function vehicleVars(def, base = vehicleBase(def)) {
  return {
    Handling: base.handling.on, Speed: base.speed.on, Acceleration: base.accel.on, Body: base.body, Armor: base.armor,
    Pilot: base.pilot, Sensor: base.sensor, Seats: base.seats, 'Vehicle Cost': num(def.cost),
  };
}

/** the stat a "sets it to Rating" drone upgrade targets ('armor' for Armor (Drone)), or null */
function upgradedStat(md) {
  const b = md.bonus && typeof md.bonus === 'object' ? md.bonus : {};
  const setsRating = Object.keys(b).filter((k) => STAT_OF_KEY[k] && /^Rating$/.test(String(txt(arr(b[k])[0]))));
  if (!setsRating.length) return null;
  const upgraded = md.ratinglabel === 'String_UpgradedRating' || /\b(Armor|Handling|Speed|Acceleration|Sensor|Pilot|Body)\b/.test(String(md.minrating || ''));
  return upgraded ? STAT_OF_KEY[setsRating[0]] : null;
}

/**
 * The ratings an add-on can take, or null when it has no rating.
 *   kind 'vehicles' (a vehicle/drone mod; pass the vehicle's def), 'armor' (an armor mod), 'weapons' (an accessory).
 * -> {min, max, upgraded?: stat} - `upgraded` means the rating is the stat's new value (drone upgrades).
 */
export function modRatingRange(kind, md, parentDef) {
  if (kind === 'armor') {
    const max = num(md.maxrating);
    return max > 1 ? { min: 1, max } : null;
  }
  const raw = String(txt(md.rating) ?? '').trim();
  if (!raw || raw === '0') return null;
  if (kind === 'weapons') {
    const max = num(raw);
    return max > 1 ? { min: 1, max } : null;
  }
  const base = vehicleBase(parentDef || {});
  const vars = vehicleVars(parentDef || {}, base);
  const lower = raw.toLowerCase();
  if (lower === 'qty') return { min: 1, max: 8 };
  if (lower === 'body') return { min: 1, max: Math.max(1, base.body) };
  if (lower === 'seats') return { min: 1, max: Math.max(1, base.seats) };
  const dataMax = num(raw);
  if (!(dataMax > 0)) return null;
  const min = Math.max(1, Math.round(md.minrating ? evalNum(md.minrating, vars, 1) : 1));
  const stat = upgradedStat(md);
  if (stat) {
    const start = stat === 'handling' || stat === 'speed' || stat === 'accel' ? base[stat].on : base[stat];
    const cap = Math.round(2 * (start > 0 ? start : 0.5));
    const max = Math.min(dataMax, cap);
    return max >= min ? { min, max, upgraded: stat } : { min, max: min, upgraded: stat, overCap: true };
  }
  // "99" / "1000000" mean "no fixed limit" in Chummer's data: keep lowering-mods to what the vehicle has
  if (dataMax >= 99) {
    const touchesBody = md.bonus && typeof md.bonus === 'object' && 'body' in md.bonus;
    return { min, max: touchesBody ? Math.max(1, base.body) : Math.max(min, 12) };
  }
  return { min, max: Math.max(min, dataMax) };
}

/**
 * A vehicle's stats with its mods applied. mods: [{md, rating}] (the mod's def + chosen rating).
 * -> {base, stats: {handling: {on, off, split}, speed, accel, body, armor, pilot, sensor, seats},
 *     changed: {stat: [mod names]}, text: {stat: "4/3"-style display string}}
 */
export function applyVehicleMods(def, mods) {
  const base = vehicleBase(def);
  const vars0 = vehicleVars(def, base);
  const s = structuredClone(base);
  const changed = {};
  const note = (stat, name) => { (changed[stat] ||= []).includes(name) || changed[stat].push(name); };
  const ops = [];
  for (const { md, rating } of mods) {
    const b = md && md.bonus && typeof md.bonus === 'object' ? md.bonus : null;
    if (!b) continue;
    for (const [k, v] of Object.entries(b)) {
      if (!STAT_OF_KEY[k]) continue;
      const raw = String(txt(arr(v)[0]) ?? '').trim();
      if (!raw) continue;
      const stat = STAT_OF_KEY[k];
      const value = evalNum(raw.replace(/^\+/, ''), { ...vars0, Rating: rating || 1 }, 0);
      // which side of an on/off-road pair: "handling" alone (no "offroadhandling" in the same mod) moves both
      const sides = !OFFROAD[stat] ? [null] : k.startsWith('offroad') ? ['off'] : OFFROAD[stat] in b ? ['on'] : ['on', 'off'];
      ops.push({ stat, sides, add: /^[+-]/.test(raw), value, name: md.name });
    }
  }
  // sets first (an upgrade to 6), then adds (a downgrade's -3 on top), so the order mods were bought in doesn't matter
  for (const pass of [false, true]) {
    for (const { stat, sides, add, value, name } of ops.filter((o) => o.add === pass)) {
      for (const side of sides) {
        const before = side ? s[stat][side] : s[stat];
        const after = Math.max(0, add ? before + value : value);
        if (side) s[stat][side] = after; else s[stat] = after;
        if (after !== before) note(stat, name);
      }
      if (OFFROAD[stat] && s[stat].on !== s[stat].off) s[stat].split = true;
    }
  }
  const text = {};
  for (const k of VEHICLE_STATS) {
    const v = s[k];
    text[k] = typeof v === 'object' ? (v.split ? `${fmt(v.on)}/${fmt(v.off)}` : fmt(v.on)) : fmt(v);
  }
  return { base, stats: s, changed, text };
}
const fmt = (n) => String(Math.round(n * 100) / 100);

/** an armor piece's Armor value including its modifications -> {value, bonus, fromMods: [names], additive} */
export function armorWithMods(def, it, modIndex) {
  const raw = String(txt(def.armor)).replace(/[\[\]']/g, '');
  const value = evalNum(raw.replace(/^\+/, ''), { Rating: (it && it.rating) || 1 }, 0);
  let bonus = 0;
  const fromMods = [];
  for (const m of (it && it.mods) || []) {
    const md = modIndex.byId.get(m.id);
    if (!md) continue;
    const a = evalNum(String(txt(arr(md.armor)[0]) ?? '0').replace(/[\[\]'+]/g, ''), { Rating: m.rating || 1 }, 0);
    if (a) { bonus += a; fromMods.push(md.name); }
  }
  return { value: value + bonus, base: value, bonus, fromMods, additive: /^\+/.test(raw) };
}

/** how to show one stat of an owned vehicle: {text, tip} - tip ("Armor 2 -> 4: Armor (Drone)") only when a mod changed it */
export function vehicleStatView(applied, k) {
  const text = applied.text[k];
  const by = applied.changed[k];
  if (!by) return { text, tip: null };
  const b = applied.base[k];
  const baseText = typeof b === 'object' ? (b.split ? `${fmt(b.on)}/${fmt(b.off)}` : fmt(b.on)) : fmt(b);
  return { text, tip: `${STAT_LABEL[k]} ${baseText} → ${text}: ${by.join(', ')}` };
}

/** same for an armor piece: {text, tip} */
export function armorView(aw) {
  const text = `${aw.additive ? '+' : ''}${fmt(aw.value)}`;
  return { text, tip: aw.fromMods.length ? `Armor ${aw.additive ? '+' : ''}${fmt(aw.base)} → ${text}: ${aw.fromMods.join(', ')}` : null };
}

// ---- modification slots (Rigger 5.0) -------------------------------------------------------------------------
// Drones (p.122): one pool of Mod Points = Body - or the "Body X(Y)" Y from the data (`modslots`: what a new drone
// of that model has free). Lowering Body shrinks the pool too, so Fragile's 2 points per Body net 1 (p.123), and
// all Downgrades together give at most 1 point (p.123). Mods' `slots` formulas already carry the free +1 (+3 Armor).
// Other vehicles (p.151): Body slots in each of six categories, plus the data's per-category adjustments
// (`bodymodslots` etc.; the Krime Prowler's -14 Powertrain means none).
export const SLOT_CATEGORIES = ['Powertrain', 'Protection', 'Weapons', 'Body', 'Electromagnetic', 'Cosmetic'];
const isDroneDef = (def) => /drone/i.test(String((def && def.category) || ''));

/** slots a fitted mod takes (negative = gives some back) */
export function modSlotCost(md, rating, parentDef) {
  const raw = String(txt(md.slots) ?? '').trim();
  if (!raw || raw === '0') return 0;
  const vars = { ...vehicleVars(parentDef || {}), Rating: rating || 1 };
  return Math.round(evalNum(raw, vars, 0));
}

/**
 * slot budget for a vehicle and its fitted mods [{md, rating}] (and the stats after mods, for a drone's Body)
 * -> drone: {drone: true, total, used, left}; other: {drone: false, cats: [{cat, total, used, left}]}
 */
export function modSlots(def, fitted, applied) {
  if (isDroneDef(def)) {
    const base = firstNum(def.body);
    const body = applied ? applied.stats.body : base;
    const total = (def.modslots != null ? num(def.modslots) : base) - Math.max(0, base - body);
    let used = 0;
    let downgradeGain = 0;
    for (const { md, rating } of fitted) {
      const s = modSlotCost(md, rating, def);
      if (md.downgrade != null && s < 0) downgradeGain += -s;
      else used += s;
    }
    used -= Math.min(1, downgradeGain);
    return { drone: true, total, used, left: total - used };
  }
  const body = firstNum(def.body);
  const cats = SLOT_CATEGORIES.map((cat) => {
    const total = Math.max(0, body + num(def[`${cat.toLowerCase()}modslots`]));
    const used = fitted.filter(({ md }) => md.category === cat).reduce((s, { md, rating }) => s + modSlotCost(md, rating, def), 0);
    return { cat, total, used, left: total - used };
  });
  return { drone: false, cats };
}

// ---- elemental protection from worn armor (SR5 core p.170-171 elemental damage; armor mods) ------------------
const PROTECT = [
  ['firearmor', 'fire', 'Fire'], ['coldarmor', 'cold', 'Cold'], ['electricityarmor', 'electricity', 'Electricity'],
  ['toxincontactresist', 'toxinContact', 'Toxins (contact)'], ['pathogencontactresist', 'pathogenContact', 'Pathogens (contact)'],
  ['radiationresist', 'radiation', 'Radiation'], ['fatigueresist', 'fatigue', 'Fatigue'],
];
const IMMUNE = [['toxincontactimmune', 'contact toxins'], ['toxininhalationimmune', 'inhaled toxins'], ['pathogencontactimmune', 'contact pathogens'], ['pathogeninhalationimmune', 'inhaled pathogens']];
export const PROTECTION_LABEL = Object.fromEntries(PROTECT.map(([, k, l]) => [k, l]));

/**
 * what worn armor (and its mods) adds beyond plain Armor: {fire: 4, cold: 2, ..., immune: ['contact toxins'],
 * sources: {fire: ['Armor Jacket: Fire Resistance 4']}}. Elemental armor adds to Armor against that damage type.
 */
export function armorProtection(wornItems, armorIdx, modIdx) {
  const out = { immune: [], sources: {} };
  const take = (bonus, rating, label) => {
    if (!bonus || typeof bonus !== 'object') return;
    for (const [key, k] of PROTECT) {
      if (bonus[key] == null) continue;
      const v = evalNum(String(txt(bonus[key])), { Rating: rating || 1 }, 0);
      if (!v) continue;
      out[k] = (out[k] || 0) + v;
      (out.sources[k] ||= []).push(`${label} ${v > 0 ? '+' : ''}${v}`);
    }
    for (const [key, what] of IMMUNE) if (key in bonus && !out.immune.includes(what)) out.immune.push(what);
  };
  for (const it of wornItems) {
    const def = armorIdx.byId.get(it.id) || armorIdx.byName.get(String(it.name || '').toLowerCase());
    if (!def) continue;
    take(def.bonus, it.rating, def.name);
    for (const m of it.mods || []) {
      const md = modIdx.byId.get(m.id);
      if (md) take(md.bonus, m.rating, `${def.name}: ${md.name}`);
    }
  }
  return out;
}

// ---- armor capacity & weapon accessory mounts (v28 rules pass) -------------------------------------------------------
/** capacity an armor mod uses at a rating: "[3]", "[Rating]", "FixedValues([1],[2],...)" (SR5 core p.437) */
export function armorModCapacity(md, rating) {
  const raw = String((md && md.armorcapacity) || '').trim();
  if (!raw) return 0;
  const fv = /^FixedValues\((.*)\)$/i.exec(raw);
  if (fv) {
    const vals = fv[1].split(',').map((x) => Number(x.replace(/[[\]\s]/g, '')));
    return vals[Math.max(0, Math.min(vals.length - 1, (rating || 1) - 1))] || 0;
  }
  const inner = raw.replace(/^\[|\]$/g, '');
  const n = evalNum(inner, { Rating: rating || 1 }, NaN);
  return Number.isFinite(n) && n > 0 ? n : 0; // negative / capacity-relative formulas: not counted
}

/** an armor piece's capacity and what its mods use; null when the armor has no capacity rating */
export function armorCapacity(def, it, modIdx) {
  const total = Number(def && def.armorcapacity);
  if (!Number.isFinite(total) || total <= 0) return null;
  let used = 0;
  for (const m of (it && it.mods) || []) used += armorModCapacity(modIdx.byId.get(m.id), m.rating);
  return { total, used };
}

/**
 * Where a weapon's accessories go (SR5 core p.431): each needs one of the mounts it lists ("Top/Under" = either),
 * the weapon has a fixed set (accessorymounts; some accessories add one - extramount). Accessories with the fewest
 * options are placed first. Returns null for weapons whose mounts the data doesn't list.
 * @returns {{mounts: string[], placed: {name: string, mount: string}[], conflicts: string[]}|null}
 */
export function weaponMounts(def, it, accIdx) {
  const base = arr(def && def.accessorymounts && def.accessorymounts.mount).map(String);
  if (!base.length) return null;
  // (accessorymounts lists the FREE mounts - built-in accessories are already accounted for: the Beretta 201T's built-in
  // stock leaves Barrel and Top - so only fitted accessories are placed)
  const fitted = ((it && it.mods) || []).map((m) => accIdx.byId.get(m.id)).filter(Boolean);
  const mounts = [...base];
  for (const a of fitted) for (const x of String(a.extramount || '').split('/').filter(Boolean)) if (!mounts.includes(x)) mounts.push(x);
  const free = new Set(mounts);
  const placed = [];
  const conflicts = [];
  const needs = fitted.map((a) => ({ a, opts: String(a.mount || '').split('/').filter((o) => o && o !== 'Internal') }))
    .filter((x) => x.opts.length).sort((x, y) => x.opts.length - y.opts.length);
  for (const { a, opts } of needs) {
    const m = opts.find((o) => free.has(o));
    if (m) { free.delete(m); placed.push({ name: a.name, mount: m }); } else conflicts.push(`${a.name} (needs ${opts.join(' or ')})`);
  }
  return { mounts, placed, conflicts };
}
