// Session tools: top-bar Wallet (earn / spend / Karma / rent / undo), custom items, loot from the catalogue.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const setVal = (sel, v, ev = 'input', proto = 'HTMLInputElement') => q(`(() => { const e = ${sel}; Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); })()`);
  const wallet = () => q(`document.querySelector('.walletbtn')?.textContent`);
  await click('button', 'Create a new runner'); await sleep(400);
  await q(`(() => {
    const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId];
    const med = window.SR5DATA.lifestyles.lifestyles.find(l => l.name === 'Medium');
    ch.info.name = 'Session Sam'; ch.mode = 'career'; ch.career = { earned: 5, log: [], nuyenEarned: 0 }; ch.nuyenAdjust = 10000;
    ch.lifestyles.push({ uid: 'l1', id: med.id, name: med.name, months: 1 });
    st.viewModes = { ...(st.viewModes || {}), [ch.id]: 'play' };
    localStorage.setItem(KEY, JSON.stringify(st));
  })()`);
  await q(`location.reload()`); await sleep(1500);
  const w0 = await wallet();
  check('Wallet in the Play top bar shows nuyen and Karma', /¥/.test(w0) && /K/.test(w0), w0);

  await click('.walletbtn'); await sleep(200);
  await setVal(`document.querySelector('.walletpop .wamt')`, '5000');
  await click('.walletpop .chip', 'Run payment'); await sleep(100);
  await click('.walletpop button', '+ Earn'); await sleep(250);
  const w1 = await wallet();
  check('earning 5,000 for a run', w1.startsWith('10,000¥') && (await q(`document.querySelector('.walletpop .ledger li').textContent`)).includes('Run payment'), `${w0} -> ${w1}`);
  await setVal(`document.querySelector('.walletpop .wk')`, '3');
  await click('.walletpop button', '+ Award Karma'); await sleep(250);
  check('awarding Karma', /8 K/.test(await wallet()), await wallet());
  await click('.walletpop button', 'Pay rent'); await sleep(250);
  const w2 = await wallet();
  check('paying a month of Medium lifestyle (5,000)', w2.startsWith('5,000¥'), w2);
  await shot('session-wallet');
  await q(`document.querySelector('.walletpop .ledger li button').click()`); await sleep(250);
  check('undoing the rent', (await wallet()).startsWith('10,000¥'), await wallet());
  await q(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(150);

  // custom weapon from the Play Gear tab
  await click('.tab-btn', 'Gear'); await sleep(300);
  await click('.getstuff button', '+ Custom item'); await sleep(300);
  await setVal(`[...document.querySelectorAll('.modal select')][0]`, 'weapons', 'change', 'HTMLSelectElement'); await sleep(200);
  await setVal(`document.querySelector('.modal input[placeholder^="e.g. Prototype"]')`, 'Prototype Ares');
  await setVal(`[...document.querySelectorAll('.modal select')].find(s => [...s.options].some(o => o.value === 'Heavy Pistols'))`, 'Heavy Pistols', 'change', 'HTMLSelectElement');
  for (const [ph, v] of [['8P', '9P'], ['-1', '-2'], ['5', '6'], ['15(c)', '12(c)']]) await setVal(`document.querySelector('.modal input[placeholder="${ph}"]')`, v);
  await setVal(`document.querySelector('.modal textarea')`, 'A gift from Mr. Johnson. Smartlinked.', 'input', 'HTMLTextAreaElement');
  await shot('session-custom-form');
  await click('.modal footer button', 'Add item'); await sleep(300);
  const wrow = await q(`[...document.querySelectorAll('.weapons tbody tr')].find(r => r.textContent.includes('Prototype Ares'))?.textContent`);
  check('custom weapon appears with its stats and an attack pool', !!wrow && wrow.includes('9P') && wrow.includes('12/12'), wrow);
  check('...and cost nothing (a gift)', (await wallet()).startsWith('10,000¥'), await wallet());

  // loot from the catalogue - the Armor panel (ArmorGearVehicles, career mode) replaced the old read-only
  // ".worn" checklist this session (#44, Build-vs-Play parity): owned armor now lives in a full ItemSection.
  const armorPanel = `[...document.querySelectorAll('.panel')].find(p => p.querySelector('h3')?.textContent === 'Armor')`;
  await setVal(`document.querySelector('.getstuff select')`, 'armor', 'change', 'HTMLSelectElement'); await sleep(400);
  await setVal(`document.querySelector('.picker-bar .search')`, 'Armor Jacket'); await sleep(300);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.querySelector('td').textContent.startsWith('Armor Jacket')).querySelector('button.primary').click()`); await sleep(300);
  await q(`document.querySelector('.modal-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(300);
  check('looted Armor Jacket is worn and free', (await q(`(${armorPanel})?.textContent || ''`)).includes('Armor Jacket') && (await wallet()).startsWith('10,000¥'), await wallet());
  await q(`[...(${armorPanel}).querySelectorAll('.linkname')].find(b => b.textContent === 'Armor Jacket').click()`); await sleep(300);
  check('its info panel has "Didn’t pay for it" ticked', await q(`[...document.querySelectorAll('.drawer label.check')].some(l => /Didn't pay/.test(l.textContent) && l.querySelector('input').checked)`));
  await q(`[...document.querySelectorAll('.drawer label.check')].find(l => /Didn't pay/.test(l.textContent)).querySelector('input').click()`); await sleep(300);
  check('unticking it charges the list price (1,000)', (await wallet()).startsWith('9,000¥'), await wallet());
  await q(`document.querySelector('.drawer header button').click()`); await sleep(200);

  // edit the custom weapon from its info panel
  await q(`[...document.querySelectorAll('.weapons .linkname')].find(b => b.textContent === 'Prototype Ares').click()`); await sleep(300);
  check('custom item info shows the description', (await q(`document.querySelector('.drawer').textContent`)).includes('A gift from Mr. Johnson'));
  await click('.drawer button', 'Edit custom item'); await sleep(300);
  await setVal(`document.querySelector('.modal input[placeholder^="e.g. Prototype"]')`, 'Ares Prototype "Widowmaker"');
  await click('.modal footer button', 'Save'); await sleep(300);
  check('editing renames it', (await q(`document.querySelector('.drawer h3').textContent`)) === 'Ares Prototype "Widowmaker"');
}
