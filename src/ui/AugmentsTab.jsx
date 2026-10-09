import { useChar } from '../store.js';
import { idx, num } from '../engine/data.js';
import { ItemSection, bookCol, cost as costCell } from './items.jsx';
import { describeEffects, effectsOf } from '../engine/effects.js';
import { Panel, cx } from './common.jsx';
import { isEnhancement, fitsIn, capacityCost } from '../engine/augCapacity.js';

/**
 * Cyberware capacity on an Augments row: an enhancement (Low-Light Vision, a cyberarm Gyromount...) can be installed
 * in a piece that fits it - then it uses that piece's capacity instead of Essence; a piece with capacity shows how
 * much is used (engine/augCapacity.js).
 */
function Capacity({ e, all, kind, update }) {
  const { it, def } = e;
  const parents = isEnhancement(def) ? all.filter((p) => p.it.uid !== it.uid && fitsIn(def, p.def)) : [];
  const install = (uid) => update((x) => {
    const t = x[kind].find((z) => z.uid === it.uid);
    if (!t) return;
    if (uid) { t.parent = uid; t.child = true; } else { delete t.parent; delete t.child; }
  });
  const inParent = it.parent && all.find((p) => p.it.uid === it.parent);
  return (
    <>
      {(parents.length > 0 || inParent) && (
        <label class="capsel small">{inParent ? 'Installed in' : 'Install in'}{' '}
          <select value={it.parent || ''} onChange={(ev) => install(ev.currentTarget.value)} aria-label={`Where ${def.name} is installed`}>
            <option value="">Not installed (uses Essence)</option>
            {parents.map((p) => <option key={p.it.uid} value={p.it.uid}>{p.def.name}{p.it.rating ? ` R${p.it.rating}` : ''} ({p.cap ? p.cap.total - p.cap.used : 0} free)</option>)}
          </select>
          <span class="dim"> uses {capacityCost(def, it.rating)} capacity</span>
        </label>
      )}
      {e.cap && (
        <span class={cx('pip', 'cappip', e.cap.used > e.cap.total && 'bad')} title={e.cap.children.map((c) => `${c.def.name} [${c.cost}]`).join(', ') || 'Nothing installed yet'}>
          Capacity {e.cap.used}/{e.cap.total}
        </span>
      )}
    </>
  );
}

export function AugmentsTab() {
  const { ch, d, update } = useChar();
  const pct = Math.max(0, Math.min(100, (d.essence / d.essMax) * 100));
  const cyber = d.augs.filter((a) => a.kind === 'cyberware');
  const bio = d.augs.filter((a) => a.kind === 'bioware');
  const cols = (label) => [
    { key: 'name', label },
    { key: 'category', label: 'Category' },
    { key: 'ess', label: 'Ess', cls: 'num' },
    { key: 'avail', label: 'Avail' },
    { key: 'cost', label: 'Cost', cls: 'num', get: costCell },
    bookCol,
  ];
  const fxCell = (e) => <td class="fx">{describeEffects(effectsOf(e.def.bonus, { Rating: e.it.rating || 1 }))}</td>;
  return (
    <div class="tab">
      <Panel title="Essence">
        <div class="essence">
          <div class="bar" role="img" aria-label={`Essence ${d.essence.toFixed(2)} of ${d.essMax}`}>
            <div class={cx('fill', d.essence < 1 && 'low')} style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div class="ess-num"><b>{d.essence.toFixed(2)}</b> / {d.essMax}</div>
        </div>
        <p class="hint">
          Essence lost: {d.essLoss.toFixed(2)}.
          {d.attr.MAG.enabled || d.attr.RES.enabled
            ? <> Each point or fraction lost reduces Magic/Resonance by 1 — currently <b>−{d.magLoss}</b>.</>
            : ' Mundane characters lose nothing else, but Essence also feeds the Social limit.'}
        </p>
      </Panel>
      <ItemSection
        title="Cyberware" kind="cyberware" ch={ch} d={d} update={update}
        entries={cyber} defs={idx('cyberware', 'cyberwares').list}
        searchText={(c) => `${c.name} ${c.category}`}
        pickCols={cols('Cyberware')}
        extraCols={[{ key: 'fx', label: 'Effect' }]} extraCells={fxCell}
        pickerHint="Grades other than the ones banned by your rule settings are available in the row's grade box. Enhancements (e.g. Low-Light Vision) can then be installed in cybereyes, cyberlimbs etc. from their row."
        modSection={(e) => <Capacity e={e} all={cyber} kind="cyberware" update={update} />}
      />
      <ItemSection
        title="Bioware" kind="bioware" ch={ch} d={d} update={update}
        entries={bio} defs={idx('bioware', 'biowares').list}
        searchText={(c) => `${c.name} ${c.category}`}
        pickCols={cols('Bioware')}
        extraCols={[{ key: 'fx', label: 'Effect' }]} extraCells={fxCell}
        modSection={(e) => <Capacity e={e} all={bio} kind="bioware" update={update} />}
      />
    </div>
  );
}
