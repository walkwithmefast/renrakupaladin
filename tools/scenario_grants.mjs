// v23 choice bonuses, live: Initiation picker with Arts (+ "Needs the Art" reasons), Qi Focus power pick -> free power +
// its effect, focus tradition select, Attribute Boost in Play -> Sheet pool note.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const setSel = (sel, val) => q(`(() => { const s = ${sel}; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(val)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  await click('button', 'Create a new runner'); await sleep(400);
  // a mystic adept (spells + powers + initiation) with a Qi Focus, Attribute Boost and a spellcasting focus
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    ch.info.name = 'Grant Tester';
    ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'D' };
    ch.talent = 'Mystic Adept'; ch.mysPP = 3; ch.tradition = 'Hermetic';
    ch.attrs.AGI.p = 3; ch.initGrade = 2;
    const g = (n) => D.gear.gears.find((x) => x.name === n && !x.hide);
    ch.gear.push({ uid: 'qi', id: g('Qi Focus').id, name: 'Qi Focus', rating: 6, bonded: true });
    ch.gear.push({ uid: 'sf', id: g('Spellcasting Focus, Combat').id, name: 'Spellcasting Focus, Combat', rating: 2 });
    const ab = D.powers.powers.find((p) => p.name === 'Attribute Boost');
    ch.powers.push({ uid: 'ab', id: ab.id, name: ab.name, level: 2, choice: { attr: 'AGI' } });
    localStorage.setItem(KEY, JSON.stringify(st));
    return 'ok';
  })()`));
  await q(`location.reload()`); await sleep(1500);

  // ---- initiation picker
  await click('.tab-btn', 'Magic'); await sleep(300);
  await click('button', 'Metamagic / Art'); await sleep(300);
  const cats = await q(`[...new Set([...document.querySelectorAll('.modal tbody tr')].map(r => r.cells[1] && r.cells[1].textContent))].join(',')`);
  check('picker lists Metamagic, Art and Power enhancement kinds', /Metamagic/.test(cats) && /Art/.test(cats) && /Power enhancement/.test(cats), cats);
  const reason = await q(`(() => { const r = [...document.querySelectorAll('.modal tbody tr')].find(r => r.cells[0].textContent.startsWith('Quickening') && r.cells[1].textContent === 'Metamagic'); return r ? r.textContent : 'no row'; })()`);
  check('Quickening metamagic says it needs the Art', /Needs the Art Quickening/.test(reason), reason);
  await shot('grants-picker');
  await q(`(() => { const r = [...document.querySelectorAll('.modal tbody tr')].find(r => r.cells[0].textContent.startsWith('Quickening') && r.cells[1].textContent === 'Art'); r.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
  await sleep(300);
  await q(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(200);
  check('Art added, tagged', /Quickening · Art/.test(await q(`document.querySelector('#main').textContent`)));

  // ---- Qi Focus: pick the held power on the Gear tab
  await click('.tab-btn', 'Gear'); await sleep(400);
  const opts = await q(`[...document.querySelector('select[aria-label="Holds the power"]').options].map(o => o.textContent).join(' | ')`);
  check('Qi Focus Force 6 offers Improved Reflexes 1, not 2', /Improved Reflexes 1 /.test(opts) && !/Improved Reflexes 2/.test(opts), opts.slice(0, 200));
  const ir = await q(`[...document.querySelector('select[aria-label="Holds the power"]').options].find(o => o.textContent.startsWith('Improved Reflexes')).value`);
  const initBefore = await q(`document.body.textContent.match(/Initiative[^\\d]*(\\d+) \\+ (\\d)D6/)?.[2]`);
  await setSel(`document.querySelector('select[aria-label="Holds the power"]')`, ir); await sleep(300);
  check('tradition select on the spellcasting focus', await q(`!!document.querySelector('select[aria-label="Tradition the focus was made in"]')`));
  await click('.tab-btn', 'Magic'); await sleep(300);
  const free = await q(`document.querySelector('.granted')?.textContent || ''`);
  check('Magic tab lists the free power with its source', /Improved Reflexes 1/.test(free) && /Qi Focus/.test(free), free);
  await shot('grants-magic', { full: true });

  // ---- Attribute Boost in Play
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Magic'); await sleep(300);
  await q(`(() => { const i = document.querySelector('.boost-row input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '3'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(200);
  check('boost button previews AGI +3 for 6 turns', /AGI \+3 for 6 turns/.test(await q(`document.querySelector('.boost-row .primary').textContent`)));
  await click('.boost-row .primary'); await sleep(300);
  check('active boost listed', /6 turns left/.test(await q(`document.querySelector('ul.boosts')?.textContent || ''`)));
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('Sheet AGI tile notes the boost', /\+3 boost → 7 for pools/.test(await q(`document.querySelector('.tile.AGI').textContent`)), await q(`document.querySelector('.tile.AGI').textContent`));
  check('Sheet AGI value itself unchanged (4)', await q(`document.querySelector('.tile.AGI b').textContent`) === '4');
  await click('.tab-btn', 'Magic'); await sleep(300);
  for (let i = 0; i < 6; i++) { await click('button', 'End of Combat Turn'); await sleep(120); }
  check('boost ends with a Drain reminder', /resist 2 Drain/.test(await q(`document.querySelector('[role=status]')?.textContent || ''`)));
}
