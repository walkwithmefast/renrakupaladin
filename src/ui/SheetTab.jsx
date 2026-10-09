import { useState } from 'preact/hooks';
import { useChar, useViewMode } from '../store.js';
import { ATTR_NAME, arr } from '../engine/data.js';
import { itemDef } from '../engine/character.js';
import { playState, woundModifier } from '../engine/edge.js';
import { isProgramDef } from '../engine/matrix.js';
import { SKILL_CATEGORY_ORDER } from '../engine/rules.js';
import { nuyen, cx, InspectLink } from './common.jsx';
import { EdgePanel } from './EdgePanel.jsx';
import { WeaponsPanel } from './WeaponsPanel.jsx';
import { KnowledgePanel } from './KnowledgePanel.jsx';
import { MatrixActionPools } from './ActionPools.jsx';
import { RollButton } from './Roller.jsx';
import { PROTECTION_LABEL } from '../engine/mods.js';
import { activeSin } from '../engine/identity.js';
import { IdentityPicker, CoverableName, SinCard } from './Identity.jsx';

const MATRIX_SKILLS = new Set(['Hacking', 'Cybercombat', 'Electronic Warfare', 'Computer']);

// ------------------------------------------------------------------ small pieces
function Tile({ k, d, note }) {
  const a = d.attr[k];
  if (!a || !a.enabled) return null;
  const changed = a.total !== a.natural;
  return (
    <div class={cx('tile', k)}>
      <span class="lbl">{ATTR_NAME[k]}</span>
      <b>{a.total}</b>
      <small>{note || (changed ? `natural ${a.natural}` : `max ${a.max}`)}</small>
      {a.boost > 0 && <small class="boost-note" title="Attribute Boost: dice pools only, not limits or Initiative">+{a.boost} boost → {a.pool} for pools</small>}
    </div>
  );
}

function Block({ tone, title, children, foot }) {
  return (
    <section class={cx('block', tone)}>
      <h3>{title}</h3>
      <div class="tiles">{children}</div>
      {foot && <footer>{foot}</footer>}
    </section>
  );
}

const Foot = ({ label, value }) => <span class="foot-stat"><small>{label}</small><b>{value}</b></span>;

export function Monitor({ label, boxes, damage, onChange, tone, live, wounds = true, ignore = 0 }) {
  const cells = [];
  for (let i = 0; i < boxes; i++) {
    // wound markers every 3 boxes, shifted by High Pain Tolerance's ignored boxes
    const pen = Math.floor(Math.max(0, i + 1 - ignore) / 3);
    cells.push(
      <button key={i} type="button" disabled={!live} class={cx('box', i < damage && 'hit', tone)} aria-label={`${label} box ${i + 1}`}
        onClick={() => onChange(i + 1 === damage ? i : i + 1)}>
        {wounds && i + 1 > ignore && (i + 1 - ignore) % 3 === 0 ? <span class="wm">−{pen}</span> : ''}
      </button>,
    );
  }
  return (
    <div class="monitor">
      <span class="lbl">{label} <small>{damage}/{boxes}</small></span>
      <div class="boxes">{cells}</div>
    </div>
  );
}

const initText = (i) => `${i.base} + ${i.dice}D6`;

/** what worn armor protects against beyond plain Armor (engine/mods.js armorProtection). Elemental armor adds to
 *  Armor for resisting that kind of damage (SR5 core p.170-171), so it shows the matching soak pool too. */
/** bonuses that only apply in a situation (City Slicker "Urban", First Impression "Meeting people the first time") */
function Situational({ d, update }) {
  const list = d.situational || [];
  if (!list.length) return null;
  // a bonus that only applies in a situation can be switched on when you're in it ("in your home sprawl") - then it
  // counts for real (limits, skill pools) until you switch it off
  const toggle = (key) => update((x) => {
    const cur = new Set(x.activeConditions || []);
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    x.activeConditions = [...cur];
  }, { record: false });
  return (
    <div class="protection situational">
      <span class="lbl">Situational</span>
      {list.map((n, i) => {
        const text = <>{n.what}{n.v == null ? '' : ` ${n.v > 0 ? '+' : ''}${n.v}`} <small>{n.condition || 'when it applies'}</small></>;
        return n.canApply ? (
          <button key={i} type="button" class={cx('pip', 'cond-toggle', n.active && 'on')} aria-pressed={n.active}
            title={`From ${n.src}. ${n.active ? 'Applied now - click when it no longer applies' : 'Click to apply it while this is true'}`}
            onClick={() => toggle(n.key)}>
            <span class="cond-box" aria-hidden="true">{n.active ? '✓' : ''}</span>{text}
          </button>
        ) : <span key={i} class="pip" title={`From ${n.src}`}>{text}</span>;
      })}
    </div>
  );
}

function Protection({ d }) {
  const p = d.armor.protection || {};
  const elemental = ['fire', 'cold', 'electricity'].filter((k) => p[k]);
  const resists = ['toxinContact', 'pathogenContact', 'radiation', 'fatigue'].filter((k) => p[k]);
  const drugs = drugResistPips(d);
  if (!elemental.length && !resists.length && !(p.immune || []).length && !drugs.length) return null;
  const tip = (k) => (p.sources[k] || []).join(', ');
  return (
    <div class="protection">
      <span class="lbl">Protection</span>
      {elemental.map((k) => (
        <span key={k} class="pip" title={tip(k)}>{PROTECTION_LABEL[k]} +{p[k]} <small>soak {d.pools.damageResist + p[k]}</small>
          <RollButton pool={d.pools.damageResist + p[k]} label={`Soak vs ${PROTECTION_LABEL[k].toLowerCase()}`} /></span>
      ))}
      {resists.map((k) => <span key={k} class="pip" title={tip(k)}>{PROTECTION_LABEL[k]} {p[k] > 0 ? '+' : ''}{p[k]} dice</span>)}
      {(p.immune || []).length > 0 && <span class="pip on">Immune: {p.immune.join(', ')}</span>}
      {drugs.map(([label, v, vectors]) => <span key={label} class="pip" title={vectors}>{label} {v > 0 ? '+' : ''}{v} dice</span>)}
    </div>
  );
}

/** toxin / pathogen / fatigue resistance from qualities (Resistance to Toxins, Crystal Gut...): one pip per kind and
 *  value, listing the vectors it covers */
function drugResistPips(d) {
  const groups = new Map();
  for (const [k, v] of Object.entries(d.drugResist || {})) {
    if (!v) continue;
    const [kind, vector] = k.split(':');
    const label = kind === 'fatigue' ? 'Fatigue' : kind === 'toxin' ? 'Toxins' : 'Pathogens';
    const key = `${label}|${v}`;
    if (!groups.has(key)) groups.set(key, [label, v, []]);
    if (vector) groups.get(key)[2].push(vector);
  }
  return [...groups.values()].map(([label, v, vec]) => [vec.length && vec.length < 4 ? `${label} (${vec.join(', ')})` : label, v, vec.length ? `vs ${vec.join(', ')}` : '']);
}

/** Street Cred, Notoriety, Public Awareness (SR5 core p.372) - the GM can adjust each in Play */
function Reputation({ ch, d, update, play }) {
  const r = d.reputation;
  if (!r) return null;
  const adj = (k, delta) => update((x) => { x.reputationAdj = { ...(x.reputationAdj || {}), [k]: (Number((x.reputationAdj || {})[k]) || 0) + delta }; });
  const item = (k, label, v, tip) => (
    <span class="pip rep" title={tip}>
      {label} <b>{v}</b>
      {play && <><button type="button" class="ghost sm" aria-label={`${label} -1`} onClick={() => adj(k, -1)}>−</button><button type="button" class="ghost sm" aria-label={`${label} +1`} onClick={() => adj(k, 1)}>+</button></>}
    </span>
  );
  return (
    <div class="protection reputation">
      <span class="lbl">Reputation</span>
      {item('streetCred', 'Street Cred', r.streetCred, `Karma earned ${r.earned} ÷ ${r.divisor}, rounded down (+ GM awards). A positive limit modifier on Social tests where your reputation is known.`)}
      {item('notoriety', 'Notoriety', r.notoriety, 'From qualities (SR5 core p.372) + GM awards')}
      {item('publicAwareness', 'Public Awareness', r.publicAwareness, 'From Fame + GM awards')}
    </div>
  );
}

// ------------------------------------------------------------------ the sheet
export function SheetTab() {
  const { ch, d, update } = useChar();
  const play = useViewMode() === 'play';
  const ps = playState(ch);
  const setPlay = (patch) => update((x) => { x.play = { ...playState(x), ...patch }; }, { record: false });
  const wound = woundModifier(ps, d);
  const m = d.matrix;
  const magic = d.attr.MAG.enabled;
  const sin = play ? activeSin(ch, d.items.gear) : null;

  // skills by category: the ones with ranks, plus (in Play, unless switched off) every other skill the character can
  // still attempt - you need the full list at the table to know what you can default on
  const [showAll, setShowAll] = useState(true);
  const ranked = d.skills.filter((s) => s.rating > 0);
  const listed = play && showAll ? d.skills.filter((s) => s.rating > 0 || (s.canUse && !(/Magical/.test(s.category) && !magic) && !(s.category === 'Resonance Active' && !d.attr.RES.enabled))) : ranked;
  const byCat = new Map();
  for (const s of listed) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category).push(s);
  }
  const cats = [...byCat.keys()].sort((a, b) => SKILL_CATEGORY_ORDER.indexOf(a) - SKILL_CATEGORY_ORDER.indexOf(b));
  // The Matrix AR/Cold-sim/Hot-sim initiative rows used to show for anyone who merely owned a commlink - which is
  // nearly everyone, since it's cheap starting gear, whether or not they ever act in the Matrix. Now only for
  // someone actually built to use it: a technomancer, a cyberdeck/RCC owner, or ranked in a Matrix action skill.
  const matrixActive = !!m.persona && (m.persona.living || m.persona.kind === 'deck' || m.persona.kind === 'rcc'
    || ranked.some((s) => MATRIX_SKILLS.has(s.name)));

  const gearItems = d.items.gear.filter((e) => !isProgramDef(e.def) && !e.it.child);
  const positive = d.qualities.filter((q) => q.def.category === 'Positive');
  const negative = d.qualities.filter((q) => q.def.category === 'Negative');
  const qLink = (q) => (
    <li key={q.uid}>
      <InspectLink kind="qualities" {...(q.auto ? { id: q.id } : { uid: q.uid })}>{q.name}</InspectLink>
      {q.note ? <small> · {q.note}</small> : ''}
    </li>
  );

  return (
    <div class={cx('tab sheet', play && 'live')} id="sheet">
      <div class="sheet-head">
        <div>
          {/* a fake SIN in use covers the real (legal) name - the h2 when there's no street name, else the line under it */}
          <h2>{ch.info.alias ? ch.info.alias : ch.info.name ? <CoverableName name={ch.info.name} sin={sin} /> : 'Unnamed runner'}</h2>
          <p class="dim">
            {ch.info.name && ch.info.alias && <><CoverableName name={ch.info.name} sin={sin} /> · </>}
            {[ch.metatype + (ch.variant ? ` (${ch.variant})` : ''), d.talent.value].filter(Boolean).join(' · ')}
            {sin && !ch.info.name && <> · <SinCard sin={sin} /></>}
          </p>
        </div>
        <div class="sheet-actions no-print">
          {play && <IdentityPicker ch={ch} d={d} update={update} />}
          <span class="pip" title="Karma available">Karma {d.karma.left}</span>
          <span class="pip" title="Nuyen available">{nuyen(d.nuyen.left)}</span>
          <button type="button" onClick={() => window.print()}>Print / save as PDF</button>
        </div>
      </div>

      {/* ---- attribute blocks + initiative ---- */}
      <div class="blocks">
        <Block tone="phys" title="Physical"
          foot={<><Foot label="Physical limit" value={d.limits.physical} /><Foot label="Condition" value={`${d.cm.physical} P`} /></>}>
          {['BOD', 'AGI', 'REA', 'STR'].map((k) => <Tile key={k} k={k} d={d} />)}
        </Block>
        <Block tone="ment" title="Mental"
          foot={<><Foot label="Mental limit" value={d.limits.mental} /><Foot label="Social limit" value={d.limits.social} /></>}>
          {['CHA', 'INT', 'LOG', 'WIL'].map((k) => <Tile key={k} k={k} d={d} />)}
        </Block>
        <Block tone="special" title="Special" foot={<Foot label="Stun condition" value={`${d.cm.stun} S`} />}>
          <Tile k="EDG" d={d} note={d.attr.EDG.burned ? `${d.attr.EDG.burned} burned` : undefined} />
          {d.attr.MAG.enabled && <Tile k="MAG" d={d} note={d.attr.MAG.lost ? `Essence −${d.attr.MAG.lost}` : undefined} />}
          {d.attr.RES.enabled && <Tile k="RES" d={d} note={d.attr.RES.lost ? `Essence −${d.attr.RES.lost}` : undefined} />}
          <div class="tile ESS"><span class="lbl">Essence</span><b>{d.essence.toFixed(2)}</b><small>of {d.essMax}</small></div>
        </Block>
        <section class="block init">
          <h3>Initiative</h3>
          <dl class="inits">
            <div><dt>Physical</dt><dd>{initText(d.init)}</dd></div>
            {magic && <div><dt>Astral</dt><dd>{initText(d.init.astral)}</dd></div>}
            {matrixActive && <div><dt>Matrix AR</dt><dd>{initText({ base: m.init.ar, dice: m.init.arDice })}</dd></div>}
            {matrixActive && <div><dt>Cold-sim VR</dt><dd>{initText(m.init.cold)}</dd></div>}
            {matrixActive && <div><dt>Hot-sim VR</dt><dd>{initText(m.init.hot)}</dd></div>}
          </dl>
          <footer><small>Blitz (Edge): 5D6</small></footer>
        </section>
      </div>

      {/* ---- condition + edge ---- */}
      <div class="cols-2 cond-edge">
        <section class="panel">
          <header>
            <h3>Condition</h3>
            <div class="right">
              <span class={cx('pip', wound > 0 && 'warn')} title="−1 to all tests per 3 boxes of damage">Wound modifier {wound > 0 ? `−${wound}` : '0'}</span>
            </div>
          </header>
          <Monitor label="Physical" boxes={d.cm.physical} damage={ps.phys} tone="phys" live={play} ignore={d.woundIgnore} onChange={(v) => setPlay({ phys: v })} />
          <Monitor label="Stun" boxes={d.cm.stun} damage={ps.stun} tone="stun" live={play} ignore={d.woundIgnore} onChange={(v) => setPlay({ stun: v })} />
          <Monitor label="Overflow" boxes={d.cm.overflow} damage={ps.overflow} tone="over" live={play} onChange={(v) => setPlay({ overflow: v })} />
          {play && (
            <div class="dmg-actions no-print">
              <button type="button" onClick={() => setPlay({ stun: Math.min(d.cm.stun, ps.stun + 1) })}>+1 Stun</button>
              <button type="button" onClick={() => setPlay({ phys: Math.min(d.cm.physical, ps.phys + 1) })}>+1 Physical</button>
              <button type="button" onClick={() => setPlay({ stun: Math.max(0, ps.stun - 1) })}>Heal 1 Stun</button>
              <button type="button" onClick={() => setPlay({ phys: Math.max(0, ps.phys - 1) })}>Heal 1 Physical</button>
              <button type="button" class="ghost" onClick={() => setPlay({ phys: 0, stun: 0, overflow: 0 })}>Clear all</button>
            </div>
          )}
        </section>
        <EdgePanel d={d} ch={ch} update={update} interactive={play} />
      </div>

      {/* ---- pools ---- */}
      <section class="panel">
        <header><h3>Dice pools</h3><div class="right"><span class="pip">Armor {d.armor.total}</span></div></header>
        <div class="pools">
          <div class="pool-tile"><span class="lbl">Defense</span><b>{d.pools.defense}</b><small>REA + INT</small><RollButton pool={d.pools.defense} label="Defense" kind="defense" /></div>
          <div class="pool-tile"><span class="lbl">Full defense</span><b>{d.pools.fullDefense}</b><small>+ WIL</small><RollButton pool={d.pools.fullDefense} label="Full defense" kind="defense" /></div>
          <div class="pool-tile"><span class="lbl">Soak</span><b>{d.pools.damageResist}</b><small>BOD + armor</small><RollButton pool={d.pools.damageResist} label="Soak" /></div>
          <div class="pool-tile"><span class="lbl">Composure</span><b>{d.pools.composure}</b><small>CHA + WIL</small><RollButton pool={d.pools.composure} label="Composure" /></div>
          <div class="pool-tile"><span class="lbl">Judge intentions</span><b>{d.pools.judge}</b><small>CHA + INT</small><RollButton pool={d.pools.judge} label="Judge intentions" /></div>
          <div class="pool-tile"><span class="lbl">Memory</span><b>{d.pools.memory}</b><small>LOG + WIL</small><RollButton pool={d.pools.memory} label="Memory" /></div>
          <div class="pool-tile"><span class="lbl">Lift / carry</span><b>{d.pools.liftCarry}</b><small>{d.carry.lift} / {d.carry.carry} kg</small><RollButton pool={d.pools.liftCarry} label="Lift / carry" /></div>
          <div class="pool-tile"><span class="lbl">Movement</span><b>{d.move.walk}/{d.move.run}</b><small>walk / run (m)</small></div>
        </div>
        <Protection d={d} />
        <Situational d={d} update={update} />
        <Reputation ch={ch} d={d} update={update} play={play} />
      </section>

      <WeaponsPanel />

      {/* ---- skills ---- */}
      <section class="panel">
        <header>
          <h3>Skills</h3>
          <div class="right">
            {play && <label class="no-print"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.currentTarget.checked)} /> Show unranked</label>}
            <small class="dim">rating → dice pool (attribute + rating); specializations add 2</small>
          </div>
        </header>
        {listed.length === 0 ? <p class="empty">No ranked skills.</p> : (
          <div class="sk-list">
            {cats.map((cat) => (
              <div key={cat} class="sk-cat">
                <h4>{cat.replace(' Active', '')}</h4>
                {byCat.get(cat).map((s) => (
                  <div key={s.id} class={cx('sk-row', s.rating === 0 && 'unranked')}>
                    <span class="nm"><InspectLink kind="skills" id={s.id}>{s.name}</InspectLink>{s.spec && <small>{s.spec}</small>}</span>
                    <span class="rt">{s.rating}</span>
                    {s.rating === 0 && !s.defaultable
                      ? <span class="pl" title="No ranks, and this skill can't be defaulted"><small>—</small></span>
                      : <span class="pl" title={s.rating === 0 ? 'Defaulting: attribute − 1' : undefined}>{s.pool}{s.spec && <small>({s.poolSpec})</small>}<RollButton pool={s.spec ? s.poolSpec : s.pool} label={s.name} /></span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <KnowledgePanel />

      {/* ---- matrix ---- */}
      {m.persona && (
        <section class="panel">
          <header><h3>Matrix</h3><div class="right"><span class="pip">{m.persona.label}</span></div></header>
          <div class="pools">
            <div class="pool-tile"><span class="lbl">Attack</span><b>{m.persona.a}</b></div>
            <div class="pool-tile"><span class="lbl">Sleaze</span><b>{m.persona.s}</b></div>
            <div class="pool-tile"><span class="lbl">Data Processing</span><b>{m.persona.dp}</b></div>
            <div class="pool-tile"><span class="lbl">Firewall</span><b>{m.persona.f}</b></div>
            <div class="pool-tile"><span class="lbl">Device rating</span><b>{m.persona.dr}</b></div>
            <div class="pool-tile"><span class="lbl">Matrix condition</span><b>{m.cm}</b></div>
          </div>
          {m.persona.programs.length > 0 && <p class="wrapline"><b>Running:</b> {m.persona.programs.join(', ')}</p>}
          {play && <MatrixActionPools d={d} bare />}
        </section>
      )}

      {/* ---- everything else ---- */}
      <div class="cols-2">
        <section class="panel">
          <header><h3>Qualities</h3></header>
          <div class="qual-cols">
            <div><h4>Positive</h4><ul class="plain">{positive.map(qLink)}{positive.length === 0 && <li class="dim">—</li>}</ul></div>
            <div><h4>Negative</h4><ul class="plain">{negative.map(qLink)}{negative.length === 0 && <li class="dim">—</li>}</ul></div>
          </div>
          {d.critterPowers.length > 0 && (
            <div><h4>Critter powers</h4><ul class="plain cols">
              {d.critterPowers.map(({ it, def }) => (
                <li key={it.uid}><InspectLink kind="critterPowers" {...(it.auto ? { id: def.id } : { uid: it.uid })}>{def.name}</InspectLink>{it.rating ? ` ${it.rating}` : ''}{it.extra ? <small> · {it.extra}</small> : ''}{it.auto ? <small class="dim"> · {it.from}</small> : ''}</li>
              ))}
            </ul></div>
          )}
          {d.mentor.hasQuality && d.mentor.def && (
            <p class="hint">Mentor: <b>{d.mentor.def.name}</b> — {d.mentor.def.advantage}{ch.mentorChoice ? ` (${ch.mentorChoice})` : ''}</p>
          )}
        </section>
        <section class="panel">
          <header><h3>Augmentations</h3><div class="right"><span class="pip">Essence {d.essence.toFixed(2)}</span></div></header>
          <ul class="plain">
            {d.augs.map((a) => (
              <li key={a.it.uid}>
                <InspectLink kind={a.kind} uid={a.it.uid}>{a.def.name}</InspectLink>{a.it.rating ? ` R${a.it.rating}` : ''}
                <small> {a.it.grade && a.it.grade !== 'Standard' ? `${a.it.grade} · ` : ''}{a.ess.toFixed(2)} ess</small>
              </li>
            ))}
            {d.augs.length === 0 && <li class="dim">None</li>}
          </ul>
        </section>
      </div>

      {(ch.spells.length > 0 || ch.powers.length > 0 || ch.complexForms.length > 0) && (
        <section class="panel">
          <header><h3>Magic &amp; Resonance</h3></header>
          <ul class="plain cols">
            {ch.spells.map((s) => { const def = itemDef('spells', s); return def && <li key={s.uid}><InspectLink kind="spells" uid={s.uid}>{def.name}</InspectLink> <small>{def.category} · drain {def.dv}</small></li>; })}
            {ch.powers.map((p) => { const def = itemDef('powers', p); return def && <li key={p.uid}><InspectLink kind="powers" uid={p.uid}>{def.name}</InspectLink>{p.level > 1 ? ` ${p.level}` : ''}</li>; })}
            {ch.complexForms.map((c) => { const def = itemDef('complexForms', c); return def && <li key={c.uid}><InspectLink kind="complexForms" uid={c.uid}>{def.name}</InspectLink> <small>fading {def.fv}</small></li>; })}
          </ul>
        </section>
      )}

      <div class="cols-2">
        <section class="panel">
          <header><h3>Armor &amp; gear</h3></header>
          <ul class="plain">
            {d.items.armor.map(({ it, def }) => (
              <li key={it.uid} class={it.equipped === false ? 'dim' : ''}>
                <InspectLink kind="armor" uid={it.uid}>{def.name}</InspectLink> <small>armor {arr(def.armor).join(' ')}{it.equipped === false ? ' · not worn' : ''}</small>
              </li>
            ))}
            {gearItems.map(({ it, def }) => <li key={it.uid}><InspectLink kind="gear" uid={it.uid}>{def.name}</InspectLink>{it.rating ? ` R${it.rating}` : ''}{(it.qty || 1) > 1 ? ` ×${it.qty}` : ''}</li>)}
            {d.items.vehicles.map(({ it, def }) => <li key={it.uid}><InspectLink kind="vehicles" uid={it.uid}>{def.name}</InspectLink> <small>vehicle</small></li>)}
            {d.items.armor.length + gearItems.length + d.items.vehicles.length === 0 && <li class="dim">Nothing</li>}
          </ul>
        </section>
        <section class="panel">
          <header><h3>Contacts &amp; lifestyle</h3></header>
          <ul class="plain">
            {ch.contacts.map((c) => <li key={c.uid}><b>{c.name || '—'}</b> <small>{c.role} · Conn {c.connection} / Loy {c.loyalty}{c.notes ? ` · ${c.notes}` : ''}</small></li>)}
            {d.items.lifestyles.map(({ it, def }) => <li key={it.uid}><InspectLink kind="lifestyles" uid={it.uid}>{it.label || def.name}</InspectLink> <small>lifestyle</small></li>)}
            {ch.contacts.length + d.items.lifestyles.length === 0 && <li class="dim">None</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
