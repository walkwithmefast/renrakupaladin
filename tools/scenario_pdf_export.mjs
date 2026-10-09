import { resolve } from 'node:path';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const file = resolve('../Chummer5.226.0/saves/autosave/Ten-Twelve Inazuma.chum5');
  const doc = await send('DOM.getDocument', { depth: 1 });
  const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: [file] });
  await sleep(1200);
  await click('.modal button.primary', 'Done'); await sleep(300);

  console.log('PDF button present:', await q(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='PDF')`));

  const outDir = resolve('tmp/pdf-out');
  mkdirSync(outDir, { recursive: true });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: outDir });

  console.log('click PDF:', await q(`(() => { const b = [...document.querySelectorAll('button')].find(x=>x.textContent==='PDF'); if (!b) return 'NOT FOUND'; b.click(); return 'ok'; })()`));
  await sleep(1500);
  console.log('downloaded files:', existsSync(outDir) ? readdirSync(outDir).join(', ') : '(none)');

  console.log('console/page errors:');
}
