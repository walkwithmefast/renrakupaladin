// Builds the copy to hand to someone else: `node tools/make_share.mjs` -> ../Renraku Paladin (share).zip
// containing a single portable "Renraku Paladin.exe" (Electron, no install, no Node.js) and a readme.
// The .exe carries rulebook-reader.exe (tools/rulebook_reader.py + PyMuPDF, built with PyInstaller - needs
// `pip install pyinstaller pymupdf`) and tools/catalog.json, so the other person can read descriptions out of
// their own PDFs (Settings -> Rulebook PDFs).
// Packages from a staging folder so the real dist/blurbs.js (rulebook text quoted from the user's own PDFs)
// can never end up inside - it's replaced by an empty stub. See PROJECT_STATUS.md "Distributing a copy".
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const INCLUDE_SHEET_PDF = true; // the user OK'd sharing the fan-made fillable sheet (2026-09-23)
const root = resolve('.');
const stage = resolve('tmp/share/stage');
const out = resolve('tmp/share/out');
const zipDir = resolve('tmp/share/zip/Renraku Paladin');
const zipFile = resolve('../Renraku Paladin (share).zip');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

execSync('node build.mjs', { stdio: 'inherit' });
if (!existsSync('tools/catalog.json')) execSync('python tools/build_data.py', { stdio: 'inherit' });
// the catalog ships: make sure it's names/pages only, never quoted rulebook text
const walk = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(walk) : []);
const longest = walk(JSON.parse(readFileSync('tools/catalog.json', 'utf8'))).reduce((a, b) => (b.length > a.length ? b : a), '');
if (longest.length > 120) throw new Error(`tools/catalog.json has a ${longest.length}-character string - that looks like rulebook text, not a name: "${longest.slice(0, 80)}..."`);
// retry: Windows Defender often holds a just-written archive open for a few seconds after a build
rmSync(resolve('tmp/share'), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(join(stage, 'dist'), { recursive: true });
mkdirSync(join(stage, 'extra'), { recursive: true });

// the rulebook reader as a standalone exe (no Python needed on the other computer). Excluding what PyMuPDF
// can optionally use but the reader doesn't keeps it ~28 MB instead of ~105 MB.
const EXCLUDE = ['numpy', 'PIL', 'tkinter', 'matplotlib', 'scipy', 'pandas', 'IPython', 'jedi', 'pygments', 'setuptools',
  'pkg_resources', 'lxml', 'cryptography', 'sqlite3', 'unittest', 'pydoc_data', 'xmlrpc', 'email', 'http', 'test', 'distutils'];
execSync(`python -m PyInstaller --onefile --name rulebook-reader --noconfirm --log-level ERROR --distpath "${resolve('tmp/share/helper')}" `
  + `--workpath "${resolve('tmp/share/pyi')}" --specpath "${resolve('tmp/share/pyi')}" ${EXCLUDE.map((m) => `--exclude-module ${m}`).join(' ')} tools/rulebook_reader.py`, { stdio: 'inherit' });
copyFileSync('tmp/share/helper/rulebook-reader.exe', join(stage, 'extra', 'rulebook-reader.exe'));
copyFileSync('tools/catalog.json', join(stage, 'extra', 'catalog.json'));

for (const f of ['index.html', 'app.js', 'app.css', 'data.js', 'books.js', 'icon.png']) copyFileSync(join('dist', f), join(stage, 'dist', f));
writeFileSync(join(stage, 'dist', 'blurbs.js'), 'window.SR5TEXT={}; window.SR5DRUGS={};\n');
if (INCLUDE_SHEET_PDF) copyFileSync('dist/sheetTemplate.js', join(stage, 'dist', 'sheetTemplate.js'));
else writeFileSync(join(stage, 'dist', 'sheetTemplate.js'), 'window.SR5_SHEET_PDF=null;\n');
cpSync('electron', join(stage, 'electron'), { recursive: true });

writeFileSync(join(stage, 'package.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, description: pkg.description, author: 'Renraku Paladin', main: 'electron/main.cjs',
  build: {
    appId: 'app.renrakupaladin',
    productName: 'Renraku Paladin',
    electronVersion: pkg.devDependencies.electron.replace(/^\D+/, ''),
    electronDist: join(root, 'node_modules', 'electron', 'dist'),
    npmRebuild: false,
    directories: { output: out },
    files: ['electron/**', 'dist/**', 'package.json'],
    // next to app.asar in resources/ - electron/rulebook.cjs runs the reader from there
    extraResources: [{ from: 'extra/rulebook-reader.exe', to: 'rulebook-reader.exe' }, { from: 'extra/catalog.json', to: 'catalog.json' }],
    // no code signing (that step downloads winCodeSign, whose archive needs symlink privileges to unpack) -
    // but the icon is set via rcedit, which electron-builder bundles separately and doesn't need that download.
    icon: join(root, 'build', 'icon.ico'),
    win: { target: ['portable'], signAndEditExecutable: false },
    portable: { artifactName: 'Renraku Paladin.exe' },
  },
}, null, 2));

execSync(`"${join(root, 'node_modules', '.bin', 'electron-builder.cmd')}" --win portable --projectDir "${stage}"`, { stdio: 'inherit' });

// belt and braces: confirm what actually went into the package
const asar = join(out, 'win-unpacked', 'resources', 'app.asar');
const { extractFile, listPackage } = await import('@electron/asar');
const listed = listPackage(asar, {}).map((p) => p.replace(/\\/g, '/'));
const blurbs = extractFile(asar, 'dist/blurbs.js').toString();
if (blurbs.length > 100 || /[A-Za-z]{20}/.test(blurbs.replace(/SR5TEXT|SR5DRUGS|window/g, ''))) throw new Error('blurbs.js in the package is not the stub!');
console.log(`package contents (${listed.length}):`, listed.filter((p) => !p.endsWith('/')).join(', '));
console.log('blurbs.js in package:', blurbs.trim());
console.log('sheetTemplate.js in package:', extractFile(asar, 'dist/sheetTemplate.js').length, 'bytes');
for (const f of ['rulebook-reader.exe', 'catalog.json']) {
  const p = join(out, 'win-unpacked', 'resources', f);
  if (!existsSync(p)) throw new Error(`${f} is missing from the package`);
  console.log(`${f} in package:`, (readFileSync(p).length / 1e6).toFixed(1), 'MB');
}

mkdirSync(zipDir, { recursive: true });
copyFileSync(join(out, 'Renraku Paladin.exe'), join(zipDir, 'Renraku Paladin.exe'));
writeFileSync(join(zipDir, 'Read me first.txt'), readFileSync('tools/share_readme.txt', 'utf8').replace(/\r?\n/g, '\r\n'));
if (existsSync(zipFile)) rmSync(zipFile);
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${zipDir}' -DestinationPath '${zipFile}'"`, { stdio: 'inherit' });
console.log('wrote', zipFile);
