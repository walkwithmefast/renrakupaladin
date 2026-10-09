// Qualities whose benefit isn't a stat bonus (Run Faster):
//  - Made Man (p.148): a free Group Contact - your crime syndicate - at Loyalty 3; the syndicate fences for you (they keep
//    30%) and sells stolen / restricted goods at 10% off with +1 die on the Availability test.
//  - Trust Fund I-IV (p.151): needs SINner (National or Corporate); the fund pays one lifestyle and a monthly sum:
//    I Middle + 500, II Low + 2,000 + 3D6 x 100, III High + 1,000, IV Middle + 3,000 + 6D6 x 100.
// Chummer marks them with <mademan/> + <addcontact forcedloyalty="3"> and <trustfund>N</trustfund>; effects.js turns those
// into {t:'addcontact'} / {t:'trustfund'} effects, and this file has the rules that use them.
import { rollPool } from './dice.js';

export const MADE_MAN_PAGE = 148;
export const TRUST_FUND_PAGE = 151;

// "Middle" in the book is the "Medium" lifestyle in the data
export const TRUST_FUND = {
  1: { lifestyle: 'Medium', flat: 500 },
  2: { lifestyle: 'Low', flat: 2000, dice: 3 },
  3: { lifestyle: 'High', flat: 1000 },
  4: { lifestyle: 'Medium', flat: 3000, dice: 6 },
};

/** the Trust Fund level the character has (0 = none), from derive()'s effects */
export const trustFundLevel = (fx) => fx.filter((e) => e.t === 'trustfund').reduce((m, e) => Math.max(m, e.v), 0);

/** "2,000 + 3D6 x 100" - what the fund pays each month on top of the lifestyle */
export function trustFundIncomeText(level) {
  const t = TRUST_FUND[level];
  if (!t) return '';
  const n = t.flat.toLocaleString('en-US');
  return t.dice ? `${n} + ${t.dice}D6 × 100` : n;
}

/** one month's payout (rolls the dice where the level has them); rng injectable for tests */
export function trustFundPayout(level, rng) {
  const t = TRUST_FUND[level];
  if (!t) return null;
  if (!t.dice) return { amt: t.flat, note: `Trust fund (${['', 'I', 'II', 'III', 'IV'][level]})` };
  const r = rollPool(t.dice, rng);
  const sum = r.dice.reduce((s, v) => s + v, 0);
  return { amt: t.flat + sum * 100, rolled: r.dice, note: `Trust fund (${['', 'I', 'II', 'III', 'IV'][level]}): ${t.flat.toLocaleString('en-US')} + ${t.dice}D6 [${r.dice.join(', ')}] × 100` };
}

/** Made Man's contact: free (no contact Karma), a group, Loyalty 3 */
export function madeManContact(uid) {
  return { uid, name: '', role: 'Crime syndicate (group contact)', connection: 1, loyalty: 3, notes: 'Made Man - you are a member (Run Faster p.148)', a: false, free: true, group: true, mademan: true };
}

// ---- quality levels and rules Chummer's data doesn't carry (quality audit, v26) ---------------------------------
/** how many times / levels a quality can be taken: Chummer's numeric `limit` (High Pain Tolerance 3, In Debt 15), else 1 */
export function qualityMaxLevel(def) {
  const n = Number(def && def.limit);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/**
 * Effects from the book that the data leaves out, per quality level - none needed so far (checked in the v26 audit: e.g.
 * Aged's -1 physical maximums per decade ARE in the data, as specificattribute max -1). Kept as the one place to add them.
 */
export function qualityExtras() {
  return [];
}

/**
 * Street Cred, Notoriety, Public Awareness (SR5 core p.372-373). Street Cred = Karma earned / 10 (Consummate
 * Professional: / 20), Notoriety and Public Awareness come from qualities (the data's +1/-1 per listed quality, Fame), and
 * each can be adjusted by the GM (`ch.reputationAdj`).
 */
export function reputation(ch, fx) {
  const adj = ch.reputationAdj || {};
  const divisor = 10 + fx.filter((e) => e.t === 'credDivisor').reduce((s, e) => s + e.v, 0);
  const earned = ch.mode === 'career' ? Number((ch.career && ch.career.earned) || 0) : 0;
  const sum = (t) => fx.filter((e) => e.t === t).reduce((s, e) => s + e.v, 0);
  return {
    streetCred: Math.max(0, Math.floor(earned / divisor) + (Number(adj.streetCred) || 0)),
    notoriety: sum('notoriety') + (Number(adj.notoriety) || 0),
    // Erased (Run Faster p.146): Public Awareness can never go above 1
    publicAwareness: Math.min(fx.some((e) => e.t === 'erased') ? 1 : Infinity, Math.max(0, sum('publicawareness') + sum('fame') + (Number(adj.publicAwareness) || 0))),
    divisor, earned,
  };
}
