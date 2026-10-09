// Career money and Karma during play: the ledger (ch.career.log) behind the top-bar Wallet and the Journal.
// Nuyen and Karma are earned into ch.career.nuyenEarned / .earned (derive() adds them to the totals); buying things
// is already counted by derive() at list price (unless the item is marked free - loot / a GM gift). Lifestyle rent is
// paid by adding a month to each lifestyle, which derive() also counts, so a rent entry records months, not cash.
import { num } from './data.js';

const LOG_MAX = 300;

/** a ledger timestamp that is unique within the log (two entries in the same millisecond used to share an id, so
 *  undo could pick the wrong one) */
const stamp = (c) => Math.max(Date.now(), ...c.log.map((e) => (Number(e.t) || 0) + 1));

function career(x) {
  x.career = { earned: 0, log: [], nuyenEarned: 0, ...(x.career || {}) };
  x.career.log = [...(x.career.log || [])];
  return x.career;
}

/** earn (amt > 0) or spend (amt < 0) nuyen, or award Karma; returns the new entry */
export function addEntry(x, kind, amt, note = '') {
  const c = career(x);
  const a = Math.round(Number(amt) || 0);
  if (!a) return null;
  if (kind === 'karma') c.earned = num(c.earned) + a;
  else c.nuyenEarned = num(c.nuyenEarned) + a;
  const e = { t: stamp(c), kind: kind === 'karma' ? 'karma' : 'nuyen', amt: a, note: String(note || '').trim() };
  c.log = [...c.log, e].slice(-LOG_MAX);
  return e;
}

/** a month of every lifestyle, in nuyen (what "Pay rent" costs) */
export function monthlyRent(d) {
  return d.items.lifestyles.reduce((s, e) => s + Math.round(e.cost / Math.max(1, num(e.it.months, 1))), 0);
}

/** pay one more month of every lifestyle; logged so it can be undone */
export function payRent(x, d) {
  const lifes = d.items.lifestyles;
  if (!lifes.length) return null;
  const c = career(x);
  const amt = monthlyRent(d); // before adding the months: it's worked out from the months already paid
  const uids = [];
  for (const e of lifes) {
    const t = x.lifestyles.find((z) => z.uid === e.it.uid);
    if (!t) continue;
    t.months = num(t.months, 1) + 1;
    uids.push(t.uid);
  }
  const names = lifes.map((e) => e.def.name).join(', ');
  const entry = { t: stamp(c), kind: 'rent', amt: -amt, note: `Lifestyle: ${names} (1 month)`, uids };
  c.log = [...c.log, entry].slice(-LOG_MAX);
  return entry;
}

/** remove a ledger entry and reverse what it did (a typo'd payment, rent paid twice, ...) */
export function undoEntry(x, t) {
  const c = career(x);
  const e = c.log.find((z) => z.t === t);
  if (!e) return false;
  const kind = entryKind(e);
  if (kind === 'karma') c.earned = num(c.earned) - e.amt;
  else if (kind === 'nuyen') c.nuyenEarned = num(c.nuyenEarned) - e.amt;
  else if (e.kind === 'sold' || e.kind === 'discard') {
    c.nuyenEarned = num(c.nuyenEarned) - (e.amt - e.cost);
    x[e.list] = [...(x[e.list] || []), ...(e.items || []).filter((it) => !(x[e.list] || []).some((z) => z.uid === it.uid))];
  } else if (e.kind === 'rent') {
    for (const u of e.uids || []) { const l = x.lifestyles.find((z) => z.uid === u); if (l) l.months = Math.max(1, num(l.months, 1) - 1); }
  }
  c.log = c.log.filter((z) => z !== e);
  return true;
}

/** entries written without a kind (creation carry-over, the Build sidebar's Karma award, Chummer import) were
 *  always Karma - they used to show as nuyen ("+7¥") and undoing one didn't take the Karma back (v28 fix) */
export const entryKind = (e) => e.kind || 'karma';

/** how an entry reads in a ledger: "+5,000¥", "−200¥", "+3 Karma" */
export function entryAmount(e, nuyen) {
  if (entryKind(e) === 'karma') return `${e.amt > 0 ? '+' : '−'}${Math.abs(e.amt)} Karma`;
  if (e.kind === 'discard') return 'Deleted';
  if (e.kind === 'sold') return `+${nuyen(e.amt)}`;
  return `${e.amt > 0 ? '+' : '−'}${nuyen(Math.abs(e.amt))}`;
}

export const QUICK_REASONS = {
  earn: ['Run payment', 'Sold gear', 'Found / loot', 'Bonus', 'Loan'],
  spend: ['Gear / ammo', 'Bribe', 'Medical', 'Travel', 'Fixer fee', 'Repairs'],
};

// ---- selling / throwing away what you own (finished characters) ----------------------------------------------
// derive() counts every owned item at its price, so simply removing one would refund it in full. Selling credits
// what you actually got instead; deleting (lost, destroyed, used up) keeps the money spent. Both are ledger entries,
// and undoing one puts the item(s) back.

/** remove an owned item (gear: with everything bundled under it) from a draft; returns the removed items */
export function removeOwned(x, kind, uid) {
  const list = x[kind] || [];
  const doomed = new Set([uid]);
  if (kind === 'gear') {
    for (let grew = true; grew;) {
      grew = false;
      for (const g of list) if (g.parent && doomed.has(g.parent) && !doomed.has(g.uid)) { doomed.add(g.uid); grew = true; }
    }
  }
  const removed = list.filter((z) => doomed.has(z.uid));
  x[kind] = list.filter((z) => !doomed.has(z.uid));
  return removed;
}

/** what the removed items were counted at (their price incl. mods; 0 for loot / gifts / bundled parts) */
function countedCost(d, kind, uids) {
  const entries = kind === 'cyberware' || kind === 'bioware' ? d.augs.filter((a) => a.kind === kind) : d.items[kind] || [];
  return entries.filter((e) => uids.has(e.it.uid)).reduce((s, e) => s + (e.cost || 0), 0);
}

function dispose(x, d, kind, uid, price, how) {
  const c = career(x);
  const removed = removeOwned(x, kind, uid);
  if (!removed.length) return null;
  const cost = countedCost(d, kind, new Set(removed.map((z) => z.uid)));
  const got = how === 'sold' ? Math.max(0, Math.round(Number(price) || 0)) : 0;
  c.nuyenEarned = num(c.nuyenEarned) + got - cost; // cancels the refund removal would give, then adds the sale
  const name = removed[0].label || removed[0].name;
  const entry = { t: stamp(c), kind: how, amt: got, cost, list: kind, items: removed, note: how === 'sold' ? `Sold ${name}` : name };
  c.log = [...c.log, entry].slice(-LOG_MAX);
  return entry;
}
/** sell an owned item for `price` */
export const sellItem = (x, d, kind, uid, price) => dispose(x, d, kind, uid, price, 'sold');
/** delete an owned item without a refund (lost, destroyed, used up) */
export const discardItem = (x, d, kind, uid) => dispose(x, d, kind, uid, 0, 'discard');
/** the default asking price shown when selling: half what it was counted at */
export const suggestedSale = (cost) => Math.round((cost || 0) / 2);
