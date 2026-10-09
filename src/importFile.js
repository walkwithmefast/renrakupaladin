// Read files chosen in the Import dialog: Chummer5a saves (.chum5, XML) or our own .rp.json exports
// (older exports from before the "Renraku Paladin" rename used a .crm.json extension - still readable,
// since import only looks at the content, not the file name).
import { importChum5 } from './engine/chummerImport.js';
import { importChar, importChars, setReport, BUNDLE_FORMAT } from './store.js';

export async function importFiles(fileList) {
  const errors = [];
  for (const f of [...fileList]) {
    try {
      const text = await f.text();
      const trimmed = text.replace(/^\uFEFF/, '').trimStart();
      if (trimmed.startsWith('<')) {
        const { ch, report } = importChum5(trimmed);
        importChar(ch);
        setReport(report);
      } else {
        let obj;
        try { obj = JSON.parse(trimmed); } catch { throw new Error('Not a Chummer5a save (.chum5) or a Renraku Paladin export (.json).'); }
        if (obj && obj.format === BUNDLE_FORMAT && Array.isArray(obj.characters)) { // an "Export all" file
          const chars = importChars(obj.characters);
          setReport({ name: `${chars.length} character${chars.length === 1 ? '' : 's'}`, imported: {}, unmatched: [], notes: [], checks: [], plain: true, count: chars.length });
          continue;
        }
        if (!obj || !obj.attrs || !obj.pri) {
          throw new Error('This JSON is not a Renraku Paladin export. Chummer5a saves characters as .chum5 (XML) files - choose one of those instead.');
        }
        importChar(obj);
        setReport({ name: (obj.info && (obj.info.alias || obj.info.name)) || 'Character', imported: {}, unmatched: [], notes: [], checks: [], plain: true });
      }
    } catch (e) {
      errors.push(`${f.name}: ${e.message}`);
    }
  }
  if (errors.length) alert(errors.join('\n'));
}
