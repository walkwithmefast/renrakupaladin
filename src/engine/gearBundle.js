// Creating owned gear, and expanding the "comes bundled with" tree some gear declares (a cyberdeck's Sim
// Module and Commlink Functionality, which itself bundles a Music Player, a Micro Camera, and so on -
// SR5 core p.438-439). Kept separate from the UI (items.jsx) so it can be unit-tested directly.
import { idx, arr, num, txt } from './data.js';
import { uid } from './character.js';
import { variableRange } from './expr.js';

const RATED = new Set(['gear', 'cyberware', 'bioware', 'armor']);

export function newOwned(kind, def) {
  const it = { uid: uid(), id: def.id, name: def.name };
  const max = num(def.rating);
  if (RATED.has(kind) && max > 0) it.rating = Math.max(1, num(def.minrating, 1));
  if (kind === 'cyberware' || kind === 'bioware') it.grade = 'Standard';
  if (kind === 'gear') it.qty = 1;
  const vr = variableRange(def.cost);
  if (vr) it.variable = vr.min;
  return it;
}

/** match a <gears><usegear> reference ({name, category?}) to the catalogue entry it names. */
export function resolveUsegear(use) {
  const gidx = idx('gear', 'gears');
  const name = txt(use.name ?? use);
  const cat = txt(use.category);
  return gidx.list.find((g) => g.name === name && (!cat || g.category === cat)) || gidx.byName.get(name.toLowerCase()) || null;
}

/**
 * Some gear (cyberdecks, commlinks, and whatever they in turn bundle) ships with included sub-items -
 * e.g. a cyberdeck's Sim Module and Commlink Functionality, which itself bundles a Music Player, a
 * Micro Camera and so on. Adding the parent auto-adds the whole tree as free, non-removable-on-their-
 * own children (`child: true`, `free: true`, `parent: <owner's uid>`), matching how importing a
 * Chummer save already represents them.
 */
export function spawnGearBundle(def, parentUid = null, depth = 0) {
  const it = newOwned('gear', def);
  if (parentUid) { it.parent = parentUid; it.child = true; it.free = true; }
  const out = [it];
  const uses = depth < 5 ? arr(def.gears && def.gears.usegear) : [];
  for (const use of uses) {
    const childDef = resolveUsegear(use);
    if (!childDef) continue;
    const kids = spawnGearBundle(childDef, it.uid, depth + 1);
    if (use.rating) kids[0].rating = num(use.rating);
    out.push(...kids);
  }
  return out;
}

/** every gear entry (of the {it,def,...} shape) descended from `rootUid`, any depth, flattened. */
export function gearDescendants(entries, rootUid) {
  const out = [];
  const stack = [rootUid];
  while (stack.length) {
    const pid = stack.pop();
    for (const e of entries) if (e.it.parent === pid && !out.includes(e)) { out.push(e); stack.push(e.it.uid); }
  }
  return out;
}

/**
 * One-time repair for characters saved before bundled gear tracked `.parent`: import used to flag a
 * child with `child: true` but never recorded *which* item it belonged to, so already-saved characters
 * can't show their bundles nested even after that got fixed. This re-derives the links from the
 * catalogue's own `gears.usegear` lists against the character's existing (already flat) gear array,
 * matching by name in the array's original depth-first order - the same order a fresh import or a
 * fresh "+ Add" would produce. Safe to call on every load: already-linked items are left alone, and a
 * character with nothing to repair is untouched (returns false).
 */
export function relinkGearBundles(ch) {
  const list = ch && ch.gear;
  if (!list || list.length === 0) return false;
  const gidx = idx('gear', 'gears');
  const resolveDef = (it) => gidx.byId.get(it.id) || gidx.byName.get(String(it.name || '').toLowerCase());
  const used = new Set();
  let changed = false;
  const claim = (fromIdx, name) => {
    for (let i = fromIdx; i < list.length; i++) if (!used.has(i) && !list[i].parent && list[i].name === name) return i;
    return -1;
  };
  const relink = (i, depth) => {
    if (depth > 6) return;
    const def = resolveDef(list[i]);
    const uses = def && def.gears && arr(def.gears.usegear);
    if (!uses || !uses.length) return;
    for (const use of uses) {
      const ci = claim(i + 1, txt(use.name ?? use));
      if (ci === -1) continue;
      used.add(ci);
      list[ci].parent = list[i].uid;
      if (!list[ci].child) list[ci].child = true;
      changed = true;
      relink(ci, depth + 1);
    }
  };
  for (let i = 0; i < list.length; i++) relink(i, 0);
  return changed;
}
