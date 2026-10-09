// v23 Matrix deck card on Play -> Matrix (Inazuma 10:12, Renraku Tsurugi, 3 slots): load by click and by drag, full deck
// blocks, eject, program stat boosts, swap two attributes, Matrix damage boxes, compact Overwatch strip; Build Programs.
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const ch = JSON.parse(readFileSync(new URL('../characters/Inazuma 10 12.rp.json', import.meta.url), 'utf8'));
  await q(`(() => {
    const ch = ${JSON.stringify(ch)};
    const st = { chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: { [ch.id]: 'play' }, settings: { books: null, rules: {} } };
    localStorage.setItem('chummer-remake.v1', JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Matrix'); await sleep(300);
  const tiles = () => q(`[...document.querySelectorAll('.asdf-tile b')].map(b => b.textContent).join(',')`);
  const slots = () => q(`[...document.querySelectorAll('.slot.filled .slot-name')].map(s => s.textContent).join(',')`);
  const chip = (name) => `[...document.querySelectorAll('.libchip')].find(c => c.querySelector('b').textContent === ${JSON.stringify(name)})`;
  check('no "Your devices" panel, one Matrix card', await q(`![...document.querySelectorAll('.panel h3')].some(h => /Your devices/.test(h.textContent)) && document.querySelectorAll('.deck').length === 1`));
  check('3 empty slots', await q(`document.querySelectorAll('.slot.empty').length`) === 3);
  check('tiles start 6,5,5,3', await tiles() === '6,5,5,3', await tiles());
  check('Data Trails program gets a description line', /file/i.test(await q(`${chip('Nuke-from-Orbit')}.querySelector('small').textContent`)));

  await q(`${chip('Armor')}.click()`); await sleep(250);
  check('Armor loaded by click', await slots() === 'Armor', await slots());
  check('resist Matrix pool = DR3 + F3 + 2', await q(`[...document.querySelectorAll('.deck-lines > span')][1].querySelector('b').textContent`) === '8');
  await q(`${chip('Toolbox')}.click()`); await sleep(250);
  check('Toolbox raises Data Processing to 6 (boosted)', await tiles() === '6,5,6,3' && await q(`document.querySelectorAll('.asdf-tile b.boosted').length`) === 1, await tiles());
  // drag Encryption onto the card
  await q(`(() => { const dt = new DataTransfer(); const c = ${chip('Encryption')}; c.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    const deck = document.querySelector('.deck'); deck.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); deck.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
  await sleep(300);
  check('Encryption loaded by drag: Firewall 4', (await slots()).includes('Encryption') && (await tiles()) === '6,5,6,4', `${await slots()} / ${await tiles()}`);
  check('deck full: 3/3, library chips disabled', await q(`document.querySelector('.slots-wrap .pip').textContent.replace(/\\s/g,'')`) === '3/3' && await q(`[...document.querySelectorAll('.libchip')].every(c => c.disabled)`));
  await shot('deck-full', { full: true });
  await q(`document.querySelector('.slot.filled .eject').click()`); await sleep(250);
  check('eject frees a slot', await q(`document.querySelectorAll('.slot.empty').length`) === 1 && !(await slots()).includes('Encryption'), await slots());

  // swap Attack (6) and Firewall (3 base, +1 Encryption)
  await click('.asdf-tile', 'Attack'); await sleep(150);
  check('first tile shows as picked', await q(`document.querySelector('.asdf-tile.picked .lbl').textContent`) === 'Attack');
  await click('.asdf-tile', 'Firewall'); await sleep(250);
  check('swap: Attack 3, Firewall 6', await tiles() === '3,5,6,6', await tiles());

  await q(`document.querySelectorAll('.deck .monitor .box')[2].click()`); await sleep(250);
  check('Matrix damage 3 marked', /3\/10/.test(await q(`document.querySelector('.deck .monitor .lbl').textContent`)));
  check('stored as play state', await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); const c = st.chars[st.currentId]; return Object.values(c.play.matrixDmg || {})[0] === 3; })()`));

  await q(`(() => { const i = document.querySelector('.mark-add input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Stuffer Shack host'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(150);
  await click('.mark-add button'); await sleep(200);
  await click('.ow-clock button', '+3'); await sleep(200);
  check('compact strip: mark chip + OS 3', /Stuffer Shack/.test(await q(`document.querySelector('.mark-chip')?.textContent || ''`)) && await q(`document.querySelector('.ow-clock .os-readout b').textContent`) === '3');
  await shot('deck-after', { full: true });

  await click('.mode-opt', 'Build'); await sleep(300);
  await click('.tab-btn', 'Gear'); await sleep(300);
  await click('.subtab, .tab-btn, button', 'Programs'); await sleep(300);
  check('Build Programs subtab has the deck card', await q(`!!document.querySelector('.deck') && document.querySelectorAll('.libchip').length > 0`));
  check('Build program list shows where each runs', await q(`[...document.querySelectorAll('td.dim')].some(t => t.textContent === 'Renraku Tsurugi')`));
}
