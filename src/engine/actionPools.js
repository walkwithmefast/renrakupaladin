// Ready-made dice pools for the actions a character takes at the table: Matrix actions (SR5 core p.236-241) and the
// magical / Resonance skills. Each pool is "skill + the attribute that action names", which is often NOT the attribute
// the skill itself is linked to (Matrix Perception is Computer + Intuition, Computer's own attribute is Logic).

/**
 * Pool for `skillName` rolled with `attrKey`, or null when the character can't make the test.
 * Unranked skills fall back to attribute - 1 when the skill allows defaulting.
 * @returns {{pool:number, poolSpec:number, rating:number, defaulting:boolean, spec:string}|null}
 */
export function skillWith(d, skillName, attrKey) {
  const s = d.skills.find((x) => x.name === skillName);
  const a = d.attr[attrKey];
  if (!s || !a || !a.enabled || !s.canUse) return null;
  if (s.rating > 0) {
    const pool = s.pool - (d.attr[s.attr] ? d.attr[s.attr].pool : 0) + a.pool;
    return { pool, poolSpec: pool + 2, rating: s.rating, defaulting: false, spec: s.spec };
  }
  if (!s.defaultable) return null;
  return { pool: Math.max(0, a.pool - 1), poolSpec: Math.max(0, a.pool - 1), rating: 0, defaulting: true, spec: '' };
}

// [action, skill, attribute, which Matrix attribute is the test's limit]
const MATRIX_ACTIONS = [
  ['Matrix Perception', 'Computer', 'INT', 'dp'],
  ['Matrix Search', 'Computer', 'INT', 'dp'],
  ['Trace User', 'Computer', 'INT', 'dp'],
  ['Edit File', 'Computer', 'LOG', 'a'],
  ['Erase Matrix Signature', 'Computer', 'INT', 's'],
  ['Hide', 'Electronic Warfare', 'INT', 's'],
  ['Control Device', 'Electronic Warfare', 'LOG', 's'],
  ['Jam Signals', 'Electronic Warfare', 'LOG', 'a'],
  ['Hack on the Fly', 'Hacking', 'LOG', 's'],
  ['Brute Force', 'Hacking', 'LOG', 'a'],
  ['Spoof Command', 'Hacking', 'INT', 's'],
  ['Crack File', 'Hacking', 'LOG', 'a'],
  ['Matrix attack (Cybercombat)', 'Cybercombat', 'LOG', 'a'],
];
const LIMIT_NAME = { a: 'Attack', s: 'Sleaze', dp: 'Data Processing', f: 'Firewall' };

/**
 * Matrix action pools for the active persona. Each row: `{name, skill, attr, pool, poolSpec, defaulting, spec, limit,
 * limitName}`; `can` is false when the skill can't be used at all (no ranks, no defaulting).
 */
export function matrixActionPools(d) {
  const persona = d.matrix && d.matrix.persona;
  if (!persona) return [];
  const rows = MATRIX_ACTIONS.map(([name, skill, attr, lim]) => {
    const w = skillWith(d, skill, attr);
    return { name, skill, attr, limit: persona[lim], limitName: LIMIT_NAME[lim], can: !!w, ...(w || { pool: 0, poolSpec: 0, rating: 0, defaulting: false, spec: '' }) };
  });
  // defending against Matrix attacks: Intuition + Firewall, not a skill test
  const intu = d.attr.INT.pool;
  rows.push({ name: 'Matrix defense', skill: '', attr: 'INT', limit: null, limitName: '', can: true, pool: intu + persona.f, poolSpec: intu + persona.f, rating: 0, defaulting: false, spec: '', note: `INT ${intu} + Firewall ${persona.f}` });
  return rows;
}

const MAGIC_SKILLS = ['Spellcasting', 'Ritual Spellcasting', 'Counterspelling', 'Summoning', 'Banishing', 'Binding', 'Alchemy', 'Artificing', 'Disenchanting', 'Assensing', 'Astral Combat'];
const RESONANCE_SKILLS = ['Compiling', 'Decompiling', 'Registering'];

/**
 * Pools for the magical / Resonance skills the character can actually use, each with the skill's own attribute.
 * Rows: `{name, pool, poolSpec, rating, spec, defaulting, note}`. Unranked, non-defaultable skills are left out.
 */
export function magicActionPools(d) {
  const out = [];
  const want = (names, enabled) => {
    if (!enabled) return;
    for (const name of names) {
      const s = d.skills.find((x) => x.name === name);
      if (!s) continue;
      const w = skillWith(d, name, s.attr);
      if (!w) continue;
      out.push({ name, attr: s.attr, ...w, note: `${s.attr} + ${name}` });
    }
  };
  want(MAGIC_SKILLS, d.attr.MAG.enabled);
  want(RESONANCE_SKILLS, d.attr.RES.enabled);
  return out;
}
