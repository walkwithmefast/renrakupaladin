// Access layer over the generated game data (window.SR5DATA, built by tools/build_data.py).
export const D = globalThis.SR5DATA || {};

export const arr = (x) => (x == null || x === '' ? [] : Array.isArray(x) ? x : [x]);
export const num = (x, d = 0) => {
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isNaN(n) ? d : n;
};
/** text of a value that may be {_:'text','@attr':..} */
export const txt = (x) => (Array.isArray(x) ? txt(x[0]) : x && typeof x === 'object' ? (x._ ?? '') : x == null ? '' : String(x));
export const bool = (x) => String(x).toLowerCase() === 'true';

const sec = (file, name) => (D[file] && D[file][name]) || [];

function index(list) {
  const byId = new Map();
  const byName = new Map();
  for (const it of list) {
    if (it.id) byId.set(it.id, it);
    const k = String(it.name || '').toLowerCase();
    if (k && !byName.has(k)) byName.set(k, it);
  }
  return { list, byId, byName };
}

const cache = {};
/** index('gear','gears') -> {list, byId, byName} */
export function idx(file, name) {
  const key = file + '.' + name;
  return (cache[key] ||= index(sec(file, name)));
}

export const books = () => idx('books', 'books');
export const bookName = (code) => {
  const b = books().list.find((x) => x.code === code);
  return b ? b.name : code;
};

/** is this item's source book enabled? items without a source are always allowed */
export function sourceOk(item, enabled) {
  if (!item || !item.source) return true;
  return !enabled || enabled.has(item.source);
}

export const ATTR_KEYS = ['BOD', 'AGI', 'REA', 'STR', 'CHA', 'INT', 'LOG', 'WIL'];
export const SPECIAL_KEYS = ['EDG', 'MAG', 'RES'];
export const ALL_ATTRS = [...ATTR_KEYS, ...SPECIAL_KEYS];
export const ATTR_NAME = {
  BOD: 'Body', AGI: 'Agility', REA: 'Reaction', STR: 'Strength', CHA: 'Charisma', INT: 'Intuition',
  LOG: 'Logic', WIL: 'Willpower', EDG: 'Edge', MAG: 'Magic', RES: 'Resonance', ESS: 'Essence', DEP: 'Depth',
};
