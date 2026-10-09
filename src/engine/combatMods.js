// Situational combat modifiers for the dice-roll tray (SR5 core, read from the book):
//   p.175 Environmental Modifiers (visibility / light & glare / wind / range: 0, -1, -3, -6; worst one counts, and two
//         or more at that worst level move a row down - p.176's example turns two -1s into -3; two at -6 = -10) and
//         what compensates for each. Recoil: 1 + STR/3 (up) + the weapon's RC, minus every bullet fired since you
//         last stopped firing (progressive recoil); a negative result comes off the pool.
//   p.176 Situational Modifiers (ranged attacker), p.187 Melee Modifiers, p.189 Defense Modifiers.
import { num } from './data.js';

export const COMBAT_PAGES = { environment: 175, recoil: 175, ranged: 176, melee: 187, defense: 189 };

/** [id, label, dice modifier] - booleans the player ticks */
export const RANGED = [
  ['cover', 'Firing from cover with an imaging device', -3], ['vehicle', 'Firing from a moving vehicle', -2],
  ['inMelee', 'You are in melee combat', -3], ['running', 'You are running', -2], ['offhand', 'Off-hand weapon', -2],
  ['blind', 'Blind fire', -6], ['called', 'Called shot', -4], ['aim', 'Took aim last action (+1 Accuracy too)', 1],
  ['smartgun', 'Wireless smartgun: gear', 1], ['smartImplant', 'Wireless smartgun: implanted', 2],
];
export const MELEE = [
  ['charge', 'Charging attack', 2], ['prone', 'You are prone', -1], ['called', 'Called shot', -4],
  ['superior', 'Superior position', 2], ['offhand', 'Off-hand weapon', -2], ['friends', 'Friends in the melee', 1],
  ['oppProne', 'Opponent prone', 1], ['touch', 'Touch-only attack', 2],
];
export const DEFENSE = [
  ['inVehicle', 'Inside a moving vehicle', 3], ['prone', 'You are prone', -2], ['running', 'You are running', 2],
  ['goodCover', 'Good cover', 4], ['partCover', 'Partial cover', 2], ['charged', 'Receiving a charge (with a delayed action)', 1],
  ['meleeVsRanged', 'In melee, targeted by a ranged attack', -3], ['area', 'Area-effect attack', -2],
  ['burst', 'Burst / semi-auto burst', -2], ['longBurst', 'Long burst / full-auto (Simple)', -5], ['fullAuto', 'Full-auto (Complex)', -9],
  ['narrow', 'Flechette shotgun, narrow spread', -1], ['medium', 'Flechette shotgun, medium spread', -3], ['wide', 'Flechette shotgun, wide spread', -5],
];
// only one of these at a time
const EXCLUSIVE = [['goodCover', 'partCover'], ['burst', 'longBurst', 'fullAuto'], ['narrow', 'medium', 'wide'], ['smartgun', 'smartImplant']];
export const exclusiveWith = (id) => (EXCLUSIVE.find((g) => g.includes(id)) || []).filter((x) => x !== id);

/** environment columns: options are [label, row] with row 0 (no modifier) .. 3 (-6) */
export const ENVIRONMENT = {
  visibility: { label: 'Visibility', options: [['Clear', 0], ['Light rain / fog / smoke', 1], ['Moderate rain / fog / smoke', 2], ['Heavy rain / fog / smoke', 3]] },
  light: { label: 'Light', options: [['Full light, no glare', 0], ['Partial light', 1], ['Weak glare', 1], ['Dim light', 2], ['Moderate glare', 2], ['Total darkness', 3], ['Blinding glare', 3]] },
  wind: { label: 'Wind', options: [['None / light breeze', 0], ['Light winds', 1], ['Moderate winds', 2], ['Strong winds', 3]] },
  range: { label: 'Range', options: [['Short', 0], ['Medium', 1], ['Long', 2], ['Extreme', 3]] },
};
const ROW_MOD = [0, -1, -3, -6];
/** gear that compensates (p.175), as row shifts per column; lightKind 'dark' | 'glare' decides which light rules apply */
export const COMPENSATION = [
  ['flare', 'Flare compensation', { glare: -2 }], ['sunglasses', 'Sunglasses', { glare: -1, dark: +1 }],
  ['imagemag', 'Image magnification', { range: -1 }], ['lowlight', 'Low-light vision', { lowlight: true }],
  ['thermo', 'Thermographic vision', { visibility: -1, glare: -1, dark: -1 }], ['tracer', 'Tracer rounds (full-auto)', { wind: -1, range: -1, tracer: true }],
  ['smartlink', 'Smartlink', { wind: -1 }], ['ultrasound', 'Ultrasound (within 50 m)', { visibility: -1, ignoreLight: true }],
];

/**
 * env: {visibility, light, wind, range} as option labels; comp: Set of compensation ids.
 * -> {mod, rows: {col: row after compensation}, note}
 */
export function environmentModifier(env, comp = new Set()) {
  const rows = {};
  for (const [col, spec] of Object.entries(ENVIRONMENT)) {
    const opt = spec.options.find(([l]) => l === env[col]) || spec.options[0];
    rows[col] = opt[1];
  }
  const lightLabel = String(env.light || '');
  const glare = /glare/i.test(lightLabel);
  const shift = (col, by) => { rows[col] = Math.max(0, Math.min(3, rows[col] + by)); };
  for (const [id, , fx] of COMPENSATION) {
    if (!comp.has(id)) continue;
    if (fx.visibility) shift('visibility', fx.visibility);
    if (fx.range && !fx.tracer) shift('range', fx.range);
    if (fx.wind && !fx.tracer) shift('wind', fx.wind);
    if (fx.tracer) { if (rows.wind >= 2) shift('wind', -1); if (rows.range >= 1) shift('range', -1); } // rows below Light Winds / Short
    if (glare && fx.glare) shift('light', fx.glare);
    if (!glare && fx.dark) shift('light', fx.dark);
    if (fx.lowlight && !glare && /partial|dim/i.test(lightLabel)) rows.light = 0;
    if (fx.ignoreLight) rows.light = 0;
  }
  const worst = Math.max(...Object.values(rows));
  if (worst === 0) return { mod: 0, rows, note: '' };
  const atWorst = Object.values(rows).filter((r) => r === worst).length;
  if (atWorst >= 2) return { mod: worst === 3 ? -10 : ROW_MOD[worst + 1], rows, note: `${atWorst} conditions at ${ROW_MOD[worst]}: moved a row` };
  return { mod: ROW_MOD[worst], rows, note: '' };
}

/** recoil penalty (<= 0): 1 + STR/3 (up) + weapon RC, minus bullets fired since you last stopped (incl. this attack) */
export function recoilPenalty(str, weaponRc, bullets) {
  const rc = 1 + Math.ceil(num(str) / 3) + num(weaponRc);
  return { rc, penalty: Math.min(0, rc - Math.max(0, num(bullets))) };
}

/**
 * Total modifier for a roll. kind 'ranged' | 'melee' | 'defense'; picks: Set of ticked ids;
 * extra: {wound, env, comp, str, rc, bullets, previousDefenses, reach (attacker minus defender, for defense)}
 * -> {total, parts: [{label, v}]}
 */
export function combatModifier(kind, picks, extra = {}) {
  const list = kind === 'ranged' ? RANGED : kind === 'melee' ? MELEE : kind === 'defense' ? DEFENSE : [];
  const parts = list.filter(([id]) => picks.has(id)).map(([, label, v]) => ({ label, v }));
  if (extra.wound) parts.push({ label: 'Wound modifier', v: -Math.abs(extra.wound) });
  if (kind === 'ranged' && extra.env) {
    const e = environmentModifier(extra.env, extra.comp);
    if (e.mod) parts.push({ label: `Environment${e.note ? ` (${e.note})` : ''}`, v: e.mod });
  }
  if (kind === 'melee' && extra.env) {
    // melee only uses the Light and Visibility columns (p.187)
    const e = environmentModifier({ ...extra.env, wind: undefined, range: undefined }, extra.comp);
    if (e.mod) parts.push({ label: 'Environment (light / visibility)', v: e.mod });
  }
  if (kind === 'ranged' && num(extra.bullets) > 0) {
    const r = recoilPenalty(extra.str, extra.rc, extra.bullets);
    if (r.penalty) parts.push({ label: `Recoil (${extra.bullets} bullets vs ${r.rc} compensation)`, v: r.penalty });
  }
  if (kind === 'defense') {
    if (num(extra.previousDefenses) > 0) parts.push({ label: `Defended ${extra.previousDefenses}× already this turn`, v: -num(extra.previousDefenses) });
    if (num(extra.reach)) parts.push({ label: extra.reach > 0 ? 'Attacker has longer Reach' : 'You have longer Reach', v: -num(extra.reach) });
  }
  return { total: parts.reduce((s, p) => s + p.v, 0), parts };
}
