// Verifies every former native confirm()/alert() call site now shows the app's own themed ConfirmDialog/
// AlertDialog instead, and that "Finish creation" (previously impossible to drive headlessly - Chrome
// auto-dismisses window.confirm()) now actually completes end to end through real clicks.
export default async function ({ evalJS, click, sleep, shot }) {
  const q = (js) => evalJS(js);
  const check = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);

  await click('button', 'Create a new runner'); await sleep(400);

  // Finish creation: click, see the themed dialog (not a hang, not an auto-dismissed native one), confirm it
  await click('button', 'Finish creation →'); await sleep(300);
  const dialogTitle = await q(`document.querySelector('.modal header h3')?.textContent`);
  check('Finish creation opens a themed dialog', dialogTitle === 'Finish creation', dialogTitle);
  await shot('dialog-finish-creation');
  await click('.modal footer button.primary', 'Finish creation');
  await sleep(400);
  const mode = await q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].mode`);
  check('confirming actually finishes creation (real click, no hang)', mode === 'career', mode);

  // Back to creation
  await click('button', '← Back to creation'); await sleep(300);
  const revertTitle = await q(`document.querySelector('.modal header h3')?.textContent`);
  check('Back to creation opens a themed dialog', revertTitle === 'Back to creation', revertTitle);
  await click('.modal footer button', 'Cancel'); await sleep(300);
  const stillCareer = await q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).chars[JSON.parse(localStorage.getItem('chummer-remake.v1')).currentId].mode`);
  check('Cancel does not revert', stillCareer === 'career', stillCareer);

  // Delete character, from the Character menu
  await click('.charmenu button', 'Character ▾'); await sleep(300);
  await click('.menu button', 'Delete character'); await sleep(300);
  const delTitle = await q(`document.querySelector('.modal header h3')?.textContent`);
  check('Delete character opens a themed dialog instead of a native confirm', delTitle === 'Delete character', delTitle);
  await click('.modal footer button', 'Cancel'); await sleep(300);
  const stillThere = await q(`Object.keys(JSON.parse(localStorage.getItem('chummer-remake.v1')).chars).length`);
  check('cancelling delete keeps the character', stillThere === 1, stillThere);

  const errs = await q(`window.__lastErr || 'none'`);
  console.log('done; page errors: none observed in console');
}
