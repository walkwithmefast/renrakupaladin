// Descriptions read from the user's own rulebook PDFs, and the user's own edits to descriptions (main process).
// Both live in a "rulebook" folder next to the characters folder:
//   descriptions.json - written by the rulebook reader (tools/rulebook_reader.py; rulebook-reader.exe when packaged)
//   my-edits.json     - {id: {text, updated}} edits made with the Edit button next to a description
const { app, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function setup({ charDir, distDir }) {
  const dir = process.env.RP_RULEBOOK_DIR || path.join(path.dirname(charDir), 'rulebook');
  const DESC = path.join(dir, 'descriptions.json');
  const EDITS = path.join(dir, 'my-edits.json');
  const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
  const writeJson = (p, v) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p + '.tmp', JSON.stringify(v, null, 1), 'utf8');
    fs.renameSync(p + '.tmp', p);
  };
  const reply = (e, fn) => { try { e.returnValue = { ok: true, value: fn() }; } catch (err) { e.returnValue = { ok: false, error: err.message }; } };

  ipcMain.on('rulebook:load', (e) => reply(e, () => ({ read: readJson(DESC, null), edits: readJson(EDITS, {}) })));
  ipcMain.on('rulebook:saveEdits', (e, edits) => reply(e, () => writeJson(EDITS, edits)));
  ipcMain.on('rulebook:forget', (e) => reply(e, () => { try { fs.unlinkSync(DESC); } catch { /* none */ } }));

  ipcMain.handle('rulebook:chooseFolder', async (e, current) => {
    const r = await dialog.showOpenDialog(require('electron').BrowserWindow.fromWebContents(e.sender), {
      title: 'Choose the folder with your Shadowrun rulebook PDFs',
      defaultPath: resolveFolder(current) || undefined,
      properties: ['openDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  /** the PDF folder setting (a path, a file:// URL, a path relative to the app page, or empty = default) as a folder */
  function resolveFolder(raw) {
    const t = String(raw || '').trim();
    if (!t) return app.isPackaged ? null : path.join(distDir, '..', '..', 'Shadowrun 5e');
    if (/^file:/i.test(t)) return fileURLToPath(t);
    if (/^[a-zA-Z]:[\\/]/.test(t) || t.startsWith('\\\\') || t.startsWith('/')) return t;
    return path.resolve(distDir, decodeURIComponent(t));
  }

  let running = null;
  ipcMain.handle('rulebook:read', (e, rawFolder) => new Promise((resolve) => {
    if (running) return resolve({ ok: false, error: 'Already reading.' });
    const folder = resolveFolder(rawFolder);
    if (!folder) return resolve({ ok: false, error: 'Choose the folder with your rulebook PDFs first.' });
    if (!fs.existsSync(folder)) return resolve({ ok: false, error: `Folder not found: ${folder}` });
    const helper = app.isPackaged
      ? { cmd: path.join(process.resourcesPath, 'rulebook-reader.exe'), args: [], catalog: path.join(process.resourcesPath, 'catalog.json') }
      : { cmd: process.env.RP_PYTHON || 'python', args: [path.join(__dirname, '..', 'tools', 'rulebook_reader.py')], catalog: path.join(__dirname, '..', 'tools', 'catalog.json') };
    const child = spawn(helper.cmd, [...helper.args, '--pdfs', folder, '--catalog', helper.catalog, '--out', DESC], { windowsHide: true });
    running = child;
    let buf = '';
    let done = null;
    let error = null;
    const errTail = [];
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.done) done = msg;
        else if (msg.error) error = msg.error;
        else if (!e.sender.isDestroyed()) e.sender.send('rulebook:progress', msg);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (t) => { errTail.push(t); if (errTail.length > 40) errTail.shift(); });
    child.on('error', (err) => { running = null; resolve({ ok: false, error: `Couldn't start the rulebook reader: ${err.message}` }); });
    child.on('close', (code) => {
      running = null;
      if (done) resolve({ ok: true, summary: done });
      else if (child.killed) resolve({ ok: false, cancelled: true, error: 'Cancelled.' });
      else resolve({ ok: false, error: error || `The rulebook reader stopped unexpectedly (exit code ${code}).`, log: errTail.join('').slice(-1500) });
    });
  }));
  ipcMain.handle('rulebook:cancel', () => { if (running) running.kill(); return true; });

  return { dir };
}

module.exports = { setup };
