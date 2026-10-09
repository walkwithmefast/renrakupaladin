// Why are so many qualities unavailable to a fresh character? Tally the reasons and sample the requirement blocks.
export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await q(`(() => { const b = document.querySelector('.hide-unavail input'); if (b.checked) b.click(); })()`); await sleep(300);
  await q(`(() => { const m = document.querySelector('.tbl-wrap .more'); if (m) { m.click(); m.click(); m.click(); } })()`); await sleep(300);
  console.log(await q(`(() => {
    const rows = [...document.querySelectorAll('.pick tbody tr')];
    const tally = {};
    const samples = [];
    for (const r of rows) {
      const w = r.querySelector('.why'); if (!w) continue;
      tally[w.textContent] = (tally[w.textContent] || 0) + 1;
      const name = r.querySelector('td').firstChild.textContent;
      const def = window.SR5DATA.qualities.qualities.find(x => x.name === name);
      if (samples.length < 12 && def) samples.push(name + ' :: ' + JSON.stringify(def.required || def.forbidden).slice(0, 110));
    }
    return JSON.stringify(tally) + '\\n' + samples.join('\\n');
  })()`));
}
