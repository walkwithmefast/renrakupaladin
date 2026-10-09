// Cyberware capacity (SR5 core p.451-461): cybereyes, cyberears, cyberlimbs, cyberskulls/torsos and implant weapons
// have a Capacity; enhancements installed in one ("[2]" in the data) use that capacity instead of Essence. Which
// enhancements fit which parent comes from Chummer's data: the parent's `allowsubsystems.category` list, plus an
// enhancement's own `required.parentdetails` name rule (a Gyromount needs a full or lower cyberarm).
import { arr, txt } from './data.js';
import { evalNum } from './expr.js';

const inner = (cap) => { const m = /^\[(.*)\]$/.exec(String(txt(cap) ?? '').trim()); return m ? m[1] : null; };
/** does this cyberware go inside another piece (a bracketed capacity cost)? */
export const isEnhancement = (def) => !!def && inner(def.capacity) != null;
/** capacity a parent provides at its rating (0 if it holds nothing) */
export function capacityProvided(def, rating) {
  if (!def || !def.allowsubsystems || isEnhancement(def)) return 0;
  const raw = String(txt(def.capacity) ?? '').trim();
  return raw ? Math.max(0, Math.round(evalNum(raw, { Rating: rating || 1 }, 0))) : 0;
}
/** capacity an enhancement takes at its rating */
export function capacityCost(def, rating) {
  const raw = inner(def && def.capacity);
  return raw == null ? 0 : Math.max(0, Math.round(evalNum(raw, { Rating: rating || 1 }, 0)));
}

/** can `childDef` be installed in `parentDef`? */
export function fitsIn(childDef, parentDef) {
  if (!isEnhancement(childDef) || !parentDef || !parentDef.allowsubsystems) return false;
  const cats = arr(parentDef.allowsubsystems.category).map((c) => String(txt(c)));
  if (!cats.includes(String(childDef.category))) return false;
  const pd = childDef.required && childDef.required.parentdetails;
  if (pd) {
    const names = arr((pd.OR || pd).name).map((n) => (typeof n === 'object' ? String(txt(n._ ?? n)) : String(n)));
    if (names.length && !names.some((n) => String(parentDef.name).includes(n))) return false;
  }
  return true;
}

/**
 * capacity use for every owned parent: owned = [{it, def}] (cyberware or bioware entries)
 * -> Map(parentUid -> {total, used, children: [{it, def, cost}]})
 */
export function capacityUse(owned) {
  const out = new Map();
  for (const { it, def } of owned) {
    const total = capacityProvided(def, it.rating);
    if (total > 0 || (def && def.allowsubsystems)) out.set(it.uid, { total, used: 0, children: [] });
  }
  for (const { it, def } of owned) {
    if (!it.parent || !out.has(it.parent)) continue;
    const cost = capacityCost(def, it.rating);
    const p = out.get(it.parent);
    p.used += cost;
    p.children.push({ it, def, cost });
  }
  return out;
}
