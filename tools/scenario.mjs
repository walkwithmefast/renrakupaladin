// Default smoke scenario: create a character, poke every tab, screenshot each.
export default async function ({ evalJS, shot, click, sleep }) {
  await shot('00-welcome');
  console.log(await click('button', 'Create a new runner'));
  await sleep(400);
  await shot('01-build');
  for (const tab of ['Skills', 'Qualities', 'Magic', 'Augments', 'Gear', 'Life', 'Sheet', 'Settings']) {
    console.log(tab, await click('.tab-btn', tab));
    await sleep(300);
    await shot('tab-' + tab.toLowerCase());
  }
  console.log('body text length', await evalJS('document.body.innerText.length'));
}
