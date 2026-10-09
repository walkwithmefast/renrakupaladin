// Fake SIN switcher for the Play-mode Sheet header: pick which identity you're broadcasting, and the character's
// real name gets covered by that SIN's ID card (engine/identity.js has the data side).
import { useState, useEffect, useRef } from 'preact/hooks';
import { fakeSins, activeSin, setActiveSin, setSinBurned, SIN_PAGE } from '../engine/identity.js';
import { idx } from '../engine/data.js';
import { uid as newUid } from '../engine/character.js';
import { bookUrl, cx, Stepper } from './common.jsx';

const RATING_MAX = 6;

function RatingPips({ rating }) {
  return (
    <span class="sin-pips" aria-label={`Rating ${rating}`}>
      {Array.from({ length: RATING_MAX }, (_, i) => <i key={i} class={cx(i < rating && 'on')} />)}
    </span>
  );
}

/** the ID card laid over the real name */
export function SinCard({ sin }) {
  return (
    <span class={cx('sin-card', sin.burned && 'burned')} key={sin.uid}
      title={[sin.burned && 'BURNED: flagged as a fake - it fails any SIN check', sin.licenses.length ? `Licenses: ${sin.licenses.join(', ')}` : 'No licenses on this SIN'].filter(Boolean).join('\n')}>
      <span class="sin-holo" aria-hidden="true" />
      <span class="sin-body">
        <span class="sin-kicker">{sin.burned ? 'SIN · flagged' : 'SIN · active'}</span>
        <b class="sin-name">{sin.label}</b>
      </span>
      <span class="sin-side">
        <span class="sin-r">R{sin.rating}</span>
        <RatingPips rating={sin.rating} />
      </span>
      <span class="sin-code" aria-hidden="true" />
      {sin.burned && <span class="sin-stamp" aria-label="Burned">Burned</span>}
    </span>
  );
}

/**
 * A name on the sheet that a fake SIN can cover. Renders the text as-is when no SIN is active; otherwise the text is
 * blurred behind the SIN's card (both share one grid cell, so the card never spills onto the text after it).
 */
export function CoverableName({ name, sin, as: Tag = 'span' }) {
  if (!sin) return <Tag>{name}</Tag>;
  return (
    <Tag class="covered-name">
      <span class="real" aria-hidden="true">{name}</span>
      <span class="sr-only">Real name hidden while using the SIN {sin.label}</span>
      <SinCard sin={sin} />
    </Tag>
  );
}

/** "Identity ▾" pill + menu: your own identity or one of your fake SINs */
export function IdentityPicker({ ch, d, update }) {
  const [open, setOpen] = useState(false);
  const [burning, setBurning] = useState(''); // uid awaiting the second "yes, burn it" click
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  useEffect(() => { if (!open) setBurning(''); }, [open]);
  const [buying, setBuying] = useState(false); // "+ New Fake SIN" form open
  const [newRating, setNewRating] = useState(3);
  const [newAlias, setNewAlias] = useState('');
  const sins = fakeSins(d.items.gear);
  const career = ch.mode === 'career';
  // used to hide entirely with none owned, so there was no way to buy a first one from here at all
  if (!sins.length && !career) return null;
  const sin = activeSin(ch, d.items.gear);
  const choose = (uid) => { update((x) => setActiveSin(x, uid), { record: false }); setOpen(false); };
  const rename = (uid, text) => update((x) => { const g = x.gear.find((z) => z.uid === uid); if (g) g.notes = text; });
  const burn = (uid, on) => { update((x) => setSinBurned(x, uid, on)); setBurning(''); };
  const buySin = () => {
    const def = idx('gear', 'gears').byName.get('fake sin');
    if (!def) return;
    update((x) => { x.gear.push({ uid: newUid(), id: def.id, name: def.name, rating: newRating, notes: newAlias.trim() }); });
    setBuying(false); setNewRating(3); setNewAlias('');
  };
  const url = bookUrl('SR5', SIN_PAGE);
  const ownName = ch.info.name || ch.info.alias || 'Own identity';
  return (
    <div class="idpick" ref={wrapRef}>
      <button type="button" class={cx('pip idpick-btn', sin && 'on')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="lbl">ID</span> {sin ? sin.label : ownName}{sin && sin.burned && <span class="burn-tag">burned</span>} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div class="menu idmenu" role="menu">
          <button type="button" role="menuitemradio" aria-checked={!sin} class={cx(!sin && 'on')} onClick={() => choose('')}>
            <span class="grow"><b>{ownName}</b><small>no cover - your real name shows</small></span>
          </button>
          <hr />
          {sins.map((s) => (
            <div key={s.uid} class={cx('idrow', sin && sin.uid === s.uid && 'on', s.burned && 'burned')}>
              <button type="button" role="menuitemradio" aria-checked={!!(sin && sin.uid === s.uid)} onClick={() => choose(s.uid)}>
                <span class="grow">
                  <b>{s.label}{s.burned && <span class="burn-tag">burned</span>}</b>
                  <small>{s.burned ? 'flagged as fake - fails any SIN check · ' : ''}{s.licenses.length ? `${s.licenses.length} license${s.licenses.length === 1 ? '' : 's'}: ${s.licenses.join(', ')}` : 'no licenses'}</small>
                </span>
                <span class="sin-side"><span class="sin-r">R{s.rating}</span><RatingPips rating={s.rating} /></span>
              </button>
              <div class="idactions">
                {s.burned ? (
                  <button type="button" class="ghost sm" onClick={() => burn(s.uid, false)}>Un-burn</button>
                ) : burning === s.uid ? (
                  <>
                    <span class="dim small">Burn {s.label}?</span>
                    <button type="button" class="danger sm" onClick={() => burn(s.uid, true)}>Yes, it's burned</button>
                    <button type="button" class="ghost sm" onClick={() => setBurning('')}>Cancel</button>
                  </>
                ) : (
                  <button type="button" class="ghost sm" onClick={() => setBurning(s.uid)}>Mark burned…</button>
                )}
              </div>
              {!s.alias && (
                <input class="idname" placeholder="Name on this SIN…" aria-label={`Name on ${s.label}`}
                  onChange={(e) => { const t = e.currentTarget.value.trim(); if (t) rename(s.uid, t); }} />
              )}
            </div>
          ))}
          {career && (
            <>
              <hr />
              {buying ? (
                <div class="idrow idbuy">
                  <label class="field"><span class="lbl">Rating</span><Stepper value={newRating} min={1} max={RATING_MAX} onChange={setNewRating} /></label>
                  <input class="idname" placeholder="Name on this SIN… (optional)" aria-label="Name on the new SIN" value={newAlias}
                    onInput={(e) => setNewAlias(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && buySin()} />
                  <div class="idactions">
                    <span class="dim small">{newRating * 2500}¥</span>
                    <button type="button" class="primary sm" onClick={buySin}>Buy</button>
                    <button type="button" class="ghost sm" onClick={() => setBuying(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" class="ghost sm idbuybtn" onClick={() => setBuying(true)}>+ New Fake SIN…</button>
              )}
            </>
          )}
          {url && <a class="src idsrc" href={url} target="_blank" rel="noopener">Fake SINs: SR5 core p.{SIN_PAGE} ↗</a>}
        </div>
      )}
    </div>
  );
}
