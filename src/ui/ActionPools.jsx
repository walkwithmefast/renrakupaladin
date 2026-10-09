import { matrixActionPools, magicActionPools } from '../engine/actionPools.js';
import { woundModifier, playState } from '../engine/edge.js';
import { Panel, cx } from './common.jsx';
import { RollButton } from './Roller.jsx';

function PoolRow({ r }) {
  const dim = !r.can;
  const best = r.spec ? r.poolSpec : r.pool;
  return (
    <div class={cx('ap-row', dim && 'dim')}>
      <span class="nm">{r.name}{r.spec && <small>{r.spec}</small>}</span>
      <span class="how">{r.note || (r.skill ? `${r.skill} + ${r.attr}` : r.attr)}{r.defaulting ? ' (defaulting)' : ''}</span>
      <span class="lim">{r.limitName ? <>[{r.limitName} <b>{r.limit}</b>]</> : ''}</span>
      <span class="pl">
        {dim ? <small title={`${r.skill} has no ranks and can't be defaulted`}>—</small> : <>{r.pool}{r.spec && <small>({r.poolSpec})</small>}<RollButton pool={best} label={r.name} /></>}
      </span>
    </div>
  );
}

/** Matrix action dice pools for the active persona (Matrix Perception, Hack on the Fly, ...). */
export function MatrixActionPools({ d, bare }) {
  const rows = matrixActionPools(d);
  if (rows.length === 0) return null;
  const body = (
    <>
      <div class="ap-list">{rows.map((r) => <PoolRow key={r.name} r={r} />)}</div>
      <p class="hint">Skill + the attribute each action names. The bracket is that test's limit from your persona. A dash means no ranks and the skill can't be defaulted.</p>
    </>
  );
  return bare ? <div class="ap-bare"><h4>Matrix actions</h4>{body}</div>
    : <Panel title="Matrix actions" sub="dice pools">{body}</Panel>;
}

/** Magic / Resonance skill pools with the skill's own attribute (Counterspelling, Assensing, Summoning, ...). */
export function MagicActionPools({ ch, d }) {
  const rows = magicActionPools(d);
  const wound = woundModifier(playState(ch), d);
  if (rows.length === 0) return null;
  return (
    <Panel title="Magic & Resonance skills" sub="dice pools" right={wound > 0 ? <span class="pip warn">Wound −{wound}</span> : null}>
      <div class="ap-list">{rows.map((r) => <PoolRow key={r.name} r={{ ...r, can: true }} />)}</div>
      <p class="hint">Spellcasting here is the base pool - the casting helper above adds the best focus per spell category.</p>
    </Panel>
  );
}
