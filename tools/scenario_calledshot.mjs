import { resolve } from 'node:path';
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const file = resolve('../Chummer5.226.0/saves/autosave/Ten-Twelve Inazuma.chum5');
  const doc = await send('DOM.getDocument', { depth: 1 });
  const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: [file] });
  await sleep(1200);
  await click('.modal button.primary', 'Done'); await sleep(300);
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);

  console.log('open weapon roll:', await q(`(() => { const b = document.querySelector('.weapons .rollbtn'); if (!b) return 'NOT FOUND'; b.click(); return 'ok'; })()`));
  await sleep(300);
  console.log('pool before called shot:', await q(`document.querySelector('.roll-pool b')?.textContent`));
  console.log('called shot checkbox present:', await q(`!!document.querySelector('.roll-body .check input[type=checkbox]')`));
  console.log('check called shot:', await q(`(() => { const c = document.querySelector('.roll-body .check input[type=checkbox]'); c.click(); return c.checked; })()`));
  await sleep(150);
  console.log('pool after called shot (-4):', await q(`document.querySelector('.roll-pool b')?.textContent`));
  console.log('pool small text:', await q(`document.querySelector('.roll-pool small')?.textContent`));
  console.log('rulebook link present:', await q(`!!document.querySelector('.roll-body .check a')`));

  // a non-attack pool (e.g. Composure) should NOT show the checkbox at all
  await q(`document.querySelector('.modal button[aria-label="close"]')?.click()`);
  await sleep(200);
  console.log('open Composure roll:', await q(`(() => { const t = [...document.querySelectorAll('.pool-tile')].find(x=>x.textContent.includes('Composure')); t.querySelector('.rollbtn').click(); return 'ok'; })()`));
  await sleep(300);
  console.log('called shot checkbox present on Composure (should be false):', await q(`!!document.querySelector('.roll-body .check input[type=checkbox]')`));

  await shot('calledshot-check', { full: false });
}
