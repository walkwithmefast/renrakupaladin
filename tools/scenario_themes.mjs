// Every theme x mode on two representative pages (the rigger's Play Sheet, the mage's Build page), plus Settings.
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));
const THEMES = ['matrix', 'renraku', 'awakened', 'neon', 'chrome', 'terminal'];

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const mage = load('Vesper Ashgrove.crm.json');
  const rigger = load('Dez Calloway (Torque).crm.json');
  const setup = (theme, mode, current) => q(`(() => {
    const mage = ${JSON.stringify(mage)}, rigger = ${JSON.stringify(rigger)};
    rigger.mode = 'career'; rigger.career = { earned: 6, log: [], nuyenEarned: 90000 }; rigger.nuyenAdjust = 0;
    const st = { chars: { [mage.id]: mage, [rigger.id]: rigger }, order: [mage.id, rigger.id], currentId: ${JSON.stringify(current)} === 'mage' ? mage.id : rigger.id,
      viewModes: { [rigger.id]: 'play', [mage.id]: 'build' }, settings: { books: null, rules: {}, focusPages: { drone: true, magic: true }, theme: ${JSON.stringify(theme)}, mode: ${JSON.stringify(mode)} } };
    localStorage.setItem('chummer-remake.v1', JSON.stringify(st));
    localStorage.setItem('crm.tab.play', 'sheet'); localStorage.setItem('crm.tab.build', 'build');
  })()`);
  for (const mode of ['dark', 'light']) {
    for (const t of THEMES) {
      await setup(t, mode, 'rigger'); await q(`location.reload()`); await sleep(900);
      await shot(`th-${mode}-${t}-play`);
      await setup(t, mode, 'mage'); await q(`location.reload()`); await sleep(900);
      await shot(`th-${mode}-${t}-build`);
    }
  }
  await setup('matrix', 'system', 'mage'); await q(`location.reload()`); await sleep(900);
  await click('.tab-btn', 'Settings'); await sleep(300);
  await shot('th-settings');
}
