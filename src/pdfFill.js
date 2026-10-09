// Fills the embedded character-sheet PDF template (window.SR5_SHEET_PDF, see build.mjs) with a character's
// data - src/engine/pdfExport.js does the actual field-name mapping, pure and unit-tested; this file is
// the part that needs pdf-lib and browser Blob/anchor APIs, so it isn't tested the same way.
import { PDFDocument } from 'pdf-lib';
import { sheetFields } from './engine/pdfExport.js';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const sheetPdfAvailable = () => !!window.SR5_SHEET_PDF;

/**
 * Fill the character-sheet PDF template and download it, named after the character. Left fillable (not
 * flattened) so the player can still tweak anything by hand afterward.
 * @returns {Promise<{missing: string[]}>} field names the template didn't actually have, if any - not
 *   fatal, just means this particular copy of the form doesn't have that field.
 */
export async function exportCharacterSheet(ch, d) {
  if (!window.SR5_SHEET_PDF) throw new Error('No character-sheet PDF template is bundled with this copy of the app.');
  const { text, check } = sheetFields(ch, d);
  const pdfDoc = await PDFDocument.load(base64ToBytes(window.SR5_SHEET_PDF));
  const form = pdfDoc.getForm();
  const missing = [];
  for (const [name, value] of Object.entries(text)) {
    try { form.getTextField(name).setText(value); } catch { missing.push(name); }
  }
  for (const name of Object.keys(check)) {
    try { form.getCheckBox(name).check(); } catch { missing.push(name); }
  }
  try { form.updateFieldAppearances(); } catch { /* most viewers still render fine without this */ }
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ((ch.info.alias || ch.info.name || 'character').replace(/[^\w\- ]+/g, '').trim() || 'character') + '.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { missing };
}
