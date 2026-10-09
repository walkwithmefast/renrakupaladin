// Selling / deleting owned items (with undo) and custom qualities.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const setVal = (sel, v, ev = 'input', proto = 'HTMLInputElement') => q(`(() => { const e = ${sel}; Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); })()`);
  const wallet = () => q(`document.querySelector('.walletbtn')?.textContent`);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    const jacket = D.armor.armors.find(a => a.name === 'Armor Jacket');
    const kit = D.gear.gears.find(g => g.name === 'Medkit');
    ch.info.name = 'Seller'; ch.mode = 'career'; ch.career = { earned: 10, log: [], nuyenEarned: 0 }; ch.nuyenAdjust = 5000;
    ch.armor.push({ uid: 'a1', id: jacket.id, name: jacket.name });
    ch.gear.push({ uid: 'g1', id: kit.id, name: kit.name, rating: 1 });
    st.viewModes = { ...(st.viewModes || {}), [ch.id]: 'play' };
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Gear'); await sleep(300);
  const w0 = await wallet();
  // the Armor panel (ArmorGearVehicles, career mode) replaced the old read-only ".worn" checklist this
  // session (#44, Build-vs-Play parity): owned armor now lives in a full ItemSection.
  const armorPanel = `[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent === 'Armor')`;

  // sell the armor jacket
  await q(`[...(${armorPanel}).querySelectorAll('.linkname')].find(b => b.textContent === 'Armor Jacket').click()`); await sleep(300);
  check('Play mode info panel offers Sell / Delete (and no refund-remove)', (await q(`[...document.querySelectorAll('.drawer footer button')].map(b => b.textContent).join(' | ')`)) === 'Sell… | Delete (no refund)');
  await click('.drawer footer button', 'Sell'); await sleep(200);
  const suggested = await q(`document.querySelector('.drawer footer input').value`);
  check('suggests half the price (500 of 1,000)', suggested === '500', suggested);
  await setVal(`document.querySelector('.drawer footer input')`, '650');
  await shot('sell-footer');
  await click('.drawer footer button.primary', 'Sell'); await sleep(300);
  const w1 = await wallet();
  check('selling for 650 adds 650 (not the 1,000 list price)', parseInt(w1.replace(/,/g, '')) - parseInt(w0.replace(/,/g, '')) === 650, `${w0} -> ${w1}`);
  check('the jacket is gone', !(await q(`(${armorPanel})?.textContent || ''`)).includes('Armor Jacket'));

  // delete the medkit - the Gear panel (ArmorGearVehicles, career mode) replaced the old read-only
  // ".inventory" merged table this session (#44, Build-vs-Play parity): owned gear now lives in a full ItemSection.
  const gearPanel = `[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent === 'Gear')`;
  await q(`[...(${gearPanel}).querySelectorAll('.linkname')].find(b => b.textContent.startsWith('Medkit')).click()`); await sleep(300);
  await click('.drawer footer button', 'Delete (no refund)'); await sleep(200);
  await click('.drawer footer button.danger', 'Delete'); await sleep(300);
  check('deleting keeps the money spent', (await wallet()) === w1, await wallet());
  check('the medkit is gone', !(await q(`document.querySelector('#main').textContent`)).includes('Medkit'));

  // undo both from the Wallet
  await click('.walletbtn'); await sleep(200);
  const ledger = await q(`[...document.querySelectorAll('.walletpop .ledger li')].map(l => l.textContent.replace('✕', '').trim()).join(' | ')`);
  check('ledger shows both', /Deleted.*Medkit/.test(ledger) && /650.*Sold Armor Jacket/.test(ledger), ledger);
  await q(`document.querySelectorAll('.walletpop .ledger li button')[0].click()`); await sleep(250);
  await q(`document.querySelectorAll('.walletpop .ledger li button')[0].click()`); await sleep(250);
  await q(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(150);
  check('undo puts both back and restores the money', (await wallet()) === w0 && (await q(`document.querySelector('#main').textContent`)).includes('Medkit') && (await q(`(${armorPanel})?.textContent || ''`)).includes('Armor Jacket'), await wallet());

  // Build mode on a finished character: three choices
  await click('.mode-opt', 'Build'); await sleep(300);
  await click('.tab-btn', 'Gear'); await sleep(300);
  await q(`[...document.querySelectorAll('.linkname')].find(b => b.textContent === 'Armor Jacket').click()`); await sleep(300);
  check('Build mode (finished character): Sell / Delete / Remove (refund)', (await q(`[...document.querySelectorAll('.drawer footer button')].map(b => b.textContent).join(' | ')`)) === 'Sell… | Delete (no refund) | Remove (refund)');
  await q(`document.querySelector('.drawer header button').click()`); await sleep(200);

  // custom quality
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await q(`[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent.startsWith('Positive')).querySelector('header button').click()`); await sleep(300);
  await setVal(`document.querySelector('.modal input[placeholder^="e.g. Marked"]')`, 'Marked by the Dragon');
  await setVal(`document.querySelector('.modal input[type=number]')`, '6');
  await click('.modal button', '+ bonus'); await sleep(150);
  await setVal(`document.querySelector('.modal textarea')`, 'Dragons notice you. +2 dice Etiquette with dragons.', 'input', 'HTMLTextAreaElement');
  await shot('custom-quality-form');
  await click('.modal footer button', 'Add quality'); await sleep(300);
  const row = await q(`[...document.querySelectorAll('.row-item')].find(l => l.textContent.includes('Marked by the Dragon'))?.textContent`);
  check('custom quality listed with its Karma and bonus', !!row && /6 K/.test(row) && /CHA \+1/.test(row), row);
  await q(`[...document.querySelectorAll('.row-item .linkname')].find(b => b.textContent === 'Marked by the Dragon').click()`); await sleep(300);
  check('its info panel shows the description + Edit custom quality', (await q(`document.querySelector('.drawer').textContent`)).includes('Dragons notice you') && (await q(`[...document.querySelectorAll('.drawer button')].some(b => /Edit custom quality/.test(b.textContent))`)));
}
