import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const watch = process.argv.includes('--watch');
const prod = !watch;

if (!existsSync('dist/data.js')) {
  console.log('dist/data.js missing - building game data...');
  execSync('python tools/build_data.py', { stdio: 'inherit' });
}

// The fillable character-sheet PDF (project root, next to Chummer5.226.0/ and Shadowrun 5e/) gets embedded
// as base64 in a plain script-tag-loaded JS file, the same way data.js/books.js/blurbs.js are - a page
// opened via file:// (double-clicking the app, no server) generally can't fetch() a sibling file, but a
// <script src> loads one fine, so every asset this app needs at runtime goes in through that door.
const PDF_SRC = '../SR5-Character-Sheet-Form-20120717.pdf';
if (existsSync(PDF_SRC)) {
  const b64 = readFileSync(PDF_SRC).toString('base64');
  writeFileSync('dist/sheetTemplate.js', `window.SR5_SHEET_PDF=${JSON.stringify(b64)};\n`);
  console.log(`embedded ${PDF_SRC} -> dist/sheetTemplate.js (${(b64.length / 1e6).toFixed(2)} MB base64)`);
} else {
  writeFileSync('dist/sheetTemplate.js', 'window.SR5_SHEET_PDF=null;\n');
  console.log(`${PDF_SRC} not found - dist/sheetTemplate.js written as a stub; the PDF export button will hide itself`);
}

const opts = {
  entryPoints: { app: 'src/main.jsx' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.js': 'jsx' },
  minify: prod,
  sourcemap: !prod,
  logLevel: 'info',
};

copyFileSync('src/index.html', 'dist/index.html');
copyFileSync('build/icon.png', 'dist/icon.png'); // favicon (index.html) - the window/.exe icons come from build/icon.png|.ico directly
if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('watching...');
} else {
  await esbuild.build(opts);
}
