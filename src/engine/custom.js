// Custom items: things the GM hands out that aren't in the catalogue ("a prototype Ares pistol", "salvaged drone").
// The player fills in the stats; the owned item stores them in `it.custom`, and `itemDef()` turns that into a
// catalogue-shaped def, so every existing rule (weapon pools, armor totals, Essence, drone stats and damage
// tracks, costs, the Inspector) treats it like any other item. Cost defaults to 0 for loot / GM gifts.
import { uid as newUid } from './character.js';

export const CUSTOM_KINDS = [
  ['weapons', 'Weapon'], ['armor', 'Armor'], ['gear', 'Gear'], ['cyberware', 'Cyberware'], ['bioware', 'Bioware'], ['vehicles', 'Vehicle / drone'],
];
export const isCustom = (it) => !!(it && it.custom);

/** the fields the form asks for, per kind: [key, label, placeholder] */
export const CUSTOM_FIELDS = {
  weapons: [['damage', 'Damage (DV)', '8P'], ['ap', 'AP', '-1'], ['accuracy', 'Accuracy', '5'], ['mode', 'Mode', 'SA/BF'], ['rc', 'Recoil comp.', '0'], ['ammo', 'Ammo', '15(c)'], ['reach', 'Reach (melee)', '0']],
  armor: [['armor', 'Armor', '12'], ['armorcapacity', 'Capacity', '12']],
  gear: [['rating', 'Rating', '0'], ['capacity', 'Capacity', '']],
  cyberware: [['ess', 'Essence', '0.2'], ['rating', 'Rating', '0'], ['capacity', 'Capacity', '']],
  bioware: [['ess', 'Essence', '0.2'], ['rating', 'Rating', '0']],
  vehicles: [['handling', 'Handling', '4/3'], ['speed', 'Speed', '3'], ['accel', 'Acceleration', '1'], ['body', 'Body', '4'], ['armor', 'Armor', '4'], ['pilot', 'Pilot', '3'], ['sensor', 'Sensor', '3'], ['seats', 'Seats', '0']],
};

const clean = (v) => String(v ?? '').trim();

/** a catalogue-shaped def for a custom owned item (memoized per item object; items are replaced on every edit) */
const cache = new WeakMap();
export function customDef(kind, it) {
  const hit = cache.get(it);
  if (hit && hit.custom === it.custom && hit.name === it.name) return hit.def; // stale if edited in place
  const c = it.custom || {};
  const def = {
    id: it.id, name: it.name, custom: true, source: '', page: '',
    category: clean(c.category) || 'Custom', cost: String(Math.max(0, Number(c.cost) || 0)), avail: clean(c.avail) || '0',
    description: clean(c.description),
  };
  for (const [k] of CUSTOM_FIELDS[kind] || []) if (clean(c[k])) def[k] = clean(c[k]);
  if (kind === 'weapons') {
    def.type = c.type === 'Melee' ? 'Melee' : 'Ranged';
    def.damage = def.damage || '0';
    def.ap = def.ap || '0';
    def.accuracy = def.accuracy || '0';
  }
  if (kind === 'armor') def.armor = def.armor || '0';
  if (kind === 'vehicles' && c.drone) def.category = `Drones: ${clean(c.category) || 'Custom'}`;
  const attrs = (c.attrs || []).filter((a) => a && a.attr && Number(a.val));
  if (attrs.length) def.bonus = { specificattribute: attrs.map((a) => ({ name: a.attr, val: String(Number(a.val)) })) };
  cache.set(it, { custom: it.custom, name: it.name, def });
  return def;
}

/** a new owned custom item from the form's values */
export function newCustomItem(kind, form) {
  const uid = newUid();
  const { name, paid, ...custom } = form;
  const it = { uid, id: `custom-${uid}`, name: clean(name) || 'Custom item', custom: { ...custom, kind } };
  if (!paid) it.free = true;
  if (Number(custom.rating) > 0) it.rating = Number(custom.rating);
  if (kind === 'weapons' || kind === 'armor') it.equipped = true;
  return it;
}

/** apply an edited form to an existing custom item (in a draft) */
export function editCustomItem(it, form) {
  const { name, paid, ...custom } = form;
  it.name = clean(name) || it.name;
  it.custom = { ...custom, kind: it.custom.kind };
  if (paid) delete it.free; else it.free = true;
  if (Number(custom.rating) > 0) it.rating = Number(custom.rating); else delete it.rating;
}

/** the form values for an existing custom item */
export const customForm = (it) => ({ name: it.name, paid: !it.free, ...(it.custom || {}) });

// ---- custom qualities (a GM's blessing, a curse, a house-rule edge) ---------------------------------------------
// Stored on ch.qualities as {uid, id: 'custom-q-...', name, custom: {category, karma, description, attrs}, ...};
// findQuality() / resolveInspect() turn them into a catalogue-shaped def. `karma` is what it actually costs (or
// gives, for a negative one) - entered by the player, so it isn't doubled after creation like catalogue qualities.
const qcache = new WeakMap();
export function customQualityDef(q) {
  const hit = qcache.get(q);
  if (hit && hit.custom === q.custom && hit.name === q.name) return hit.def;
  const c = q.custom || {};
  const neg = c.category === 'Negative';
  const k = Math.abs(Math.round(Number(c.karma) || 0));
  const def = { id: q.id, name: q.name, custom: true, category: neg ? 'Negative' : 'Positive', karma: String(neg ? -k : k), doublecareer: 'False', source: '', page: '', description: clean(c.description) };
  const attrs = (c.attrs || []).filter((a) => a && a.attr && Number(a.val));
  if (attrs.length) def.bonus = { specificattribute: attrs.map((a) => ({ name: a.attr, val: String(Number(a.val)) })) };
  qcache.set(q, { custom: q.custom, name: q.name, def });
  return def;
}

export function newCustomQuality(form, career) {
  const uid = newUid();
  const { name, ...custom } = form;
  return { uid, id: `custom-q-${uid}`, name: clean(name) || 'Custom quality', custom, a: !!career, choice: {}, note: '' };
}

export function editCustomQuality(q, form) {
  const { name, ...custom } = form;
  q.name = clean(name) || q.name;
  q.custom = custom;
}

export const customQualityForm = (q) => ({ name: q.name, ...(q.custom || {}) });
