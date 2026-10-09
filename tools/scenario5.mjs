// Programs sub-tab: add a common and a hacking program, check costs and that main gear list excludes them.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const nuyenLeft = () => q(`(document.querySelector('.summary-bar b')||{}).textContent`);
  await click('button', 'Create a new runner');
  await sleep(300);
  await click('.tab-btn', 'Gear');
  await sleep(300);
  console.log('subtabs:', await q(`[...document.querySelectorAll('.subtab')].map(b=>b.textContent).join(' | ')`));
  await click('.subtab', 'Programs');
  await sleep(300);
  console.log('panels:', await q(`[...document.querySelectorAll('.panel h3')].map(h=>h.textContent).join(' | ')`));
  const add = async (panelTitle, search) => {
    await q(`[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h3').textContent.startsWith(${JSON.stringify(panelTitle)})).querySelector('button.primary').click()`);
    await sleep(300);
    console.log(' picker rows for', panelTitle, await q(`document.querySelectorAll('.modal tbody tr').length`));
    await q(`(() => { const i = document.querySelector('.modal input.search'); i.value=${JSON.stringify(search)}; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(200);
    await click('.modal button.primary', 'Add');
    await click('.modal button.ghost');
    await sleep(250);
  };
  await add('Common programs', 'browse');
  await add('Hacking programs', 'biofeedback');
  await shot('p1-programs');
  console.log('nuyen:', await nuyenLeft());
  console.log('badge:', await q(`(document.querySelector('.subtab .badge')||{}).textContent`));
  await click('.subtab', 'Weapons');
  await sleep(300);
  console.log('gear list has programs?', await q(`document.body.innerText.includes('Biofeedback') || document.body.innerText.includes('Browse')`));
}
