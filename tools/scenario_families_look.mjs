// Screenshots: the qualities picker with family rows, and knowledge skills with an editable descriptor.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const setVal = (sel, v, ev) => q(`(() => { const e = ${sel}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); })()`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Skills'); await sleep(300);
  for (const [base, d] of [['Area Knowledge', 'Seattle'], ['Area Knowledge', 'Boston'], ['Bars', '']]) {
    await setVal(`document.querySelector('.addrow input[list="know-suggest"]')`, base, 'input'); await sleep(150);
    if (d) { await setVal(`document.querySelector('.addrow input[aria-label$="which one"]')`, d, 'input'); await sleep(150); }
    await click('.addrow button', 'Add'); await sleep(250);
  }
  await setVal(`document.querySelector('.addrow input[list="know-suggest"]')`, 'Area Knowledge', 'input'); await sleep(200);
  await q(`document.querySelector('.knowgrid').closest('.panel').scrollIntoView()`); await sleep(300);
  await shot('families-know');
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await setVal(`document.querySelector('.picker-bar .search')`, 'insect', 'input'); await sleep(300);
  await shot('families-qual-picker');
}
