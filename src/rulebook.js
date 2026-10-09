// Item descriptions: what the Inspector's "From the rulebook" box shows, from three layers (last wins):
//   1. dist/blurbs.js         - built into the app from the developer's PDFs (an empty stub in a shared copy)
//   2. descriptions read here - Settings -> "Read descriptions from my PDFs" (desktop app: electron/rulebook.cjs
//                               runs tools/rulebook_reader.py over the user's own PDFs), incl. their PDF file map
//   3. the user's own edits   - the Edit button next to a description; {id: {text, updated}}
// The merged result goes into the same window globals the rest of the app already reads (SR5TEXT, SR5DRUGS,
// SR5BOOKS), plus SR5EDITS for layer 3. In a plain browser there's no reader, and edits live in localStorage.
import { notify } from './store.js';

const RB = typeof window !== 'undefined' && window.rpRulebook ? window.rpRulebook : null;
const EDITS_KEY = 'rp.descriptionEdits';
const base = typeof window !== 'undefined'
  ? { text: window.SR5TEXT || {}, drugs: window.SR5DRUGS || {}, books: window.SR5BOOKS || {} }
  : { text: {}, drugs: {}, books: {} };

let read = null;   // the reader's last result (without its text), for the Settings summary
let edits = {};

/** true in the desktop app, where descriptions can be read from the user's PDFs */
export const canReadPdfs = () => !!RB;

function load() {
  let data = { read: null, edits: {} };
  if (RB) {
    try { data = RB.load(); } catch (e) { console.warn('rulebook load failed', e); }
  } else {
    try { data.edits = JSON.parse(localStorage.getItem(EDITS_KEY) || '{}'); } catch { /* none */ }
  }
  apply(data.read, data.edits || {});
}

function apply(r, e) {
  read = r ? { folder: r.folder, created: r.created, books: r.books || {}, unmatched: r.unmatched || [],
    text: Object.keys(r.text || {}).length, drugs: Object.keys(r.drugs || {}).length } : null;
  edits = e;
  if (typeof window === 'undefined') return;
  window.SR5TEXT = { ...base.text, ...((r && r.text) || {}) };
  window.SR5DRUGS = { ...base.drugs, ...((r && r.drugs) || {}) };
  window.SR5BOOKS = { ...base.books, ...((r && r.books) || {}) };
  window.SR5EDITS = edits;
}

/** summary of the last "read descriptions" run, or null */
export const readSummary = () => read;

/** the user's edit for one item, or null */
export const descriptionEdit = (id) => (id && edits[id]) || null;

/** save (text) or remove (null / blank) the user's own description for an item */
export function setDescriptionEdit(id, text) {
  const next = { ...edits };
  if (text == null || !String(text).trim()) delete next[id];
  else next[id] = { text: String(text).trim(), updated: new Date().toISOString() };
  if (RB) RB.saveEdits(next);
  else { try { localStorage.setItem(EDITS_KEY, JSON.stringify(next)); } catch { /* storage off */ } }
  edits = next;
  window.SR5EDITS = next;
  notify();
}

/** run the reader over `folder` (the Settings PDF-folder value); onProgress({stage, i, n, label}) */
export async function readFromPdfs(folder, onProgress) {
  if (!RB) return { ok: false, error: 'Only available in the desktop app.' };
  const off = RB.onProgress(onProgress);
  try {
    const r = await RB.read(folder);
    if (r.ok) { load(); notify(); }
    return r;
  } finally {
    off();
  }
}
export const cancelRead = () => RB && RB.cancel();
export const chooseFolder = (current) => (RB ? RB.chooseFolder(current) : Promise.resolve(null));
/** drop the descriptions read from PDFs (back to what's built in) */
export function forgetRead() {
  if (!RB) return;
  RB.forget();
  load();
  notify();
}

load();
