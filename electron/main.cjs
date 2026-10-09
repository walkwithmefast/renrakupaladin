// Desktop shell: opens dist/index.html in its own window and gives the page one thing a browser page can't
// have - read/write access to the "characters" folder (see charFiles.cjs, and preload.cjs for the page side).
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('node:path');
const files = require('./charFiles.cjs');
const rulebook = require('./rulebook.cjs');

// app/characters/ when run from the project; next to the .exe for a packaged portable build.
// RP_CHARACTERS_DIR overrides it (the browser test harness points it at a temp folder).
const CHAR_DIR = process.env.RP_CHARACTERS_DIR
  || (app.isPackaged ? path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath), 'characters') : path.join(__dirname, '..', 'characters'));
if (process.env.RP_USER_DATA) app.setPath('userData', process.env.RP_USER_DATA);

// One copy at a time (per userData folder): launching again - e.g. double-clicking the .bat while the app is already
// open - focuses the open window instead of starting a second app on the same characters folder and profile. Suspected
// cause of the "the .bat gives an error" report (2026-09-24), when an older instance was still running.
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();
let mainWin = null;
app.on('second-instance', () => {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
});

// Sync IPC on purpose: the files are small, the store loads them before the first render, and the
// autosave-on-close flush runs inside `beforeunload`, which can't wait for a promise.
const reply = (e, fn) => { try { e.returnValue = { ok: true, value: fn() }; } catch (err) { e.returnValue = { ok: false, error: err.message }; } };
ipcMain.on('chars:folder', (e) => reply(e, () => CHAR_DIR));
ipcMain.on('chars:loadAll', (e) => reply(e, () => files.loadAll(CHAR_DIR)));
ipcMain.on('chars:save', (e, ch, current) => reply(e, () => files.save(CHAR_DIR, ch, files.safeName(current))));
ipcMain.handle('chars:remove', async (_e, file) => {
  const name = files.safeName(file);
  if (!name) return false;
  const full = path.join(CHAR_DIR, name);
  // to the Recycle Bin rather than gone for good; fall back to deleting if there's no bin (e.g. a USB stick)
  try { await shell.trashItem(full); } catch { try { require('node:fs').unlinkSync(full); } catch { /* already gone */ } }
  return true;
});
ipcMain.handle('chars:openFolder', () => shell.openPath(CHAR_DIR));
// descriptions read from the user's own PDFs + their edits: a "rulebook" folder next to "characters"
rulebook.setup({ charDir: CHAR_DIR, distDir: path.join(__dirname, '..', 'dist') });

function createWindow() {
  const hidden = !!process.env.RP_HIDDEN; // the test harness (tools/smoke.mjs --electron)
  const win = mainWin = new BrowserWindow({
    width: 1440, height: 960, minWidth: 720, minHeight: 500,
    show: !hidden, paintWhenInitiallyHidden: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#f3f5f8', // no dark flash before the page paints in light mode
    title: 'Renraku Paladin',
    icon: path.join(__dirname, '..', 'build', 'icon.png'), // window/taskbar icon; the packaged .exe's own file
    // icon is set separately by electron-builder (tools/make_share.mjs's `build.win.icon`)
    autoHideMenuBar: true, // Alt shows the default menu (reload, dev tools, zoom)
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  // rulebook links (file:///...pdf#page=N) open in their own window using Chromium's PDF viewer, which honors
  // #page; anything on the web goes to the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file:')) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 1000, autoHideMenuBar: true, webPreferences: { plugins: true } } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

if (firstInstance) app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
