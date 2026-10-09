// Attribute Boost (adept power, SR5 core p.309): Simple Action, roll Magic + the power's level. Each hit raises the
// chosen Physical attribute by 1, up to its augmented maximum - for dice pools only (Physical limit and Initiative
// don't change). It lasts twice the hits in Combat Turns; when it runs out you take Drain equal to the power's level.
// Active boosts are play state (ch.play.boosts: [{uid, attr, v, turns, drain, src}]); derive() adds them to dice pools.
import { playState } from './edge.js';
const uid = () => `b${Math.random().toString(36).slice(2, 9)}`;

export const BOOST_PAGE = 309;
export const isAttributeBoost = (def) => !!def && /^Attribute Boost\b/.test(def.name || '');

/** the test's dice pool: Magic + level */
export const boostPool = (d, level) => (d.attr.MAG.enabled ? d.attr.MAG.total : 0) + Math.max(1, Number(level) || 1);

/** how much `hits` actually adds right now (nothing above the augmented maximum) */
export function boostAmount(d, attrKey, hits) {
  const a = d.attr[attrKey];
  if (!a || !a.enabled) return 0;
  return Math.max(0, Math.min(Number(hits) || 0, a.augMax - a.total));
}

/** start a boost from a roll; a new boost on the same attribute replaces the old one */
export function startBoost(x, d, { attr, hits, level, src = 'Attribute Boost' }) {
  const v = boostAmount(d, attr, hits);
  const p = playState(x);
  if (v <= 0) return null;
  const b = { uid: uid(), attr, v, turns: 2 * Number(hits), drain: Math.max(1, Number(level) || 1), src };
  x.play = { ...p, boosts: [...p.boosts.filter((o) => o.attr !== attr), b] };
  return b;
}

/**
 * End of a Combat Turn: every boost loses a turn. Returns the ones that just ran out (the player takes their Drain).
 * @returns {{attr: string, drain: number}[]}
 */
export function tickBoosts(x) {
  const p = playState(x);
  const ended = [];
  const left = [];
  for (const b of p.boosts) {
    const turns = b.turns - 1;
    if (turns <= 0) ended.push(b); else left.push({ ...b, turns });
  }
  x.play = { ...p, boosts: left };
  return ended;
}

export function endBoost(x, boostUid) {
  const p = playState(x);
  x.play = { ...p, boosts: p.boosts.filter((b) => b.uid !== boostUid) };
}

/** the dice-pool bonus per attribute from active boosts, e.g. {AGI: 3} */
export function boostBonus(ch) {
  const out = {};
  for (const b of playState(ch).boosts) out[b.attr] = (out[b.attr] || 0) + Math.max(0, Number(b.v) || 0);
  return out;
}
