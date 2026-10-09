// Screenshots of Inazuma 10:12 (decker, 3 Fake SINs) in Play mode: Sheet + Matrix. Used for the v23 Matrix / SIN work.
// Usage: node tools/smoke.mjs tools/scenario_look_inazuma.mjs   (LOOK_PREFIX=before|after, LOOK_MODE=light optional)
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const prefix = process.env.LOOK_PREFIX || 'look';
  const ch = JSON.parse(readFileSync(new URL('../characters/Inazuma 10 12.rp.json', import.meta.url), 'utf8'));
  await q(`(() => {
    const ch = ${JSON.stringify(ch)};
    const st = { chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: { [ch.id]: 'play' },
      settings: { books: null, rules: {}, mode: ${JSON.stringify(process.env.LOOK_MODE || 'dark')} } };
    localStorage.setItem('chummer-remake.v1', JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  await shot(`${prefix}-sheet`);
  await click('.tab-btn', 'Matrix'); await sleep(300);
  await shot(`${prefix}-matrix`, { full: true });
}
