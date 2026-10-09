import { useChar, useViewMode } from '../store.js';
import { idx } from '../engine/data.js';
import { weaponStats, parseAmmo } from '../engine/weapons.js';
import { playState } from '../engine/edge.js';
import { Panel, InspectLink, cx } from './common.jsx';
import { RollButton } from './Roller.jsx';
import { AmmoSelect } from './ModsEditor.jsx';


/**
 * Every weapon the character owns with damage, attack pool and (in Play mode) an ammo counter.
 * Used by both the Sheet and the Play-mode Gear & Matrix tab.
 */
export function WeaponsPanel() {
  const { ch, d, update } = useChar();
  const play = useViewMode() === 'play';
  const ps = playState(ch);
  const setRounds = (uid, n, cap) => update((x) => {
    const p = playState(x);
    x.play = { ...p, rounds: { ...p.rounds, [uid]: Math.max(0, Math.min(cap, n)) } };
  }, { record: false });
  const ax = idx('weapons', 'accessories');
  const setEquipped = (uid, on) => update((x) => { const w = x.weapons.find((z) => z.uid === uid); if (w) w.equipped = on; }, { record: false });
  const wpn = d.items.weapons.map((e) => ({ ...e, st: weaponStats(e.def, d, e.it) }));
  if (wpn.length === 0) return null;

  return (
    <Panel title="Weapons" right={<span class="pip">{wpn.length} weapon{wpn.length === 1 ? '' : 's'}</span>}>
      <div class="tbl-wrap">
        <table class="tbl compact weapons">
          <thead><tr><th>Equip</th><th>Weapon</th><th>Dmg</th><th>AP</th><th>Mode</th><th>RC</th><th>Acc</th><th class="num">Pool</th><th>Ammo</th></tr></thead>
          <tbody>
            {wpn.map(({ it, def, st }) => {
              const melee = def.type === 'Melee';
              const cap = melee ? 0 : parseAmmo(def.ammo);
              const left = cap ? (ps.rounds[it.uid] ?? cap) : 0;
              const mods = (it.mods || []).map((m) => (ax.byId.get(m.id) || {}).name).filter(Boolean);
              const equipped = it.equipped !== false;
              return (
                <tr key={it.uid} class={cx(!equipped && 'dim')}>
                  <td><input type="checkbox" checked={equipped} disabled={!!it.auto} title={it.auto ? `Part of ${it.from} - always on you` : undefined} aria-label={`${it.label || def.name} equipped`} onChange={(e) => setEquipped(it.uid, e.currentTarget.checked)} /></td>
                  <th>
                    <InspectLink kind="weapons" {...(it.auto ? { id: def.id } : { uid: it.uid })}>{it.label || def.name}</InspectLink>
                    <small class="block-note">{it.auto ? `from ${it.from}` : def.category}{mods.length ? ` · ${mods.join(', ')}` : ''}</small>
                  </th>
                  <td title={st.dmgTip || undefined} class={cx(st.dmgMod && 'boosted')}>{st.dmg}</td>
                  <td title={st.apTip || undefined} class={cx(st.apMod && 'boosted')}>{st.ap}</td>
                  <td title={st.mode !== def.mode ? `${st.ammoName} loaded` : undefined} class={cx(st.mode !== def.mode && 'boosted')}>{st.mode}</td>
                  <td title={st.rcTip || undefined} class={cx(st.rcMod && 'boosted')}>{melee ? `reach ${def.reach}` : st.rc}</td>
                  <td title={st.accuracyTip || undefined} class={cx(st.accuracyMod && 'boosted')}>{st.accuracy}</td>
                  <td class="num strong" title={`${st.skillName || 'skill'} + AGI`}>
                    {st.pool != null ? st.pool : '—'}
                    {st.pool != null && <RollButton pool={st.pool} label={it.label || def.name} attack kind={def.type === 'Melee' ? 'melee' : 'ranged'} rc={st.rc} />}
                  </td>
                  <td class="ammo">
                    {melee ? '—' : cap && play ? (
                      <span class="ammo-ctl">
                        <b class={cx(left === 0 && 'bad')}>{left}/{cap}</b>
                        {[1, 3, 6, 10].map((n) => <button key={n} type="button" class="sm" disabled={left < 1} title={`Fire ${n}`} onClick={() => setRounds(it.uid, left - n, cap)}>−{n}</button>)}
                        <button type="button" class="sm" disabled={left === cap} onClick={() => setRounds(it.uid, cap, cap)}>Reload</button>
                      </span>
                    ) : def.ammo}
                    {!melee && <AmmoSelect it={it} def={def} update={update} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
