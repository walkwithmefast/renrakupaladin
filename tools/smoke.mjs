// Headless-browser smoke test: loads dist/index.html in Edge/Chrome over CDP, drives the UI, saves screenshots.
// Usage: node tools/smoke.mjs [scenario.js]     (screenshots go to tmp/)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
// --electron: drive the desktop app instead (hidden window), with its characters folder in a temp dir
// (exported to the scenario as `charDir`) so a test never touches the real app/characters folder.
const electron = process.argv.includes('--electron');
const args = process.argv.slice(2).filter((a) => a !== '--electron');
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'crm-'));
// each run gets its own parent folder: the app keeps "rulebook/" next to "characters/", and a characters folder directly
// in the OS temp dir made every run share (and pile up edits in) one shared TEMP rulebook folder (v28 fix)
const charDir = electron ? join(mkdtempSync(join(tmpdir(), 'rp-run-')), 'characters') : null;
if (charDir) mkdirSync(charDir, { recursive: true });
const outDir = resolve('tmp');
mkdirSync(outDir, { recursive: true });

let proc;
if (electron) {
  proc = spawn(resolve('node_modules/electron/dist/electron.exe'), ['.', `--remote-debugging-port=${port}`], {
    stdio: 'ignore', env: { ...process.env, RP_CHARACTERS_DIR: charDir, RP_USER_DATA: profile, RP_HIDDEN: '1' },
  });
} else {
  const exe = BROWSERS.find(existsSync);
  if (!exe) throw new Error('No Edge/Chrome found');
  proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
    '--window-size=1440,1000', '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = list.find((t) => t.type === 'page' && (!electron || t.url.includes('index.html')));
      if (p) return p;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('browser did not start');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
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

export async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result.result.value;
}
export async function shot(name, { full = false } = {}) {
  if (electron) { console.log(`(screenshot "${name}" skipped: the hidden Electron window never paints a frame to capture)`); return; }
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  const file = join(outDir, name + '.png');
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log('screenshot', file);
}
export const click = (sel, text) => evalJS(`(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const el = ${text ? `els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}))` : 'els[0]'};
  if (!el) return 'NOT FOUND: ${sel} ${text || ''}';
  el.click(); return 'ok';
})()`);
export { sleep, logs };

await send('Page.enable');
await send('Runtime.enable');
if (!electron) await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
if (!electron) await send('Page.navigate', { url: pathToFileURL(resolve('dist/index.html')).href });
await sleep(1500);

try {
  const scenario = args[0] || 'tools/scenario.mjs';
  await (await import(pathToFileURL(resolve(scenario)).href)).default({ evalJS, shot, click, sleep, send, charDir });
} catch (e) {
  console.error('SCENARIO FAILED:', e.message);
  process.exitCode = 1;
} finally {
  console.log(logs.length ? 'PAGE LOGS:\n' + logs.join('\n') : 'no page errors');
  ws.close();
  proc.kill();
}
