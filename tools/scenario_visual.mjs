// Visual audit: every Build and Play page for the two showcase characters (mage + rigger), desktop + narrow.
// Usage: node tools/smoke.mjs tools/scenario_visual.mjs [prefix]   (VIS_THEME=<theme> VIS_MODE=light|dark optional)
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));

export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const prefix = process.env.VIS_PREFIX || 'vis';
  const mage = load('Vesper Ashgrove.crm.json');
  const rigger = load('Dez Calloway (Torque).crm.json');
  await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const mage = ${JSON.stringify(mage)}, rigger = ${JSON.stringify(rigger)};
    rigger.mode = 'career'; rigger.career = { earned: 6, log: [{ t: Date.now(), kind: 'nuyen', amt: 5000, note: 'Run payment' }], nuyenEarned: 5000 }; rigger.nuyenAdjust = 2000;
    rigger.journal = [{ t: Date.now(), text: 'Extraction at the Renraku arcology went sideways. Owe Kade a favor.' }];
    const st = { chars: { [mage.id]: mage, [rigger.id]: rigger }, order: [mage.id, rigger.id], currentId: mage.id, viewModes: {},
      settings: { books: null, rules: {}, focusPages: { drone: true, magic: true }, theme: ${JSON.stringify(process.env.VIS_THEME || '')} || undefined, mode: ${JSON.stringify(process.env.VIS_MODE || '')} || undefined } };
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  const tabs = () => q(`[...document.querySelectorAll('.tab-btn')].map(b => b.textContent)`);
  const pick = (id) => q(`(() => { const s = document.querySelector('.top select'); const o = [...s.options].find(o => o.textContent.includes(${JSON.stringify(id)})); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const narrow = async (on) => send('Emulation.setDeviceMetricsOverride', { width: on ? 760 : 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const only = (process.env.VIS_ONLY || '').split(',').filter(Boolean);
  for (const [who, name] of [['mage', 'Vesper'], ['rigger', 'Torque']]) {
    if (only.length && !only.includes(who)) continue;
    await pick(name); await sleep(400);
    for (const mode of ['Build', 'Play']) {
      await click('.mode-opt', mode); await sleep(300);
      for (const t of await tabs()) {
        if (who === 'rigger' && mode === 'Build' && !['Build', 'Gear', 'Augments', 'Settings'].includes(t)) continue;
        if (who === 'mage' && mode === 'Build' && t === 'Settings') continue;
        await click('.tab-btn', t); await sleep(350);
        await shot(`${prefix}-${who}-${mode}-${t.replace(/\W+/g, '')}`, { full: true });
      }
    }
  }
  if (!only.length || only.includes('narrow')) {
    await narrow(true);
    await pick('Torque'); await sleep(300);
    await click('.mode-opt', 'Play'); await sleep(300);
    for (const t of ['Sheet', 'Drones']) { await click('.tab-btn', t); await sleep(350); await shot(`${prefix}-narrow-Play-${t}`, { full: false }); }
    await pick('Vesper'); await sleep(300);
    await click('.mode-opt', 'Build'); await sleep(300);
    for (const t of ['Build', 'Skills']) { await click('.tab-btn', t); await sleep(350); await shot(`${prefix}-narrow-Build-${t}`, { full: false }); }
    await narrow(false);
  }
}
