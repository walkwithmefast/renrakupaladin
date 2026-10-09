// Layout measurements for the visual pass (not a test): top bar rows, the Metatype & talent gap, the Finish button.
export default async function ({ evalJS, click, sleep }) {
  const q = (js) => evalJS(js);
  await click('button', 'Create a new runner'); await sleep(500);
  console.log(await q(`(() => {
    const top = document.querySelector('.top').getBoundingClientRect();
    const tools = document.querySelector('.tools').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    const need = [...document.querySelector('.top').children].reduce((s, c) => s + c.getBoundingClientRect().width, 0);
    const p = [...document.querySelectorAll('.panel')].find(x => x.querySelector('h3')?.textContent.startsWith('Metatype'));
    const h = p.querySelector('header').getBoundingClientRect(), first = p.children[1].getBoundingClientRect();
    const kids = [...p.children].map(c => c.tagName + '.' + c.className + ' h=' + Math.round(c.getBoundingClientRect().height) + ' mt=' + getComputedStyle(c).marginTop);
    const fin = [...document.querySelectorAll('.side > *')].map(c => c.tagName + '.' + c.className + ' h=' + Math.round(c.getBoundingClientRect().height) + ' border-top=' + getComputedStyle(c).borderTopWidth + ' pad=' + getComputedStyle(c).padding);
    return JSON.stringify({ topH: Math.round(top.height), tabsRight: Math.round(tabs.right), toolsLeft: Math.round(tools.left), toolsW: Math.round(tools.width), childrenW: Math.round(need), metaGap: Math.round(first.top - h.bottom), metaKids: kids, side: fin }, null, 1);
  })()`));
}
