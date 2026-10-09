// Build links that open a rulebook PDF at a given book page.
// SR5BOOKS[code] = { file, offset }: PDF page = printed page + offset (offsets verified by tools/book_index.py).

export const DEFAULT_PDF_FOLDER = '../../Shadowrun%205e/';

const encSegments = (path) => path.split('/').map((seg) => encodeURIComponent(seg)).join('/');

/**
 * Turn whatever the user typed into a URL prefix that ends with "/".
 * Accepts: empty (default), a Windows path (E:\Books\SR5), a POSIX path (/home/me/sr5), a file:// or http(s):// URL,
 * or a path relative to the app.
 */
export function pdfFolderUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return DEFAULT_PDF_FOLDER;
  let base = text;
  if (/^[a-zA-Z]:[\\/]/.test(text)) {
    const drive = text.slice(0, 2);
    const rest = text.slice(2).replace(/\\/g, '/');
    base = `file:///${drive}${encSegments(rest)}`;
  } else if (/^\\\\/.test(text)) {
    // UNC path: \\server\share\folder
    base = `file:${encSegments(text.replace(/\\/g, '/'))}`;
  } else if (text.startsWith('/')) {
    base = `file://${encSegments(text)}`;
  }
  return base.endsWith('/') ? base : `${base}/`;
}

/** @returns {string|null} */
export function pdfPageUrl(books, folderUrl, source, page) {
  const b = books && books[source];
  if (!b) return null;
  const p = parseInt(page, 10);
  const frag = Number.isNaN(p) ? '' : `#page=${p + (b.offset || 0)}`;
  return `${folderUrl}${encodeURIComponent(b.file)}${frag}`;
}
