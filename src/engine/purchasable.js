// "Can this character take this item?" - for the pickers' "Hide what I can't take" toggle.
// Each check gives the item the benefit of the doubt (its lowest rating, the best cyberware grade allowed), so
// something is only called unavailable when no version of it could be taken. Checks:
//   - requirements: Chummer's <required>/<forbidden> (needs Magic / Resonance, a quality, a metatype, ...)
//   - availability above the creation limit (character creation only - afterwards anything can be sourced)
//   - Essence: an augmentation that would take Essence to 0 or below
//   - positive qualities past the creation Karma limit
// Money and Karma aren't checked: both can be converted or earned, so "can't afford it yet" isn't "can't take it".
import { idx, num } from './data.js';
import { priceItem } from './character.js';
import { blockedReason, reqContext } from './requirements.js';

const r2 = (x) => Math.round(x * 100) / 100;

/** Essence multiplier of the best grade the rules allow (e.g. Alphaware's 0.8 unless house rules ban it). Variants
 *  that need something extra - "Alphaware (Adapsin)" needs the Adapsin bioware, "Standard (Burnout's Way)" a quality -
 *  don't count: an ordinary character can't just pick them. */
export function bestGradeEss(kind, R) {
  let best = 1;
  for (const g of idx(kind, 'grades').list) {
    if (g.hide || g.name === 'None' || g.name.includes('(') || (R.bannedGrades || []).includes(g.name)) continue;
    const m = num(g.ess, 1);
    if (m > 0 && m < best) best = m;
  }
  return best;
}

/**
 * Build a checker for one character: `(def) => reason | null`. `kind` is the picker's item kind ('gear',
 * 'weapons', 'cyberware', 'qualities', 'spells', 'accessories', ...); the price math uses `priceKind` if given.
 */
export function unavailabilityChecker(kind, ch, d, { priceKind } = {}) {
  const ctx = reqContext(ch, d);
  const create = ch.mode === 'create';
  const R = d.R;
  const aug = kind === 'cyberware' || kind === 'bioware';
  const gradeEss = aug ? bestGradeEss(kind, R) : 1;
  const posQ = kind === 'qualities'
    ? d.qualities.filter((q) => !q.auto && q.def.category === 'Positive').reduce((s, q) => s + Math.abs(q.karma), 0)
    : 0;
  // SR5 core p.71: Positive Qualities may exceed the 25-Karma limit if matched by an equal amount of Negative
  // Quality Karma beyond ITS 25-Karma limit (the extra Negative Karma still gives no bonus Karma - see character.js).
  const negQ = kind === 'qualities'
    ? d.qualities.filter((q) => !q.auto && q.def.category === 'Negative').reduce((s, q) => s + Math.abs(q.karma), 0)
    : 0;
  const posLimit = R.qualityKarmaLimit + Math.max(0, negQ - R.qualityKarmaLimit);
  const spellLimits = kind === 'spells' ? (d.magicLimits || []).filter((l) => l.spellCats) : [];
  return (def) => {
    for (const l of spellLimits) if (!l.spellCats.includes(def.category)) return `${l.label}: only ${l.spellCats.join(' / ')} spells`;
    const req = blockedReason(def, ctx);
    if (req) return req === 'Requirements not met' ? requirementText(def, ctx) : req.startsWith('Conflicts') ? conflictText(def, ctx) : req;
    if (kind === 'qualities') {
      if (create && def.category === 'Positive' && posQ + Math.abs(num(def.karma)) > posLimit) {
        return `Over the ${posLimit} Karma limit for positive qualities (${posQ} used)`;
      }
      return null;
    }
    if (def.avail == null && !aug) return null;
    const p = priceItem(priceKind || kind, def, { rating: Math.max(1, num(def.minrating, 1)) });
    if (create && p.avail.n > R.maxAvailCreate) return `Availability ${p.avail.n} (max ${R.maxAvailCreate} at creation)`;
    if (aug) {
      const ess = r2(p.ess * gradeEss);
      if (ess > 0 && r2(d.essence - ess) <= 0) return `Needs ${ess} Essence (${d.essence.toFixed(2)} left)`;
    }
    return null;
  };
}

/** the most useful short explanation for a failed <required> block */
function requirementText(def, ctx) {
  const req = def.required || {};
  const flat = JSON.stringify(req);
  if (/"magenabled"/.test(flat) && !ctx.magic) return 'Needs a Magic rating';
  if (/"resenabled"/.test(flat) && !ctx.resonance) return 'Needs a Resonance rating';
  // name what's missing for initiation techniques: Arts (Street Grimoire), prerequisite metamagics, the enhanced power
  const want = (key, have) => {
    const names = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (k === key) names.push(...[].concat(v).map(String));
        else if (typeof v === 'object') walk(v);
      }
    };
    walk(req);
    return [...new Set(names)].filter((n) => !have.has(n.toLowerCase()));
  };
  const bits = [];
  const arts = want('art', ctx.arts || new Set());
  const mm = want('metamagic', ctx.metamagics || new Set());
  const pw = want('power', ctx.powers || new Set());
  if (arts.length) bits.push(`the Art ${arts.join(' or ')}`);
  if (mm.length) bits.push(`the metamagic ${mm.join(', ')}`);
  if (pw.length) bits.push(`the power ${pw.join(' or ')}`);
  // qualities (e.g. Trust Fund: "SINner (National)" or "SINner (Corporate)") - "or" inside a oneof, "and" inside an allof
  const qBits = [];
  const walkQ = (node, mode) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'oneof' || k === 'allof') { for (const g of [].concat(v)) walkQ(g, k); continue; }
      if (k !== 'quality') continue;
      const names = [].concat(v).map(String);
      if (names.some((n) => ctx.qualities.has(n.toLowerCase()))) continue; // this part is satisfied
      qBits.push(names.join(mode === 'oneof' ? ' or ' : ' and '));
    }
  };
  walkQ(req, 'allof');
  if (qBits.length && qBits.join('').length < 90) bits.push(qBits.join(' and '));
  if (bits.length) return `Needs ${bits.join(' and ')}`;
  return 'Requirements not met';
}

/** name the quality you already own that a <forbidden> block conflicts with */
function conflictText(def, ctx) {
  const names = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'quality') names.push(...[].concat(v).map(String));
      else if (typeof v === 'object') walk(v);
    }
  };
  walk(def.forbidden);
  const owned = names.filter((n) => ctx.qualities.has(n.toLowerCase()));
  return owned.length ? `Can't be combined with ${owned.join(', ')}` : 'Conflicts with something you already have';
}
