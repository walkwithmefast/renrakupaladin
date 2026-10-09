// Switchable situational bonuses (v28): Inazuma's Fame: Local "+1 Social limit in your home sprawl" applied from the Sheet.
import { readFileSync } from 'node:fs';

export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const ch = JSON.parse(readFileSync(new URL('../characters/Inazuma 10 12.rp.json', import.meta.url), 'utf8'));
  await q(`(() => { const ch = ${JSON.stringify(ch)}; localStorage.setItem('chummer-remake.v1', JSON.stringify({ chars: { [ch.id]: ch }, order: [ch.id], currentId: ch.id, viewModes: { [ch.id]: 'play' }, settings: { books: null, rules: {} } })); })()`);
  await q('location.reload()'); await sleep(1500);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const social = () => q(`[...document.querySelectorAll('.block')].map(b => b.textContent).join(' ').match(/SOCIAL LIMIT\\s*(\\d+)|Social limit\\s*(\\d+)/i)?.slice(1).find(Boolean)`);
  // the character's saved `activeConditions` decides the toggle's starting state (the user may have really
  // turned it on) - read that instead of assuming "off", so this doesn't false-fail whenever they do.
  const startedOn = await q(`document.querySelector('.cond-toggle')?.classList.contains('on')`);
  const s0 = await social();
  await click('.cond-toggle', 'Social limit'); await sleep(300);
  const s1 = await social();
  const expectOn = !startedOn;
  check(`switching "in your home sprawl" ${expectOn ? 'on' : 'off'}: Social limit ${expectOn ? '+1' : '-1'}`,
    Number(s1) === Number(s0) + (expectOn ? 1 : -1), `${s0} -> ${s1}`);
  check(`the note shows as ${expectOn ? 'applied' : 'not applied'}`,
    expectOn ? !!(await q(`document.querySelector('.cond-toggle.on')?.textContent.includes('home sprawl')`))
      : !(await q(`document.querySelector('.cond-toggle')?.classList.contains('on')`)));
  await shot('conditions-on');
  await q('location.reload()'); await sleep(1500);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('still applied after a reload', Number(await social()) === Number(s1));
  await click('.cond-toggle', 'Social limit'); await sleep(300);
  check('switching it back restores the limit', Number(await social()) === Number(s0));
}
