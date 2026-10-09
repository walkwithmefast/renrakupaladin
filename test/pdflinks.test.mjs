import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdfFolderUrl, pdfPageUrl, DEFAULT_PDF_FOLDER } from '../src/engine/pdfLinks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const books = JSON.parse(fs.readFileSync(path.join(here, '..', 'dist', 'books.js'), 'utf8').replace(/^window\.SR5BOOKS=/, '').replace(/;\s*$/, ''));

test('folder input forms', () => {
  assert.equal(pdfFolderUrl(''), DEFAULT_PDF_FOLDER);
  assert.equal(pdfFolderUrl(String.raw`E:\Games\Shadowrun 5e`), 'file:///E:/Games/Shadowrun%205e/');
  assert.equal(pdfFolderUrl('E:/Games/Shadowrun 5e/'), 'file:///E:/Games/Shadowrun%205e/');
  assert.equal(pdfFolderUrl('/home/me/sr books'), 'file:///home/me/sr%20books/');
  assert.equal(pdfFolderUrl('https://example.com/pdfs'), 'https://example.com/pdfs/');
  assert.equal(pdfFolderUrl('../books'), '../books/');
});

test('page link = printed page + offset, file name encoded', () => {
  const url = pdfPageUrl(books, DEFAULT_PDF_FOLDER, 'SR5', '284');
  assert.equal(url, '../../Shadowrun%205e/Shadowrun%205th%20Edition.pdf#page=286');
  assert.equal(pdfPageUrl(books, DEFAULT_PDF_FOLDER, 'NOPE', '1'), null);
  assert.ok(pdfPageUrl(books, DEFAULT_PDF_FOLDER, 'SR5', '').endsWith('.pdf')); // no page -> just opens the book
});

test('every indexed book has a PDF on disk and a verified offset', () => {
  const dir = path.join(here, '..', '..', 'Shadowrun 5e');
  if (!fs.existsSync(dir)) return; // books not present on this machine
  for (const [code, b] of Object.entries(books)) {
    assert.ok(fs.existsSync(path.join(dir, b.file)), `${code}: ${b.file} exists`);
    assert.ok(Number.isInteger(b.offset), `${code}: integer offset`);
    assert.ok(b.verified, `${code}: offset verified`);
  }
});

test('corrected page numbers reach the app data (stats tables, program list, lifestyles)', async () => {
  const { dataMod } = await import('./helpers.mjs');
  const page = (file, sec, name) => Number(dataMod.idx(file, sec).list.find((x) => x.name === name && x.source === 'SR5').page);
  if (!fs.existsSync(path.join(here, '..', 'tools', 'page_fixes.json'))) return;
  assert.equal(page('gear', 'gears', 'Sony Emperor'), 439);   // commlink table is one page after Chummer's 438
  assert.equal(page('programs', 'programs', 'Track'), 246);   // program list starts on the next page
  assert.equal(page('spells', 'spells', 'Stunball'), 285);
  assert.equal(page('lifestyles', 'lifestyles', 'Squatter'), 373); // core p.373, not 369
  assert.equal(page('spells', 'spells', 'Fireball'), 284);     // already right: untouched
});
