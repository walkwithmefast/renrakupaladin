// v23: critter powers + A.I. programs panels (Build Qualities / Programs, Sheet, Play Matrix), mentor free-power picker.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  check('mundane human: no critter panel, just a small "+ Critter powers" link', await q(`![...document.querySelectorAll('.panel h3')].some(h => /Critter powers/.test(h.textContent)) && [...document.querySelectorAll('button.link')].some(b => b.textContent.includes('Critter powers'))`));
  console.log('patched:', await q(`(() => {
    const KEY = 'chummer-remake.v1';
    const st = JSON.parse(localStorage.getItem(KEY));
    const ch = st.chars[st.currentId];
    const D = window.SR5DATA;
    ch.info.name = 'Extras Tester';
    ch.pri = { heritage: 'E', talent: 'B', attributes: 'A', skills: 'C', resources: 'D' };
    ch.talent = 'Adept';
    const cp = D.critterpowers.powers.find((p) => p.name === 'Natural Weapon');
    const arm = D.critterpowers.powers.find((p) => p.name === 'Armor');
    ch.critterPowers = [{ uid: 'c1', id: cp.id, name: cp.name, extra: 'Claws' }, { uid: 'c2', id: arm.id, name: arm.name, rating: 2 }];
    const ai = D.programs.programs.find((p) => p.category === 'Advanced Programs');
    ch.aiPrograms = [{ uid: 'a1', id: ai.id, name: ai.name }];
    ch.gear.push({ uid: 'cl', id: D.gear.gears.find((g) => g.category === 'Commlinks' && g.name !== 'Living Persona').id, name: 'link' });
    const mq = D.qualities.qualities.find((x) => x.name === 'Mentor Spirit');
    ch.qualities.push({ uid: 'mq', id: mq.id, name: mq.name, choice: {} });
    ch.mentor = 'Holy Text';
    ch.mentorChoice = D.mentors.mentors.find((m) => m.name === 'Holy Text').choices.find((c) => c.bonus && c.bonus.selectpowers).name;
    localStorage.setItem(KEY, JSON.stringify(st));
    return ai.name;
  })()`));
  await q(`location.reload()`); await sleep(1500);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  const panel = await q(`[...document.querySelectorAll('.panel')].find(p => /Critter powers/.test(p.querySelector('h3')?.textContent || ''))?.textContent || ''`);
  check('Critter powers panel lists both', /Natural Weapon/.test(panel) && /Claws/.test(panel) && /Armor/.test(panel), panel.slice(0, 160));
  check('Armor critter power shows its effect', /Armor \+2/.test(panel), panel.slice(0, 200));
  const free = await q(`[...document.querySelector('select[aria-label="Free power"]')?.options || []].map(o => o.textContent).join(' | ')`);
  check('mentor free power picker offers Mystic Armor / Empathic Healing', /Mystic Armor/.test(free) && /Empathic Healing/.test(free) && !/Improved Reflexes/.test(free), free);
  await q(`(() => { const s = document.querySelector('select[aria-label="Free power"]'); const o = [...s.options].find(o => o.textContent.startsWith('Mystic Armor')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  await shot('extras-qualities', { full: true });
  await click('.tab-btn', 'Magic'); await sleep(300);
  check('Magic tab: Mystic Armor free from the mentor', /Mystic Armor/.test(await q(`document.querySelector('.granted')?.textContent || ''`)));
  await click('.tab-btn', 'Gear'); await sleep(300);
  await click('button', 'Programs'); await sleep(300);
  check('Build Programs: A.I. programs panel', await q(`[...document.querySelectorAll('.panel h3')].some(h => /A\\.I\\. programs/.test(h.textContent))`));
  await click('.mode-opt', 'Play'); await sleep(300);
  await click('.tab-btn', 'Sheet'); await sleep(300);
  check('Sheet lists critter powers', /Critter powers/.test(await q(`document.querySelector('.qual-cols')?.parentElement.textContent || ''`)));
  await click('.tab-btn', 'Matrix'); await sleep(300);
  check('Play Matrix: A.I. programs read-only', await q(`(() => { const p = [...document.querySelectorAll('.panel')].find(p => /A\\.I\\. programs/.test(p.querySelector('h3')?.textContent || '')); return !!p && !p.querySelector('button.primary'); })()`));
  // the Inspector opens for a critter power
  await click('.tab-btn', 'Sheet'); await sleep(200);
  await q(`[...document.querySelectorAll('.qual-cols ~ div a, .qual-cols ~ div button')].find(b => /Natural Weapon/.test(b.textContent))?.click()`); await sleep(400);
  check('Inspector opens for a critter power', /Critter power/.test(await q(`document.querySelector('.drawer')?.textContent || ''`)));
}
