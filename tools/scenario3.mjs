// Magician build, persistence across reload, finish creation -> career, book links.
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const side = () => q(`[...document.querySelectorAll('.side .srow')].map(r => r.innerText.replace(/\\n/g,' ')).join(' | ')`);
  const setSelect = (sel, val, n = 0) => q(`(() => { const s = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if(!s) return 'no select'; s.value = ${JSON.stringify(val)}; s.dispatchEvent(new Event('change', {bubbles:true})); return s.value; })()`);
  const tab = async (t) => { await click('.tab-btn', t); await sleep(250); };
  const prio = (row, col) => click(`.prio tr:nth-child(${row}) td:nth-child(${col + 1}) .cell`);

  await click('button', 'Create a new runner');
  await sleep(300);
  await prio(4, 1);   // heritage D  (human/elf)
  await prio(1, 2);   // talent A
  await prio(2, 3);   // attributes B
  await prio(3, 4);   // skills C
  await prio(5, 5);   // resources E
  await sleep(200);
  console.log('metatype', await setSelect('.two-col select', 'Elf'));
  console.log('talent', await setSelect('.two-col select', 'Magician', 2));
  await sleep(300);
  await shot('m1-build');
  console.log('chips', await q(`document.querySelectorAll('.chips-box .chip').length`));
  await q(`[...document.querySelectorAll('.chips-box .chip')].filter(c => ['Spellcasting','Conjuring'].includes(c.textContent.trim())).forEach(c => c.click())`);
  await sleep(200);
  await tab('Magic');
  await click('.panel button.primary', '+ Add spell');
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.modal input.search'); i.value='fireball'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(200);
  await click('.modal button.primary', 'Add');
  await click('.modal button.ghost');
  await sleep(200);
  await shot('m2-magic');
  console.log('SIDE:', await side());
  console.log('book link:', await q(`(document.querySelector('a.src')||{}).href`));

  // reload -> character should persist
  await send('Page.reload');
  await sleep(1500);
  console.log('after reload has runner:', await q(`!!document.querySelector('.side')`), await side());

  // finish creation -> career
  await q(`window.confirm = () => true`);
  await click('button', 'Finish creation');
  await sleep(400);
  console.log('mode:', await q(`document.querySelector('.mode').textContent`));
  await tab('Skills');
  await q(`(() => { const row=[...document.querySelectorAll('.skrow')].find(r=>r.querySelector('.linkname')&&r.querySelector('.linkname').textContent.trim()==='Spellcasting'); row.querySelectorAll('.dot')[0].click(); })()`);
  await sleep(200);
  console.log('career SIDE (no karma yet -> negative expected):', await side());
  await click('.side button.primary', '+ Karma');
  await sleep(200);
  console.log('after +5 karma:', await side());
  await shot('m3-career');
}
