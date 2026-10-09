// Fake SIN identity switcher on the Play Sheet (Inazuma 10:12 owns 3 Fake SINs). LOOK_MODE=light for a light shot.
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const ch = JSON.parse(readFileSync(new URL('../characters/Inazuma 10 12.rp.json', import.meta.url), 'utf8'));
  await q(`(() => {
    const ch = ${JSON.stringify(ch)};
    const st = { chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: { [ch.id]: 'play' },
      settings: { books: null, rules: {}, mode: ${JSON.stringify(process.env.LOOK_MODE || 'dark')} } };
    localStorage.setItem('chummer-remake.v1', JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  // "Own identity" used to be a hardcoded literal (#44 fix: it's now the character's real name/alias)
  check('picker says the character\'s own name', /Inazuma 10:12/.test(await q(`document.querySelector('.idpick-btn')?.textContent || ''`)));
  check('real name visible, no card', await q(`!document.querySelector('.sin-card') && document.querySelector('.sheet-head p').textContent.includes('Inazuma 10:12')`));
  await click('.idpick-btn'); await sleep(200);
  const opts = await q(`[...document.querySelectorAll('.idmenu [role=menuitemradio] b')].map(b => b.textContent).join(' | ')`);
  check('menu lists own identity + 3 SINs', opts === 'Inazuma 10:12 | Won Justice | Turmeric Sunrise | John Smithy', opts);
  await shot('sin-menu');
  await click('.idmenu [role=menuitemradio]', 'Won Justice'); await sleep(500);
  check('menu closed after choosing', await q(`!document.querySelector('.idmenu')`));
  check('card shows Won Justice R4', await q(`(() => { const c = document.querySelector('.sheet-head .sin-card'); return !!c && c.textContent.includes('Won Justice') && c.textContent.includes('R4') && c.querySelectorAll('.sin-pips i.on').length === 4; })()`));
  check('real name is blurred under it', await q(`getComputedStyle(document.querySelector('.covered-name .real')).filter.includes('blur')`));
  const box = await q(`(() => { const r = document.querySelector('.covered-name .real').getBoundingClientRect(), c = document.querySelector('.sheet-head .sin-card').getBoundingClientRect(); return [c.left <= r.left + 1, c.right >= r.right - 1, c.top <= r.top + 2, c.bottom >= r.bottom - 2].join(); })()`);
  check('card covers the real name', box === 'true,true,true,true', box);
  check('picker shows the active SIN', /Won Justice/.test(await q(`document.querySelector('.idpick-btn').textContent`)));
  await sleep(1400);
  await shot('sin-on');
  check('stored as play state', await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); const c = st.chars[st.currentId]; return c.play.sin === c.gear.find(g => g.notes === 'Won Justice').uid; })()`));
  await click('.mode-opt', 'Build'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('Build mode: no picker, no cover', await q(`!document.querySelector('.idpick') && !document.querySelector('.sin-card')`));
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('back in Play: still covered', await q(`!!document.querySelector('.sin-card')`));
  // ---- burning the active SIN (v24)
  await click('.idpick-btn'); await sleep(200);
  const row = `[...document.querySelectorAll('.idmenu .idrow')].find(r => r.textContent.includes('Won Justice'))`;
  await q(`${row}.querySelector('.idactions button').click()`); await sleep(200);
  check('burn asks to confirm', /Burn Won Justice\?/.test(await q(`${row}.textContent`)));
  check('not burned before confirming', await q(`!document.querySelector('.sin-card.burned')`));
  await q(`[...${row}.querySelectorAll('.idactions button')].find(b => /Yes, it's burned/.test(b.textContent)).click()`); await sleep(400);
  check('menu row tagged burned, with Un-burn', /burned/i.test(await q(`${row}.textContent`)) && /Un-burn/.test(await q(`${row}.textContent`)));
  check('card still covers the name, with a BURNED stamp', await q(`!!document.querySelector('.sheet-head .sin-card.burned .sin-stamp') && !!document.querySelector('.covered-name .real')`));
  check('ID pill shows burned', /burned/i.test(await q(`document.querySelector('.idpick-btn').textContent`)));
  check('stored on the SIN item', await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); const c = st.chars[st.currentId]; return c.gear.find(g => g.notes === 'Won Justice').burned === true; })()`));
  await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(500);
  await shot('sin-burned');
  await click('.idpick-btn'); await sleep(200);
  await q(`[...${row}.querySelectorAll('.idactions button')].find(b => /Un-burn/.test(b.textContent)).click()`); await sleep(300);
  check('un-burn removes the stamp', await q(`!document.querySelector('.sin-card.burned')`));
  await click('.idmenu [role=menuitemradio]', 'Inazuma 10:12'); await sleep(300);
  check('own identity: cover removed', await q(`!document.querySelector('.sin-card')`));
}
