// Picker header sorting: Qualities (name / karma / book) and Lifestyles (monthly cost).
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const top = (n = 6) => q(`[...document.querySelectorAll('.pick tbody tr')].slice(0, ${n}).map(r => [...r.querySelectorAll('td')].slice(0, 3).map(td => td.textContent.trim()).join(' | ')).join(' || ')`);
  const head = (label) => click('.pick th .sorthead', label);
  const state = () => q(`[...document.querySelectorAll('.pick th[aria-sort]')].map(th => th.textContent.trim().replace(/[▲▼↕]/, '') + ':' + th.getAttribute('aria-sort')).join(' ')`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('default:\n    ' + await top(3));
  await head('Karma'); await sleep(200);
  console.log('Karma click 1 [' + await state() + ']:\n    ' + await top());
  await shot('sort-karma');
  await head('Karma'); await sleep(200);
  console.log('Karma click 2:\n    ' + await top(4));
  await head('Book'); await sleep(200);
  console.log('Book click 1:\n    ' + await top(4));
  await head('Book'); await sleep(200);
  console.log('Book click 2:\n    ' + await top(4));
  await head('Quality'); await sleep(200);
  console.log('Name click 1:\n    ' + await top(3));
  await head('Quality'); await sleep(200);
  console.log('Name click 2:\n    ' + await top(3));
  await q(`(() => { const i = document.querySelector('.picker-bar .search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'adept'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  console.log('name Z-A still applied while searching "adept":\n    ' + await top(4));
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  await click('.tab-btn', 'Life'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('lifestyle headers:', await q(`[...document.querySelectorAll('.pick thead th')].map(t => t.textContent.trim()).join(' / ')`));
  await head('Monthly'); await sleep(200);
  console.log('Monthly click 1:\n    ' + await top(4));
}
