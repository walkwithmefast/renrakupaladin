// Cyberlimb Strength/Agility (SR5 core p.455-456): "Cyberlimbs have their own Strength and Agility ratings.
// When a particular limb is used for a test... use the attribute for that limb; in any other case, take the
// average value of all limbs involved." Nothing in this app tracks which specific limb wields which weapon (that
// would need a whole "assign this weapon to an arm" UI), so instead of guessing wrong, `bestStr`/`bestAgi` take
// the character's best available value (natural or any cyberlimb) - the number a player would actually report,
// since nobody attacks with their weaker arm on purpose. Wired into weapon/unarmed/thrown damage (`weapons.js`,
// all share one `{STR}` substitution) and into "Combat Active" skill pools (Pistols, Blades, Unarmed Combat...
// every one of them is AGI-linked and wielded with a hand/arm, so there's no non-combat use to worry about
// over-applying this to).
const LIMB_WORD = /\b(Arm|Leg|Hand|Foot)\b/;
const ARM_WORD = /\b(Arm|Hand)\b/;
const NOT_A_LIMB = /^Modular (Connector|Gear)\b/; // sockets/adapters, not limbs themselves
const CUSTOMIZED = /^(Customized|Cyberlimb Customization,)\s+(Strength|Agility)/i;
const ENHANCED = /^(Enhanced|Cyberlimb Augmentation,)\s+(Strength|Agility)/i;

/** a cyberware def that's an actual limb (or partial limb) with its own STR/AGI - not a torso/skull "shell",
 *  and not a modular connector/gear-mount (those aren't limbs, the swapped-in "... Modular" piece is). */
export function isCyberlimb(def) {
  if (!def || def.category !== 'Cyberlimb') return false;
  if (def.limbslot === 'torso' || def.limbslot === 'skull') return false;
  if (NOT_A_LIMB.test(def.name)) return false;
  return def.limbslot === 'arm' || def.limbslot === 'leg' || LIMB_WORD.test(def.name);
}

/** arm/hand (wields weapons) vs leg/foot (kicks, but doesn't hold a pistol) */
export function isArmOrHand(def) {
  if (def.limbslot === 'arm') return true;
  if (def.limbslot === 'leg') return false;
  return ARM_WORD.test(def.name);
}

/**
 * Every owned cyberlimb with its own effective Strength/Agility.
 * Base 3 (SR5 core p.456); "Customized Strength/Agility" (bought with the limb, sets the base up to natural
 * max) overrides it; "Enhanced Strength/Agility" (one of each per limb) adds its rating on top of that.
 * @param {{it, def}[]} cyberwareAugs owned cyberware entries (character.js's `augs`, `kind === 'cyberware'` only)
 */
export function cyberlimbStats(cyberwareAugs) {
  const out = [];
  for (const { it, def } of cyberwareAugs) {
    if (!isCyberlimb(def)) continue;
    let str = 3;
    let agi = 3;
    for (const c of cyberwareAugs) {
      if (c.it.parent !== it.uid || !c.def) continue;
      const rating = Number(c.it.rating) || 0;
      const isStr = /Strength/i.test(c.def.name);
      if (CUSTOMIZED.test(c.def.name)) { if (isStr) str = rating; else agi = rating; }
      else if (ENHANCED.test(c.def.name)) { if (isStr) str += rating; else agi += rating; }
    }
    out.push({ uid: it.uid, name: (it.label || def.name), str, agi, arm: isArmOrHand(def) });
  }
  return out;
}

/** best Strength for melee/unarmed/thrown weapon damage (`weapons.js`'s `{STR}` substitution) - natural or any limb */
export const bestStr = (natural, limbs) => limbs.reduce((m, l) => Math.max(m, l.str), natural);

/** best Agility for a "Combat Active" (weapon-skill) pool - natural or any arm/hand limb, not legs/feet */
export const bestAgi = (natural, limbs) => limbs.reduce((m, l) => (l.arm ? Math.max(m, l.agi) : m), natural);
