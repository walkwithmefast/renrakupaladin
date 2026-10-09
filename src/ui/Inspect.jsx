import { useEffect, useState } from 'preact/hooks';
import { useStore, useChar, closeInspect, viewModeOf } from '../store.js';
import { describeItem, resolveInspect } from '../engine/describe.js';
import { deviceKind } from '../engine/matrix.js';
import { bookUrl, cx, useLayer, nuyen } from './common.jsx';
import { WeaponAccessories, ArmorModsList, VehicleModsList, DeckConfigEditor, DeviceProgramsEditor, BundleIncludes } from './ModsEditor.jsx';
import { FocusBonding } from './Foci.jsx';
import { setDescriptionEdit } from '../rulebook.js';
import { CustomItemForm, CustomQualityForm } from './CustomItem.jsx';
import { removeOwned, sellItem, discardItem, suggestedSale } from '../engine/money.js';

const paras = (t) => String(t).split('\n\n').map((para, i) => <p key={i}>{para}</p>);

/**
 * The item's description: the rulebook excerpt, or the user's own edit of it, with an Edit button either way
 * (and "Add a description" when there's neither). Edits are the user's, per item, for every character
 * (src/rulebook.js), so they're allowed in Play mode too - they don't change the character.
 */
function Description({ info, url }) {
  const [editing, setEditing] = useState(null); // draft text while the editor is open
  useEffect(() => setEditing(null), [info.descId]);
  if (!info.descId) return null;
  const book = info.excerpt;
  const cite = book && (
    <p class="cite">
      {url ? <a href={bookUrl(book.source, book.page)} target="_blank" rel="noopener">{info.book.name}, p.{book.page} ↗</a> : `${info.book.name}, p.${book.page}`}
      <span class="dim"> · excerpt, read the full entry in the book</span>
    </p>
  );
  if (editing != null) {
    // the shortcut passes the box's live value: the last keystroke may not have reached `editing` yet
    const save = (text = editing) => { setDescriptionEdit(info.descId, text); setEditing(null); };
    return (
      <section class="excerpt editing">
        <h4>{info.userText || book ? 'Edit description' : 'Add a description'}</h4>
        <textarea rows="9" value={editing} aria-label="Description" autoFocus
          onInput={(e) => setEditing(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(e.currentTarget.value); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
        <p class="hint">Your text replaces the book's here, for this item on every character. Leave a blank line between paragraphs. Ctrl+Enter saves.</p>
        <div class="row gap">
          <button type="button" class="primary sm" onClick={() => save()}>Save</button>
          <button type="button" class="sm" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </section>
    );
  }
  if (info.userText) {
    return (
      <section class="excerpt mine">
        <h4>Description <span class="chip on">your edit</span>
          <button type="button" class="ghost sm edit" onClick={() => setEditing(info.userText)} title="Edit your description">✎ Edit</button>
        </h4>
        <blockquote>{paras(info.userText)}</blockquote>
        <p class="cite">
          <button type="button" class="linkish" onClick={() => setDescriptionEdit(info.descId, null)}>
            {book ? 'Revert to the rulebook text' : 'Remove your description'}
          </button>
        </p>
      </section>
    );
  }
  if (book) {
    return (
      <section class="excerpt">
        <h4>From the rulebook
          <button type="button" class="ghost sm edit" onClick={() => setEditing(book.text)} title="Write your own version of this description">✎ Edit</button>
        </h4>
        <blockquote>{paras(book.text)}</blockquote>
        {cite}
      </section>
    );
  }
  return (
    <p class="bookline">
      <button type="button" class="ghost sm" onClick={() => setEditing('')} title="Write your own description for this item">
        ✎ {info.drug ? 'Add your own description' : 'Add a description'}
      </button>
    </p>
  );
}

const Rows = ({ rows, cls }) => (
  <dl class={cx('kv', cls)}>
    {rows.map(([k, v], i) => <div key={k + i}><dt>{k}</dt><dd>{v}</dd></div>)}
  </dl>
);

/**
 * Getting rid of an owned item. Finished characters: Sell (credits what you got, default half price) or Delete
 * (lost / destroyed / used up: no refund) - both logged, undo puts the item back (engine/money.js). In Build mode
 * "Remove from character" is also offered: it undoes the purchase, refund included (for fixing mistakes).
 */
function DisposeFooter({ ch, d, kind, it, update, removable, sellable }) {
  const [step, setStep] = useState(null); // null | 'sell' | 'delete'
  const entries = kind === 'cyberware' || kind === 'bioware' ? d.augs.filter((a) => a.kind === kind) : d.items[kind] || [];
  const cost = (entries.find((e) => e.it.uid === it.uid) || {}).cost || 0;
  const [price, setPrice] = useState(() => String(suggestedSale(cost)));
  useEffect(() => { setStep(null); setPrice(String(suggestedSale(cost))); }, [it.uid]);
  const done = (fn) => { update(fn, { record: !sellable }); closeInspect(); };
  if (step === 'sell') {
    return (
      <footer class="dispose">
        <span class="small">Sold for</span>
        <input type="number" min="0" value={price} aria-label="Sale price" autoFocus style={{ width: '8em' }}
          onInput={(e) => setPrice(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && done((x) => sellItem(x, d, kind, it.uid, price))} />
        <span class="small dim">¥ (paid {nuyen(cost)})</span>
        <button type="button" class="primary" onClick={() => done((x) => sellItem(x, d, kind, it.uid, price))}>Sell</button>
        <button type="button" class="ghost" onClick={() => setStep(null)}>Cancel</button>
      </footer>
    );
  }
  if (step === 'delete') {
    return (
      <footer class="dispose">
        <span class="small">Delete {it.label || it.name}? No money back.</span>
        <button type="button" class="danger" onClick={() => done((x) => discardItem(x, d, kind, it.uid))}>Delete</button>
        <button type="button" class="ghost" onClick={() => setStep(null)}>Cancel</button>
      </footer>
    );
  }
  return (
    <footer class="dispose">
      {sellable && <button type="button" onClick={() => setStep('sell')} title="You sold it: enter what you got">Sell…</button>}
      {sellable && <button type="button" class="ghost danger" onClick={() => setStep('delete')} title="Lost, destroyed or used up: the money stays spent">Delete (no refund)</button>}
      {removable && (
        <button type="button" class="ghost" title={sellable ? 'Undo the purchase: removes it and refunds the full price' : 'Remove it from the character'}
          onClick={() => { update((x) => { removeOwned(x, kind, it.uid); }); closeInspect(); }}>
          {sellable ? 'Remove (refund)' : 'Remove from character'}
        </button>
      )}
    </footer>
  );
}

export function InspectDrawer() {
  const st = useStore();
  const { ch, d, update } = useChar();
  const insp = st.inspect;
  const [editCustom, setEditCustom] = useState(false);
  // re-raise whenever a different item is opened, e.g. clicking another info button in a picker
  const [z, isTop] = useLayer(!!insp, insp);

  useEffect(() => {
    if (!insp) return undefined;
    const h = (e) => { if (e.key === 'Escape' && isTop()) closeInspect(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [insp]);

  if (!insp || !ch || !d) return null;
  const found = resolveInspect(ch, insp.kind, insp.ref);
  if (!found) return null;
  const { def, it } = found;
  const info = describeItem(insp.kind, def, it, d);
  const url = info.book ? bookUrl(info.book.source, info.book.page) : null;
  const listKey = insp.kind;
  const playing = viewModeOf(ch) === 'play';
  const removable = !!it && listKey !== 'skills' && !playing;
  const buyable = !!it && !it.child && ['gear', 'weapons', 'armor', 'cyberware', 'bioware', 'vehicles'].includes(listKey);
  const setFree = (on) => update((x) => { const t = x[listKey].find((z) => z.uid === it.uid); if (t) { if (on) t.free = true; else delete t.free; } });

  return (
    <aside class="drawer" style={z ? { zIndex: z } : undefined} role="complementary" aria-label={`Details for ${info.title}`}>
      <header>
        <div>
          <h3>{info.title}</h3>
          <div class="chips"><span class="chip on">{info.kindLabel}</span>{info.sub && info.sub !== info.kindLabel && <span class="chip">{info.sub}</span>}</div>
        </div>
        <button type="button" class="ghost" onClick={closeInspect} aria-label="Close details">✕</button>
      </header>
      <div class="scroll">
        {info.book && (
          <p class="bookline">
            {url
              ? <a class="src big" href={url} target="_blank" rel="noopener">Read in {info.book.name}{info.book.page ? `, p.${info.book.page}` : ''} ↗</a>
              : <span class="dim">{info.book.name}{info.book.page ? `, p.${info.book.page}` : ''} (no PDF found)</span>}
          </p>
        )}
        {info.drug && (
          <section class="drugbox">
            <h4>Drug profile</h4>
            {info.drug.rows.length > 0 && <Rows rows={info.drug.rows} cls="druggy" />}
            {info.drug.effect && <div class="effectline"><span>Effect</span><p>{info.drug.effect}</p></div>}
            {info.drug.flavor && (
              <>
                <h4 class="sub">Flavor &amp; side effects</h4>
                <div class="excerpt">
                  <blockquote>{info.drug.flavor.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}</blockquote>
                </div>
              </>
            )}
            <p class="cite">
              {url ? <a href={bookUrl(info.drug.source, info.drug.page)} target="_blank" rel="noopener">{info.book.name}, p.{info.drug.page} ↗</a> : `${info.book.name}, p.${info.drug.page}`}
              <span class="dim"> · quoted from the book</span>
            </p>
          </section>
        )}
        <Description info={info} url={url} />
        {info.custom && (
          <section class="excerpt mine">
            <h4>{listKey === 'qualities' ? 'Custom quality' : 'Custom item'} <span class="chip on">{listKey === 'qualities' ? 'house rule' : 'from your GM'}</span>
              <button type="button" class="ghost sm edit" onClick={() => setEditCustom(true)}>✎ {listKey === 'qualities' ? 'Edit custom quality' : 'Edit custom item'}</button>
            </h4>
            {info.customText ? <blockquote>{info.customText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</blockquote> : <p class="hint">No description - use Edit to add one.</p>}
          </section>
        )}
        {editCustom && it && (listKey === 'qualities'
          ? <CustomQualityForm q={it} onClose={() => setEditCustom(false)} />
          : <CustomItemForm kind={listKey} it={it} onClose={() => setEditCustom(false)} />)}
        {buyable && ch.mode === 'career' && (
          <p class="bookline">
            <label class="check" title="Loot or a gift: it doesn't come out of your nuyen">
              <input type="checkbox" checked={!!it.free} onChange={(e) => setFree(e.currentTarget.checked)} /> Didn't pay for it (loot / GM gift)
            </label>
          </p>
        )}
        {info.own.length > 0 && <section><h4>Yours</h4><Rows rows={info.own} cls="own" /></section>}
        {it && insp.kind === 'weapons' && <WeaponAccessories it={it} def={def} update={update} readOnly={playing} heading />}
        {it && insp.kind === 'armor' && <ArmorModsList it={it} def={def} update={update} readOnly={playing} heading />}
        {it && insp.kind === 'vehicles' && <VehicleModsList it={it} def={def} update={update} readOnly={playing} heading />}
        {it && insp.kind === 'gear' && <FocusBonding it={it} def={def} d={d} update={update} readOnly={playing} heading />}
        {it && insp.kind === 'gear' && deviceKind(def) === 'deck' && <DeckConfigEditor it={it} def={def} update={update} readOnly={playing} />}
        {it && insp.kind === 'gear' && deviceKind(def) && <DeviceProgramsEditor it={it} def={def} d={d} update={update} readOnly={playing} />}
        {it && insp.kind === 'gear' && <BundleIncludes it={it} d={d} />}
        {info.stats.length > 0 && <section><h4>Stats</h4><Rows rows={info.stats} /></section>}
        {info.cost.length > 0 && <section><h4>Cost &amp; availability</h4><Rows rows={info.cost} /></section>}
        {info.effects.length > 0 && <section><h4>Sheet effects</h4><ul class="plain">{info.effects.map((e, i) => <li key={i} class="fx">{e}</li>)}</ul></section>}
        {info.other.length > 0 && (
          <section>
            <h4>Not applied automatically</h4>
            <p class="hint">
              {info.excerpt
                ? 'Some of what this does isn’t worked into your sheet numbers. The rulebook text above says what to apply at the table.'
                : `These aren't calculated automatically; check the rulebook: ${info.other.join(', ')}.`}
            </p>
          </section>
        )}
        {info.req.length > 0 && <section><h4>Requirements</h4><ul class="plain">{info.req.map((r, i) => <li key={i}>{r}</li>)}</ul></section>}
        {info.notes.length > 0 && <section><h4>Notes</h4><ul class="plain">{info.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></section>}
        {it && insp.kind !== 'skills' && playing && it.notes && <section><h4>Your notes</h4><p class="pre">{it.notes}</p></section>}
        {it && insp.kind !== 'skills' && !playing && (
          <section>
            <h4>Your notes</h4>
            <textarea rows="3" placeholder="Custom name, modifications, where you keep it…" value={it.notes || ''}
              onChange={(e) => update((x) => {
                const list = insp.kind === 'qualities' ? x.qualities : x[insp.kind];
                const t = list.find((z) => z.uid === insp.ref.uid);
                if (t) t.notes = e.currentTarget.value;
              }, { record: false })} />
          </section>
        )}
      </div>
      {(removable || (buyable && ch.mode === 'career')) && (
        <DisposeFooter ch={ch} d={d} kind={listKey} it={it} update={update} removable={removable} sellable={buyable && ch.mode === 'career'} />
      )}
    </aside>
  );
}
