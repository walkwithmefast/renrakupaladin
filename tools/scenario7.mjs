// Does the browser's PDF viewer honor #page=N for the links the app generates?
export default async function ({ evalJS, shot, sleep, send }) {
  const mk = (code, page) => evalJS(`(() => { const b = window.SR5BOOKS[${JSON.stringify(code)}]; return new URL('../../Shadowrun 5e/' + encodeURIComponent(b.file) + '#page=' + (${page} + b.offset), location.href).href; })()`);
  const url = await mk('SR5', 284);
  console.log('link:', url);
  await send('Page.navigate', { url });
  for (let i = 0; i < 6; i++) { await sleep(5000); }
  await shot('pdf-fireball');
}
