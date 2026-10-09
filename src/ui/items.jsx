import { useState } from 'preact/hooks';
import { idx, arr, num, txt } from '../engine/data.js';
import { fmtAvail, variableRange } from '../engine/expr.js';
import { newOwned, spawnGearBundle, gearDescendants } from '../engine/gearBundle.js';
import { Panel, Picker, SourceRef, Stepper, Empty, InspectLink, nuyen, cx } from './common.jsx';
import { useUnavailable } from './unavailable.js';
import { CUSTOM_KINDS } from '../engine/custom.js';
import { ratingValue } from '../engine/character.js';
import { CustomItemForm } from './CustomItem.jsx';

const RATED = new Set(['gear', 'cyberware', 'bioware', 'armor']);
export { newOwned, spawnGearBundle };

/**
 * Generic list of owned items with a catalogue picker.
 * entries: [{it, def, cost, avail, ess?}]
 */
export function ItemSection({ title, kind, ch, d, update, entries, defs, category, pickCols, extraCols = [], extraCells, sub, right, pickerHint, searchText, modSection, noQty, emptyText }) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState(false);
  const unavailable = useUnavailable(kind);
  const total = entries.reduce((s, e) => s + e.cost, 0);
  // bundled sub-items (a cyberdeck's Sim Module, a commlink's built-in apps, ...) nest under their parent row instead of listing separately
  // weapons that come with a quality or implant (Claws, Hand Razors...) are listed under the table, not as editable rows
  const autoRows = entries.filter((e) => e.it.auto);
  const rows = (kind === 'gear' ? entries.filter((e) => !e.it.child) : entries).filter((e) => !e.it.auto);
  const gradeList = kind === 'cyberware' || kind === 'bioware'
    ? idx(kind, 'grades').list.filter((g) => !g.hide && !['None'].includes(g.name) && !d.R.bannedGrades.includes(g.name.replace(/ \(.*/, '')))
    : [];
  const patch = (u, fn) => update((x) => { fn(x[kind].find((z) => z.uid === u)); });
  const remove = (u) => update((x) => {
    if (kind !== 'gear') { x[kind] = x[kind].filter((z) => z.uid !== u); return; }
    // remove the item and everything bundled under it (any depth)
    const doomed = new Set([u]);
    for (let grew = true; grew;) {
      grew = false;
      for (const g of x.gear) if (g.parent && doomed.has(g.parent) && !doomed.has(g.uid)) { doomed.add(g.uid); grew = true; }
    }
    x.gear = x.gear.filter((z) => !doomed.has(z.uid));
  });

  return (
    <Panel
      title={title}
      sub={sub}
      right={
        <>
          <span class="pip">{nuyen(total)}</span>
          {right}
          {CUSTOM_KINDS.some(([k]) => k === kind) && (
            <button type="button" onClick={() => setCustom(true)} title="Something the GM gave you that isn't in the books - you fill in the stats">Custom…</button>
          )}
          <button type="button" class="primary" onClick={() => setAdding(true)}>+ Add</button>
        </>
      }
    >
      {custom && <CustomItemForm kind={kind} onClose={() => setCustom(false)} />}
      {rows.length === 0 ? <Empty>{emptyText || 'Nothing here yet.'}</Empty> : (
        <div class="tbl-wrap">
          <table class="tbl owned">
            <thead>
              <tr>
                <th>Item</th>
                {extraCols.map((c) => <th key={c.key} class={c.cls}>{c.label}</th>)}
                <th class="num">Avail</th>
                {(kind === 'cyberware' || kind === 'bioware') && <th class="num">Ess</th>}
                <th class="num">Cost</th><th /><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const { it, def } = e;
                const max = ratingValue(def.rating, d.mt, 0); // may be a formula ("{STRMaximum}" - cyberlimb customization)
                const rated = RATED.has(kind) && max > 0;
                const minR = Math.max(1, ratingValue(def.minrating, d.mt, 1));
                const vr = variableRange(def.cost);
                const over = ch.mode === 'create' && e.avail.n > d.R.maxAvailCreate;
                const bundled = kind === 'gear' ? gearDescendants(entries, it.uid) : [];
                return (
                  <tr key={it.uid}>
                    <td class="name">
                      <div class="nm"><InspectLink kind={kind} uid={it.uid}>{def.name}</InspectLink></div>
                      <div class="ctl">
                        {rated && <Stepper value={it.rating || minR} min={minR} max={max} onChange={(v) => patch(it.uid, (t) => { t.rating = v; })} />}
                        {gradeList.length > 0 && (
                          <select value={it.grade || 'Standard'} onChange={(ev) => patch(it.uid, (t) => { t.grade = ev.currentTarget.value; })}>
                            {gradeList.map((g) => <option key={g.id}>{g.name}</option>)}
                          </select>
                        )}
                        {kind === 'gear' && !noQty && <Stepper value={it.qty || 1} min={1} max={9999} onChange={(v) => patch(it.uid, (t) => { t.qty = v; })} />}
                        {vr && <input class="var" type="number" min={vr.min} max={vr.max} value={it.variable ?? vr.min} title={`Variable cost ${vr.min}–${vr.max}`} onChange={(ev) => patch(it.uid, (t) => { t.variable = Number(ev.currentTarget.value); })} />}
                      </div>
                      {bundled.length > 0 && <div class="bundle-note"><small>Includes: {bundled.map((k) => k.def.name).join(', ')}</small></div>}
                      {modSection && modSection(e)}
                    </td>
                    {extraCells && extraCells(e)}
                    <td class={cx('num', over && 'bad')} title={over ? 'Above the creation availability limit' : ''}>{fmtAvail(e.avail)}</td>
                    {(kind === 'cyberware' || kind === 'bioware') && <td class="num">{e.ess.toFixed(2)}</td>}
                    <td class="num strong">{nuyen(e.cost)}</td>
                    <td><SourceRef source={def.source} page={def.page} /></td>
                    <td class="act"><button type="button" class="ghost sm" onClick={() => remove(it.uid)} aria-label={`Remove ${def.name}`}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {autoRows.length > 0 && (
        <p class="hint auto-weapons">Also carried: {autoRows.map((e, i) => (
          <span key={e.it.uid}>{i ? ', ' : ''}<InspectLink kind={kind} id={e.def.id}>{e.def.name}</InspectLink> <small class="dim">(from {e.it.from})</small></span>
        ))}</p>
      )}
      {adding && (
        <Picker
          title={`Add — ${title}`}
          items={defs}
          multi
          category={category || ((x) => x.category)}
          hint={pickerHint}
          searchText={searchText}
          onClose={() => setAdding(false)}
          onPick={(def) => update((x) => {
            if (kind === 'gear') for (const item of spawnGearBundle(def)) x.gear.push(item);
            else x[kind].push(newOwned(kind, def));
          })}
          columns={pickCols}
          inspectKind={kind}
          unavailable={unavailable}
        />
      )}
    </Panel>
  );
}

export const avail = (x) => x.avail;
export const cost = (x) => (x.cost && String(x.cost).length < 22 ? x.cost : 'var.');
export const bookCol = { key: 'source', label: 'Book', get: (x) => <SourceRef source={x.source} page={x.page} /> };
export { arr, txt };
