// Holistic bug sweep: build a heavily-featured "Test Dummy" character (every subsystem touched at once:
// Mystic Adept magic, cyberware w/ capacity subsystem, bioware, a drone + a vehicle w/ mods, loaded ammo,
// armor mods, a cyberdeck, martial arts, a bound spirit, initiation, mentor spirit w/ a sub-choice, choice-type
// qualities/powers, a custom quality, a custom item, family knowledge, lifestyle, contact) then walk every
// Build and Play page (with Focus pages on) taking a console-error census, plus exercise a grab-bag of
// interactive controls (pickers, sorting, undo/redo, theme cycle, wallet, sell/delete, journal, hide-unavailable).
export default async function ({ evalJS, shot, click, sleep, send }) {
  const q = (js) => evalJS(js);
  const results = [];
  const check = (label, ok, extra = '') => { results.push({ label, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`); };
  const consoleErrors = async () => q(`window.__errs || []`);
  await q(`window.addEventListener('error', (e) => { (window.__errs ||= []).push('window.onerror: ' + e.message); });
    window.addEventListener('unhandledrejection', (e) => { (window.__errs ||= []).push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)); });`);

  await click('button', 'Create a new runner'); await sleep(400);

  // ---------------------------------------------------------------- inject a heavily-featured character
  const setup = await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const D = window.SR5DATA;
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const byName = (file, sec, name) => D[file][sec].find((x) => x.name === name);
    const errs = [];
    const need = (v, label) => { if (!v) errs.push('missing catalogue item: ' + label); return v; };

    ch.info.name = 'Test Dummy';
    ch.info.alias = 'Test Dummy';
    ch.pri = { heritage: 'E', talent: 'A', attributes: 'B', skills: 'C', resources: 'A' };
    ch.metatype = 'Human';
    ch.talent = 'Mystic Adept';
    ch.attrs.AGI = { p: 3, k: 0, a: 0 };
    ch.attrs.LOG = { p: 2, k: 0, a: 0 };
    ch.attrs.CHA = { p: 2, k: 0, a: 0 };
    ch.attrs.WIL = { p: 2, k: 0, a: 0 };

    const sk = (name) => need(D.skills.skills.find((s) => s.name === name), 'skill ' + name);
    for (const [name, p] of [['Pistols', 4], ['Perception', 3], ['Survival', 2], ['Negotiation', 2], ['Spellcasting', 3], ['Gunnery', 2], ['Summoning', 2]]) {
      const d = sk(name); if (d) ch.skills[d.id] = { p, k: 0, a: 0, spec: '', specSrc: 'p' };
    }
    ch.know.push({ uid: 'kw1', name: 'Seattle', cat: 'Street', p: 4, k: 0, a: 0, f: 0, spec: '', specSrc: 'p' });
    ch.know.push({ uid: 'kw2', name: 'English', cat: 'Language', p: 0, k: 0, a: 0, f: 6, native: true });

    const q_ = (name) => need(D.qualities.qualities.find((x) => x.name === name), 'quality ' + name);
    const apt = q_('Aptitude'); if (apt) ch.qualities.push({ uid: 'apt', id: apt.id, name: apt.name, choice: { skill: 'Pistols' }, note: '' });
    const cs = q_('City Slicker'); if (cs) ch.qualities.push({ uid: 'cs', id: cs.id, name: cs.name, choice: {}, note: '' });
    const ms = q_('Mentor Spirit'); if (ms) ch.qualities.push({ uid: 'ms', id: ms.id, name: ms.name, choice: {}, note: '' });
    const mentor = need(D.mentors.mentors.find((m) => m.name === 'Bear'), 'mentor Bear');
    if (mentor) { ch.mentor = mentor.name; ch.mentorChoice = [].concat(mentor.choices)[0].name; }
    // a negative quality (any one under -10 karma so it's meaningfully visible), plus a custom quality
    const neg = D.qualities.qualities.find((x) => x.category === 'Negative' && Number(x.karma) <= -10);
    if (neg) ch.qualities.push({ uid: 'neg', id: neg.id, name: neg.name, choice: {}, note: '' });
    ch.qualities.push({ uid: 'cq', id: 'custom-q-cq', name: 'GM Boon', custom: { category: 'Positive', karma: 3, attrs: [{ attr: 'WIL', val: 1 }], description: 'Hand-typed by the GM.' }, a: false, choice: {}, note: '' });

    ch.tradition = (D.traditions.traditions[0] || {}).name || '';
    const spell = D.spells.spells[0]; if (spell) ch.spells.push({ uid: 'sp1', id: spell.id, name: spell.name, a: false });
    const ipa = need(D.powers.powers.find((p) => p.name === 'Improved Physical Attribute'), 'power IPA');
    if (ipa) ch.powers.push({ uid: 'pw1', id: ipa.id, name: ipa.name, level: 1, choice: { attr: 'AGI' } });
    const iab = need(D.powers.powers.find((p) => p.name === 'Improved Ability (skill)'), 'power Improved Ability');
    if (iab) ch.powers.push({ uid: 'pw2', id: iab.id, name: iab.name, level: 1, choice: { skill: 'Pistols' } });

    const eyes = need(D.cyberware.cyberwares.find((c) => c.name === 'Cybereyes Basic System'), 'Cybereyes Basic System');
    const llv = need(D.cyberware.cyberwares.find((c) => c.name === 'Low-Light Vision'), 'Low-Light Vision');
    if (eyes) { ch.cyberware.push({ uid: 'cy1', id: eyes.id, name: eyes.name, rating: 3, grade: 'Standard' }); }
    if (llv) { ch.cyberware.push({ uid: 'cy2', id: llv.id, name: llv.name, grade: 'Standard', parent: 'cy1', child: true }); }
    const adr = need(D.bioware.biowares.find((b) => b.name === 'Adrenaline Pump'), 'Adrenaline Pump');
    if (adr) ch.bioware.push({ uid: 'bio1', id: adr.id, name: adr.name, rating: Math.max(1, Number(adr.rating) || 1), grade: 'Standard' });

    const pistol = need(D.weapons.weapons.find((w) => w.name === 'Ares Predator V'), 'Ares Predator V');
    const laser = D.weapons.accessories.find((a) => a.name === 'Laser Sight');
    if (pistol) {
      const w = { uid: 'w1', id: pistol.id, name: pistol.name, mods: laser ? [{ id: laser.id, rating: 1 }] : [] };
      ch.weapons.push(w);
    }
    const ammo = D.gear.gears.find((g) => g.name === 'Ammo: Regular Ammo' && g.category === 'Ammunition');
    if (ammo) ch.gear.push({ uid: 'am1', id: ammo.id, name: ammo.name, qty: 50 });

    const cloth = need(D.armor.armors.find((a) => a.name === 'Clothing'), 'Clothing armor');
    const armMod = D.armor.mods.find((m) => m.name === 'Electrochromic Clothing');
    if (cloth) ch.armor.push({ uid: 'ar1', id: cloth.id, name: cloth.name, mods: armMod ? [{ id: armMod.id, rating: 1 }] : [], equipped: true });

    const deck = need(D.gear.gears.find((g) => g.name === 'Erika MCD-1'), 'Erika MCD-1');
    if (deck) { ch.gear.push({ uid: 'gd1', id: deck.id, name: deck.name, qty: 1 }); ch.activeDevice = 'gd1'; }
    // a custom "loot" item (GM gift)
    ch.gear.push({ uid: 'cg1', id: 'custom-cg1', name: 'Salvaged Chip', custom: { kind: 'gear', category: 'Loot', cost: 0, avail: '0', rating: '', capacity: '', description: 'A data chip pulled off a corp ganger.' }, qty: 1, free: true });

    const drone = need(D.vehicles.vehicles.find((v) => v.name === 'Ocular Drone'), 'Ocular Drone');
    const vmod = D.vehicles.mods.find((m) => m.name === 'Tracked Propulsion');
    if (drone) ch.vehicles.push({ uid: 've1', id: drone.id, name: drone.name, mods: vmod ? [{ id: vmod.id, rating: 1 }] : [] });
    const scoot = need(D.vehicles.vehicles.find((v) => v.name === 'Dodge Scoot (Scooter)'), 'Dodge Scoot (Scooter)');
    if (scoot) ch.vehicles.push({ uid: 've2', id: scoot.id, name: scoot.name, mods: [] });

    const med = need(D.lifestyles.lifestyles.find((l) => l.name === 'Medium'), 'Medium lifestyle');
    if (med) ch.lifestyles.push({ uid: 'ls1', id: med.id, name: med.name, label: 'Safehouse', months: 1, pct: 0, flat: 0 });
    ch.contacts.push({ uid: 'ct1', name: 'Fixer Joe', role: 'Fixer', connection: 3, loyalty: 2, notes: '', a: false });

    ch.spirits.push({ uid: 'sp1', name: (D.traditions.traditions[0] && D.traditions.traditions[0].spirits && Object.values(D.traditions.traditions[0].spirits)[0]) || 'Spirit of Man', force: 3, services: 2, bound: true });
    ch.initGrade = 1;
    ch.metamagics.push({ uid: 'mm1', name: (D.metamagic.metamagics[0] || {}).name || 'Centering' });

    const ma = need(D.martialarts.martialarts.find((m) => m.name === '52 Blocks'), '52 Blocks');
    if (ma) ch.martialArts.push({ uid: 'ma1', name: ma.name, techniques: [{ uid: 'mt1', name: 'Called Shot (Disarm)' }] });

    st.chars[st.currentId] = ch;
    localStorage.setItem(KEY, JSON.stringify(st));
    return { errs, name: ch.info.name };
  })()`);
  check('catalogue lookups for the injected build all resolved', setup.errs.length === 0, setup.errs.join('; '));
  await q(`location.reload()`); await sleep(1500);

  // ---------------------------------------------------------------- Build-mode pages
  const buildTabs = ['Build', 'Skills', 'Qualities', 'Magic', 'Augments', 'Gear', 'Life', 'Sheet', 'Settings'];
  for (const t of buildTabs) {
    await click('.tab-btn', t); await sleep(500);
    const bodyText = await q(`document.body.innerText`);
    const badTokens = (bodyText.match(/\\bNaN\\b/g) || []).length + (bodyText.match(/undefined/g) || []).length;
    const errs = await consoleErrors();
    check(`Build > ${t} renders cleanly`, errs.length === 0 && badTokens === 0, errs.concat(badTokens ? [`${badTokens} NaN/undefined in text`] : []).join('; '));
    await shot(`bugsweep-build-${t.toLowerCase()}`);
  }

  // turn on focus pages so Play mode shows every possible tab. NOTE: clicking both checkboxes back-to-back in the
  // same synchronous tick (as a first pass here did) actually LOST the first toggle - `setFocus` builds its patch
  // from a `focus` object captured at render time, so two clicks fired before Preact re-renders both compute their
  // patch from the same stale snapshot and the second click's write clobbers the first (see bug list: "settings
  // toggles can lose a sibling toggle under rapid clicks"). Click one at a time with a render gap between them.
  await click('.tab-btn', 'Settings'); await sleep(300);
  await q(`(() => { const c = [...document.querySelectorAll('input[type=checkbox]')].find(c => /drone/i.test(c.closest('label')?.textContent || '')); if (c && !c.checked) c.click(); })()`);
  await sleep(350);
  await q(`(() => { const c = [...document.querySelectorAll('input[type=checkbox]')].find(c => /magic/i.test(c.closest('label')?.textContent || '')); if (c && !c.checked) c.click(); })()`);
  await sleep(350);

  // "Finish creation" uses window.confirm() (see finding: it's the only action in the app that does, everything
  // else uses the inline two-step pattern) - headless Chrome auto-dismisses it (returns false), so it can't be
  // driven through the button here. Move to career mode the same way finalize() does instead, to still exercise
  // Play-mode/career-only UI (Sell, karma-from-play, etc.).
  await q(`(() => { const KEY = 'chummer-remake.v1'; const st = JSON.parse(localStorage.getItem(KEY)); const ch = st.chars[st.currentId];
    ch.mode = 'career'; ch.career = { earned: 10, log: [{ t: Date.now(), amt: 10, note: 'test setup' }], nuyenEarned: 0 }; ch.nuyenAdjust = 5000; ch.karmaConverted = 0;
    localStorage.setItem(KEY, JSON.stringify(st)); })()`);
  await q(`location.reload()`); await sleep(1500);
  const debugState = await q(`(() => { const st = JSON.parse(localStorage.getItem('chummer-remake.v1')); const ch = st.chars[st.currentId]; return { mode: ch.mode, focusPages: st.settings.focusPages, vehicles: ch.vehicles.length }; })()`);
  console.log('DEBUG post-career-injection state:', JSON.stringify(debugState));
  // switch to Play mode via the mode switch buttons
  await click('.mode-opt.play', ''); await sleep(600);

  const playTabs = ['Sheet', 'Gear', 'Magic', 'Drones', 'Matrix', 'Journal'];
  for (const t of playTabs) {
    const r = await click('.tab-btn', t);
    if (String(r).startsWith('NOT FOUND')) { check(`Play > ${t} tab exists`, false, r); continue; }
    await sleep(500);
    const bodyText = await q(`document.body.innerText`);
    const badTokens = (bodyText.match(/\\bNaN\\b/g) || []).length + (bodyText.match(/undefined/g) || []).length;
    const errs = await consoleErrors();
    check(`Play > ${t} renders cleanly`, errs.length === 0 && badTokens === 0, errs.concat(badTokens ? [`${badTokens} NaN/undefined in text`] : []).join('; '));
    await shot(`bugsweep-play-${t.toLowerCase()}`);
  }

  // ---------------------------------------------------------------- interactive grab-bag
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const cmClickable = await q(`(() => { const b = document.querySelector('.box[aria-label]'); if (b) { b.click(); return b.getAttribute('aria-label'); } return null; })()`);
  await sleep(300);
  check('a condition-monitor box is clickable without throwing', (await consoleErrors()).length === 0 && !!cmClickable, cmClickable || 'no box found to click');

  // Wallet: get paid (it's a popover off the top-bar button, not a panel on the Gear tab)
  await click('.tab-btn', 'Gear'); await sleep(400);
  const walletBefore = await q(`document.querySelector('.walletbtn')?.textContent || ''`);
  await click('.walletbtn', ''); await sleep(300);
  await q(`(() => { const inp = document.querySelector('.wamt'); if (inp) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp, '500'); inp.dispatchEvent(new Event('input',{bubbles:true})); } })()`);
  const addBtn = await click('.walletpop button', '+ Earn');
  await sleep(400);
  const walletAfter = await q(`document.querySelector('.walletbtn')?.textContent || ''`);
  check('Wallet "+ Earn" actually credits nuyen', walletBefore !== walletAfter, `before="${walletBefore}" after="${walletAfter}" addBtn=${addBtn}`);

  // sell / delete an item: open the Inspector via the item's InspectLink (a `.linkname` button, not the whole row)
  const sellFlow = await q(`(() => {
    const link = [...document.querySelectorAll('.linkname')].find((b) => b.textContent.includes('Clothing'));
    if (!link) return 'no InspectLink for Clothing';
    link.click();
    return 'clicked InspectLink';
  })()`);
  await sleep(400);
  const disposeButtons = await q(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter((t) => /^(Sell|Delete|Remove)/.test(t))`);
  check('opening the Clothing armor item shows Sell/Delete/Remove controls (career mode)', Array.isArray(disposeButtons) && disposeButtons.length > 0, `${sellFlow}; buttons: ${JSON.stringify(disposeButtons)}`);
  await q(`(() => { const btn = [...document.querySelectorAll('button')].find(b => /^Sell/.test(b.textContent.trim())); if (btn) btn.click(); })()`);
  await sleep(300);
  const sellConfirm = await q(`!!document.querySelector('input[type=number]')`);
  check('Sell opens a price-entry step', !!sellConfirm);
  await q(`(() => { const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); window.dispatchEvent(esc); })()`); await sleep(200);

  // Journal
  await click('.tab-btn', 'Journal'); await sleep(400);
  const journalAdd = await click('button', 'Add entry');
  await sleep(300);
  check('Journal has an add-entry control', !String(journalAdd).startsWith('NOT FOUND'), String(journalAdd));

  // Drones tracker page (if present)
  const droneClick = await click('.tab-btn', 'Drones');
  if (!String(droneClick).startsWith('NOT FOUND')) {
    await sleep(400);
    const errs = await consoleErrors();
    check('Drones focus page renders cleanly with a real drone', errs.length === 0, errs.join('; '));
  } else {
    check('Drones focus page tab appears once toggled on with an owned vehicle', false, droneClick);
  }

  // Matrix tab
  const matrixClick = await click('.tab-btn', 'Matrix');
  if (!String(matrixClick).startsWith('NOT FOUND')) {
    await sleep(400);
    const errs = await consoleErrors();
    check('Matrix tab renders cleanly with a cyberdeck', errs.length === 0, errs.join('; '));
  }

  // undo/redo round trip (Undo is Build-mode only by design)
  await click('.mode-opt.build', ''); await sleep(500);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  const undoOk = await q(`(() => { const b = document.querySelector('button[title*=Undo]'); return b ? 'disabled=' + b.disabled : 'no undo button'; })()`);
  check('Undo control present in Build mode', undoOk !== 'no undo button', undoOk);

  // theme cycle (themecard radio buttons, Settings tab)
  await click('.tab-btn', 'Settings'); await sleep(400);
  const themeOk = await q(`(() => { const cards = [...document.querySelectorAll('.themecard')]; if (!cards.length) return 'no theme cards'; for (const c of cards) c.click(); return cards.length + ' themes cycled'; })()`);
  await sleep(400);
  check('theme cards cycle without throwing', (await consoleErrors()).length === 0, themeOk);
  await click('.mode-opt.play', ''); await sleep(400); // back to Play for the final error census

  const totalErrs = await consoleErrors();
  console.log('TOTAL page-level errors captured:', totalErrs.length);
  if (totalErrs.length) console.log(totalErrs.join('\\n'));
  console.log('SUMMARY:', results.filter((r) => !r.ok).length, 'failing checks of', results.length);
}
