// Top-bar Wallet (Play mode, finished characters): get paid, spend, award Karma, pay rent, undo - mid-session in
// two clicks. Shares the ledger with the Journal tab (engine/money.js).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { addEntry, payRent, undoEntry, monthlyRent, entryAmount, QUICK_REASONS } from '../engine/money.js';
import { trustFundPayout, trustFundIncomeText } from '../engine/qualityPerks.js';
import { nuyen, cx } from './common.jsx';

const PRESETS = [100, 500, 1000, 5000, 10000];

export function Wallet() {
  const { ch, d, update } = useChar();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('');
  const [karma, setKarma] = useState('');
  const [note, setNote] = useState('');
  const wrap = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  if (ch.mode !== 'career') return null;

  const n = Math.round(Number(String(amt).replace(/[^\d.]/g, '')) || 0);
  const k = Math.round(Number(karma) || 0);
  const go = (kind, value) => { update((x) => addEntry(x, kind, value, note), { record: false }); setAmt(''); setKarma(''); setNote(''); };
  const rent = monthlyRent(d);
  const log = [...((ch.career && ch.career.log) || [])].reverse().slice(0, 6);
  return (
    <div class="wallet" ref={wrap}>
      <button type="button" class={cx('walletbtn', d.nuyen.left < 0 && 'bad')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}
        title="Wallet: get paid, spend, award Karma">
        <b>{nuyen(d.nuyen.left)}</b><span class="dim"> · {d.karma.left} K</span>
      </button>
      {open && (
        <div class="walletpop" role="dialog" aria-label="Wallet">
          <div class="wrow">
            <input class="wamt" inputMode="numeric" placeholder="Nuyen" value={amt} aria-label="Amount of nuyen" autoFocus
              onInput={(e) => setAmt(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && n > 0 && go('nuyen', n)} />
            <button type="button" class="primary" disabled={n <= 0} onClick={() => go('nuyen', n)}>+ Earn</button>
            <button type="button" disabled={n <= 0} onClick={() => go('nuyen', -n)}>− Spend</button>
          </div>
          <div class="chips">{PRESETS.map((p) => <button key={p} type="button" class="chip ghost" onClick={() => setAmt(String((n || 0) + p))}>+{nuyen(p)}</button>)}</div>
          <input class="wnote" placeholder="What for? (optional)" value={note} aria-label="What for" onInput={(e) => setNote(e.currentTarget.value)} />
          <div class="chips">
            {[...QUICK_REASONS.earn, ...QUICK_REASONS.spend].map((r) => <button key={r} type="button" class={cx('chip', note === r ? 'on' : 'ghost')} onClick={() => setNote(r)}>{r}</button>)}
          </div>
          <div class="wrow">
            <input class="wk" inputMode="numeric" placeholder="Karma" value={karma} aria-label="Karma to award" onInput={(e) => setKarma(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && k > 0 && go('karma', k)} />
            <button type="button" disabled={k <= 0} onClick={() => go('karma', k)}>+ Award Karma</button>
            {rent > 0 && <button type="button" class="ghost" title="Adds a month to each lifestyle" onClick={() => update((x) => payRent(x, d), { record: false })}>Pay rent ({nuyen(rent)})</button>}
          </div>
          {d.trustFund && (
            <div class="wrow">
              <button type="button" title="Run Faster p.151: the trust fund's monthly money on top of the lifestyle it pays (dice are rolled for you)"
                onClick={() => { const p = trustFundPayout(d.trustFund.level); if (p) update((x) => addEntry(x, 'nuyen', p.amt, p.note), { record: false }); }}>
                + Trust fund payout ({trustFundIncomeText(d.trustFund.level)}¥)
              </button>
            </div>
          )}
          {log.length > 0 && (
            <ul class="plain ledger">
              {log.map((e) => (
                <li key={e.t}>
                  <b class={cx(e.amt < 0 && 'bad')}>{entryAmount(e, nuyen)}</b> <span class="dim">{e.note}</span>
                  <button type="button" class="ghost sm" title="Undo this entry" aria-label={`Undo ${entryAmount(e, nuyen)}`} onClick={() => update((x) => undoEntry(x, e.t), { record: false })}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <p class="hint">Buying items already comes out of your nuyen. Loot or gifts: tick <b>Didn't pay for it</b> on the item.</p>
        </div>
      )}
    </div>
  );
}
