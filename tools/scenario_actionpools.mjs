// Play sheet shows unranked skills; Matrix + Magic action pool panels. node tools/smoke.mjs tools/scenario_actionpools.mjs
import { readFileSync } from 'node:fs';
const load = (f) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const mage = load('Vesper Ashgrove.crm.json'), rigger = load('Dez Calloway (Torque).crm.json');
  await q(`(() => { const st = { chars: { [${JSON.stringify(mage.id)}]: ${JSON.stringify(mage)}, [${JSON.stringify(rigger.id)}]: ${JSON.stringify(rigger)} }, order: [${JSON.stringify(mage.id)}, ${JSON.stringify(rigger.id)}], currentId: ${JSON.stringify(mage.id)}, viewModes: {}, settings: { books: null, rules: {} } }; localStorage.setItem('chummer-remake.v1', JSON.stringify(st)); })()`);
  await q(`location.reload()`); await sleep(1500);
  const pick = (id) => q(`(() => { const s = document.querySelector('.top select'); const o = [...s.options].find(o => o.textContent.includes(${JSON.stringify(id)})); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const tabs = () => q(`[...document.querySelectorAll('.tab-btn')].map(b => b.textContent)`);
  const out = {};
  await pick('Vesper'); await sleep(400);
  await click('.mode-opt', 'Play'); await sleep(400);
  await click('.tab-btn', 'Sheet'); await sleep(400);
  out.sheetRows = await q(`document.querySelectorAll('.sk-row').length`);
  out.unranked = await q(`document.querySelectorAll('.sk-row.unranked').length`);
  out.cantDefault = await q(`[...document.querySelectorAll('.sk-row.unranked .pl')].filter(e=>/can't default/.test(e.textContent)).length`);
  await q(`document.querySelector('.sk-list').closest('section').querySelector('input[type=checkbox]').click()`); await sleep(300);
  out.rowsOff = await q(`document.querySelectorAll('.sk-row').length`);
  out.tabsMage = await tabs();
  await click('.tab-btn', 'Magic'); await sleep(400);
  out.magicRows = await q(`[...document.querySelectorAll('.ap-row')].map(r=>r.textContent.replace(/\s+/g,' '))`);
  await shot('ap-magic', { full: true });
  await pick('Torque'); await sleep(400);
  await click('.mode-opt', 'Play'); await sleep(400);
  out.tabsRig = await tabs();
  await click('.tab-btn', 'Sheet'); await sleep(400);
  out.sheetMatrix = await q(`[...document.querySelectorAll('.ap-bare .ap-row')].map(r=>r.textContent.replace(/\s+/g,' '))`);
  await shot('ap-sheet', { full: true });
  for (const t of out.tabsRig) if (/Matrix|Gear/.test(t)) { await click('.tab-btn', t); await sleep(400);
    out['tab:' + t] = await q(`[...document.querySelectorAll('.ap-row')].length`); }
  console.log(JSON.stringify(out, null, 1));
}
