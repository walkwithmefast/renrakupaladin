// Quality rules that need more than a flat bonus (v27): Adept Ways (Street Grimoire p.176-178), spell / spirit
// restrictions of aspected-style qualities (Forbidden Arcana p.43-47), Infected & drake optional powers (Run Faster
// p.134-137, Howling Shadows p.163, Dark Terrors), and a set of one-off qualities. Everything here is pure: derive() calls
// these helpers, and the UI reads what derive() returns.
import { idx, arr, txt, num } from './data.js';

// ---------------------------------------------------------------- Adept Ways (Street Grimoire p.176-178)
export const WAYS_PAGE = 176;
const WAY_NAMES = ["The Artisan's Way", "The Artist's Way", "The Athlete's Way", "The Beast's Way", "The Invisible Way",
  "The Magician's Way", "The Speaker's Way", "The Spiritual Way", "The Warrior's Way"];
export const wayOf = (qualityNames) => WAY_NAMES.find((w) => qualityNames.has(w.toLowerCase())) || '';

/**
 * Can this power take the Way discount? The power's own `adeptwayrequires` names the Ways that list it; the Magician's Way
 * may pick any power except Improved Reflexes (`magicianswayforbids`); the Beast's and Spiritual Ways may pick one power
 * from another Way's list (`extra` = that one allowed exception).
 */
export function wayEligible(powerDef, way, { extra = false } = {}) {
  if (!way || !powerDef) return false;
  const req = powerDef.adeptwayrequires;
  if (way === "The Magician's Way") return !(req && req.magicianswayforbids !== undefined);
  const listed = arr(req && req.required && req.required.oneof && req.required.oneof.quality).map(String);
  if (listed.includes(way)) return true;
  return extra && (way === "The Beast's Way" || way === "The Spiritual Way") && listed.length > 0;
}

/** Power Points saved by the Way discount on one level of this power: half its cost (0.25 PP powers can't be halved) */
export function wayDiscount(powerDef) {
  const per = num(powerDef && powerDef.points);
  if (per <= 0.25) return 0;
  const way = powerDef.adeptway !== undefined ? num(powerDef.adeptway) : per / 2;
  return Math.max(0, per - way);
}

/** how many powers may be discounted: one per 2 points of Magic (SR5 SG p.176) */
export const wayDiscountSlots = (magic) => Math.floor(Math.max(0, magic) / 2);

/**
 * Bonding a focus costs 2 Karma less for some Ways (Chummer `focusbindingkarmacost`: Warrior - weapon foci; Artisan /
 * Artist / Athlete / Invisible / Speaker - a qi focus holding Improved Ability for one of the Way's skills).
 * @param {object[]} rules  the Way quality's focusbindingkarmacost entries
 * @param {object} focusDef, heldText e.g. "Improved Ability (skill) (Pistols)"
 */
export function focusBondDiscount(rules, focusDef, heldText) {
  for (const r of arr(rules)) {
    if (!r || typeof r !== 'object' || txt(r.name) !== focusDef.name) continue;
    const need = txt(r.extracontains);
    if (need && !String(heldText || '').includes(need)) continue;
    return -num(txt(r.val)); // positive number of Karma saved
  }
  return 0;
}

// ---------------------------------------------------------------- spell & spirit restrictions (Forbidden Arcana p.43-47)
export const SPELL_CATEGORIES = ['Combat', 'Detection', 'Health', 'Illusion', 'Manipulation'];
export const ELEMENTS = ['Air', 'Earth', 'Fire', 'Water'];
const CAT_KEY = { Combat: 'spiritcombat', Detection: 'spiritdetection', Health: 'spirithealth', Illusion: 'spiritillusion', Manipulation: 'spiritmanipulation' };

/** the spell category a tradition ties to an element's spirit (Hermetic: Fire -> Combat); '' if the tradition has none */
export function elementCategory(tradition, element) {
  const t = idx('traditions', 'traditions').byName.get(String(tradition || '').toLowerCase());
  const sp = (t && t.spirits) || {};
  for (const [cat, key] of Object.entries(CAT_KEY)) if (new RegExp(`\\b${element}\\b`, 'i').test(txt(sp[key]))) return cat;
  return '';
}

/**
 * What an aspect-style quality restricts, from its name + the player's picks (quality `choice`):
 * Apprentice: one spell category + one spirit type; Elementalist (X): the category + spirits of element X;
 * Hedge Witch/Wizard: one spell category. Returns {spellCats: [..] | null, spirits: [..] | null, label}.
 */
export function magicRestriction(q, tradition) {
  const n = q.name || '';
  const c = q.choice || {};
  if (n === 'Apprentice') return { spellCats: c.category ? [c.category] : null, spirits: c.spirit ? [c.spirit] : null, label: 'Apprentice', needs: ['category', 'spirit'] };
  if (n === 'Hedge Witch/Wizard') return { spellCats: c.category ? [c.category] : null, spirits: null, label: 'Hedge Witch/Wizard', needs: ['category'] };
  const m = /^Elementalist \((\w+)\)$/.exec(n);
  if (m) {
    const cat = elementCategory(tradition, m[1]);
    return { spellCats: cat ? [cat] : null, spirits: [`Spirit of ${m[1]}`], label: n, element: m[1], needs: [] };
  }
  return null;
}

// ---------------------------------------------------------------- Infected & drake optional powers
export const OPTIONAL_POWERS_PAGE = 136; // Run Faster, "Infected Optional Powers" table
// Karma per optional power from the Run Faster table (p.136) - Chummer's data carries costs only for Drake and Dark Terrors
// ("Infected" category) powers
const RF_OPTIONAL_KARMA = [
  [/^Armor$/, 6, 'per point'], [/^Compulsion/, 9], [/^Enhanced Senses?/, 3], [/^Fear/, 9], [/^Immunity/, 6], [/^Influence/, 9],
  [/^Magical Guard/, 9], [/^Mist Form/, 12], [/^Paralyzing Howl/, 12], [/^Regeneration/, 12],
];
export function optionalPowerKarma(name, def) {
  const hit = RF_OPTIONAL_KARMA.find(([re]) => re.test(name));
  if (hit) return hit[1];
  return def && def.karma !== undefined ? num(def.karma) : null;
}

/**
 * The optional powers a character may buy: every owned quality's `optionalpowers` (the Infected type's list), plus - for a
 * `limitcritterpowercategory` (Infected, Drake) - the critter powers of that category that have a Karma price; Wildcard
 * Chimera opens every Infected type's optional list (Dark Terrors p.163).
 * @returns {{name: string, select: string, def: object, karma: number|null, from: string}[]}
 */
export function optionalPowerChoices(qualities) {
  const cp = idx('critterpowers', 'powers');
  const out = [];
  const seen = new Set();
  const add = (name, select, from) => {
    const def = cp.byName.get(String(name).toLowerCase());
    const key = `${name}|${select}`;
    if (!def || seen.has(key)) return;
    seen.add(key);
    out.push({ name: def.name, select, def, karma: optionalPowerKarma(name, def), from });
  };
  const optional = (q) => arr(q.def.bonus && q.def.bonus.optionalpowers && q.def.bonus.optionalpowers.optionalpower || q.def.bonus && q.def.bonus.optionalpowers);
  const wildcard = qualities.some((q) => q.name === 'Wildcard Chimera');
  const pool = wildcard ? idx('qualities', 'qualities').list.filter((d) => d.bonus && d.bonus.optionalpowers).map((d) => ({ name: d.name, def: d })) : qualities;
  for (const q of pool) {
    for (const o of optional(q)) {
      if (!o) continue;
      if (typeof o === 'object') add(txt(o._ ?? o), txt(o['@select']), wildcard ? 'Wildcard Chimera' : q.name);
      else add(txt(o), '', wildcard ? 'Wildcard Chimera' : q.name);
    }
  }
  for (const q of qualities) {
    const cat = q.def.bonus && txt(q.def.bonus.limitcritterpowercategory);
    if (!cat) continue;
    for (const def of cp.list.filter((p) => p.category === cat && p.karma !== undefined && !p.hide)) add(def.name, '', q.name);
  }
  return out;
}

// ---------------------------------------------------------------- one-offs
/** Dealer Connection's vehicle classes (Rigger 5.0 p.33) -> the data's vehicle categories */
export const VEHICLE_CLASSES = {
  Drones: (cat) => /^Drones/.test(cat),
  Groundcraft: (cat) => ['Bikes', 'Cars', 'Trucks', 'Municipal/Construction', 'Corpsec/Police/Military', 'Hovercraft'].includes(cat),
  Watercraft: (cat) => ['Boats', 'Submarines'].includes(cat),
  Aircraft: (cat) => ['Rotorcraft', 'Fixed-Wing Aircraft', 'VTOL/VSTOL', 'LTAV'].includes(cat),
};

/** full cyberlimbs (arms / legs), for Redliner and Cyber-Singularity Seeker (Chrome Flesh p.54-55) */
export function fullCyberlimbs(augs) {
  const limbs = augs.filter((a) => a.kind === 'cyberware' && /\bFull (Arm|Leg)\b/.test(a.def.name));
  return { all: limbs.length, armsLegs: limbs.length };
}

/**
 * Career Karma cost of raising a skill from `from` by `n` ranks at `mult` Karma per new rank, with rank-range adjustments
 * (Linguist / College Education / Technical School: -1 per rank from rank 3; Jack of All Trades: -1 up to rank 5, +2 above;
 * each rank costs at least 1).
 * @param {{val: number, min?: number, max?: number}[]} adj
 */
export function adjustedStepCost(from, n, mult, adj) {
  let total = 0;
  for (let r = from + 1; r <= from + n; r++) {
    let c = r * mult;
    for (const a of adj) if ((a.min == null || r >= a.min) && (a.max == null || r <= a.max)) c += a.val;
    total += Math.max(1, c);
  }
  return total;
}

/** the career-only rank adjustments for a skill: category-specific ones (Linguist: Language) and, for Jack of All Trades,
 *  every active or knowledge skill */
export function careerRankAdjust(fx, { active, category }) {
  return fx.filter((e) => e.t === 'rankcost' && (e.cat ? e.cat === category : e.scope === (active ? 'active' : 'knowledge')))
    .map((e) => ({ val: e.v, min: e.min, max: e.max }));
}
