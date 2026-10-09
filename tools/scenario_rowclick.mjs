// Picker rows: clicking a row opens the Inspector for it; the Add button and book links don't.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const st = () => q(`JSON.stringify({ picker: !!document.querySelector('.modal-back'), drawer: document.querySelector('.drawer h3')?.textContent || null,
    shown: document.querySelector('.pick tr.shown td')?.textContent || null, infoBtns: document.querySelectorAll('.modal-back button[title="Show details"]').length,
    owned: JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].qualities.length })`);
  const row = (n) => `document.querySelectorAll('.pick tbody tr')[${n}]`;
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('open:', await st());
  await q(`${row(1)}.querySelector('td').click()`); await sleep(300);
  console.log('click name cell of row 2:', await st());
  await q(`${row(3)}.querySelectorAll('td')[1].click()`); await sleep(300);
  console.log('click karma cell of row 4:', await st());
  await shot('rowclick');
  await q(`(() => { const a = ${row(5)}.querySelector('a'); if (a) { a.addEventListener('click', (e) => e.preventDefault(), { once: true }); a.click(); } return !!a; })()`); await sleep(300);
  console.log('click book link of row 6 (drawer unchanged):', await st());
  await q(`[...${row(9)}.querySelectorAll('button')].find(b => b.textContent === 'Add').click()`); await sleep(400);
  console.log('click Add on row 10 (Ambidextrous, adds + closes):', await st());
  const overlap = await q(`(() => { const m = document.querySelector('.modal').getBoundingClientRect(), d = document.querySelector('.drawer').getBoundingClientRect(); return JSON.stringify({ modalRight: Math.round(m.right), drawerLeft: Math.round(d.left) }); })()`);
  console.log('picker beside drawer:', overlap);
  await shot('rowclick-beside');
}
