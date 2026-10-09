import { useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { idx, arr, num, txt } from '../engine/data.js';
import { weaponStats } from '../engine/weapons.js';
import { isProgramDef, ASDF } from '../engine/matrix.js';
import { Modal, nuyen, cx, SourceRef, Warn, Panel, InspectLink } from './common.jsx';
import { ItemSection, bookCol, cost as costCell } from './items.jsx';
import { WeaponAccessories, ArmorModsList, VehicleModsList, BundledLine, VehStat, AmmoSelect } from './ModsEditor.jsx';
import { RollButton } from './Roller.jsx';
import { FocusBonding } from './Foci.jsx';
import { OverwatchPanel } from './Overwatch.jsx';
import { MatrixDeck } from './MatrixDeck.jsx';
import { AIProgramsPanel } from './ExtraPowers.jsx';
import { armorWithMods, armorView } from '../engine/mods.js';

function ProgramSection({ cat, title, hint, ch, d, update }) {
  const defs = idx('gear', 'gears').list.filter((g) => g.category === cat);
  const entries = d.items.gear.filter((e) => e.def.category === cat);
  const hacking = cat === 'Hacking Programs';
  const options = d.matrix.devices.filter((x) => !hacking || x.kind === 'deck');
  return (
    <ItemSection
      title={title} sub={`${hint} · load them into a deck on the Matrix card above`} kind="gear" ch={ch} d={d} update={update}
      entries={entries} defs={defs} noQty category={() => ''}
      emptyText={`No ${title.toLowerCase()} yet.`}
      pickCols={[
        { key: 'name', label: 'Program' },
        { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
      ]}
      extraCols={[{ key: 'run', label: 'Running on' }]}
      extraCells={(e) => <td class="dim">{(options.find((o) => o.uid === e.it.device) || {}).name || 'storage'}</td>}
      right={<span class="pip">{entries.length} program{entries.length === 1 ? '' : 's'}</span>}
    />
  );
}

function Programs({ ch, d, update }) {
  return (
    <>
      <MatrixDeck ch={ch} d={d} update={update} />
      {(d.matrix.devices.length > 0 || d.attr.RES.enabled) && <OverwatchPanel ch={ch} update={update} />}
      <ProgramSection cat="Common Programs" title="Common programs" hint="Run on any device" ch={ch} d={d} update={update} />
      <ProgramSection cat="Hacking Programs" title="Hacking programs" hint="Run on a cyberdeck, up to its limit" ch={ch} d={d} update={update} />
      <AIProgramsPanel ch={ch} update={update} />
    </>
  );
}

/**
 * Armor, Gear and Vehicles & drones - the part of "Weapons, armor & gear" that isn't Weapons. Split out so
 * Play mode (career mode only - see `PlayTabs.jsx`'s `PlayGear`) can offer the same add/rate/remove editing
 * for these without also pulling in Weapons (which Play shows through the Play-tuned `WeaponsPanel`, with its
 * ammo tracking that this generic `ItemSection` row doesn't have) or the Programs sub-tab (Play already has a
 * dedicated Matrix tab for that).
 */
export function ArmorGearVehicles({ ch, d, update }) {
  return (
    <>
      <ItemSection
        title="Armor" kind="armor" ch={ch} d={d} update={update}
        entries={d.items.armor} defs={idx('armor', 'armors').list}
        pickCols={[
          { key: 'name', label: 'Armor' }, { key: 'armor', label: 'Rating', get: (a) => arr(a.armor).join(' ') },
          { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
        ]}
        extraCols={[{ key: 'ar', label: 'Armor', cls: 'num' }, { key: 'on', label: 'Worn' }]}
        extraCells={(e) => (
          <>
            {(() => { const av = armorView(armorWithMods(e.def, e.it, idx('armor', 'mods'))); return <td class={cx('num', av.tip && 'boosted')} title={av.tip || undefined}>{av.text}</td>; })()}
            <td><input type="checkbox" checked={e.it.equipped !== false} aria-label="worn"
              onChange={(ev) => update((x) => { x.armor.find((z) => z.uid === e.it.uid).equipped = ev.currentTarget.checked; })} /></td>
          </>
        )}
        modSection={(e) => <ArmorModsList it={e.it} def={e.def} update={update} />}
        right={<span class="pip">Armor {d.armor.total}</span>}
      />

      <ItemSection
        title="Gear" kind="gear" ch={ch} d={d} update={update}
        entries={d.items.gear.filter((e) => !isProgramDef(e.def))} defs={idx('gear', 'gears').list.filter((g) => !isProgramDef(g))}
        searchText={(g) => `${g.name} ${g.category}`}
        pickerHint="Common and hacking programs are on the Programs tab."
        pickCols={[
          { key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'rating', label: 'Rtg', cls: 'num', get: (g) => (num(g.rating) > 0 ? g.rating : '') },
          { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
        ]}
        extraCols={[{ key: 'cat', label: 'Category' }]}
        extraCells={(e) => <td class="dim">{e.def.category}</td>}
        modSection={(e) => <FocusBonding it={e.it} def={e.def} d={d} update={update} />}
      />

      <ItemSection
        title="Vehicles & drones" kind="vehicles" ch={ch} d={d} update={update}
        entries={d.items.vehicles} defs={idx('vehicles', 'vehicles').list}
        pickCols={[
          { key: 'name', label: 'Vehicle' }, { key: 'category', label: 'Type' }, { key: 'handling', label: 'Hand' }, { key: 'speed', label: 'Spd' },
          { key: 'body', label: 'Bod' }, { key: 'armor', label: 'Arm', get: (v) => arr(v.armor).join('') }, { key: 'pilot', label: 'Pilot' },
          { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
        ]}
        extraCols={[{ key: 'h', label: 'Hand' }, { key: 's', label: 'Spd' }, { key: 'a', label: 'Acc' }, { key: 'b', label: 'Bod' }, { key: 'ar', label: 'Arm' }, { key: 'p', label: 'Pil' }, { key: 'se', label: 'Sen' }]}
        extraCells={(e) => (
          <>{['handling', 'speed', 'accel', 'body', 'armor', 'pilot', 'sensor'].map((k) => <VehStat key={k} e={e} k={k} />)}</>
        )}
        modSection={(e) => <VehicleModsList it={e.it} def={e.def} update={update} />}
      />
    </>
  );
}

export function GearTab() {
  const { ch, d, update } = useChar();
  const [sub, setSub] = useState(() => { try { return localStorage.getItem('crm.gearsub') || 'gear'; } catch { return 'gear'; } });
  const pick = (k) => { setSub(k); try { localStorage.setItem('crm.gearsub', k); } catch { /* ignore */ } };
  const weaponDefs = idx('weapons', 'weapons').list;
  const progCount = d.items.gear.filter((e) => isProgramDef(e.def)).length;
  return (
    <div class="tab">
      <div class="subtabs" role="tablist" aria-label="Gear sections">
        <button type="button" role="tab" aria-selected={sub === 'gear'} class={cx('subtab', sub === 'gear' && 'on')} onClick={() => pick('gear')}>Weapons, armor &amp; gear</button>
        <button type="button" role="tab" aria-selected={sub === 'programs'} class={cx('subtab', sub === 'programs' && 'on')} onClick={() => pick('programs')}>Programs{progCount > 0 && <span class="badge">{progCount}</span>}</button>
      </div>
      <div class="summary-bar">
        <span>Nuyen: <b class={cx(d.nuyen.left < 0 && 'bad')}>{nuyen(d.nuyen.left)}</b> left of {nuyen(d.nuyen.total)}</span>
        {Object.entries(d.nuyen.byKind).filter(([, v]) => v > 0).map(([k, v]) => <span key={k} class="dim">{k} {nuyen(v)}</span>)}
      </div>

      {sub === 'programs' && <Programs ch={ch} d={d} update={update} />}
      {sub === 'gear' && <>
      <ItemSection
        title="Weapons" kind="weapons" ch={ch} d={d} update={update}
        entries={d.items.weapons} defs={weaponDefs}
        searchText={(w) => `${w.name} ${w.category}`}
        pickCols={[
          { key: 'name', label: 'Weapon' }, { key: 'category', label: 'Class' },
          { key: 'damage', label: 'Dmg' }, { key: 'ap', label: 'AP' }, { key: 'mode', label: 'Mode' }, { key: 'ammo', label: 'Ammo' },
          { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
        ]}
        extraCols={[{ key: 'eq', label: 'Equip' }, { key: 'dmg', label: 'Dmg' }, { key: 'ap', label: 'AP' }, { key: 'mode', label: 'Mode' }, { key: 'rc', label: 'RC', cls: 'num' }, { key: 'ammo', label: 'Ammo' }, { key: 'pool', label: 'Pool', cls: 'num' }]}
        extraCells={(e) => {
          const s = weaponStats(e.def, d, e.it);
          const m = e.def.type === 'Melee';
          return (
            <>
              <td><input type="checkbox" checked={e.it.equipped !== false} aria-label={`${e.def.name} equipped`}
                onChange={(ev) => update((x) => { x.weapons.find((z) => z.uid === e.it.uid).equipped = ev.currentTarget.checked; })} /></td>
              <td title={s.dmgTip || undefined} class={cx(s.dmgMod && 'boosted')}>{s.dmg}</td>
              <td title={s.apTip || undefined} class={cx(s.apMod && 'boosted')}>{s.ap}</td>
              <td class={cx(s.mode !== e.def.mode && 'boosted')} title={s.mode !== e.def.mode ? `${s.ammoName} loaded` : undefined}>{s.mode}</td>
              <td class={cx('num', s.rcMod && 'boosted')} title={s.rcTip || undefined}>{m ? `reach ${e.def.reach}` : s.rc}</td>
              <td>{m ? '—' : e.def.ammo}</td>
              <td class="num strong" title={[`${s.skillName} + AGI`, s.accuracyTip && `accuracy ${s.accuracyTip}`].filter(Boolean).join(' · ')}>
                {s.pool != null ? `${s.pool}` : '—'}<small class={cx(s.accuracyMod && 'boosted')}> [{s.accuracy}]</small>
                {s.pool != null && <RollButton pool={s.pool} label={e.it.label || e.def.name} attack kind={e.def.type === 'Melee' ? 'melee' : 'ranged'} rc={s.rc} />}
              </td>
            </>
          );
        }}
        modSection={(e) => <><WeaponAccessories it={e.it} def={e.def} update={update} /><AmmoSelect it={e.it} def={e.def} update={update} /></>}
      />

      <ArmorGearVehicles ch={ch} d={d} update={update} />
      </>}
      <Warn list={d.warnings.filter((w) => /Availab|Nuyen/.test(w.msg))} />
    </div>
  );
}
