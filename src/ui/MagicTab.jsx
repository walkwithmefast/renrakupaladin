import { useState } from 'preact/hooks';
import { GrantedPowersList } from './GrantedPowers.jsx';
import { wayDiscount, wayEligible } from '../engine/qualityRules.js';
import { useChar } from '../store.js';
import { D, idx, arr, num, txt, bool } from '../engine/data.js';
import { uid, itemDef } from '../engine/character.js';
import { evalExpr } from '../engine/expr.js';
import { effectsOf, describeEffects } from '../engine/effects.js';
import { Panel, Picker, SourceRef, Stepper, Field, Empty, InspectLink, bookUrl, cx, SkillChoice } from './common.jsx';
import { RollButton } from './Roller.jsx';
import { useUnavailable } from './unavailable.js';
import { spiritOptions, spiritDef, spiritStats, SPIRITS_PAGE, SPRITES_PAGE } from '../engine/spirits.js';
import { INITIATION_PAGE, SUBMERSION_PAGE } from '../engine/metamagic.js';

const SPELL_COLS = (extra = []) => [
  { key: 'name', label: 'Spell' },
  { key: 'category', label: 'Category' },
  { key: 'type', label: 'T', get: (s) => s.type },
  { key: 'range', label: 'Range' },
  { key: 'duration', label: 'Dur.' },
  { key: 'dv', label: 'Drain', get: (s) => s.dv },
  { key: 'source', label: 'Book', get: (s) => <SourceRef source={s.source} page={s.page} /> },
  ...extra,
];

function drainPool(tradition, d) {
  const t = idx('traditions', 'traditions').byName.get(String(tradition || '').toLowerCase());
  if (!t) return null;
  const vars = {};
  for (const [k, a] of Object.entries(d.attr)) vars[k] = a.total;
  const v = evalExpr(txt(t.drain), vars);
  return { name: t.name, expr: txt(t.drain).replace(/[{}]/g, ''), value: Number.isNaN(v) ? null : v };
}

function Spells({ ch, d, update }) {
  const unavailable = useUnavailable('spells');
  const [adding, setAdding] = useState(false);
  const free = d.magic.spellFree;
  const create = ch.mode === 'create';
  return (
    <Panel
      title="Spells & rituals"
      right={
        <>
          {create && <span class="pip">{ch.spells.length} known · {free} free</span>}
          <button type="button" class="primary" onClick={() => setAdding(true)}>+ Add spell</button>
        </>
      }
    >
      {ch.spells.length === 0 ? <Empty>No spells learned.</Empty> : (
        <table class="tbl">
          <thead><tr><th>Spell</th><th>Category</th><th>T</th><th>Range</th><th>Dur.</th><th>Drain</th><th /><th /><th /></tr></thead>
          <tbody>
            {d.spells.map(({ it, paid }) => {
              const def = itemDef('spells', it);
              if (!def) return null;
              return (
                <tr key={it.uid}>
                  <td class="name"><InspectLink kind="spells" uid={it.uid}>{def.name}</InspectLink></td><td>{def.category}</td><td>{def.type}</td><td>{def.range}</td><td>{def.duration}</td><td>{def.dv}</td>
                  <td class="num cost">{paid ? `${d.magic.spellCost} K` : 'free'}</td>
                  <td><SourceRef source={def.source} page={def.page} /></td>
                  <td class="act"><button type="button" class="ghost sm" onClick={() => update((x) => { x.spells = x.spells.filter((z) => z.uid !== it.uid); })} aria-label={`Remove ${def.name}`}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {d.freeSpellNotes.length > 0 && <p class="hint">{d.freeSpellNotes.join('; ')}.</p>}
      {d.magicLimits.filter((l) => l.spellCats).map((l) => <p key={l.label} class="hint">{l.label}: only {l.spellCats.join(' / ')} spells (Forbidden Arcana p.43-47).</p>)}
      {adding && (
        <Picker title="Learn spells" unavailable={unavailable} inspectKind="spells" items={idx('spells', 'spells').list} multi category={(s) => s.category} onClose={() => setAdding(false)}
          searchText={(s) => `${s.name} ${s.category} ${s.descriptor}`}
          onPick={(s) => update((x) => { x.spells.push({ uid: uid(), id: s.id, name: s.name, a: x.mode === 'career' }); })}
          columns={SPELL_COLS()} />
      )}
    </Panel>
  );
}

function Powers({ ch, d, update }) {
  const unavailable = useUnavailable('powers');
  const [adding, setAdding] = useState(false);
  const m = d.magic;
  return (
    <Panel
      title="Adept powers"
      right={
        <>
          <span class={cx('pip', m.ppUsed > m.ppTotal + 1e-9 && 'bad')}>Power points {m.ppUsed.toFixed(2).replace(/\.?0+$/, '')}/{m.ppTotal}</span>
          {d.way && <span class={cx('pip', d.way.used > d.way.slots && 'bad')} title={`${d.way.name}: one power level at half cost per 2 points of Magic (Street Grimoire p.176)`}>Way discounts {d.way.used}/{d.way.slots}</span>}
          <button type="button" class="primary" onClick={() => setAdding(true)}>+ Add power</button>
        </>
      }
    >
      {m.isMystic && (
        <Field label={`Power points bought with karma (${d.R.mysAdeptPPKarma} K each)`}>
          <Stepper value={ch.mysPP || 0} min={0} max={Math.max(0, d.attr.MAG.total)} onChange={(v) => update((x) => { x.mysPP = v; })} />
        </Field>
      )}
      {ch.powers.length === 0 ? <Empty>No adept powers.</Empty> : (
        <table class="tbl">
          <tbody>
            {ch.powers.map((p) => {
              const def = itemDef('powers', p);
              if (!def) return null;
              const leveled = bool(def.levels);
              const per = num(def.points);
              const fx = describeEffects(effectsOf(def.bonus, { Rating: p.level || 1 }, p.choice || {}));
              return (
                <tr key={p.uid}>
                  <td class="name"><InspectLink kind="powers" uid={p.uid}>{def.name}</InspectLink>{def.action && <small>{def.action}</small>}
                    {fx && <span class="fx">{fx}</span>}
                    {def.bonus && def.bonus.selectskill && (
                      <SkillChoice d={d} spec={def.bonus.selectskill} value={(p.choice || {}).skill}
                        onChange={(v) => update((x) => { const t = x.powers.find((z) => z.uid === p.uid); t.choice = { ...(t.choice || {}), skill: v }; })} />
                    )}
                    {def.bonus && def.bonus.selectattribute && (
                      <select class="choicesel" value={(p.choice || {}).attr || ''} aria-label={`${def.name}: which attribute`}
                        onChange={(e) => { const v = e.currentTarget.value; update((x) => { const t = x.powers.find((z) => z.uid === p.uid); t.choice = { ...(t.choice || {}), attr: v }; }); }}>
                        <option value="">— attribute —</option>
                        {arr(def.bonus.selectattribute.attribute).map((a) => <option key={a}>{a}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{leveled ? <Stepper value={p.level || 1} min={1} max={num(def.maxlevels, 6) || 6} onChange={(v) => update((x) => { x.powers.find((z) => z.uid === p.uid).level = v; })} /> : ''}</td>
                  <td class="num cost">
                    {(per * (leveled ? p.level || 1 : 1) - (p.wayDiscount && d.way ? wayDiscount(def) : 0)).toFixed(2).replace(/\.?0+$/, '')} PP
                    {d.way && (wayEligible(def, d.way.name) || wayEligible(def, d.way.name, { extra: true })) && wayDiscount(def) > 0 && (
                      <label class="check small way-check" title={`${d.way.name}: halve one level of this power (Street Grimoire p.176)${wayEligible(def, d.way.name) ? '' : ' - not on your Way\'s list: the Beast\'s / Spiritual Way may pick one such power'}`}>
                        <input type="checkbox" checked={!!p.wayDiscount} onChange={(e) => { const on = e.currentTarget.checked; update((x) => { x.powers.find((z) => z.uid === p.uid).wayDiscount = on; }); }} /> Way −{wayDiscount(def)}
                      </label>
                    )}
                  </td>
                  <td><SourceRef source={def.source} page={def.page} /></td>
                  <td class="act"><button type="button" class="ghost sm" onClick={() => update((x) => { x.powers = x.powers.filter((z) => z.uid !== p.uid); })} aria-label={`Remove ${def.name}`}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <GrantedPowersList d={d} />
      {adding && (
        <Picker title="Adept powers" unavailable={unavailable} inspectKind="powers" items={idx('powers', 'powers').list} multi onClose={() => setAdding(false)}
          onPick={(p) => update((x) => { x.powers.push({ uid: uid(), id: p.id, name: p.name, level: 1 }); })}
          columns={[
            { key: 'name', label: 'Power' },
            { key: 'points', label: 'PP', cls: 'num' },
            { key: 'levels', label: 'Lvl', get: (p) => (bool(p.levels) ? '✓' : '') },
            { key: 'action', label: 'Action' },
            { key: 'source', label: 'Book', get: (p) => <SourceRef source={p.source} page={p.page} /> },
          ]} />
      )}
    </Panel>
  );
}

function ComplexForms({ ch, d, update }) {
  const unavailable = useUnavailable('complexForms');
  const [adding, setAdding] = useState(false);
  const create = ch.mode === 'create';
  return (
    <Panel
      title="Complex forms"
      right={
        <>
          {create && <span class="pip">{ch.complexForms.length} known · {d.magic.cfFree} free</span>}
          <button type="button" class="primary" onClick={() => setAdding(true)}>+ Add form</button>
        </>
      }
    >
      {ch.complexForms.length === 0 ? <Empty>No complex forms.</Empty> : (
        <table class="tbl">
          <thead><tr><th>Form</th><th>Target</th><th>Duration</th><th>Fading</th><th /><th /><th /></tr></thead>
          <tbody>
            {d.cforms.map(({ it, paid }) => {
              const def = itemDef('complexForms', it);
              if (!def) return null;
              return (
                <tr key={it.uid}>
                  <td class="name"><InspectLink kind="complexForms" uid={it.uid}>{def.name}</InspectLink></td><td>{def.target}</td><td>{def.duration}</td><td>{def.fv}</td>
                  <td class="num cost">{paid ? `${d.R.complexFormKarma} K` : 'free'}</td>
                  <td><SourceRef source={def.source} page={def.page} /></td>
                  <td class="act"><button type="button" class="ghost sm" onClick={() => update((x) => { x.complexForms = x.complexForms.filter((z) => z.uid !== it.uid); })} aria-label={`Remove ${def.name}`}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {adding && (
        <Picker title="Complex forms" unavailable={unavailable} inspectKind="complexForms" items={idx('complexforms', 'complexforms').list} multi onClose={() => setAdding(false)}
          onPick={(f) => update((x) => { x.complexForms.push({ uid: uid(), id: f.id, name: f.name, a: x.mode === 'career' }); })}
          columns={[
            { key: 'name', label: 'Form' }, { key: 'target', label: 'Target' }, { key: 'duration', label: 'Duration' }, { key: 'fv', label: 'Fading' },
            { key: 'source', label: 'Book', get: (f) => <SourceRef source={f.source} page={f.page} /> },
          ]} />
      )}
    </Panel>
  );
}

function Tradition({ ch, d, update }) {
  const list = idx('traditions', 'traditions').list;
  const dp = drainPool(ch.tradition, d);
  return (
    <Panel title="Tradition & drain">
      <div class="row gap">
        <Field label="Tradition">
          <select value={ch.tradition} onChange={(e) => update((x) => { x.tradition = e.currentTarget.value; })}>
            <option value="">— none —</option>
            {list.filter((t) => !t.hide).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
        {dp && dp.value != null && <div class="stat"><span class="lbl">Drain resist pool</span><b>{dp.value}</b><small>{dp.expr}</small><RollButton pool={dp.value} label="Drain resistance" /></div>}
        {d.attr.RES.enabled && <div class="stat"><span class="lbl">Fading resist pool</span><b>{d.attr.RES.total + d.attr.WIL.total}</b><small>RES + WIL</small><RollButton pool={d.attr.RES.total + d.attr.WIL.total} label="Fading resistance" /></div>}
        {d.attr.MAG.enabled && (
          <div class={cx('stat', d.magic.fociForce > d.attr.MAG.total && 'bad')}>
            <span class="lbl">Bonded focus Force</span><b>{d.magic.fociForce} / {d.attr.MAG.total}</b><small>{d.magic.fociKarma} Karma spent bonding</small>
          </div>
        )}
      </div>
    </Panel>
  );
}

const STAT_LABELS = [['bod', 'BOD'], ['agi', 'AGI'], ['rea', 'REA'], ['str', 'STR'], ['cha', 'CHA'], ['int', 'INT'], ['log', 'LOG'], ['wil', 'WIL']];

function SpiritRow({ e, def, cap, tech, update }) {
  const stats = spiritStats(def, e.force);
  const over = e.force > cap;
  const patch = (fn) => update((x) => { const t = x.spirits.find((z) => z.uid === e.uid); if (t) fn(t); });
  return (
    <div class="spirit-row">
      <div class="row gap between">
        <div class="row gap">
          <b>{e.name}</b>
          {def && <SourceRef source={def.source} page={def.page} />}
        </div>
        <button type="button" class="ghost sm" aria-label={`Remove ${e.name}`} onClick={() => update((x) => { x.spirits = x.spirits.filter((z) => z.uid !== e.uid); })}>✕</button>
      </div>
      <div class="row gap wrap">
        <Field label={tech ? 'Level' : 'Force'}><Stepper value={e.force} min={1} max={20} onChange={(v) => patch((t) => { t.force = v; })} /></Field>
        <Field label="Services owed"><Stepper value={e.services || 0} min={0} max={20} onChange={(v) => patch((t) => { t.services = v; })} /></Field>
        <label class="check"><input type="checkbox" checked={!!e.bound} onChange={(ev) => patch((t) => { t.bound = ev.currentTarget.checked; })} />{tech ? 'Registered' : 'Bound'}</label>
      </div>
      {over && <p class="hint bad">{tech ? 'Level' : 'Force'} above your {tech ? 'Resonance' : 'Magic'} ({cap}).</p>}
      {stats && (
        <div class="stat-grid mini">
          {STAT_LABELS.map(([k, label]) => <div class="stat" key={k}><span class="lbl">{label}</span><b>{stats.attrs[k]}</b></div>)}
          {stats.ini != null && <div class="stat"><span class="lbl">Init</span><b>{stats.ini}</b></div>}
        </div>
      )}
      {def && arr(def.powers).length > 0 && <p class="hint">Powers: {arr(def.powers).join(', ')}</p>}
    </div>
  );
}

export function SpiritsPanel({ ch, d, update }) {
  const [picking, setPicking] = useState(false);
  const tech = d.attr.RES.enabled;
  const cap = tech ? d.attr.RES.total : d.attr.MAG.total;
  // Apprentice / Elementalist summon only their spirit type (Forbidden Arcana p.43-47); Chain Breaker adds two types
  const allowed = tech ? null : d.magicLimits.filter((l) => l.spirits).flatMap((l) => l.spirits);
  const extra = tech ? [] : d.extraSpirits.filter(Boolean).map((n) => ({ category: 'Chain Breaker', name: n }));
  const options = [...spiritOptions(tech ? '' : ch.tradition, tech), ...extra]
    .filter((o, i, a) => a.findIndex((z) => z.name === o.name) === i)
    .filter((o) => !allowed || !allowed.length || allowed.includes(o.name) || o.category === 'Chain Breaker');
  const url = bookUrl('SR5', tech ? SPRITES_PAGE : SPIRITS_PAGE);
  const list = ch.spirits || [];
  return (
    <Panel
      title={tech ? 'Sprites' : 'Spirits'}
      sub={`${tech ? 'compiled, not summoned - p.256' : 'summoned via your tradition - p.300'} · binding/registering costs Force × ${d.R.boundSpiritKarma} Karma`}
      right={<button type="button" class="primary" onClick={() => setPicking(true)}>+ Add</button>}
    >
      {list.length === 0 ? <Empty>{tech ? 'No sprites compiled yet.' : 'No spirits summoned yet.'}</Empty> : (
        <div class="spirit-list">
          {list.map((e) => <SpiritRow key={e.uid} e={e} def={spiritDef(e.name, tech)} cap={cap} tech={tech} update={update} />)}
        </div>
      )}
      {d.karma.spent.spirits > 0 && <p class="hint">{d.karma.spent.spirits} Karma spent {tech ? 'registering' : 'binding'} the ones marked {tech ? 'Registered' : 'Bound'}.</p>}
      <p class="hint">
        The summoning or compiling test itself is rolled at the table
        {' '}{url ? <a href={url} target="_blank" rel="noopener">(SR5 core, read the rules ↗)</a> : '(see SR5 core)'}.
      </p>
      {picking && (
        <Picker title={`Add a ${tech ? 'sprite' : 'spirit'}`} items={options} category={(o) => o.category}
          columns={[{ key: 'name', label: 'Type' }]} onClose={() => setPicking(false)}
          onPick={(o) => update((x) => { x.spirits = [...(x.spirits || []), { uid: uid(), name: o.name, force: 1, services: 0, bound: false }]; })} />
      )}
    </Panel>
  );
}

export function InitiationPanel({ ch, d, update }) {
  const unavailable = useUnavailable('metamagic');
  const [picking, setPicking] = useState(false);
  const tech = d.attr.RES.enabled;
  const magicUser = d.attr.MAG.enabled;
  if (!tech && !magicUser) return null;
  const grade = num(ch.initGrade);
  const list = ch.metamagics || [];
  // Street Grimoire: an Art or a power enhancement (adepts) is learned at initiation in place of a metamagic
  const tag = (list, kind, category) => list.filter((m) => !m.hide).map((m) => ({ ...m, _kind: kind, category }));
  const adeptish = d.magic.isAdept || d.magic.isMystic;
  const catalog = tech
    ? tag(idx('echoes', 'echoes').list, 'echo', 'Echo')
    : [
      ...tag(idx('metamagic', 'metamagics').list.filter((m) => d.magic.isMystic || (d.magic.isAdept ? m.adept === 'True' : m.magician === 'True')), 'metamagic', 'Metamagic'),
      ...tag(idx('metamagic', 'arts').list, 'art', 'Art'),
      ...(adeptish ? tag(idx('powers', 'enhancements').list, 'enhancement', 'Power enhancement') : []),
    ];
  const KIND_TAG = { art: 'Art', enhancement: 'power enhancement' };
  const page = tech ? SUBMERSION_PAGE : INITIATION_PAGE;
  const url = bookUrl('SR5', page);
  return (
    <Panel
      title={tech ? 'Submersion & Echoes' : 'Initiation & Metamagics'}
      sub={`each grade costs (grade × ${d.R.initiationKarma}) + ${d.R.initiationFlat} Karma and includes one technique (SR5 p.325); extras ${d.R.metamagicKarma} each`}
      right={<Field label={tech ? 'Submersion grade' : 'Initiation grade'}><Stepper value={grade} min={0} max={20} onChange={(v) => update((x) => { x.initGrade = v; })} /></Field>}
    >
      <div class="stat-grid tight">
        <div class="stat"><span class="lbl">Karma spent</span><b>{d.magic.initiationKarma}</b></div>
        <div class="stat"><span class="lbl">{tech ? 'Echoes' : 'Techniques'} known</span><b>{list.length} / {grade}</b></div>
      </div>
      {d.fx.some((e) => e.t === 'addmetamagic') && (
        <p class="hint">Free from qualities: {d.fx.filter((e) => e.t === 'addmetamagic').map((e) => `${e.name} (${e.src})`).join(', ')}</p>
      )}
      {list.length === 0 ? <Empty>No {tech ? 'echoes' : 'metamagics'} learned yet.</Empty> : (
        <ul class="plain">
          {list.map((e) => (
            <li key={e.uid} class="row between">
              <span><InspectLink kind="metamagics" uid={e.uid}>{e.name}</InspectLink>{KIND_TAG[e.kind] && <small class="dim"> · {KIND_TAG[e.kind]}</small>}</span>
              <button type="button" class="ghost sm" aria-label={`Remove ${e.name}`} onClick={() => update((x) => { x.metamagics = x.metamagics.filter((z) => z.uid !== e.uid); })}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" class="primary sm" onClick={() => setPicking(true)}>+ {tech ? 'Echo' : 'Metamagic / Art'}</button>
      {list.length > grade && <p class="hint bad">{list.length} known, above your {tech ? 'Submersion' : 'Initiation'} grade ({grade}).</p>}
      <p class="hint">{tech ? '' : 'Arts and adept power enhancements (Street Grimoire) take a technique slot too; metamagics that need an Art show why in the picker. '}
        {url && <a href={url} target="_blank" rel="noopener">SR5 core p.{page} ↗</a>}
      </p>
      {picking && (
        <Picker title={`Add ${tech ? 'an echo' : 'a metamagic, Art or enhancement'}`} unavailable={unavailable} items={catalog} onClose={() => setPicking(false)}
          inspectKind="metamagics" category={tech ? undefined : (m) => m.category}
          onPick={(m) => update((x) => { x.metamagics = [...(x.metamagics || []), { uid: uid(), name: m.name, kind: m._kind }]; })}
          columns={[
            { key: 'name', label: 'Name' },
            ...(tech ? [] : [{ key: 'category', label: 'Kind' }, { key: 'power', label: 'Enhances', get: (m) => (m.power ? [].concat(m.power).join(', ') : '') }]),
            { key: 'source', label: 'Book', get: (m) => <SourceRef source={m.source} page={m.page} /> },
          ]} />
      )}
    </Panel>
  );
}

export function MagicTab() {
  const { ch, d, update } = useChar();
  const m = d.magic;
  if (!m.enabled) {
    return (
      <div class="tab">
        <Panel title="Magic & Resonance">
          <Empty>This character is Mundane. Pick a Magic or Resonance option under <b>Build → Metatype & talent</b> (it depends on the priority you give that column).</Empty>
        </Panel>
      </div>
    );
  }
  const magician = d.attr.MAG.enabled && !m.isAdept;
  return (
    <div class="tab">
      {d.attr.MAG.enabled && <Tradition ch={ch} d={d} update={update} />}
      {magician && <Spells ch={ch} d={d} update={update} />}
      {(m.isAdept || m.isMystic) && <Powers ch={ch} d={d} update={update} />}
      {d.attr.RES.enabled && <ComplexForms ch={ch} d={d} update={update} />}
      {(magician || m.isMystic || d.attr.RES.enabled) && <SpiritsPanel ch={ch} d={d} update={update} />}
      <InitiationPanel ch={ch} d={d} update={update} />
    </div>
  );
}
