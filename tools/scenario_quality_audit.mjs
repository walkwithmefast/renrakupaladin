// v26 quality audit, live: level stepper, High Pain Tolerance wound marks, In Debt nuyen, Ex-Con's granted SINner,
// Infected's granted critter powers + attribute table, Reputation and Situational rows on the Sheet.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const Q = window.SR5DATA.qualities.qualities;
    const add = (n, extra = {}) => { const d = Q.find((x) => x.name === n); ch.qualities.push({ uid: 'q' + ch.qualities.length, id: d.id, name: d.name, choice: {}, note: '', ...extra }); };
    add('High Pain Tolerance', { level: 2 }); add('In Debt', { level: 3 }); add('Ex-Con'); add('Infected: Ghoul (Human)'); add('Fame: Local'); add('Quick Healer');
    ch.play = { phys: 5, stun: 0 };
    localStorage.setItem(KEY, JSON.stringify(st));
    return 'ok';
  })()`));
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  const pos = await q(`document.querySelector('#main').textContent`);
  check('level stepper on High Pain Tolerance (2)', await q(`[...document.querySelectorAll('.qlevel')].some(s => s.closest('li').textContent.includes('High Pain Tolerance') && s.querySelector('input')?.value === '2')`));
  check('In Debt shows 15,000¥ instead of Karma', /In Debt[\s\S]{0,300}15,000¥/.test(pos));
  check('Ex-Con brings SINner (Criminal), tagged', /SINner \(Criminal\)[\s\S]{0,120}from Ex-Con/.test(pos));
  const critter = await q(`[...document.querySelectorAll('.panel')].find(p => /Critter powers/.test(p.querySelector('h3')?.textContent || ''))?.textContent || ''`);
  check('Infected: Ghoul grants its critter powers', /from Infected: Ghoul/.test(critter), critter.slice(0, 160));
  await shot('qa-qualities', { full: true });
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const marks = await q(`[...document.querySelectorAll('.monitor')][0].querySelectorAll('.wm').length ? [...[...document.querySelectorAll('.monitor')][0].querySelectorAll('.box')].map((b, i) => b.querySelector('.wm') ? i + 1 : null).filter(Boolean).join(',') : ''`);
  check('wound marks shifted by 2 (boxes 5, 8, ...)', marks.startsWith('5,8'), marks);
  const sit = await q(`document.querySelector('.situational')?.textContent || ''`);
  check('Situational: Fame (sprawl) and Quick Healer', /Social limit \+1/.test(sit) && /home sprawl/.test(sit) && /Healing Physical damage \+2/.test(sit), sit.slice(0, 200));
  const rep = await q(`document.querySelector('.reputation')?.textContent || ''`);
  check('Reputation row: Notoriety 1 (SINner Criminal), Public Awareness 2 from Fame: Local', /Notoriety\s*1/.test(rep) && /Public Awareness\s*2/.test(rep), rep);
  await shot('qa-sheet', { full: true });
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const wm = await q(`document.querySelector('.card-head .pip, [class*=wound], .pip')?.textContent`);
  const woundTxt = await q(`[...document.querySelectorAll('.pip')].find(p => /Wound modifier/.test(p.textContent))?.textContent`);
  check('5 Physical with HPT 2 -> wound modifier 1', /Wound modifier\s*−?-?1/.test(woundTxt || ''), woundTxt);
  await q(`[...document.querySelectorAll('.reputation button')].find(b => b.getAttribute('aria-label') === 'Street Cred +1').click()`); await sleep(300);
  check('GM can bump Street Cred in Play', /Street Cred\s*1/.test(await q(`document.querySelector('.reputation').textContent`)));
}
