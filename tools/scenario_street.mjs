// Street Scum stat lines in the Build tab's priority grid; Street Level back to plain A-E.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const grid = () => q(`(() => {
    const rows = [...document.querySelectorAll('table.prio tbody tr')];
    const cols = ['heritage','talent','attributes','skills','resources'];
    const sel = {}; const off = [];
    rows.forEach((r) => { const L = r.querySelector('th').textContent; [...r.querySelectorAll('td button')].forEach((b, i) => { if (b.classList.contains('sel')) sel[cols[i]] = L; if (b.disabled) off.push(L); }); });
    const chips = [...document.querySelectorAll('[aria-label="Stat line"] button')].map(b => b.textContent + (b.getAttribute('aria-checked') === 'true' ? '*' : ''));
    const errs = [...document.querySelectorAll('.warnings li')].map(l => l.textContent).filter(t => /priorities/.test(t));
    return JSON.stringify({ sel, disabledRows: [...new Set(off)].join(''), chips, errs });
  })()`);
  const setTable = (t) => q(`(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'Street Level')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(t)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await click('button', 'Create a new runner'); await sleep(400);
  console.log('standard:', await grid());
  await setTable('Street Level'); await sleep(300);
  console.log('street level (plain A-E again):', await grid());
  await setTable('Street Scum'); await sleep(300);
  console.log('street scum (default BCDEE):', await grid());
  console.log('options:', await q(`[...document.querySelector('.prio-wrap').parentElement.querySelectorAll('select option')].map(o => o.value).join(', ')`));
  console.log('rulebook ref:', await q(`document.querySelector('[aria-label="Stat line"] .src')?.textContent`));
  await click('[aria-label="Stat line"] button', 'C C D D E'); await sleep(300);
  console.log('street scum CCDDE:', await grid());
  await shot('street-scum');
  // click a D cell in the Metatype column -> swaps with the other D column
  await q(`[...document.querySelectorAll('table.prio tbody tr')].find(r => r.querySelector('th').textContent === 'D').querySelectorAll('td button')[0].click()`); await sleep(300);
  console.log('after picking D for Metatype:', await grid());
  await setTable('Standard'); await sleep(300);
  console.log('back to standard:', await grid());
}
