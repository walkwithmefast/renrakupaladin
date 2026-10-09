// Character model + all derived calculations (pure functions, no UI).
import { D, idx, arr, num, txt, bool, ATTR_KEYS, SPECIAL_KEYS, ALL_ATTRS } from './data.js';
import { priorityLines, priorityLineOf, validPriorityLine, resourceRowsTable } from './priorities.js';
import { applyVehicleMods, vehicleVars, armorWithMods, modSlots, armorProtection, armorCapacity, weaponMounts } from './mods.js';
import { customDef, customQualityDef } from './custom.js';
import { capacityUse } from './augCapacity.js';
import { DEFAULT_RULES, stepCost } from './rules.js';
import { evalNum, evalAvail, variableRange } from './expr.js';
import { effectsOf } from './effects.js';
import { deriveMatrix } from './matrix.js';
import { totalBondKarma, bondedForce, focusLimits, isFocus } from './foci.js';
import { totalMetamagicKarma } from './metamagic.js';
import { powerGrants } from './grantedPowers.js';
import { boostBonus } from './boost.js';
import { trustFundLevel, TRUST_FUND, qualityMaxLevel, qualityExtras, reputation } from './qualityPerks.js';
import { wayOf, wayEligible, wayDiscount, wayDiscountSlots, focusBondDiscount, magicRestriction, optionalPowerKarma,
  VEHICLE_CLASSES, fullCyberlimbs, adjustedStepCost, careerRankAdjust } from './qualityRules.js';
import { totalBoundKarma } from './spirits.js';
import { totalMartialArtKarma } from './martialarts.js';
import { cyberlimbStats, bestStr, bestAgi } from './cyberlimbs.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const r2 = (n) => Math.round(n * 100) / 100;
const zeroTier = () => ({ p: 0, k: 0, a: 0 });

export function newCharacter() {
  const attrs = {};
  for (const a of ALL_ATTRS) attrs[a] = zeroTier();
  return {
    v: 1,
    id: uid(),
    created: Date.now(),
    modified: Date.now(),
    mode: 'create',
    info: {
      name: '', alias: '', player: '', gender: '', age: '', height: '', weight: '', skin: '', hair: '', eyes: '',
      description: '', background: '', notes: '',
    },
    priTable: 'Standard',
    pri: { heritage: 'C', talent: 'E', attributes: 'A', skills: 'B', resources: 'D' },
    metatype: 'Human',
    variant: '',
    talent: 'Mundane',
    talentPicks: { skills: [], group: '' },
    attrs,
    skills: {},
    groups: {},
    know: [],
    qualities: [],
    spells: [],
    powers: [],
    complexForms: [],
    cyberware: [],
    bioware: [],
    weapons: [],
    armor: [],
    gear: [],
    vehicles: [],
    lifestyles: [],
    contacts: [],
    spirits: [],
    metamagics: [],
    initGrade: 0,
    martialArts: [],
    critterPowers: [], // [{uid, id, name, rating?, extra?}] - data/critterpowers.xml (shifters, drakes, infected, A.I.s)
    aiPrograms: [], // [{uid, id, name, extra?}] - A.I. programs (Data Trails), data/programs.xml
    tradition: '',
    mentor: '',
    mentorChoice: '',
    nuyenAdjust: 0,
    karmaConverted: 0,
    career: { earned: 0, log: [] },
    play: { phys: 0, stun: 0, overflow: 0, edgeUsed: 0 },
  };
}

// ------------------------------------------------------------------ lookups
const mtIdx = () => idx('metatypes', 'metatypes');
export const priorities = () => idx('priorities', 'priorities').list;

export function priorityRow(category, letter, table = 'Standard') {
  const rows = resourceRowsTable(table); // Street Scum uses the Standard rows
  return priorities().find(
    (p) => p.category === category && p.value === letter && (category !== 'Resources' || p.prioritytable === rows),
  );
}

export function metatypeRecord(ch) {
  const base = mtIdx().byName.get(String(ch.metatype).toLowerCase());
  if (!base) return null;
  if (ch.variant) {
    const v = arr(base.metavariants).find((x) => x.name === ch.variant);
    if (v) return { ...v, _base: base };
  }
  return base;
}

/** metatypes selectable at a given heritage letter -> [{name, value(special pts), karma, variants:[...]}] */
export function heritageOptions(letter) {
  const row = priorityRow('Heritage', letter);
  return row ? arr(row.metatypes) : [];
}

export function talentOptions(letter) {
  const row = priorityRow('Talent', letter);
  return row ? arr(row.talents) : [];
}

export function talentRecord(ch) {
  const opts = talentOptions(ch.pri.talent);
  return opts.find((t) => t.value === ch.talent) || opts.find((t) => t.value === 'Mundane') || { name: 'Mundane', value: 'Mundane' };
}

export const qualityIdx = () => idx('qualities', 'qualities');
export const findQuality = (q) => (q.custom ? customQualityDef(q) : qualityIdx().byId.get(q.id) || qualityIdx().byName.get(String(q.name || '').toLowerCase()));

// ------------------------------------------------------------------ pricing
const gradeIdx = (file, list) => idx(file, 'grades').byName.get(String(list || 'Standard').toLowerCase());

/**
 * Price one owned item.
 * @returns {{cost:number, avail:{n:number,flag:string,mod:boolean}, ess:number, capacity:number}}
 */
/** the metatype's attribute limits as formula variables ({STRMaximum}, {AGIMinimum}...) - cyberlimb customization's
 *  rating range is written in them (SR5 core p.456) */
/** the id a switched-on condition is stored under (ch.activeConditions): where it comes from + what it is */
export const conditionKey = (e) => `${e.src}|${e.what}|${e.condition}`;

export function metatypeVars(mt) {
  const out = {};
  for (const a of ['BOD', 'AGI', 'REA', 'STR', 'CHA', 'INT', 'LOG', 'WIL']) {
    const k = a.toLowerCase();
    out[`${a}Minimum`] = mt ? num(mt[`${k}min`], 1) : 1;
    out[`${a}Maximum`] = mt ? num(mt[`${k}max`], 6) : 6;
  }
  return out;
}

/** a rating field that may be a formula ("{STRMaximum}", "{STRMinimum}+1") */
export const ratingValue = (v, mt, fallback) => evalNum(String(v ?? ''), metatypeVars(mt), fallback);

export function priceItem(kind, def, it, extra = {}) {
  if (!def) return { cost: 0, avail: { n: 0, flag: '', mod: false }, ess: 0, capacity: 0 };
  const mtv = extra.mt !== undefined ? metatypeVars(extra.mt) : metatypeVars(null);
  const minR = evalNum(String(def.minrating ?? ''), mtv, NaN);
  const rating = it.rating != null ? it.rating : Math.max(1, Number.isNaN(minR) ? 1 : minR);
  // a Chummer "Variable(min-max)" cost (Clothing, Customized (Drone), ...) needs a picked price or it evaluates
  // as min-max nuyen - a large *refund* instead of a charge. Default an unset one to the range's minimum instead
  // of leaving it undefined, so every caller is safe even if it never learned to set `it.variable` itself.
  const vr = variableRange(def.cost);
  const vrVar = it.variable != null ? it.variable : vr ? vr.min : undefined;
  const vars = { ...mtv, Rating: rating, MinRating: Number.isNaN(minR) ? 0 : minR, Variable: vrVar, ...extra.vars };
  const pc = extra.parentCost || 0;
  let cost = evalNum(def.cost, { ...vars, 'Gear Cost': pc, 'Weapon Cost': pc, 'Armor Cost': pc, 'Vehicle Cost': pc, 'Parent Cost': pc, 'Parent Gear Cost': pc }, 0);
  const costfor = num(def.costfor, 1) || 1;
  const qty = it.qty != null ? it.qty : 1;
  let avail = evalAvail(def.avail, vars);
  let ess = 0;
  let capacity = 0;

  if (kind === 'cyberware' || kind === 'bioware') {
    const g = gradeIdx(kind, it.grade);
    const gEss = g ? evalNum(g.ess, {}, 1) : 1;
    const gCost = g ? evalNum(g.cost, {}, 1) : 1;
    const gAvail = g ? evalAvail(g.avail, {}) : { n: 0 };
    ess = r2(evalNum(def.ess, vars, 0) * gEss);
    cost = cost * gCost;
    avail = { ...avail, n: avail.n + (g && /^[+-]/.test(String(g.avail)) ? gAvail.n : 0) };
    const cm = /^\[?(.*?)\]?$/.exec(String(def.capacity || ''));
    capacity = cm ? evalNum(cm[1], vars, 0) : 0;
    cost *= 1 + num(extra.lifestylePct, 0) * 0; // gear cost is not modified by metatype in SR5
    if (it.free) cost = 0; // loot / a GM gift (or bundled with its parent)
    return { cost: Math.round(cost), avail, ess, capacity };
  }

  cost = (cost * qty) / costfor;
  if (it.free) cost = 0; // included with a parent item (imported from Chummer)
  return { cost: Math.round(cost), avail, ess, capacity };
}

export function itemDef(kind, it) {
  if (it && it.custom) return customDef(kind, it); // a GM-given item the player filled in (engine/custom.js)
  const map = {
    gear: ['gear', 'gears'], weapons: ['weapons', 'weapons'], armor: ['armor', 'armors'],
    cyberware: ['cyberware', 'cyberwares'], bioware: ['bioware', 'biowares'], vehicles: ['vehicles', 'vehicles'],
    lifestyles: ['lifestyles', 'lifestyles'], spells: ['spells', 'spells'], powers: ['powers', 'powers'],
    complexForms: ['complexforms', 'complexforms'], critterPowers: ['critterpowers', 'powers'], aiPrograms: ['programs', 'programs'],
  }[kind];
  if (!map) return null;
  const ix = idx(map[0], map[1]);
  return ix.byId.get(it.id) || ix.byName.get(String(it.name || '').toLowerCase()) || null;
}

// ------------------------------------------------------------------ derive
/**
 * All derived values for a character. Pure - safe to call on every render.
 * @param {object} ch
 * @param {{rules?:object}} [opts]
 */
export function derive(ch, opts = {}) {
  const R = { ...DEFAULT_RULES, ...(opts.rules || {}) };
  const create = ch.mode === 'create';
  const warnings = [];
  const warn = (msg, sev = 'warn') => warnings.push({ msg, sev });

  const mt = metatypeRecord(ch) || mtIdx().byName.get('human');
  const talent = talentRecord(ch);
  const heritageRow = heritageOptions(ch.pri.heritage).find((o) => o.name === ch.metatype);
  const variantRow = arr(heritageRow && heritageRow.metavariants).find((v) => v.name === ch.variant);
  const attrPtsTotal = num((priorityRow('Attributes', ch.pri.attributes) || {}).attributes);
  const skillRow = priorityRow('Skills', ch.pri.skills) || {};
  const skillPtsTotal = num(skillRow.skills);
  const groupPtsTotal = num(skillRow.skillgroups);
  const resourceNuyen = num((priorityRow('Resources', ch.pri.resources, ch.priTable) || {}).resources);
  if (create && !validPriorityLine(ch.pri, ch.priTable)) {
    warn(`${ch.priTable || 'Standard'} priorities must be ${priorityLines(ch.priTable).map((l) => l.split('').join(' ')).join(' or ')} (currently ${priorityLineOf(ch.pri).split('').join(' ')}).`, 'error');
  }
  const specialPtsTotal = variantRow ? num(variantRow.value) : num(heritageRow && heritageRow.value);
  const variantKarma = variantRow ? num(variantRow.karma) : 0;

  // ---- gather effects from every source
  const fx = []; // {src, ...effect}
  const addFx = (src, bonus, vars, choice) => { for (const e of effectsOf(bonus, vars, choice)) fx.push({ src, ...e }); };
  if (mt) addFx('metatype', mt.bonus, {});
  const qualities = [];
  const qn = (c) => arr(c && c.quality);
  const grantedNames = [...qn(mt && mt.qualities && mt.qualities.positive), ...qn(mt && mt.qualities && mt.qualities.negative), ...arr(talent.qualities)];
  for (const n of grantedNames) {
    const def = qualityIdx().byName.get(String(txt(n)).toLowerCase());
    if (def) qualities.push({ uid: 'auto-' + def.id, id: def.id, def, auto: true, karma: 0, name: def.name, choice: {} });
  }
  for (const q of ch.qualities) {
    const def = findQuality(q);
    if (!def) continue;
    // levelled qualities (Chummer `limit` = how many times it can be taken: High Pain Tolerance 1-3, In Debt 1-15...)
    const level = Math.max(1, Math.min(qualityMaxLevel(def), num(q.level, 1)));
    // In Debt / Stolen Gear: the points buy nuyen instead of Karma (Run Faster p.156)
    const base = def.bonus && def.bonus.nuyenamt !== undefined ? 0 : num(def.karma) * level;
    const dbl = !create && q.a && def.doublecareer !== 'False';
    qualities.push({ ...q, def, level, name: q.name || def.name, karma: dbl ? base * 2 : base, base, choice: q.choice || {} });
  }
  // the Beast's / Spiritual Way include Mentor Spirit for free (Street Grimoire p.176-178; Chummer `freequality`)
  const freeQ = new Set(qualities.flatMap((q) => arr(q.def.bonus && q.def.bonus.freequality).map((g) => String(txt(g)).replace(/-/g, '').slice(0, 10))));
  for (const q of qualities) if (!q.auto && freeQ.has(q.id)) { q.karma = 0; q.base = 0; q.freeBy = 'your Way'; }
  // a quality that brings another one along (Ex-Con -> SINner (Criminal), Glamour -> Distinctive Style...): free, automatic
  for (const q of [...qualities]) {
    for (const a of arr(q.def.bonus && q.def.bonus.addqualities && q.def.bonus.addqualities.addquality)) {
      const def = qualityIdx().byName.get(String(txt(a)).toLowerCase());
      if (def && !qualities.some((x) => x.id === def.id)) qualities.push({ uid: `auto-${q.uid}-${def.id}`, id: def.id, def, auto: true, karma: 0, name: def.name, choice: {}, level: 1, grantedBy: q.name });
    }
  }
  for (const q of qualities) {
    const choice = typeof q.choice === 'object' ? q.choice : {};
    const level = q.level || 1;
    // "Rating" in the bonus = the level (Dimmer Bulb: -Rating); otherwise the bonus repeats once per level
    if (/Rating/.test(JSON.stringify(q.def.bonus || ''))) addFx(q.name, q.def.bonus, { Rating: level }, choice);
    else for (let i = 0; i < level; i++) addFx(q.name, q.def.bonus, { Rating: 1 }, choice);
    for (const extra of qualityExtras(q.def, level)) fx.push({ src: q.name, ...extra });
  }
  // Mentor Spirit (SR5 core p.320-323): the quality itself just marks "pick a mentor" (bonus.selectmentorspirit);
  // the mentor's own advantage (and its chosen sub-option, where it has one) is a separate bonus tree this applies
  // once a mentor is actually picked, so it only takes effect if the quality granting it is actually owned.
  const hasMentorQuality = qualities.some((q) => q.name === 'Mentor Spirit');
  const mentorDef = hasMentorQuality && ch.mentor ? idx('mentors', 'mentors').byName.get(String(ch.mentor).toLowerCase()) : null;
  const mentorPick = mentorDef ? arr(mentorDef.choices).find((c) => c.name === ch.mentorChoice) || null : null;
  if (mentorDef) {
    addFx(`mentor: ${mentorDef.name}`, mentorDef.bonus, {});
    if (mentorPick) addFx(`mentor: ${mentorDef.name} (${mentorPick.name})`, mentorPick.bonus, {});
  }

  // ---- essence
  let essUsed = 0;
  const augs = [];
  const qNames = new Set(qualities.map((q) => String(q.name).toLowerCase()));
  const burnout = qNames.has("the burnout's way");
  let freeBio = fx.filter((e) => e.t === 'freebioess').reduce((s, e) => s + e.v, 0); // Prototype Transhuman (Chrome Flesh p.54)
  for (const kind of ['cyberware', 'bioware']) {
    for (const it of ch[kind]) {
      const def = itemDef(kind, it);
      if (!def) continue;
      const p = priceItem(kind, def, it, { mt });
      // parts installed inside a cyberlimb / cyberware with capacity use capacity, not Essence
      if (it.child && String(def.capacity || '').startsWith('[')) p.ess = 0;
      // Biocompatibility (x0.9, rounded down to the tenth - Chrome Flesh p.54), 'Ware Intolerance, Sensitive System (x2)
      const mult = fx.filter((e) => e.t === 'essmult' && e.kind === kind).reduce((m, e) => m * (e.v / 100), 1);
      if (mult !== 1 && p.ess > 0) p.ess = mult < 1 ? Math.floor(p.ess * mult * 10 + 1e-9) / 10 : r2(p.ess * mult);
      // the Burnout's Way (SG p.177): standard-grade augmentations count as alphaware (x0.8) for Essence
      if (burnout && p.ess > 0 && (!it.grade || /^Standard/.test(it.grade))) p.ess = r2(p.ess * 0.8);
      if (kind === 'bioware' && freeBio > 0 && p.ess > 0) { const f = Math.min(freeBio, p.ess); p.ess = r2(p.ess - f); freeBio = r2(freeBio - f); }
      for (const e of fx.filter((x) => x.t === 'nograde' && x.kind === kind)) {
        if (e.grades.includes(it.grade || 'Standard')) warn(`${def.name}: ${e.src} won't accept ${it.grade || 'Standard'}-grade ${kind} (betaware or better).`);
      }
      essUsed += p.ess;
      augs.push({ kind, it, def, ...p });
      addFx(def.name, def.bonus, { Rating: it.rating || 1 });
    }
  }
  // cyberware capacity: enhancements installed in a parent use its capacity (engine/augCapacity.js)
  const capacity = capacityUse(augs);
  for (const a of augs) {
    const c = capacity.get(a.it.uid);
    if (c) a.cap = c;
    if (c && c.used > c.total) warn(`${a.def.name} holds more than its capacity (${c.used} of ${c.total}).`);
  }
  // each owned cyberlimb's own Strength/Agility (engine/cyberlimbs.js) - computed here (children like Customized/
  // Enhanced Strength are already in `augs`, nested via .parent like any other capacity subsystem)
  const cyberlimbs = cyberlimbStats(augs.filter((a) => a.kind === 'cyberware'));
  // custom items (engine/custom.js) can carry attribute bonuses the player typed in; armor only counts while worn
  for (const kind of ['gear', 'weapons', 'armor']) {
    for (const it of ch[kind]) {
      if (!it.custom || (kind === 'armor' && it.equipped === false)) continue;
      const def = itemDef(kind, it);
      if (def && def.bonus) addFx(def.name, def.bonus, { Rating: it.rating || 1 });
    }
  }
  // bonded foci (catalogue ones - custom items are handled above): Power Focus -> Magic-linked tests, Spellcasting Focus
  // -> its spell category, Alchemical / Disenchanting -> that skill, Weapon Focus -> the melee weapon it is (choice.weapon).
  // Tagged `focus` so only the biggest focus bonus counts on any one test (SR5 core p.318).
  for (const it of ch.gear) {
    if (it.custom || !it.bonded) continue;
    const def = itemDef('gear', it);
    if (!isFocus(def) || !def.bonus) continue;
    for (const e of effectsOf(def.bonus, { Rating: it.rating || 1 }, it.choice || {})) {
      fx.push({ src: `${def.name} ${it.rating || 1}`, ...e, focus: true, weapon: (it.choice || {}).weapon || '' });
    }
  }
  const sumFxEarly = (t) => fx.filter((e) => e.t === t).reduce((s, e) => s + e.v, 0);
  const essPenalty = fx.filter((e) => e.t === 'essence').reduce((s, e) => s + e.v, 0);
  const essMax = (mt ? num(mt.essmax, 6) : 6) + sumFxEarly('essmax');
  // Chummer's essencepenalty is signed like a bonus: -1 = one point of Essence lost (Infected: Ghoul, Grey Mana Tattoos,
  // blood crystals). It used to be subtracted, so a ghoul GAINED Essence - fixed in the v26 quality audit.
  const essence = r2(essMax - essUsed + essPenalty);
  const essLoss = Math.max(0, r2(essMax - essence));
  // blood crystals (Forbidden Arcana p.133): the Essence they cost is "augmented" back for Magic only - no Magic loss
  const magLoss = Math.max(0, Math.ceil(Math.max(0, essLoss - sumFxEarly('magessence')) - 1e-9));

  for (const p of ch.powers) {
    const def = itemDef('powers', p);
    if (def) addFx(def.name, def.bonus, { Rating: p.level || 1 }, p.choice || {});
  }
  for (const e of fx.filter((x) => x.t === 'cyberseeker')) {
    const pairs = Math.min(2, Math.floor(fullCyberlimbs(augs).all / 2));
    if (!pairs) continue;
    for (const a of e.attrs) {
      if (a === 'BOX') fx.push({ src: e.src, t: 'cmPhys', v: -3 * pairs }); // Redliner: -3 boxes per two full limbs
      else fx.push({ src: e.src, t: 'attr', a, v: pairs, max: 0, min: 0, aug: 0 });
    }
  }
  // critter powers carry ordinary Chummer bonuses (e.g. Armor, Enhanced Senses) at their rating
  const critterPowers = [];
  for (const cp of ch.critterPowers || []) {
    const def = idx('critterpowers', 'powers').byId.get(cp.id) || idx('critterpowers', 'powers').byName.get(String(cp.name || '').toLowerCase());
    if (!def) continue;
    critterPowers.push({ it: cp, def });
    addFx(`${def.name} (critter power)`, def.bonus, { Rating: cp.rating || 1 }, cp.choice || {});
  }
  for (const e of fx.filter((x) => x.t === 'critterpower')) {
    const def = idx('critterpowers', 'powers').byName.get(e.name.toLowerCase());
    if (!def || critterPowers.some((c) => c.def.id === def.id && (c.it.extra || '') === e.select)) continue;
    const it = { uid: `auto-cp-${def.id}-${e.select}`, id: def.id, name: def.name, extra: e.select || undefined, rating: num(e.rating) || undefined, auto: true, from: e.src };
    critterPowers.push({ it, def, auto: true });
    addFx(`${def.name} (${e.src})`, def.bonus, { Rating: it.rating || 1 }, {});
  }
  // free powers from a bonded Qi Focus or a mentor's adept option (engine/grantedPowers.js) - no Power Points
  const powerGrantList = powerGrants(ch, { mentorPick, itemDef });
  for (const g of powerGrantList) {
    const holder = g.uid ? (ch.gear.find((z) => z.uid === g.uid) || {}).choice || {} : ch.mentorPowerChoice || {};
    addFx(`${g.def.name} (${g.src})`, g.def.bonus, { Rating: g.level }, holder);
  }

  // conditions the player has switched on ("I'm in my home sprawl"): notes with an `apply` become real effects
  const activeConds = new Set((ch.activeConditions || []).map(String));
  for (const e of fx.filter((x) => x.t === 'situational' && x.apply && activeConds.has(conditionKey(x)))) {
    e.active = true;
    fx.push({ src: `${e.src} (${e.condition})`, ...e.apply });
  }

  // ---- attributes
  const attr = {};
  let attrPtsUsed = 0;
  let specialPtsUsed = 0;
  let attrKarma = 0;
  let atMax = 0;
  const magicEnabled = num(talent.magic) > 0 || qualities.some((q) => q.def.bonus && (q.def.bonus.enabletab || {}).name === 'magician');
  const resEnabled = num(talent.resonance) > 0;
  for (const a of ALL_ATTRS) {
    const key = a.toLowerCase();
    const t = ch.attrs[a] || zeroTier();
    let min = mt ? num(mt[key + 'min'], a === 'MAG' || a === 'RES' ? 0 : 1) : 1;
    let max = mt ? num(mt[key + 'max'], 6) : 6;
    let augMax = mt ? num(mt[key + 'aug'], max + 4) : max + 4;
    let base = min;
    if (a === 'MAG') { base = num(talent.magic); min = base; }
    if (a === 'RES') { base = num(talent.resonance); min = base; }
    const enabled = a === 'MAG' ? magicEnabled : a === 'RES' ? resEnabled : true;
    // an Infected quality replaces the metatype's attribute table (Run Faster / Howling Shadows)
    const table = fx.filter((e) => e.t === 'replaceattr' && e.a === a).pop();
    if (table) { min = table.min; max = table.max; augMax = table.aug || table.max + 4; }
    let bonus = 0;
    for (const e of fx) {
      if (e.t !== 'attr' || e.a !== a) continue;
      bonus += e.v;
      max += e.max;
      min += e.min;
      augMax += e.aug || e.max;
    }
    if (a === 'MAG' || a === 'RES') { max = Math.max(max, 0); }
    const natural = enabled ? base + t.p + t.k + t.a : 0;
    const resWorse = a === 'RES' ? fx.filter((e) => e.t === 'resloss').reduce((s, e) => s + e.v, 0) : 0;
    const loss = resWorse ? Math.max(magLoss, Math.floor(essLoss * (1 + resWorse / 100) + 1e-9)) : magLoss;
    const lost = a === 'MAG' || a === 'RES' ? Math.min(natural, loss) : 0;
    let total = enabled ? Math.max(0, Math.min(natural - lost + bonus, augMax)) : 0;
    const burned = a === 'EDG' ? Math.max(0, num(ch.play && ch.play.edgeBurned)) : 0;
    if (burned) total = Math.max(0, total - burned);
    const kCost = enabled ? stepCost(base + t.p, t.k, R.attrKarma) : 0;
    const aCost = enabled ? stepCost(base + t.p + t.k, t.a, R.attrKarma) : 0;
    if (a === 'EDG' || a === 'MAG' || a === 'RES') specialPtsUsed += t.p;
    else attrPtsUsed += t.p;
    attrKarma += create ? kCost + aCost : 0;
    if (enabled && !SPECIAL_KEYS.includes(a) && natural >= max) atMax++;
    attr[a] = { key: a, enabled, min, max, augMax, base, p: t.p, k: t.k, a: t.a, natural, bonus, lost, total, kCost, aCost, burned };
    if (enabled && natural > max) warn(`${a} (${natural}) exceeds its natural maximum of ${max}.`, 'error');
  }
  if (create && atMax > R.maxNaturalAttrAtLimitCreate) {
    warn('Only one Physical or Mental attribute may be at its natural maximum at character creation.');
  }
  const A = (k) => (attr[k] ? attr[k].total : 0);
  const N = (k) => (attr[k] ? attr[k].natural : 0);
  // Attribute Boost (engine/boost.js) raises an attribute for dice pools only - never limits, Initiative or condition
  // monitors - so pools read attr[k].pool (= total + boost, capped at the augmented maximum) through P()
  const boosts = boostBonus(ch);
  for (const k of Object.keys(attr)) {
    const a = attr[k];
    a.boost = a.enabled ? Math.max(0, Math.min(boosts[k] || 0, a.augMax - a.total)) : 0;
    a.pool = a.total + a.boost;
  }
  const P = (k) => (attr[k] ? attr[k].pool : 0);
  if (create) {
    if (attrPtsUsed > attrPtsTotal) warn(`Attribute points overspent by ${attrPtsUsed - attrPtsTotal}.`, 'error');
    if (specialPtsUsed > specialPtsTotal) warn(`Special attribute points overspent by ${specialPtsUsed - specialPtsTotal}.`, 'error');
  }

  const sumFx = (t, pred) => fx.filter((e) => e.t === t && (!pred || pred(e))).reduce((s, e) => s + e.v, 0);

  // ---- derived combat stats
  // encumbrance (SR5 core p.169): armor accessories ("+" pieces) add at most your Strength to Armor, and every 2 full
  // points of them over Strength cost -1 Agility and Reaction (v28 - wasn't applied before). Worked out here, before
  // limits / Initiative / pools, which all read AGI and REA.
  let accessoryArmor = 0;
  for (const it of ch.armor) {
    if (it.equipped === false) continue;
    const def = itemDef('armor', it);
    if (!def) continue;
    const aw = armorWithMods(def, it, idx('armor', 'mods'));
    if (aw.additive) accessoryArmor += aw.value;
  }
  const strForArmor = A('STR');
  const encumbrance = Math.max(0, Math.floor((accessoryArmor - strForArmor) / 2));
  if (encumbrance) {
    for (const k of ['AGI', 'REA']) {
      attr[k].total = Math.max(0, attr[k].total - encumbrance);
      attr[k].pool = Math.max(0, attr[k].pool - encumbrance);
      attr[k].encumbrance = encumbrance;
    }
    warn(`Armor accessories add ${accessoryArmor} but your Strength is ${strForArmor}: only +${strForArmor} counts, and Agility and Reaction are -${encumbrance} (SR5 core p.169).`);
  }
  // cyberlimb Strength/Agility (engine/cyberlimbs.js, SR5 core p.455-456): the best available value, natural or
  // any owned limb, feeds melee/unarmed/thrown weapon damage (weapons.js) and "Combat Active" weapon-skill pools
  // (Pistols, Blades, Unarmed Combat... below) - see cyberlimbs.js for why "best available" instead of tracking
  // which limb wields what.
  const strCombat = bestStr(attr.STR.total, cyberlimbs);
  const agiCombat = bestAgi(attr.AGI.pool, cyberlimbs);
  const limitBonus = (w) => sumFx('limit', (e) => String(e.which).toLowerCase() === w);
  const limits = {
    mental: Math.ceil((A('LOG') * 2 + A('INT') + A('WIL')) / 3 - 1e-9) + limitBonus('mental'),
    physical: Math.ceil((A('STR') * 2 + A('BOD') + A('REA')) / 3 - 1e-9) + limitBonus('physical'),
    social: Math.ceil((A('CHA') * 2 + A('WIL') + Math.ceil(essence - 1e-9)) / 3 - 1e-9) + limitBonus('social'),
  };
  const initBonus = sumFx('init');
  const initDice = Math.min(R.maxInitDice, 1 + sumFx('initdice'));
  const init = {
    base: A('REA') + A('INT') + initBonus,
    dice: initDice,
    astral: { base: A('INT') * 2, dice: 2 },
    matrixCold: { base: A('INT') + 0, dice: 3 },
    matrixHot: { base: A('INT') + 0, dice: 4 },
  };
  const cm = {
    physical: 8 + Math.ceil(A('BOD') / 2 - 1e-9) + sumFx('cmPhys'),
    stun: 8 + Math.ceil(A('WIL') / 2 - 1e-9) + sumFx('cmStun'),
    overflow: A('BOD') + sumFx('cmOverflow'),
  };
  const armorWorn = [];
  let armorMax = 0;
  let armorAdd = 0;
  for (const it of ch.armor) {
    if (it.equipped === false) continue;
    const def = itemDef('armor', it);
    if (!def) continue;
    // the piece's own Armor plus what its modifications add (Gel Packs +2, a helmet +3, ...)
    const aw = armorWithMods(def, it, idx('armor', 'mods'));
    const v = aw.value;
    armorWorn.push({ it, def, v });
    if (aw.additive) armorAdd += v;
    else armorMax = Math.max(armorMax, v);
  }
  const armorBonus = sumFx('armor');
  const armor = { base: armorMax, add: Math.min(armorAdd, strForArmor), addWorn: armorAdd, encumbrance, bonus: armorBonus, total: armorMax + Math.min(armorAdd, strForArmor) + armorBonus,
    // fire/cold/electricity armor, toxin/pathogen resistance, immunities from worn armor and its mods
    protection: armorProtection(armorWorn.map((w) => w.it), idx('armor', 'armors'), idx('armor', 'mods')) };
  const woundIgnore = sumFx('woundoffset'); // High Pain Tolerance (SR5 core p.74)
  const drugResist = {};
  for (const e of fx.filter((x) => x.t === 'drugresist')) {
    const k = e.kind === 'fatigue' ? 'fatigue' : `${e.kind}:${e.vector}`;
    drugResist[k] = (drugResist[k] || 0) + e.v;
  }
  for (const e of fx.filter((x) => x.t === 'elemarmor')) {
    armor.protection[e.kind] = (armor.protection[e.kind] || 0) + e.v;
    (armor.protection.sources[e.kind] ||= []).push(`${e.src} ${e.v > 0 ? '+' : ''}${e.v}`);
  }
  const pools = {
    defense: P('REA') + P('INT') + sumFx('dodge'),
    fullDefense: P('REA') + P('INT') + P('WIL') + sumFx('dodge'),
    damageResist: P('BOD') + armor.total + sumFx('dr'),
    composure: P('CHA') + P('WIL'),
    judge: P('CHA') + P('INT'),
    memory: P('LOG') + P('WIL') + sumFx('pool', (e) => e.pool === 'memory'),
    liftCarry: P('STR') + P('BOD'),
    physResist: P('BOD') + P('WIL'),
    drainBase: A('WIL'),
  };
  const move = (() => {
    const w = String((mt && mt.walk) || '2/1/0').split('/').map((x) => num(x));
    const rn = String((mt && mt.run) || '4/0/0').split('/').map((x) => num(x));
    // qualities: +N to a multiplier (Infected), or a new one (Celerity, Satyr Legs, Adiposis)
    let wm = w[0] + sumFx('movemult', (e) => e.speed === 'walk');
    let rm = rn[0] + sumFx('movemult', (e) => e.speed === 'run');
    const setW = fx.filter((e) => e.t === 'moveset' && e.speed === 'walk').pop();
    const setR = fx.filter((e) => e.t === 'moveset' && e.speed === 'run').pop();
    if (setW) wm = setW.v;
    if (setR) rm = setR.v;
    return { walk: A('AGI') * wm, run: A('AGI') * rm, walkMult: wm, runMult: rm };
  })();
  const carry = { lift: A('STR') * R.liftMult, carry: A('STR') * R.carryMult };

  // ---- skills
  const skillFree = {}; // talent-granted free ratings by skill id/name
  const groupFree = {};
  const talentSkillVal = num(talent.skillval);
  if (talent.skillgroupqty && ch.talentPicks.group) groupFree[ch.talentPicks.group] = num(talent.skillgroupval);
  for (const n of ch.talentPicks.skills || []) skillFree[n] = talentSkillVal;

  const skillDefs = idx('skills', 'skills');
  let skillPtsUsed = 0;
  let groupPtsUsed = 0;
  let skillKarma = 0;
  const groupRating = {};
  const groups = [];
  for (const g of arr(D.skills && D.skills.skillgroups)) {
    const name = txt(g.name || g);
    const t = ch.groups[name] || zeroTier();
    const f = groupFree[name] || 0;
    const rating = f + t.p + t.k + t.a;
    groupRating[name] = rating;
    groupPtsUsed += t.p;
    const gCat = txt((skillDefs.list.find((d) => txt(d.skillgroup) === name) || {}).category);
    const gPct = fx.filter((e) => e.t === 'groupcost' && e.cat === gCat).reduce((m, e) => m * (e.pct / 100), 1);
    const kc = Math.ceil(stepCost(f + t.p, t.k, R.newGroupKarma) * gPct - 1e-9);
    const ac = Math.ceil(stepCost(f + t.p + t.k, t.a, R.improveGroupKarma) * gPct - 1e-9);
    skillKarma += create ? kc + ac : 0;
    if (rating > 0) {
      for (const e of fx.filter((x) => (x.t === 'nogroupcat' && x.cat === gCat) || (x.t === 'nogroup' && x.group === name))) warn(`${e.src}: can't have the ${name} skill group.`);
    }
    groups.push({ name, f, ...t, rating, kCost: kc, aCost: ac });
  }
  const skills = [];
  for (const def of skillDefs.list) {
    const t = ch.skills[def.id];
    const gName = txt(def.skillgroup);
    const gRating = gName ? groupRating[gName] || 0 : 0;
    const f = skillFree[def.name] || 0;
    const s = t || { p: 0, k: 0, a: 0, spec: '' };
    const own = f + s.p + s.k + s.a;
    const rating = gRating + own;
    // a quality may swap the linked attribute (Empathic Listener: Etiquette uses INT)
    const swap = fx.find((e) => e.t === 'swapattr' && !e.spec && e.skill === def.name);
    const attrKey = swap ? swap.attr : String(def.attribute).toUpperCase();
    // "Combat Active" skills (Pistols, Blades, Unarmed Combat...) are all AGI-linked and wielded with a hand/arm -
    // see cyberlimbs.js for why this uses the character's best available Agility instead of just the natural one.
    const av = attrKey === 'AGI' && def.category === 'Combat Active' ? agiCombat : attr[attrKey] ? attr[attrKey].pool : 0;
    const kMult = R.newSkillKarma;
    // Uncouth: Social skills cost double (points and Karma); Uneducated / College Education etc. likewise
    const costPct = (what) => fx.filter((e) => e.t === 'skillcost' && e.what === what && e.cat === def.category).reduce((m, e) => m * (e.pct / 100), 1);
    const kc = Math.ceil(stepCost(gRating + f + s.p, s.k, kMult) * costPct('karma') - 1e-9);
    const rankAdj = careerRankAdjust(fx, { active: true, category: def.category });
    const ac = Math.ceil((rankAdj.length ? adjustedStepCost(gRating + f + s.p + s.k, s.a, R.improveSkillKarma, rankAdj) : stepCost(gRating + f + s.p + s.k, s.a, R.improveSkillKarma)) * costPct('karma') - 1e-9);
    skillPtsUsed += Math.ceil(s.p * costPct('points') - 1e-9);
    const specPct = fx.filter((e) => e.t === 'speccost' && e.cat === def.category).reduce((m, e) => m * (e.pct / 100), 1);
    const specCost = s.spec ? (s.specSrc === 'k' || s.specSrc === 'a' ? Math.ceil(R.specKarma * specPct - 1e-9) : 0) : 0;
    const specPts = s.spec && !(s.specSrc === 'k' || s.specSrc === 'a') ? 1 : 0;
    skillPtsUsed += specPts;
    skillKarma += create ? kc + ac + specCost : ac + specCost;
    const applies = (e) => (e.t === 'skill' && e.name === def.name)
      || (e.t === 'skillcat' && e.cat === def.category && !e.exclude.includes(def.name))
      || (e.t === 'skillgrp' && e.group === gName && !e.exclude.includes(def.name))
      || (e.t === 'skillattr' && e.attr === attrKey);
    // only one focus counts per test (SR5 core p.318): the biggest one; everything else adds up
    const focusFx = fx.filter((e) => e.focus && applies(e)).sort((x, y) => y.v - x.v)[0] || null;
    const focusBonus = focusFx ? focusFx.v : 0;
    const skillBonus = fx.reduce((sum, e) => sum + (!e.focus && applies(e) ? e.v : 0), 0) + focusBonus;
    const skillMaxBonus = fx.filter((e) => e.t === 'skill' && e.name === def.name).reduce((sum, e) => sum + (e.max || 0), 0);
    // Incompetent (a chosen group) / Uncouth-style group bans make the skill "unaware"; Uneducated blocks defaulting
    const incompetent = fx.some((e) => e.t === 'nogroup' && e.group && e.group === gName);
    const canUse = !incompetent && !(attrKey === 'MAG' && !attr.MAG.enabled) && !(attrKey === 'RES' && !attr.RES.enabled);
    const defaultable = def.default === 'True' && !incompetent && !fx.some((e) => e.t === 'nodefault' && e.cat === def.category);
    if (incompetent && own > 0) warn(`${def.name}: Incompetent (${gName}) - you can't learn skills in that group.`);
    const pool = incompetent ? 0 : rating > 0 ? av + rating + skillBonus : defaultable ? av - 1 : 0;
    skills.push({
      def, id: def.id, name: def.name, attr: attrKey, category: def.category, group: gName, gRating, f,
      p: s.p, k: s.k, a: s.a, rating, spec: s.spec || '', specSrc: s.specSrc || 'p',
      pool, poolSpec: pool + 2, canUse, defaultable, kCost: kc, aCost: ac, specCost, maxBonus: skillMaxBonus,
      focusBonus, focusSrc: focusFx ? focusFx.src : '',
      exotic: def.exotic === 'True',
    });
  }
  // ...or only for one specialization (Master Debater: Negotiation (Diplomacy) with LOG) - a note with the pool
  for (const e of fx.filter((x) => x.t === 'swapattr' && x.spec)) {
    const sk = skills.find((x) => x.name === e.skill);
    if (!sk || (!sk.rating && !sk.defaultable)) continue;
    const base = sk.rating > 0 ? sk.pool - attr[sk.attr].pool + attr[e.attr].pool : attr[e.attr].pool - 1;
    fx.push({ src: e.src, t: 'situational', what: `${e.skill} (${e.spec}) with ${e.attr}`, v: base + (sk.spec === e.spec ? 2 : 0), condition: 'dice pool' });
  }
  // A group is "broken" (SR5 core p.88-89) when a member has a specialization, or has ranks of its own that the
  // other members don't share. Members with identical individual ranks can be raised as a group again.
  for (const g of groups) {
    const members = skills.filter((s) => s.group === g.name);
    const specced = members.find((s) => s.spec);
    const own = members.map((s) => s.p + s.k + s.a);
    const uneven = own.some((v) => v > 0) && new Set(own).size > 1;
    g.broken = !!specced || uneven;
    g.brokenWhy = specced
      ? `${specced.name} has a specialization, which permanently breaks the group.`
      : uneven ? `Some members have ranks of their own (${members.filter((s) => s.p + s.k + s.a > 0).map((s) => s.name).join(', ')}). The group can be raised as a whole again once every member has the same rating.` : '';
  }
  const knowPool = (N('INT') + N('LOG')) * R.knowledgeMult + sumFx('knowpts'); // + Aged's bonus knowledge points
  let knowUsed = 0;
  const know = ch.know.map((k) => {
    const cat = k.cat || 'Street';
    const native = !!k.native;
    const base = k.f || 0;
    const rating = native ? 'N' : base + k.p + k.k + k.a;
    const attrKey = cat === 'Language' ? 'INT' : String(k.attr || (cat === 'Academic' || cat === 'Professional' ? 'LOG' : 'INT')).toUpperCase();
    const kPct = (what) => fx.filter((e) => e.t === 'skillcost' && e.what === what && e.cat === cat).reduce((m, e) => m * (e.pct / 100), 1);
    const kc = Math.ceil(stepCost(base + k.p, k.k, R.newKnowKarma) * kPct('karma') - 1e-9);
    const kAdj = careerRankAdjust(fx, { active: false, category: cat });
    const ac = Math.ceil((kAdj.length ? adjustedStepCost(base + k.p + k.k, k.a, R.improveKnowKarma, kAdj) : stepCost(base + k.p + k.k, k.a, R.improveKnowKarma)) * kPct('karma') - 1e-9);
    knowUsed += Math.ceil(k.p * kPct('points') - 1e-9); // College Education: Academic at half cost
    const specCost = k.spec ? (k.specSrc === 'k' || k.specSrc === 'a' ? R.specKarma : 0) : 0;
    const specPts = k.spec && !(k.specSrc === 'k' || k.specSrc === 'a') ? 1 : 0;
    knowUsed += specPts;
    skillKarma += create ? kc + ac + specCost : ac + specCost;
    return { ...k, cat, native, rating, attrKey, pool: native ? 0 : (attr[attrKey] ? attr[attrKey].pool : 0) + (base + k.p + k.k + k.a), kCost: kc, aCost: ac };
  });
  const knowOverflow = Math.max(0, knowUsed - knowPool);
  // one native language (SR5 p.150); Bilingual allows a second (p.72)
  const nativeLimit = 1 + sumFx('natives');
  const natives = ch.know.filter((k) => k.native).length;
  if (natives > nativeLimit) warn(`${natives} native languages - only ${nativeLimit === 1 ? 'one (two with the Bilingual quality)' : nativeLimit} allowed (SR5 core p.150).`);
  const skillPtsSpent = skillPtsUsed + knowOverflow;
  if (create) {
    if (skillPtsSpent > skillPtsTotal) warn(`Skill points overspent by ${skillPtsSpent - skillPtsTotal}.`, 'error');
    if (groupPtsUsed > groupPtsTotal) warn(`Skill group points overspent by ${groupPtsUsed - groupPtsTotal}.`, 'error');
    for (const s of skills) if (s.rating > R.maxSkillCreate + s.maxBonus) warn(`${s.name} is above the creation maximum (${R.maxSkillCreate + s.maxBonus}).`, 'error');
  }

  // ---- karma: qualities, magic, contacts
  let posQ = 0;
  let negQ = 0;
  let qualAdv = 0;
  for (const q of qualities) {
    if (q.auto) continue;
    if (create || !q.a) { if (q.karma > 0) posQ += q.karma; else negQ += -q.karma; }
    else qualAdv += q.karma > 0 ? q.karma : -q.karma; // career: paying karma to buy / to buy off
  }
  const posCounted = posQ;
  const negCounted = Math.min(negQ, R.qualityKarmaLimit);
  // SR5 core p.71: Positive Qualities may exceed the 25-Karma limit if matched by an equal amount of Negative
  // Quality Karma beyond its own 25-Karma limit - that excess Negative Karma still gives no bonus Karma (negCounted
  // stays capped above), it only raises how much can be spent on Positive Qualities.
  const posLimit = R.qualityKarmaLimit + Math.max(0, negQ - R.qualityKarmaLimit);
  if (create) {
    if (posQ > posLimit) {
      warn(`Positive qualities cost ${posQ} Karma (limit ${posLimit}${posLimit > R.qualityKarmaLimit ? `, extended from ${R.qualityKarmaLimit} by ${posLimit - R.qualityKarmaLimit} Karma of Negative qualities` : ''}).`, 'error');
    }
    if (negQ > R.qualityKarmaLimit) warn(`Negative qualities give ${negQ} Karma (only ${R.qualityKarmaLimit} counts toward bonus Karma).`);
  }

  const paidList = (list, freeCount) =>
    list.map((it, i) => ({ it, paid: create ? i >= freeCount : !!it.a }));
  let spellFree = num(talent.spells);
  const freeSpellNotes = [];
  for (const e of fx.filter((x) => x.t === 'freespells')) {
    const sk = e.by === 'skill' ? skills.find((x) => x.name === e.skill) : null;
    const n = e.by === 'skill' ? (sk ? sk.rating + (sk.spec ? 1 : 0) : 0) : e.by === 'halfattr' ? Math.floor((attr[e.attr] ? attr[e.attr].total : 0) / 2) : e.v;
    spellFree += n;
    if (n) freeSpellNotes.push(`${n} free${e.touch ? ' touch' : ''} spell${n === 1 ? '' : 's'}${e.name ? ` (${e.name})` : ''} from ${e.src}`);
  }
  const spells = paidList(ch.spells, spellFree);
  const spellCost = Math.max(1, R.spellKarma + sumFx('spellkarma')); // Spellslinger: new spells 1 Karma less
  const spellKarma = spells.filter((s) => s.paid).length * spellCost;
  // aspect-style restrictions (Apprentice, Elementalist, Hedge Witch/Wizard - Forbidden Arcana p.43-47)
  const magicLimits = qualities.map((q) => magicRestriction(q, ch.tradition)).filter(Boolean);
  for (const lim of magicLimits) {
    if (lim.spellCats) for (const s of ch.spells) {
      const sd = itemDef('spells', s);
      if (sd && !lim.spellCats.includes(sd.category)) warn(`${sd.name}: ${lim.label} can only use ${lim.spellCats.join(' / ')} spells.`);
    }
    for (const n of lim.needs || []) if (!(qualities.find((q) => q.name === lim.label) || {}).choice?.[n]) warn(`${lim.label}: pick the ${n === 'category' ? 'spell category' : 'spirit type'} on the quality (Qualities tab).`);
  }
  const cfFree = num(talent.cfp);
  const cforms = paidList(ch.complexForms, cfFree);
  const cfKarma = cforms.filter((s) => s.paid).length * R.complexFormKarma;
  const magicScore = attr.MAG.total;
  if (create) {
    if (ch.spells.length > Math.max(spellFree, attr.MAG.natural * 2) && ch.spells.length > 0) warn(`Spells known at creation are limited to Magic x 2 (${attr.MAG.natural * 2}).`);
    if (ch.complexForms.length > Math.max(cfFree, attr.LOG.natural)) warn(`Complex forms at creation are limited to Logic (${attr.LOG.natural}).`);
  }

  // adept powers
  const isAdept = talent.value === 'Adept';
  const isMystic = talent.value === 'Mystic Adept';
  let ppUsed = 0;
  // an Adept Way halves one level of one power from its list per 2 points of Magic (Street Grimoire p.176)
  const way = wayOf(qNames);
  const waySlots = way ? wayDiscountSlots(attr.MAG.total) : 0;
  let wayUsed = 0;
  let wayExtra = 0; // Beast's / Spiritual Way: one power from another Way's list
  let waySaved = 0;
  for (const p of ch.powers) {
    const def = itemDef('powers', p);
    if (!def) continue;
    const per = num(def.points);
    const lvl = def.levels === 'True' ? p.level || 1 : 1;
    ppUsed += per * lvl + num(def.extrapointcost); // extrapointcost is paid once (Improved Reflexes: 1/level + 0.5)
    if (p.wayDiscount) {
      const listed = wayEligible(def, way);
      const extraOk = !listed && wayExtra === 0 && wayEligible(def, way, { extra: true });
      if (!way) warn(`${def.name}: marked for a Way discount, but the character follows no Adept Way.`);
      else if (!listed && !extraOk) warn(`${def.name} isn't on ${way}'s list, so it can't take the Way discount.`);
      else if (wayUsed >= waySlots) warn(`Way discount on ${def.name}: only ${waySlots} power${waySlots === 1 ? '' : 's'} can be discounted at Magic ${attr.MAG.total} (one per 2 Magic).`);
      else { const save = wayDiscount(def); ppUsed -= save; waySaved += save; wayUsed++; if (extraOk) wayExtra++; }
    }
  }
  const ppTotal = (isAdept ? attr.MAG.total : isMystic ? Math.max(0, ch.mysPP || 0) : 0) + (isAdept || isMystic ? sumFx('pp') : 0);
  const mysPPKarma = isMystic ? (ch.mysPP || 0) * R.mysAdeptPPKarma : 0;
  if ((isAdept || isMystic) && ppUsed > ppTotal + 1e-9) warn(`Power points overspent (${ppUsed}/${ppTotal}).`, 'error');

  // contacts
  const contactFree = N('CHA') * R.contactKarmaMult;
  let contactSpent = 0;
  // a free contact (Made Man's syndicate, Run Faster p.148) costs no Karma
  for (const c of ch.contacts) if (!c.free) contactSpent += Math.max(2, num(c.connection, 1) + num(c.loyalty, 1)) * R.contactKarma;
  // Friends in High Places (Run Faster p.147): CHA x 4 more free Karma, only for contacts of Connection 8+; leftovers are lost
  const highFree = fx.some((e) => e.t === 'contacthigh') ? N('CHA') * 4 : 0;
  const highCost = ch.contacts.filter((c) => !c.free && num(c.connection, 1) >= 8).reduce((s, c) => s + Math.max(2, num(c.connection, 1) + num(c.loyalty, 1)) * R.contactKarma, 0);
  const highCovered = Math.min(highFree, highCost);
  const contactPaid = create ? Math.max(0, contactSpent - highCovered - contactFree) : contactSpent;
  if (create) for (const c of ch.contacts) if (!c.free && num(c.connection, 1) + num(c.loyalty, 1) > 7) warn(`Contact "${c.name || '?'}" exceeds 7 Karma at creation.`);

  // ---- money
  const money = { gear: 0, weapons: 0, armor: 0, cyberware: 0, bioware: 0, vehicles: 0, lifestyles: 0 };
  const overAvail = [];
  const excon = fx.some((e) => e.t === 'excon');
  const lifestylePct = sumFx('lifestyle');
  const items = { gear: [], weapons: [], armor: [], vehicles: [], lifestyles: [] };
  // "Children Cost" (Distributed Deck, CA p.139, and anything else that prices off its own bundled children's
  // cost - see gearBundle.js) isn't a catalogue field anywhere; it has to be summed from the actual owned children.
  // Bottom-up so a child that itself references Children Cost (nested bundles) resolves correctly.
  const gearDefByUid = new Map();
  for (const it of ch.gear) { const d = itemDef('gear', it); if (d) gearDefByUid.set(it.uid, d); }
  const childrenCostCache = new Map();
  const childrenCostOf = (uid) => {
    if (childrenCostCache.has(uid)) return childrenCostCache.get(uid);
    childrenCostCache.set(uid, 0); // cycle guard
    let sum = 0;
    for (const it of ch.gear) {
      if (it.parent !== uid) continue;
      const d = gearDefByUid.get(it.uid);
      if (!d) continue;
      sum += priceItem('gear', d, it, { vars: { 'Children Cost': childrenCostOf(it.uid) } }).cost;
    }
    childrenCostCache.set(uid, sum);
    return sum;
  };
  for (const kind of ['gear', 'weapons', 'armor', 'vehicles']) {
    for (const it of ch[kind]) {
      const def = itemDef(kind, it);
      if (!def) continue;
      const p = priceItem(kind, def, it, kind === 'gear' ? { vars: { 'Children Cost': childrenCostOf(it.uid) } } : {});
      let cost = p.cost;
      if (kind === 'vehicles' && !it.free) {
        const deal = fx.filter((e) => e.t === 'dealer' && VEHICLE_CLASSES[e.cls] && VEHICLE_CLASSES[e.cls](def.category));
        if (deal.length) cost = Math.round(cost * 0.9);
      }
      let availN = p.avail.n;
      let stats = null;
      if (kind === 'weapons' || kind === 'armor' || kind === 'vehicles') {
        const modList = it.mods || [];
        const modIx = kind === 'weapons' ? idx('weapons', 'accessories') : kind === 'armor' ? idx('armor', 'mods') : idx('vehicles', 'mods');
        // a mod's cost can depend on what it's fitted to: "Weapon Cost * Rating", a drone's Body ("Rating * Body * 200")
        const extra = { parentCost: p.cost, vars: kind === 'vehicles' ? vehicleVars(def) : {} };
        const fitted = [];
        for (const m of modList) {
          const md = modIx.byId.get(m.id);
          if (!md) continue;
          const mp = priceItem(kind, md, { rating: m.rating || 1, variable: m.variable }, extra);
          cost += mp.cost;
          availN = Math.max(availN, mp.avail.n);
          fitted.push({ md, rating: m.rating || 1 });
        }
        if (kind === 'vehicles') {
          stats = applyVehicleMods(def, fitted);
          stats.slots = modSlots(def, fitted, stats); // Rigger 5.0 mod points / slots
          const over = stats.slots.drone ? (stats.slots.left < 0 ? [`${-stats.slots.left} Mod Point${stats.slots.left === -1 ? '' : 's'}`] : [])
            : stats.slots.cats.filter((c) => c.left < 0).map((c) => `${-c.left} ${c.cat} slot${c.left === -1 ? '' : 's'}`);
          if (over.length) warn(`${def.name} has more modifications than it has room for (${over.join(', ')} over).`);
        }
      }
      // armor capacity (SR5 p.437) and weapon accessory mounts (p.431) - v28, weren't checked before
      let fit = null;
      if (kind === 'armor') {
        fit = armorCapacity(def, it, idx('armor', 'mods'));
        if (fit && fit.used > fit.total) warn(`${def.name}: its modifications use ${fit.used} Capacity, but it only has ${fit.total} (SR5 core p.437).`);
      } else if (kind === 'weapons') {
        fit = weaponMounts(def, it, idx('weapons', 'accessories'));
        if (fit && fit.conflicts.length) warn(`${def.name}: no free mount for ${fit.conflicts.join(', ')} - it has ${fit.mounts.join(', ')} (SR5 core p.431).`);
      }
      money[kind] += cost;
      items[kind].push({ it, def, cost, avail: { ...p.avail, n: availN }, ...(stats ? { stats } : {}), ...(fit ? { fit } : {}) });
      if (create && availN > R.maxAvailCreate && !bool(it.overrideAvail)) overAvail.push({ name: def.name, n: availN });
    }
  }
  // weapons that come with a quality (Claws, Fangs, Kick (Centaur)...) or an implant (Hand Razors, Spurs, cyber pistols,
  // Shock Hand...): Chummer's `addweapon`. Always carried, free, not removable on their own - they go with their source.
  const wIx = idx('weapons', 'weapons');
  const addAuto = (names, srcUid, srcName) => {
    for (const n of arr(names)) {
      const def = wIx.byName.get(String(txt(n)).toLowerCase());
      if (!def) continue;
      const it = { uid: `auto-w-${srcUid}-${def.id}`, id: def.id, name: def.name, auto: true, from: srcName, equipped: true };
      items.weapons.push({ it, def, cost: 0, avail: { n: 0, flag: '' } });
    }
  };
  for (const q of qualities) if (q.def.addweapon) addAuto(q.def.addweapon, q.uid, q.name);
  for (const a of augs) if (a.def.addweapon) addAuto(a.def.addweapon, a.it.uid, a.def.name);
  for (const a of augs) {
    money[a.kind] += a.cost;
    if (create && a.avail.n > R.maxAvailCreate) overAvail.push({ name: a.def.name, n: a.avail.n });
    // Ex-Con (Run Faster p.155): no Restricted or Forbidden augmentations
    if (excon && a.avail && (a.avail.flag === 'R' || a.avail.flag === 'F')) warn(`${a.def.name}: an Ex-Con can't have Restricted or Forbidden augmentations (Run Faster p.155).`);
  }
  // Restricted Gear (Run Faster p.149): at creation, one item may go up to Availability 24
  let restrictedLeft = create ? Math.min(1, fx.filter((e) => e.t === 'restricted').length) : 0;
  for (const o of overAvail.sort((x, y) => y.n - x.n)) {
    if (restrictedLeft > 0 && o.n <= 24) { restrictedLeft--; continue; }
    warn(`${o.name} has Availability ${o.n} (max ${R.maxAvailCreate} at creation).`);
  }
  // Erased (Run Faster p.146): never a lifestyle above Middle
  if (fx.some((e) => e.t === 'erased')) {
    for (const it of ch.lifestyles) if (['High', 'Luxury'].includes(it.name)) warn(`${it.name} lifestyle: an Erased character can't keep a lifestyle above Middle (Run Faster p.146).`);
  }
  // Changeling (SURGE): positive metagenic qualities are paid from a metagenic Karma balance (Run Faster p.112),
  // topped up by negative metagenic qualities
  const metaLimit = fx.filter((e) => e.t === 'metageniclimit').reduce((m, e) => Math.max(m, e.v), 0);
  if (metaLimit) {
    const pos = qualities.filter((q) => !q.auto && q.def.metagenic === 'True' && q.karma > 0).reduce((s, q) => s + q.karma, 0);
    const neg = qualities.filter((q) => !q.auto && q.def.metagenic === 'True' && q.karma < 0).reduce((s, q) => s - q.karma, 0);
    if (pos > metaLimit + neg) warn(`Metagenic qualities cost ${pos} Karma; a SURGE changeling has ${metaLimit}${neg ? ` + ${neg} from negative metagenic qualities` : ''} (Run Faster p.112).`);
  }
  // Trust Fund (Run Faster p.151): the lifestyle marked `trustFund` is paid by the fund - it costs nothing
  const trustLevel = trustFundLevel(fx);
  const trustTier = trustLevel ? TRUST_FUND[trustLevel].lifestyle : '';
  let trustPaid = 0;
  for (const it of ch.lifestyles) {
    const def = itemDef('lifestyles', it);
    if (!def) continue;
    const base = num(def.cost);
    // quality multipliers (%) stack with the metatype's; flat monthly extras (e.g. DocWagon) are added after
    const monthly = base * (1 + (lifestylePct + num(it.pct)) / 100) + num(it.flat);
    const trust = !!(it.trustFund && trustLevel && trustPaid === 0);
    if (trust) {
      trustPaid++;
      if (def.name !== trustTier) warn(`Trust Fund ${trustLevel} pays a ${trustTier === 'Medium' ? 'Middle (Medium)' : trustTier} lifestyle, not ${def.name} (Run Faster p.151).`);
    } else if (it.trustFund) {
      warn(trustLevel ? `Only one lifestyle can be paid by the Trust Fund.` : `${def.name} is marked as paid by a trust fund, but the character has no Trust Fund quality.`);
    }
    const cost = trust ? 0 : Math.round(monthly * (it.months || 1));
    money.lifestyles += cost;
    items.lifestyles.push({ it, def, cost, trust });
  }
  const nuyenSpent = Object.values(money).reduce((s, v) => s + v, 0);
  const karmaNuyenMax = R.maxKarmaToNuyen + sumFx('karmanuyenmax'); // Born Rich: up to 40 (Run Faster p.145)
  const karmaConv = Math.min(karmaNuyenMax, Math.max(0, num(ch.karmaConverted)));
  const debtNuyen = create ? sumFx('nuyenbonus') : 0; // In Debt: 5,000 per level (paid back later, Run Faster p.156)
  const nuyenTotal = (create ? resourceNuyen + karmaConv * R.nuyenPerKarma + debtNuyen : 0) + num(ch.nuyenAdjust) + (create ? 0 : num(ch.career.nuyenEarned));
  const nuyenLeft = nuyenTotal - nuyenSpent;
  if (create && nuyenLeft < 0) warn(`Nuyen overspent by ${(-nuyenLeft).toLocaleString()}¥.`, 'error');
  if (create && nuyenLeft > R.nuyenCarryover) warn(`Only ${R.nuyenCarryover.toLocaleString()}¥ can be carried over; spend the rest.`);

  // ---- matrix
  const personaFx = {};
  for (const e of fx.filter((x) => x.t === 'persona')) personaFx[e.k] = (personaFx[e.k] || 0) + e.v;
  const matrix = deriveMatrix(ch, { attr, gearEntries: items.gear, init, personaFx, overclock: fx.some((e) => e.t === 'overclock') });
  for (const m of matrix.warnings) warn(m);

  // ---- karma totals
  const spirits = totalBoundKarma(ch, R);
  // the Ways' bonding discount (Street Grimoire p.176-178): 2 Karma less for the listed foci
  const wayRules = qualities.flatMap((q) => arr(q.def.bonus && q.def.bonus.focusbindingkarmacost));
  let fociDiscount = 0;
  if (wayRules.length) {
    for (const e of items.gear) {
      if (!e.it.bonded || !/Focus/.test(e.def.name)) continue;
      const held = e.it.choice && e.it.choice.power ? idx('powers', 'powers').byId.get(e.it.choice.power) : null;
      const text = held ? `${held.name}${e.it.choice.skill ? ` (${e.it.choice.skill})` : ''}` : '';
      fociDiscount += Math.min(focusBondDiscount(wayRules, e.def, text), totalBondKarma([e]));
    }
  }
  const fociKarma = totalBondKarma(items.gear) - fociDiscount;
  const fociForce = bondedForce(items.gear);
  const fociLimits = focusLimits(items.gear, attr.MAG.enabled ? attr.MAG.total : 0);
  if (fociLimits.count > 0 && fociLimits.count > fociLimits.maxCount) {
    warn(`${fociLimits.count} bonded foci, but you can only bond as many as your Magic (${fociLimits.maxCount}) - SR5 core p.318.`, 'error');
  }
  if (fociLimits.force > fociLimits.maxForce) {
    warn(`Bonded foci total Force ${fociLimits.force}, above Magic x 5 (${fociLimits.maxForce}) - SR5 core p.318.`, 'error');
  }
  // Spellcasting pool per spell category: the skill's pool without its focus bonus, plus the best focus for that
  // category (a Power Focus or that category's Spellcasting Focus - only one counts)
  const castSkill = skills.find((s) => s.name === 'Spellcasting');
  const spellPool = (category) => {
    if (!castSkill || castSkill.rating <= 0) return null;
    const catFocus = fx.filter((e) => e.focus && e.t === 'spellcat' && e.cat === category).sort((x, y) => y.v - x.v)[0];
    const best = Math.max(castSkill.focusBonus, catFocus ? catFocus.v : 0);
    const src = catFocus && catFocus.v > castSkill.focusBonus ? catFocus.src : castSkill.focusSrc;
    return { pool: castSkill.pool - castSkill.focusBonus + best, focus: best, focusSrc: best ? src : '' };
  };
  const weaponFoci = {};
  for (const e of fx) if (e.focus && e.t === 'weapondice' && e.weapon) weaponFoci[e.weapon] = Math.max(weaponFoci[e.weapon] || 0, e.v);
  const initGrade = num(ch.initGrade);
  const metamagics = ch.metamagics || [];
  const initiationKarma = totalMetamagicKarma(R, initGrade, metamagics.length);
  if (metamagics.length > initGrade) {
    warn(`${metamagics.length} metamagics/echoes known, above your Initiation/Submersion grade (${initGrade}).`);
  }
  const critterKarma = (ch.critterPowers || []).filter((c) => c.bought).reduce((s, c) => s + num(c.karma), 0);
  const spent = {
    critterPowers: critterKarma,
    qualities: posCounted,
    attributes: attrKarma,
    skills: skillKarma,
    spells: create ? spellKarma : 0,
    complexForms: create ? cfKarma : 0,
    contacts: contactPaid,
    metatype: variantKarma,
    mysticPP: mysPPKarma,
    nuyen: karmaConv,
    spirits,
    foci: fociKarma,
    initiation: initiationKarma,
    martialArts: totalMartialArtKarma(R, ch.martialArts),
  };
  let karmaTotal;
  let karmaSpent;
  if (create) {
    karmaTotal = R.buildKarma + negCounted;
    karmaSpent = Object.values(spent).reduce((s, v) => s + v, 0);
  } else {
    // career: earned pool minus advancement costs since finalize
    let adv = 0;
    for (const a of ALL_ATTRS) adv += attr[a].aCost;
    for (const g of groups) adv += g.aCost;
    for (const s of skills) adv += s.aCost + (s.specSrc === 'a' && s.spec ? s.specCost : 0);
    for (const k of know) adv += k.aCost;
    adv += spells.filter((s) => s.paid).length * spellCost + cforms.filter((s) => s.paid).length * R.complexFormKarma;
    adv += qualAdv;
    adv += contactSpent > 0 ? ch.contacts.filter((c) => c.a && !c.free).reduce((s, c) => s + Math.max(2, num(c.connection, 1) + num(c.loyalty, 1)), 0) : 0;
    adv += fociKarma;
    adv += critterKarma;
    adv += initiationKarma;
    adv += spirits;
    adv += spent.martialArts;
    karmaTotal = num(ch.career.earned);
    karmaSpent = adv;
    spent.advancement = adv;
  }
  const karmaLeft = karmaTotal - karmaSpent;
  if (create) {
    if (karmaLeft < 0) warn(`Karma overspent by ${-karmaLeft}.`, 'error');
    if (karmaLeft > R.karmaCarryover) warn(`Only ${R.karmaCarryover} Karma can be carried into play; ${karmaLeft - R.karmaCarryover} must be spent.`);
  } else if (karmaLeft < 0) warn(`Karma overspent by ${-karmaLeft}.`, 'error');

  return {
    R, mt, talent, create, warnings,
    pri: { attrPtsTotal, skillPtsTotal, groupPtsTotal, specialPtsTotal, resourceNuyen, variantKarma },
    used: { attrPts: attrPtsUsed, specialPts: specialPtsUsed, skillPts: skillPtsSpent, groupPts: groupPtsUsed, knowUsed, knowPool, knowOverflow },
    attr, essence, essMax, essLoss, magLoss, augs, qualities,
    cyberlimbs, strCombat, agiCombat,
    limits, init, cm, armor, armorWorn, pools, move, carry,
    skills, groups, know, spells, cforms,
    magic: {
      enabled: magicEnabled || resEnabled, isAdept, isMystic, ppUsed, ppTotal, spellFree, spellCost, cfFree, magicScore,
      fociForce, fociKarma, fociLimits, initGrade, metamagicCount: metamagics.length, initiationKarma, spellPool, weaponFoci,
    },
    contacts: { free: contactFree, spent: contactSpent, paid: contactPaid },
    situational: fx.filter((e) => e.t === 'situational').map((e) => ({ src: e.src, what: e.what, v: e.v, condition: e.condition, key: conditionKey(e), canApply: !!e.apply, active: !!e.active })),
    karma: { total: karmaTotal, spent, spentTotal: karmaSpent, left: karmaLeft, pos: posQ, neg: negQ, negCounted },
    mentor: { hasQuality: hasMentorQuality, def: mentorDef, pick: mentorPick },
    powerGrants: powerGrantList,
    woundIgnore, drugResist, karmaNuyenMax, debtNuyen,
    way: way ? { name: way, slots: waySlots, used: wayUsed, saved: waySaved } : null, fociDiscount, freeSpellNotes, magicLimits,
    extraSpirits: fx.filter((e) => e.t === 'extraspirit').map((e) => e.type),
    weaponDV: fx.filter((e) => e.t === 'weapondv').reduce((m, e) => ({ ...m, [e.skill]: (m[e.skill] || 0) + e.v }), {}),
    overclock: fx.some((e) => e.t === 'overclock'), nativeLimit: 1 + sumFx('natives'),
    reputation: reputation(ch, fx),
    trustFund: trustLevel ? { level: trustLevel, lifestyle: trustTier, paid: trustPaid > 0 } : null,
    madeMan: fx.some((e) => e.t === 'addcontact') ? { loyalty: Math.max(...fx.filter((e) => e.t === 'addcontact').map((e) => e.loyalty)), has: ch.contacts.some((c) => c.mademan) } : null,
    critterPowers,
    nuyen: { total: nuyenTotal, spent: nuyenSpent, left: nuyenLeft, byKind: money },
    items, fx, matrix,
  };
}
