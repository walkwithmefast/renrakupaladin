import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { enabledBooks, openInspect, closeInspect, getState, useStore, setSettings } from '../store.js';
import { sourceOk } from '../engine/data.js';
import { pdfFolderUrl, pdfPageUrl } from '../engine/pdfLinks.js';
import { compareBy, isNumericColumn, nextSort } from '../pickerSort.js';

export const fmt = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-US'));
export const nuyen = (n) => fmt(Math.round(n)) + '¥';
export const cx = (...a) => a.filter(Boolean).join(' ');

/** click a dot to set the rating; clicking the current top dot lowers it by one */
export function Dots({ value, max, onChange, bonus = 0, cap, disabled, min = 0, tone }) {
  const dots = [];
  const total = Math.max(max, value + bonus);
  for (let i = 1; i <= total; i++) {
    const on = i <= value;
    const aug = !on && i <= value + bonus;
    const over = cap != null && i > cap;
    dots.push(
      <button
        key={i}
        type="button"
        class={cx('dot', on && 'on', aug && 'aug', over && 'over', tone)}
        disabled={disabled || over}
        title={String(i)}
        onClick={() => onChange(Math.max(min, i === value ? i - 1 : i))}
      />,
    );
  }
  return <span class="dots" role="group">{dots}</span>;
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, width }) {
  return (
    <span class="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="decrease">−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        style={width ? { width } : null}
        onInput={(e) => {
          const n = parseInt(e.currentTarget.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="increase">+</button>
    </span>
  );
}

export function Field({ label, children, wide, hint }) {
  return (
    <label class={cx('field', wide && 'wide')}>
      <span class="lbl">{label}</span>
      {children}
      {hint && <span class="hint">{hint}</span>}
    </label>
  );
}

export function Panel({ title, right, children, class: klass, sub }) {
  return (
    <section class={cx('panel', klass)}>
      {(title || right) && (
        <header>
          <h3>{title}{sub && <small>{sub}</small>}</h3>
          <div class="right">{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}

// ---- overlay stacking ----------------------------------------------------------
// Pickers/dialogs (Modal) and the Inspector drawer can open on top of each other in either order (an info
// button inside a picker opens the drawer; a "+ accessory" button inside the drawer opens a picker), so a
// fixed z-index can't be right both ways. Instead each overlay takes the next z-index when it opens:
// whichever opened last is on top, and only the top one reacts to Escape.
let layerSeq = 0;
const layerStack = [];

/** @param {boolean} open @param {any} [key] a new key re-raises an already-open layer to the top
 *  @returns {[number|undefined, () => boolean]} z-index to apply, and "am I the top layer right now?" */
export function useLayer(open, key) {
  const [z, setZ] = useState(undefined);
  const token = useRef(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const t = {};
    token.current = t;
    layerStack.push(t);
    setZ(100 + ++layerSeq);
    return () => {
      const i = layerStack.indexOf(t);
      if (i >= 0) layerStack.splice(i, 1);
      if (token.current === t) token.current = null;
    };
  }, [open, key]);
  return [z, () => !!token.current && layerStack[layerStack.length - 1] === token.current];
}

export function Modal({ title, onClose, children, wide, footer }) {
  const [z, isTop] = useLayer(true);
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && isTop() && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    // clicking the backdrop closes this dialog - and, if the Inspector drawer was opened on top of it (from one of
    // its rows), the drawer too, so one click clears both. A drawer *underneath* (this dialog was opened from it) stays.
    // Portaled to <body>: a dialog opened from inside the sticky .top header (Character -> Rename/Delete, the PDF
    // error alert) used to render this "position: fixed" backdrop as a DESCENDANT of that sticky ancestor, which
    // Chromium sizes to the sticky element's own box instead of the viewport - the dialog was squashed into a ~120px
    // strip and scrolled itself half off-screen once the first field autofocused. Rendering at the document root
    // sidesteps that containing-block bug regardless of where the dialog was opened from.
    <div class="modal-back" style={z ? { zIndex: z } : undefined} onMouseDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (!isTop()) closeInspect();
      onClose();
    }}>
      <div class={cx('modal', wide && 'wide')} role="dialog" aria-label={title}>
        <header><h3>{title}</h3><button type="button" class="ghost" onClick={onClose} aria-label="close">✕</button></header>
        <div class="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Themed stand-ins for window.confirm()/alert(): a native dialog can't be restyled to match the app's theme
 * system (Matrix/Renraku/Terminal/...), and it blocks headless/automated testing outright (Chrome auto-dismisses
 * it with no way to answer it, which is exactly what made this a problem here - see PROJECT_STATUS.md's bug
 * list). `message` may contain blank-line-separated paragraphs, matching how the native dialogs used "\n\n".
 */
function DialogBody({ message }) {
  return String(message).split('\n\n').map((p, i) => <p key={i} class="hint" style={i === 0 ? { marginTop: 0 } : undefined}>{p}</p>);
}
export function ConfirmDialog({ title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button type="button" onClick={onClose}>{cancelLabel}</button>
        <button type="button" class={danger ? 'danger' : 'primary'} autoFocus onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</button>
      </>
    }>
      <DialogBody message={message} />
    </Modal>
  );
}
export function AlertDialog({ title = 'Notice', message, onClose }) {
  return (
    <Modal title={title} onClose={onClose} footer={<button type="button" class="primary" autoFocus onClick={onClose}>OK</button>}>
      <DialogBody message={message} />
    </Modal>
  );
}

// ---- book / page links -------------------------------------------------------
/** folder that holds the rulebook PDFs, as a URL prefix. Default: the "Shadowrun 5e" folder next to the app. */
export function pdfBase() {
  return pdfFolderUrl((getState().settings || {}).pdfBase);
}

export function bookUrl(source, page) {
  return pdfPageUrl(window.SR5BOOKS, pdfBase(), source, page);
}

export function SourceRef({ source, page }) {
  if (!source) return null;
  const url = bookUrl(source, page);
  const label = page ? `${source} ${page}` : source;
  return url ? (
    <a class="src" href={url} target="_blank" rel="noopener" title="Open the rulebook page">{label}</a>
  ) : (
    <span class="src dim">{label}</span>
  );
}

// ---- searchable catalogue picker ------------------------------------------
/**
 * @param {object[]} items  raw data rows
 * @param {{key:string,label:string,get?:(it)=>any,cls?:string}[]} columns
 * @param {(it)=>string} [category]
 * @param {(it) => string|null} [unavailable]  why the character can't take an item (engine/purchasable.js), or null.
 *   Such rows are dimmed with the reason; the "Hide what this character can't take" box (remembered in
 *   settings.hideUnavailable, for every picker) hides them. Pass a stable function (useMemo) - it runs over every row.
 */
export function Picker({ title, items, columns, category, onPick, onClose, searchText, multi, hint, initialCategory, inspectKind, unavailable }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(initialCategory || '');
  const [limit, setLimit] = useState(120);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const enabled = enabledBooks();
  const pool = useMemo(
    () => items.filter((it) => !it.hide && sourceOk(it, enabled)).map((it) => ({
      it,
      hay: (searchText ? searchText(it) : `${it.name} ${it.category || ''}`).toLowerCase(),
      cat: category ? category(it) : '',
    })),
    [items, enabled, category, searchText],
  );
  const why = useMemo(() => {
    const m = new Map();
    if (unavailable) for (const r of pool) { const reason = unavailable(r.it); if (reason) m.set(r.it, reason); }
    return m;
  }, [pool, unavailable]);
  const hideUnavail = !!unavailable && !!getState().settings.hideUnavailable;
  const cats = useMemo(() => {
    const m = new Map();
    for (const r of pool) if (r.cat) m.set(r.cat, (m.get(r.cat) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pool]);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  // click a column header to sort by it (numbers highest-first, text A-Z; click again to reverse)
  const [sort, setSort] = useState(null);
  const sortCol = sort && columns.find((c) => c.key === sort.key);
  const numericCols = useMemo(() => new Map(columns.map((c) => [c.key, isNumericColumn(c, pool.map((r) => r.it))])), [pool]);
  const rows = useMemo(() => {
    const out = pool.filter((r) => (!cat || r.cat === cat) && terms.every((t) => r.hay.includes(t)) && !(hideUnavail && why.has(r.it)));
    const byName = (a, b) => String(a.it.name).toLowerCase().localeCompare(String(b.it.name).toLowerCase());
    if (sortCol) {
      const cmp = compareBy(sortCol, numericCols.get(sortCol.key), sort.dir);
      out.sort((a, b) => cmp(a.it, b.it) || byName(a, b));
    } else {
      // default: names starting with the first search word first, then A-Z
      out.sort((a, b) => {
        const as = terms.length && String(a.it.name).toLowerCase().startsWith(terms[0]) ? 0 : 1;
        const bs = terms.length && String(b.it.name).toLowerCase().startsWith(terms[0]) ? 0 : 1;
        return as - bs || byName(a, b);
      });
    }
    return out;
  }, [pool, cat, q, sort, hideUnavail, why]);

  // with inspectKind, a click anywhere on a row (other than its Add button, a book link, etc.) opens its details
  const st = useStore();
  const shown = inspectKind && st.inspect && st.inspect.kind === inspectKind && st.inspect.ref.id;
  const inspect = (it) => openInspect(inspectKind, { id: it.id });
  const onRowClick = (e, it) => { if (!e.target.closest('button, a, input, select, label')) inspect(it); };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div class="picker-bar">
        <input ref={inputRef} class="search" placeholder="Search…" value={q} onInput={(e) => { setQ(e.currentTarget.value); setLimit(120); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && rows[0]) { onPick(rows[0].it); if (!multi) onClose(); } }} />
        {cats.length > 1 && (
          <select value={cat} onChange={(e) => { setCat(e.currentTarget.value); setLimit(120); }}>
            <option value="">All categories ({pool.length})</option>
            {cats.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        )}
        {unavailable && (
          <label class="check hide-unavail" title="Hide items this character can't take: requirements not met (e.g. needs Magic), availability over the creation limit, Essence it doesn't have, or the quality Karma limit">
            <input type="checkbox" checked={hideUnavail} onChange={(e) => setSettings({ hideUnavailable: e.currentTarget.checked })} />
            Hide what this character can't take{why.size > 0 ? ` (${why.size})` : ''}
          </label>
        )}
        <span class="count">{rows.length} match{rows.length === 1 ? '' : 'es'}</span>
      </div>
      {hint && <p class="hint">{hint}</p>}
      <div class="tbl-wrap">
        <table class="tbl pick">
          <thead>
            <tr>
              {columns.map((c) => {
                if (!c.label) return <th key={c.key} class={c.cls} />;
                const on = sort && sort.key === c.key;
                const numeric = numericCols.get(c.key);
                return (
                  <th key={c.key} class={cx(c.cls, 'sortable')} aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" class={cx('sorthead', on && 'on')} onClick={() => { setSort(nextSort(sort, c.key, numeric)); setLimit(120); }}
                      title={on ? 'Click to reverse' : `Sort by ${c.label.toLowerCase()}${numeric ? ' (highest first)' : ''}`}>
                      {c.label}<span class="arrow" aria-hidden="true">{on ? (sort.dir > 0 ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                );
              })}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(({ it }) => (
              <tr key={it.id || it.name} class={cx(inspectKind && 'inspectable', shown && shown === it.id && 'shown', why.has(it) && 'unavail')}
                title={inspectKind ? 'Click for details, double-click to add' : undefined}
                tabIndex={inspectKind ? 0 : undefined}
                onClick={inspectKind ? (e) => onRowClick(e, it) : undefined}
                onKeyDown={inspectKind ? (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); inspect(it); } } : undefined}
                onDblClick={(e) => { if (e.target.closest('button, a, input, select, label')) return; onPick(it); if (!multi) onClose(); }}>
                {columns.map((c, ci) => (
                  <td key={c.key} class={c.cls}>
                    {c.get ? c.get(it) : it[c.key]}
                    {ci === 0 && why.has(it) && <div class="why">⚠ {why.get(it)}</div>}
                  </td>
                ))}
                <td class="act">
                  <button type="button" class="primary sm" onClick={() => { onPick(it); if (!multi) onClose(); }}>Add</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > limit && <button type="button" class="more" onClick={() => setLimit(limit + 200)}>Show more ({rows.length - limit} hidden)</button>}
        {rows.length === 0 && <p class="empty">Nothing matches. Check the book filter in Settings if you expected more.</p>}
      </div>
    </Modal>
  );
}

/** a name that opens the inspector: pass uid for an owned item, or id for a catalogue entry */
export function InspectLink({ kind, uid, id, children, class: klass }) {
  return (
    <button type="button" class={cx('linkname', klass)} title="Show details" onClick={() => openInspect(kind, uid ? { uid } : { id })}>
      {children}
    </button>
  );
}

export function Empty({ children }) { return <p class="empty">{children}</p>; }

export function Warn({ list }) {
  if (!list.length) return null;
  return (
    <ul class="warnings">
      {list.map((w, i) => <li key={i} class={w.sev}>{w.msg}</li>)}
    </ul>
  );
}

/** "pick a skill" for a quality or power (Chummer `selectskill`: optional `skillcategories`, `@minimumrating`) */
export function SkillChoice({ d, spec, value, onChange }) {
  const cats = spec && spec.skillcategories ? [].concat(spec.skillcategories.category || []).map(String) : null;
  const minRating = Number((spec && spec['@minimumrating']) || 0);
  const skills = d.skills.filter((s) => (!cats || cats.includes(s.category)) && (!minRating || s.rating >= minRating || s.name === value));
  return (
    <select class="choicesel" value={value || ''} aria-label="Which skill" onChange={(e) => onChange(e.currentTarget.value)}
      title={minRating ? `Skills rated ${minRating}+ only` : undefined}>
      <option value="">— skill —</option>
      {skills.map((s) => <option key={s.id} value={s.name}>{s.name}{s.rating ? ` (${s.rating})` : ''}</option>)}
    </select>
  );
}
