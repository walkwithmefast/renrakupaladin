// Fake SINs: which identity the character is currently broadcasting (SR5 core p.443 - a fake SIN is a whole
// false identity with its own name; licenses are attached to one SIN). The choice is play state (ch.play.sin), not
// part of the build: switching SINs is something you do at the table.
import { playState } from './edge.js';

export const SIN_PAGE = 443;
const isFakeSin = (def) => !!def && /^fake sin\b/i.test(def.name || '');
const isLicense = (def) => !!def && /licen[cs]e/i.test(def.name || '');

/**
 * Every Fake SIN the character owns, with the name it carries (the item's notes - Chummer's "extra", e.g.
 * "Won Justice") and the licenses attached to it (Fake License items nested under it).
 * @param {{it: object, def: object}[]} gearEntries  derive()'s items.gear
 */
export function fakeSins(gearEntries) {
  const out = [];
  let n = 0;
  for (const e of gearEntries) {
    if (!isFakeSin(e.def)) continue;
    n += 1;
    const alias = String(e.it.notes || '').trim().split('\n')[0].trim();
    const licenses = gearEntries.filter((l) => l.it.parent === e.it.uid && isLicense(l.def))
      .map((l) => String(l.it.notes || '').trim() || l.def.name);
    out.push({ uid: e.it.uid, alias, label: alias || `Fake SIN #${n}`, rating: Number(e.it.rating) || 1, licenses, burned: !!e.it.burned });
  }
  return out;
}

/** the SIN currently in use, or null for the character's own identity (also when the chosen SIN was sold/lost) */
export function activeSin(ch, gearEntries) {
  const uid = playState(ch).sin;
  return (uid && fakeSins(gearEntries).find((s) => s.uid === uid)) || null;
}

/** switch identity; '' / null = drop the cover and go by your own name */
export function setActiveSin(x, uid) {
  x.play = { ...playState(x), sin: uid || '' };
}

/**
 * Burn (or restore) a SIN. A burned SIN has been flagged as fake - it fails any check against it - so it's a fact about
 * the item (`it.burned`), not play state; it stays selectable (you may be stuck with it), and the UI stamps it.
 */
export function setSinBurned(x, uid, burned = true) {
  const g = (x.gear || []).find((z) => z.uid === uid);
  if (!g) return;
  if (burned) g.burned = true; else delete g.burned;
}
