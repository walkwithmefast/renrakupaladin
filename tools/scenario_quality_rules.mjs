// v27 quality rules, live: Way discount checkbox, Hedge Witch spell restriction in the picker, Infected optional power
// purchase, Dead SIN's items, Dealer Connection classes, Overclocker on the deck card.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const panel = (re) => `[...document.querySelectorAll('.panel')].find(p => ${re}.test(p.querySelector('h3')?.textContent || ''))`;
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'B' };
    ch.talent = 'Mystic Adept'; ch.mysPP = 3; ch.tradition = 'Hermetic';
    const Q = (n) => D.qualities.qualities.find((x) => x.name === n);
    const add = (n, extra = {}) => { const d = Q(n); ch.qualities.push({ uid: 'q' + ch.qualities.length, id: d.id, name: d.name, choice: {}, note: '', ...extra }); };
    add("The Warrior's Way"); add('Hedge Witch/Wizard', { choice: { category: 'Combat' } }); add('Infected: Goblin'); add('Overclocker');
    add('Dealer Connection');
    const cs = D.powers.powers.find((p) => p.name === 'Critical Strike');
    ch.powers.push({ uid: 'p1', id: cs.id, name: cs.name, level: 1, choice: { skill: 'Blades' } });
    ch.gear.push({ uid: 'deck', id: D.gear.gears.find((g) => g.name === 'Renraku Tsurugi').id, name: 'Renraku Tsurugi' });
    localStorage.setItem(KEY, JSON.stringify(st));
    return 'ok';
  })()`));
  await q(`location.reload()`); await sleep(1500);
  // Way discount
  await click('.tab-btn', 'Magic'); await sleep(300);
  const pp = async () => ((await q(`${panel('/Adept powers/')}.textContent`)).match(/Power points ([\d.]+)/) || [])[1];
  const pp0 = await pp();
  check('Way discounts pip shown', /Way discounts 0\/3/.test(await q(`${panel('/Adept powers/')}.textContent`)));
  await q(`${panel('/Adept powers/')}.querySelector('.way-check input').click()`); await sleep(300);
  const pp1 = await pp();
  check('Critical Strike 0.5 -> 0.25 PP with the Way', pp0 === '0.5' && pp1 === '0.25', `${pp0} -> ${pp1}`);
  // spell restriction
  check('hint: only Combat spells', /Hedge Witch\/Wizard: only Combat spells/.test(await q(`${panel('/Spells/')}.textContent`)));
  await q(`${panel('/Spells/')}.querySelector('button.primary').click()`); await sleep(400);
  await q(`(() => { const i = document.querySelector('.modal input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Heal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  const heal = await q(`[...document.querySelectorAll('.modal tbody tr')].find(r => r.cells[0].textContent.startsWith('Heal'))?.textContent || ''`);
  check('Heal flagged in the picker', /only Combat spells/.test(heal), heal.slice(0, 80));
  await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(200);
  // optional power
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await q(`${panel('/Critter powers/')}.querySelector('button.primary').click()`); await sleep(400);
  const rows = (await q(`[...document.querySelectorAll('.modal tbody tr')].map(r => r.textContent).slice(0, 40).join(' || ')`)).replace(/\s+/g, ' ');
  check('optional powers list with Karma (Enhanced Senses (Smell) 3)', /Enhanced Senses \(Smell\).*?3/.test(rows), rows.slice(0, 200));
  const karmaLeft = async () => ((await q(`document.querySelector('.side').textContent`)).match(/Karma\s*(-?\d+)/) || [])[1];
  const k0 = await karmaLeft();
  await q(`[...document.querySelectorAll('.modal tbody tr')].find(r => r.textContent.includes('Enhanced Senses (Smell)')).querySelector('button').click()`); await sleep(400);
  await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(300);
  const k1 = await karmaLeft();
  check('bought: listed, costs 3 Karma', /bought, 3 K/.test(await q(`${panel('/Critter powers/')}.textContent`)) && Number(k0) - Number(k1) === 3, `${k0} -> ${k1}`);
  // Dealer Connection: pick Drones
  await q(`[...document.querySelectorAll('.dealer-pick label')].find(l => l.textContent.includes('Drones')).querySelector('input').click()`); await sleep(300);
  check('Dealer Connection class stored', await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); return JSON.stringify(st.chars[st.currentId].qualities.find(q => q.name === 'Dealer Connection').choice.classes); })()`) === '["Drones"]');
  // Dead SIN adds its gear
  await q(`${panel('/Negative/')}.querySelector('button.primary').click()`); await sleep(400);
  await q(`(() => { const i = document.querySelector('.modal input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Dead SIN'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  await q(`[...document.querySelectorAll('.modal tbody tr')].find(r => r.cells[0].textContent.startsWith('Dead SIN')).querySelector('button').click()`); await sleep(400);
  await q(`[...document.querySelectorAll('.modal button')].find(b => /anyway/i.test(b.textContent))?.click()`); await sleep(300);
  await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(300);
  const sinGear = await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); const c = st.chars[st.currentId]; return c.gear.filter(g => /From Dead SIN/.test(g.notes || '')).map(g => g.name + ' R' + g.rating).join(', '); })()`);
  check('Dead SIN brings a R3 Fake SIN + 4 licenses', /Fake SIN R3/.test(sinGear) && (sinGear.match(/Fake License R3/g) || []).length === 4, sinGear);
  await shot('qr-qualities', { full: true });
  // Overclocker
  await click('.tab-btn', 'Gear'); await sleep(300);
  await click('button', 'Programs'); await sleep(300);
  await q(`(() => { const s = document.querySelector('select[aria-label="Overclocked attribute"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 's'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  const tiles = await q(`[...document.querySelectorAll('.asdf-tile b')].map(b => b.textContent).join(',')`);
  check('Overclocker: Sleaze 5 -> 6', tiles === '6,6,5,3', tiles);
}
