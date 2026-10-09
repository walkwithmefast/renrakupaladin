// Qualities/powers: pick-a-skill select on Aptitude, attribute select on Improved Physical Attribute,
// Situational line on the Sheet for City Slicker.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => { const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const D = window.SR5DATA;
    const Q = D.qualities.qualities, P = D.powers.powers, S = D.skills.skills;
    ch.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' }; ch.talent = 'Adept';
    ch.skills[S.find(s => s.name === 'Pistols').id] = { p: 3, k: 0, a: 0 };
    for (const n of ['Aptitude', 'City Slicker']) { const d = Q.find(x => x.name === n); ch.qualities.push({ uid: n, id: d.id, name: d.name }); }
    const ipa = P.find(x => x.name === 'Improved Physical Attribute'); ch.powers.push({ uid: 'ipa', id: ipa.id, name: ipa.name, level: 1 });
    localStorage.setItem(KEY, JSON.stringify(st)); })()`);
  await q(`location.reload()`); await sleep(1500);
  const setSel = (sel, v) => q(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); if (!s) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await click('.tab-btn', 'Qualities'); await sleep(400);
  check('Aptitude has a skill picker', await setSel('select.choicesel', 'Pistols')); await sleep(300);
  check('pick is kept', (await q(`document.querySelector('select.choicesel').value`)) === 'Pistols');
  await shot('choices-qualities');
  await click('.tab-btn', 'Magic'); await sleep(400);
  const agi = () => q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].powers[0].choice?.attr`);
  check('IPA has an attribute picker', await setSel('select.choicesel[aria-label*="attribute"]', 'AGI')); await sleep(800);
  await shot('choices-powers');
  await click('.tab-btn', 'Sheet'); await sleep(400);
  const sit = await q(`document.querySelector('.situational')?.textContent || ''`);
  check('Sheet shows situational City Slicker bonuses', /Situational/.test(sit) && /Urban/.test(sit), sit.slice(0, 120));
  await shot('choices-sheet');
}
