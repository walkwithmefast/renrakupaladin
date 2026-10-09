// Which sets of priority letters a character may use, and which tables the Resources column can use.
// Normally one each of A-E. "Street Scum" (SR5 core p.354, a campaign type, not a table in Chummer's
// priorities.xml) uses the Standard table's rows but one of two stat lines instead: B C D E E or C C D D E
// (a letter can then appear in two columns). A "line" is the character's five letters sorted, e.g. 'BCDEE'.
import { D, arr } from './data.js';
import { PRIORITY_KEYS } from './rules.js';

export const STANDARD_LINE = 'ABCDE';
export const STREET_SCUM = 'Street Scum';
const LINES = { [STREET_SCUM]: ['BCDEE', 'CCDDE'] };
/** tables that have no rows of their own in the game data, and whose rows they borrow */
const ROWS_FROM = { [STREET_SCUM]: 'Standard' };

/** every choice for the "Resources table" select: Chummer's tables, plus Street Scum */
export const priorityTables = () => [...arr(D.priorities && D.priorities.prioritytables), STREET_SCUM];
/** the table in the game data whose Resources rows `table` uses */
export const resourceRowsTable = (table) => ROWS_FROM[table] || table || 'Standard';
/** where the rule is written up, for tables that aren't in Chummer's data */
export const tableSource = (table) => (table === STREET_SCUM ? { source: 'SR5', page: 354 } : null);

/** the stat lines allowed with this resources table */
export const priorityLines = (table) => LINES[table] || [STANDARD_LINE];
/** true when the table offers a choice of stat lines (Street Scum) */
export const hasLineChoice = (table) => priorityLines(table).length > 1;
/** the character's current letters, sorted */
export const priorityLineOf = (pri) => PRIORITY_KEYS.map((c) => pri[c]).sort().join('');
export const validPriorityLine = (pri, table) => priorityLines(table).includes(priorityLineOf(pri));

/** re-letter every column from `line`, keeping their current order (best letter first; ties keep column order) */
export function applyPriorityLine(pri, line) {
  const cols = [...PRIORITY_KEYS].sort((a, b) => String(pri[a]).localeCompare(String(pri[b])) || PRIORITY_KEYS.indexOf(a) - PRIORITY_KEYS.indexOf(b));
  const letters = [...line].sort();
  const out = { ...pri };
  cols.forEach((c, i) => { out[c] = letters[i]; });
  return out;
}

/** can `col` take `letter` given the current line? (always yes if the current letters are already off-line) */
export function letterAllowed(pri, table, col, letter) {
  if (pri[col] === letter) return true;
  return !validPriorityLine(pri, table) || priorityLineOf(pri).includes(letter);
}
