// Settings PDF-folder override -> link -> Edge's PDF viewer lands on the right page (Kill Code item).
import { resolve } from 'node:path';
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner');
  await sleep(300);
  await click('.tab-btn', 'Settings');
  await sleep(300);
  const folder = resolve('../Shadowrun 5e'); // a Windows path, as a user would paste it
  await q(`(() => { const i = [...document.querySelectorAll('input')].find(x => (x.placeholder||'').includes('Shadowrun')); i.value = ${JSON.stringify(folder)}; i.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await sleep(300);
  console.log('now looking in:', await q(`[...document.querySelectorAll('code')].map(c=>c.textContent).join(' | ')`));
  console.log('test link:', await q(`document.querySelector('a.src.big').href`));
  // pick a Kill Code item that the data says is on a specific page and open it via the app's link builder
  const item = await q(`(() => { const g = SR5DATA.gear.gears.find(x => x.source === 'KC' && x.page && !x.hide); return {name: g.name, page: g.page}; })()`);
  console.log('KC item:', JSON.stringify(item));
  const url = await q(`(() => { const s = [...document.querySelectorAll('a')]; const b = window.SR5BOOKS.KC; const base = document.querySelector('a.src.big').href.split('Shadowrun%205th')[0]; return base + encodeURIComponent(b.file) + '#page=' + (${item.page} + b.offset); })()`);
  console.log('opening:', url);
  await send('Page.navigate', { url });
  await sleep(9000);
  await shot('pdf-kc');
}
