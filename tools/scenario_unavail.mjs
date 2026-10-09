// "Hide what this character can't take" in the pickers: gear (availability), qualities (Magic), cyberware (Essence).
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const info = () => q(`JSON.stringify({ box: document.querySelector('.hide-unavail')?.textContent.trim(), checked: document.querySelector('.hide-unavail input')?.checked, count: document.querySelector('.picker-bar .count').textContent, dimmed: document.querySelectorAll('.pick tr.unavail').length, firstWhy: document.querySelector('.pick .why')?.textContent })`);
  const toggle = () => q(`document.querySelector('.hide-unavail input').click()`);
  const close = () => q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  const addIn = (title) => q(`(() => { const p = [...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.trim().startsWith(${JSON.stringify(title)})); const b = p && [...p.querySelectorAll('button')].find(b => /Add/.test(b.textContent)); if (!b) return 'NO BUTTON'; b.click(); return 'ok'; })()`);
  await click('button', 'Create a new runner'); await sleep(400);

  await click('.tab-btn', 'Gear'); await sleep(300);
  console.log('open gear picker:', await addIn('Gear'), await addIn('General')); await sleep(500);
  console.log('gear, box off:', await info());
  await shot('unavail-gear-off');
  await toggle(); await sleep(300);
  console.log('gear, box on :', await info());
  await close(); await sleep(200);

  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('qualities (remembered on):', await info());
  await toggle(); await sleep(300);
  console.log('qualities, box off:', await info());
  console.log('Adept Healer reason:', await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.textContent.startsWith('Adept Healer'))?.querySelector('.why')?.textContent`));
  await shot('unavail-qualities-off');
  await close(); await sleep(200);

  await click('.tab-btn', 'Augments'); await sleep(300);
  console.log('open cyberware picker:', await addIn('Cyberware')); await sleep(500);
  console.log('cyberware reasons:', await q(`[...new Set([...document.querySelectorAll('.pick .why')].map(w => w.textContent.replace(/[0-9.]+/g, 'N')))].join(' / ')`));
  console.log('cyberware:', await info());
}
