export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    ch.pri.talent = 'A'; ch.talent = 'Magician'; ch.tradition = 'Hermetic';
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`);
  await sleep(1200);
  await click('.tab-btn', 'Magic'); await sleep(300);

  console.log('panel present:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Initiation'))`));
  console.log('karma spent before:', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation')); return p.querySelector('.stat b')?.textContent; })()`));

  console.log('bump grade to 2:', await q(`(() => {
    const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation'));
    const input = p.querySelector('.stepper input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`));
  await sleep(200);
  console.log('karma spent after grade 2 (expect 13+16=29):', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation')); return p.querySelectorAll('.stat b')[0]?.textContent; })()`));

  console.log('click + Metamagic:', await q(`(() => {
    const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation'));
    const b = [...p.querySelectorAll('button')].find(x=>x.textContent.includes('+ Metamagic'));
    if (!b) return 'NOT FOUND';
    b.click(); return 'ok';
  })()`));
  await sleep(300);
  console.log('picker item count:', await q(`document.querySelectorAll('.tbl.pick tbody tr').length`));
  console.log('pick Centering:', await q(`(() => { const row = [...document.querySelectorAll('.tbl.pick tbody tr')].find(r=>r.textContent.includes('Centering')); if (!row) return 'NOT FOUND'; row.querySelector('.primary.sm').click(); return 'ok'; })()`));
  await sleep(300);

  console.log('karma spent after 1 metamagic (expect 29+15=44):', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation')); return p.querySelectorAll('.stat b')[0]?.textContent; })()`));
  console.log('known/grade shown:', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation')); return p.querySelectorAll('.stat b')[1]?.textContent; })()`));
  console.log('metamagic listed:', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Initiation')); return p.querySelector('ul li span')?.textContent; })()`));

  await shot('metamagic-check', { full: true });

  // Play mode too
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Magic'); await sleep(300);
  console.log('panel present in Play:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Initiation'))`));
}
