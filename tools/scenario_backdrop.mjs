// Picker stays put when the drawer opens; one backdrop click closes picker + drawer; a drawer opened *before*
// the picker survives a backdrop click.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const st = () => q(`JSON.stringify({ picker: !!document.querySelector('.modal-back'), drawer: document.querySelector('.drawer h3')?.textContent || null,
    modalLeft: document.querySelector('.modal') ? Math.round(document.querySelector('.modal').getBoundingClientRect().left) : null })`);
  const backdrop = () => q(`(() => { const b = document.querySelector('.modal-back'); const x = 8, y = innerHeight - 8; const el = document.elementFromPoint(x, y);
    const hit = el === b ? 'backdrop' : el?.className; el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y })); return hit; })()`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('picker open:', await st());
  await q(`document.querySelectorAll('.pick tbody tr')[1].querySelector('td').click()`); await sleep(300);
  console.log('row clicked (modalLeft unchanged?):', await st());
  await shot('backdrop-both');
  console.log('clicked:', await backdrop()); await sleep(300);
  console.log('after one backdrop click (both closed?):', await st());
  // reverse order: drawer first, then picker
  await click('button', '+ Add'); await sleep(400);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.textContent.includes('Ambidextrous')).querySelector('button.primary').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  await q(`[...document.querySelectorAll('.linkname')].find(b => b.textContent.includes('Ambidextrous')).click()`); await sleep(300);
  console.log('drawer from list:', await st());
  await click('button', '+ Add'); await sleep(400);
  console.log('picker over drawer:', await st());
  console.log('clicked:', await backdrop()); await sleep(300);
  console.log('after backdrop (picker closed, drawer stays?):', await st());
}
