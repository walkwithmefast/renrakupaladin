// Skills tab layout: measure page height, screenshot, then exercise spec editing and collapsing.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner');
  await sleep(300);
  await click('.tab-btn', 'Skills');
  await sleep(300);
  const setSkill = (name, rating) => q(`(() => { const r=[...document.querySelectorAll('.skrow')].find(r=>r.querySelector('.linkname')&&r.querySelector('.linkname').textContent.trim()===${JSON.stringify(name)}); r.querySelectorAll('.dot')[${rating}-1].click(); })()`);
  for (const [n, r] of [['Automatics', 5], ['Blades', 3], ['Perception', 4], ['Sneaking', 2], ['Pistols', 2], ['Computer', 3]]) { await setSkill(n, r); await sleep(60); }
  await sleep(200);
  const metrics = () => q(`(() => ({ pageH: document.documentElement.scrollHeight, viewH: innerHeight, cards: document.querySelectorAll('.skcard').length, rows: document.querySelectorAll('.skcard .skrow').length, rowH: Math.round(document.querySelector('.skcard .skrow:not(.ranked)').getBoundingClientRect().height), cols: new Set([...document.querySelectorAll('.skcard')].map(c => Math.round(c.getBoundingClientRect().left))).size }))()`);
  console.log('expanded:', JSON.stringify(await metrics()));
  await shot('sk1-expanded');
  // specialization: click "+ spec" on Automatics, type, Enter
  await q(`(() => { const r=[...document.querySelectorAll('.skrow')].find(r=>r.querySelector('.linkname')&&r.querySelector('.linkname').textContent.trim()==='Automatics'); r.querySelector('.specbtn').click(); })()`);
  await sleep(150);
  console.log('spec input focused:', await q(`document.activeElement && document.activeElement.classList.contains('spec')`));
  await q(`(() => { const i=document.activeElement; i.value='Assault Rifles'; i.blur(); })()`);
  await sleep(250);
  console.log('spec shown:', await q(`[...document.querySelectorAll('.specbtn.has')].map(b=>b.textContent.trim()).join(' | ')`));
  // collapse one category, then all
  await click('.skhead', 'Social');
  await sleep(200);
  console.log('after collapsing Social:', JSON.stringify(await metrics().catch(() => 'n/a')));
  await click('button', 'Collapse all');
  await sleep(200);
  console.log('collapsed all: pageH', await q(`document.documentElement.scrollHeight`), 'rows', await q(`document.querySelectorAll('.skcard .skrow').length`));
  await shot('sk2-collapsed');
  await click('button', 'Expand all');
  await sleep(200);
  // search auto-expands and filters
  await q(`(() => { const i=document.querySelector('input[aria-label="Find a skill"]'); i.value='pilot'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(200);
  console.log('search pilot ->', await q(`[...document.querySelectorAll('.skcard .linkname')].map(b=>b.textContent).join(', ')`));
  console.log('cost of Automatics row:', await q(`[...document.querySelectorAll('.skrow.ranked')].map(r=>r.querySelector('.linkname').textContent+':'+r.querySelector('.cost').textContent).join(' | ')`));
}
