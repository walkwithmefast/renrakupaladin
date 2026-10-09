export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);

  console.log('panel present:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Martial arts'))`));
  console.log('click + Add:', await q(`(() => {
    const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Martial arts'));
    p.querySelector('button.primary').click(); return 'ok';
  })()`));
  await sleep(300);
  console.log('pick Aikido:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r=>r.textContent.includes('Aikido')); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return 'ok'; })()`));
  await sleep(300);
  console.log('style row present, cost shown (expect 7 K):', await q(`document.querySelector('.martial-style .cost')?.textContent`));

  console.log('click + technique:', await q(`(() => { const b = [...document.querySelectorAll('.martial-style .mods button')].find(x=>x.textContent.includes('+ technique')); b.click(); return 'ok'; })()`));
  await sleep(300);
  console.log('technique picker items (should only be Aikido-valid ones):', await q(`[...document.querySelectorAll('.tbl.pick tbody tr td')].filter((td,i)=>i%3===0).slice(0,10).map(td=>td.textContent).join(', ')`));
  console.log('pick Throw Person:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r=>r.textContent.includes('Throw Person')); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return 'ok'; })()`));
  await sleep(300);
  console.log('technique chip shown:', await q(`document.querySelector('.martial-style .chip.on')?.textContent.trim()`));
  console.log('cost still 7 (1 of 2 free techniques used):', await q(`document.querySelector('.martial-style .cost')?.textContent`));

  await shot('martialarts-check', { full: true });
}
