// Dice odds for the knowledge / language displays.
// A Shadowrun die hits on a 5 or 6, so each die is a hit with probability 1/3.

/** P(at least `hits` hits) when rolling `pool` dice (no limits, no Edge). */
export function chanceAtLeast(pool, hits) {
  const n = Math.max(0, Math.floor(pool));
  if (hits <= 0) return 1;
  if (hits > n) return 0;
  // P(X >= hits) = 1 - sum_{k<hits} C(n,k) p^k q^(n-k)
  const p = 1 / 3;
  const q = 2 / 3;
  let below = 0;
  let c = 1; // C(n, 0)
  for (let k = 0; k < hits; k++) {
    below += c * p ** k * q ** (n - k);
    c = (c * (n - k)) / (k + 1);
  }
  return Math.min(1, Math.max(0, 1 - below));
}

// Core rulebook p.149 (Knowledge Skill Table) and p.151 (Language Skill Table).
export const KNOWLEDGE_TIERS = [
  { label: 'General', hits: 1, text: 'General knowledge: threshold 1' },
  { label: 'Detailed', hits: 2, text: 'Detailed knowledge: threshold 2' },
  { label: 'Intricate', hits: 4, text: 'Intricate knowledge: threshold 4' },
  { label: 'Obscure', hits: 6, text: 'Obscure knowledge: threshold 6 or more' },
];

export const LANGUAGE_TIERS = [
  { label: 'Basic', hits: 1, text: 'Basic conversation (concerns of daily life), or a universal concept: threshold 1' },
  { label: 'Complex', hits: 2, text: 'Complex subject (special or limited interest topics): threshold 2' },
  { label: 'Intricate', hits: 3, text: 'Intricate subject (almost any technical subject): threshold 3' },
  { label: 'Obscure', hits: 4, text: 'Obscure subject (very technical or rare knowledge): threshold 4' },
];

/** [{label, hits, chance, text}] for one skill's dice pool */
export function oddsFor(pool, tiers) {
  return tiers.map((t) => ({ ...t, chance: chanceAtLeast(pool, t.hits) }));
}
