// Play mode: the Gear tab no longer carries Matrix panels; the Matrix tab has them and shows up without the old
// Settings toggle (for a character with a commlink). Also: a mundane character without devices gets no Matrix tab.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  const tabs = () => q(`[...document.querySelectorAll('.tab-btn')].map(b => b.textContent).join(' | ')`);
  const panels = () => q(`[...document.querySelectorAll('#main .panel > header h3')].map(h => h.firstChild.textContent.trim()).join(' | ')`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.mode-opt', 'Play'); await sleep(300);
  const t0 = await tabs();
  check('no devices: no Matrix tab, and the tab is just "Gear"', !/Matrix/.test(t0) && /\bGear\b/.test(t0), t0);

  // give the character a commlink (with its bundled apps) and a program, the way the Gear tab would
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const gears = window.SR5DATA.gear.gears;
    const link = gears.find(g => g.category === 'Commlinks' && /Meta Link/.test(g.name)) || gears.find(g => g.category === 'Commlinks');
    const prog = gears.find(g => g.category === 'Common Programs');
    const knife = gears.find(g => g.category === 'Tools' || g.category === 'Survival Gear');
    ch.gear.push({ uid: 'cl1', id: link.id, name: link.name }, { uid: 'pg1', id: prog.id, name: prog.name, device: 'cl1' }, { uid: 'kn1', id: knife.id, name: knife.name });
    st.settings.focusPages = { drone: false, magic: false, decker: false };
    localStorage.setItem(KEY, JSON.stringify(st));
    return link.name + ' + ' + prog.name + ' + ' + knife.name;
  })()`));
  await q(`location.reload()`); await sleep(1500);
  const t1 = await tabs();
  check('with a commlink: Matrix tab shows up (focus toggle off)', /Matrix/.test(t1), t1);
  await click('.tab-btn', 'Gear'); await sleep(300);
  const gp = await panels();
  check('Gear tab has no Matrix / Overwatch / Programs panels', !/Matrix|Overwatch|Programs|persona/i.test(gp), gp);
  check('...but still lists the commlink as gear', await q(`!![...document.querySelectorAll('.inventory th')].find(t => /Commlink|Meta Link/i.test(t.textContent) || t.querySelector('a,button'))`));
  await shot('play-gear');
  await click('.tab-btn', 'Matrix'); await sleep(300);
  const mp = await panels();
  check('Matrix tab has the deck card, program library and Marks & Overwatch (v23 layout)', /^Matrix /.test(mp) && /Program library/.test(mp) && /Overwatch/.test(mp), mp);
  await click('.tab-btn', 'Settings'); // Play mode has no Settings tab - go through Build
  await click('.mode-opt', 'Build'); await sleep(300);
  await click('.tab-btn', 'Settings'); await sleep(300);
  const toggles = await q(`[...document.querySelectorAll('.focus-toggle label')].map(l => l.textContent.trim()).join(' | ')`);
  check('Settings no longer has a Decker / Matrix toggle', !/Decker/.test(toggles), toggles);
}
