import { useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { idx, arr, num, txt } from '../engine/data.js';
import { itemDef } from '../engine/character.js';
import { evalExpr } from '../engine/expr.js';
import { isProgramDef } from '../engine/matrix.js';
import { gearDescendants, newOwned, spawnGearBundle } from '../engine/gearBundle.js';
import { Panel, Stepper, Empty, InspectLink, SourceRef, Picker, Modal, nuyen, cx } from './common.jsx';
import { MatrixDeck } from './MatrixDeck.jsx';
import { OverwatchPanel } from './Overwatch.jsx';
import { MatrixActionPools, MagicActionPools } from './ActionPools.jsx';
import { WeaponsPanel } from './WeaponsPanel.jsx';
import { BundledLine, VehicleModsList, VehStat, AmmoSelect } from './ModsEditor.jsx';
import { RollButton } from './Roller.jsx';
import { rollPool } from '../engine/dice.js';
import { SpiritsPanel, InitiationPanel } from './MagicTab.jsx';
import { playState } from '../engine/edge.js';
import { addSustained, removeSustained, sustainPenalty, SUSTAIN_PENALTY, SUSTAIN_PAGE } from '../engine/sustain.js';
import { fmtAvail } from '../engine/expr.js';
import { armorWithMods, armorView } from '../engine/mods.js';
import { droneTests, droneState, setDroneState, physicalBoxes, matrixBoxes, DRONE_PAGES, MOVES, movesOf, isDrone } from '../engine/drones.js';
import { weaponStats, parseAmmo } from '../engine/weapons.js';
import { Monitor } from './SheetTab.jsx';
import { addEntry, undoEntry, entryAmount } from '../engine/money.js';
import { CustomItemForm } from './CustomItem.jsx';
import { GrantedPowersList } from './GrantedPowers.jsx';
import { BoostPanel } from './Boost.jsx';
import { AIProgramsPanel } from './ExtraPowers.jsx';
import { useUnavailable } from './unavailable.js';
import { ArmorGearVehicles } from './GearTab.jsx';
import { AugmentsTab } from './AugmentsTab.jsx';
import { cost as costCell } from './items.jsx';

// =================================================================== Matrix
/** the Play-mode Matrix tab's content: the deck card + program library, then Marks & Overwatch (since v23; the old
 * devices table / per-program dropdown grid is gone) */
export function MatrixSection({ ch, d, update }) {
  if (d.matrix.devices.length === 0 && !d.attr.RES.enabled) return null;
  return (
    <>
      <MatrixDeck ch={ch} d={d} update={update} playing />
      <MatrixActionPools d={d} />
      <OverwatchPanel ch={ch} update={update} compact />
      <AIProgramsPanel ch={ch} update={update} readOnly />
    </>
  );
}

const LOOT_KINDS = [['weapons', 'Weapon', 'weapons', 'weapons'], ['armor', 'Armor', 'armor', 'armors'], ['gear', 'Gear', 'gear', 'gears'],
  ['cyberware', 'Cyberware', 'cyberware', 'cyberwares'], ['bioware', 'Bioware', 'bioware', 'biowares'], ['vehicles', 'Vehicle / drone', 'vehicles', 'vehicles']];

/** mid-session additions: a GM's custom item, or loot from the catalogue (free - it didn't cost anything) */
function GetStuff({ update }) {
  const [custom, setCustom] = useState(false);
  const [loot, setLoot] = useState('');
  const lk = LOOT_KINDS.find((k) => k[0] === loot);
  return (
    <div class="row gap getstuff">
      <button type="button" class="primary" onClick={() => setCustom(true)} title="Something that isn't in the books - you fill in the stats">+ Custom item</button>
      <select value="" aria-label="Loot from the catalogue" onChange={(e) => setLoot(e.currentTarget.value)}>
        <option value="">+ Loot from the catalogue…</option>
        {LOOT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <span class="small dim">Loot and gifts are added as free. Paying for something? Use the Wallet (top right) or untick "Didn't pay for it" on the item.</span>
      {custom && <CustomItemForm kind="gear" onClose={() => setCustom(false)} />}
      {lk && (
        <Picker title={`Loot: ${lk[1]}`} items={idx(lk[2], lk[3]).list} multi category={(x) => x.category} inspectKind={lk[0]}
          onClose={() => setLoot('')}
          onPick={(def) => update((x) => {
            const added = lk[0] === 'gear' ? spawnGearBundle(def) : [newOwned(lk[0], def)];
            for (const a of added) { a.free = true; x[lk[0]].push(a); }
          })}
          columns={[{ key: 'name', label: lk[1] }, { key: 'category', label: 'Category' }, { key: 'source', label: 'Book', get: (x) => <SourceRef source={x.source} page={x.page} /> }]} />
      )}
    </div>
  );
}

/** buy a weapon (real nuyen - not marked free, so derive()'s normal cost tally charges it against the Wallet
 *  the same way any owned item is charged). A plain add-only picker, not a full ItemSection: weapons are still
 *  shown through the Play-tuned `WeaponsPanel` (ammo tracking, Reload), not a second, ammo-less row list. */
function BuyWeaponButton({ update }) {
  const [adding, setAdding] = useState(false);
  const unavailable = useUnavailable('weapons');
  return (
    <>
      <button type="button" class="primary sm" onClick={() => setAdding(true)}>+ Buy a weapon</button>
      {adding && (
        <Picker title="Buy a weapon" items={idx('weapons', 'weapons').list} multi category={(w) => w.category} inspectKind="weapons"
          unavailable={unavailable} searchText={(w) => `${w.name} ${w.category}`}
          onClose={() => setAdding(false)}
          onPick={(def) => update((x) => { x.weapons.push(newOwned('weapons', def)); })}
          columns={[
            { key: 'name', label: 'Weapon' }, { key: 'category', label: 'Class' }, { key: 'damage', label: 'Dmg' },
            { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, { key: 'source', label: 'Book', get: (w) => <SourceRef source={w.source} page={w.page} /> },
          ]} />
      )}
    </>
  );
}

export function PlayGear() {
  const { ch, d, update } = useChar();
  const setWorn = (uid, on) => update((x) => { const a = x.armor.find((z) => z.uid === uid); if (a) a.equipped = on; }, { record: false });
  const career = ch.mode === 'career';

  return (
    <div class="tab">
      {career && <GetStuff update={update} />}
      {career && <div class="row gap"><BuyWeaponButton update={update} /><span class="small dim">Everything bought here (and on Armor/Gear/Vehicles below) is a real purchase, charged against the Wallet.</span></div>}
      <WeaponsPanel />

      {career ? <ArmorGearVehicles ch={ch} d={d} update={update} /> : (
        <>
          {d.items.armor.length > 0 && (
            <Panel title="Armor" right={<span class="pip">Total armor {d.armor.total}</span>} sub="tick what you're wearing">
              <ul class="plain worn">
                {d.items.armor.map(({ it, def }) => (
                  <li key={it.uid}>
                    <label class="check big"><input type="checkbox" checked={it.equipped !== false} onChange={(e) => setWorn(it.uid, e.currentTarget.checked)} />
                      <InspectLink kind="armor" uid={it.uid}>{def.name}</InspectLink></label>
                    <small>armor {armorView(armorWithMods(def, it, idx('armor', 'mods'))).text}</small>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <GearInventory d={d} />

          {d.items.vehicles.length > 0 && (
            <Panel title="Vehicles & drones">
              <table class="tbl compact">
                <thead><tr><th>Vehicle</th><th>Handling</th><th>Speed</th><th>Accel</th><th>Body</th><th>Armor</th><th>Pilot</th><th>Sensor</th></tr></thead>
                <tbody>
                  {d.items.vehicles.map((e) => (
                    <tr key={e.it.uid}>
                      <th><InspectLink kind="vehicles" uid={e.it.uid}>{e.def.name}</InspectLink></th>
                      {['handling', 'speed', 'accel', 'body', 'armor', 'pilot', 'sensor'].map((k) => <VehStat key={k} e={e} k={k} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/** Cyberware/Bioware in Play mode - career only (buying new 'ware is a real, priced purchase, same as Build's
 *  Augments tab, which this reuses wholesale: it's already mode-agnostic, no Play-specific version needed). */
export function PlayAugments() {
  const { ch } = useChar();
  if (ch.mode !== 'career') return null;
  return <AugmentsTab />;
}

// =================================================================== Focus: Matrix (decker)
export function PlayDecker() {
  const { ch, d, update } = useChar();
  return <div class="tab"><MatrixSection ch={ch} d={d} update={update} /></div>;
}

// =================================================================== Focus: Drones
// Everything a rigger rolls and ticks off for a drone or vehicle mid-fight (engine/drones.js has the rules and
// page refs): damage tracks, control mode (autonomous vs jumped in), dice pools with limits, mounted weapons
// with ammo, notes. Shared by the Drones and Vehicles Play-mode tabs (PlayDrones/PlayVehicles below), split by
// engine/drones.js's isDrone() (its category starts with "Drones:").
const MODE_OPTS = [['auto', 'Autonomous', 'It acts on its own: Pilot + autosofts'],
  ['remote', 'Remote', 'You steer it through your commlink / RCC (Control Device, SR5 p.238): your skills, limits capped by your Data Processing'],
  ['jumped', 'Jumped in', 'You are the vehicle: your skills, VR Initiative, control rig bonuses']];

function DroneTest({ t, label }) {
  return (
    <div class={cx('dtest', t.pool <= 0 && 'dim')}>
      <span class="lbl">{t.label}</span>
      <b>{t.pool}{t.limit != null && <small> [{t.limit}]</small>}</b>
      <RollButton pool={t.pool} label={`${label}: ${t.label}`} attack={t.id === 'gunnery'} kind={t.id === 'gunnery' ? 'ranged' : t.id === 'defense' ? 'defense' : undefined} />
      <small class="formula">{t.formula}</small>
      {t.note && <small class="note">{t.note}</small>}
    </div>
  );
}

function DroneWeapon({ e, d, drone, gunnery, rig, jumped, ps, setRounds, unmount, updateW }) {
  const { it, def } = e;
  const st = weaponStats(def, d, it);
  const cap = parseAmmo(def.ammo);
  const left = cap ? (ps.rounds[it.uid] ?? cap) : 0;
  const acc = Number(st.accuracy) || 0;
  return (
    <div class="dweapon">
      <div class="wname"><InspectLink kind="weapons" uid={it.uid}>{it.label || def.name}</InspectLink> <small>{st.mode}</small> <AmmoSelect it={it} def={def} update={updateW} /></div>
      <span class="wstat" title={st.dmgTip || undefined}>DV <b>{st.dmg}</b></span>
      <span class="wstat" title={st.apTip || undefined}>AP <b>{st.ap}</b></span>
      <span class="wstat">Attack <b>{gunnery.pool}</b><small> [{acc + (jumped ? rig : 0)}]</small>
        <RollButton pool={gunnery.pool} label={`${drone}: ${it.label || def.name}`} attack kind="ranged" rc={st.rc} /></span>
      {cap > 0 && (
        <span class="ammo-ctl">
          <b class={cx(left === 0 && 'bad')}>{left}/{cap}</b>
          {[1, 3, 6, 10].map((n) => <button key={n} type="button" class="sm" disabled={left < 1} title={`Fire ${n}`} onClick={() => setRounds(it.uid, left - n, cap)}>−{n}</button>)}
          <button type="button" class="sm" disabled={left === cap} onClick={() => setRounds(it.uid, cap, cap)}>Reload</button>
        </span>
      )}
      <button type="button" class="ghost sm" title="Take it off this drone" onClick={unmount}>✕</button>
    </div>
  );
}

function DroneCard({ e, d, ch, update }) {
  const { it, def } = e;
  const stats = e.stats;
  const ds = droneState(ch, it.uid);
  const set = (patch) => update((x) => setDroneState(x, it.uid, patch), { record: false });
  const ps = playState(ch);
  const setRounds = (uid, n, cap) => update((x) => { const p = playState(x); x.play = { ...p, rounds: { ...p.rounds, [uid]: Math.max(0, Math.min(cap, n)) } }; }, { record: false });
  const mount = (wuid, on) => update((x) => { const w = x.weapons.find((z) => z.uid === wuid); if (w) w.mountedOn = on ? it.uid : undefined; });
  const jumped = ds.mode === 'jumped';
  const moves = movesOf(def, it);
  const setMoves = (m) => update((x) => { const v = x.vehicles.find((z) => z.uid === it.uid); if (v) v.moves = m; });
  const { init, tests, rig } = droneTests(stats, d, { mode: ds.mode, sim: ds.sim, moves });
  const phys = physicalBoxes(def, stats.stats.body);
  const mtx = matrixBoxes(stats.stats.pilot);
  const down = ds.phys >= phys ? 'Destroyed' : ds.matrix >= mtx ? 'Bricked' : null;
  const mounted = d.items.weapons.filter((w) => w.it.mountedOn === it.uid);
  const free = d.items.weapons.filter((w) => !w.it.mountedOn && !w.it.auto); // natural / implant weapons can't be mounted
  const gunnery = tests.find((t) => t.id === 'gunnery');
  const rigged = (k) => (jumped && rig && (k === 'handling' || k === 'speed')); // control rig adds to Handling and Speed
  return (
    <section class={cx('panel drone-card', jumped && 'jumped', down && 'down')} id={`drone-${it.uid}`}>
      <header class="dhead">
        <div>
          <h3><InspectLink kind="vehicles" uid={it.uid}>{it.label || def.name}</InspectLink></h3>
          <small class="dim">{def.category}{down ? '' : jumped ? ' · you are jumped in' : ds.mode === 'remote' ? ' · under your remote control' : ''}</small>
          <label class="moves small">Moves by{' '}
            <select value={moves} aria-label={`How ${def.name} moves`} title="Sets which Pilot skill you roll for it (the data doesn't say, so this starts as a guess)" onChange={(e) => setMoves(e.currentTarget.value)}>
              {MOVES.map(([m, skill]) => <option key={m} value={m}>{m} ({skill})</option>)}
            </select>
            {!it.moves && <span class="dim"> (guessed)</span>}
          </label>
        </div>
        {down ? <span class="pip bad">{down}</span> : (
          <div class="modeswitch small" role="radiogroup" aria-label="Control">
            {MODE_OPTS.map(([k, lbl, hint]) => (
              <button key={k} type="button" role="radio" aria-checked={ds.mode === k} title={hint} class={cx('mode-opt', ds.mode === k && 'on')} onClick={() => set({ mode: k })}>{lbl}</button>
            ))}
          </div>
        )}
      </header>
      {jumped && !down && (
        <div class="row gap simrow">
          <span class="small dim">Sim:</span>
          {['hot', 'cold'].map((k) => <label key={k} class="check"><input type="radio" name={`sim-${it.uid}`} checked={ds.sim === k} onChange={() => set({ sim: k })} /> {k}-sim</label>)}
          <span class="small dim">{ds.sim === 'hot' ? '+1 die on vehicle actions, 4D6 Initiative; biofeedback is Physical' : '3D6 Initiative; biofeedback is Stun'}{rig ? ` · control rig ${rig}: +${rig} dice, +${rig} Handling/Speed/Sensor limits` : ' · no control rig found'}</span>
        </div>
      )}

      <div class="dmonitors">
        <Monitor label="Physical" boxes={phys} damage={ds.phys} tone="phys" live wounds={false} onChange={(v) => set({ phys: v })} />
        <Monitor label="Matrix" boxes={mtx} damage={ds.matrix} tone="stun" live wounds={false} onChange={(v) => set({ matrix: v })} />
        {(ds.phys > 0 || ds.matrix > 0) && <button type="button" class="ghost sm" onClick={() => set({ phys: 0, matrix: 0 })}>Repaired</button>}
      </div>

      <div class="stat-grid tight">
        {[['Handling', 'handling'], ['Speed', 'speed'], ['Accel', 'accel'], ['Body', 'body'], ['Armor', 'armor'], ['Pilot', 'pilot'], ['Sensor', 'sensor']].map(([label, k]) => (
          <div key={k} class="stat"><span class="lbl">{label}</span><VehStat e={e} k={k} as="b" />{rigged(k) && <small class="boosted" title="Control rig, while jumped in"> +{rig}</small>}</div>
        ))}
        <div class="stat"><span class="lbl">Initiative</span><b>{init.base} + {init.dice}D6</b><small>{init.text}</small></div>
      </div>

      <div class="dtests">{tests.filter((t) => t.id !== 'gunnery').map((t) => <DroneTest key={t.id} t={t} label={it.label || def.name} />)}</div>

      <h4 class="dsub">Weapons</h4>
      {mounted.length === 0 && <p class="small dim">Nothing mounted. {gunnery && `Attack pool would be ${gunnery.pool} (${gunnery.formula}).`}</p>}
      {mounted.map((w) => <DroneWeapon key={w.it.uid} e={w} d={d} drone={it.label || def.name} gunnery={gunnery} rig={rig} jumped={jumped} ps={ps} setRounds={setRounds} unmount={() => mount(w.it.uid, false)} updateW={update} />)}
      {free.length > 0 && (
        <select value="" aria-label={`Mount a weapon on ${def.name}`} onChange={(ev) => ev.currentTarget.value && mount(ev.currentTarget.value, true)}>
          <option value="">+ Mount a weapon you own…</option>
          {free.map((w) => <option key={w.it.uid} value={w.it.uid}>{w.it.label || w.def.name}</option>)}
        </select>
      )}

      <div class="row gap dfoot">
        <input class="grow" placeholder="Notes: orders, position, silent running, status…" value={ds.notes} aria-label={`${def.name} notes`}
          onChange={(ev) => set({ notes: ev.currentTarget.value })} />
      </div>
      <details class="dmods"><summary>Modifications</summary><VehicleModsList it={it} def={def} update={update} readOnly /></details>
    </section>
  );
}

/** one line per drone: damage + control at a glance; click to jump to its card */
function DroneStrip({ list, ch }) {
  return (
    <div class="dstrip" role="list">
      {list.map((e) => {
        const ds = droneState(ch, e.it.uid);
        const phys = physicalBoxes(e.def, e.stats.stats.body);
        const mtx = matrixBoxes(e.stats.stats.pilot);
        const down = ds.phys >= phys || ds.matrix >= mtx;
        return (
          <a key={e.it.uid} role="listitem" href={`#drone-${e.it.uid}`} class={cx('dchip', down && 'down', ds.mode === 'jumped' && 'jumped')}
            onClick={(ev) => { ev.preventDefault(); document.getElementById(`drone-${e.it.uid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <b>{e.it.label || e.def.name}</b>
            <span class={cx(ds.phys > 0 && 'bad')}>Phys {ds.phys}/{phys}</span>
            <span class={cx(ds.matrix > 0 && 'warn')}>Matrix {ds.matrix}/{mtx}</span>
            {ds.mode === 'jumped' && <span class="pip on">jumped in</span>}
          </a>
        );
      })}
    </div>
  );
}

/** shared by PlayDrones/PlayVehicles: the strip + hint + card list, over whichever subset of d.items.vehicles
 * the caller already filtered down to. */
function VehicleList({ list, ch, d, update, emptyText, noun }) {
  if (list.length === 0) return <div class="tab"><Empty>{emptyText}</Empty></div>;
  return (
    <div class="tab">
      {list.length > 1 && <DroneStrip list={list} ch={ch} />}
      <p class="hint">
        {noun}: <SourceRef source="SR5" page={DRONE_PAGES.tests} /> (tests, Initiative) · damage <SourceRef source="SR5" page={DRONE_PAGES.cm} />, <SourceRef source="SR5" page={DRONE_PAGES.damage} /> ·
        Matrix <SourceRef source="SR5" page={DRONE_PAGES.matrixCm} /> · jumped in <SourceRef source="SR5" page={DRONE_PAGES.sim} />, control rig <SourceRef source="SR5" page={DRONE_PAGES.controlRig} />.
        Autosofts: the best of each kind you own is used ({noun.toLowerCase()} share them through your RCC).
      </p>
      <div class="drone-list">
        {list.map((e) => <DroneCard key={e.it.uid} e={e} d={d} ch={ch} update={update} />)}
      </div>
    </div>
  );
}

export function PlayDrones() {
  const { ch, d, update } = useChar();
  const list = d.items.vehicles.filter((e) => isDrone(e.def));
  return <VehicleList list={list} ch={ch} d={d} update={update} emptyText="No drones yet." noun="Drones" />;
}

export function PlayVehicles() {
  const { ch, d, update } = useChar();
  const list = d.items.vehicles.filter((e) => !isDrone(e.def));
  return <VehicleList list={list} ch={ch} d={d} update={update} emptyText="No vehicles yet." noun="Vehicles" />;
}


/** every non-program item the character owns, searchable, grouped by category. Gear that's bundled into
 * something else (a deck's Sim Module, a commlink's built-in camera, ...) doesn't get its own row here -
 * it's built into the item that carries it, so it's listed on that item's "Includes:" line instead. */
function GearInventory({ d }) {
  const [q, setQ] = useState('');
  const all = d.items.gear.filter((e) => !isProgramDef(e.def) && !e.it.child);
  const term = q.trim().toLowerCase();
  const matches = (e) => {
    if (!term) return true;
    if (`${e.def.name} ${e.def.category} ${e.it.notes || ''}`.toLowerCase().includes(term)) return true;
    return gearDescendants(d.items.gear, e.it.uid).some((k) => k.def.name.toLowerCase().includes(term));
  };
  const rows = all.filter(matches);
  const byCat = new Map();
  for (const e of rows) {
    const c = e.def.category || 'Other';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(e);
  }
  const cats = [...byCat.keys()].sort((a, b) => a.localeCompare(b));
  const total = all.reduce((s, e) => s + e.cost, 0);
  return (
    <Panel
      title="Gear"
      sub="everything you carry; programs and Matrix devices' settings are on the Matrix tab"
      right={
        <>
          <input class="search sm" placeholder="Find gear…" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Find gear" />
          <span class="pip">{term ? `${rows.length} of ${all.length}` : all.length} item{all.length === 1 ? '' : 's'}</span>
          <span class="pip" title="Total value at list price">{nuyen(total)}</span>
        </>
      }
    >
      {all.length === 0 ? <Empty>No gear.</Empty> : rows.length === 0 ? <Empty>Nothing matches.</Empty> : (
        <div class="tbl-wrap">
          <table class="tbl compact inventory">
            <thead><tr><th>Item</th><th class="num">Rtg</th><th class="num">Qty</th><th class="num">Avail</th><th class="num">Cost</th><th /></tr></thead>
            <tbody>
              {cats.map((cat) => [
                <tr key={'h' + cat} class="cathead"><td colSpan="6">{cat} <small>{byCat.get(cat).length}</small></td></tr>,
                ...byCat.get(cat).map(({ it, def, cost, avail }) => (
                  <tr key={it.uid}>
                    <th>
                      <InspectLink kind="gear" uid={it.uid}>{def.name}</InspectLink>
                      {it.notes && <small class="block-note">{it.notes}</small>}
                      <BundledLine it={it} d={d} />
                    </th>
                    <td class="num">{it.rating || ''}</td>
                    <td class="num">{(it.qty || 1) > 1 ? it.qty : ''}</td>
                    <td class="num">{fmtAvail(avail)}</td>
                    <td class="num dim">{it.free ? 'incl.' : nuyen(cost)}</td>
                    <td><SourceRef source={def.source} page={def.page} /></td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// =================================================================== Magic helper
/** "F-3", "F+1", "F", "L+2" ... -> number for a given Force/Level (drain is never below 2) */
function drainValue(code, n, min = 2) {
  const c = txt(code).trim();
  if (!c || /special/i.test(c)) return null;
  const v = evalExpr(c.replace(/[FL]/g, String(n)), {});
  return Number.isNaN(v) ? null : Math.max(min, v);
}

/**
 * "Cast" (Play mode only): roll the casting pool, then resist drain, then apply the drain damage to the
 * condition monitor - one guided flow instead of three separate manual rolls + a manual Condition click.
 * Doesn't touch Edge (Push the Limit / Second Chance) - the per-pool dice-icon RollButtons next to each number
 * still exist for that, and for re-rolling outside this flow.
 */
function CastTray({ name, castPool, drainVal, resistPool, physical, ch, d, update, onClose }) {
  const [castResult, setCastResult] = useState(null);
  const [drainResult, setDrainResult] = useState(null);
  const [applied, setApplied] = useState(false);
  const ps = playState(ch);
  const cap = physical ? d.cm.physical : d.cm.stun;
  const cur = physical ? ps.phys : ps.stun;
  const damage = drainResult ? Math.max(0, drainVal - drainResult.hits) : null;
  const apply = () => {
    update((x) => { x.play = { ...playState(x), [physical ? 'phys' : 'stun']: Math.min(cap, cur + damage) }; }, { record: false });
    setApplied(true);
  };
  return (
    <Modal title={`Cast ${name}`} onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}>
      <div class="roll-body">
        <p class="hint">1. Roll Spellcasting ({castPool} dice) to see if it works.</p>
        {!castResult ? (
          <button type="button" class="primary" onClick={() => setCastResult(rollPool(castPool))}>Roll {castPool}d6</button>
        ) : (
          <div class="roll-verdict">
            <b class="hits">{castResult.hits} hit{castResult.hits === 1 ? '' : 's'}</b>
            {castResult.critical ? <span class="pip bad">Critical glitch</span> : castResult.glitch ? <span class="pip warn">Glitch</span> : null}
          </div>
        )}
        {castResult && (
          <>
            <p class="hint">2. Resist {drainVal} {physical ? 'Physical' : 'Stun'} drain ({resistPool} dice) - each hit reduces it by 1.</p>
            {!drainResult ? (
              <button type="button" class="primary" onClick={() => setDrainResult(rollPool(resistPool))}>Roll {resistPool}d6</button>
            ) : (
              <div class="roll-verdict">
                <b class="hits">{drainResult.hits} hit{drainResult.hits === 1 ? '' : 's'}</b>
                {drainResult.critical ? <span class="pip bad">Critical glitch</span> : drainResult.glitch ? <span class="pip warn">Glitch</span> : null}
              </div>
            )}
          </>
        )}
        {drainResult && (
          <>
            <p class="hint">3. {damage} {physical ? 'Physical' : 'Stun'} damage ({drainVal} − {drainResult.hits} hit{drainResult.hits === 1 ? '' : 's'}, min 0).</p>
            {applied ? <p class="hint">Applied to Condition.</p> : (
              <button type="button" class="primary" disabled={damage === 0} onClick={apply}>
                {damage > 0 ? `Apply ${damage} damage` : 'No damage to apply'}
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function CastSpellButton({ name, castPool, drainVal, resistPool, physical, ch, d, update }) {
  const [open, setOpen] = useState(false);
  if (drainVal == null || !castPool || Number.isNaN(resistPool)) return null;
  return (
    <>
      <button type="button" class="ghost sm" title="Roll casting, resist drain, and apply the damage in one flow" onClick={() => setOpen(true)}>Cast</button>
      {open && <CastTray name={name} castPool={castPool} drainVal={drainVal} resistPool={resistPool} physical={physical} ch={ch} d={d} update={update} onClose={() => setOpen(false)} />}
    </>
  );
}

function SustainedPanel({ ch, d, update }) {
  const [name, setName] = useState('');
  const play = playState(ch);
  const known = [
    ...ch.spells.map((s) => { const def = itemDef('spells', s); return def && def.name; }),
    ...ch.complexForms.map((c) => { const def = itemDef('complexForms', c); return def && def.name; }),
  ].filter(Boolean);
  const penalty = sustainPenalty(ch);
  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    update((x) => addSustained(x, n), { record: false });
    setName('');
  };
  return (
    <Panel title="Sustained spells & forms" sub={`SR5 core p.${SUSTAIN_PAGE} - each one is a flat -${SUSTAIN_PENALTY} to everything you do, until you drop it`}>
      {play.sustained.length === 0 ? <Empty>Nothing currently sustained.</Empty> : (
        <ul class="plain">
          {play.sustained.map((s) => (
            <li key={s.uid} class="row between">
              <span>{s.name}</span>
              <button type="button" class="ghost sm" aria-label={`Stop sustaining ${s.name}`} onClick={() => update((x) => removeSustained(x, s.uid), { record: false })}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {penalty > 0 && <p class="hint bad">−{penalty} dice pool penalty to everything you do, from {play.sustained.length} sustained.</p>}
      <form class="row gap" onSubmit={submit}>
        <input class="grow" list="sustain-suggest" placeholder="Spell or complex form…" value={name}
          onInput={(e) => setName(e.currentTarget.value)} aria-label="What are you sustaining" />
        <datalist id="sustain-suggest">{known.map((n) => <option key={n} value={n} />)}</datalist>
        <button type="submit" class="primary sm">+ Sustain</button>
      </form>
    </Panel>
  );
}

function MagicPage({ focus }) {
  const { ch, d, update } = useChar();
  const magic = d.attr.MAG.enabled;
  const res = d.attr.RES.enabled;
  const mag = d.attr.MAG.total;
  const [force, setForce] = useState(Math.max(1, mag || 1));
  const [level, setLevel] = useState(Math.max(1, d.attr.RES.total || 1));
  const spellcasting = d.skills.find((s) => s.name === 'Spellcasting');
  const trad = idx('traditions', 'traditions').byName.get(String(ch.tradition || '').toLowerCase());
  const drainVars = {};
  for (const [k, a] of Object.entries(d.attr)) drainVars[k] = a.total;
  const resist = trad ? evalExpr(txt(trad.drain), drainVars) : NaN;
  const physical = force > mag;
  const fadeResist = d.attr.RES.total + d.attr.WIL.total;

  if (!magic && !res) return <div class="tab"><Panel title="Magic & Resonance"><Empty>This character has no Magic or Resonance.</Empty></Panel></div>;

  return (
    <div class="tab">
      {magic && (
        <Panel title="Casting helper" sub="pick a Force to see the drain for every spell">
          <div class="pools">
            <div class="pool-tile"><span class="lbl">Force</span><Stepper value={force} min={1} max={Math.max(1, mag * 2)} onChange={setForce} /><small>limit = Force</small></div>
            <div class="pool-tile"><span class="lbl">Spellcasting pool</span><b>{spellcasting && spellcasting.rating > 0 ? spellcasting.pool : '—'}</b>
              <small>{spellcasting && spellcasting.focusBonus ? `incl. ${spellcasting.focusSrc} · a category focus may add more (per spell below)` : 'Spellcasting + Magic'}</small>
              {spellcasting && spellcasting.rating > 0 && <RollButton pool={spellcasting.pool} label="Spellcasting" />}</div>
            <div class="pool-tile"><span class="lbl">Drain resistance</span><b>{Number.isNaN(resist) ? '—' : resist}</b><small>{trad ? trad.name : 'choose a tradition'}</small>{!Number.isNaN(resist) && <RollButton pool={resist} label="Drain resistance" />}</div>
            <div class="pool-tile"><span class="lbl">Drain damage</span><b class={cx(physical && 'bad')}>{physical ? 'Physical' : 'Stun'}</b><small>{physical ? 'Force exceeds Magic' : 'Force ≤ Magic'}</small></div>
          </div>
        </Panel>
      )}
      <MagicActionPools ch={ch} d={d} />
      {magic && ch.spells.length > 0 && (
        <Panel title="Spells">
          <table class="tbl compact">
            <thead><tr><th>Spell</th><th>Category</th><th>Type</th><th>Range</th><th>Duration</th><th class="num">Pool</th><th class="num">Damage @ F{force}</th><th class="num">Drain @ F{force}</th><th /><th /></tr></thead>
            <tbody>
              {ch.spells.map((s) => {
                const def = itemDef('spells', s);
                if (!def) return null;
                const v = drainValue(def.dv, force);
                const sp = d.magic.spellPool(def.category); // Spellcasting + the best focus for this category
                // Combat spell damage isn't a stored formula - by rule (SR5 core p.282) it's simply the Force you
                // cast it at, resisted with the target's normal Soak test. The data's "0" for every non-Combat
                // spell (and a couple of Combat ones with no direct-damage effect, like Evil Eye) means "n/a".
                const hasDamage = def.damage && def.damage !== '0';
                return (
                  <tr key={s.uid}>
                    <th><InspectLink kind="spells" uid={s.uid}>{def.name}</InspectLink></th>
                    <td>{def.category}</td><td>{def.type}</td><td>{def.range}</td><td>{def.duration}</td>
                    <td class={cx('num', sp && sp.focus && 'boosted')} title={sp && sp.focus ? `+${sp.focus} from ${sp.focusSrc}` : undefined}>
                      {sp ? <>{sp.pool} <RollButton pool={sp.pool} label={`Cast ${def.name}`} /></> : '—'}
                    </td>
                    <td class="num strong" title={hasDamage ? `Combat spell damage = Force (SR5 core p.282), resisted with a normal Soak test` : undefined}>
                      {hasDamage ? `${force}${def.damage}` : '—'}
                    </td>
                    <td class="num strong" title={`Drain code ${def.dv}`}>{v == null ? def.dv : v}</td>
                    <td>
                      {v != null && sp && (
                        <CastSpellButton name={def.name} castPool={sp.pool} drainVal={v} resistPool={resist} physical={physical} ch={ch} d={d} update={update} />
                      )}
                    </td>
                    <td><SourceRef source={def.source} page={def.page} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
      {(ch.powers.length > 0 || d.powerGrants.length > 0) && (
        <Panel title="Adept powers" right={<span class="pip">{d.magic.ppUsed}/{d.magic.ppTotal} PP</span>}>
          <ul class="plain cols">
            {ch.powers.map((p) => { const def = itemDef('powers', p); return def && <li key={p.uid}><InspectLink kind="powers" uid={p.uid}>{def.name}</InspectLink>{p.level > 1 ? ` ${p.level}` : ''}{def.action && <small> · {def.action}</small>}</li>; })}
          </ul>
          <GrantedPowersList d={d} />
        </Panel>
      )}
      <BoostPanel ch={ch} d={d} update={update} />
      {res && (
        <Panel title="Complex forms" sub="pick a Level to see fading">
          <div class="pools">
            <div class="pool-tile"><span class="lbl">Level</span><Stepper value={level} min={1} max={Math.max(1, d.attr.RES.total * 2)} onChange={setLevel} /></div>
            <div class="pool-tile"><span class="lbl">Fading resistance</span><b>{fadeResist}</b><small>RES + WIL</small><RollButton pool={fadeResist} label="Fading resistance" /></div>
          </div>
          {ch.complexForms.length === 0 ? <Empty>No complex forms.</Empty> : (
            <table class="tbl compact">
              <thead><tr><th>Form</th><th>Target</th><th>Duration</th><th class="num">Fading @ L{level}</th></tr></thead>
              <tbody>
                {ch.complexForms.map((c) => {
                  const def = itemDef('complexForms', c);
                  if (!def) return null;
                  const v = drainValue(def.fv, level);
                  return <tr key={c.uid}><th><InspectLink kind="complexForms" uid={c.uid}>{def.name}</InspectLink></th><td>{def.target}</td><td>{def.duration}</td><td class="num strong">{v == null ? def.fv : v}</td></tr>;
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}
      {((magic && !d.magic.isAdept) || d.magic.isMystic || res) && <SpiritsPanel ch={ch} d={d} update={update} />}
      <InitiationPanel ch={ch} d={d} update={update} />
      {focus && <SustainedPanel ch={ch} d={d} update={update} />}
    </div>
  );
}

export function PlayMagic() { return <MagicPage />; }
export function PlayMagicFocus() { return <MagicPage focus />; }

// =================================================================== Journal
const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Journal() {
  const { ch, d, update } = useChar();
  const [text, setText] = useState('');
  const [karma, setKarma] = useState(3);
  const [cash, setCash] = useState(1000);
  const [why, setWhy] = useState('');
  const career = ch.mode === 'career';
  const log = ch.journal || [];
  const add = () => {
    const t = text.trim();
    if (!t) return;
    update((x) => { x.journal = [...(x.journal || []), { t: Date.now(), text: t }]; }, { record: false });
    setText('');
  };
  const award = (kind, amt) => update((x) => addEntry(x, kind, amt, why), { record: false });

  return (
    <div class="tab">
      <Panel title="Rewards & money" sub={career ? 'karma and nuyen you earn or spend during play' : 'available once the character is finished'}
        right={<><span class="pip">Karma {d.karma.left}</span><span class="pip">{nuyen(d.nuyen.left)}</span></>}>
        {!career ? (
          <p class="hint" style={{ marginTop: 0 }}>This character is still in creation. Switch to <b>Build</b> and use <b>Finish creation</b> to start tracking Karma and nuyen here.</p>
        ) : (
          <>
            <div class="row gap wrap">
              <div class="field"><span class="lbl">Karma</span><span class="row gap"><Stepper value={karma} min={1} max={99} onChange={setKarma} /><button type="button" class="primary" onClick={() => award('karma', karma)}>Award Karma</button></span></div>
              <div class="field"><span class="lbl">Nuyen</span>
                <span class="row gap">
                  <Stepper value={cash} min={50} max={9999999} step={250} width="90px" onChange={setCash} />
                  <button type="button" class="primary" onClick={() => award('nuyen', cash)}>+ Earn</button>
                  <button type="button" onClick={() => award('nuyen', -cash)}>− Spend</button>
                </span></div>
              <div class="field grow"><span class="lbl">Note (optional)</span><input value={why} placeholder="What for? e.g. Run: Ares data heist" onInput={(e) => setWhy(e.currentTarget.value)} /></div>
            </div>
            {(ch.career.log || []).length > 0 && (
              <ul class="plain ledger">
                {[...ch.career.log].reverse().slice(0, 30).map((e, i) => (
                  <li key={e.t + '-' + i}>
                    <small>{when(e.t)}</small> <b class={cx(e.amt < 0 && 'bad')}>{entryAmount(e, nuyen)}</b> {e.note}
                    <button type="button" class="ghost sm" title="Undo this entry" aria-label={`Undo ${entryAmount(e, nuyen)}`} onClick={() => update((x) => undoEntry(x, e.t), { record: false })}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Panel title="Session log">
        <div class="row gap addrow">
          <textarea class="grow" rows="2" placeholder="What happened? Who owes whom? Loose ends…" value={text} onInput={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(); }} />
          <button type="button" class="primary" onClick={add}>Add entry</button>
        </div>
        {log.length === 0 ? <Empty>No entries yet. Ctrl+Enter adds one.</Empty> : (
          <ul class="journal">
            {[...log].reverse().map((e, i) => (
              <li key={e.t + '-' + i}>
                <small>{when(e.t)}</small>
                <p class="pre">{e.text}</p>
                <button type="button" class="ghost sm" aria-label="Delete entry" onClick={() => update((x) => { x.journal = (x.journal || []).filter((z) => z.t !== e.t); }, { record: false })}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Notes" sub="anything you want to keep with the character">
        <textarea rows="6" value={ch.info.notes || ''} onChange={(e) => update((x) => { x.info.notes = e.currentTarget.value; }, { record: false })} />
      </Panel>
    </div>
  );
}
