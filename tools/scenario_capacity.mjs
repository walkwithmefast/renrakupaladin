// Augments: install Low-Light Vision in Cybereyes -> capacity chip, Essence back.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => { const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const C = window.SR5DATA.cyberware.cyberwares;
    const eyes = C.find(c => c.name === 'Cybereyes Basic System'), llv = C.find(c => c.name === 'Low-Light Vision');
    ch.cyberware.push({ uid: 'e', id: eyes.id, name: eyes.name, rating: 2 }, { uid: 'l', id: llv.id, name: llv.name });
    localStorage.setItem(KEY, JSON.stringify(st)); })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Augments'); await sleep(400);
  const ess = () => q(`document.querySelector('.ess-num b').textContent`);
  const e0 = await ess();
  check('parent shows its capacity', (await q(`document.querySelector('.cappip')?.textContent`)) === 'Capacity 0/8');
  await q(`(() => { const s = document.querySelector('.capsel select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'e'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  const e1 = await ess();
  check('installing Low-Light Vision: capacity 2/8 and 0.1 Essence back', (await q(`document.querySelector('.cappip').textContent`)) === 'Capacity 2/8' && Math.round((Number(e1) - Number(e0)) * 100) === 10, `${e0} -> ${e1}`);
  await shot('capacity');
}
