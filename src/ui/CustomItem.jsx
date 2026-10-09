// "Custom item" form: something the GM hands out that isn't in the catalogue. The player types the stats; the item
// then works like any other (engine/custom.js). Used to create one (pick a kind) or edit an existing one.
import { useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { idx, arr, ATTR_KEYS } from '../engine/data.js';
import { CUSTOM_KINDS, CUSTOM_FIELDS, newCustomItem, editCustomItem, customForm, newCustomQuality, editCustomQuality, customQualityForm } from '../engine/custom.js';
import { Modal, Field, cx } from './common.jsx';

const WEAPON_CATS = () => [...new Set(idx('weapons', 'weapons').list.map((w) => w.category))].filter((c) => c && c !== 'Gear' && c !== 'Quality').sort();
const GEAR_CATS = () => [...new Set(idx('gear', 'gears').list.map((g) => g.category))].filter(Boolean).sort();

/** @param {{kind?: string, it?: object, onClose: () => void}} props - pass `it` (and its kind) to edit */
export function CustomItemForm({ kind: kind0, it, onClose }) {
  const { ch, update } = useChar();
  const editing = !!it;
  const [kind, setKind] = useState(kind0 || 'weapons');
  const [f, setF] = useState(() => (it ? customForm(it) : { name: '', paid: ch.mode !== 'career', type: 'Ranged', attrs: [] }));
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const attrs = f.attrs || [];
  const save = () => {
    if (!String(f.name || '').trim()) return;
    if (editing) update((x) => { const t = x[kind].find((z) => z.uid === it.uid); if (t) editCustomItem(t, f); });
    else update((x) => { x[kind].push(newCustomItem(kind, f)); });
    onClose();
  };
  const text = (k, label, ph, extra = {}) => (
    <Field key={k} label={label}><input value={f[k] ?? ''} placeholder={ph} onInput={(e) => set(k, e.currentTarget.value)} {...extra} /></Field>
  );
  return (
    <Modal title={editing ? `Edit ${it.name}` : 'Add a custom item'} onClose={onClose} wide
      footer={<><button type="button" onClick={onClose}>Cancel</button><button type="button" class="primary" disabled={!String(f.name || '').trim()} onClick={save}>{editing ? 'Save' : 'Add item'}</button></>}>
      <p class="hint" style={{ marginTop: 0 }}>For things the GM gives you that aren't in the books. Fill in what you know - blanks are fine. It then counts like any other item: weapon pools, armor, Essence, drone stats.</p>
      <div class="fields customform">
        {!editing && (
          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.currentTarget.value)}>{CUSTOM_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        )}
        {text('name', 'Name', 'e.g. Prototype Ares pistol', { autoFocus: true })}
        {kind === 'weapons' && (
          <>
            <Field label="Type"><select value={f.type || 'Ranged'} onChange={(e) => set('type', e.currentTarget.value)}><option>Ranged</option><option>Melee</option></select></Field>
            <Field label="Category (sets the skill)">
              <select value={f.category || ''} onChange={(e) => set('category', e.currentTarget.value)}>
                <option value="">— choose —</option>{WEAPON_CATS().map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </>
        )}
        {kind === 'gear' && (
          <Field label="Category">
            <input list="custom-gear-cats" value={f.category || ''} placeholder="e.g. Electronics" onInput={(e) => set('category', e.currentTarget.value)} />
            <datalist id="custom-gear-cats">{GEAR_CATS().map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        )}
        {(kind === 'cyberware' || kind === 'bioware' || kind === 'vehicles') && text('category', kind === 'vehicles' ? 'Type' : 'Category', kind === 'vehicles' ? 'e.g. Small' : 'e.g. Headware')}
        {kind === 'vehicles' && (
          <Field label=" "><label class="check"><input type="checkbox" checked={!!f.drone} onChange={(e) => set('drone', e.currentTarget.checked)} /> It's a drone</label></Field>
        )}
        {kind === 'armor' && (
          <Field label=" "><label class="check" title="Like a helmet or shield: adds to your main armor instead of replacing it"><input type="checkbox" checked={String(f.armor || '').startsWith('+')}
            onChange={(e) => set('armor', `${e.currentTarget.checked ? '+' : ''}${String(f.armor || '').replace(/^\+/, '')}`)} /> Adds to other armor</label></Field>
        )}
        {(CUSTOM_FIELDS[kind] || []).map(([k, label, ph]) => text(k, label, ph))}
        {text('avail', 'Availability', 'e.g. 8R')}
        <Field label="Cost (¥)">
          <span class="row gap">
            <input type="number" min="0" value={f.cost ?? ''} placeholder="0" disabled={!f.paid} onInput={(e) => set('cost', e.currentTarget.value)} style={{ width: '9em' }} />
            <label class="check"><input type="checkbox" checked={!!f.paid} onChange={(e) => set('paid', e.currentTarget.checked)} /> I paid for it</label>
          </span>
        </Field>
      </div>

      <h4>Attribute bonuses <small class="dim">optional, e.g. +1 Agility</small></h4>
      {attrs.map((a, i) => (
        <div key={i} class="row gap attrrow">
          <select value={a.attr} aria-label="Attribute" onChange={(e) => set('attrs', attrs.map((z, j) => (j === i ? { ...z, attr: e.currentTarget.value } : z)))}>
            {ATTR_KEYS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input type="number" value={a.val} aria-label="Bonus" style={{ width: '5em' }} onInput={(e) => set('attrs', attrs.map((z, j) => (j === i ? { ...z, val: e.currentTarget.value } : z)))} />
          <button type="button" class="ghost sm" aria-label="Remove bonus" onClick={() => set('attrs', attrs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" class={cx('chip ghost')} onClick={() => set('attrs', [...attrs, { attr: ATTR_KEYS[1] || 'AGI', val: 1 }])}>+ bonus</button>
      {kind === 'armor' && <p class="hint">Armor bonuses count while it's worn.</p>}

      <h4>Description</h4>
      <textarea rows="4" value={f.description || ''} placeholder="What it is, what it does, what the GM said about it…" onInput={(e) => set('description', e.currentTarget.value)} />
    </Modal>
  );
}

/** "Custom quality" form: a GM's blessing, a curse, a house-rule edge. Create (with `category` preset) or edit (`q`). */
export function CustomQualityForm({ category, q, onClose }) {
  const { ch, update } = useChar();
  const editing = !!q;
  const [f, setF] = useState(() => (q ? customQualityForm(q) : { name: '', category: category || 'Positive', karma: 0, attrs: [], description: '' }));
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const attrs = f.attrs || [];
  const save = () => {
    if (!String(f.name || '').trim()) return;
    if (editing) update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); if (t) editCustomQuality(t, f); });
    else update((x) => { x.qualities.push(newCustomQuality(f, x.mode === 'career')); });
    onClose();
  };
  return (
    <Modal title={editing ? `Edit ${q.name}` : 'Add a custom quality'} onClose={onClose}
      footer={<><button type="button" onClick={onClose}>Cancel</button><button type="button" class="primary" disabled={!String(f.name || '').trim()} onClick={save}>{editing ? 'Save' : 'Add quality'}</button></>}>
      <p class="hint" style={{ marginTop: 0 }}>A quality that isn't in the books - a GM's blessing, a curse, a house rule. Its Karma is exactly what you enter (0 if the GM just gave it to you).</p>
      <div class="fields customform">
        <Field label="Name"><input value={f.name} placeholder="e.g. Marked by the Dragon" autoFocus onInput={(e) => set('name', e.currentTarget.value)} /></Field>
        <Field label="Kind">
          <select value={f.category} onChange={(e) => set('category', e.currentTarget.value)}><option>Positive</option><option>Negative</option></select>
        </Field>
        <Field label={f.category === 'Negative' ? 'Karma it gives' : 'Karma it costs'}>
          <input type="number" min="0" value={f.karma} onInput={(e) => set('karma', e.currentTarget.value)} />
        </Field>
      </div>
      <h4>Attribute bonuses <small class="dim">optional</small></h4>
      {attrs.map((a, i) => (
        <div key={i} class="row gap attrrow">
          <select value={a.attr} aria-label="Attribute" onChange={(e) => set('attrs', attrs.map((z, j) => (j === i ? { ...z, attr: e.currentTarget.value } : z)))}>
            {ATTR_KEYS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input type="number" value={a.val} aria-label="Bonus" style={{ width: '5em' }} onInput={(e) => set('attrs', attrs.map((z, j) => (j === i ? { ...z, val: e.currentTarget.value } : z)))} />
          <button type="button" class="ghost sm" aria-label="Remove bonus" onClick={() => set('attrs', attrs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" class="chip ghost" onClick={() => set('attrs', [...attrs, { attr: 'CHA', val: 1 }])}>+ bonus</button>
      <h4>What it does</h4>
      <textarea rows="4" value={f.description || ''} placeholder="The effect, in your own words - e.g. +2 dice on Etiquette with dragons; can't refuse a dragon's request." onInput={(e) => set('description', e.currentTarget.value)} />
    </Modal>
  );
}
