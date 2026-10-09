// re-run the quality audit against describe.js's KNOWN list (= what the app applies or shows)
import { dataMod } from '../test/helpers.mjs'; // usage: node tools/audit_qualities.mjs
import fs from 'node:fs';
const src = fs.readFileSync('src/engine/describe.js', 'utf8');
const { SITUATIONAL } = await import('../src/engine/effects.js');
const known = new Set([...src.slice(src.indexOf('const KNOWN_BONUS'), src.indexOf('const NOISE_BONUS')).matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]).concat(SITUATIONAL.map(([k]) => k)));
const noise = new Set(['selecttext', 'enabletab', 'unlockskills', 'selectskill']);
const Q = dataMod.idx('qualities', 'qualities').list.filter((q) => !q.hide);
const left = new Map(); let full = 0, withBonus = 0;
for (const q of Q) {
  const ks = q.bonus && typeof q.bonus === 'object' ? Object.keys(q.bonus).filter((k) => !k.startsWith('@')) : [];
  if (!ks.length) continue;
  withBonus++;
  const un = ks.filter((k) => !known.has(k) && !noise.has(k));
  if (!un.length) full++;
  for (const k of un) (left.get(k) || left.set(k, []).get(k)).push(q.name);
}
console.log(`qualities with bonus data: ${withBonus}; fully applied/shown: ${full}; with something not applied: ${withBonus - full}`);
for (const [k, l] of [...left].sort((a, b) => b[1].length - a[1].length)) console.log(String(l.length).padStart(3), k.padEnd(34), l.join('; '));
