// Turn a Chummer <bonus> node into a flat list of typed effects the sheet can apply.
// Only well-understood tags are converted; everything else is ignored (shown as text by the UI).
import { arr, txt, num } from './data.js';
import { evalExpr } from './expr.js';

const ev = (v, vars) => {
  const n = evalExpr(txt(v), vars);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * @param {object|string} bonus  the raw <bonus> node
 * @param {object} vars          {Rating, ...} for expressions
 * @param {object} [choice]      user selections stored on the owning item (attribute/skill picks)
 */
export function effectsOf(bonus, vars = {}, choice = {}) {
  const out = [];
  if (!bonus || typeof bonus !== 'object') return out;
  const push = (e) => { if (e.v !== 0 || e.t === 'attr') out.push(e); };

  for (const s of arr(bonus.specificattribute)) {
    if (!s || typeof s !== 'object') continue;
    const a = txt(s.name).toUpperCase();
    out.push({ t: 'attr', a, v: ev(s.val, vars), max: ev(s.max, vars), min: ev(s.min, vars), aug: ev(s.aug, vars) });
  }
  // "choose an attribute" bonuses. Exceptional Attribute: one pick, its maximum +1 (choice.attr). Slots with a value
  // (Infected: Goblin - two +1s among BOD/REA/STR, two among WIL/INT) are separate picks, each from its own list
  // (choice.attrs[i]) - these used to be treated like Exceptional Attribute (v27 fix)
  const slots = attrSlots(bonus);
  if (slots.length) {
    slots.forEach((sl, i) => {
      const a = (choice.attrs || [])[i];
      if (a && sl.attrs.includes(a)) out.push({ t: 'attr', a, v: ev(sl.val, vars), max: 0, min: 0, aug: 0 });
    });
  } else if (bonus.selectattributes && choice.attr) {
    out.push({ t: 'attr', a: choice.attr, v: 0, max: 1, min: 0, aug: 1 });
  }
  if (bonus.initiative !== undefined) push({ t: 'init', v: ev(bonus.initiative, vars) });
  if (bonus.initiativepass !== undefined) push({ t: 'initdice', v: ev(bonus.initiativepass, vars) });
  if (bonus.conditionmonitor && typeof bonus.conditionmonitor === 'object') {
    const c = bonus.conditionmonitor;
    if (c.physical !== undefined) push({ t: 'cmPhys', v: ev(c.physical, vars) });
    if (c.stun !== undefined) push({ t: 'cmStun', v: ev(c.stun, vars) });
    if (c.overflow !== undefined) push({ t: 'cmOverflow', v: ev(c.overflow, vars) });
    // High Pain Tolerance: ignore boxes of damage when working out wound modifiers
    if (c.thresholdoffset !== undefined) push({ t: 'woundoffset', v: ev(c.thresholdoffset, vars) });
  }
  for (const a of arr(bonus.armor)) push({ t: 'armor', v: ev(a, vars) });
  if (bonus.damageresistance !== undefined) push({ t: 'dr', v: ev(bonus.damageresistance, vars) });
  if (bonus.dodge !== undefined) push({ t: 'dodge', v: ev(bonus.dodge, vars) });
  if (bonus.reach !== undefined) push({ t: 'reach', v: ev(bonus.reach, vars) });
  if (bonus.lifestylecost !== undefined) push({ t: 'lifestyle', v: ev(bonus.lifestylecost, vars) });
  if (bonus.essencepenalty !== undefined) push({ t: 'essence', v: ev(bonus.essencepenalty, vars) });
  if (bonus.essencepenaltyt100 !== undefined) push({ t: 'essence', v: ev(bonus.essencepenaltyt100, vars) / 100 });
  for (const k of ['notoriety', 'publicawareness', 'fame']) {
    if (bonus[k] !== undefined) push({ t: k, v: ev(bonus[k], vars) });
  }
  for (const [tag, which] of [['physicallimit', 'Physical'], ['mentallimit', 'Mental'], ['sociallimit', 'Social']]) {
    if (bonus[tag] !== undefined) push({ t: 'limit', which, v: ev(bonus[tag], vars) });
  }
  // a limit modifier with a condition ("LimitCondition_Sprawl", "..._SkillsActiveSneakingVisible") only applies in that
  // situation - it used to be applied all the time (114 of them: Fame, Trustworthy, the Chameleon Suit...); now a note
  for (const m of arr(bonus.limitmodifier)) {
    if (!m || typeof m !== 'object') continue;
    if (m.condition) out.push({ t: 'situational', what: `${txt(m.limit)} limit`, v: ev(m.value, vars), condition: limitConditionText(txt(m.condition)), apply: { t: 'limit', which: txt(m.limit), v: ev(m.value, vars) } });
    else push({ t: 'limit', which: txt(m.limit), v: ev(m.value, vars) });
  }
  // a bonus with a <condition> ("Urban", "Meeting people the first time") only applies in that situation: it becomes
  // a note for the table, not a change to the pool
  const note = (what, v, condition, apply) => out.push({ t: 'situational', what, v, condition: txt(condition), ...(apply ? { apply } : {}) });
  for (const s of arr(bonus.specificskill)) {
    if (!s || typeof s !== 'object') continue;
    if (s.condition) note(txt(s.name), ev(s.bonus, vars), s.condition, { t: 'skill', name: txt(s.name), v: ev(s.bonus, vars), max: 0 });
    else push({ t: 'skill', name: txt(s.name), v: ev(s.bonus, vars), max: ev(s.max, vars) });
  }
  for (const c of arr(bonus.skillcategory)) {
    if (!c || typeof c !== 'object') continue;
    if (c.condition) note(`${txt(c.name)} skills`, ev(c.bonus, vars), c.condition, { t: 'skillcat', cat: txt(c.name), v: ev(c.bonus, vars), exclude: arr(c.exclude).map(txt) });
    else push({ t: 'skillcat', cat: txt(c.name), v: ev(c.bonus, vars), exclude: arr(c.exclude).map(txt) });
  }
  for (const g of arr(bonus.skillgroup)) {
    if (!g || typeof g !== 'object') continue;
    if (g.condition) note(`${txt(g.name)} group${g.exclude ? ` (not ${arr(g.exclude).map(txt).join(', ')})` : ''}`, ev(g.bonus, vars), g.condition, { t: 'skillgrp', group: txt(g.name), v: ev(g.bonus, vars), exclude: arr(g.exclude).map(txt) });
    else push({ t: 'skillgrp', group: txt(g.name), v: ev(g.bonus, vars), exclude: arr(g.exclude).map(txt) });
  }
  // "pick a skill" (Aptitude: +1 max; Improved Ability: +Rating; Loss of Confidence: -2) - the pick lives on the item
  if (bonus.selectskill && typeof bonus.selectskill === 'object' && choice.skill) {
    const s = bonus.selectskill;
    out.push({ t: 'skill', name: choice.skill, v: s.val !== undefined ? ev(s.val, vars) : 0, max: s.max !== undefined ? ev(s.max, vars) : 0 });
  }
  // "pick an attribute" adept powers (Improved Physical Attribute: +Rating); Attribute Boost has no fixed value
  if (bonus.selectattribute && typeof bonus.selectattribute === 'object' && choice.attr && bonus.selectattribute.val !== undefined) {
    out.push({ t: 'attr', a: choice.attr, v: ev(bonus.selectattribute.val, vars), max: 0, min: 0, aug: 0 });
  }
  // foci (SR5 core p.318-320): a Power Focus adds its Force to every Magic-linked test (Chummer: skillattribute MAG), a
  // Spellcasting Focus to spells of its category, a Weapon Focus to melee attacks with that weapon
  for (const sa of arr(bonus.skillattribute)) {
    if (sa && typeof sa === 'object') push({ t: 'skillattr', attr: txt(sa.name).toUpperCase(), v: ev(sa.bonus, vars) });
  }
  for (const sc of arr(bonus.spellcategory)) {
    if (sc && typeof sc === 'object') push({ t: 'spellcat', cat: txt(sc.name), v: ev(sc.val, vars) });
  }
  if (bonus.weaponspecificdice !== undefined) push({ t: 'weapondice', v: ev(bonus.weaponspecificdice, vars) });
  // Run Faster "perk" qualities (engine/qualityPerks.js): Trust Fund's level, Made Man's free syndicate contact
  if (bonus.trustfund !== undefined) out.push({ t: 'trustfund', v: num(txt(bonus.trustfund)) || 1 });
  if (bonus.addcontact !== undefined) {
    const c = typeof bonus.addcontact === 'object' ? bonus.addcontact : {};
    out.push({ t: 'addcontact', v: 1, loyalty: num(txt(c.forcedloyalty)) || 1, group: c.forcegroup !== undefined || c.group !== undefined });
  }
  if (bonus.mademan !== undefined) {
    note('Availability tests', 1, 'buying stolen / restricted goods through your syndicate (also 10% off; they fence your loot for 30% of its value)');
  }
  // ---- the quality audit (v26): everything below turns more of Chummer's bonus vocabulary into effects
  // toxin / pathogen resistance per vector, fatigue resistance (Crystal Gut, Resistance to Toxins...)
  for (const [k, val] of Object.entries(bonus)) {
    const m = /^(toxin|pathogen)(contact|ingestion|inhalation|injection)resist$/.exec(k);
    if (m) push({ t: 'drugresist', kind: m[1], vector: m[2], v: ev(val, vars) });
  }
  if (bonus.fatigueresist !== undefined) push({ t: 'drugresist', kind: 'fatigue', vector: '', v: ev(bonus.fatigueresist, vars) });
  if (bonus.memory !== undefined) push({ t: 'pool', pool: 'memory', v: ev(bonus.memory, vars) });
  if (bonus.defensetest !== undefined) push({ t: 'dodge', v: ev(bonus.defensetest, vars) }); // Cyclopean Eye
  for (const [key, kind] of [['firearmor', 'fire'], ['coldarmor', 'cold'], ['electricityarmor', 'electricity']]) {
    if (bonus[key] !== undefined) push({ t: 'elemarmor', kind, v: ev(bonus[key], vars) });
  }
  // movement (ground only - swim/fly aren't tracked): +N to the walk / run multiplier, or replace it
  for (const [key, speed] of [['walkmultiplier', 'walk'], ['runmultiplier', 'run']]) {
    for (const w of arr(bonus[key])) if (w && typeof w === 'object' && txt(w.category) === 'Ground') push({ t: 'movemult', speed, v: ev(w.val, vars) });
  }
  for (const w of arr(bonus.movementreplace)) {
    if (w && typeof w === 'object' && txt(w.category) === 'Ground' && ['walk', 'run'].includes(txt(w.speed))) push({ t: 'moveset', speed: txt(w.speed), v: ev(w.val, vars) });
  }
  // Essence: blood crystals' Essence that doesn't cost Magic, 'ware Essence multipliers, maximum Essence
  if (bonus.essencepenaltymagonlyt100 !== undefined) push({ t: 'magessence', v: ev(bonus.essencepenaltymagonlyt100, vars) / 100 });
  for (const [key, kind] of [['cyberwareessmultiplier', 'cyberware'], ['biowareessmultiplier', 'bioware'], ['cyberwaretotalessmultiplier', 'cyberware']]) {
    if (bonus[key] !== undefined) push({ t: 'essmult', kind, v: ev(bonus[key], vars) });
  }
  if (bonus.essencemax !== undefined) push({ t: 'essmax', v: ev(bonus.essencemax, vars) });
  // money at creation: Born Rich raises the Karma -> nuyen cap; In Debt / Stolen Gear pay nuyen instead of Karma
  if (bonus.nuyenmaxbp !== undefined && ev(bonus.nuyenmaxbp, vars) > 0) push({ t: 'karmanuyenmax', v: ev(bonus.nuyenmaxbp, vars) });
  if (bonus.nuyenamt !== undefined) {
    const n = bonus.nuyenamt;
    push({ t: 'nuyenbonus', v: ev(n, vars), stolen: !!(n && typeof n === 'object' && n['@condition']) });
  }
  if (bonus.adeptpowerpoints !== undefined) push({ t: 'pp', v: ev(bonus.adeptpowerpoints, vars) });
  if (bonus.livingpersona && typeof bonus.livingpersona === 'object') {
    const lp = bonus.livingpersona;
    for (const [key, k] of [['attack', 'a'], ['sleaze', 's'], ['dataprocessing', 'd'], ['firewall', 'f']]) {
      if (lp[key] !== undefined) push({ t: 'persona', k, v: ev(lp[key], vars) });
    }
  }
  if (bonus.knowledgeskillpoints !== undefined) {
    const kp = bonus.knowledgeskillpoints;
    push({ t: 'knowpts', v: ev(kp && typeof kp === 'object' ? kp.val : kp, vars) });
  }
  if (bonus.streetcredmultiplier !== undefined) push({ t: 'credDivisor', v: ev(bonus.streetcredmultiplier, vars) });
  // skill costs by category (Uncouth: Social x2; College Education: Academic knowledge x0.5; Uneducated...)
  for (const c of arr(bonus.skillcategorypointcostmultiplier)) {
    if (c && typeof c === 'object') out.push({ t: 'skillcost', cat: txt(c.name), pct: ev(c.val, vars), what: 'points' });
  }
  for (const c of arr(bonus.skillcategorykarmacostmultiplier)) {
    if (c && typeof c === 'object') out.push({ t: 'skillcost', cat: txt(c.name), pct: ev(c.val, vars), what: 'karma' });
  }
  // qualities that bring other qualities / critter powers / a new attribute table (Infected, drakes...)
  for (const a of arr(bonus.addqualities && bonus.addqualities.addquality)) out.push({ t: 'addquality', name: txt(a) });
  for (const cp of arr(bonus.critterpowers && bonus.critterpowers.power)) {
    out.push({ t: 'critterpower', name: txt(cp), select: cp && typeof cp === 'object' ? txt(cp['@select']) : '', rating: cp && typeof cp === 'object' ? txt(cp['@rating']) : '' });
  }
  for (const ra of arr(bonus.replaceattributes)) {
    if (ra && typeof ra === 'object') out.push({ t: 'replaceattr', a: txt(ra.name).toUpperCase(), min: num(txt(ra.min)), max: num(txt(ra.max)), aug: num(txt(ra.aug)) });
  }
  for (const m of arr(bonus.addmetamagic)) out.push({ t: 'addmetamagic', name: txt(m) });
  // ---- v27: the rest of the one-off qualities (engine/qualityRules.js has the rules that use these)
  // career skill costs by rank: Linguist / College Education / Technical School (-1 from rank 3), Jack of All Trades
  for (const c of arr(bonus.skillcategorykarmacost)) {
    if (c && typeof c === 'object') out.push({ t: 'rankcost', cat: txt(c.name), v: ev(c.val, vars), min: c.min !== undefined ? num(txt(c.min)) : null, max: c.max !== undefined ? num(txt(c.max)) : null });
  }
  for (const [key, scope] of [['activeskillkarmacost', 'active'], ['knowledgeskillkarmacost', 'knowledge']]) {
    for (const c of arr(bonus[key])) {
      if (c && typeof c === 'object') out.push({ t: 'rankcost', scope, v: ev(c.val, vars), min: c.min !== undefined ? num(txt(c.min)) : null, max: c.max !== undefined ? num(txt(c.max)) : null });
    }
  }
  for (const c of arr(bonus.skillcategoryspecializationkarmacostmultiplier)) {
    if (c && typeof c === 'object') out.push({ t: 'speccost', cat: txt(c.name), pct: ev(c.val, vars) });
  }
  for (const c of arr(bonus.skillgroupcategorykarmacostmultiplier)) {
    if (c && typeof c === 'object') out.push({ t: 'groupcost', cat: txt(c.name), pct: ev(c.val, vars) });
  }
  for (const c of arr(bonus.blockskillcategorydefaulting)) if (txt(c)) out.push({ t: 'nodefault', cat: txt(c) });
  for (const c of arr(bonus.skillgroupcategorydisable)) if (txt(c)) out.push({ t: 'nogroupcat', cat: txt(c) });
  if (bonus.skillgroupdisablechoice !== undefined && choice.group) out.push({ t: 'nogroup', group: choice.group });
  // spells
  if (bonus.newspellkarmacost !== undefined) push({ t: 'spellkarma', v: ev(bonus.newspellkarmacost, vars) });
  for (const f of arr(bonus.freespells)) {
    if (!f || typeof f !== 'object') continue;
    if (f['@skill']) out.push({ t: 'freespells', by: 'skill', skill: txt(f['@skill']), v: 0 });
    else if (f['@attribute']) out.push({ t: 'freespells', by: 'halfattr', attr: txt(f['@attribute']).toUpperCase(), touch: /touch/.test(txt(f['@limit'])), v: 0 });
  }
  for (const a of arr(bonus.addspell)) out.push({ t: 'freespells', by: 'fixed', v: 1, name: txt(a) });
  // Death Dealer (Adept): +DV with melee weapons of the chosen skill
  if (bonus.weaponcategorydv && typeof bonus.weaponcategorydv === 'object' && choice.skill) {
    out.push({ t: 'weapondv', skill: choice.skill, v: ev(bonus.weaponcategorydv.bonus, vars) });
  }
  // Chain Breaker: two more spirit types (picked on the quality)
  if (bonus.addspirit !== undefined) for (const k of ['spirit1', 'spirit2']) if (choice[k]) out.push({ t: 'extraspirit', type: choice[k] });
  // Empathic Listener: Etiquette with INT; Master Debater: Negotiation (Diplomacy) with LOG (Cutting Aces p.150-151)
  for (const [key, withSpec] of [['swapskillattribute', false], ['swapskillspecattribute', true]]) {
    const sw = bonus[key];
    if (sw && typeof sw === 'object') out.push({ t: 'swapattr', attr: txt(sw.attribute).toUpperCase(), skill: txt(sw.limittoskill), spec: withSpec ? arr(sw.spec).map(txt)[0] || '' : '', v: 1 });
  }
  if (bonus.specialattburnmultiplier !== undefined) push({ t: 'resloss', v: ev(bonus.specialattburnmultiplier, vars) });
  if (bonus.prototypetranshuman !== undefined) push({ t: 'freebioess', v: ev(bonus.prototypetranshuman, vars) });
  // identity / money / gear rules
  if (bonus.friendsinhighplaces !== undefined) out.push({ t: 'contacthigh', v: 4 });
  if (bonus.erased !== undefined) out.push({ t: 'erased', v: 1 });
  if (bonus.excon !== undefined) out.push({ t: 'excon', v: 1 });
  if (bonus.nativelanguagelimit !== undefined) push({ t: 'natives', v: ev(bonus.nativelanguagelimit, vars) });
  if (bonus.dealerconnection !== undefined) for (const c of arr(choice.classes)) out.push({ t: 'dealer', cls: c, v: 10 });
  for (const [key, kind] of [['disablecyberwaregrade', 'cyberware'], ['disablebiowaregrade', 'bioware']]) {
    if (bonus[key] !== undefined) out.push({ t: 'nograde', kind, grades: arr(bonus[key]).map(txt), v: 1 });
  }
  if (bonus.restrictedgear && typeof bonus.restrictedgear === 'object') out.push({ t: 'restricted', avail: num(txt(bonus.restrictedgear.availability)), v: num(txt(bonus.restrictedgear.amount)) || 1 });
  if (bonus.overclocker !== undefined) out.push({ t: 'overclock', v: 1 });
  if (bonus.cyberseeker !== undefined) out.push({ t: 'cyberseeker', attrs: arr(bonus.cyberseeker).map(txt), v: 1 });
  if (bonus.metageniclimit !== undefined) push({ t: 'metageniclimit', v: ev(bonus.metageniclimit, vars) });
  // picks that only need to be written down: show them as notes naming the pick
  const pick = (label, value) => out.push({ t: 'situational', what: value ? `${label}: ${value}` : `${label} - pick it on the quality`, v: null, condition: '' });
  if (bonus.selectsprite !== undefined) pick('Sprite Affinity (+1 die compiling, +1 task)', choice.text);
  if (bonus.selectparagon !== undefined) pick('Paragon', choice.text);
  if (bonus.selectinherentaiprogram !== undefined) pick('Inherent program (always running)', choice.text);
  if (bonus.selectexpertise !== undefined) pick('Inspired: Artisan specialization at +3 dice (+2 Street Cred in that field)', choice.text);
  if (bonus.selectcontact !== undefined) pick(bonus.selectcontact === '' && /Sensei/.test(JSON.stringify(bonus)) ? 'Sensei' : 'Contact', choice.contactName);
  if (bonus.martialart !== undefined) pick('One Trick Pony: one Martial Arts technique without its style', choice.text);
  // skills / groups the character can't use (Free Insect Spirits, Chain Breaker, Null Wizard...)
  for (const g of arr(bonus.skillgroupdisable)) if (txt(g)) out.push({ t: 'situational', what: `Can't use the ${txt(g)} skill group`, v: null, condition: '' });
  for (const g of arr(bonus.skilldisable)) if (txt(g)) out.push({ t: 'situational', what: `Can't use ${txt(g)}`, v: null, condition: '' });
  // situational bonuses the table has to apply by hand: shown on the Sheet's "Situational" row
  for (const [key, what, condition, fixed] of SITUATIONAL) {
    if (bonus[key] === undefined) continue;
    const raw = bonus[key];
    if (fixed !== undefined) { out.push({ t: 'situational', what: choice.text ? `${what.replace(/^Your chosen /, '')}: ${choice.text}` : what, v: fixed, condition }); continue; }
    if (Array.isArray(raw) || (raw && typeof raw === 'object' && raw.name !== undefined)) {
      for (const r of arr(raw)) if (r && typeof r === 'object') note(`${what} (${txt(r.name) || txt(r['@specific'])})`, ev(r.val ?? r._ ?? r, vars), condition);
    } else if (raw && typeof raw === 'object' && raw._ === undefined) {
      out.push({ t: 'situational', what, v: null, condition });
    } else {
      const v = raw === '' ? null : ev(raw, vars);
      out.push({ t: 'situational', what, v, condition });
    }
  }
  return out;
}

// bonus key -> how it reads on the Sheet. The number is the bonus (dice unless the text says otherwise).
/** "LimitCondition_SkillsActiveSneakingVisible" -> "skills active sneaking visible" (readable enough for the Sheet) */
export function limitConditionText(c) {
  const words = String(c || '').replace(/^LimitCondition_/, '').replace(/^Quality/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const nice = { sprawl: 'in your home sprawl', visible: 'when it can be seen', megacorp: 'dealing with that megacorp',
    'shield physical penalty': 'while carrying the shield', 'exclude intimidation': 'except Intimidation' };
  return nice[words] || `when: ${words}`;
}

export const SITUATIONAL = [
  ['physicalcmrecovery', 'Healing Physical damage', 'natural recovery tests'],
  ['stuncmrecovery', 'Healing Stun damage', 'natural recovery tests'],
  ['surprise', 'Surprise tests', ''],
  ['judgeintentionsdefense', 'Resisting Judge Intentions', 'when someone reads you'],
  ['judgeintentionsoffense', 'Judge Intentions', ''],
  ['spellresistance', 'Resisting spells', 'all spells, helpful ones too'],
  ['mentalmanipulationresist', 'Resisting mental manipulation', 'spells and powers'],
  ['manaillusionresist', 'Resisting mana illusions', ''],
  ['physicalillusionresist', 'Resisting physical illusions', ''],
  ['detectionspellresist', 'Resisting detection spells', ''],
  ['decreaselogresist', 'Resisting Decrease Logic', ''],
  ['decreaseintresist', 'Resisting Decrease Intuition', ''],
  ['unarmeddv', 'Unarmed attack DV', ''],
  ['unarmeddvphysical', 'Unarmed attacks do Physical damage', ''],
  ['sprintbonus', 'Sprinting distance %', ''],
  ['drainvalue', 'Drain Value', 'of your spells'],
  ['fadingvalue', 'Fading Value', ''],
  ['spellcategorydrain', 'Drain Value', 'spells of that category'],
  ['spellcategorydamage', 'Spell damage', 'spells of that category'],
  ['spelldescriptordrain', 'Drain Value', 'single-target direct damage spells'],
  ['spelldescriptordamage', 'Spell damage', 'single-target direct damage spells'],
  ['actiondicepool', 'Your chosen Matrix action', 'Codeslinger, SR5 core p.72', 2], // the data carries only the category
  ['weaponskillaccuracy', 'Accuracy', 'weapons of the chosen skill'],
  ['ambidextrous', 'No off-hand penalty', 'ambidextrous'],
  ['blackmarketdiscount', 'Black market purchases', '10% off (Black Market Pipeline)'],
  ['physiologicaladdictionfirsttime', 'Physiological Addiction tests', 'the first time'],
  ['physiologicaladdictionalreadyaddicted', 'Physiological Addiction tests', 'when already addicted'],
  ['psychologicaladdictionfirsttime', 'Psychological Addiction tests', 'the first time'],
  ['psychologicaladdictionalreadyaddicted', 'Psychological Addiction tests', 'when already addicted'],
  ['fadingresist', 'Fading resistance', ''],
  ['availability', 'Availability of gear you buy', 'Bad Credit'],
  ['addesstophysicalcmrecovery', 'Healing Physical damage: add your Essence', 'Uncanny Healer'],
  ['addesstostuncmrecovery', 'Healing Stun damage: add your Essence', 'Uncanny Healer'],
  ['disablebioware', "Can't have bioware", 'implants are rejected'],
  ['spelldicepool', 'Heal spells cast on you', 'Quick Healer'],
  ['astralreputation', 'Astral Reputation', 'per geas taken (Street Grimoire p.199)'],
  ['cyberadeptdaemon', 'Cyberadept daemon: overclock your cyberware', 'Kill Code p.89'],
  ['allowspritefettering', 'Technoshaman: can fetter sprites', 'Kill Code p.91'],
  ['addecho', 'Free echo', 'Resonant Stream'],
  ['specialmodificationlimit', 'Special Modifications on your weapon', 'Better Than Bad p.161: per rating +1 DV, or two of -1 AP / +1 Accuracy / +1 RC...'],
  ['addlimb', 'Extra pair of arms', 'hold/carry double; off-hand penalty per extra hand (Run Faster p.118)'],
  ['addskillspecializationoption', 'Electroception', 'Perception + INT [Mental] to sense electrical fields, range = Essence m'],
];

/** the pick-an-attribute slots of a `selectattributes` bonus that carry a value: [{attrs: ['BOD', ...], val}] */
export function attrSlots(bonus) {
  const sa = bonus && bonus.selectattributes;
  return arr(sa).filter((s) => s && typeof s === 'object' && s.val !== undefined)
    .map((s) => ({ attrs: arr(s.attribute).map((a) => txt(a).toUpperCase()), val: s.val }));
}

/** Human-readable one-line summary of an effect list, for tooltips. */
export function describeEffects(list) {
  const bits = [];
  for (const e of list) {
    const sgn = e.v > 0 ? '+' : '';
    switch (e.t) {
      case 'attr': if (e.v) bits.push(`${e.a} ${sgn}${e.v}`); if (e.max) bits.push(`${e.a} max ${e.max > 0 ? '+' : ''}${e.max}`); break;
      case 'init': bits.push(`Init ${sgn}${e.v}`); break;
      case 'initdice': bits.push(`${sgn}${e.v}D6 Init`); break;
      case 'cmPhys': bits.push(`Phys CM ${sgn}${e.v}`); break;
      case 'cmStun': bits.push(`Stun CM ${sgn}${e.v}`); break;
      case 'armor': bits.push(`Armor ${sgn}${e.v}`); break;
      case 'limit': bits.push(`${e.which} limit ${sgn}${e.v}`); break;
      case 'skill': if (e.v) bits.push(`${e.name} ${sgn}${e.v}`); if (e.max) bits.push(`${e.name} max ${e.max > 0 ? '+' : ''}${e.max}`); break;
      case 'skillcat': bits.push(`${e.cat} skills ${sgn}${e.v}`); break;
      case 'skillgrp': bits.push(`${e.group} group ${sgn}${e.v}`); break;
      case 'situational': bits.push(`${e.what}${e.v == null ? '' : ` ${sgn}${e.v}`}${e.condition ? ` (${e.condition})` : ''}`); break;
      case 'skillattr': bits.push(`${e.attr}-linked tests ${sgn}${e.v} dice`); break;
      case 'spellcat': bits.push(`${e.cat} spells ${sgn}${e.v} dice`); break;
      case 'weapondice': bits.push(`attacks with this weapon ${sgn}${e.v} dice`); break;
      case 'trustfund': bits.push(`Trust Fund ${e.v}: pays a lifestyle + monthly money`); break;
      case 'woundoffset': bits.push(`ignore ${e.v} box${e.v === 1 ? '' : 'es'} for wound modifiers`); break;
      case 'drugresist': bits.push(`${e.kind === 'fatigue' ? 'fatigue' : `${e.kind}s (${e.vector})`} resistance ${sgn}${e.v}`); break;
      case 'pool': bits.push(`${e.pool[0].toUpperCase()}${e.pool.slice(1)} ${sgn}${e.v}`); break;
      case 'dodge': bits.push(`Defense ${sgn}${e.v}`); break;
      case 'elemarmor': bits.push(`${e.kind} armor ${sgn}${e.v}`); break;
      case 'movemult': bits.push(`${e.speed} ×${sgn}${e.v}`); break;
      case 'moveset': bits.push(`${e.speed} multiplier ${e.v}`); break;
      case 'magessence': bits.push(`${e.v} Essence doesn't reduce Magic`); break;
      case 'essmult': bits.push(`${e.kind} Essence ×${e.v / 100}`); break;
      case 'essmax': bits.push(`max Essence ${sgn}${e.v}`); break;
      case 'karmanuyenmax': bits.push(`Karma -> nuyen cap +${e.v}`); break;
      case 'nuyenbonus': bits.push(`${e.v.toLocaleString('en-US')}¥ per level${e.stolen ? ' (stolen gear only)' : ''}, instead of Karma`); break;
      case 'pp': bits.push(`Power Points ${sgn}${e.v}`); break;
      case 'persona': bits.push(`Living Persona ${{ a: 'Attack', s: 'Sleaze', d: 'Data Processing', f: 'Firewall' }[e.k]} ${sgn}${e.v}`); break;
      case 'knowpts': bits.push(`${sgn}${e.v} knowledge skill points`); break;
      case 'credDivisor': bits.push(`Street Cred = Karma ÷ ${10 + e.v}`); break;
      case 'skillcost': bits.push(`${e.cat} skill ${e.what} ×${e.pct / 100}`); break;
      case 'addquality': bits.push(`also gives ${e.name}`); break;
      case 'critterpower': bits.push(`${e.name}${e.select ? ` (${e.select})` : ''}`); break;
      case 'replaceattr': bits.push(`${e.a} ${e.min}-${e.max}`); break;
      case 'addmetamagic': bits.push(`knows ${e.name}`); break;
      case 'notoriety': bits.push(`Notoriety ${sgn}${e.v}`); break;
      case 'publicawareness': bits.push(`Public Awareness ${sgn}${e.v}`); break;
      case 'fame': bits.push(`Fame ${sgn}${e.v}`); break;
      case 'reach': bits.push(`Reach ${sgn}${e.v}`); break;
      case 'lifestyle': bits.push(`lifestyle cost ${sgn}${e.v}%`); break;
      case 'essence': bits.push(`Essence ${sgn}${e.v}`); break;
      case 'addcontact': bits.push(`a free ${e.group ? 'group ' : ''}contact at Loyalty ${e.loyalty}`); break;
      default: bits.push(`${e.t} ${sgn}${num(e.v)}`);
    }
  }
  return bits.join(', ');
}
