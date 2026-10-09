export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => { const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId]; const D = window.SR5DATA;
    const drone = D.vehicles.vehicles.find(v => v.name === 'Ocular Drone');
    ch.vehicles.push({ uid: 've1', id: drone.id, name: drone.name, mods: [] });
    localStorage.setItem(KEY, JSON.stringify(st)); })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Gear'); await sleep(400);
  await click('.tab-btn', 'Weapons, armor & gear'); await sleep(300);
  const opened = await q(`(() => { const link = [...document.querySelectorAll('.linkname')].find(b => b.textContent.includes('Ocular Drone')); if (link) { link.click(); return 'opened inspector'; } return 'not found'; })()`);
  await sleep(400);
  console.log('inspector:', opened);
  const buttonTexts = await q(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean)`);
  console.log('buttons visible:', JSON.stringify(buttonTexts));
  const modAddBtn = await q(`(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('mod')); return btn ? (btn.click(), 'clicked: ' + btn.textContent) : 'no mod button found'; })()`);
  console.log(modAddBtn);
  await sleep(400);
  const pick = await q(`(() => { const nameTd = [...document.querySelectorAll('td')].find((td) => td.textContent.trim() === 'Customized (Drone)'); if (!nameTd) return 'not in picker'; const tr = nameTd.closest('tr'); const addBtn = [...tr.querySelectorAll('button')].find((b) => /add/i.test(b.textContent)); if (addBtn) { addBtn.click(); return 'clicked Add button'; } tr.click(); return 'clicked row (no Add button found)'; })()`);
  console.log(pick);
  await sleep(500);
  await q(`(() => { const closeBtns = [...document.querySelectorAll('button')].filter((b) => /close|done|✕/i.test(b.textContent) || b.getAttribute('aria-label') === 'Close'); })()`);
  const bodyText = await q(`document.body.innerText`);
  const idx = bodyText.indexOf('Customized (Drone)');
  console.log('CONTEXT after picking:', JSON.stringify(idx === -1 ? 'not found on page after pick' : bodyText.slice(idx, idx + 150)));
  // the drone's mod list / total nuyen line
  const nuyenLine = bodyText.match(/Nuyen:[^\n]*/)?.[0];
  console.log('NUYEN LINE:', nuyenLine);
}
