// Plain-browser fallback (Firefox / share zip): localStorage as before, Save shows "Saved", menu works,
// PDF fill still works under the new Content-Security-Policy, Export all bundles everything.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.charmenu > button'); await sleep(120); await click('.charmenu .menu button', 'Rename'); await sleep(200);
  await q(`(() => { const i = document.querySelector('.modal input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Browser Bob'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(120); await click('.modal footer button', 'Save');
  await sleep(300);
  console.log('save button:', await q(`(() => { const b = document.querySelector('.savebtn'); return b.textContent + ' disabled=' + b.disabled; })()`));
  await click('button', 'Create a new runner'); // not on screen - just making sure nothing throws
  await click('.charmenu > button'); await sleep(200);
  await shot('files-menu-browser');
  await q(`window.__blobs = []; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blobs.push(b); return oc(b); };
    HTMLAnchorElement.prototype.click = function () { window.__dl = (window.__dl || []).concat(this.download); }`);
  await click('.charmenu .menu button', 'Fill PDF character sheet'); await sleep(4000);
  console.log('pdf:', await q(`JSON.stringify({ files: window.__dl, bytes: window.__blobs[0]?.size })`));
  await click('.charmenu > button'); await sleep(150);
  await click('.charmenu .menu button', 'New character'); await sleep(300);
  await click('.charmenu > button'); await sleep(150);
  await click('.charmenu .menu button', 'Export all characters'); await sleep(300);
  console.log('bundle:', await q(`window.__blobs[1].text().then(t => { const o = JSON.parse(t); return o.format + ' x' + o.characters.length + ' ' + window.__dl[1]; })`));
  await q(`location.reload()`); await sleep(1500);
  console.log('after reload, still in browser storage:', await q(`[...document.querySelectorAll('.top select option')].map(o => o.textContent).join(', ')`));
}
