// (v28: rows open the drawer since v2 - the old info buttons are gone)
// Info drawer opened from inside an "Add" picker must sit above the picker, be clickable, and not close it.
export default async function ({ evalJS, shot, click, sleep }) {
  const q = (js) => evalJS(js);
  const state = () => q(`(() => {
    const m = document.querySelector('.modal-back'), d = document.querySelector('.drawer');
    const z = (el) => el ? +getComputedStyle(el).zIndex : null;
    let hit = null;
    if (d) { const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 60); hit = d.contains(el) ? 'drawer' : (el && el.className); }
    return JSON.stringify({ modal: !!m, modalZ: z(m), drawer: !!d, drawerZ: z(d), hitAtDrawer: hit });
  })()`);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Qualities'); await sleep(300);
  await click('button', '+ Add'); await sleep(400);
  console.log('picker open:', await state());
  await q(`document.querySelectorAll('.modal tbody tr')[0].click()`); await sleep(400);
  console.log('after info click:', await state());
  await shot('layering-drawer-over-picker');
  // a real mouse-down on the drawer must not reach the picker's backdrop
  await q(`(() => { const d = document.querySelector('.drawer'); const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 60); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); })()`); await sleep(200);
  console.log('after mousedown in drawer:', await state());
  // a second info button re-raises / swaps the drawer, still on top
  await q(`document.querySelectorAll('.modal tbody tr')[1].click()`); await sleep(300);
  console.log('second info:', await state());
  await q(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`); await sleep(300);
  console.log('after Escape (drawer closes, picker stays):', await state());
  await q(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`); await sleep(300);
  console.log('after 2nd Escape (picker closes):', await state());
}
