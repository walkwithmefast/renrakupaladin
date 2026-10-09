// Desktop app: a rulebook link from the Inspector opens the PDF in its own window (Chromium PDF viewer, #page kept).
export default async function ({ evalJS, click, sleep, send }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await q(`document.querySelectorAll('.pick tbody tr')[10].querySelector('td').click()`); await sleep(400);
  const href = await q(`document.querySelector('.drawer a.src.big')?.href`);
  console.log('link:', href);
  await q(`document.querySelector('.drawer a.src.big').click()`); await sleep(2500);
  const { result } = await send('Target.getTargets');
  console.log('targets:', result.targetInfos.map((t) => `${t.type} ${decodeURIComponent(t.url).slice(-60)}`).join('\n  '));
}
