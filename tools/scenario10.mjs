export default async function ({ evalJS, click, sleep, send }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(300);
  await click('.tab-btn', 'Skills'); await sleep(300);
  await q(`(() => { const r=[...document.querySelectorAll('.skrow')].find(r=>r.querySelector('.linkname').textContent.trim()==='Automatics'); r.querySelectorAll('.dot')[2].click(); })()`);
  await sleep(200);
  await q(`[...document.querySelectorAll('.skrow')].find(r=>r.querySelector('.linkname').textContent.trim()==='Automatics').querySelector('.specbtn').click()`);
  await sleep(200);
  // real typing via CDP so React-style events fire like a user
  await send('Input.insertText', { text: 'Assault Rifles' });
  await sleep(100);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(400);
  console.log('stored skills:', await q(`(() => { const s = JSON.parse(localStorage.getItem('chummer-remake.v1')); const c = s.chars[s.currentId]; return JSON.stringify(c.skills); })()`));
  console.log('spec buttons:', await q(`[...document.querySelectorAll('.specbtn')].map(b => b.className + ':' + b.textContent.trim()).join(' | ')`));
}
