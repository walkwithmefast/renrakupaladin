// Drones in play: condition monitors, the dice pools a player rolls for a drone, and its tracked state.
// Rules (SR5 core):
//   p.199  vehicles' Condition Monitor = 12 + Body/2 (rounded up), drones' = 6 + Body/2; no Stun track; an attack
//          whose modified DV does not exceed the vehicle's Armor does nothing.
//   p.205  resist damage with Body + Armor; driver defends with Reaction + Intuition, drones with Pilot + autosoft [Handling].
//   p.228  Matrix Condition Monitor = 8 + Device Rating/2, Matrix damage resisted with Device Rating + Firewall;
//   p.269  a drone's Device Rating (and every Matrix attribute) equals its Pilot.
//   p.270  autonomous: Perception = Pilot + Clearsight [Sensor], infiltration = Pilot + Stealth [Handling],
//          Initiative = Pilot x 2 + 4D6; jumped in: Perception + Intuition [Sensor], Stealth + Intuition [Handling],
//          and the rigger's VR Initiative. Two damage tracks (Physical, Matrix): fill either and the drone is done.
//   p.238  remote control (Control Device): your skill + the attribute you'd normally use, limits capped by your
//          Data Processing (the book's example: drone weapon = Gunnery + Agility).
//   p.183  remote-operated vehicle weapons: Gunnery + Logic [Accuracy]; p.270 the Targeting autosoft is the drone's
//          Gunnery skill -> autonomous attack Pilot + Targeting [Accuracy]. p.199 Vehicle Test = Pilot skill + Reaction.
//   p.452  jumped in, a control rig adds its Rating as dice to Vehicle skill tests, to the vehicle's Handling and Speed,
//          and lowers Vehicle Test thresholds by its Rating (min 1); p.266 it also raises Sensor and mounted weapons'
//          Accuracy limits; hot-sim adds +1 die to Vehicle actions (and 4D6 Initiative dice; cold-sim 3D6).
import { num } from './data.js';

export const DRONE_PAGES = { cm: 199, damage: 205, matrixCm: 228, device: 269, tests: 270, gunnery: 183, controlRig: 452, sim: 266 };

export const isDrone = (def) => /drone/i.test(String((def && def.category) || ''));
const half = (n) => Math.ceil(num(n) / 2);
/** Physical boxes: 6 + Body/2 for drones, 12 + Body/2 for other vehicles */
export const physicalBoxes = (def, body) => (isDrone(def) ? 6 : 12) + half(body);
/** Matrix boxes: 8 + Device Rating/2, and a drone's Device Rating is its Pilot */
export const matrixBoxes = (pilot) => 8 + half(pilot);

// ---- how a vehicle moves -> which Pilot skill a rigger rolls (Chummer's drone data only gives a size) ----------
export const MOVES = [['Ground', 'Pilot Ground Craft'], ['Aircraft', 'Pilot Aircraft'], ['Watercraft', 'Pilot Watercraft'],
  ['Walker', 'Pilot Walker'], ['Aerospace', 'Pilot Aerospace'], ['Exotic', 'Pilot Exotic Vehicle']];
const BY_CATEGORY = { Boats: 'Watercraft', Submarines: 'Watercraft', Rotorcraft: 'Aircraft', 'Fixed-Wing Aircraft': 'Aircraft', 'VTOL/VSTOL': 'Aircraft', LTAV: 'Aircraft' };
const AIR = /roto|fly|flying|eye|zep|condor|pigeon|dove|pelican|soar|wing|copter|kite|bird|angel|malakim|kull|phobos|deimos|eris|dragonfly|noizquito|hawk|raven|crow|eagle|drone web/i;
const WATER = /goldfish|krake|neptune|swim|shark|boat|sub|aqua|fish|poseidon|dolphin/i;
const WALK = /walker|spider|anthro|doll|kenchiku|juggernaut|legs?|quad|direktionssekretar|little buddy|criado/i;
/** best guess from the data (category for vehicles, the name for drones); `it.moves` overrides it */
export function guessMoves(def) {
  const cat = String((def && def.category) || '');
  if (BY_CATEGORY[cat]) return BY_CATEGORY[cat];
  if (!/drone/i.test(cat)) return 'Ground';
  const n = String(def.name || '');
  return AIR.test(n) ? 'Aircraft' : WATER.test(n) ? 'Watercraft' : WALK.test(n) ? 'Walker' : 'Ground';
}
export const movesOf = (def, it) => (it && MOVES.some(([m]) => m === it.moves) ? it.moves : guessMoves(def));
export const pilotSkillFor = (moves) => (MOVES.find(([m]) => m === moves) || MOVES[0])[1];

const AUTOSOFT_KIND = [['clearsight', /Clearsight/i], ['evasion', /Evasion/i], ['maneuvering', /Maneuvering/i], ['stealth', /Stealth/i], ['targeting', /Targeting/i], ['ew', /Electronic Warfare/i]];

/** highest-rated autosoft of each kind the character owns (drones share them through an RCC) -> {evasion: 4, ...} */
export function autosoftRatings(d) {
  const out = {};
  for (const e of d.items.gear) {
    if (e.def.category !== 'Autosofts') continue;
    const k = AUTOSOFT_KIND.find(([, re]) => re.test(e.def.name));
    if (k) out[k[0]] = Math.max(out[k[0]] || 0, num(e.it.rating, 1));
  }
  return out;
}

/** the character's control rig rating (0 = none) */
export function controlRigRating(d) {
  const cr = (d.augs || []).find((a) => a.def && a.def.name === 'Control Rig');
  return cr ? num(cr.it.rating, 1) : 0;
}

const skill = (d, name) => d.skills.find((s) => s.name === name);
/** a skill's rating for a jumped-in test; no ranks = defaulting (attribute - 1), shown in the formula */
function skillPart(d, name) {
  const s = skill(d, name);
  const rating = s ? s.rating : 0;
  return rating > 0 ? { dice: rating, label: name } : { dice: -1, label: `${name} (defaulting −1)` };
}

/**
 * The tests a player rolls for one drone. stats: applied vehicle stats (engine/mods.js); mode 'auto' | 'jumped';
 * sim 'hot' | 'cold'. -> {init: {base, dice, text}, tests: [{id, label, pool, limit, formula, note?}]}
 */
export function droneTests(stats, d, { mode = 'auto', sim = 'hot', moves = 'Ground', autosofts = autosoftRatings(d), rig = controlRigRating(d) } = {}) {
  const s = stats.stats;
  const pilot = s.pilot;
  const handling = s.handling.on;
  const tests = [];
  const add = (id, label, pool, limit, formula, note) => tests.push({ id, label, pool: Math.max(0, pool), limit, formula, note });
  const soft = (k) => autosofts[k] || 0;
  const softNote = (k, name) => (soft(k) ? null : `no ${name} autosoft owned`);
  if (mode === 'jumped') {
    const A = (k) => d.attr[k].total;
    const vehBonus = rig + (sim === 'hot' ? 1 : 0); // Vehicle skill tests: control rig dice + hot-sim's +1
    const lim = (v) => v + rig; // jumped in, the control rig raises the drone's limits
    const hot = sim === 'hot' ? d.init.matrixHot : d.init.matrixCold;
    const init = { base: hot.base, dice: hot.dice, text: `your ${sim}-sim VR Initiative` };
    const pil = skillPart(d, pilotSkillFor(moves));
    const per = skillPart(d, 'Perception');
    const snk = skillPart(d, 'Sneaking');
    const gun = skillPart(d, 'Gunnery');
    const extras = `${rig ? ` + ${rig} (rig)` : ''}${sim === 'hot' ? ' + 1 (hot-sim)' : ''}`;
    const plus = (what) => `${what}${rig ? ` + ${rig}` : ''}`;
    add('vehicle', 'Vehicle test', pil.dice + A('REA') + vehBonus, lim(handling), `${pil.label} + Reaction${extras} [${plus('Handling')}]`,
      rig ? `thresholds −${rig} (min 1) from your control rig` : null);
    add('defense', 'Defense', A('REA') + A('INT'), null, 'Reaction + Intuition');
    add('perception', 'Perception', per.dice + A('INT'), lim(s.sensor), `${per.label} + Intuition [${plus('Sensor')}]`);
    add('stealth', 'Stealth', snk.dice + A('INT'), lim(handling), `${snk.label} + Intuition [${plus('Handling')}]`);
    add('gunnery', 'Gunnery', gun.dice + A('LOG') + vehBonus, null, `${gun.label} + Logic${extras} [${plus('weapon Accuracy')}]`);
    add('soak', 'Resist damage', s.body + s.armor, null, 'Body + Armor', `no damage if the attack's modified DV doesn't exceed Armor ${s.armor}`);
    return { init, tests, rig };
  }
  if (mode === 'remote') {
    // Control Device (p.238): your own skill + attribute as if doing it yourself; every limit is capped by your
    // Data Processing. No control-rig bonuses (those are for jumping in). The book's example: Gunnery + Agility.
    const A = (k) => d.attr[k].total;
    // the device you're steering it through: your persona's, else the best you own
    const dp = (d.matrix && d.matrix.persona && d.matrix.persona.dp) || Math.max(0, ...((d.matrix && d.matrix.devices) || []).map((x) => x.dp || 0));
    const cap = (v) => (dp ? Math.min(v, dp) : v);
    const capTxt = (what) => (dp ? `${what}, max DP ${dp}` : what);
    const pil = skillPart(d, pilotSkillFor(moves));
    const per = skillPart(d, 'Perception');
    const snk = skillPart(d, 'Sneaking');
    const gun = skillPart(d, 'Gunnery');
    const init = { base: d.init.base, dice: d.init.dice, text: 'your own Initiative (in VR: your Matrix Initiative)' };
    add('vehicle', 'Vehicle test', pil.dice + A('REA'), cap(handling), `${pil.label} + Reaction [${capTxt('Handling')}]`);
    add('defense', 'Defense', A('REA') + A('INT'), null, 'Reaction + Intuition');
    add('perception', 'Perception', per.dice + A('INT'), cap(s.sensor), `${per.label} + Intuition [${capTxt('Sensor')}]`);
    add('stealth', 'Stealth', snk.dice + A('INT'), cap(handling), `${snk.label} + Intuition [${capTxt('Handling')}]`);
    add('gunnery', 'Gunnery', gun.dice + A('AGI'), dp || null, `${gun.label} + Agility [${capTxt('weapon Accuracy')}]`, dp ? null : 'no active Matrix device: remote control needs one');
    add('soak', 'Resist damage', s.body + s.armor, null, 'Body + Armor', `no damage if the attack's modified DV doesn't exceed Armor ${s.armor}`);
    return { init, tests, rig: 0, dp };
  }
  const init = { base: pilot * 2, dice: 4, text: 'Pilot × 2 + 4D6' };
  add('vehicle', 'Maneuver', pilot + soft('maneuvering'), handling, 'Pilot + Maneuvering [Handling]', softNote('maneuvering', 'Maneuvering'));
  add('defense', 'Defense', pilot + soft('evasion'), handling, 'Pilot + Evasion [Handling]', softNote('evasion', 'Evasion'));
  add('perception', 'Perception', pilot + soft('clearsight'), s.sensor, 'Pilot + Clearsight [Sensor]', softNote('clearsight', 'Clearsight'));
  add('stealth', 'Stealth', pilot + soft('stealth'), handling, 'Pilot + Stealth [Handling]', softNote('stealth', 'Stealth'));
  add('gunnery', 'Attack', pilot + soft('targeting'), null, 'Pilot + Targeting [weapon Accuracy]', softNote('targeting', 'Targeting'));
  add('soak', 'Resist damage', s.body + s.armor, null, 'Body + Armor', `no damage if the attack's modified DV doesn't exceed Armor ${s.armor}`);
  add('matrix', 'Resist Matrix damage', pilot * 2, null, 'Device Rating + Firewall (both = Pilot)');
  return { init, tests, rig: 0 };
}

/** a drone's play state: {phys, matrix, mode, sim, notes} (lives in ch.play.drones[uid]) */
export function droneState(ch, uid) {
  const all = (ch.play && ch.play.drones) || {};
  const s = all[uid] || {};
  const mode = s.mode === 'jumped' || s.mode === 'remote' ? s.mode : 'auto';
  return { phys: num(s.phys), matrix: num(s.matrix), mode, sim: s.sim === 'cold' ? 'cold' : 'hot', notes: s.notes || '' };
}

/** update one drone's play state in a draft character */
export function setDroneState(x, uid, patch) {
  x.play = x.play || {};
  x.play.drones = { ...(x.play.drones || {}) };
  x.play.drones[uid] = { ...droneState(x, uid), ...patch };
  // only one drone can have the rigger jumped in at a time
  if (patch.mode === 'jumped') for (const k of Object.keys(x.play.drones)) if (k !== uid && x.play.drones[k].mode === 'jumped') x.play.drones[k] = { ...x.play.drones[k], mode: 'auto' };
}
