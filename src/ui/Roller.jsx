// The dice roller: a small "roll this pool" button dropped next to any pool number, and a shared modal
// that actually rolls it, reading hits/glitches and letting you spend a real Edge point on Push the Limit
// or Second Chance (core p.44-46, 56-57). Edge actions only apply in Play mode, since Edge spent/burned is
// play state (ch.play), not something that makes sense to track while still building the character.
import { useEffect, useState } from 'preact/hooks';
import { useStore, useChar, openRoll, closeRoll, viewModeOf } from '../store.js';
import { rollPool, rollPushLimit, rerollSecondChance, calledShotPool, CALLED_SHOT_PENALTY, CALLED_SHOT_PAGE } from '../engine/dice.js';
import { edgeAvailable, spendEdge, playState, woundModifier } from '../engine/edge.js';
import { Modal, bookUrl, cx } from './common.jsx';
import { DieIcon } from './icons.jsx';
import { RANGED, MELEE, DEFENSE, ENVIRONMENT, COMPENSATION, COMBAT_PAGES, combatModifier, exclusiveWith } from '../engine/combatMods.js';

/** a small dice-icon button that opens the roll tray for a given pool. `attack`: this is a weapon's
 * attack pool, so the tray offers a "called shot" (-4) toggle. */
/** kind: 'ranged' | 'melee' | 'defense' opens the tray with that roll's situational modifiers; rc = the weapon's RC */
export function RollButton({ pool, label, class: klass, disabled, attack, kind, rc }) {
  const n = Math.max(0, Math.round(pool || 0));
  return (
    <button type="button" class={cx('rollbtn', klass)} disabled={disabled || n <= 0}
      title={`Roll ${label}: ${n} dice`} aria-label={`Roll ${label}`}
      onClick={(e) => { e.stopPropagation(); openRoll({ label, pool: n, attack: !!attack, kind: kind || (attack ? 'ranged' : null), rc }); }}><DieIcon /></button>
  );
}

function Die({ v }) {
  return <span class={cx('die', v >= 5 && 'hit', v === 1 && 'one')}>{v}</span>;
}

/** the situational modifiers for an attack or defense roll (engine/combatMods.js); reports the total upward */
function CombatMods({ spec, d, play, onChange }) {
  const kind = spec.kind;
  const list = kind === 'ranged' ? RANGED : kind === 'melee' ? MELEE : DEFENSE;
  const wound = woundModifier(play, d); // same as the Sheet's wound modifier (High Pain Tolerance included)
  const [picks, setPicks] = useState(() => new Set());
  const [useWound, setUseWound] = useState(true);
  const [env, setEnv] = useState({});
  const [comp, setComp] = useState(() => new Set());
  const [bullets, setBullets] = useState(0);
  const [prev, setPrev] = useState(0);
  const [reach, setReach] = useState(0);
  const toggle = (id) => setPicks((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else { n.add(id); for (const x of exclusiveWith(id)) n.delete(x); } return n; });
  const flip = (id) => setComp((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const res = combatModifier(kind, picks, { wound: useWound ? wound : 0, env, comp, str: d.attr.STR.total, rc: Number(spec.rc) || 0, bullets, previousDefenses: prev, reach });
  useEffect(() => { onChange(res.total); }, [res.total]);
  const page = COMBAT_PAGES[kind];
  const url = bookUrl('SR5', page);
  return (
    <details class="combatmods" open>
      <summary>Situation <span class={cx('pip', res.total < 0 && 'bad', res.total > 0 && 'on')}>{res.total > 0 ? '+' : ''}{res.total} dice</span>
        {url && <a class="src" href={url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>SR5 p.{page} ↗</a>}</summary>
      <div class="cm-grid">
        {list.map(([id, label, v]) => (
          <label key={id} class="check"><input type="checkbox" checked={picks.has(id)} onChange={() => toggle(id)} /> {label} <small>{v > 0 ? '+' : ''}{v}</small></label>
        ))}
        {wound > 0 && <label class="check"><input type="checkbox" checked={useWound} onChange={(e) => setUseWound(e.currentTarget.checked)} /> Wound modifier <small>−{wound}</small></label>}
      </div>
      {(kind === 'ranged' || kind === 'melee') && (
        <div class="cm-env">
          {Object.entries(ENVIRONMENT).filter(([col]) => kind === 'ranged' || col === 'visibility' || col === 'light').map(([col, specC]) => (
            <label key={col} class="field"><span class="lbl">{specC.label}</span>
              <select value={env[col] || specC.options[0][0]} onChange={(e) => setEnv((o) => ({ ...o, [col]: e.currentTarget.value }))}>
                {specC.options.map(([l]) => <option key={l}>{l}</option>)}
              </select>
            </label>
          ))}
          <div class="cm-comp"><span class="lbl">You have</span>
            {COMPENSATION.filter(([id]) => kind === 'ranged' || !['imagemag', 'tracer', 'smartlink'].includes(id)).map(([id, label]) => (
              <label key={id} class="check"><input type="checkbox" checked={comp.has(id)} onChange={() => flip(id)} /> {label}</label>
            ))}
          </div>
        </div>
      )}
      {kind === 'ranged' && (
        <label class="field cm-num"><span class="lbl">Bullets fired since you last stopped (incl. this attack)</span>
          <input type="number" min="0" max="50" value={bullets} onInput={(e) => setBullets(Math.max(0, Number(e.currentTarget.value) || 0))} />
          <small>compensation {1 + Math.ceil(d.attr.STR.total / 3) + (Number(spec.rc) || 0)} (1 + STR/3 + weapon RC {Number(spec.rc) || 0})</small>
        </label>
      )}
      {kind === 'defense' && (
        <div class="row gap cm-num">
          <label class="field"><span class="lbl">Defenses already this turn</span><input type="number" min="0" max="20" value={prev} onInput={(e) => setPrev(Math.max(0, Number(e.currentTarget.value) || 0))} /></label>
          <label class="field"><span class="lbl">Attacker's Reach minus yours</span><input type="number" min="-5" max="5" value={reach} onInput={(e) => setReach(Number(e.currentTarget.value) || 0)} /></label>
        </div>
      )}
      {res.parts.length > 0 && <p class="hint cm-parts">{res.parts.map((p) => `${p.label} ${p.v > 0 ? '+' : ''}${p.v}`).join(' · ')}</p>}
    </details>
  );
}

function RollBody({ spec, ch, d, update, playing }) {
  const [result, setResult] = useState(null);
  const [calledShot, setCalledShot] = useState(false);
  const [situ, setSitu] = useState(0);
  const play = playState(ch);
  const avail = edgeAvailable(d, play);
  const canEdge = playing && avail > 0 && !!result;
  const base = calledShot ? calledShotPool(spec.pool) : spec.pool;
  const pool = Math.max(0, base + (spec.kind ? situ : 0));
  const csUrl = bookUrl('SR5', CALLED_SHOT_PAGE);
  const roll = () => setResult(rollPool(pool));
  const push = () => {
    update((x) => spendEdge(x, d, 'push'), { record: false });
    setResult(rollPushLimit(pool, d.attr.EDG.total));
  };
  const second = () => {
    if (!result) return;
    update((x) => spendEdge(x, d, 'second'), { record: false });
    setResult(rerollSecondChance(result.dice));
  };
  return (
    <div class="roll-body">
      <div class="roll-pool">
        <b>{pool}</b><small>dice{calledShot && ` (${spec.pool} − ${CALLED_SHOT_PENALTY})`}{spec.kind && situ !== 0 && ` (${spec.pool} ${situ > 0 ? '+' : '−'} ${Math.abs(situ)})`}</small>
        {playing && <span class="pip" title="Edge available to spend">Edge {avail}</span>}
      </div>
      {spec.kind && !result && <CombatMods spec={spec} d={d} play={play} onChange={setSitu} />}
      {spec.attack && !spec.kind && !result && (
        <label class="check" title="A called shot: -4 dice pool, for an extra effect the GM adjudicates">
          <input type="checkbox" checked={calledShot} onChange={(e) => setCalledShot(e.currentTarget.checked)} />
          Called shot (−{CALLED_SHOT_PENALTY}) {csUrl && <a href={csUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>SR5 p.{CALLED_SHOT_PAGE} ↗</a>}
        </label>
      )}
      {!result ? (
        <div class="roll-actions">
          <button type="button" class="primary big" onClick={roll}>Roll {pool}d6</button>
          {playing && avail > 0 && (
            <button type="button" title="Add your Edge rating to the pool before rolling; sixes explode" onClick={push}>
              Push the Limit (+{d.attr.EDG.total})
            </button>
          )}
        </div>
      ) : (
        <>
          <div class="dice-row">{result.dice.map((v, i) => <Die key={i} v={v} />)}</div>
          <div class="roll-verdict">
            <b class="hits">{result.hits} hit{result.hits === 1 ? '' : 's'}</b>
            {result.critical ? <span class="pip bad">Critical glitch</span> : result.glitch ? <span class="pip warn">Glitch</span> : null}
          </div>
          <div class="roll-actions">
            <button type="button" onClick={roll}>Reroll fresh</button>
            {canEdge && (
              <button type="button" title="Add your Edge rating to the pool before rolling; sixes explode" onClick={push}>
                Push the Limit (+{d.attr.EDG.total})
              </button>
            )}
            {canEdge && (
              <button type="button" title="Reroll every die that did not hit; can't fix a glitch" onClick={second}>
                Second Chance
              </button>
            )}
          </div>
          {!playing && <p class="hint">Switch to Play mode to spend Edge on this roll.</p>}
          {playing && avail === 0 && <p class="hint">No Edge left to spend.</p>}
        </>
      )}
    </div>
  );
}

export function RollTray() {
  const st = useStore();
  const { ch, d, update } = useChar();
  const spec = st.roll;
  if (!spec || !ch || !d) return null;
  const playing = viewModeOf(ch) === 'play';
  return (
    <Modal title={spec.label} onClose={closeRoll}>
      <RollBody key={`${spec.label}:${spec.pool}`} spec={spec} ch={ch} d={d} update={update} playing={playing} />
    </Modal>
  );
}
