import { useState } from 'preact/hooks';
import {
  EDGE_SPEND, EDGE_BURN, EDGE_REGAIN, playState, edgeAvailable,
  spendEdge, burnEdge, regainEdge, undoEdge,
} from '../engine/edge.js';
import { Modal, cx } from './common.jsx';

const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Choice({ fx, onPick, tone, disabled }) {
  return (
    <button type="button" class={cx('edge-choice', tone)} disabled={disabled} onClick={() => onPick(fx.id)}>
      <b>{fx.name}</b>
      <span>{fx.text}</span>
    </button>
  );
}

/**
 * Edge tracker. Shows points on every sheet; the spend / burn / regain controls only appear in Play mode.
 */
export function EdgePanel({ d, ch, update, interactive }) {
  const [dialog, setDialog] = useState(null); // 'spend' | 'burn' | 'regain'
  const play = playState(ch);
  const total = d.attr.EDG.total;
  const avail = edgeAvailable(d, play);
  const burned = play.edgeBurned;
  const log = play.edgeLog.slice(-5).reverse();

  const act = (fn) => { update((x) => fn(x), { record: false }); setDialog(null); };

  return (
    <section class="panel edge-panel">
      <header>
        <h3>Edge</h3>
        <div class="right">
          <span class={cx('pip', avail === 0 && total > 0 && 'warn')}>{avail} / {total} available</span>
          {burned > 0 && <span class="pip bad" title="Burned Edge is gone until you buy it back with Karma">{burned} burned</span>}
        </div>
      </header>
      <div class="edge-dots" role="img" aria-label={`${avail} of ${total} Edge points available`}>
        {Array.from({ length: total }, (_, i) => <span key={i} class={cx('pt', i < avail && 'full')} />)}
        {Array.from({ length: burned }, (_, i) => <span key={'b' + i} class="pt burnt" title="burned" />)}
        {total === 0 && burned === 0 && <span class="dim">No Edge</span>}
      </div>
      {interactive && (
        <div class="edge-actions">
          <button type="button" class="primary" disabled={avail < 1} onClick={() => setDialog('spend')}>Spend Edge…</button>
          <button type="button" class="danger-solid" disabled={avail < 1} onClick={() => setDialog('burn')}>Burn Edge…</button>
          <button type="button" disabled={play.edgeUsed < 1} onClick={() => setDialog('regain')}>Regain…</button>
          <button type="button" class="ghost" disabled={play.edgeLog.length === 0} title="Undo the last Edge action" onClick={() => act((x) => undoEdge(x))}>↶ Undo</button>
        </div>
      )}
      {log.length > 0 && (
        <ul class="edge-log" aria-label="Recent Edge use">
          {log.map((e, i) => (
            <li key={e.t + '-' + i} class={e.kind}>
              <span class="tag">{e.kind === 'spend' ? 'spent' : e.kind === 'burn' ? 'burned' : 'regained'}</span> {e.name} <small>{clock(e.t)}</small>
            </li>
          ))}
        </ul>
      )}

      {dialog === 'spend' && (
        <Modal title={`Spend a point of Edge (${avail} left)`} onClose={() => setDialog(null)}>
          <p class="hint" style={{ marginTop: 0 }}>Only one point of Edge can be used on any single test or action, and only on your own actions.</p>
          <div class="edge-choices">{EDGE_SPEND.map((fx) => <Choice key={fx.id} fx={fx} onPick={(id) => act((x) => spendEdge(x, d, id))} />)}</div>
        </Modal>
      )}
      {dialog === 'burn' && (
        <Modal title="Burn a point of Edge" onClose={() => setDialog(null)}>
          <p class="hint" style={{ marginTop: 0 }}><b>Permanent.</b> The point is gone and only comes back if you buy your Edge up again with Karma.</p>
          <div class="edge-choices">{EDGE_BURN.map((fx) => <Choice key={fx.id} fx={fx} tone="burn" onPick={(id) => act((x) => burnEdge(x, d, id))} />)}</div>
        </Modal>
      )}
      {dialog === 'regain' && (
        <Modal title="Regain a point of Edge" onClose={() => setDialog(null)}>
          <p class="hint" style={{ marginTop: 0 }}>You can never go above your maximum Edge.</p>
          <div class="edge-choices">{EDGE_REGAIN.map((fx) => <Choice key={fx.id} fx={fx} onPick={(id) => act((x) => regainEdge(x, id))} />)}</div>
        </Modal>
      )}
    </section>
  );
}
