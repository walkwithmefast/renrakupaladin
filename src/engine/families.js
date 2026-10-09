// Name families: catalogue entries that are one thing with a different descriptor on the end -
// "Area Knowledge: Seattle", "Corporation: Ares Macrotechnology", "Free Insect Spirit: Bee", "Allergy (Uncommon, Mild)".
// Pickers and lists show one entry per family with a drop-down for the descriptor.
//  - Knowledge skills are free text, so any descriptor can be typed ("Area Knowledge: Boston").
//  - Quality variants are real, different entries (their own Karma, effects, requirements), so the drop-down picks
//    one of them; a custom label goes in the quality's note ("Allergy (Uncommon, Mild)" + "Peanuts").

/** "Base: Descriptor" / "Base (Descriptor)" -> {base, desc, sep}, or null. The parenthesis form wins, so
 *  "Infected: Ghoul (Human)" is Ghoul's variant, not a variant of "Infected". */
export function splitName(name) {
  const s = String(name || '').trim();
  let m = /^(.+?)\s*\((.+)\)$/.exec(s);
  if (m) return { base: m[1].trim(), desc: m[2].trim(), sep: 'paren' };
  m = /^([^:]+?)\s*:\s*(.+)$/.exec(s);
  if (m) return { base: m[1].trim(), desc: m[2].trim(), sep: 'colon' };
  return null;
}

/** join a base and descriptor back the way the family writes it (empty descriptor -> just the base) */
export function joinName(base, desc, sep = 'colon') {
  const d = String(desc || '').trim();
  if (!d) return base;
  return sep === 'paren' ? `${base} (${d})` : `${base}: ${d}`;
}

/**
 * Group a catalogue into families. Returns {families: Map(base -> {base, sep, variants: [{def, desc}]}), rows}
 * where rows is the list in original order with each family appearing once (at its first member) as
 * {family} and everything else as {def}. Only bases with at least `min` members count as a family, and a plain
 * entry named exactly like the base joins its family (as descriptor '').
 */
export function groupFamilies(list, { min = 2 } = {}) {
  const byBase = new Map();
  for (const def of list) {
    const p = splitName(def.name);
    if (!p) continue;
    if (!byBase.has(p.base)) byBase.set(p.base, { base: p.base, sep: p.sep, variants: [] });
    byBase.get(p.base).variants.push({ def, desc: p.desc });
  }
  const families = new Map([...byBase].filter(([, f]) => f.variants.length >= min));
  for (const def of list) {
    const f = families.get(String(def.name).trim());
    if (f && !f.variants.some((v) => v.def === def)) f.variants.unshift({ def, desc: '' });
  }
  const seen = new Set();
  const rows = [];
  for (const def of list) {
    const p = splitName(def.name);
    const fam = (p && families.get(p.base)) || families.get(String(def.name).trim());
    if (fam) {
      if (!seen.has(fam.base)) { seen.add(fam.base); rows.push({ family: fam }); }
    } else rows.push({ def });
  }
  return { families, rows };
}

/** the family an owned name belongs to (for switching variants in place), given a grouped catalogue */
export function familyFor(name, families) {
  const p = splitName(name);
  return (p && families.get(p.base)) || families.get(String(name || '').trim()) || null;
}
