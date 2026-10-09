// The "characters" folder: one <Name>.rp.json file per character, holding the whole character object (the
// same JSON the Export button produces, so a saved file can be imported anywhere an export can). Plain Node
// fs code, no Electron, so test/charFiles.test.mjs can drive it against a temp folder.
const fs = require('node:fs');
const path = require('node:path');

const EXT = '.rp.json';
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** the file's base name for a character: its name, else its alias, else "Unnamed runner" - made Windows-safe */
function baseNameFor(ch) {
  const info = (ch && ch.info) || {};
  let s = String(info.name || info.alias || '').trim();
  s = s.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim();
  if (s.length > 80) s = s.slice(0, 80).trim();
  if (!s || RESERVED.test(s)) s = s ? `${s} (character)` : 'Unnamed runner';
  return s;
}

/** every readable character file in `dir` -> {chars: [{file, ch}], errors: [{file, message}]} */
function loadAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const chars = [];
  const errors = [];
  const seen = new Set();
  for (const file of fs.readdirSync(dir)) {
    if (!file.toLowerCase().endsWith(EXT)) continue;
    try {
      const ch = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, ''));
      if (!ch || typeof ch !== 'object' || !ch.attrs || !ch.pri) throw new Error('not a Renraku Paladin character');
      // two files with the same id (someone copied a file by hand): keep both, the second gets a new id on load
      if (!ch.id || seen.has(ch.id)) ch.id = null;
      else seen.add(ch.id);
      chars.push({ file, ch });
    } catch (e) {
      errors.push({ file, message: e.message });
    }
  }
  return { chars, errors };
}

/** a free file name for `ch` - keeps `current` when it already matches the character's name */
function fileNameFor(dir, ch, current) {
  const base = baseNameFor(ch);
  const matches = (f) => f.toLowerCase() === (base + EXT).toLowerCase()
    || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(\\d+\\)${EXT.replace('.', '\\.')}$`, 'i').test(f);
  if (current && matches(current)) return current;
  for (let n = 1; ; n++) {
    const f = n === 1 ? base + EXT : `${base} (${n})${EXT}`;
    if (!fs.existsSync(path.join(dir, f))) return f;
  }
}

/** write `ch` to its file (renaming the old one if the character's name changed); returns the file name */
function save(dir, ch, current) {
  fs.mkdirSync(dir, { recursive: true });
  const file = fileNameFor(dir, ch, current);
  const full = path.join(dir, file);
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ch, null, 2), 'utf8');
  fs.renameSync(tmp, full);
  if (current && current !== file) {
    try { fs.unlinkSync(path.join(dir, current)); } catch { /* already gone */ }
  }
  return file;
}

/** only ever touch plain file names inside the folder */
function safeName(file) {
  return typeof file === 'string' && file === path.basename(file) && file.toLowerCase().endsWith(EXT) ? file : null;
}

module.exports = { EXT, baseNameFor, loadAll, fileNameFor, save, safeName };
