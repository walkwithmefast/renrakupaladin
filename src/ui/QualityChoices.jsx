// The picks some qualities need (v27), shown on the owned quality's row in the Qualities tab: a spell category / spirit
// type (Apprentice, Hedge Witch/Wizard), extra spirit types (Chain Breaker), the incompetent skill group, the Death
// Dealer (Adept) melee skill, Dealer Connection's vehicle classes, a contact (Black Market Pipeline, Sensei), a free-text
// pick (Sprite Affinity, Paragon, Inherent Program, Inspired, One Trick Pony) and the items some qualities come with
// (Dead SIN, Busted Cyberware). Stored on the quality's `choice`; effects.js / qualityRules.js read them.
import { idx, txt, arr } from '../engine/data.js';
import { uid } from '../engine/character.js';
import { SPELL_CATEGORIES, VEHICLE_CLASSES } from '../engine/qualityRules.js';
import { cx } from './common.jsx';

const MELEE = ['Astral Combat', 'Blades', 'Clubs', 'Exotic Melee Weapon', 'Unarmed Combat'];
const spiritTypes = () => [...new Set(idx('traditions', 'spirits').list.map((s) => s.name).filter((n) => /^Spirit of /.test(n)))].sort();

/** gear some qualities give you (Dead SIN: a Rating 3 Fake SIN with four Rating 3 licenses, Better Than Bad p.162) */
export function qualityItems(def) {
  const b = def && def.bonus;
  if (!b) return null;
  if (b.addgear && typeof b.addgear === 'object' && txt(b.addgear.category) !== 'Commlinks') return { kind: 'gear', spec: b.addgear };
  if (b.addware && typeof b.addware === 'object') return { kind: txt(b.addware.type).toLowerCase() === 'bioware' ? 'bioware' : 'cyberware', spec: b.addware };
  return null;
}

/** add the items to a character draft (free - the quality paid for them); returns the new top-level uid */
export function addQualityItems(x, def, from) {
  const q = qualityItems(def);
  if (!q) return null;
  const ix = q.kind === 'gear' ? idx('gear', 'gears') : idx(q.kind, q.kind === 'bioware' ? 'biowares' : 'cyberwares');
  const make = (spec, parent) => {
    const d = ix.byName.get(txt(spec.name).toLowerCase());
    if (!d) return null;
    const it = { uid: uid(), id: d.id, name: d.name, free: true, qty: 1, notes: `From ${from}` };
    if (spec.rating) it.rating = Number(txt(spec.rating)) || 1;
    if (parent) { it.parent = parent; it.child = true; }
    (x[q.kind] ||= []).push(it);
    for (const c of arr(spec.children && spec.children.child)) make(c, it.uid);
    return it.uid;
  };
  return make(q.spec, null);
}

export function QualityChoices({ q, ch, d, update }) {
  if (q.auto) return null;
  const b = q.def.bonus || {};
  const c = q.choice || {};
  const set = (patch) => update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); if (t) t.choice = { ...(t.choice || {}), ...patch }; });
  const bits = [];
  const sel = (key, label, options, value) => (
    <select key={key} class="choicesel" value={value || ''} aria-label={`${q.name}: ${label}`} onChange={(e) => set({ [key]: e.currentTarget.value })}>
      <option value="">— {label} —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (q.name === 'Apprentice' || q.name === 'Hedge Witch/Wizard') bits.push(sel('category', 'spell category', SPELL_CATEGORIES, c.category));
  if (q.name === 'Apprentice') bits.push(sel('spirit', 'spirit type', spiritTypes(), c.spirit));
  if (b.addspirit !== undefined) { bits.push(sel('spirit1', 'extra spirit', spiritTypes(), c.spirit1)); bits.push(sel('spirit2', 'extra spirit', spiritTypes(), c.spirit2)); }
  if (b.skillgroupdisablechoice !== undefined) bits.push(sel('group', 'skill group', idx('skills', 'skillgroups').list.map((g) => txt(g.name || g)).filter(Boolean), c.group));
  if (b.weaponcategorydv !== undefined) bits.push(sel('skill', 'melee skill', MELEE, c.skill));
  if (b.dealerconnection !== undefined) {
    const picked = arr(c.classes);
    const max = q.level || 1;
    bits.push(
      <span key="dealer" class="dealer-pick" title="10% off vehicles of the chosen class (Rigger 5.0 p.33) - one class per level">
        {Object.keys(VEHICLE_CLASSES).map((cls) => (
          <label key={cls} class="check small">
            <input type="checkbox" checked={picked.includes(cls)} disabled={!picked.includes(cls) && picked.length >= max}
              onChange={(e) => set({ classes: e.currentTarget.checked ? [...picked, cls] : picked.filter((z) => z !== cls) })} /> {cls}
          </label>
        ))}
      </span>,
    );
  }
  if (b.selectcontact !== undefined) {
    bits.push(
      <select key="contact" class="choicesel" value={c.contact || ''} aria-label={`${q.name}: which contact`}
        onChange={(e) => { const ct = ch.contacts.find((z) => z.uid === e.currentTarget.value); set({ contact: e.currentTarget.value, contactName: ct ? ct.name || ct.role || 'contact' : '' }); }}>
        <option value="">— which contact —</option>
        {ch.contacts.map((ct) => <option key={ct.uid} value={ct.uid}>{ct.name || ct.role || 'unnamed contact'}</option>)}
      </select>,
    );
  }
  const textPick = { actiondicepool: 'Matrix action', selectsprite: 'sprite type', selectparagon: 'paragon', selectinherentaiprogram: 'program', selectexpertise: 'Artisan specialization', martialart: 'technique' };
  for (const [key, label] of Object.entries(textPick)) {
    if (b[key] === undefined) continue;
    bits.push(<input key={key} class="choicesel" value={c.text || ''} placeholder={label} aria-label={`${q.name}: ${label}`}
      onChange={(e) => set({ text: e.currentTarget.value.trim() })} />);
  }
  const items = qualityItems(q.def);
  if (items) {
    const has = (ch[items.kind] || []).some((it) => String(it.notes || '').includes(`From ${q.name}`));
    if (!has) bits.push(<button key="items" type="button" class="link small" onClick={() => update((x) => addQualityItems(x, q.def, q.name))}>+ add the {txt(items.spec.name)} it comes with</button>);
  }
  if (!bits.length) return null;
  return <span class={cx('qchoices')}>{bits}</span>;
}

