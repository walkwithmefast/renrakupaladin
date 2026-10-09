// Core SR5 dice mechanics (core p.44-46, Edge on p.56-57): roll a pool of d6, 5s and 6s are hits, half
// or more of the dice showing a 1 is a glitch (a glitch with zero hits is a critical glitch). Kept pure
// and RNG-injectable so the hit/glitch math is unit-testable without depending on real randomness.
const d6 = (rng) => 1 + Math.floor(rng() * 6);

/** turn a list of already-rolled dice into the standard result shape */
export function summarize(dice) {
  const hits = dice.filter((v) => v >= 5).length;
  const ones = dice.filter((v) => v === 1).length;
  const glitch = dice.length > 0 && ones * 2 >= dice.length;
  const critical = glitch && hits === 0;
  return { dice: [...dice], hits, ones, glitch, critical };
}

/** a plain roll of `pool` dice (pool <= 0 rolls nothing: a valid, if unusual, "0 dice" test) */
export function rollPool(pool, rng = Math.random) {
  const n = Math.max(0, Math.round(pool));
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(d6(rng));
  return summarize(dice);
}

/**
 * Push the Limit (core p.57): add your Edge rating to the pool before rolling, and 6s explode - each 6
 * rolled adds one more die, which can explode again. Ignores limits (the caller just doesn't apply one).
 */
export function rollPushLimit(pool, edge, rng = Math.random) {
  let toRoll = Math.max(0, Math.round(pool)) + Math.max(0, Math.round(edge));
  const dice = [];
  while (toRoll > 0) {
    const v = d6(rng);
    dice.push(v);
    toRoll -= 1;
    if (v === 6) toRoll += 1;
  }
  return summarize(dice);
}

/**
 * Second Chance (core p.57): reroll every die that didn't hit (showing 1-4). Doesn't explode sixes and
 * can't fix a glitch - it only ever adds hits, so glitch/critical glitch are decided by the ORIGINAL roll.
 */
// Called shots (SR5 core p.195): take a flat -4 to the attack roll for a extra effect (disarming,
// knocking a target down, hitting a specific called location, and so on) that the GM adjudicates - the
// exact menu of effects isn't modeled here, just the dice pool penalty everyone agrees on.
export const CALLED_SHOT_PENALTY = 4;
export const CALLED_SHOT_PAGE = 195;
export const calledShotPool = (pool) => Math.max(0, Math.round(pool) - CALLED_SHOT_PENALTY);

export function rerollSecondChance(prevDice, rng = Math.random) {
  const kept = prevDice.filter((v) => v >= 5);
  const rerolled = prevDice.filter((v) => v < 5).map(() => d6(rng));
  const dice = [...kept, ...rerolled];
  const prev = summarize(prevDice);
  const next = summarize(dice);
  // Second Chance can't fix a glitch: keep the original roll's glitch/critical verdict
  return { ...next, glitch: prev.glitch, critical: prev.critical };
}
