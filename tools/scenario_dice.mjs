// Verify the dice roller: roll a skill pool, see hits/glitch, spend Edge on Push the Limit / Second Chance.
import { resolve } from 'node:path';
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const file = resolve('../Chummer5.226.0/saves/autosave/Ten-Twelve Inazuma.chum5');
  const doc = await send('DOM.getDocument', { depth: 1 });
  const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: [file] });
  await sleep(1200);
  await click('.modal button.primary', 'Done'); await sleep(300);
  await click('.mode-opt', 'Play'); await sleep(400);
  await click('.tab-btn', 'Sheet'); await sleep(300);

  console.log('Hacking skill roll button present:', await q(`(() => { const row = [...document.querySelectorAll('.sk-row')].find(r=>r.textContent.includes('Hacking')); return row ? !!row.querySelector('.rollbtn') : 'NO ROW'; })()`));
  console.log('click roll on Hacking:', await q(`(() => { const row = [...document.querySelectorAll('.sk-row')].find(r=>r.textContent.includes('Hacking')); row.querySelector('.rollbtn').click(); return 'ok'; })()`));
  await sleep(300);
  console.log('modal title:', await q(`document.querySelector('.modal h3')?.textContent`));
  console.log('pool shown:', await q(`document.querySelector('.roll-pool b')?.textContent`));
  console.log('edge available shown:', await q(`document.querySelector('.roll-pool .pip')?.textContent`));

  console.log('click Roll:', await click('.roll-body .primary', 'Roll'));
  await sleep(200);
  console.log('dice shown:', await q(`[...document.querySelectorAll('.die')].map(d=>d.textContent).join(',')`));
  console.log('hits line:', await q(`document.querySelector('.roll-verdict .hits')?.textContent`));
  console.log('edge before push:', await q(`document.querySelector('.roll-pool .pip')?.textContent`));

  console.log('click Push the Limit:', await q(`(() => { const b = [...document.querySelectorAll('.roll-actions button')].find(x=>x.textContent.includes('Push the Limit')); if (!b) return 'NOT FOUND'; b.click(); return 'ok'; })()`));
  await sleep(200);
  console.log('dice after push (should be pool+Edge, possibly more w/ explosions):', await q(`[...document.querySelectorAll('.die')].map(d=>d.textContent).join(',')`));
  console.log('edge after push (should be one less):', await q(`document.querySelector('.roll-pool .pip')?.textContent`));

  console.log('click Second Chance:', await q(`(() => { const b = [...document.querySelectorAll('.roll-actions button')].find(x=>x.textContent.includes('Second Chance')); if (!b) return 'NOT FOUND (edge may be 0)'; b.click(); return 'ok'; })()`));
  await sleep(200);
  console.log('edge after second chance:', await q(`document.querySelector('.roll-pool .pip')?.textContent`));

  await q(`document.querySelector('.modal button[aria-label="close"]')?.click()`);
  await sleep(200);

  // check Edge log on the Condition/Edge panel reflects the spends
  console.log('Edge log shows Push/Second entries:', await q(`(() => { const t = document.body.innerText; return /Push the Limit/.test(t) && /Second Chance/.test(t); })()`));

  // roll a weapon pool too, and a Soak pool tile
  console.log('weapon roll button present:', await q(`!!document.querySelector('.weapons .rollbtn')`));
  console.log('soak pool-tile roll button present:', await q(`(() => { const t = [...document.querySelectorAll('.pool-tile')].find(x=>x.textContent.includes('Soak')); return t ? !!t.querySelector('.rollbtn') : 'NO TILE'; })()`));

  await shot('dice-roller', { full: false });
}
