// App state: character library + settings, with undo/redo.
// Where characters live depends on how the app was opened:
//  - desktop app (Electron, window.rpFiles present): one <Name>.rp.json file per character in the "characters"
//    folder. Edits stay in memory until saved - by the Save button (Ctrl+S), or automatically when switching
//    Build/Play, changing page, switching/creating/importing characters, and when the window closes.
//    Settings and UI state (open character, list order, view modes) still go to localStorage.
//  - plain browser (Firefox opening dist/index.html, the headless test harness, the shareable zip): the old
//    behavior - everything, characters included, auto-persisted to localStorage; Save is a no-op.
import { useEffect, useMemo, useReducer } from 'preact/hooks';
import { newCharacter, derive } from './engine/character.js';
import { books } from './engine/data.js';
import { relinkGearBundles } from './engine/gearBundle.js';

// Deliberately still 'chummer-remake.v1' - this is the app's old name, not "Renraku Paladin", but changing
// a localStorage key orphans everyone's already-saved characters (the app just wouldn't find them anymore).
// The '.v1' here is an unrelated, pre-existing storage-schema marker (for if the save format ever needs a
// breaking migration) - not the same as APP_VERSION in version.js, which is just a release number.
const KEY = 'chummer-remake.v1';
const HIST_MAX = 60;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

// repair characters saved before bundled gear (a deck's Sim Module, its Commlink Functionality, ...)
// tracked which item it belonged to - see relinkGearBundles(). Cheap and a no-op once already linked.
function repairBundles(st) {
  for (const ch of Object.values(st.chars || {})) relinkGearBundles(ch);
  return st;
}

const fresh = () => ({ chars: {}, order: [], currentId: null, viewModes: {}, settings: { books: null, rules: {}, theme: 'dark' } });
const FILES = typeof window !== 'undefined' && window.rpFiles ? window.rpFiles : null;
/** true in the desktop app, where characters are files in the characters folder */
export const fileMode = () => !!FILES;

const files = {};   // character id -> its file name in the characters folder
const savedAt = {}; // character id -> the `modified` stamp it had when last written to (or read from) its file
let loadErrors = [];

let state = load() || fresh();
if (FILES) state = { ...state, ...loadFolder(state) };
state = repairBundles(state);
state.settings = { books: null, rules: {}, theme: 'dark', ...(state.settings || {}) };
state.viewModes = state.viewModes || {};

function loadFolder(prev) {
  const chars = {};
  const rekeyed = [];
  try {
    const r = FILES.loadAll();
    loadErrors = r.errors;
    for (const { file, ch } of r.chars) {
      if (!ch.id) { ch.id = newCharacter().id; rekeyed.push(ch.id); } // a hand-copied file sharing another's id
      chars[ch.id] = ch;
      files[ch.id] = file;
      savedAt[ch.id] = ch.modified;
    }
  } catch (e) {
    loadErrors = [{ file: 'characters folder', message: e.message }];
  }
  for (const id of rekeyed) { try { files[id] = FILES.save(chars[id], files[id]); } catch { /* retried on next save */ } }
  const known = (prev.order || []).filter((id) => chars[id]);
  const added = Object.keys(chars).filter((id) => !known.includes(id)).sort((a, b) => (chars[b].modified || 0) - (chars[a].modified || 0));
  return { chars, order: [...known, ...added], currentId: chars[prev.currentId] ? prev.currentId : null };
}
/** characters folder files that couldn't be read at startup: [{file, message}] */
export const folderLoadErrors = () => loadErrors;

const listeners = new Set();
let saveTimer = null;
const history = { undo: [], redo: [] };

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // in the desktop app characters live in their files, not here
    const chars = FILES ? undefined : state.chars;
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, chars, report: undefined, inspect: undefined, roll: undefined })); } catch (e) { console.warn('save failed', e); }
  }, 250);
}
function emit() {
  for (const l of listeners) l();
  persist();
}

export const getState = () => state;
/** re-render without a state change (e.g. src/rulebook.js swapped descriptions in) */
export function notify() { for (const l of listeners) l(); }
export const currentChar = () => (state.currentId ? state.chars[state.currentId] : null);
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);
  return state;
}

/** enabled source books as a Set (null setting = everything) */
let enabledCache = { key: null, set: null };
export function enabledBooks() {
  const list = state.settings.books;
  const key = list ? list.join(',') : '*';
  if (enabledCache.key !== key) {
    // default: every English-language book
    const set = list ? new Set(list) : new Set(books().list.filter((b) => !/German-Only/.test(b.name)).map((b) => b.code));
    enabledCache = { key, set };
  }
  return enabledCache.set;
}

// ---- character operations
export function update(fn, { record = true } = {}) {
  const ch = currentChar();
  if (!ch) return;
  const next = structuredClone(ch);
  fn(next);
  next.modified = Date.now();
  if (record) {
    history.undo.push(ch);
    if (history.undo.length > HIST_MAX) history.undo.shift();
    history.redo.length = 0;
  }
  state = { ...state, chars: { ...state.chars, [next.id]: next } };
  emit();
}
export function undo() {
  const prev = history.undo.pop();
  const cur = currentChar();
  if (!prev || !cur || prev.id !== cur.id) return;
  history.redo.push(cur);
  state = { ...state, chars: { ...state.chars, [prev.id]: prev } };
  emit();
}
export function redo() {
  const nxt = history.redo.pop();
  const cur = currentChar();
  if (!nxt || !cur || nxt.id !== cur.id) return;
  history.undo.push(cur);
  state = { ...state, chars: { ...state.chars, [nxt.id]: nxt } };
  emit();
}
export const canUndo = () => history.undo.length > 0;
export const canRedo = () => history.redo.length > 0;

// ---- saving to the characters folder (desktop app only; everything here is a no-op in a plain browser)
const charLabel = (ch) => (ch && ch.info && (ch.info.name || ch.info.alias)) || 'this character';
/** does this character have edits that aren't in its file yet? */
export const isDirty = (id) => !!FILES && !!state.chars[id] && state.chars[id].modified !== savedAt[id];
/** write one character to its file (created, or renamed to match a new name, as needed); false if it failed */
export function saveChar(id, { quiet = false } = {}) {
  const ch = state.chars[id];
  if (!FILES || !ch) return true;
  try {
    files[id] = FILES.save(ch, files[id]);
    savedAt[id] = ch.modified;
  } catch (e) {
    if (!quiet) alert(`Couldn't save ${charLabel(ch)}: ${e.message}`);
    return false;
  }
  for (const l of listeners) l();
  return true;
}
/** autosave: commit the open character if it has unsaved edits */
export function autosave() {
  if (state.currentId && isDirty(state.currentId)) saveChar(state.currentId);
}
/** commit every unsaved character - runs as the window closes */
export function saveAll() {
  for (const id of Object.keys(state.chars)) if (isDirty(id)) saveChar(id, { quiet: true });
}
export const characterFile = (id) => files[id] || null;
export const openCharactersFolder = () => FILES && FILES.openFolder();

/** add new characters to the library, create their files right away, and open the first */
function addChars(list) {
  autosave();
  const chars = { ...state.chars };
  for (const ch of list) chars[ch.id] = ch;
  const ids = list.map((ch) => ch.id);
  state = { ...state, chars, order: [...ids, ...state.order.filter((x) => !ids.includes(x))], currentId: ids[0] };
  history.undo.length = 0; history.redo.length = 0;
  for (const id of ids) saveChar(id);
  emit();
}
/** give an incoming character a fresh id if it clashes with one already in the library */
function adopt(obj, taken) {
  if (!obj || typeof obj !== 'object' || !obj.attrs || !obj.pri) throw new Error('Not a Renraku Paladin character file.');
  const base = newCharacter();
  const id = obj.id && !state.chars[obj.id] && !taken.has(obj.id) ? obj.id : base.id;
  taken.add(id);
  return { ...base, ...obj, info: { ...base.info, ...obj.info }, id };
}

export function createChar() {
  const ch = newCharacter();
  addChars([ch]);
  return ch;
}
export function openChar(id) {
  if (!state.chars[id] || id === state.currentId) return;
  autosave();
  state = { ...state, currentId: id };
  history.undo.length = 0; history.redo.length = 0;
  emit();
}
export function deleteChar(id) {
  if (FILES && files[id]) FILES.remove(files[id]);
  delete files[id];
  delete savedAt[id];
  const chars = { ...state.chars };
  delete chars[id];
  const order = state.order.filter((x) => x !== id);
  state = { ...state, chars, order, currentId: state.currentId === id ? order[0] || null : state.currentId };
  emit();
}
export function duplicateChar(id) {
  const src = state.chars[id];
  if (!src) return;
  const copy = structuredClone(src);
  copy.id = newCharacter().id;
  copy.info.name = (copy.info.name || 'Unnamed') + ' (copy)';
  addChars([copy]);
}
export function importChar(obj) {
  const ch = adopt(obj, new Set());
  addChars([ch]);
  return ch;
}
/** import every character in an "Export all" file; the first one ends up open */
export function importChars(list) {
  const taken = new Set();
  const chars = list.map((o) => adopt(o, taken));
  if (chars.length) addChars(chars);
  return chars;
}

// ---- Build / Play view mode (a per-character UI mode, separate from creation vs. career) -----------
/** finished (career) characters open in Play, characters still being created open in Build */
export const viewModeOf = (ch) => (ch ? state.viewModes[ch.id] || (ch.mode === 'career' ? 'play' : 'build') : 'build');
export function setViewMode(id, mode) {
  state = { ...state, viewModes: { ...state.viewModes, [id]: mode }, inspect: null };
  emit();
  autosave();
}
export function useViewMode() {
  useStore();
  return viewModeOf(currentChar());
}

/** inspector drawer: which item is open ({kind, ref:{uid}|{id}}) */
export function openInspect(kind, ref) {
  state = { ...state, inspect: { kind, ref } };
  emit();
}
export function closeInspect() {
  if (!state.inspect) return;
  state = { ...state, inspect: null };
  emit();
}

export function setReport(report) {
  state = { ...state, report };
  emit();
}

/** roll tray: the pool being rolled, e.g. {label, pool} */
export function openRoll(spec) {
  state = { ...state, roll: spec };
  emit();
}
export function closeRoll() {
  if (!state.roll) return;
  state = { ...state, roll: null };
  emit();
}

/**
 * `patch` is either an object merged onto `state.settings`, or a function `(settings) => patch` for when the
 * new value depends on the current one (e.g. toggling one entry in a list/map) - always read `state.settings`
 * fresh here rather than a snapshot the caller captured earlier. Two toggles fired back to back (two checkboxes
 * clicked before a re-render lands) used to build both patches from the same stale render-time snapshot, so the
 * second call's write silently clobbered the first (see PROJECT_STATUS.md's bug list).
 */
export function setSettings(patch) {
  const p = typeof patch === 'function' ? patch(state.settings) : patch;
  state = { ...state, settings: { ...state.settings, ...p } };
  emit();
}

// ---- hooks
const deriveCache = new WeakMap();
export function deriveCached(ch) {
  if (!ch) return null;
  const rules = state.settings.rules;
  let e = deriveCache.get(ch);
  if (!e || e.rules !== rules) {
    e = { rules, d: derive(ch, { rules }) };
    deriveCache.set(ch, e);
  }
  return e.d;
}

export function useChar() {
  useStore();
  const ch = currentChar();
  const d = useMemo(() => deriveCached(ch), [ch, state.settings.rules]);
  return { ch, d, update };
}

/** deep set helper for controlled inputs: set(draft, 'info.name', 'Bob') */
export function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
  o[parts[parts.length - 1]] = value;
}

// ---- file helpers
export function downloadJSON(ch) {
  const blob = new Blob([JSON.stringify(ch, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ((ch.info.alias || ch.info.name || 'character').replace(/[^\w\- ]+/g, '').trim() || 'character') + '.rp.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "Export all characters": every character in one file, which Import reads back (one character each) */
export const BUNDLE_FORMAT = 'renraku-paladin-characters';
export function downloadAll() {
  const characters = state.order.map((id) => state.chars[id]).filter(Boolean);
  const blob = new Blob([JSON.stringify({ format: BUNDLE_FORMAT, exported: new Date().toISOString(), characters }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Renraku Paladin characters (${characters.length}).rp.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const bookList = () => books().list;
