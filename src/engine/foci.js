// Foci: enchanted items that must be bonded before their bonus works (SR5 core p.318-320). Bonding costs Karma
// (Force x a per-focus-type multiplier, the "Focus table" on p.318); you can't bond more foci than your Magic, and their
// combined Force can't exceed Magic x 5 (p.318). Only one focus adds its Force to any one test (p.318) - derive() takes
// the biggest (`focus: true` effects).
//
// The multiplier isn't in Chummer5a's XML data (it's hardcoded in the desktop app's own code, which isn't
// available here) - this table is typed from the rulebook itself. If a number here looks off, the app
// links straight to p.318 so it's a one-click check against your own book.
import { num } from './data.js';

export const FOCUS_TABLE_PAGE = 318; // SR5 core, "Focus table" (bonding cost) + the bonding limits

// Bonding cost per the Focus table (SR5 core p.318), by focus type. Matched by the LONGEST name prefix, so
// "Counterspelling Focus, Combat" and "Power Focus" both resolve. Corrected in v24 - it used to charge x3 for spirit
// foci and x2 for enchanting / metamagic foci.
const BOND_MULT = [
  ['Power Focus', 6],
  ['Weapon Focus', 3],
  // enchanting foci
  ['Alchemical Focus', 3], ['Disenchanting Focus', 3],
  // metamagic foci
  ['Centering Focus', 3], ['Flexible Signature Focus', 3], ['Masking Focus', 3], ['Spell Shaping Focus', 3],
  // spirit foci
  ['Summoning Focus', 2], ['Banishing Focus', 2], ['Binding Focus', 2],
  // spell foci (Counterspelling, Ritual Spellcasting, Spellcasting, Sustaining) and Qi foci
  ['Qi Focus', 2],
];
const DEFAULT_MULT = 2;

export const isFocus = (def) => !!def && def.category === 'Foci';

export function bondMultiplier(def) {
  const name = String((def && def.name) || '');
  let best = null;
  for (const [prefix, mult] of BOND_MULT) {
    if (name.startsWith(prefix) && (!best || prefix.length > best[0].length)) best = [prefix, mult];
  }
  return best ? best[1] : DEFAULT_MULT;
}

/** Karma cost to bond this focus at the given Force (its `rating`) */
export const bondKarma = (def, force) => Math.max(0, Math.round(num(force))) * bondMultiplier(def);

/** combined Force of every currently-bonded focus, across `d.items.gear`-shaped entries */
export function bondedForce(gearEntries) {
  return (gearEntries || []).filter((e) => isFocus(e.def) && e.it.bonded).reduce((s, e) => s + Math.max(0, num(e.it.rating)), 0);
}

/** total Karma spent bonding every currently-bonded focus */
export function totalBondKarma(gearEntries) {
  return (gearEntries || []).filter((e) => isFocus(e.def) && e.it.bonded).reduce((s, e) => s + bondKarma(e.def, e.it.rating), 0);
}

/**
 * Bonding limits (SR5 core p.318): no more bonded foci than your Magic, and their combined Force at most Magic x 5.
 * Separately (p.319 sidebar), active foci whose combined Force is above your Magic risk focus addiction - a caution only.
 */
export function focusLimits(gearEntries, magic) {
  const bonded = (gearEntries || []).filter((e) => isFocus(e.def) && e.it.bonded);
  const force = bonded.reduce((s, e) => s + Math.max(0, num(e.it.rating)), 0);
  return { count: bonded.length, force, maxCount: magic, maxForce: magic * 5, addictionRisk: force > magic };
}
