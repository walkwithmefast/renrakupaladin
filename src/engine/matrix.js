// Matrix devices, programs and the active persona.
// Rules used (SR5 core p.226-229, 245): a cyberdeck lists the number of programs it can RUN at once (any number can
// sit in storage); you can't run two copies of one program; deck attributes come from an Attribute Array you assign
// to Attack / Sleaze / Data Processing / Firewall. Commlinks have fixed attributes and only run common programs.
// Technomancers use a Living Persona built from their mental attributes and Resonance.
import { num } from './data.js';
import { evalNum } from './expr.js';
import { playState } from './edge.js';

export const PROGRAM_CATS = ['Common Programs', 'Hacking Programs'];
export const isProgramDef = (def) => !!def && PROGRAM_CATS.includes(def.category);
const DEVICE_CATS = { Cyberdecks: 'deck', Commlinks: 'commlink', 'Rigger Command Consoles': 'rcc' };
export const deviceKind = (def) => (def && def.name !== 'Living Persona' ? DEVICE_CATS[def.category] || null : null);

export const ASDF = [['a', 'Attack'], ['s', 'Sleaze'], ['d', 'Data Processing'], ['f', 'Firewall']];
export const PROGRAMS_PAGE = 245;

// what a running program does, in one line (SR5 core p.245-246). `stat` = a flat bonus to the device's Matrix attribute
// that this app applies; `slots` = extra programs the deck can run (Virtual Machine).
export const PROGRAM_INFO = {
  Browse: { text: 'Matrix Search takes half the time' },
  Configurator: { text: 'Stores a second deck configuration you can switch to in one Reconfigure' },
  Edit: { text: '+2 Data Processing limit on Edit tests' },
  Encryption: { text: '+1 Firewall', stat: { f: 1 } },
  'Signal Scrub': { text: 'Noise reduction 2' },
  Toolbox: { text: '+1 Data Processing', stat: { d: 1 } },
  'Virtual Machine': { text: 'Run 2 more programs; +1 unresisted box whenever you take Matrix damage', slots: 2 },
  Armor: { text: '+2 dice to resist Matrix damage', resist: { matrix: 2 } },
  'Baby Monitor': { text: 'You always know your Overwatch Score' },
  Biofeedback: { text: 'Your Matrix damage also hits biological targets as Stun (cold sim) or Physical (hot sim)' },
  'Biofeedback Filter': { text: '+2 dice to resist biofeedback damage', resist: { bio: 2 } },
  Blackout: { text: 'Like Biofeedback, but always Stun' },
  Decryption: { text: '+1 Attack', stat: { a: 1 } },
  Defuse: { text: '+4 dice to resist Data Bomb damage' },
  Demolition: { text: '+1 rating to Data Bombs you set' },
  Exploit: { text: '+2 Sleaze for Hack on the Fly' },
  Fork: { text: 'One Matrix action against two targets' },
  Guard: { text: 'Extra damage from marks on you -1 DV per mark' },
  Hammer: { text: '+2 DV to Matrix damage you cause' },
  Lockdown: { text: 'Personas you damage are link-locked' },
  Mugger: { text: 'Bonus damage from your marks +1 DV per mark' },
  Shell: { text: '+1 die to resist Matrix and biofeedback damage', resist: { matrix: 1, bio: 1 } },
  Sneak: { text: "+2 dice against Trace User; convergence doesn't reveal your location" },
  Stealth: { text: '+1 Sleaze', stat: { s: 1 } },
  Track: { text: "+2 Data Processing for Trace User, or cancels the target's Sneak" },
  Wrapper: { text: 'Disguise your icons as anything with Change Icon' },
};
export const programInfo = (name) => PROGRAM_INFO[name] || null;
const STAT_KEY = { a: 'a', s: 's', d: 'dp', f: 'f' };

/** the four numbers a deck can assign, e.g. "6,5,5,3" -> [6,5,5,3] */
export function deckArray(def) {
  const parts = String(def.attributearray || '').split(',').map((x) => num(x.trim(), NaN));
  return parts.length === 4 && parts.every((n) => !Number.isNaN(n)) ? parts : null;
}

/** the deck's current configuration; falls back to array order A,S,D,F */
export function deckConfig(it, def) {
  const arr = deckArray(def);
  if (!arr) return null;
  const saved = it.asdf;
  const cfg = saved && ['a', 's', 'd', 'f'].every((k) => Number.isFinite(saved[k])) ? saved : { a: arr[0], s: arr[1], d: arr[2], f: arr[3] };
  // valid when the four assigned values are a permutation of the array
  const used = [cfg.a, cfg.s, cfg.d, cfg.f].sort((x, y) => x - y).join(',');
  const want = [...arr].sort((x, y) => x - y).join(',');
  return { ...cfg, arr, ok: used === want };
}

/**
 * @param {object} ch
 * @param {{attr: object, gearEntries: {it:object, def:object}[], init: object}} ctx
 */
export function deriveMatrix(ch, ctx) {
  const { attr, gearEntries } = ctx;
  const pf = ctx.personaFx || {};
  const warnings = [];
  const programs = gearEntries.filter((e) => isProgramDef(e.def));
  const devices = [];
  for (const e of gearEntries) {
    const kind = deviceKind(e.def);
    if (!kind) continue;
    const { it, def } = e;
    const vars = { Rating: it.rating || 1 };
    let a = num(def.attack);
    let s = num(def.sleaze);
    let dp = evalNum(def.dataprocessing, vars, 0);
    let f = evalNum(def.firewall, vars, 0);
    const dr = evalNum(def.devicerating, vars, 0);
    let limit = null;
    let cfg = null;
    if (kind === 'deck') {
      cfg = deckConfig(it, def);
      if (cfg) { a = cfg.a; s = cfg.s; dp = cfg.d; f = cfg.f; }
      limit = num(def.programs);
    }
    const loaded = programs.filter((p) => p.it.device === it.uid);
    const names = loaded.map((p) => p.def.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    // running programs that raise an attribute or add slots (one copy counts - you can't run two)
    const base = { a, s, dp, f };
    const boosts = {};
    for (const n of new Set(names)) {
      const info = PROGRAM_INFO[n];
      if (!info) continue;
      for (const [k, v] of Object.entries(info.stat || {})) {
        const key = STAT_KEY[k];
        if (key === 'a') a += v; else if (key === 's') s += v; else if (key === 'dp') dp += v; else f += v;
        (boosts[key] = boosts[key] || []).push(`${n} +${v}`);
      }
      if (info.slots && limit != null) { limit += info.slots; boosts.limit = [...(boosts.limit || []), `${n} +${info.slots}`]; }
    }
    // Overclocker (Run Faster p.148): +1 to one deck attribute of the player's choosing (it.overclock = 'a'|'s'|'d'|'f')
    if (ctx.overclock && kind === 'deck' && STAT_KEY[it.overclock]) {
      const key = STAT_KEY[it.overclock];
      if (key === 'a') a += 1; else if (key === 's') s += 1; else if (key === 'dp') dp += 1; else f += 1;
      (boosts[key] = boosts[key] || []).push('Overclocker +1');
    }
    const cm = 8 + Math.ceil(dr / 2 - 1e-9);
    devices.push({
      uid: it.uid, name: def.name, kind, dr, a, s, dp, f, base, boosts, limit, cfg, cm,
      loaded: loaded.length, programs: names, programUids: loaded.map((p) => p.it.uid), dupes,
    });
    if (kind === 'deck' && limit != null && loaded.length > limit) warnings.push(`${def.name} runs ${loaded.length} programs but its limit is ${limit}.`);
    if (dupes.length) warnings.push(`${def.name} is running more than one copy of ${[...new Set(dupes)].join(', ')}.`);
    if (cfg && !cfg.ok) warnings.push(`${def.name}: assign each of its attribute-array values (${cfg.arr.join('/')}) exactly once.`);
  }
  for (const p of programs) {
    if (p.def.category !== 'Hacking Programs' || !p.it.device) continue;
    const dev = devices.find((x) => x.uid === p.it.device);
    if (dev && dev.kind !== 'deck') warnings.push(`${p.def.name} is a hacking program and needs a cyberdeck, not a ${dev.kind}.`);
  }

  const tech = !!(attr.RES && attr.RES.enabled);
  const chosen = ch.activeDevice && ch.activeDevice !== 'living' ? devices.find((x) => x.uid === ch.activeDevice) : null;
  // technomancers default to their Living Persona; everyone else to their best deck, then a commlink, then an RCC
  // (an RCC has commlink functionality built in - a rigger with only an RCC still has a persona)
  const active = chosen || (tech || ch.activeDevice === 'living' ? null
    : devices.find((x) => x.kind === 'deck') || devices.find((x) => x.kind === 'commlink') || devices.find((x) => x.kind === 'rcc') || null);
  let persona = null;
  if (active) {
    persona = { ...active, living: false, label: active.name };
  } else if (tech) {
    persona = {
      uid: '', name: 'Living Persona', kind: 'living', living: true, label: 'Living Persona',
      // Better on the Net / Brittle (Data Trails): +/- a Living Persona attribute
      a: attr.CHA.total + (pf.a || 0), s: attr.INT.total + (pf.s || 0), dp: attr.LOG.total + (pf.d || 0), f: attr.WIL.total + (pf.f || 0), dr: attr.RES.total,
      limit: null, loaded: 0, programs: [], programUids: [], boosts: {}, cm: 8 + Math.ceil(attr.RES.total / 2 - 1e-9),
    };
  }
  const intu = attr.INT.total;
  // damage resistance (SR5 core p.228/245): Matrix damage Device Rating + Firewall, biofeedback Willpower + Firewall,
  // plus running Armor / Shell / Biofeedback Filter
  const pools = persona && (() => {
    const pool = (label, base, key) => {
      const parts = [label];
      let n = base;
      for (const name of new Set(persona.programs)) {
        const v = (PROGRAM_INFO[name] && PROGRAM_INFO[name].resist && PROGRAM_INFO[name].resist[key]) || 0;
        if (v) { n += v; parts.push(`${name} +${v}`); }
      }
      return { n, text: parts.join(', ') };
    };
    return {
      matrix: pool(`DR ${persona.dr} + Firewall ${persona.f}`, persona.dr + persona.f, 'matrix'),
      bio: pool(`WIL ${attr.WIL.total} + Firewall ${persona.f}`, attr.WIL.total + persona.f, 'bio'),
    };
  })();
  const init = persona && {
    ar: ctx.init.base, arDice: ctx.init.dice,
    cold: { base: persona.dp + intu, dice: 3 },
    hot: { base: persona.dp + intu, dice: 4 },
  };
  const cm = persona ? persona.cm : 0;
  return { devices, programs: programs.length, active, persona, init, cm, pools, warnings };
}

/** why a program can't be loaded onto a device right now (null = it can) */
export function loadBlocker(matrix, programDef, devUid) {
  const dev = matrix.devices.find((x) => x.uid === devUid);
  if (!dev) return 'No such device';
  if (programDef.category === 'Hacking Programs' && dev.kind !== 'deck') return 'Hacking programs need a cyberdeck';
  if (dev.programs.includes(programDef.name)) return `${programDef.name} is already running there`;
  if (dev.limit != null && dev.loaded >= dev.limit) return `${dev.name} is full (${dev.loaded}/${dev.limit}) - eject one first`;
  return null;
}

/** run a program (owned gear uid) on a device, or move it back to storage with devUid = '' */
export function setProgramDevice(x, programUid, devUid) {
  const g = x.gear.find((z) => z.uid === programUid);
  if (g) g.device = devUid || '';
}

/** swap two of a deck's attributes (Reconfigure: swap two Matrix attributes, SR5 core p.228) */
export function swapAsdf(x, devUid, cfg, k1, k2) {
  const g = x.gear.find((z) => z.uid === devUid);
  if (!g || !cfg || k1 === k2) return;
  const next = { a: cfg.a, s: cfg.s, d: cfg.d, f: cfg.f };
  [next[k1], next[k2]] = [next[k2], next[k1]];
  g.asdf = next;
}

/** Matrix damage taken, per device uid ('living' = a technomancer's Living Persona) - play state */
export const matrixDamage = (play, key) => Math.max(0, Number(play.matrixDmg[key]) || 0);
export function setMatrixDamage(x, key, boxes) {
  const p = playState(x);
  x.play = { ...p, matrixDmg: { ...p.matrixDmg, [key]: Math.max(0, Number(boxes) || 0) } };
}
