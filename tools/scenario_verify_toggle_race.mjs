export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(400);
  await click('.tab-btn', 'Settings'); await sleep(400);
  // fire both Focus-page checkbox clicks in the SAME synchronous tick (the exact repro that lost the first toggle before)
  const after = await q(`(() => {
    const boxes = [...document.querySelectorAll('input[type=checkbox]')].filter((c) => /drone|magic/i.test(c.closest('label')?.textContent || ''));
    boxes.forEach((c) => c.click());
    return null;
  })()`);
  await sleep(400);
  const focusPages = await q(`JSON.parse(localStorage.getItem('chummer-remake.v1')).settings.focusPages`);
  console.log('focusPages after two synchronous clicks:', JSON.stringify(focusPages));
  // since v22 both pages default to ON, so two clicks must leave both OFF (neither toggle lost)
  const ok = focusPages && focusPages.drone === false && focusPages.magic === false;
  console.log(ok ? 'PASS: neither toggle was lost' : 'FAIL: a toggle was lost');
}
