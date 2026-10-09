// Mutating helpers used by the UI. Each takes a draft character `ch` (already cloned by store.update)
// and the derived snapshot `d` from *before* the change, and applies a +1 / -1 step using the
// cheapest available currency first: priority points, then karma (creation) or advancement (career).
import { ATTR_KEYS, ALL_ATTRS } from './data.js';
import { PRIORITY_KEYS } from './rules.js';
import { heritageOptions, talentOptions } from './character.js';
import { priorityLines, validPriorityLine, applyPriorityLine, letterAllowed } from './priorities.js';

const tierKey = (ch) => (ch.mode === 'create' ? 'k' : 'a');

/** raise / lower a tier record by one, spending priority points if any remain (p), else karma. */
function stepTier(ch, t, dir, pointsLeft) {
  if (dir > 0) {
    if (ch.mode === 'create' && pointsLeft > 0) { t.p++; return { usedPoint: true }; }
    t[tierKey(ch)]++;
    return { usedPoint: false };
  }
  if (t.a > 0) t.a--;
  else if (ch.mode === 'career') return {}; // creation purchases are locked once the character is finalized
  else if (t.k > 0) t.k--;
  else if (t.p > 0) { t.p--; return { usedPoint: true, freed: true }; }
  return {};
}

export function setAttrRating(ch, d, key, target) {
  const a = d.attr[key];
  const t = (ch.attrs[key] ||= { p: 0, k: 0, a: 0 });
  const special = !ATTR_KEYS.includes(key);
  let left = special ? d.pri.specialPtsTotal - d.used.specialPts : d.pri.attrPtsTotal - d.used.attrPts;
  let cur = a.natural;
  target = Math.max(a.base, Math.min(a.max, target));
  // creation: magic/resonance can't be raised past base by priority points unless heritage grants special points
  while (cur < target) {
    const r = stepTier(ch, t, +1, left);
    if (r.usedPoint) left--;
    cur++;
  }
  while (cur > target) {
    const r = stepTier(ch, t, -1, left);
    if (r.freed) left++;
    cur--;
  }
}

export function setSkillRating(ch, d, skill, target) {
  const s = (ch.skills[skill.id] ||= { p: 0, k: 0, a: 0, spec: '' });
  // Step Five: individual skill points can't raise skills that were bought as a group; that takes Karma (Step Seven)
  let left = skill.gRating > 0 ? 0 : d.pri.skillPtsTotal - d.used.skillPts;
  const cap = ch.mode === 'create' ? d.R.maxSkillCreate : d.R.maxSkill;
  const own = skill.rating - skill.gRating; // group contribution is separate
  const floor = skill.f;
  let cur = own;
  target = Math.max(floor, Math.min(cap - skill.gRating, target - skill.gRating));
  while (cur < target) {
    const r = stepTier(ch, s, +1, left);
    if (r.usedPoint) left--;
    cur++;
  }
  while (cur > target) {
    const r = stepTier(ch, s, -1, left);
    if (r.freed) left++;
    cur--;
  }
  if (s.p + s.k + s.a === 0 && !s.spec) delete ch.skills[skill.id];
}

export function setGroupRating(ch, d, group, target) {
  if (group.broken) return; // broken groups can't be raised or lowered as a whole
  const g = (ch.groups[group.name] ||= { p: 0, k: 0, a: 0 });
  let left = d.pri.groupPtsTotal - d.used.groupPts;
  const cap = ch.mode === 'create' ? d.R.maxSkillCreate : d.R.maxSkill;
  let cur = group.rating;
  target = Math.max(group.f, Math.min(cap, target));
  while (cur < target) {
    const r = stepTier(ch, g, +1, left);
    if (r.usedPoint) left--;
    cur++;
  }
  while (cur > target) {
    const r = stepTier(ch, g, -1, left);
    if (r.freed) left++;
    cur--;
  }
  if (g.p + g.k + g.a === 0) delete ch.groups[group.name];
}

export function setKnowRating(ch, d, uid, target) {
  const k = ch.know.find((x) => x.uid === uid);
  if (!k) return;
  const free = d.used.knowPool - d.used.knowUsed;
  const skillLeft = d.pri.skillPtsTotal - d.used.skillPts;
  let left = ch.mode === 'create' ? free + skillLeft : 0;
  const cap = ch.mode === 'create' ? d.R.maxSkillCreate : d.R.maxSkill;
  let cur = (k.p || 0) + (k.k || 0) + (k.a || 0) + (k.f || 0);
  target = Math.max(k.f || 0, Math.min(cap, target));
  while (cur < target) {
    const r = stepTier(ch, k, +1, left);
    if (r.usedPoint) left--;
    cur++;
  }
  while (cur > target) {
    const r = stepTier(ch, k, -1, left);
    if (r.freed) left++;
    cur--;
  }
}

/** choose a priority letter for a column; the other column holding it gets this column's old letter (a swap).
 *  Letters outside the character's stat line (e.g. A on Street Scum) are refused. */
export function setPriority(ch, col, letter) {
  const old = ch.pri[col];
  if (old === letter || !letterAllowed(ch.pri, ch.priTable, col, letter)) return;
  const other = PRIORITY_KEYS.find((c) => c !== col && ch.pri[c] === letter);
  if (other) ch.pri[other] = old;
  ch.pri[col] = letter;
  sanitizeAfterPriority(ch);
}

/** switch resources table; if the letters don't fit the new table's stat lines, re-letter them (keeping their order) */
export function setPriorityTable(ch, table) {
  ch.priTable = table;
  if (!validPriorityLine(ch.pri, table)) setPriorityLine(ch, priorityLines(table)[0]);
}

/** Street Scum: switch between its stat lines (BCDEE / CCDDE), keeping the columns' order */
export function setPriorityLine(ch, line) {
  ch.pri = applyPriorityLine(ch.pri, line);
  sanitizeAfterPriority(ch);
}

/** keep metatype / talent legal after a priority change and clear spent-from-priority tiers that no longer apply */
export function sanitizeAfterPriority(ch) {
  const her = heritageOptions(ch.pri.heritage);
  if (her.length && !her.some((o) => o.name === ch.metatype)) { ch.metatype = her[0].name; ch.variant = ''; }
  const tal = talentOptions(ch.pri.talent);
  if (tal.length && !tal.some((t) => t.value === ch.talent)) {
    ch.talent = (tal.find((t) => t.value === 'Mundane') || tal[0]).value;
    ch.talentPicks = { skills: [], group: '' };
  }
}

export function finalize(ch, d) {
  if (ch.mode !== 'create') return;
  ch.mode = 'career';
  const carry = Math.max(0, Math.min(d.karma.left, d.R.karmaCarryover));
  ch.career = { earned: carry, log: [{ t: Date.now(), kind: 'karma', amt: carry, note: 'Carried over from creation' }], nuyenEarned: 0 };
  ch.nuyenAdjust = d.nuyen.total - Math.max(0, d.nuyen.left - d.R.nuyenCarryover); // creation budget carries forward; new purchases draw it down
  ch.karmaConverted = 0;
}

/**
 * Undo "Finish creation": unlock the priority table and creation-only editing again.
 *
 * Career-purchased ('a' tier) ranks on attributes, skills, groups and knowledge are folded into the
 * creation ('k', Karma) tier. Under the default rules each level costs the same whether it's tracked as
 * a creation or an advancement purchase, so this is exactly cost-neutral - nothing gets cheaper or pricier,
 * it just moves which bucket counts it. (A house rule that gives creation and advancement Karma costs
 * different values would change the total here; there's no way around that if the price itself changed.)
 *
 * Your current Karma and nuyen totals are preserved: nuyen by adjusting the carry-over so the creation
 * formula lands on the same total you had a moment ago, and Karma by re-deriving it under creation rules
 * (25 + negative-quality Karma, capped at the usual limits) - which can surface a "qualities over the
 * limit" warning if you bought qualities during career, the same check creation always enforces.
 *
 * Untouched: your priority choices, metatype/talent, all owned items, and play state (damage, Edge used,
 * ammo, the journal) - this only changes how future edits are tracked, not what's already on the sheet.
 */
export function backToCreation(ch, d) {
  if (ch.mode !== 'career') return;
  const keepNuyen = d.nuyen.total;

  for (const key of ALL_ATTRS) {
    const t = ch.attrs[key];
    if (t && t.a) { t.k += t.a; t.a = 0; }
  }
  for (const g of Object.values(ch.groups)) {
    if (g.a) { g.k += g.a; g.a = 0; }
  }
  for (const s of Object.values(ch.skills)) {
    if (s.a) { s.k += s.a; s.a = 0; }
    if (s.specSrc === 'a') s.specSrc = 'k';
  }
  for (const k of ch.know) {
    if (k.a) { k.k += k.a; k.a = 0; }
    if (k.specSrc === 'a') k.specSrc = 'k';
  }
  // these only affect cost while ch.mode is 'career' (see derive()); clear them so a future "Finish
  // creation" -> career round trip doesn't re-charge career pricing for things bought last time around
  for (const q of ch.qualities) q.a = false;
  for (const c of ch.contacts) c.a = false;
  for (const s of ch.spells) s.a = false;
  for (const cf of ch.complexForms) cf.a = false;

  ch.mode = 'create';
  ch.karmaConverted = 0;
  ch.nuyenAdjust = keepNuyen - d.pri.resourceNuyen;
}
