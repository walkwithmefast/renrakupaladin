// Character -> Rename… (replaces the top-bar name box) and the one-row Build top bar.
export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  check('Build top bar is one row at 1440px', (await q(`Math.round(document.querySelector('.top').getBoundingClientRect().height)`)) < 70);
  await click('.charmenu > button'); await sleep(150);
  await click('.charmenu .menu button', 'Rename'); await sleep(250);
  const set = (i, v) => q(`(() => { const e = document.querySelectorAll('.modal input')[${i}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await set(0, 'Kaito Mori'); await set(1, 'Wraith'); await sleep(150);
  await click('.modal footer button', 'Save'); await sleep(300);
  check('renamed: the list shows the street name, the name is saved', (await q(`document.querySelector('.top select').selectedOptions[0].textContent`)) === 'Wraith'
    && (await q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].info.name`)) === 'Kaito Mori');
}
