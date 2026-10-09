// Summoned spirits (magicians, SR5 core p.300-303) and compiled sprites (technomancers, p.256-258).
// Force-scaled stat blocks come straight from the same tradition/stream data the Tradition picker
// already uses (traditions.xml/streams.xml embed a full spirit-type catalogue, not just names). What's
// tracked here is the play-relevant part on top of that: which type, what Force, and services owed -
// the summoning/compiling test itself is rolled at the table, not simulated here.
import { idx, num } from './data.js';
import { evalExpr } from './expr.js';

export const SPIRITS_PAGE = 300;
export const SPRITES_PAGE = 256;
const STAT_KEYS = ['bod', 'agi', 'rea', 'str', 'cha', 'int', 'log', 'wil'];

const catalogFile = (tech) => (tech ? 'streams' : 'traditions');

/** every spirit/sprite type the character's tradition (or stream) can summon/compile, as {category, name}[] */
export function spiritOptions(traditionName, tech) {
  const file = catalogFile(tech);
  const name = String(traditionName || (tech ? 'Default' : '')).toLowerCase();
  const trad = idx(file, 'traditions').byName.get(name);
  const spirits = trad && trad.spirits;
  if (!spirits) return [];
  if (Array.isArray(spirits)) return spirits.map((n) => ({ category: '', name: n }));
  return Object.entries(spirits).filter(([, v]) => v).map(([k, n]) => ({ category: k.replace(/^spirit/, ''), name: n }));
}

/** the catalogue stat-block entry for a spirit/sprite type by name */
export const spiritDef = (name, tech) => idx(catalogFile(tech), 'spirits').byName.get(String(name || '').toLowerCase()) || null;

/** this spirit/sprite's Force-scaled attributes + initiative (never below 0) */
export function spiritStats(def, force) {
  if (!def) return null;
  const vars = { F: Math.max(0, num(force)) };
  const attrs = {};
  for (const k of STAT_KEYS) attrs[k] = Math.max(0, Math.round(evalExpr(def[k], vars)));
  const ini = Math.round(evalExpr(def.ini, vars));
  return { attrs, ini: Number.isNaN(ini) ? null : ini };
}

/** total Force of every summoned/compiled entry the character currently has (services owed or not) */
export const totalForce = (ch) => (ch.spirits || []).reduce((s, e) => s + Math.max(0, num(e.force)), 0);

/** Karma spent binding/registering spirits/sprites (SR5 core: Force x boundSpiritKarma per bound entry) */
export const totalBoundKarma = (ch, R) => (ch.spirits || []).filter((e) => e.bound).reduce((s, e) => s + Math.max(0, num(e.force)) * R.boundSpiritKarma, 0);
