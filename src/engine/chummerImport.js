// Import a Chummer5a save (.chum5, which is XML) into a Renraku Paladin character.
//
// Chummer references game items by GUID (`sourceid`); tools/build_data.py keeps the first 10 hex
// characters of every GUID as the item id, so lookups are exact. Anything that can't be matched is
// reported rather than silently dropped.
import { idx, arr, num, ALL_ATTRS, ATTR_NAME } from './data.js';
import { priorityLines, priorityLineOf, STREET_SCUM } from './priorities.js';
import { newCharacter, derive, uid, heritageOptions, talentOptions, priorityRow } from './character.js';
import { DEFAULT_RULES } from './rules.js';
import { deviceKind, isProgramDef, deckArray } from './matrix.js';
import { variableRange } from './expr.js';
import { newCustomItem } from './custom.js';

// ---- tiny XML helpers (work with the browser DOMParser and linkedom alike) ------------
const kids = (el, tag) => (el ? [...el.children].filter((c) => c.tagName === tag) : []);
const kid = (el, tag) => kids(el, tag)[0] || null;
const txt = (el, tag) => {
  const k = kid(el, tag);
  return k ? k.textContent.trim() : '';
};
const isTrue = (s) => String(s).toLowerCase() === 'true';
const shortId = (guid) => String(guid || '').replace(/-/g, '').slice(0, 10).toLowerCase();
/**
 * A Chummer "Variable(min-max)" cost (Clothing, Customized (Drone), Interchangeable Beds, ...) needs a player-
 * picked price to mean anything - without one it evaluates as min-max nuyen, a large *refund* instead of a
 * charge (see PROJECT_STATUS.md's bug list). Chummer's own save records what was actually paid in the item's
 * own `<cost>`; use that when it's there, else fall back to the range's minimum.
 */
function seedVariable(it, def, el) {
  const vr = variableRange(def && def.cost);
  if (!vr) return;
  const saved = num(txt(el, 'cost'));
  it.variable = saved > 0 ? saved : vr.min;
}

export function rtfToText(s) {
  if (!s || !/^\s*\{\\rtf/.test(s)) return s || '';
  let out = s;
  // drop header groups (font/color tables, stylesheet, generator info)
  out = out.replace(/\{\\(?:\*|fonttbl|colortbl|stylesheet|info)(?:[^{}]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*\}/g, '');
  out = out.replace(/\\par(?![a-z])/g, '\n').replace(/\\line(?![a-z])/g, '\n').replace(/\\tab(?![a-z])/g, '\t');
  out = out.replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  out = out.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)));
  out = out.replace(/\\[a-z]+-?\d* ?/gi, '').replace(/\\([{}\\])/g, '$1').replace(/[{}]/g, '');
  return out.replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const KNOW_CATS = { Language: 'Language', Academic: 'Academic', Professional: 'Professional', Street: 'Street', Interest: 'Interest' };

// full attribute name / abbreviation -> key, for "extra" selections like Exceptional Attribute
const attrFromText = (s) => {
  const t = String(s || '').trim().toLowerCase();
  for (const k of ALL_ATTRS) if (t === k.toLowerCase() || t === ATTR_NAME[k].toLowerCase()) return k;
  return '';
};

/**
 * @param {string} xml   contents of a .chum5 file
 * @param {DOMParser} [parser]
 * @returns {{ch: object, report: object}}
 */
export function importChum5(xml, parser) {
  const P = parser || new DOMParser();
  const doc = P.parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root || root.tagName !== 'character') throw new Error('This does not look like a Chummer character file (.chum5).');
  if (doc.getElementsByTagName && doc.getElementsByTagName('parsererror').length) throw new Error('The file could not be read as XML.');

  const ch = newCharacter();
  const report = { imported: {}, unmatched: [], notes: [], checks: [], name: '' };
  const count = (k, n = 1) => { report.imported[k] = (report.imported[k] || 0) + n; };
  const miss = (section, name, why) => report.unmatched.push({ section, name, why: why || 'not found in game data' });

  const created = isTrue(txt(root, 'created'));
  const career = created;
  ch.mode = career ? 'career' : 'create';
  const build = txt(root, 'buildmethod') || 'Priority';
  if (build !== 'Priority') {
    report.notes.push(`This character was built with "${build}", which Renraku Paladin doesn't support for creation. It was imported as an existing (career) character; Karma and nuyen are carried over as-is.`);
    ch.mode = 'career';
  }
  const isCareer = ch.mode === 'career';

  // ---- identity
  const info = ch.info;
  info.name = txt(root, 'name');
  info.alias = txt(root, 'alias');
  info.player = txt(root, 'playername');
  for (const k of ['gender', 'age', 'height', 'weight', 'skin', 'hair', 'eyes']) info[k] = txt(root, k);
  info.description = rtfToText(txt(root, 'description'));
  info.background = rtfToText(txt(root, 'background'));
  const concept = rtfToText(txt(root, 'concept'));
  info.notes = [rtfToText(txt(root, 'notes')), rtfToText(txt(root, 'gamenotes')), concept && `Concept: ${concept}`].filter(Boolean).join('\n\n');
  report.name = info.alias || info.name || 'Unnamed runner';

  // ---- metatype
  const mtName = txt(root, 'metatype');
  const mtDef = idx('metatypes', 'metatypes').byName.get(mtName.toLowerCase());
  if (mtDef) {
    ch.metatype = mtDef.name;
    const vName = txt(root, 'metavariant');
    if (vName) {
      if (arr(mtDef.metavariants).some((v) => v.name === vName)) ch.variant = vName;
      else miss('Metatype', vName, 'variant not found');
    }
  } else {
    miss('Metatype', mtName);
  }

  // ---- priorities (only meaningful for Priority builds)
  const priKids = [...root.children];
  const priSkills = priKids.filter((c) => c.tagName === 'priorityskills').map((c) => c.textContent.trim()).find(Boolean);
  const letters = {
    heritage: txt(root, 'prioritymetatype'), attributes: txt(root, 'priorityattributes'),
    talent: txt(root, 'priorityspecial'), skills: priSkills || '', resources: txt(root, 'priorityresources'),
  };
  const okLetter = (l) => /^[A-E]$/.test(l);
  if (build === 'Priority' && Object.values(letters).every(okLetter)) ch.pri = letters;
  const talentName = txt(root, 'prioritytalent');
  const talents = talentOptions(ch.pri.talent);
  let tal = talents.find((t) => t.value === talentName) || talents.find((t) => t.name === talentName);
  if (!tal) {
    const flag = isTrue(txt(root, 'technomancer')) ? 'Technomancer' : isTrue(txt(root, 'adept')) ? (isTrue(txt(root, 'magician')) ? 'Mystic Adept' : 'Adept') : isTrue(txt(root, 'magician')) ? 'Magician' : 'Mundane';
    tal = talents.find((t) => t.value === flag) || talents.find((t) => t.value === 'Mundane');
    if (talentName && talentName !== flag) report.notes.push(`Talent "${talentName}" matched to "${tal ? tal.value : flag}" from the character's magic flags.`);
  }
  if (tal) ch.talent = tal.value;
  if (!heritageOptions(ch.pri.heritage).some((o) => o.name === ch.metatype) && build === 'Priority') {
    report.notes.push('The metatype is not offered at the imported metatype priority in the current tables; it was kept anyway.');
  }
  // which resources table matches the saved starting nuyen?
  const startNuyen = num(txt(root, 'startingnuyen'));
  for (const table of ['Standard', 'Prime Runner', 'Street Level']) {
    const row = priorityRow('Resources', ch.pri.resources, table);
    if (row && num(row.resources) === startNuyen) { ch.priTable = table; break; }
  }
  // Chummer's Street Scum settings use the Standard rows with a BCDEE / CCDDE line - recognize those letters
  if (build === 'Priority' && ch.priTable === 'Standard' && priorityLines(STREET_SCUM).includes(priorityLineOf(ch.pri))) ch.priTable = STREET_SCUM;

  // ---- attributes
  const attrEls = kids(kid(root, 'attributes'), 'attribute');
  const attrRec = {};
  for (const a of attrEls) {
    const key = txt(a, 'name');
    if (!ALL_ATTRS.includes(key)) continue;
    const base = num(txt(a, 'base'));
    const karma = num(txt(a, 'karma'));
    attrRec[key] = { total: num(txt(a, 'totalvalue')), enabled: true };
    ch.attrs[key] = isCareer ? { p: base, k: 0, a: karma } : { p: base, k: karma, a: 0 };
  }
  count('Attributes', Object.keys(attrRec).length);

  // ---- skills
  const ns = kid(root, 'newskills');
  const skillIx = idx('skills', 'skills');
  let skillN = 0;
  for (const s of kids(kid(ns, 'skills'), 'skill')) {
    const base = num(txt(s, 'base'));
    const karma = num(txt(s, 'karma'));
    const specs = kids(kid(s, 'specs'), 'spec').map((x) => txt(x, 'name')).filter(Boolean);
    if (!base && !karma && !specs.length) continue;
    const name = txt(s, 'name');
    let def = skillIx.byId.get(shortId(txt(s, 'suid'))) || skillIx.byName.get(name.toLowerCase());
    let extra = '';
    if (!def) {
      const m = /^(.*?) \((.*)\)$/.exec(name); // exotic skills: "Exotic Ranged Weapon (Foo)"
      if (m) { def = skillIx.byName.get(m[1].toLowerCase()); extra = m[2]; }
    }
    if (!def) { miss('Skills', name); continue; }
    const spec = specs[0] || extra;
    ch.skills[def.id] = isCareer ? { p: base, k: 0, a: karma, spec, specSrc: 'p' } : { p: base, k: karma, a: 0, spec, specSrc: 'p' };
    if (specs.length > 1) report.notes.push(`${name}: only one specialization is supported here; kept "${specs[0]}", dropped ${specs.slice(1).join(', ')}.`);
    skillN++;
  }
  count('Active skills', skillN);
  let groupN = 0;
  for (const g of kids(kid(ns, 'groups'), 'group')) {
    const base = num(txt(g, 'base'));
    const karma = num(txt(g, 'karma'));
    if (!base && !karma) continue;
    if (isTrue(txt(g, 'isbroken'))) continue; // broken groups carry their ratings on the individual skills
    ch.groups[txt(g, 'name')] = isCareer ? { p: base, k: 0, a: karma } : { p: base, k: karma, a: 0 };
    groupN++;
  }
  count('Skill groups', groupN);
  let knowN = 0;
  for (const k of kids(kid(ns, 'knoskills'), 'skill')) {
    const type = txt(k, 'type') || txt(k, 'skillcategory');
    const base = num(txt(k, 'base'));
    const karma = num(txt(k, 'karma'));
    const spec = kids(kid(k, 'specs'), 'spec').map((x) => txt(x, 'name'))[0] || '';
    ch.know.push({
      uid: uid(), name: txt(k, 'name'), cat: KNOW_CATS[type] || 'Street', native: isTrue(txt(k, 'isnativelanguage')),
      p: base, k: isCareer ? 0 : karma, a: isCareer ? karma : 0, f: 0, spec, specSrc: 'p',
    });
    knowN++;
  }
  count('Knowledge & languages', knowN);

  // ---- helpers for catalogue items
  const find = (file, section, el) => {
    const ix = idx(file, section);
    return ix.byId.get(shortId(txt(el, 'sourceid'))) || ix.byName.get(txt(el, 'name').toLowerCase()) || null;
  };

  // ---- qualities (only ones the player bought; metatype/talent ones are re-derived)
  let qN = 0;
  for (const q of kids(kid(root, 'qualities'), 'quality')) {
    const src = txt(q, 'qualitysource');
    if (src && src !== 'Selected') continue;
    const def = find('qualities', 'qualities', q);
    if (!def) { miss('Qualities', txt(q, 'name')); continue; }
    const extra = txt(q, 'extra');
    const entry = { uid: uid(), id: def.id, name: def.name, a: false, choice: {}, note: extra };
    if (def.bonus && def.bonus.selectattributes) entry.choice.attr = attrFromText(extra);
    ch.qualities.push(entry);
    qN++;
  }
  count('Qualities', qN);

  // ---- magic
  for (const [tag, child, list, file, sec] of [['spells', 'spell', 'spells', 'spells', 'spells'], ['complexforms', 'complexform', 'complexForms', 'complexforms', 'complexforms']]) {
    let n = 0;
    for (const e of kids(kid(root, tag), child)) {
      const def = find(file, sec, e);
      if (!def) { miss(tag === 'spells' ? 'Spells' : 'Complex forms', txt(e, 'name')); continue; }
      ch[list].push({ uid: uid(), id: def.id, name: def.name, a: false });
      n++;
    }
    if (n) count(tag === 'spells' ? 'Spells' : 'Complex forms', n);
  }
  let pN = 0;
  for (const e of kids(kid(root, 'powers'), 'power')) {
    const def = find('powers', 'powers', e);
    if (!def) { miss('Adept powers', txt(e, 'name')); continue; }
    ch.powers.push({ uid: uid(), id: def.id, name: def.name, level: Math.max(1, num(txt(e, 'rating'), 1)) });
    pN++;
  }
  if (pN) count('Adept powers', pN);
  const trad = txt(kid(root, 'tradition'), 'name');
  if (trad) {
    if (idx('traditions', 'traditions').byName.get(trad.toLowerCase())) ch.tradition = idx('traditions', 'traditions').byName.get(trad.toLowerCase()).name;
    else miss('Tradition', trad);
  }

  // ---- augmentations (Chummer stores bioware in <cyberwares> too, flagged by improvementsource)
  const gradeIx = idx('cyberware', 'grades');
  let cN = 0;
  let bN = 0;
  const addAug = (e, isChild) => {
    const bio = txt(e, 'improvementsource') === 'Bioware';
    const def = find(bio ? 'bioware' : 'cyberware', bio ? 'biowares' : 'cyberwares', e);
    if (!def) { miss(bio ? 'Bioware' : 'Cyberware', txt(e, 'name')); return; }
    const gName = txt(e, 'grade');
    const g = gradeIx.byName.get(gName.toLowerCase());
    const it = { uid: uid(), id: def.id, name: def.name, grade: g ? g.name : 'Standard' };
    const maxR = num(def.rating);
    if (maxR > 0) it.rating = Math.max(1, num(txt(e, 'rating'), 1));
    if (isChild) it.child = true;
    seedVariable(it, def, e);
    ch[bio ? 'bioware' : 'cyberware'].push(it);
    if (bio) bN++; else cN++;
    for (const c of kids(kid(e, 'children'), 'cyberware')) addAug(c, true);
  };
  for (const e of kids(kid(root, 'cyberwares'), 'cyberware')) addAug(e, false);
  if (cN) count('Cyberware', cN);
  if (bN) count('Bioware', bN);

  // ---- weapons, armor, gear, vehicles
  let wN = 0;
  const wAcc = idx('weapons', 'accessories');
  for (const w of kids(kid(root, 'weapons'), 'weapon')) {
    if (isTrue(txt(w, 'included'))) continue; // natural / cyber weapons come with their source
    const def = find('weapons', 'weapons', w);
    if (!def) { miss('Weapons', txt(w, 'name')); continue; }
    const mods = [];
    for (const a of kids(kid(w, 'accessories'), 'accessory')) {
      if (isTrue(txt(a, 'included'))) continue;
      const md = wAcc.byId.get(shortId(txt(a, 'sourceid'))) || wAcc.byName.get(txt(a, 'name').toLowerCase());
      if (md) { const mIt = { id: md.id, rating: Math.max(1, num(txt(a, 'rating'), 1)) }; seedVariable(mIt, md, a); mods.push(mIt); }
      else miss('Weapon accessories', `${txt(w, 'name')}: ${txt(a, 'name')}`);
    }
    const wIt = { uid: uid(), id: def.id, name: def.name, mods };
    seedVariable(wIt, def, w);
    ch.weapons.push(wIt);
    wN++;
  }
  count('Weapons', wN);
  let aN = 0;
  const aMods = idx('armor', 'mods');
  for (const a of kids(kid(root, 'armors'), 'armor')) {
    const def = find('armor', 'armors', a);
    if (!def) { miss('Armor', txt(a, 'name')); continue; }
    const mods = [];
    for (const m of kids(kid(a, 'armormods'), 'armormod')) {
      if (isTrue(txt(m, 'included'))) continue;
      const md = aMods.byId.get(shortId(txt(m, 'sourceid'))) || aMods.byName.get(txt(m, 'name').toLowerCase());
      if (md) { const mIt = { id: md.id, rating: Math.max(1, num(txt(m, 'rating'), 1)) }; seedVariable(mIt, md, m); mods.push(mIt); }
      else miss('Armor mods', `${txt(a, 'name')}: ${txt(m, 'name')}`);
    }
    const it = { uid: uid(), id: def.id, name: def.name, mods, equipped: isTrue(txt(a, 'equipped')) };
    if (num(def.rating) > 0) it.rating = Math.max(1, num(txt(a, 'rating'), 1));
    seedVariable(it, def, a);
    ch.armor.push(it);
    aN++;
  }
  count('Armor', aN);
  let gN = 0;
  const gearByGuid = new Map();
  const addGear = (g, depth, parent) => {
    const def = find('gear', 'gears', g);
    let self = null; // {def, uid} handed to children so loaded programs know their device
    if (!def) { miss('Gear', txt(g, 'name')); }
    else {
      const it = { uid: uid(), id: def.id, name: def.name, qty: Math.max(1, Math.round(num(txt(g, 'qty'), 1))) };
      if (num(def.rating) > 0) it.rating = Math.max(1, num(txt(g, 'rating'), 1));
      seedVariable(it, def, g);
      const extra = txt(g, 'extra');
      if (extra) it.notes = extra;
      // a focus's selection is its <extra>: the power a Qi Focus holds ("Improved Reflexes"), a focus's tradition
      if (extra && def.bonus && def.bonus.selectpowers) {
        const pw = idx('powers', 'powers').list.filter((p) => extra.toLowerCase().startsWith(p.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
        if (pw) it.choice = { ...(it.choice || {}), power: pw.id };
      }
      if (extra && def.bonus && def.bonus.selecttradition !== undefined) {
        const tr = idx('traditions', 'traditions').byName.get(extra.toLowerCase());
        if (tr) it.choice = { ...(it.choice || {}), tradition: tr.name };
      }
      if (parent) { it.child = true; it.parent = parent.uid; } // nested under its parent, e.g. a deck's bundled accessories
      if (parent && isProgramDef(def) && deviceKind(parent.def)) it.device = parent.uid; // program loaded under a device
      if (deviceKind(def) === 'deck' && deckArray(def) && txt(g, 'attack') !== '') {
        it.asdf = { a: num(txt(g, 'attack')), s: num(txt(g, 'sleaze')), d: num(txt(g, 'dataprocessing')), f: num(txt(g, 'firewall')) };
      }
      if (isTrue(txt(g, 'active')) && deviceKind(def)) ch.activeDevice = it.uid;
      if (isTrue(txt(g, 'bonded'))) it.bonded = true;
      if (txt(g, 'guid')) gearByGuid.set(txt(g, 'guid').toLowerCase(), it);
      // Chummer saves parts that come with a parent item (deck modules, commlink apps) at 0 nuyen
      if (txt(g, 'cost') === '0' && String(def.cost || '0') !== '0') it.free = true;
      ch.gear.push(it);
      self = { def, uid: it.uid };
      gN++;
    }
    for (const c of kids(kid(g, 'children'), 'gear')) addGear(c, depth + 1, self);
  };
  for (const g of kids(kid(root, 'gears'), 'gear')) addGear(g, 0);
  count('Gear', gN);
  let vN = 0;
  for (const v of kids(kid(root, 'vehicles'), 'vehicle')) {
    const def = find('vehicles', 'vehicles', v);
    if (!def) { miss('Vehicles', txt(v, 'name')); continue; }
    const mods = [];
    const vMods = idx('vehicles', 'mods');
    for (const m of kids(kid(v, 'mods'), 'mod')) {
      if (isTrue(txt(m, 'included'))) continue; // factory equipment comes with the vehicle
      const md = vMods.byId.get(shortId(txt(m, 'sourceid'))) || vMods.byName.get(txt(m, 'name').toLowerCase());
      if (md) { const mIt = { id: md.id, rating: Math.max(1, num(txt(m, 'rating'), 1)) }; seedVariable(mIt, md, m); mods.push(mIt); }
      else miss('Vehicle mods', `${txt(v, 'name')}: ${txt(m, 'name')}`);
    }
    const vIt = { uid: uid(), id: def.id, name: def.name, mods };
    seedVariable(vIt, def, v);
    ch.vehicles.push(vIt);
    vN++;
    const extras = ['weaponmounts', 'gears', 'weapons'].filter((t) => kid(v, t) && kid(v, t).children.length);
    if (extras.length) report.notes.push(`${txt(v, 'name')}: weapon mounts and gear/weapons carried in the vehicle were not imported - add them on the Gear page.`);
  }
  count('Vehicles', vN);

  // ---- lifestyles & contacts
  const lsIx = idx('lifestyles', 'lifestyles');
  let lN = 0;
  for (const l of kids(kid(root, 'lifestyles'), 'lifestyle')) {
    const base = txt(l, 'baselifestyle');
    const def = lsIx.byName.get(base.toLowerCase()) || lsIx.byId.get(shortId(txt(l, 'sourceid')));
    if (!def) { miss('Lifestyles', txt(l, 'name') || base); continue; }
    let pct = 0;
    let flat = 0;
    for (const q of kids(kid(l, 'lifestylequalities'), 'lifestylequality')) {
      pct += num(txt(q, 'multiplier'));
      const c = txt(q, 'cost');
      if (c) {
        const m = /^(-?[\d.]+)\s*(?:div\s*([\d.]+))?$/.exec(c);
        if (m) flat += num(m[1]) / (m[2] ? num(m[2], 1) : 1);
      }
    }
    const life = { uid: uid(), id: def.id, name: def.name, label: txt(l, 'name'), months: Math.max(1, num(txt(l, 'months'), 1)), pct, flat: Math.round(flat * 100) / 100 };
    if (isTrue(txt(l, 'trustfund'))) life.trustFund = true; // paid by the Trust Fund quality (Run Faster p.151)
    ch.lifestyles.push(life);
    lN++;
  }
  count('Lifestyles', lN);
  let ctN = 0;
  for (const c of kids(kid(root, 'contacts'), 'contact')) {
    if (txt(c, 'type') && txt(c, 'type') !== 'Contact') { report.notes.push(`Skipped ${txt(c, 'type').toLowerCase()} "${txt(c, 'name')}".`); continue; }
    const contact = { uid: uid(), name: txt(c, 'name'), role: txt(c, 'role'), connection: num(txt(c, 'connection'), 1), loyalty: num(txt(c, 'loyalty'), 1), notes: txt(c, 'notes'), a: false };
    if (isTrue(txt(c, 'free'))) contact.free = true; // e.g. Made Man's syndicate
    if (isTrue(txt(c, 'mademan'))) { contact.mademan = true; contact.free = true; contact.group = true; }
    if (isTrue(txt(c, 'group')) || isTrue(txt(c, 'isgroup'))) contact.group = true;
    ch.contacts.push(contact);
    ctN++;
  }
  count('Contacts', ctN);

  // ---- foci: Chummer lists bonded foci in <foci> by the gear's guid (and may also flag the gear itself)
  let fN = 0;
  for (const f of kids(kid(root, 'foci'), 'focus')) {
    const it = gearByGuid.get(txt(f, 'gearid').toLowerCase());
    if (it) { it.bonded = true; fN++; } else miss('Foci', txt(f, 'name'), 'its gear item was not imported');
  }
  fN = Math.max(fN, ch.gear.filter((g) => g.bonded).length);
  if (fN) count('Bonded foci', fN);

  // ---- spirits & sprites
  let spN = 0;
  for (const e of kids(kid(root, 'spirits'), 'spirit')) {
    const name = txt(e, 'name');
    if (!name) continue;
    const it = { uid: uid(), name, force: Math.max(1, num(txt(e, 'force'), 1)), services: Math.max(0, num(txt(e, 'services'))), bound: isTrue(txt(e, 'bound')) };
    ch.spirits.push(it);
    spN++;
  }
  if (spN) count('Spirits / sprites', spN);

  // ---- initiation / submersion + metamagics / echoes
  const gradeEls = kids(kid(root, 'initiationgrades'), 'initiationgrade');
  ch.initGrade = Math.max(num(txt(root, 'initiategrade')), num(txt(root, 'submersiongrade')), gradeEls.length);
  if (ch.initGrade) count(isTrue(txt(root, 'technomancer')) ? 'Submersion grade' : 'Initiation grade', ch.initGrade);
  const mmIx = idx('metamagic', 'metamagics');
  const echoIx = idx('echoes', 'echoes');
  let mmN = 0;
  for (const e of kids(kid(root, 'metamagics'), 'metamagic')) {
    const def = mmIx.byId.get(shortId(txt(e, 'sourceid'))) || mmIx.byName.get(txt(e, 'name').toLowerCase())
      || echoIx.byId.get(shortId(txt(e, 'sourceid'))) || echoIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('Metamagics / echoes', txt(e, 'name')); continue; }
    ch.metamagics.push({ uid: uid(), name: def.name });
    mmN++;
  }
  if (mmN) count('Metamagics / echoes', mmN);
  // Arts (<arts><art>) and power enhancements (<enhancements><enhancement> at the top, or under a power) are learned
  // at initiation in place of a metamagic (Street Grimoire), so they join the same list with a kind
  const artIx = idx('metamagic', 'arts');
  const enhIx = idx('powers', 'enhancements');
  let artN = 0;
  for (const e of kids(kid(root, 'arts'), 'art')) {
    const def = artIx.byId.get(shortId(txt(e, 'sourceid'))) || artIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('Arts', txt(e, 'name')); continue; }
    ch.metamagics.push({ uid: uid(), name: def.name, kind: 'art' });
    artN++;
  }
  if (artN) count('Arts', artN);
  const enhEls = [...kids(kid(root, 'enhancements'), 'enhancement'),
    ...kids(kid(root, 'powers'), 'power').flatMap((pw) => kids(kid(pw, 'enhancements'), 'enhancement'))];
  const seenEnh = new Set();
  let enhN = 0;
  for (const e of enhEls) {
    const def = enhIx.byId.get(shortId(txt(e, 'sourceid'))) || enhIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('Enhancements', txt(e, 'name')); continue; }
    const key = txt(e, 'guid') || def.id;
    if (seenEnh.has(key)) continue;
    seenEnh.add(key);
    ch.metamagics.push({ uid: uid(), name: def.name, kind: 'enhancement' });
    enhN++;
  }
  if (enhN) count('Power enhancements', enhN);

  // ---- martial arts
  const maIx = idx('martialarts', 'martialarts');
  const techIx = idx('martialarts', 'techniques');
  let maN = 0;
  for (const e of kids(kid(root, 'martialarts'), 'martialart')) {
    const def = maIx.byId.get(shortId(txt(e, 'sourceid'))) || maIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('Martial arts', txt(e, 'name')); continue; }
    const techniques = [];
    for (const t of kids(kid(e, 'martialarttechniques'), 'martialarttechnique')) {
      const td = techIx.byId.get(shortId(txt(t, 'sourceid'))) || techIx.byName.get(txt(t, 'name').toLowerCase());
      if (td) techniques.push({ uid: uid(), name: td.name });
      else miss('Martial arts', `${def.name}: ${txt(t, 'name')}`);
    }
    ch.martialArts.push({ uid: uid(), name: def.name, techniques });
    maN++;
  }
  if (maN) count('Martial arts', maN);

  // ---- mentor spirit (the choice, where the mentor has one, is saved as the picked option's name)
  const mEl = kids(kid(root, 'mentorspirits'), 'mentorspirit').find((e) => !txt(e, 'mentortype') || /mentor/i.test(txt(e, 'mentortype')));
  if (mEl) {
    const def = idx('mentors', 'mentors').byId.get(shortId(txt(mEl, 'sourceid'))) || idx('mentors', 'mentors').byName.get(txt(mEl, 'name').toLowerCase());
    if (!def) miss('Mentor spirit', txt(mEl, 'name'));
    else {
      ch.mentor = def.name;
      const saved = [...mEl.children].map((c) => c.textContent.trim()).filter(Boolean);
      const pick = arr(def.choices).find((c) => saved.includes(c.name));
      if (pick) ch.mentorChoice = pick.name;
      count('Mentor spirit');
      if (!ch.qualities.some((q) => q.name === 'Mentor Spirit')) report.notes.push(`Mentor ${def.name} was set, but its advantage only applies with the Mentor Spirit quality.`);
    }
  }

  // ---- custom improvements -> one 0-Karma custom quality per custom name; attribute changes apply, the rest is text
  const customs = new Map();
  for (const i of kids(kid(root, 'improvements'), 'improvement')) {
    if (txt(i, 'improvementsource') !== 'Custom' || (txt(i, 'enabled') && !isTrue(txt(i, 'enabled')))) continue;
    const name = txt(i, 'customname') || txt(i, 'sourcename') || 'Custom improvement';
    if (!customs.has(name)) customs.set(name, { attrs: [], other: [] });
    const c = customs.get(name);
    const type = txt(i, 'improvementttype') || txt(i, 'improvementtype');
    const target = txt(i, 'improvedname');
    const v = num(txt(i, 'aug')) || num(txt(i, 'val')) || num(txt(i, 'rating'));
    if (type === 'Attribute' && ALL_ATTRS.includes(target) && v) c.attrs.push({ attr: target, val: v });
    else c.other.push(`${type || 'Improvement'}${target ? ` (${target})` : ''}${v ? ` ${v > 0 ? '+' : ''}${v}` : ''}`);
  }
  for (const [name, c] of customs) {
    const uidQ = uid();
    ch.qualities.push({
      uid: uidQ, id: `custom-q-${uidQ}`, name, a: isCareer, choice: {}, note: '',
      custom: { category: 'Positive', karma: 0, attrs: c.attrs, description: ['Imported from a Chummer custom improvement.', ...c.other.map((o) => `Not applied automatically: ${o}.`)].join('\n') },
    });
    if (c.other.length) report.notes.push(`Custom improvement "${name}": ${c.other.join(', ')} kept as text only (custom qualities apply attribute changes).`);
  }
  if (customs.size) count('Custom improvements', customs.size);

  // ---- stacked foci: Chummer keeps the component foci inside <stackedfocus><gears>, and puts a synthetic "Stacked
  // Focus" item (not in the catalogue) in the gear list. Here each component becomes an ordinary focus, bonded if the
  // stack is - same Force total against Magic and the same bonding Karma (the sum of the parts, SR5 core p.319).
  let sfN = 0;
  for (const sf of kids(kid(root, 'stackedfoci'), 'stackedfocus')) {
    const before = ch.gear.length;
    for (const g of kids(kid(sf, 'gears'), 'gear')) addGear(g, 0);
    const parts = ch.gear.slice(before);
    for (const it of parts) {
      if (isTrue(txt(sf, 'bonded'))) it.bonded = true;
      it.notes = [it.notes, 'Part of a stacked focus'].filter(Boolean).join(' - ');
    }
    if (parts.length) sfN++;
  }
  if (sfN) {
    count('Stacked foci', sfN);
    report.unmatched = report.unmatched.filter((u) => !(u.section === 'Gear' && /stacked focus/i.test(u.name)));
    report.notes.push(`Stacked foci were split into their component foci (${sfN} stack${sfN === 1 ? '' : 's'}); each is bonded like the stack was.`);
  }

  // ---- critter powers (shifters, drakes, infected, A.I.s...): name, rating and the "extra" choice
  const cpIx = idx('critterpowers', 'powers');
  let cpN = 0;
  for (const e of kids(kid(root, 'critterpowers'), 'critterpower')) {
    const def = cpIx.byId.get(shortId(txt(e, 'sourceid'))) || cpIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('Critter powers', txt(e, 'name')); continue; }
    const it = { uid: uid(), id: def.id, name: def.name };
    if (num(txt(e, 'rating')) > 0) it.rating = num(txt(e, 'rating'));
    if (txt(e, 'extra')) it.extra = txt(e, 'extra');
    ch.critterPowers.push(it);
    cpN++;
  }
  if (cpN) count('Critter powers', cpN);

  // ---- A.I. programs (Data Trails): matched against programs.xml
  const aiIx = idx('programs', 'programs');
  let aiN = 0;
  for (const e of kids(kid(root, 'aiprograms'), 'aiprogram')) {
    const def = aiIx.byId.get(shortId(txt(e, 'sourceid'))) || aiIx.byName.get(txt(e, 'name').toLowerCase());
    if (!def) { miss('AI programs', txt(e, 'name')); continue; }
    const it = { uid: uid(), id: def.id, name: def.name };
    if (txt(e, 'extra')) it.extra = txt(e, 'extra');
    ch.aiPrograms.push(it);
    aiN++;
  }
  if (aiN) count('AI programs', aiN);

  // ---- custom drugs (Chummer's drug builder): no catalogue entry, so each becomes a custom gear item carrying its
  // components and numbers as its description; quantity and price per dose come across
  let drN = 0;
  for (const e of kids(kid(root, 'drugs'), 'drug')) {
    const name = txt(e, 'name') || 'Custom drug';
    const comps = [...e.getElementsByTagName('drugcomponent')].map((c) => txt(c, 'name') || c.textContent.trim()).filter(Boolean);
    const facts = [['Grade', 'grade'], ['Duration', 'duration'], ['Speed', 'speed'], ['Addiction rating', 'addictionrating'],
      ['Addiction threshold', 'addictionthreshold'], ['Crash damage', 'crashdamage']]
      .map(([label, tag]) => (txt(e, tag) ? `${label}: ${txt(e, tag)}` : '')).filter(Boolean);
    const it = newCustomItem('gear', {
      name, paid: true, category: txt(e, 'category') || 'Drugs', cost: num(txt(e, 'cost')), avail: txt(e, 'avail'),
      description: ['Custom drug imported from Chummer.', comps.length ? `Components: ${comps.join(', ')}.` : '', ...facts].filter(Boolean).join('\n'),
    });
    it.qty = Math.max(1, Math.round(num(txt(e, 'qty'), 1)));
    ch.gear.push(it);
    drN++;
  }
  if (drN) count('Drugs', drN);

  // ---- play state
  ch.play = { phys: num(txt(root, 'physicalcmfilled')), stun: num(txt(root, 'stuncmfilled')), overflow: 0, edgeUsed: num(txt(root, 'edgeused')) };

  // ---- reconcile Magic/Resonance against Chummer's own totals (talent ratings are stored differently)
  let d = derive(ch);
  for (const k of ['MAG', 'RES']) {
    const saved = attrRec[k];
    if (!saved || !d.attr[k].enabled) continue;
    const diff = saved.total - d.attr[k].total;
    if (diff !== 0) {
      const t = ch.attrs[k];
      const field = isCareer ? 'a' : 'p';
      t[field] = Math.max(0, t[field] + diff);
      report.notes.push(`${ATTR_NAME[k]} was adjusted by ${diff > 0 ? '+' : ''}${diff} to match Chummer's saved value (${saved.total}).`);
    }
  }
  d = derive(ch);

  if (build === 'Priority' && !isCareer) {
    ch.karmaConverted = Math.min(DEFAULT_RULES.maxKarmaToNuyen, Math.max(0, Math.round(num(txt(root, 'nuyenbp')))));
    d = derive(ch);
  }
  if (isCareer) {
    // make our running totals land on Chummer's current Karma / nuyen
    ch.career = { earned: num(txt(root, 'karma')) + d.karma.spentTotal, log: [{ t: Date.now(), kind: 'karma', amt: 0, note: 'Imported from Chummer' }], nuyenEarned: 0 };
    ch.nuyenAdjust = Math.round(num(txt(root, 'nuyen')) + d.nuyen.spent);
    d = derive(ch);
  }

  // ---- verification against Chummer's own numbers
  const cv = kid(root, 'calculatedvalues');
  const check = (label, mine, theirs, tol = 0) => {
    if (theirs === '' || Number.isNaN(Number(theirs))) return;
    report.checks.push({ label, mine, theirs: Number(theirs), ok: Math.abs(mine - Number(theirs)) <= tol });
  };
  if (cv) {
    check('Physical condition monitor', d.cm.physical, txt(cv, 'physicalcm'));
    check('Stun condition monitor', d.cm.stun, txt(cv, 'stuncm'));
    // the core book says you die when damage exceeds Body; Chummer counts that fatal box too
    check('Overflow (Chummer counts the fatal box)', d.cm.overflow + 1, txt(cv, 'physicalcmoverflow'));
  }
  check('Essence', d.essence, txt(root, 'totaless'), 0.011);
  if (!isCareer) check('Nuyen remaining', Math.round(d.nuyen.left), Math.round(num(txt(root, 'nuyen'))), 1);
  report.checks = report.checks.filter((c) => Number.isFinite(c.theirs));
  return { ch, report };
}
