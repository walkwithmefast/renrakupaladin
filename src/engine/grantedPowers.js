// Free adept powers from a "pick a power" bonus (Chummer's <selectpowers>): a bonded Qi Focus grants one power worth up
// to Force x 0.25 Power Points (SR5 core p.319: "Force must be four times the Power Point cost"; its levels add to your own), and some mentor spirits' adept options grant a free level of a power
// from a short list (Chaos / Artist: Improved Potential; Holy Text: Mystic Armor or Empathic Healing - SR5 p.320-323).
// Granted powers cost no Power Points; their bonuses apply like a bought power's.
import { idx, txt, num } from './data.js';

/** read a <selectpowers><selectpower> spec: {val, limit, perLevel, allow: [names] | null} */
export function selectPowerSpec(bonus) {
  const sp = bonus && typeof bonus === 'object' && bonus.selectpowers && bonus.selectpowers.selectpower;
  if (!sp || typeof sp !== 'object') return null;
  const allowText = sp['@limittopowers'];
  return {
    val: txt(sp.val) || '1',
    perLevel: sp.pointsperlevel !== undefined ? num(txt(sp.pointsperlevel)) : null,
    allow: allowText ? String(allowText).split(',').map((s) => s.trim()).filter(Boolean) : null,
  };
}

const powerIdx = () => idx('powers', 'powers');

/**
 * The level a spec grants of a power. Power-point budgets (Qi Focus: Rating x pointsperlevel) buy as many levels as fit;
 * a plain `val` grants that many levels (1 for powers without levels).
 * @returns {number} 0 = the power can't be granted this way
 */
export function grantLevel(spec, powerDef, rating = 1) {
  if (!spec || !powerDef) return 0;
  if (spec.allow && !spec.allow.includes(powerDef.name)) return 0;
  const levelled = powerDef.levels === 'True';
  // Chummer: `limit` is how many times a power can be taken, `maxlevels` its highest level; `extrapointcost` is paid once
  // (Improved Reflexes: 1 PP per level + 0.5)
  const maxLevels = levelled ? num(powerDef.maxlevels, 99) || 99 : 1;
  const per = num(powerDef.points);
  const extra = num(powerDef.extrapointcost);
  if (spec.perLevel != null) {
    const budget = Math.max(0, num(rating)) * spec.perLevel;
    if (per <= 0) return 1;
    const lv = Math.floor((budget - extra) / per + 1e-9);
    return Math.max(0, Math.min(lv, maxLevels));
  }
  const v = spec.val === 'Rating' ? num(rating, 1) : num(spec.val, 1);
  return levelled ? Math.max(1, Math.min(v, maxLevels)) : 1;
}

/** the powers a spec allows (for a picker), each with the level it would get */
export function grantablePowers(spec, rating = 1) {
  if (!spec) return [];
  return powerIdx().list.filter((p) => !p.hide).map((def) => ({ def, level: grantLevel(spec, def, rating) })).filter((x) => x.level > 0);
}

/**
 * Every free power the character currently gets. `choice.power` holds the picked power's id (on the focus item, or
 * `ch.mentorPower` for the mentor's option).
 * @param {object} ch
 * @param {{mentorPick?: object, itemDef: Function}} ctx  mentorPick = the chosen mentor sub-option (derive() finds it)
 * @returns {{src: string, from: 'focus'|'mentor', uid?: string, def: object, level: number}[]}
 */
export function powerGrants(ch, { mentorPick, itemDef }) {
  const out = [];
  const byId = powerIdx().byId;
  for (const it of ch.gear || []) {
    const def = itemDef('gear', it);
    const spec = def && selectPowerSpec(def.bonus);
    if (!spec || !it.bonded) continue; // a focus only works while bonded
    const pdef = it.choice && it.choice.power ? byId.get(it.choice.power) : null;
    const level = grantLevel(spec, pdef, it.rating || 1);
    if (pdef && level > 0) out.push({ src: def.name, from: 'focus', uid: it.uid, def: pdef, level });
  }
  const mspec = mentorPick && selectPowerSpec(mentorPick.bonus);
  if (mspec && ch.mentorPower) {
    const pdef = byId.get(ch.mentorPower);
    const level = grantLevel(mspec, pdef, 1);
    if (pdef && level > 0) out.push({ src: `mentor: ${ch.mentor}`, from: 'mentor', def: pdef, level });
  }
  return out;
}

export const hasSelectPowers = (bonus) => !!selectPowerSpec(bonus);
