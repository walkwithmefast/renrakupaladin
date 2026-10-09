// Desktop app character files: run with  node tools/smoke.mjs --electron tools/scenario_files.mjs
// New -> file appears; edits mark Save dirty; tab change / Build->Play / Save button / Ctrl+S / closing the window
// all commit to the file (renaming it to match the character's name); menu Duplicate/Delete; Export all -> Import.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function ({ evalJS, shot, click, sleep, charDir }) {
  const q = (js) => evalJS(js);
  const ls = () => readdirSync(charDir).sort().join(' | ') || '(empty)';
  const nameInFile = (f) => { try { return JSON.parse(readFileSync(join(charDir, f), 'utf8')).info.name; } catch (e) { return 'ERR ' + e.message; } };
  const saveBtn = () => q(`document.querySelector('.savebtn')?.textContent`);
  const setName = async (v) => {
    // Character -> Rename… (the top bar's name box moved there in v17)
    await click('.charmenu > button'); await sleep(120);
    await click('.charmenu .menu button', 'Rename'); await sleep(200);
    await q(`(() => { const i = document.querySelector('.modal input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)});
      i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(120);
    await click('.modal footer button', 'Save'); await sleep(200);
  };
  const menu = async (label) => { await click('.charmenu > button'); await sleep(150); const r = await click('.charmenu .menu button', label); await sleep(400); return r; };
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);

  console.log('rpFiles present:', await q(`!!window.rpFiles`), ' folder:', ls());
  await click('button', 'Create a new runner'); await sleep(500);
  check('New creates a file immediately', ls() === 'Unnamed runner.rp.json', ls());
  check('Save button clean after create', (await saveBtn()) === 'Saved');

  await setName('Kestrel');
  check('edit marks Save dirty', (await saveBtn()) === 'Save');
  check('...but the file is untouched until saved', ls() === 'Unnamed runner.rp.json', ls());
  await click('.tab-btn', 'Skills'); await sleep(400);
  check('changing page autosaves + renames the file', ls() === 'Kestrel.rp.json' && nameInFile('Kestrel.rp.json') === 'Kestrel', ls());
  check('Save button clean again', (await saveBtn()) === 'Saved');

  await setName('Kestrel B');
  await click('.mode-opt', 'Play'); await sleep(400);
  check('Build -> Play autosaves', ls() === 'Kestrel B.rp.json', ls());
  await click('.mode-opt', 'Build'); await sleep(300);

  await setName('Kestrel C');
  await click('.savebtn'); await sleep(300);
  check('Save button saves', ls() === 'Kestrel C.rp.json', ls());

  await setName('Kestrel D');
  await q(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))`); await sleep(300);
  check('Ctrl+S saves', ls() === 'Kestrel D.rp.json', ls());

  await click('.charmenu > button'); await sleep(200);
  console.log('menu items:', await q(`[...document.querySelectorAll('.charmenu .menu button')].map(b => b.textContent).join(' / ')`));
  console.log('top bar buttons outside menu:', await q(`[...document.querySelectorAll('.top .tools > button, .top .tools > .charmenu > button')].map(b => b.textContent || b.title).join(' / ')`));
  await shot('files-menu');
  await q(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`); await sleep(150);
  check('menu closes on outside click', !(await q(`!!document.querySelector('.charmenu .menu')`)));

  await setName('Kestrel E');
  await q(`location.reload()`); await sleep(2000);
  check('closing/reloading the window saves unsaved edits', ls() === 'Kestrel E.rp.json', ls());
  check('...and it loads back from the folder', (await q(`document.querySelector('.top select')?.selectedOptions[0]?.textContent`)) === 'Kestrel E');

  await menu('New character');
  check('menu New creates a second file', ls() === 'Kestrel E.rp.json | Unnamed runner.rp.json', ls());
  await q(`[...document.querySelectorAll('.top select option')].find(o => o.textContent === 'Kestrel E').selected = true;
    document.querySelector('.top select').dispatchEvent(new Event('change', { bubbles: true }))`); await sleep(300);
  await menu('Duplicate');
  check('menu Duplicate writes the copy', ls() === 'Kestrel E (copy).rp.json | Kestrel E.rp.json | Unnamed runner.rp.json', ls());
  await setName('Twin');
  await q(`[...document.querySelectorAll('.top select option')].find(o => o.textContent === 'Kestrel E').selected = true;
    document.querySelector('.top select').dispatchEvent(new Event('change', { bubbles: true }))`); await sleep(300);
  check('switching character autosaves the one you left', ls() === 'Kestrel E.rp.json | Twin.rp.json | Unnamed runner.rp.json', ls());

  // Export all: catch the download instead of letting Electron open a Save dialog, then feed it back to Import
  await q(`window.__blobs = []; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blobs.push(b); return oc(b); };
    HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; }`);
  await menu('Export all characters');
  const bundle = await q(`window.__blobs[0].text()`);
  const parsed = JSON.parse(bundle);
  check('Export all bundles every character', parsed.format === 'renraku-paladin-characters' && parsed.characters.length === 3, `${parsed.characters.length} chars, file "${await q('window.__dl')}"`);

  // since v20 Delete asks with the app's own ConfirmDialog (not the native confirm()) - click its Delete button
  const del = await menu('Delete character');
  await sleep(200);
  await q(`[...document.querySelectorAll('.modal button')].find(b => b.textContent.trim() === 'Delete')?.click()`);
  await sleep(500);
  check('menu Delete removes the file', del === 'ok' && ls() === 'Twin.rp.json | Unnamed runner.rp.json', ls());

  await q(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(bundle)}], 'all.rp.json', { type: 'application/json' }));
    const i = document.querySelector('.charmenu input[type=file]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(800);
  console.log('import report:', await q(`document.querySelector('.modal .body p')?.textContent`));
  check('importing the bundle writes a file per character', ls() === 'Kestrel E.rp.json | Twin (2).rp.json | Twin.rp.json | Unnamed runner (2).rp.json | Unnamed runner.rp.json', ls());
}
