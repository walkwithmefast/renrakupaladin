// The Matrix deck card (v23): one card for the device you're using as your persona - its Matrix attributes (click two
// to swap them, the Reconfigure action), Matrix damage track, initiative and resist pools, and its program slots - plus
// a library of the programs you own to load into those slots (click, or drag onto the card). Used by Build's Programs
// subtab and Play's Matrix tab; engine/matrix.js has the rules.
import { useState } from 'preact/hooks';
import { playState } from '../engine/edge.js';
import {
  ASDF, isProgramDef, programInfo, loadBlocker, setProgramDevice, swapAsdf, matrixDamage, setMatrixDamage, PROGRAMS_PAGE,
} from '../engine/matrix.js';
import { Panel, InspectLink, bookUrl, cx } from './common.jsx';
import { BundledLine } from './ModsEditor.jsx';
import { RollButton } from './Roller.jsx';
import { Monitor } from './SheetTab.jsx';

const KIND_LABEL = { deck: 'cyberdeck', commlink: 'commlink', rcc: 'rigger command console', living: 'Living Persona' };
const STAT_OF = { a: 'a', s: 's', d: 'dp', f: 'f' };
const DRAG_TYPE = 'text/x-rp-program';

/** one line on what a program does: the core-book summary, else the first sentence of its rulebook description */
function programLine(def) {
  const info = programInfo(def.name);
  if (info) return info.text;
  const ex = typeof window !== 'undefined' && window.SR5TEXT && window.SR5TEXT[def.id];
  const first = ex ? String(ex[0] || '').split(/(?<=[.!?])\s/)[0] : '';
  if (first) return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first;
  return def.category === 'Hacking Programs' ? 'hacking program' : 'common program';
}

/** one Matrix attribute tile; on a deck, clicking two of them swaps their values */
function AsdfTile({ k, label, dev, picked, onPick }) {
  const key = STAT_OF[k];
  const value = dev[key];
  const boosts = dev.boosts[key] || [];
  const canSwap = !!dev.cfg && onPick;
  const title = boosts.length ? `${label} ${dev.base[key]} → ${value}: ${boosts.join(', ')}` : label;
  const body = (
    <>
      <span class="lbl">{label}</span>
      <b class={cx(boosts.length && 'boosted')}>{value}</b>
      {boosts.length > 0 && <small>{boosts.join(', ')}</small>}
    </>
  );
  return canSwap ? (
    <button type="button" class={cx('asdf-tile', picked && 'picked', dev.cfg && !dev.cfg.ok && 'bad')} title={`${title} - click, then click another attribute to swap them`}
      aria-pressed={picked} onClick={() => onPick(k)}>{body}</button>
  ) : <div class="asdf-tile" title={title}>{body}</div>;
}

function Slot({ e, dev, onEject, readOnly }) {
  return (
    <div class={cx('slot filled', e.def.category === 'Hacking Programs' && 'hack')}>
      <span class="slot-name"><InspectLink kind="gear" uid={e.it.uid}>{e.def.name}</InspectLink></span>
      <small>{programLine(e.def)}</small>
      {!readOnly && <button type="button" class="ghost sm eject" aria-label={`Eject ${e.def.name} from ${dev.name}`} title="Eject (back to storage)" onClick={() => onEject(e.it.uid)}>✕</button>}
    </div>
  );
}

function LibraryChip({ e, blocker, where, onLoad, readOnly }) {
  const line = programLine(e.def);
  const tip = [line, blocker, where && `Running on ${where} - click to move it here`].filter(Boolean).join('\n');
  return (
    <button type="button" class={cx('libchip', e.def.category === 'Hacking Programs' && 'hack', where && 'elsewhere')}
      disabled={readOnly || !!blocker} title={tip || 'Click to load it into the deck'} draggable={!readOnly && !blocker}
      onDragStart={(ev) => { ev.dataTransfer.setData(DRAG_TYPE, e.it.uid); ev.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onLoad(e.it.uid)}>
      <b>{e.def.name}</b>
      <small>{where ? `on ${where}` : line}</small>
    </button>
  );
}

export function MatrixDeck({ ch, d, update, playing }) {
  const [picked, setPicked] = useState(null);
  const [dropping, setDropping] = useState(false);
  const m = d.matrix;
  const tech = d.attr.RES.enabled;
  const rec = playing ? { record: false } : undefined;
  if (m.devices.length === 0 && !tech) {
    return (
      <Panel title="Matrix">
        <p class="empty">No commlink or cyberdeck yet. Add one under Weapons, armor &amp; gear (search "commlink" or a deck name).</p>
      </Panel>
    );
  }
  const p = m.persona;
  const activeKey = p ? (p.living ? 'living' : p.uid) : '';
  const choices = [...(tech ? [{ key: 'living', name: 'Living Persona', kind: 'living' }] : []), ...m.devices.map((x) => ({ key: x.uid, name: x.name, kind: x.kind }))];
  const setActive = (v) => { setPicked(null); update((x) => { x.activeDevice = v; }, rec); };
  const dev = p && !p.living ? m.devices.find((x) => x.uid === p.uid) : null;
  const programs = d.items.gear.filter((e) => isProgramDef(e.def));
  const running = dev ? programs.filter((e) => e.it.device === dev.uid) : [];
  const stored = programs.filter((e) => !dev || e.it.device !== dev.uid);
  const play = playState(ch);
  const dmgKey = p ? (p.living ? 'living' : p.uid) : '';
  const load = (uid) => {
    const e = programs.find((z) => z.it.uid === uid);
    if (!dev || !e || loadBlocker(m, e.def, dev.uid)) return;
    update((x) => setProgramDevice(x, uid, dev.uid), rec);
  };
  const eject = (uid) => update((x) => setProgramDevice(x, uid, ''), rec);
  const pick = (k) => {
    if (!picked) { setPicked(k); return; }
    if (picked !== k) update((x) => swapAsdf(x, dev.uid, dev.cfg, picked, k), rec);
    setPicked(null);
  };
  const slots = dev && dev.limit != null ? Math.max(dev.limit, running.length) : null;
  const url = bookUrl('SR5', PROGRAMS_PAGE);
  const devName = (uid) => (m.devices.find((x) => x.uid === uid) || {}).name;

  return (
    <>
      <Panel title="Matrix" sub={p ? `${p.label} is your persona` : 'Pick the device you jack in with'}
        right={choices.length > 1 && (
          <div class="modeswitch small devpick" role="radiogroup" aria-label="Persona device">
            {choices.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={activeKey === c.key} class={cx('mode-opt', activeKey === c.key && 'on')} onClick={() => setActive(c.key)}>
                {c.name}
              </button>
            ))}
          </div>
        )}>
        {!p ? <p class="hint">Pick a device above to see your persona.</p> : (
          <div class="deck"
            onDragOver={(ev) => { if (dev && ev.dataTransfer.types.includes(DRAG_TYPE)) { ev.preventDefault(); setDropping(true); } }}
            onDragLeave={() => setDropping(false)}
            onDrop={(ev) => { setDropping(false); const uid = ev.dataTransfer.getData(DRAG_TYPE); if (uid) { ev.preventDefault(); load(uid); } }}>
            <header class="deck-head">
              <div>
                <b class="deck-name">{dev ? <InspectLink kind="gear" uid={dev.uid}>{dev.name}</InspectLink> : p.label}</b>
                <small>{KIND_LABEL[p.kind] || p.kind} · Device Rating {p.dr}</small>
                {dev && <BundledLine it={{ uid: dev.uid }} d={d} />}
              </div>
            </header>
            <div class="asdf-row">
              {ASDF.map(([k, label]) => <AsdfTile key={k} k={k} label={label} dev={p} picked={picked === k} onPick={dev && dev.cfg ? pick : null} />)}
            </div>
            {dev && dev.cfg && d.overclock && (
              <p class="hint">Overclocker (Run Faster p.148): +1 to{' '}
                <select value={(ch.gear.find((g) => g.uid === dev.uid) || {}).overclock || ''} aria-label="Overclocked attribute"
                  onChange={(e) => { const v = e.currentTarget.value; update((x) => { const g = x.gear.find((z) => z.uid === dev.uid); if (g) g.overclock = v; }, rec); }}>
                  <option value="">— pick —</option>
                  {ASDF.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </p>
            )}
            {dev && dev.cfg && <p class="hint">{picked ? `Now click the attribute to swap ${ASDF.find(([k]) => k === picked)[1]} with (or the same one to cancel).` : 'Reconfigure: click two attributes to swap them (SR5 core p.228).'}</p>}
            <Monitor label="Matrix" boxes={p.cm} damage={matrixDamage(play, dmgKey)} tone="stun" live={playing} wounds={false}
              onChange={(v) => update((x) => setMatrixDamage(x, dmgKey, v), { record: false })} />
            <div class="deck-lines">
              <span><small>Init</small> AR {m.init.ar} + {m.init.arDice}D6 · cold {m.init.cold.base} + {m.init.cold.dice}D6 · hot {m.init.hot.base} + {m.init.hot.dice}D6</span>
              <span title={m.pools.matrix.text}><small>Resist Matrix</small> <b>{m.pools.matrix.n}</b> <RollButton pool={m.pools.matrix.n} label="Resist Matrix damage" /></span>
              <span title={m.pools.bio.text}><small>Resist biofeedback</small> <b>{m.pools.bio.n}</b> <RollButton pool={m.pools.bio.n} label="Resist biofeedback" /></span>
            </div>

            {p.living ? <p class="hint">Technomancers don't run programs - your complex forms are on the Magic/Resonance pages.</p> : (
              <section class={cx('slots-wrap', dropping && 'drop')}>
                <h4 class="sub">
                  Programs {slots != null ? <span class={cx('pip', dev.loaded > dev.limit && 'bad')}>{dev.loaded} / {dev.limit}</span> : <span class="pip">{running.length} running</span>}
                  {dev.boosts.limit && <small> {dev.boosts.limit.join(', ')}</small>}
                </h4>
                <div class="slots">
                  {running.map((e) => <Slot key={e.it.uid} e={e} dev={dev} onEject={eject} />)}
                  {slots != null && Array.from({ length: Math.max(0, slots - running.length) }, (_, i) => (
                    <div key={`empty${i}`} class="slot empty">Empty slot<small>{stored.length ? 'click a program below, or drag it here' : 'no programs in storage'}</small></div>
                  ))}
                  {slots == null && running.length === 0 && <div class="slot empty">Nothing running<small>{dev.kind === 'commlink' ? 'commlinks run common programs only' : 'click a program below to run it'}</small></div>}
                </div>
              </section>
            )}
          </div>
        )}
        {m.warnings.length > 0 && <ul class="warnings inline">{m.warnings.map((w, i) => <li key={i} class="warn">{w}</li>)}</ul>}
      </Panel>

      {dev && programs.length > 0 && (
        <Panel title="Program library" sub={`in storage - click to load into ${dev.name}`}
          right={url && <a class="src" href={url} target="_blank" rel="noopener">SR5 core p.{PROGRAMS_PAGE}-246 ↗</a>}>
          {stored.length === 0 ? <p class="empty">Every program you own is running.</p> : (
            ['Common Programs', 'Hacking Programs'].map((cat) => {
              const list = stored.filter((e) => e.def.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat} class="libgroup">
                  <h4 class="sub">{cat === 'Common Programs' ? 'Common' : 'Hacking'}</h4>
                  <div class="library">
                    {list.map((e) => (
                      <LibraryChip key={e.it.uid} e={e} blocker={loadBlocker(m, e.def, dev.uid)} where={e.it.device ? devName(e.it.device) : ''} onLoad={load} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </Panel>
      )}
    </>
  );
}
