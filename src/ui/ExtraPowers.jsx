// Critter powers (shifters, drakes, infected, free spirits, A.I.s - data/critterpowers.xml) and A.I. programs (Data
// Trails - data/programs.xml): lists the character owns, mostly filled by a Chummer import (v23). No Karma is charged
// here - these usually come from a metatype or quality that already paid for them.
import { useState } from 'preact/hooks';
import { idx } from '../engine/data.js';
import { uid } from '../engine/character.js';
import { describeEffects, effectsOf } from '../engine/effects.js';
import { optionalPowerChoices } from '../engine/qualityRules.js';
import { Panel, Picker, SourceRef, InspectLink, Empty, cx } from './common.jsx';

/**
 * @param {{field: 'critterPowers'|'aiPrograms', title, sub, catalog, category, ch, update, readOnly, compact, rated}} props
 */
function OwnedList({ field, title, sub, catalog, category, ch, d, update, readOnly, compact, rated }) {
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const list = ch[field] || [];
  // Infected / drake optional powers bought with Karma (Run Faster p.134-136, Howling Shadows p.163, Dark Terrors)
  const optional = field === 'critterPowers' && d ? optionalPowerChoices(d.qualities) : [];
  const granted = field === 'critterPowers' && d ? (d.critterPowers || []).filter((c) => c.auto) : [];
  const set = (fn) => update((x) => { x[field] = fn([...(x[field] || [])]); });
  const patch = (u, p) => set((l) => l.map((z) => (z.uid === u ? { ...z, ...p } : z)));
  const def = (it) => idx(...(field === 'critterPowers' ? ['critterpowers', 'powers'] : ['programs', 'programs'])).byId.get(it.id);
  if (compact && !list.length && !granted.length) return null;
  return (
    <Panel title={title} sub={sub} right={!readOnly && (
      <>
        {optional.length > 0 && <button type="button" class="primary sm" onClick={() => setBuying(true)} title="Optional powers of your Infected type / drake form, bought with Karma">+ Buy optional power</button>}
        <button type="button" class="sm" onClick={() => setAdding(true)}>+ Add</button>
      </>
    )}>
      {granted.length > 0 && (
        <ul class="plain granted-cp">
          {granted.map(({ it, def }) => (
            <li key={it.uid}><InspectLink kind="critterPowers" id={def.id}>{def.name}</InspectLink>{it.extra ? <small class="dim"> ({it.extra})</small> : ''}<small class="dim"> · from {it.from}</small></li>
          ))}
        </ul>
      )}
      {list.length === 0 ? (granted.length ? null : <Empty>None yet.</Empty>) : (
        <ul class={cx('plain', compact && 'cols')}>
          {list.map((it) => {
            const dd = def(it);
            const fx = dd && dd.bonus ? describeEffects(effectsOf(dd.bonus, { Rating: it.rating || 1 })) : '';
            return (
              <li key={it.uid} class={cx(!compact && 'row between gap extra-row')}>
                <span class="grow">
                  <InspectLink kind={field} uid={it.uid}>{it.name}</InspectLink>
                  {rated && it.rating ? ` ${it.rating}` : ''}
                  {it.extra ? <small class="dim"> ({it.extra})</small> : ''}
                  {dd && dd.category && <small class="dim"> · {dd.category}</small>}
                  {fx && <small class="fx"> {fx}</small>}
                  {it.bought && <small class="dim"> · bought, {it.karma} K</small>}
                </span>
                {!readOnly && !compact && (
                  <>
                    {rated && <input type="number" min="0" class="var" value={it.rating || ''} placeholder="rtg" aria-label={`${it.name} rating`}
                      onChange={(e) => patch(it.uid, { rating: Number(e.currentTarget.value) || undefined })} />}
                    <input class="extra-in" value={it.extra || ''} placeholder="detail (e.g. Claws)" aria-label={`${it.name} detail`}
                      onChange={(e) => patch(it.uid, { extra: e.currentTarget.value.trim() || undefined })} />
                    <button type="button" class="ghost sm" aria-label={`Remove ${it.name}`} onClick={() => set((l) => l.filter((z) => z.uid !== it.uid))}>✕</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {optional.length > 0 && !readOnly && <p class="hint">Optional powers cost Karma and only one can be bought every two in-game months (Run Faster p.135); anything else under <b>+ Add</b> is free.</p>}
      {buying && (
        <Picker title="Buy an optional power" inspectKind={field} multi onClose={() => setBuying(false)}
          items={optional.map((o) => ({ ...o.def, id: o.def.id, name: o.select ? `${o.name} (${o.select})` : o.name, _o: o, category: o.from }))}
          category={(p) => p.category}
          onPick={(p) => set((l) => [...l, { uid: uid(), id: p._o.def.id, name: p._o.def.name, extra: p._o.select || undefined, karma: p._o.karma || 0, bought: true, a: ch.mode === 'career' }])}
          columns={[
            { key: 'name', label: 'Power' }, { key: 'category', label: 'From' },
            { key: 'karma', label: 'Karma', cls: 'num', get: (p) => (p._o.karma == null ? '?' : p._o.karma) },
            { key: 'source', label: 'Book', get: (p) => <SourceRef source={p.source} page={p.page} /> },
          ]} />
      )}
      {adding && (
        <Picker title={`Add ${title.toLowerCase()}`} inspectKind={field} items={catalog} multi category={category} onClose={() => setAdding(false)}
          onPick={(p) => set((l) => [...l, { uid: uid(), id: p.id, name: p.name }])}
          columns={[
            { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
            { key: 'source', label: 'Book', get: (p) => <SourceRef source={p.source} page={p.page} /> },
          ]} />
      )}
    </Panel>
  );
}

const isAI = (ch) => /^A\.I\./i.test(ch.metatype || '');

/** Build: Qualities tab. Shown when owned, or for non-metahuman metatypes; otherwise a small button reveals it. */
export function CritterPowersPanel({ ch, d, update, readOnly, compact }) {
  const [open, setOpen] = useState(false);
  const has = (ch.critterPowers || []).length > 0 || (d.critterPowers || []).some((c) => c.auto);
  const relevant = has || open || (d.mt && d.mt.category && d.mt.category !== 'Metahuman');
  if (!relevant) {
    if (readOnly || compact) return null;
    return <p class="hint"><button type="button" class="link" onClick={() => setOpen(true)}>+ Critter powers</button> <span class="dim">(shifters, drakes, infected, free spirits…)</span></p>;
  }
  return (
    <OwnedList field="critterPowers" title="Critter powers" sub="from your metatype or qualities - no Karma charged here" rated
      catalog={idx('critterpowers', 'powers').list.filter((p) => !p.hide)} category={(p) => p.category}
      ch={ch} d={d} update={update} readOnly={readOnly} compact={compact} />
  );
}

/** Build: Gear -> Programs; Play: Matrix tab (read-only). Shown when owned or for an A.I. */
export function AIProgramsPanel({ ch, update, readOnly }) {
  if (!(ch.aiPrograms || []).length && !isAI(ch)) return null;
  return (
    <OwnedList field="aiPrograms" title="A.I. programs" sub="Data Trails - programs an A.I. runs as part of itself"
      catalog={idx('programs', 'programs').list.filter((p) => !p.hide)} category={(p) => p.category}
      ch={ch} update={update} readOnly={readOnly} compact={readOnly} />
  );
}
