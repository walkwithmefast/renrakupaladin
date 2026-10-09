// Desktop app: Settings -> read descriptions from a PDF folder, then edit / revert / add a description in the drawer.
// Run:  RP_TEST_PDFS=<folder with a few rulebook PDFs>  node tools/smoke.mjs --electron tools/scenario_rulebook.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export default async function ({ evalJS, click, sleep, charDir }) {
  const q = (js) => evalJS(js);
  const rbDir = join(dirname(charDir), 'rulebook');
  const edits = () => { try { return JSON.parse(readFileSync(join(rbDir, 'my-edits.json'), 'utf8')); } catch { return null; } };
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  // a plain text <input>'s onChange needs the native 'input' event to fire reliably here (unlike a <select>,
  // where 'change' is enough) - 'change' alone silently no-ops on the PDF-folder field, so RP_TEST_PDFS never
  // actually took effect and this scenario was really scanning the real Shadowrun 5e folder the whole time.
  const setInput = (sel, v) => q(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const drawer = () => q(`(() => { const d = document.querySelector('.drawer'); if (!d) return null; const ex = d.querySelector('.excerpt'); return JSON.stringify({ title: d.querySelector('h3').textContent, head: ex && ex.querySelector('h4').textContent, text: ex && ex.querySelector('blockquote') ? ex.querySelector('blockquote').textContent.slice(0, 60) : null, add: [...d.querySelectorAll('button')].some(b => /Add (a|your own) description/.test(b.textContent)) }); })()`);

  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Settings'); await sleep(300);
  check('Browse… button shown in the desktop app', (await q(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Browse…')`)));
  await setInput('input[placeholder="../../Shadowrun 5e/"]', process.env.RP_TEST_PDFS); await sleep(200);
  await click('button', 'Read descriptions from my PDFs');
  const seen = new Set();
  for (let t = 0; t < 240; t++) {
    await sleep(1000);
    const s = await q(`document.querySelector('.readprog .small')?.textContent || ''`);
    if (s) seen.add(s.replace(/\(\d+ of \d+\)/, '(…)'));
    if (!(await q(`!!document.querySelector('.readprog')`))) break;
  }
  console.log('progress labels seen:', [...seen].slice(0, 6).join(' | '));
  const summary = await q(`document.querySelector('.readdesc')?.innerText`);
  console.log('summary:', summary.replace(/\s+/g, ' ').slice(-330));
  check('descriptions file written next to characters', existsSync(join(rbDir, 'descriptions.json')));
  check('summary lists the non-rulebook PDF as not recognized', /Not recognized[^]*Character-Sheet/.test(summary));

  // edit a description
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.textContent.startsWith('Ambidextrous')).querySelector('td').click()`); await sleep(400);
  const before = JSON.parse(await drawer());
  check('rulebook text shown with an Edit button', /From the rulebook/.test(before.head) && /Edit/.test(before.head), before.text);
  await click('.drawer .excerpt .edit'); await sleep(200);
  check('editor opens pre-filled with the book text', (await q(`document.querySelector('.drawer textarea[aria-label="Description"]').value.slice(0, 20)`)) === before.text.slice(0, 20));
  await q(`(() => { const t = document.querySelector('.drawer textarea[aria-label="Description"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'Works with either hand.\\n\\nHouse rule: no off-hand penalty.'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(150);
  await click('.drawer .excerpt button', 'Save'); await sleep(300);
  const after = JSON.parse(await drawer());
  check('edited text shown, marked as your edit', /your edit/.test(after.head) && after.text.startsWith('Works with either hand.'), after.head);
  const e1 = edits();
  const id = e1 && Object.keys(e1)[0];
  check('edit saved to rulebook/my-edits.json', !!id && e1[id].text.includes('House rule'), id);

  await q(`location.reload()`); await sleep(2000);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  await q(`[...document.querySelectorAll('.pick tbody tr')].find(r => r.textContent.startsWith('Ambidextrous')).querySelector('td').click()`); await sleep(400);
  check('edit survives a restart', JSON.parse(await drawer()).text.startsWith('Works with either hand.'));
  await click('.drawer .linkish', 'Revert'); await sleep(300);
  const reverted = JSON.parse(await drawer());
  check('revert brings the book text back', /From the rulebook/.test(reverted.head) && reverted.text === before.text);
  check('...and removes the saved edit', JSON.stringify(edits()) === '{}');

  // an item with no description at all
  const bare = await q(`(() => { const r = [...document.querySelectorAll('.pick tbody tr')].find(r => { const id = window.SR5DATA.qualities.qualities.find(x => x.name === r.querySelector('td').textContent)?.id; return id && !window.SR5TEXT[id]; }); if (!r) return null; r.querySelector('td').click(); return r.querySelector('td').textContent; })()`);
  await sleep(300);
  const b = JSON.parse(await drawer());
  check('item with no description offers "Add a description"', b.add && !b.head, bare);
  await click('.drawer button', 'Add a description'); await sleep(200);
  await q(`(() => { const t = document.querySelector('.drawer textarea[aria-label="Description"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'My own notes on this one.'); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); })()`); await sleep(300);
  const b2 = JSON.parse(await drawer());
  check('Ctrl+Enter saves a brand-new description', /your edit/.test(b2.head) && b2.text.startsWith('My own notes'));
  check('"Remove your description" offered (no book text to revert to)', await q(`[...document.querySelectorAll('.drawer .linkish')].some(b => b.textContent.includes('Remove your description'))`));
}
