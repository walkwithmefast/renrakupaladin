// One-off check (not a reusable scenario): loads the flat distributable folder directly, outside app/,
// to confirm it boots standalone with no console errors and the app actually renders.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = BROWSERS.find(existsSync);
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'crm-share-'));
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1440,1000', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p; } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('no target');
}
const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) logs.push(`console.${msg.params.type}: ` + msg.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result.result.value; };

await send('Page.enable');
await send('Runtime.enable');
const url = pathToFileURL(resolve('../dist-share/Renraku Paladin/index.html')).href;
console.log('loading:', url);
await send('Page.navigate', { url });
await sleep(1500);

console.log('title:', await evalJS('document.title'));
console.log('welcome heading:', await evalJS(`document.querySelector('.welcome h1')?.textContent`));
console.log('SR5TEXT is empty object:', await evalJS(`JSON.stringify(window.SR5TEXT)`));
console.log('SR5DATA loaded (gear count):', await evalJS(`window.SR5DATA.gear.gears.length`));

// create a character and open the Inspector for something that WOULD have an excerpt, to confirm graceful fallback
await evalJS(`document.querySelector('.welcome button.primary.big').click()`);
await sleep(500);
await evalJS(`(() => { const b = [...document.querySelectorAll('.tab-btn')].find(x=>x.textContent==='Qualities'); b.click(); })()`);
await sleep(400);
console.log('qualities tab loaded ok:', await evalJS(`!!document.querySelector('.panel')`));

console.log('---console/page errors---');
console.log(logs.length ? logs.join('\n') : '(none)');

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(resolve('tmp/share-check.png'), Buffer.from(shot.result.data, 'base64'));
console.log('screenshot saved');
proc.kill();
