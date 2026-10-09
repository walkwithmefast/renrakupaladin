import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'dist', 'data.js'), 'utf8');
globalThis.window = globalThis;
(0, eval)(src);
const blurbPath = path.join(here, '..', 'dist', 'blurbs.js');
if (fs.existsSync(blurbPath)) (0, eval)(fs.readFileSync(blurbPath, 'utf8'));

export const engine = await import('../src/engine/character.js');
export const expr = await import('../src/engine/expr.js');
export const dataMod = await import('../src/engine/data.js');
