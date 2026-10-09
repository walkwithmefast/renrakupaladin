// Evaluate Chummer <required>/<forbidden> blocks for qualities, powers, etc.
// Only leaves we can check reliably are enforced; unknown leaves never block (so nothing is wrongly hidden).
import { arr, txt, num } from './data.js';

function leaf(key, val, ctx) {
  const list = arr(val);
  switch (key) {
    case 'quality': return list.some((n) => ctx.qualities.has(String(txt(n)).toLowerCase()));
    case 'metatype': return list.some((n) => String(txt(n)).toLowerCase() === ctx.metatype);
    case 'metatypecategory': return list.some((n) => String(txt(n)).toLowerCase() === ctx.metatypeCategory);
    case 'magenabled': return ctx.magic;
    case 'resenabled': return ctx.resonance;
    case 'depenabled': return false;
    case 'skill': return list.some((s) => {
      if (!s || typeof s !== 'object') return false;
      const sk = ctx.skills.get(String(txt(s.name)).toLowerCase());
      return !!sk && sk >= num(txt(s.val), 1);
    });
    case 'tradition': return list.some((n) => String(txt(n)).toLowerCase() === ctx.tradition);
    // initiation techniques (ch.metamagics: kind 'art' / 'enhancement' / plain metamagic or echo) and adept powers
    case 'art': return list.some((n) => ctx.arts.has(String(txt(n)).toLowerCase()));
    case 'metamagic': return list.some((n) => ctx.metamagics.has(String(txt(n)).toLowerCase()));
    case 'power': return list.some((n) => ctx.powers.has(String(txt(n)).toLowerCase()));
    default: return null; // unknown -> ignore
  }
}

function group(kind, node, ctx) {
  if (!node || typeof node !== 'object') return true;
  const results = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === 'oneof') { for (const g of arr(v)) results.push(group('oneof', g, ctx)); continue; }
    if (k === 'allof') { for (const g of arr(v)) results.push(group('allof', g, ctx)); continue; }
    if (k.startsWith('@') || k === '_') continue;
    const r = leaf(k, v, ctx);
    if (r !== null) results.push(r);
  }
  if (results.length === 0) return true;
  return kind === 'oneof' ? results.some(Boolean) : results.every(Boolean);
}

/** context for requirement checks from a character + its derived snapshot */
export function reqContext(ch, d) {
  const skills = new Map();
  for (const s of d.skills) if (s.rating > 0) skills.set(s.name.toLowerCase(), s.rating);
  return {
    qualities: new Set(d.qualities.map((q) => String(q.name).toLowerCase())),
    metatype: String(ch.metatype).toLowerCase(),
    metatypeCategory: String((d.mt && d.mt.category) || 'Metahuman').toLowerCase(),
    magic: d.attr.MAG.enabled,
    resonance: d.attr.RES.enabled,
    skills,
    tradition: String(ch.tradition || '').toLowerCase(),
    arts: new Set((ch.metamagics || []).filter((m) => m.kind === 'art').map((m) => String(m.name).toLowerCase())),
    // + metamagics a quality gives you for free (Seer: Psychometry, Sensing; Null Wizard: Reflection)
    metamagics: new Set([...(ch.metamagics || []).filter((m) => !m.kind || m.kind === 'metamagic').map((m) => String(m.name).toLowerCase()),
      ...(d.fx || []).filter((e) => e.t === 'addmetamagic').map((e) => e.name.toLowerCase())]),
    powers: new Set([...(ch.powers || []).map((p) => String(p.name || '').toLowerCase()), ...(d.powerGrants || []).map((g) => g.def.name.toLowerCase())]),
  };
}

/** @returns {string|null} a reason the item cannot be taken, else null */
export function blockedReason(def, ctx) {
  const req = def.required;
  if (req && typeof req === 'object') {
    // top-level: every child group must hold
    const ok = Object.keys(req).length === 0 || group('allof', req, ctx);
    if (!ok) return 'Requirements not met';
  }
  const forb = def.forbidden;
  if (forb && typeof forb === 'object') {
    const hit = group('oneof', forb, ctx);
    const any = Object.keys(forb).some((k) => !k.startsWith('@'));
    if (any && hit && hasKnownLeaf(forb)) return 'Conflicts with something you already have';
  }
  return null;
}

function hasKnownLeaf(node) {
  for (const [k, v] of Object.entries(node)) {
    if (k === 'oneof' || k === 'allof') { if (arr(v).some(hasKnownLeaf)) return true; continue; }
    if (['quality', 'metatype', 'metatypecategory', 'magenabled', 'resenabled', 'skill', 'tradition', 'art', 'metamagic', 'power'].includes(k)) return true;
  }
  return false;
}
