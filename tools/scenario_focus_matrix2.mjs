import { resolve } from 'node:path';
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Settings'); await sleep(300);
  const toggles = await q(`[...document.querySelectorAll('.focus-toggle input')].length`);
  for (let i = 0; i < toggles; i++) {
    await q(`document.querySelectorAll('.focus-toggle input')[${i}].click()`);
    await sleep(150);
  }
  console.log('focusPages after toggling:', await q(`JSON.parse(localStorage.getItem('chummer-remake.v1') || '{}').settings?.focusPages`));

  const file = resolve('../Dez Calloway (Torque).crm.json');
  const doc = await send('DOM.getDocument', { depth: 1 });
  const n = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: n.result.nodeId, files: [file] });
  await sleep(1000);
  await click('.modal button.primary', 'Done'); await sleep(300);
  await click('.mode-opt', 'Play'); await sleep(400);

  console.log('play tabs:', await q(`[...document.querySelectorAll('.tab-btn')].map(b=>JSON.stringify(b.textContent)).join(' | ')`));
  console.log('exact click on Matrix tab:', await q(`(() => {
    const b = [...document.querySelectorAll('.tab-btn')].find(x => x.textContent.trim() === 'Matrix');
    if (!b) return 'NOT FOUND';
    b.click(); return 'ok';
  })()`));
  await sleep(300);
  console.log('panel titles:', await q(`[...document.querySelectorAll('.panel h3')].map(h=>h.textContent).join(' | ')`));
  await shot('focus-matrix2', { full: true });
}
