import { useEffect, useRef, useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { D, arr, txt, ATTR_NAME } from '../engine/data.js';
import { uid } from '../engine/character.js';
import { SKILL_CATEGORY_ORDER } from '../engine/rules.js';
import { setSkillRating, setGroupRating, setKnowRating } from '../engine/actions.js';
import { Dots, Panel, cx, Warn, InspectLink } from './common.jsx';
import { groupFamilies, splitName, joinName } from '../engine/families.js';

const KNOW_CATS = ['Street', 'Academic', 'Professional', 'Interest', 'Language'];

// ---- remembered UI state (which categories are collapsed) -------------------------
const LS_KEY = 'crm.skillcollapsed';
const loadCollapsed = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { return new Set(); } };
const saveCollapsed = (set) => { try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch { /* ignore */ } };

/** click "+ spec" to type a specialization; shows as text once set */
function SpecEditor({ skill, list, onCommit }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const lid = 'spec-' + skill.id;
  if (editing) {
    return (
      <>
        <input ref={ref} class="spec" list={lid} defaultValue={skill.spec} placeholder="specialization"
          onBlur={(e) => { onCommit(e.currentTarget.value.trim()); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = skill.spec; e.currentTarget.blur(); } }} />
        <datalist id={lid}>{list.map((s) => <option key={s} value={s} />)}</datalist>
      </>
    );
  }
  return skill.spec ? (
    <button type="button" class="specbtn has" title="Edit specialization (+2 dice)" onClick={() => setEditing(true)}>
      {skill.spec} <b>{skill.poolSpec}</b>
    </button>
  ) : (
    <button type="button" class="specbtn" title="Add a specialization (+2 dice)" onClick={() => setEditing(true)}>+ spec</button>
  );
}

function costLabel(s) {
  const k = s.kCost + s.aCost + s.specCost;
  const bits = [];
  if (s.p > 0) bits.push(`${s.p}pt`);
  if (k > 0) bits.push(`${k}K`);
  return bits.join(' + ');
}

function GroupsPanel({ ch, d, update }) {
  const create = ch.mode === 'create';
  const cap = create ? d.R.maxSkillCreate : d.R.maxSkill;
  const groups = d.groups.filter((g) => d.skills.some((s) => s.group === g.name && s.canUse));
  return (
    <Panel
      title="Skill groups"
      sub="one purchase covers every skill in the group"
      right={create && <span class={cx('pip', d.used.groupPts > d.pri.groupPtsTotal && 'bad')}>Group pts {d.used.groupPts}/{d.pri.groupPtsTotal}</span>}
    >
      <div class="grpgrid">
        {groups.map((g) => {
          const members = d.skills.filter((s) => s.group === g.name);
          const broken = g.broken;
          const cost = g.kCost + g.aCost;
          return (
            <div key={g.name} class={cx('grp', g.rating > 0 && 'ranked', broken && 'broken')} title={`${g.name}: ${members.map((s) => s.name).join(', ')}${broken ? `\n\nBroken: ${g.brokenWhy}` : ''}`}>
              <span class="gname">{g.name}{broken && <i title={g.brokenWhy}>⚠</i>}</span>
              <Dots value={g.rating} max={cap} min={g.f} disabled={broken} onChange={(v) => update((x) => setGroupRating(x, d, g, v))} />
              {(g.p > 0 || cost > 0) && <span class="gcost">{g.p > 0 ? `${g.p}pt` : ''}{g.p > 0 && cost > 0 ? ' + ' : ''}{cost > 0 ? `${cost}K` : ''}</span>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SkillRow({ s, d, ch, update, cap, ptsLeft }) {
  const ranked = s.rating > 0;
  return (
    <div class={cx('skrow', ranked && 'ranked', s.f > 0 && 'free')}>
      <div class="skname" title={s.exotic ? 'Exotic skill: type the weapon as its specialization' : `${ATTR_NAME[s.attr]} ${d.attr[s.attr].total}`}>
        <InspectLink kind="skills" id={s.id}>{s.name}</InspectLink>
        <small>{s.attr}{s.group ? ` · ${s.group}` : ''}</small>
      </div>
      <Dots value={s.rating} max={cap} bonus={0} min={s.gRating + s.f} onChange={(v) => update((x) => setSkillRating(x, d, s, v))} />
      <span class="pool" title={`${ATTR_NAME[s.attr]} ${d.attr[s.attr].total} + ${s.rating}${s.pool > 0 && s.rating === 0 ? ' (defaulting −1)' : ''}${s.focusBonus ? ` + ${s.focusBonus} (${s.focusSrc})` : ''}`}>
        {ranked || s.defaultable ? s.pool : '—'}
      </span>
      {ranked && (
        <div class="skextra">
          <SpecEditor skill={s} list={arr(s.def.specs).map(txt)}
            onCommit={(v) => update((x) => {
              const t = (x.skills[s.id] ||= { p: 0, k: 0, a: 0, spec: '' });
              t.spec = v;
              t.specSrc = x.mode === 'career' ? 'a' : s.gRating > 0 ? 'k' : (ptsLeft > 0 || (t.specSrc === 'p' && s.spec)) ? 'p' : 'k';
            })} />
          <span class="cost">{costLabel(s)}</span>
        </div>
      )}
    </div>
  );
}

function ActiveSkills({ ch, d, update }) {
  const [q, setQ] = useState('');
  const [onlyRanked, setOnlyRanked] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const create = ch.mode === 'create';
  const cap = create ? d.R.maxSkillCreate : d.R.maxSkill;
  const term = q.trim().toLowerCase();
  const byCat = new Map();
  for (const s of d.skills) {
    if (!s.canUse) continue;
    if (term && !s.name.toLowerCase().includes(term)) continue;
    if (onlyRanked && s.rating === 0) continue;
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category).push(s);
  }
  const cats = [...byCat.keys()].sort((a, b) => SKILL_CATEGORY_ORDER.indexOf(a) - SKILL_CATEGORY_ORDER.indexOf(b));
  const ptsLeft = d.pri.skillPtsTotal - d.used.skillPts;
  const toggle = (cat) => {
    const next = new Set(collapsed);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setCollapsed(next);
    saveCollapsed(next);
  };
  const allCats = [...new Set(d.skills.filter((s) => s.canUse).map((s) => s.category))];
  const anyOpen = allCats.some((c) => !collapsed.has(c));
  const setAll = (collapse) => { const next = new Set(collapse ? allCats : []); setCollapsed(next); saveCollapsed(next); };
  const searching = term.length > 0;

  return (
    <Panel
      title="Active skills"
      right={
        <>
          <input class="search sm" placeholder="Find a skill…" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Find a skill" />
          <label class="check"><input type="checkbox" checked={onlyRanked} onChange={(e) => setOnlyRanked(e.currentTarget.checked)} /> ranked only</label>
          <button type="button" class="ghost sm" onClick={() => setAll(anyOpen)}>{anyOpen ? 'Collapse all' : 'Expand all'}</button>
          {create && <span class={cx('pip', ptsLeft < 0 && 'bad')}>Skill pts {d.used.skillPts}/{d.pri.skillPtsTotal}</span>}
        </>
      }
    >
      <div class="skillgrid">
        {cats.map((cat) => {
          const list = byCat.get(cat);
          const open = searching || !collapsed.has(cat);
          const rankedN = list.filter((s) => s.rating > 0).length;
          return (
            <section key={cat} class={cx('skcard', !open && 'closed')}>
              <button type="button" class="skhead" aria-expanded={open} onClick={() => toggle(cat)}>
                <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
                <span class="ttl">{cat.replace(' Active', '')}</span>
                <span class="cnt">{rankedN > 0 ? `${rankedN} ranked · ` : ''}{list.length}</span>
              </button>
              {open && list.map((s) => <SkillRow key={s.id} s={s} d={d} ch={ch} update={update} cap={cap} ptsLeft={ptsLeft} />)}
            </section>
          );
        })}
      </div>
      {cats.length === 0 && <p class="empty">No skills match.</p>}
    </Panel>
  );
}

// "Area Knowledge: Seattle", "Corporation: Ares Macrotechnology", ...: one suggestion per family, then pick or type
// which one (knowledge skills are free text, so any descriptor works - "Area Knowledge: Boston")
const KNOW_FAMILIES = groupFamilies(arr(D.skills.knowledgeskills)).families;
const knowFamily = (name) => KNOW_FAMILIES.get(String(name || '').trim()) || null;
const famListId = (fam) => `know-fam-${fam.base.replace(/\W+/g, '-')}`;

function Knowledge({ ch, d, update }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Street');
  const create = ch.mode === 'create';
  const cap = create ? d.R.maxSkillCreate : d.R.maxSkill;
  const suggestions = groupFamilies(arr(D.skills.knowledgeskills).filter((k) => k.category === cat)).rows
    .map((r) => (r.family ? { id: r.family.base, name: r.family.base } : r.def));
  const fam = knowFamily(name);
  const add = () => {
    const n = fam ? joinName(fam.base, desc, fam.sep) : name.trim();
    if (!n) return;
    update((x) => {
      const hasNative = x.know.some((k) => k.native);
      x.know.push({ uid: uid(), name: n, cat, native: cat === 'Language' && !hasNative && x.know.filter((k) => k.cat === 'Language').length === 0, p: 0, k: 0, a: 0, f: 0, spec: '' });
    });
    setName('');
    setDesc('');
  };
  return (
    <Panel
      title="Knowledge & languages"
      right={create && (
        <span class={cx('pip', d.used.knowOverflow > 0 && 'warn')} title="Free knowledge points = (Intuition + Logic) × 2. Overflow uses skill points.">
          Free pts {Math.min(d.used.knowUsed, d.used.knowPool)}/{d.used.knowPool}{d.used.knowOverflow > 0 && ` (+${d.used.knowOverflow} from skill pts)`}
        </span>
      )}
    >
      <div class="row gap addrow">
        <select value={cat} onChange={(e) => setCat(e.currentTarget.value)}>{KNOW_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <input class="grow" list="know-suggest" placeholder={cat === 'Language' ? 'Language (the first one added is your native tongue)' : 'Add a knowledge skill…'} value={name}
          onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <datalist id="know-suggest">{suggestions.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        {fam && (
          <input class="grow" list={famListId(fam)} placeholder={`Which ${fam.base.toLowerCase()}? Pick one or type your own`} value={desc} aria-label={`${fam.base}: which one`}
            onInput={(e) => setDesc(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        )}
        <button type="button" class="primary" onClick={add}>Add</button>
      </div>
      {[...KNOW_FAMILIES.values()].map((f) => (
        <datalist key={f.base} id={famListId(f)}>{f.variants.filter((v) => v.desc).map((v) => <option key={v.def.id} value={v.desc} />)}</datalist>
      ))}
      {d.know.length === 0 ? <p class="empty">No knowledge or language skills yet.</p> : (
        <div class="knowgrid">
          {d.know.map((k) => (
            <div key={k.uid} class={cx('skrow', 'know', k.rating !== 0 && 'ranked')}>
              <div class="skname">
                {(() => {
                  const p = splitName(k.name);
                  const f = p && knowFamily(p.base);
                  if (!f) return <span class="nm">{k.name}</span>;
                  // a family skill: its descriptor stays editable - pick another or type your own
                  return (
                    <span class="nm famname">
                      {f.base}:
                      <input class="variant" list={famListId(f)} defaultValue={p.desc} key={k.name} aria-label={`${f.base}: which one`}
                        onChange={(e) => { const v = e.currentTarget.value.trim(); update((x) => { x.know.find((z) => z.uid === k.uid).name = joinName(f.base, v, f.sep); }); }} />
                    </span>
                  );
                })()}
                <small>{k.cat}</small>
              </div>
              {k.native ? <span class="native">Native</span> : (
                <Dots value={k.rating} max={cap} onChange={(v) => update((x) => setKnowRating(x, d, k.uid, v))} />
              )}
              <span class="pool">{k.native ? '' : k.pool}</span>
              <div class="skextra">
                {k.cat === 'Language' && (
                  <label class="check" title="Native language (free)">
                    <input type="checkbox" checked={k.native} onChange={(e) => update((x) => { x.know.find((z) => z.uid === k.uid).native = e.currentTarget.checked; })} /> native
                  </label>
                )}
                <span class="cost">{k.p > 0 ? `${k.p}pt ` : ''}{k.kCost + k.aCost > 0 ? `${k.kCost + k.aCost}K` : ''}</span>
                <button type="button" class="ghost sm rm" onClick={() => update((x) => { x.know = x.know.filter((z) => z.uid !== k.uid); })} aria-label={`Remove ${k.name}`}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function SkillsTab() {
  const { ch, d, update } = useChar();
  return (
    <div class="tab">
      <GroupsPanel ch={ch} d={d} update={update} />
      <ActiveSkills ch={ch} d={d} update={update} />
      <Knowledge ch={ch} d={d} update={update} />
      <Warn list={d.warnings.filter((w) => /skill|Skill/.test(w.msg))} />
    </div>
  );
}
