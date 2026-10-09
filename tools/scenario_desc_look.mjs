// Screenshots of the drawer's description box: with the Edit button, and the editor open (browser mode).
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.textContent.startsWith('Ambidextrous')).querySelector('td').click()`); await sleep(400);
  await shot('desc-view');
  await click('.drawer .excerpt .edit'); await sleep(300);
  await shot('desc-edit');
  await click('.drawer .excerpt button', 'Save'); await sleep(300);
  console.log('browser-mode edit saved to localStorage:', await q(`localStorage.getItem('rp.descriptionEdits')?.slice(0, 80)`));
}
