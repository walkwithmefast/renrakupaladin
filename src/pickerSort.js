// Click-to-sort for the catalogue pickers (common.jsx's Picker). Works from the same column definitions the
// picker renders ({key, label, get?, cls?}), so every picker gets it without per-picker code; a column can pass
// `sort: (item) => value` when what it shows isn't what it should sort by.

/** leading number of a value ("12R" -> 12, "2,000¥" -> 2000, 4 -> 4), else NaN ("var.", "Rating * 350", "F-3") */
export function asNumber(v) {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').replace(/[,¥\s]/g, '').match(/^[-+]?(\d+\.?\d*|\.\d+)/);
  return m ? parseFloat(m[0]) : NaN;
}

/** what a column sorts by for one item */
export function sortValue(col, it) {
  if (col.sort) return col.sort(it);
  // Book: by book code, then page number
  if (col.key === 'source') return [String(it.source || ''), asNumber(it.page)];
  const shown = col.get ? col.get(it) : it[col.key];
  // a column that renders markup (a link, an icon) sorts by the raw field instead
  return shown !== null && typeof shown === 'object' ? it[col.key] : shown;
}

const blank = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));

/** numbers sort first highest-first; text first A-Z. A column counts as numeric if most of its values are numbers. */
export function isNumericColumn(col, items) {
  if (col.key === 'source') return false;
  if (col.cls === 'num') return true;
  let nums = 0;
  let seen = 0;
  for (const it of items.slice(0, 200)) {
    const v = sortValue(col, it);
    if (blank(v)) continue;
    seen++;
    if (!Number.isNaN(asNumber(v))) nums++;
  }
  return seen > 0 && nums / seen > 0.5;
}

function cmpText(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * compare two items by a column. `dir` is 1 (ascending) or -1 (descending). Values with nothing to sort by
 * (blank, or no number in a numeric column) always go last, whichever way round.
 */
export function compareBy(col, numeric, dir) {
  return (a, b) => {
    let va = sortValue(col, a);
    let vb = sortValue(col, b);
    if (Array.isArray(va) || Array.isArray(vb)) { // [book, page]
      const t = cmpText(va[0], vb[0]);
      if (t) return (blank(va[0]) - blank(vb[0])) || t * dir;
      va = va[1]; vb = vb[1];
      numeric = true;
    }
    if (numeric) {
      const na = asNumber(va);
      const nb = asNumber(vb);
      const ba = Number.isNaN(na);
      const bb = Number.isNaN(nb);
      if (ba || bb) return ba - bb || (ba && bb ? cmpText(va ?? '', vb ?? '') : 0);
      return (na - nb) * dir;
    }
    const ba = blank(va);
    const bb = blank(vb);
    if (ba || bb) return ba - bb;
    return cmpText(va, vb) * dir;
  };
}

/** the first click on a header: numbers highest-first, text A-Z; clicking the same header again reverses it */
export const nextSort = (current, key, numeric) => (current && current.key === key
  ? { key, dir: -current.dir }
  : { key, dir: numeric ? -1 : 1 });
