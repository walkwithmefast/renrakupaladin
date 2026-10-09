// v24: bonded foci in the UI - effect line + limits on the Gear row, Weapon Focus weapon pick -> weapon pool,
// Play Magic spellcasting pool per spell category, weapon pools include Improved Ability.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    ch.info.name = 'Focus Tester';
    ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
    ch.talent = 'Mystic Adept'; ch.mysPP = 2; ch.tradition = 'Hermetic';
    const sk = (n) => D.skills.skills.find((s) => s.name === n).id;
    ch.skills[sk('Spellcasting')] = { p: 4, k: 0, a: 0, spec: '' };
    ch.skills[sk('Blades')] = { p: 3, k: 0, a: 0, spec: '' };
    ch.skills[sk('Pistols')] = { p: 3, k: 0, a: 0, spec: '' };
    const g = (n) => D.gear.gears.find((x) => x.name === n && !x.hide);
    ch.gear.push({ uid: 'pf', id: g('Power Focus').id, name: 'Power Focus', rating: 2, bonded: true });
    ch.gear.push({ uid: 'sf', id: g('Spellcasting Focus, Combat').id, name: 'Spellcasting Focus, Combat', rating: 4, bonded: true });
    ch.gear.push({ uid: 'wf', id: g('Weapon Focus').id, name: 'Weapon Focus', rating: 3, bonded: true });
    const w = (n) => D.weapons.weapons.find((x) => x.name === n);
    ch.weapons.push({ uid: 'kat', id: w('Katana').id, name: 'Katana', equipped: true }, { uid: 'pis', id: w('Ares Predator V').id, name: 'Ares Predator V', equipped: true });
    const sp = (n) => D.spells.spells.find((x) => x.name === n);
    ch.spells.push({ uid: 's1', id: sp('Manabolt').id, name: 'Manabolt' }, { uid: 's2', id: sp('Heal').id, name: 'Heal' });
    const ia = D.powers.powers.find((p) => p.name === 'Improved Ability (skill)');
    ch.powers.push({ uid: 'ia', id: ia.id, name: ia.name, level: 2, choice: { skill: 'Pistols' } });
    localStorage.setItem(KEY, JSON.stringify(st));
    return 'ok';
  })()`));
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Gear'); await sleep(400);
  const rows = await q(`[...document.querySelectorAll('.focus-bond')].map(r => r.textContent).join(' || ')`);
  check('focus rows say what they do', /MAG-linked tests \+2 dice/.test(rows) && /Combat spells \+4 dice/.test(rows) && /attacks with this weapon \+3 dice/.test(rows), rows.slice(0, 300));
  check('Force 9 on Magic 6: addiction risk, not an error', /addiction risk/.test(rows) && !/Over the bonding limit/.test(rows));
  await q(`(() => { const s = document.querySelector('select[aria-label="Which melee weapon is the focus"]'); const o = [...s.options].find(o => o.textContent === 'Katana'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  await shot('focusfx-gear', { full: true });
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Magic'); await sleep(300);
  const pools = await q(`(() => { const r = [...document.querySelectorAll('.tbl tbody tr')]; const get = (n) => r.find(x => x.textContent.includes(n))?.cells[5]?.textContent.trim(); return { manabolt: get('Manabolt'), heal: get('Heal'), tile: document.querySelector('.pool-tile b')?.parentElement.textContent }; })()`);
  console.log(JSON.stringify(pools));
  // Spellcasting 4 + Magic 6 = 10; Manabolt (Combat) + 4 (spell focus beats power focus), Heal (Health) + 2 (power focus)
  check('Manabolt pool 14 (Combat focus), Heal 12 (Power Focus)', /^14/.test(pools.manabolt || '') && /^12/.test(pools.heal || ''), JSON.stringify(pools));
  await shot('focusfx-magic', { full: true });
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const wp = await q(`(() => { const r = [...document.querySelectorAll('tr')]; const pool = (n) => { const row = r.find(x => x.textContent.includes(n)); return row ? [...row.cells].map(c => c.textContent.trim()) : null; }; return { kat: pool('Katana'), pis: pool('Ares Predator V') }; })()`);
  console.log(JSON.stringify(wp));
  check('Katana pool 7 = AGI 1 + Blades 3 + Weapon Focus 3', (wp.kat || []).some((c) => /^\d+/.test(c)) && JSON.stringify(wp.kat).includes('"7","7"'), JSON.stringify(wp.kat));
  check('Predator pool 6 = AGI 1 + Pistols 3 + Improved Ability 2', JSON.stringify(wp.pis).includes('"6"'), JSON.stringify(wp.pis));
}
