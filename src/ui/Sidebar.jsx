import { useState } from 'preact/hooks';
import { useChar, setViewMode } from '../store.js';
import { finalize, backToCreation } from '../engine/actions.js';
import { addEntry } from '../engine/money.js';
import { cx, nuyen, Stepper, ConfirmDialog } from './common.jsx';

const Row = ({ label, children, tone, title }) => (
  <div class={cx('srow', tone)} title={title}><span>{label}</span><b>{children}</b></div>
);

export function Sidebar() {
  const { ch, d, update } = useChar();
  const [award, setAward] = useState(5);
  const [finishing, setFinishing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const errors = d.warnings.filter((w) => w.sev === 'error');
  const create = ch.mode === 'create';
  const kTone = d.karma.left < 0 ? 'bad' : create && d.karma.left > d.R.karmaCarryover ? 'warn' : '';
  const nTone = d.nuyen.left < 0 ? 'bad' : create && d.nuyen.left > d.R.nuyenCarryover ? 'warn' : '';
  const init = (i) => `${i.base} + ${i.dice}D6`;

  return (
    <aside class="side" aria-label="Character summary">
      <div class="card ident">
        <div class="who">{ch.info.alias || ch.info.name || 'Unnamed runner'}</div>
        <div class="dim">{ch.metatype}{ch.variant ? ` · ${ch.variant}` : ''} · {d.talent.value}</div>
        <span class={cx('mode', ch.mode)}>{create ? 'Creation' : 'Career'}</span>
      </div>

      <div class="card">
        <h4>Budget</h4>
        <Row label="Karma" tone={kTone} title={create ? 'Unspent Karma. At most 7 may be carried into play.' : 'Available Karma'}>{d.karma.left} <small>/ {d.karma.total}</small></Row>
        <Row label="Nuyen" tone={nTone}>{nuyen(d.nuyen.left)}</Row>
        {create && (
          <>
            <Row label="Attribute pts" tone={d.used.attrPts > d.pri.attrPtsTotal ? 'bad' : d.used.attrPts < d.pri.attrPtsTotal ? 'todo' : 'ok'}>{d.pri.attrPtsTotal - d.used.attrPts} <small>left</small></Row>
            {d.pri.specialPtsTotal > 0 && <Row label="Special pts" tone={d.used.specialPts < d.pri.specialPtsTotal ? 'todo' : 'ok'}>{d.pri.specialPtsTotal - d.used.specialPts} <small>left</small></Row>}
            <Row label="Skill pts" tone={d.used.skillPts > d.pri.skillPtsTotal ? 'bad' : d.used.skillPts < d.pri.skillPtsTotal ? 'todo' : 'ok'}>{d.pri.skillPtsTotal - d.used.skillPts} <small>left</small></Row>
            {d.pri.groupPtsTotal > 0 && <Row label="Group pts" tone={d.used.groupPts > d.pri.groupPtsTotal ? 'bad' : d.used.groupPts < d.pri.groupPtsTotal ? 'todo' : 'ok'}>{d.pri.groupPtsTotal - d.used.groupPts} <small>left</small></Row>}
          </>
        )}
      </div>

      <div class="card">
        <h4>Vitals</h4>
        <Row label="Essence">{d.essence.toFixed(2)}</Row>
        <Row label="Initiative">{init(d.init)}</Row>
        <Row label="Limits M / P / S">{d.limits.mental} / {d.limits.physical} / {d.limits.social}</Row>
        <Row label="Condition P / S">{d.cm.physical} / {d.cm.stun}</Row>
        <Row label="Armor">{d.armor.total}</Row>
        <Row label="Defense pool">{d.pools.defense}</Row>
        {d.matrix.persona && <Row label="Matrix init (hot)" title={d.matrix.persona.label}>{d.matrix.init.hot.base} + {d.matrix.init.hot.dice}D6</Row>}
      </div>

      {create ? (
        <div class="card">
          <h4>Karma → nuyen</h4>
          <div class="row gap between">
            <Stepper value={ch.karmaConverted || 0} min={0} max={d.R.maxKarmaToNuyen} onChange={(v) => update((x) => { x.karmaConverted = v; })} />
            <small class="dim">{nuyen((ch.karmaConverted || 0) * d.R.nuyenPerKarma)}</small>
          </div>
        </div>
      ) : (
        <div class="card">
          <h4>Advancement</h4>
          <div class="row gap between">
            <Stepper value={award} min={1} max={999} onChange={setAward} />
            <button type="button" class="primary sm" onClick={() => update((x) => { addEntry(x, 'karma', award, 'Karma award'); })}>+ Karma</button>
          </div>
        </div>
      )}

      {d.warnings.length > 0 && (
        <div class="card warn-card">
          <h4>Check <span class="count">{d.warnings.length}</span></h4>
          <ul>
            {d.warnings.slice(0, 8).map((w, i) => <li key={i} class={w.sev}>{w.msg}</li>)}
            {d.warnings.length > 8 && <li class="dim">…and {d.warnings.length - 8} more</li>}
          </ul>
        </div>
      )}

      {create && (
        <button type="button" class="primary block" disabled={errors.length > 0}
          title={errors.length ? 'Fix the errors above first' : 'Lock creation choices and start tracking advancement'}
          onClick={() => setFinishing(true)}>
          Finish creation →
        </button>
      )}

      {!create && (
        <button type="button" class="ghost block" title="Unlock the priority table and creation editing again" onClick={() => setReverting(true)}>
          ← Back to creation
        </button>
      )}

      {finishing && (
        <ConfirmDialog title="Finish creation" confirmLabel="Finish creation"
          message={`Priority choices lock and future improvements cost Karma.${d.karma.left > d.R.karmaCarryover ? `\n\n${d.karma.left - d.R.karmaCarryover} unspent Karma above the ${d.R.karmaCarryover} carry-over limit will be lost.` : ''}`}
          onConfirm={() => { setViewMode(ch.id, 'build'); update((x) => finalize(x, d)); }} onClose={() => setFinishing(false)} />
      )}
      {reverting && (
        <ConfirmDialog title="Back to creation" confirmLabel="Back to creation"
          message="The priority table and creation-only editing unlock again. Karma spent on advancement becomes part of the build at no extra cost, and your current Karma and nuyen totals carry over unchanged.\n\nDamage, Edge used, and the journal are left as they are."
          onConfirm={() => update((x) => backToCreation(x, d))} onClose={() => setReverting(false)} />
      )}
    </aside>
  );
}
