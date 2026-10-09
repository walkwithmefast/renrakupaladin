// Turn any catalogue item (owned or not) into readable facts for the inspector drawer.
import { idx, arr, num, txt, bool, bookName } from './data.js';
import { priceItem, itemDef } from './character.js';
import { evalExpr, evalAvail, fmtAvail } from './expr.js';
import { effectsOf, describeEffects, SITUATIONAL } from './effects.js';
import { weaponStats } from './weapons.js';
import { deviceKind, isProgramDef } from './matrix.js';
import { armorWithMods, armorView, vehicleStatView, armorProtection, PROTECTION_LABEL } from './mods.js';
import { customQualityDef } from './custom.js';
import { metamagicDef, metamagicDefById, METAMAGIC_KINDS } from './metamagic.js';

const KIND_LABEL = {
  weapons: 'Weapon', armor: 'Armor', gear: 'Gear', cyberware: 'Cyberware', bioware: 'Bioware', vehicles: 'Vehicle / drone',
  qualities: 'Quality', spells: 'Spell', powers: 'Adept power', complexForms: 'Complex form', lifestyles: 'Lifestyle', skills: 'Skill',
  critterPowers: 'Critter power', aiPrograms: 'A.I. program', metamagics: 'Metamagic',
};
export const kindLabel = (k) => KIND_LABEL[k] || k;

const money = (n) => `${Math.round(n).toLocaleString('en-US')}¥`;
const clean = (v) => txt(v).replace(/\s+/g, ' ').trim();
const KNOWN_BONUS = new Set([
  'specificattribute', 'initiative', 'initiativepass', 'conditionmonitor', 'armor', 'damageresistance', 'dodge', 'reach', 'lifestylecost',
  'essencepenalty', 'essencepenaltyt100', 'notoriety', 'publicawareness', 'fame', 'physicallimit', 'mentallimit', 'sociallimit',
  'limitmodifier', 'specificskill', 'selectattributes', 'skillcategory', 'skillgroup', 'selectskill', 'selectattribute',
  // v23-v26: foci, perks, and the quality audit (engine/effects.js); talents' own keys are handled by the talent system
  'skillattribute', 'spellcategory', 'weaponspecificdice', 'selectpowers', 'selecttradition', 'trustfund', 'addcontact', 'mademan',
  'toxincontactresist', 'toxiningestionresist', 'toxininhalationresist', 'toxininjectionresist', 'pathogencontactresist',
  'pathogeningestionresist', 'pathogeninhalationresist', 'pathogeninjectionresist', 'fatigueresist', 'memory', 'defensetest',
  'firearmor', 'coldarmor', 'electricityarmor', 'walkmultiplier', 'runmultiplier', 'movementreplace', 'essencepenaltymagonlyt100',
  'cyberwareessmultiplier', 'biowareessmultiplier', 'cyberwaretotalessmultiplier', 'essencemax', 'nuyenmaxbp', 'nuyenamt',
  'adeptpowerpoints', 'livingpersona', 'knowledgeskillpoints', 'streetcredmultiplier', 'skillcategorypointcostmultiplier',
  'skillcategorykarmacostmultiplier', 'addqualities', 'critterpowers', 'replaceattributes', 'addmetamagic',
  'enableattribute', 'enabletab', 'unlockskills', 'selectmentorspirit', 'skillgroupdisable', 'skilldisable',
  // v27: Ways, spell/spirit restrictions, optional powers, one-offs (engine/qualityRules.js)
  'focusbindingkarmacost', 'freequality', 'magicianswaydiscount', 'burnoutsway', 'limitspellcategory', 'limitspiritcategory',
  'blockspelldescriptor', 'allowspellcategory', 'allowspellrange', 'optionalpowers', 'limitcritterpowercategory', 'addgear', 'addware',
  'skillcategorykarmacost', 'activeskillkarmacost', 'knowledgeskillkarmacost', 'knowledgeskillkarmacostmin',
  'skillcategoryspecializationkarmacostmultiplier', 'skillgroupcategorykarmacostmultiplier', 'blockskillcategorydefaulting',
  'skillgroupcategorydisable', 'skillgroupdisablechoice', 'newspellkarmacost', 'freespells', 'addspell', 'weaponcategorydv',
  'addspirit', 'specialattburnmultiplier', 'prototypetranshuman', 'friendsinhighplaces', 'erased', 'excon', 'nativelanguagelimit',
  'dealerconnection', 'disablecyberwaregrade', 'disablebiowaregrade', 'restrictedgear', 'overclocker', 'cyberseeker',
  'metageniclimit', 'selectsprite', 'selectparagon', 'selectinherentaiprogram', 'selectexpertise', 'selectcontact', 'martialart',
  'selectside', 'selectquality', 'swapskillattribute', 'swapskillspecattribute',
  ...SITUATIONAL.map(([k]) => k),
]);
// keys that carry no rule of their own (a text pick, UI switches). Real-but-unapplied ones must NOT go here - they'd be hidden
// from the Inspector's "not applied automatically" line (focusbindingkarmacost was, until the v26 quality audit).
const NOISE_BONUS = new Set(['selecttext', 'enabletab', 'unlockskills', 'selectskill']);

/** requirement / forbidden blocks -> short readable lines */
function reqLines(node, label) {
  if (!node || typeof node !== 'object') return [];
  const out = [];
  const leaf = (k, v) => {
    const list = arr(v);
    switch (k) {
      case 'quality': return `Quality: ${list.map(txt).join(' / ')}`;
      case 'metatype': return `Metatype: ${list.map(txt).join(' / ')}`;
      case 'metatypecategory': return `Metatype category: ${list.map(txt).join(' / ')}`;
      case 'magenabled': return 'Awakened (has Magic)';
      case 'resenabled': return 'Emerged (has Resonance)';
      case 'depenabled': return 'An A.I. (has Depth)';
      case 'skill': return `Skill: ${list.map((s) => (s && typeof s === 'object' ? `${txt(s.name)} ${txt(s.val)}+` : txt(s))).join(' / ')}`;
      case 'tradition': return `Tradition: ${list.map(txt).join(' / ')}`;
      case 'spell': return `Spell: ${list.map(txt).join(' / ')}`;
      case 'power': return `Power: ${list.map(txt).join(' / ')}`;
      case 'gameplayoption': return null;
      default: return null;
    }
  };
  const walk = (n, mode) => {
    for (const [k, v] of Object.entries(n)) {
      if (k === 'oneof') { for (const g of arr(v)) { const sub = []; collect(g, sub); if (sub.length) out.push(sub.length > 1 ? `Any of: ${sub.join('; ')}` : sub[0]); } continue; }
      if (k === 'allof') { for (const g of arr(v)) collect(g, out); continue; }
      const l = leaf(k, v);
      if (l) out.push(l);
    }
  };
  const collect = (g, into) => {
    if (!g || typeof g !== 'object') return;
    for (const [k, v] of Object.entries(g)) {
      if (k === 'oneof' || k === 'allof') { for (const x of arr(v)) collect(x, into); continue; }
      const l = leaf(k, v);
      if (l) into.push(l);
    }
  };
  walk(node);
  return out.map((l) => `${label} ${l}`);
}

const pushRow = (rows, label, value) => {
  const v = value == null ? '' : String(value).trim();
  if (v !== '' && v !== '-' && v !== '—') rows.push([label, v]);
};

/** owned-entry lookup for cost/avail/essence as the sheet computes them */
export function ownedEntry(d, kind, it) {
  if (!d || !it) return null;
  if (kind === 'cyberware' || kind === 'bioware') return d.augs.find((a) => a.it.uid === it.uid) || null;
  const list = d.items && d.items[kind];
  return list ? list.find((e) => e.it.uid === it.uid) || null : null;
}

/**
 * @returns {{title:string, sub:string, kind:string, book:{source:string,page:string,name:string}|null,
 *   own:[string,string][], stats:[string,string][], cost:[string,string][], effects:string[], other:string[], req:string[], notes:string[]}}
 */
/** a stat value with the reason it differs from the book, e.g. "4 (Armor 2 → 4: Armor (Drone))" */
const withTip = (val, tip) => (tip ? `${val} (${tip})` : val);

export function describeItem(kind, def, it, d) {
  const stats = [];
  const own = [];
  const cost = [];
  const notes = [];
  const owned = !!it;
  const entry = owned ? ownedEntry(d, kind, it) : null;
  const rating = it && it.rating != null ? it.rating : Math.max(1, num(def.minrating, 1));
  const vars = { Rating: rating, MinRating: num(def.minrating, 0) };

  const raw = (label, v) => {
    const t = clean(v);
    if (t && t !== '0' && t !== '-') stats.push([label, t]);
  };
  const availRaw = clean(def.avail);
  const costRaw = clean(def.cost);

  // ---- per-kind stat blocks
  switch (kind) {
    case 'weapons': {
      pushRow(stats, 'Class', def.category);
      pushRow(stats, 'Type', def.type);
      const ws = d ? weaponStats(def, d, it) : null;
      pushRow(stats, 'Damage', ws ? withTip(ws.dmg, ws.dmgTip) : clean(def.damage));
      pushRow(stats, 'AP', ws ? withTip(ws.ap, ws.apTip) : def.ap);
      pushRow(stats, 'Mode', def.mode);
      if (def.type === 'Melee') pushRow(stats, 'Reach', def.reach);
      else { pushRow(stats, 'Recoil comp.', ws ? withTip(ws.rc, ws.rcTip) : def.rc); pushRow(stats, 'Ammo', def.ammo); }
      pushRow(stats, 'Accuracy', ws ? withTip(ws.accuracy, ws.accuracyTip) : def.accuracy);
      pushRow(stats, 'Concealability', ws ? withTip(clean(def.conceal), ws.concealTip) : def.conceal);
      if (it) pushRow(own, 'Equipped', it.equipped === false ? 'No' : 'Yes');
      if (ws && ws.skillName) {
        pushRow(own, 'Skill', ws.skillName);
        pushRow(own, 'Dice pool', ws.pool != null ? `${ws.pool}${ws.rating === 0 ? ' (defaulting, no ranks)' : ''}${ws.spec ? ` (${ws.pool + 2} with ${ws.spec})` : ''}` : 'unskilled, cannot default');
      }
      break;
    }
    case 'armor': {
      if (it) {
        const av = armorView(armorWithMods(def, it, idx('armor', 'mods')));
        pushRow(stats, 'Armor', av.tip ? withTip(av.text, av.tip) : av.text);
        const p = armorProtection([it], idx('armor', 'armors'), idx('armor', 'mods'));
        const bits = Object.keys(PROTECTION_LABEL).filter((k) => p[k]).map((k) => `${PROTECTION_LABEL[k]} +${p[k]}`);
        if (p.immune.length) bits.push(`immune to ${p.immune.join(', ')}`);
        if (bits.length) pushRow(stats, 'Also protects', bits.join(' · '));
      }
      else pushRow(stats, 'Armor', arr(def.armor).map((a) => String(a).replace(/[\[\]']/g, '')).join(' '));
      pushRow(stats, 'Capacity', def.armorcapacity);
      pushRow(stats, 'Category', def.category);
      if (it) pushRow(own, 'Worn', it.equipped === false ? 'No' : 'Yes');
      break;
    }
    case 'gear': {
      pushRow(stats, 'Category', def.category);
      if (num(def.rating) > 0) pushRow(stats, 'Max rating', def.rating);
      const kindDev = deviceKind(def);
      if (kindDev) {
        pushRow(stats, 'Device rating', evalExpr(txt(def.devicerating), vars));
        if (kindDev === 'deck') {
          pushRow(stats, 'Attribute array', clean(def.attributearray).replace(/,/g, ' / '));
          pushRow(stats, 'Program limit', def.programs);
        } else {
          pushRow(stats, 'Attack / Sleaze', `${num(def.attack)} / ${num(def.sleaze)}`);
          pushRow(stats, 'Data Processing / Firewall', `${evalExpr(txt(def.dataprocessing), vars)} / ${evalExpr(txt(def.firewall), vars)}`);
        }
      }
      pushRow(stats, 'Capacity', def.capacity);
      pushRow(stats, 'Armor capacity', def.armorcapacity);
      pushRow(stats, 'Weight', def.weight);
      if (isProgramDef(def)) notes.push(def.category === 'Hacking Programs' ? 'Runs on a cyberdeck; counts against its program limit while running.' : 'Runs on any commlink or cyberdeck.');
      break;
    }
    case 'cyberware':
    case 'bioware': {
      pushRow(stats, 'Category', def.category);
      pushRow(stats, 'Base Essence', clean(def.ess));
      pushRow(stats, 'Capacity', def.capacity);
      if (num(def.rating) > 0) pushRow(stats, 'Max rating', def.rating);
      if (bool(def.forcegrade) || clean(def.forcegrade)) pushRow(stats, 'Forced grade', clean(def.forcegrade));
      if (def.limit) pushRow(stats, 'Limit', clean(def.limit));
      pushRow(own, 'Grade', it && it.grade);
      if (entry) pushRow(own, 'Essence cost', entry.ess.toFixed(2));
      if (it && d) {
        const limb = (d.cyberlimbs || []).find((l) => l.uid === it.uid);
        if (limb) {
          own.push(['Strength', String(limb.str)], ['Agility', String(limb.agi)]);
          notes.push('This limb\'s own Strength/Agility (SR5 core p.455-456) already feed melee/unarmed/thrown '
            + 'weapon damage and weapon-skill pools whenever they beat the natural body\'s.');
        }
      }
      for (const n of arr(def.notes)) notes.push(clean(n));
      break;
    }
    case 'vehicles': {
      pushRow(stats, 'Type', def.category);
      // an owned vehicle shows its stats with its modifications applied
      const ve = it && d && d.items.vehicles.find((e) => e.it.uid === it.uid);
      for (const [label, k] of [['Handling', 'handling'], ['Speed', 'speed'], ['Acceleration', 'accel'], ['Body', 'body'], ['Armor', 'armor'], ['Pilot', 'pilot'], ['Sensor', 'sensor'], ['Seats', 'seats']]) {
        if (ve && ve.stats) { const v = vehicleStatView(ve.stats, k); pushRow(stats, label, v.tip ? withTip(v.text, v.tip) : v.text); }
        else pushRow(stats, label, k === 'armor' ? arr(def.armor).join('') : def[k]);
      }
      pushRow(stats, 'Mod slots', def.modslots);
      break;
    }
    case 'qualities': {
      pushRow(stats, 'Type', def.category);
      pushRow(stats, 'Karma', `${Math.abs(num(def.karma))} ${num(def.karma) < 0 ? '(gives Karma)' : '(costs Karma)'}`);
      if (def.limit) pushRow(stats, 'Limit', clean(def.limit));
      if (bool(def.chargenonly)) notes.push('Can only be taken at character creation.');
      if (bool(def.careeronly)) notes.push('Career only.');
      break;
    }
    case 'spells': {
      pushRow(stats, 'Category', def.category);
      pushRow(stats, 'Type', def.type === 'P' ? 'Physical' : def.type === 'M' ? 'Mana' : def.type);
      pushRow(stats, 'Range', def.range);
      // the data uses a literal "0" for every spell that doesn't deal direct combat damage (most of them,
      // including a few Combat spells with a non-damage effect like Evil Eye) - showing it reads as "Damage: 0"
      // for spells that plainly don't have any, so only show a real damage type (P/S/Special).
      if (def.damage && def.damage !== '0') pushRow(stats, 'Damage', def.damage === 'P' ? 'Physical' : def.damage === 'S' ? 'Stun' : def.damage);
      pushRow(stats, 'Duration', def.duration === 'I' ? 'Instant' : def.duration === 'S' ? 'Sustained' : def.duration === 'P' ? 'Permanent' : def.duration);
      pushRow(stats, 'Drain', def.dv);
      pushRow(stats, 'Descriptors', clean(def.descriptor));
      break;
    }
    case 'powers': {
      pushRow(stats, 'Power points', def.points);
      if (bool(def.levels)) pushRow(stats, 'Levels', def.maxlevels ? `up to ${def.maxlevels}` : 'yes');
      pushRow(stats, 'Action', def.action);
      break;
    }
    case 'complexForms': {
      pushRow(stats, 'Target', def.target);
      pushRow(stats, 'Duration', def.duration);
      pushRow(stats, 'Fading', def.fv);
      break;
    }
    case 'lifestyles': {
      pushRow(stats, 'Monthly cost', money(num(def.cost)));
      pushRow(stats, 'Lifestyle dice', def.dice);
      pushRow(stats, 'Lifestyle points', def.lp);
      break;
    }
    case 'metamagics': {
      if (def.power) pushRow(stats, 'Enhances', arr(def.power).map(txt).join(', ')); // power enhancements only
      if (def.limit) pushRow(stats, 'Times it can be taken', def.limit); // echoes only
      break;
    }
    case 'skills': {
      pushRow(stats, 'Linked attribute', def.attribute);
      pushRow(stats, 'Category', def.category);
      pushRow(stats, 'Skill group', txt(def.skillgroup));
      pushRow(stats, 'Defaults', def.default === 'True' ? 'Yes (−1 die unskilled)' : 'No, needs at least 1 rank');
      const specs = arr(def.specs).map(txt).filter(Boolean);
      if (specs.length) pushRow(stats, 'Specializations', specs.join(', '));
      break;
    }
    default: break;
  }

  // ---- money & availability
  if (kind !== 'qualities' && kind !== 'spells' && kind !== 'powers' && kind !== 'complexForms' && kind !== 'skills') {
    if (costRaw && kind !== 'lifestyles') {
      const isFormula = /Rating|FixedValues|Variable/i.test(costRaw);
      const one = priceItem(kind, def, { rating, qty: 1, grade: it && it.grade }, {});
      cost.push(['Cost', isFormula ? `${money(one.cost)} at rating ${rating}` : money(num(costRaw))]);
      if (isFormula) cost.push(['Cost formula', costRaw.replace(/\*/g, '×')]);
      if (def.costfor) cost.push(['Sold as', `${def.costfor} for that price`]);
    }
    if (availRaw) {
      const a = evalAvail(availRaw, vars);
      cost.push(['Availability', fmtAvail(a)]);
      if (a.flag === 'R') notes.push('Restricted (R): needs a license to own legally.');
      if (a.flag === 'F') notes.push('Forbidden (F): illegal to own.');
      if (/Rating|FixedValues/i.test(availRaw)) cost.push(['Availability formula', availRaw.replace(/\*/g, '×')]);
    }
  }
  if (owned && d) {
    if (kind === 'qualities') {
      const q = d.qualities.find((x) => x.uid === it.uid);
      if (q) own.push(['Karma', q.auto ? 'free (granted)' : `${Math.abs(q.karma)} ${q.karma < 0 ? 'gained' : 'spent'}`]);
    } else if (kind === 'spells' || kind === 'complexForms') {
      const row = (kind === 'spells' ? d.spells : d.cforms).find((x) => x.it.uid === it.uid);
      if (row) own.push(['Learned', row.paid ? `${kind === 'spells' ? d.R.spellKarma : d.R.complexFormKarma} Karma` : 'free (from priority)']);
    }
  }
  if (entry) {
    if (kind !== 'lifestyles') own.unshift(['Your cost', money(entry.cost)]);
    if (entry.avail) own.push(['Your availability', fmtAvail(entry.avail)]);
  }
  if (kind === 'lifestyles' && entry) own.unshift(['Total cost', `${money(entry.cost)} (${it.months || 1} month${(it.months || 1) === 1 ? '' : 's'})`]);
  if (it) {
    if (it.rating != null) own.push(['Rating', String(it.rating)]);
    if (it.qty > 1) own.push(['Quantity', String(it.qty)]);
    if (it.free) own.push(['Included with', 'a parent item (no extra cost)']);
  }

  // ---- effects
  const effects = [];
  const fx = describeEffects(effectsOf(def.bonus, vars, (it && it.choice) || {}));
  if (fx) effects.push(fx);
  const wfx = describeEffects(effectsOf(def.wirelessbonus, vars));
  if (wfx) effects.push(`With wireless on: ${wfx}`);
  const other = def.bonus && typeof def.bonus === 'object'
    ? Object.keys(def.bonus).filter((k) => !KNOWN_BONUS.has(k) && !NOISE_BONUS.has(k) && !k.startsWith('@'))
    : [];

  const req = [...reqLines(def.required, 'Requires'), ...reqLines(def.forbidden, 'Not with')];
  const ex = typeof window !== 'undefined' && window.SR5TEXT && window.SR5TEXT[def.id];
  const dr = typeof window !== 'undefined' && window.SR5DRUGS && window.SR5DRUGS[def.id];
  let drug = null;
  if (dr) {
    const rows = [];
    for (const [label, key] of [['Vector', 'vector'], ['Speed', 'speed'], ['Duration', 'duration'], ['Addiction type', 'addictionType'],
      ['Addiction rating', 'addictionRating'], ['Addiction threshold', 'addictionThreshold'], ['Penetration', 'penetration'], ['Power', 'power']]) {
      if (dr[key]) rows.push([label, dr[key]]);
    }
    drug = { rows, effect: dr.effect || '', flavor: dr.flavor || '', page: dr.page, source: def.source };
  }
  const excerpt = ex && !drug ? { text: ex[0], page: ex[1], source: def.source } : null;
  // the user's own description (the Edit button in the drawer) - shown instead of the book text, which is kept
  const ed = typeof window !== 'undefined' && window.SR5EDITS && def.id && window.SR5EDITS[def.id];
  const userText = ed ? ed.text : null;
  return {
    title: (it && it.label) || def.name,
    sub: kind === 'skills' ? clean(def.category)
      : kind === 'metamagics' ? (METAMAGIC_KINDS[def._kind] || {}).label || kindLabel(kind)
      : clean(def.category) || kindLabel(kind),
    kind,
    kindLabel: kindLabel(kind),
    book: def.source ? { source: def.source, page: def.page, name: bookName(def.source) } : null,
    own, stats, cost, effects, other, req, notes, excerpt, drug, userText,
    // custom items (engine/custom.js) carry their own description in the character; no rulebook text to edit
    descId: def.custom ? null : def.id || null, custom: !!def.custom, customText: def.custom ? def.description || '' : null,
  };
}

/** resolve (kind, owned item | catalogue id) to what the drawer needs */
export function resolveInspect(ch, kind, ref) {
  if (kind === 'metamagics') {
    if (ref.uid) {
      const it = (ch.metamagics || []).find((x) => x.uid === ref.uid);
      if (!it) return null;
      const def = metamagicDef(it);
      return def ? { def: { ...def, _kind: it.kind }, it } : null;
    }
    const hit = metamagicDefById(ref.id);
    return hit ? { def: { ...hit.def, _kind: hit.kind }, it: null } : null;
  }
  if (ref.uid) {
    const list = kind === 'qualities' ? ch.qualities : ch[kind];
    const it = (list || []).find((x) => x.uid === ref.uid);
    if (!it) return null;
    const def = kind === 'qualities'
      ? (it.custom ? customQualityDef(it) : idx('qualities', 'qualities').byId.get(it.id) || idx('qualities', 'qualities').byName.get(String(it.name).toLowerCase()))
      : itemDef(kind, it);
    return def ? { def, it } : null;
  }
  const map = {
    weapons: ['weapons', 'weapons'], armor: ['armor', 'armors'], gear: ['gear', 'gears'], cyberware: ['cyberware', 'cyberwares'],
    bioware: ['bioware', 'biowares'], vehicles: ['vehicles', 'vehicles'], qualities: ['qualities', 'qualities'], spells: ['spells', 'spells'],
    powers: ['powers', 'powers'], complexForms: ['complexforms', 'complexforms'], lifestyles: ['lifestyles', 'lifestyles'], skills: ['skills', 'skills'],
    critterPowers: ['critterpowers', 'powers'], aiPrograms: ['programs', 'programs'],
  }[kind];
  if (!map) return null;
  const def = idx(map[0], map[1]).byId.get(ref.id);
  return def ? { def, it: null } : null;
}
