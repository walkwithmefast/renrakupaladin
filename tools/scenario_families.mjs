// Name families: one picker row per quality family with a variant drop-down; owned qualities switch variant in
// place; knowledge skills "Area Knowledge" / "Corporation" take a pick-or-type descriptor.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const setVal = (sel, v, ev = 'change', proto = 'HTMLSelectElement') => q(`(() => { const e = ${sel}; Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); return e.value; })()`);
  const famRow = (base) => `[...document.querySelectorAll('.pick tbody tr')].find(r => r.querySelector('.famname')?.firstChild?.textContent.trim() === ${JSON.stringify(base)})`;
  await click('button', 'Create a new runner'); await sleep(400);

  // ---- qualities (negative: Allergy family)
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await q(`[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.startsWith('Negative')).querySelector('header button.primary').click()`); await sleep(400);
  const rowsNamed = await q(`[...document.querySelectorAll('.pick tbody tr td:first-child')].filter(td => /^Allergy/.test(td.textContent)).length`);
  check('Allergy is one picker row, not 8', rowsNamed === 1, `${rowsNamed} row(s)`);
  const opts = await q(`[...${famRow('Allergy')}.querySelectorAll('select option')].map(o => o.textContent).join(' | ')`);
  console.log('   variants:', opts);
  const k1 = await q(`${famRow('Allergy')}.querySelectorAll('td')[1].textContent`);
  const target = await q(`[...${famRow('Allergy')}.querySelectorAll('select option')].find(o => /Common, Severe/.test(o.textContent)).value`);
  await setVal(`${famRow('Allergy')}.querySelector('select')`, target); await sleep(200);
  const k2 = await q(`${famRow('Allergy')}.querySelectorAll('td')[1].textContent`);
  check('choosing a variant updates the row Karma', k1 !== k2, `${k1} -> ${k2}`);
  await q(`[...${famRow('Allergy')}.querySelectorAll('button')].find(b => b.textContent === 'Add').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(200);
  const owned = () => q(`(() => { const li = [...document.querySelectorAll('.row-item')].find(l => /Allergy/.test(l.textContent)); if (!li) return null; const s = li.querySelector('select.variant'); return JSON.stringify({ name: li.querySelector('.name').textContent, variant: s && s.selectedOptions[0].textContent, cost: li.querySelector('.cost').textContent }); })()`);
  let o = JSON.parse(await owned());
  check('the chosen variant was added, shown as base + drop-down', o.name === 'Allergy' && /Common, Severe/.test(o.variant), JSON.stringify(o));
  const mild = await q(`[...[...document.querySelectorAll('.row-item')].find(l => /Allergy/.test(l.textContent)).querySelectorAll('select.variant option')].find(x => /Uncommon, Mild/.test(x.textContent)).value`);
  await setVal(`[...document.querySelectorAll('.row-item')].find(l => /Allergy/.test(l.textContent)).querySelector('select.variant')`, mild); await sleep(300);
  const o2 = JSON.parse(await owned());
  check('switching the owned variant in place changes its Karma', /Uncommon, Mild/.test(o2.variant) && o2.cost !== o.cost, `${o.cost} -> ${o2.cost}`);
  // a plain text <input>'s onChange needs the native 'input' event to fire reliably here (unlike a <select>,
  // where 'change' is enough) - setVal's default 'change' silently no-ops on it, which used to make this and
  // the "descriptor stays editable" check below false-fail.
  await setVal(`[...document.querySelectorAll('.row-item')].find(l => /Allergy/.test(l.textContent)).querySelector('input.note')`, 'Peanuts', 'input', 'HTMLInputElement'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('the label shows on the Sheet', await q(`document.body.innerText.includes('Allergy (Uncommon, Mild)') && document.body.innerText.includes('Peanuts')`));

  // ---- knowledge skills
  await click('.tab-btn', 'Skills'); await sleep(300);
  const opt = await q(`[...document.querySelectorAll('#know-suggest option')].map(o => o.value).filter(v => /Area Knowledge|Corporation/.test(v)).join(' | ')`);
  check('suggestions list each family once', opt === 'Area Knowledge' || opt === 'Area Knowledge | Corporation' || opt === 'Corporation | Area Knowledge', opt);
  await setVal(`document.querySelector('.addrow input[list="know-suggest"]')`, 'Area Knowledge', 'input', 'HTMLInputElement'); await sleep(200);
  check('a "which one?" box appears', await q(`!!document.querySelector('.addrow input[aria-label="Area Knowledge: which one"]')`));
  console.log('   its choices:', await q(`[...document.getElementById(document.querySelector('.addrow input[aria-label="Area Knowledge: which one"]').getAttribute('list')).options].slice(0, 5).map(o => o.value).join(', ')`));
  await setVal(`document.querySelector('.addrow input[aria-label="Area Knowledge: which one"]')`, 'Boston', 'input', 'HTMLInputElement'); await sleep(200);
  await click('.addrow button', 'Add'); await sleep(300);
  const saved = () => q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].know.map(k => k.name).join(', ')`);
  check('custom descriptor added', (await saved()) === 'Area Knowledge: Boston', await saved());
  await shot('families-know');
  await setVal(`document.querySelector('.knowgrid input.variant')`, 'Seattle', 'input', 'HTMLInputElement'); await sleep(300);
  check('the descriptor stays editable on the skill', (await saved()) === 'Area Knowledge: Seattle', await saved());
}
