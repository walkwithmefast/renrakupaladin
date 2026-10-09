// Tiny safe expression evaluator for Chummer-style data expressions:
//   "Rating * 100", "(Rating * 3)R", "FixedValues(100,200,300)", "Variable(500-1000)",
//   "{STR} + 2", "number(Rating > 3)", "Gear Cost * 2", "(Rating - MinRating + 1) * 5000"
// No eval / Function: a small recursive-descent parser.

// longest first, so "Parent Gear Cost" isn't eaten by "Gear Cost" (v28 fix - Chemical Gland Expanded Reservoir priced 0)
const MULTIWORD = ['Parent Gear Cost', 'Children Cost', 'Gear Cost', 'Weapon Cost', 'Armor Cost', 'Parent Cost', 'Parent Rating', 'Min Rating', 'Vehicle Cost', 'Body Cost']
  .sort((a, b) => b.length - a.length);

function tokenize(src) {
  let s = src;
  for (const w of MULTIWORD) s = s.split(w).join(w.replace(/ /g, '_'));
  s = s.replace(/[{}]/g, '');
  const out = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z_0-9]*)|(>=|<=|==|!=|[-+*/(),<>=]))/gy;
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < s.length) {
    const start = re.lastIndex;
    m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(start))) break;
      return null;
    }
    if (m[1] !== undefined) out.push({ t: 'n', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
  }
  return out;
}

/**
 * Evaluate an expression.
 * @param {string|number} src
 * @param {object} vars  variable bag; keys are matched case-insensitively (Rating, MinRating, STR ...)
 * @returns {number} NaN when unparseable
 */
export function evalExpr(src, vars = {}) {
  if (typeof src === 'number') return src;
  if (src == null) return 0;
  const str = String(src).trim();
  if (str === '') return 0;
  if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  const toks = tokenize(str);
  if (!toks) return NaN;
  const lower = {};
  for (const k of Object.keys(vars)) lower[k.toLowerCase().replace(/ /g, '_')] = vars[k];
  let i = 0;
  const peek = () => toks[i];
  const eat = (v) => {
    const t = toks[i];
    if (t && t.t === 'op' && t.v === v) { i++; return true; }
    return false;
  };

  function parseCmp() {
    let a = parseAdd();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && ['>', '<', '>=', '<=', '=', '==', '!='].includes(t.v)) {
        i++;
        const b = parseAdd();
        if (t.v === '>') a = a > b ? 1 : 0;
        else if (t.v === '<') a = a < b ? 1 : 0;
        else if (t.v === '>=') a = a >= b ? 1 : 0;
        else if (t.v === '<=') a = a <= b ? 1 : 0;
        else if (t.v === '!=') a = a !== b ? 1 : 0;
        else a = a === b ? 1 : 0;
      } else return a;
    }
  }
  function parseAdd() {
    let a = parseMul();
    for (;;) {
      if (eat('+')) a += parseMul();
      else if (eat('-')) a -= parseMul();
      else return a;
    }
  }
  function parseMul() {
    let a = parseUnary();
    for (;;) {
      if (eat('*')) a *= parseUnary();
      else if (eat('/')) { const b = parseUnary(); a = b === 0 ? 0 : a / b; }
      else return a;
    }
  }
  function parseUnary() {
    if (eat('-')) return -parseUnary();
    if (eat('+')) return parseUnary();
    return parsePrimary();
  }
  function parseArgs() {
    const args = [];
    if (eat(')')) return args;
    do { args.push(parseCmp()); } while (eat(','));
    if (!eat(')')) throw new Error('expected )');
    return args;
  }
  function parsePrimary() {
    const t = toks[i++];
    if (!t) throw new Error('unexpected end');
    if (t.t === 'n') return t.v;
    if (t.t === 'op' && t.v === '(') {
      const v = parseCmp();
      if (!eat(')')) throw new Error('expected )');
      return v;
    }
    if (t.t === 'id') {
      const name = t.v.toLowerCase();
      if (peek() && peek().t === 'op' && peek().v === '(') {
        i++;
        if (name === 'fixedvalues') {
          // FixedValues(a,b,c) -> pick by Rating (1-based). Each arg may carry an avail letter, e.g. 4R.
          const raw = [];
          let depth = 1;
          let cur = '';
          // re-scan tokens ourselves so letters like 4R survive
          const parts = [];
          while (i < toks.length && depth > 0) {
            const tk = toks[i++];
            if (tk.t === 'op' && tk.v === '(') { depth++; cur += '('; }
            else if (tk.t === 'op' && tk.v === ')') { depth--; if (depth > 0) cur += ')'; }
            else if (tk.t === 'op' && tk.v === ',' && depth === 1) { parts.push(cur); cur = ''; }
            else cur += tk.v;
          }
          parts.push(cur);
          raw.push(...parts);
          const r = Math.max(1, Math.min(raw.length, Math.round(lower.rating ?? 1)));
          return parseFloat(String(raw[r - 1]).replace(/[^0-9.\-]/g, '')) || 0;
        }
        if (name === 'variable') {
          const args = parseArgs();
          const lo = args[0] ?? 0;
          return lower.variable ?? lo;
        }
        const args = parseArgs();
        if (name === 'number') return args[0] ? 1 : 0;
        if (name === 'min') return Math.min(...args);
        if (name === 'max') return Math.max(...args);
        if (name === 'ceil' || name === 'ceiling') return Math.ceil(args[0]);
        if (name === 'floor') return Math.floor(args[0]);
        if (name === 'round') return Math.round(args[0]);
        return NaN;
      }
      const v = lower[name];
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (name === 'rating' || name === 'minrating' || name === 'min_rating') return 0;
      return 0;
    }
    throw new Error('bad token');
  }

  try {
    // FixedValues(4R,8R,12F): the '4R' tokenises as number then id; handled inside via raw concat.
    const v = parseCmp();
    if (i < toks.length) return NaN;
    return v;
  } catch (e) {
    return NaN;
  }
}

/** Variable(500-1000) -> {min:500,max:1000} or null */
export function variableRange(src) {
  const m = /Variable\(\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)/i.exec(String(src || ''));
  return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : null;
}

/**
 * Availability string -> { n: number, flag: '' | 'R' | 'F', mod: boolean }
 * "12R" "(Rating * 3)F" "+2" "FixedValues(4R,8R,12F)"
 */
export function evalAvail(src, vars = {}) {
  if (src == null || src === '') return { n: 0, flag: '', mod: false };
  const s = String(src).trim();
  const mod = s.startsWith('+');
  let flag = '';
  let body = s;
  // detect flag from FixedValues by rating
  if (/^FixedValues/i.test(s)) {
    const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')).split(',').map((x) => x.trim());
    const r = Math.max(1, Math.min(inner.length, Math.round(vars.Rating ?? vars.rating ?? 1)));
    body = inner[r - 1];
  }
  // "12R or Gear" (Chemical Gland): the gland's own availability; the "or <parent>" part can't be known here
  body = body.replace(/\s+or\s+\w[\w ]*$/i, '');
  const m = /([RF])\s*$/.exec(body);
  if (m) { flag = m[1]; body = body.slice(0, m.index); }
  const n = evalExpr(body.replace(/^\+/, ''), vars);
  return { n: Number.isNaN(n) ? 0 : Math.round(n), flag, mod };
}

export function fmtAvail(a) {
  if (!a) return '';
  return (a.mod ? '+' : '') + a.n + a.flag;
}

export function evalNum(src, vars = {}, fallback = 0) {
  const v = evalExpr(src, vars);
  return Number.isNaN(v) ? fallback : v;
}
