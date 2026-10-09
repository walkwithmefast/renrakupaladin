// Build Rob the troll street sam through the real UI and check the sidebar numbers.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const side = () => q(`[...document.querySelectorAll('.side .srow')].map(r => r.innerText.replace(/\\n/g,' ')).join(' | ')`);
  const setSelect = (sel, val) => q(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); if(!s) return 'no select'; s.value = ${JSON.stringify(val)}; s.dispatchEvent(new Event('change', {bubbles:true})); return s.value; })()`);
  const tab = async (t) => { await click('.tab-btn', t); await sleep(250); };

  await click('button', 'Create a new runner');
  await sleep(300);
  // Priorities: heritage B (troll), attributes A, skills C, talent E, resources D
  await click('.prio tr:nth-child(2) td:nth-child(2) .cell');      // heritage B
  await click('.prio tr:nth-child(1) td:nth-child(4) .cell');      // attributes A
  await click('.prio tr:nth-child(3) td:nth-child(5) .cell');      // skills C
  await click('.prio tr:nth-child(4) td:nth-child(6) .cell');      // resources D
  await click('.prio tr:nth-child(5) td:nth-child(3) .cell');      // talent E
  await sleep(200);
  console.log('metatype set ->', await setSelect('.two-col select', 'Troll'));
  await sleep(200);
  // attribute dots: click the Nth dot in the row for each attribute (rating = N)
  const setAttr = (name, rating) => q(`(() => {
    const row = [...document.querySelectorAll('.attrs tbody tr')].find(r => r.querySelector('th') && r.querySelector('th').textContent.startsWith(${JSON.stringify(name)}));
    const dots = row.querySelectorAll('.dot'); dots[${rating}-1].click(); return dots.length;
  })()`);
  for (const [n, r] of [['Body', 9], ['Agility', 4], ['Reaction', 3], ['Strength', 11], ['Charisma', 3], ['Intuition', 3], ['Logic', 3], ['Willpower', 4]]) {
    try { await setAttr(n, r); } catch (e) { console.log('attr fail', n, e.message); }
    await sleep(80);
  }
  await shot('r1-build');
  console.log('SIDE after attrs:', await side());

  await tab('Skills');
  const setSkill = (name, rating) => q(`(() => {
    const row = [...document.querySelectorAll('.skrow')].find(r => r.querySelector('.linkname') && r.querySelector('.linkname').textContent.trim() === ${JSON.stringify(name)});
    if (!row) return 'missing';
    row.querySelectorAll('.dot')[${rating}-1].click(); return 'ok';
  })()`);
  console.log(await setSkill('Automatics', 5), await setSkill('Blades', 4), await setSkill('Perception', 2));
  await sleep(200);
  await shot('r2-skills');
  console.log('SIDE after skills:', await side());

  await tab('Qualities');
  await click('.panel button.primary', '+ Add');
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.modal input.search'); i.value='ambidext'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(200);
  await shot('r3-picker');
  await click('.modal button.primary', 'Add');
  await sleep(200);
  await click('.modal button.ghost'); // close
  await sleep(200);
  console.log('SIDE after quality:', await side());

  await tab('Augments');
  await click('.panel button.primary', '+ Add');
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.modal input.search'); i.value='wired reflexes'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(200);
  await click('.modal button.primary', 'Add');
  await click('.modal button.ghost');
  await sleep(300);
  await shot('r4-augments');
  console.log('SIDE after cyber:', await side());

  await tab('Gear');
  await click('.panel button.primary', '+ Add');
  await sleep(300);
  await q(`(() => { const i = document.querySelector('.modal input.search'); i.value='colt m23'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(200);
  await click('.modal button.primary', 'Add');
  await click('.modal button.ghost');
  await sleep(300);
  await shot('r5-gear');
  await tab('Sheet');
  await sleep(300);
  await shot('r6-sheet', { full: true });
  console.log('SIDE final:', await side());
  console.log('storage bytes:', await q(`(localStorage.getItem('chummer-remake.v1')||'').length`));
}
