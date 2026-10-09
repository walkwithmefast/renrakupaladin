// Leaner mentor-spirit check: patch the Mentor Spirit quality directly into localStorage (skipping the
// giant Qualities picker click-through, which was slow) then verify the picker UI + the actual bonus.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);

  console.log('patched:', await q(`(() => {
    try {
      const KEY = 'chummer-remake.v1';
      const st = JSON.parse(localStorage.getItem(KEY));
      const ch = st.chars[st.currentId];
      ch.qualities.push({ uid: 'mq1', id: 'ced3fecf22', name: 'Mentor Spirit', choice: {} });
      localStorage.setItem(KEY, JSON.stringify(st));
      return 'ok';
    } catch (e) { return 'ERR: ' + e.message; }
  })()`));
  await q(`location.reload()`);
  await sleep(1200);

  await click('.tab-btn', 'Qualities'); await sleep(300);
  console.log('mentor panel present:', await q(`!![...document.querySelectorAll('.panel h3')].find(h=>h.textContent.startsWith('Mentor spirit'))`));

  console.log('select Bear:', await q(`(() => {
    const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Mentor spirit'));
    const sel = p.querySelector('select');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, 'Bear');
    sel.dispatchEvent(new Event('change', {bubbles:true}));
    return sel.value;
  })()`));
  await sleep(200);
  console.log('advantage shown:', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(x=>x.querySelector('h3')?.textContent.startsWith('Mentor spirit')); return p.textContent.includes('resist damage'); })()`));

  await click('.tab-btn', 'Sheet'); await sleep(300);
  console.log('mentor line on Sheet:', await q(`(() => { const m = document.body.innerText.match(/Mentor:[^\\n]*/); return m ? m[0] : 'NOT FOUND'; })()`));
  console.log('Soak pool (BOD1+armor0+Bear2=3):', await q(`(() => { const t = [...document.querySelectorAll('.pool-tile')].find(x=>x.textContent.includes('Soak')); return t ? t.querySelector('b').textContent : 'NOT FOUND'; })()`));

  await shot('mentor2-check', { full: false });
}
