// Drone card: Remote control mode + "Moves by" (which Pilot skill). Run after scenario_drone_page's setup style.
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const rigger = JSON.parse(readFileSync(new URL('../../Dez Calloway (Torque).crm.json', import.meta.url), 'utf8'));
  await q(`(() => { const ch = ${JSON.stringify(rigger)}; ch.mode = 'career'; ch.career = { earned: 0, log: [], nuyenEarned: 0 };
    localStorage.setItem('chummer-remake.v1', JSON.stringify({ chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: { [ch.id]: 'play' }, settings: { books: null, rules: {}, focusPages: { drone: true } } })); })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Drones'); await sleep(400);
  const card = `document.querySelectorAll('.drone-card')[0]`;
  const moves = await q(`${card}.querySelector('.moves').textContent`);
  check('Flying Eye guessed as an aircraft, marked as a guess', /Aircraft \(Pilot Aircraft\)/.test(await q(`${card}.querySelector('.moves select').selectedOptions[0].textContent`)) && /guessed/.test(moves), moves);
  await q(`[...${card}.querySelectorAll('.mode-opt')].find(b => b.textContent === 'Remote').click()`); await sleep(300);
  const tests = await q(`[...${card}.querySelectorAll('.dtest')].map(t => t.querySelector('.lbl').textContent + ': ' + t.querySelector('b').textContent + ' ' + t.querySelector('.formula').textContent).join(' || ')`);
  console.log('   remote tests:', tests);
  check('Remote: Pilot Aircraft + Reaction, limits capped by Data Processing', /Vehicle test: \d+.*Pilot Aircraft \+ Reaction \[Handling, max DP \d\]/.test(tests));
  await q(`(() => { const s = ${card}.querySelector('.moves select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'Walker'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  check('changing Moves by switches the skill and drops "(guessed)"', /Pilot Walker/.test(await q(`${card}.querySelector('.dtest .formula').textContent`)) && !/guessed/.test(await q(`${card}.querySelector('.moves').textContent`)));
  await shot('drone-remote');
}
