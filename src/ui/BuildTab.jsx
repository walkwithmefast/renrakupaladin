import { useChar } from '../store.js';
import { D, arr, num, txt, ATTR_KEYS, SPECIAL_KEYS, ATTR_NAME, idx } from '../engine/data.js';
import { heritageOptions, talentOptions, priorityRow } from '../engine/character.js';
import { LETTERS, PRIORITY_KEYS, PRIORITY_LABEL } from '../engine/rules.js';
import { setPriority, setPriorityTable, setPriorityLine, setAttrRating } from '../engine/actions.js';
import { priorityLines, hasLineChoice, priorityLineOf, letterAllowed, priorityTables, tableSource } from '../engine/priorities.js';
import { restoreBurnedEdge } from '../engine/edge.js';
import { Dots, Panel, Field, nuyen, cx, Warn, SourceRef } from './common.jsx';

const CAT = { heritage: 'Heritage', talent: 'Talent', attributes: 'Attributes', skills: 'Skills', resources: 'Resources' };

function cellText(col, letter, table) {
  const row = priorityRow(CAT[col], letter, table);
  if (!row) return '—';
  switch (col) {
    case 'heritage': {
      const core = ['Human', 'Elf', 'Dwarf', 'Ork', 'Troll'];
      const all = arr(row.metatypes).filter((m) => m.name !== 'A.I.');
      const shown = all.filter((m) => core.includes(m.name));
      const more = all.length - shown.length;
      return shown.map((m) => `${m.name} ${m.value}`).join(' · ') + (more > 0 ? ` · +${more} more` : '');
    }
    case 'talent': {
      const names = [...new Set(arr(row.talents).filter((t) => t.value !== 'A.I.').map((t) => t.value))];
      const first = arr(row.talents).find((t) => t.magic || t.resonance);
      const top = first ? `${first.magic ? 'Magic' : 'Resonance'} ${first.magic || first.resonance}` : '';
      return names.join(', ') + (top ? ` (up to ${top})` : '');
    }
    case 'attributes': return `${row.attributes} points`;
    case 'skills': return `${row.skills} skills / ${row.skillgroups} groups`;
    case 'resources': return nuyen(num(row.resources));
    default: return '';
  }
}

function PriorityGrid({ ch, update }) {
  const lines = priorityLines(ch.priTable);
  const line = priorityLineOf(ch.pri);
  const choice = hasLineChoice(ch.priTable);
  return (
    <Panel title="Priorities" sub={choice
      ? `${ch.priTable}: pick a stat line, then place its letters — choosing a letter another column holds swaps them.`
      : 'Pick one letter per column — choosing a letter another column holds swaps them.'}>
      <div class="prio-wrap">
        <table class="prio">
          <thead>
            <tr><th />{PRIORITY_KEYS.map((c) => <th key={c}>{PRIORITY_LABEL[c]}</th>)}</tr>
          </thead>
          <tbody>
            {LETTERS.map((L) => (
              <tr key={L}>
                <th class="letter">{L}</th>
                {PRIORITY_KEYS.map((c) => (
                  <td key={c}>
                    <button
                      type="button"
                      class={cx('cell', ch.pri[c] === L && 'sel')}
                      onClick={() => update((x) => setPriority(x, c, L))}
                      aria-pressed={ch.pri[c] === L}
                      disabled={!letterAllowed(ch.pri, ch.priTable, c, L)}
                      title={letterAllowed(ch.pri, ch.priTable, c, L) ? undefined : `Not in the ${line.split('').join(' ')} stat line`}
                    >
                      {cellText(c, L, ch.priTable)}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="row gap">
        <Field label="Resources table">
          <select value={ch.priTable} onChange={(e) => { const t = e.currentTarget.value; update((x) => setPriorityTable(x, t)); }}>
            {priorityTables().map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {choice && (
          <Field label="Stat line">
            <div class="chips" role="radiogroup" aria-label="Stat line">
              {lines.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={line === l} class={cx('chip', line === l && 'on')}
                  onClick={() => update((x) => setPriorityLine(x, l))}>{l.split('').join(' ')}</button>
              ))}
              {tableSource(ch.priTable) && <SourceRef {...tableSource(ch.priTable)} />}
            </div>
          </Field>
        )}
      </div>
    </Panel>
  );
}

// skills a talent may pick from, per Chummer's `skilltype`
function talentSkillPool(talent) {
  const all = idx('skills', 'skills').list;
  const t = talent.skilltype;
  const isX = t && typeof t === 'object';
  if (t === 'magic') return all.filter((s) => s.attribute === 'MAG' && s.category === 'Magical Active');
  if (t === 'resonance') return all.filter((s) => s.attribute === 'RES');
  if (isX) return all.filter((s) => s.attribute !== 'RES' && s.attribute !== 'DEP' && (s.category !== 'Magical Active' || !txt(s.skillgroup)));
  if (t === 'specific') return arr(talent.skillchoices && talent.skillchoices.skill).map((n) => all.find((s) => s.name === n)).filter(Boolean);
  return [];
}

function HeritagePanel({ ch, d, update }) {
  const opts = heritageOptions(ch.pri.heritage);
  const cur = opts.find((o) => o.name === ch.metatype);
  const variants = arr(cur && cur.metavariants);
  const mt = d.mt;
  const talents = talentOptions(ch.pri.talent);
  const tal = d.talent;
  const pool = talentSkillPool(tal);
  const qty = num(tal.skillqty);
  const picked = ch.talentPicks.skills || [];
  const togglePick = (name) => update((x) => {
    const s = x.talentPicks.skills || (x.talentPicks.skills = []);
    const i = s.indexOf(name);
    if (i >= 0) s.splice(i, 1);
    else if (s.length < qty) s.push(name);
  });
  return (
    <Panel title="Metatype & talent" class="two-col">
      <div class="col">
        <Field label={`Metatype (priority ${ch.pri.heritage})`}>
          <select value={ch.metatype} onChange={(e) => update((x) => { x.metatype = e.currentTarget.value; x.variant = ''; })}>
            {opts.map((o) => <option key={o.name} value={o.name}>{o.name} — {o.value} special pts</option>)}
          </select>
        </Field>
        {variants.length > 0 && (
          <Field label="Variant">
            <select value={ch.variant} onChange={(e) => update((x) => { x.variant = e.currentTarget.value; })}>
              <option value="">— none —</option>
              {variants.map((v) => <option key={v.name} value={v.name}>{v.name}{num(v.karma) ? ` (+${v.karma} karma)` : ''} — {v.value} special pts</option>)}
            </select>
          </Field>
        )}
        <p class="hint">
          Special attribute points: <b>{d.used.specialPts}</b> / {d.pri.specialPtsTotal} (Edge, Magic, Resonance only).
          {mt && mt.walk && ` Movement ${mt.walk.split('/')[0]}×AGI walk, ${String(mt.run).split('/')[0]}×AGI run.`}
        </p>
      </div>
      <div class="col">
        <Field label={`Magic / Resonance (priority ${ch.pri.talent})`}>
          <select value={ch.talent} onChange={(e) => update((x) => { x.talent = e.currentTarget.value; x.talentPicks = { skills: [], group: '' }; })}>
            {talents.map((t) => <option key={t.value} value={t.value}>{t.name}</option>)}
          </select>
        </Field>
        {num(tal.skillgroupqty) > 0 && (
          <Field label={`Free skill group (rating ${tal.skillgroupval})`}>
            <select value={ch.talentPicks.group || ''} onChange={(e) => update((x) => { x.talentPicks.group = e.currentTarget.value; })}>
              <option value="">— choose —</option>
              {arr(tal.skillgroupchoices).map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
        )}
        {qty > 0 && pool.length > 0 && (
          <div class="chips-box">
            <span class="lbl">Free skills at rating {tal.skillval} — pick {qty} ({picked.length}/{qty})</span>
            <div class="chips">
              {pool.map((s) => (
                <button type="button" key={s.id} class={cx('chip', picked.includes(s.name) && 'on')} onClick={() => togglePick(s.name)}>{s.name}</button>
              ))}
            </div>
          </div>
        )}
        {(num(tal.spells) > 0 || num(tal.cfp) > 0) && (
          <p class="hint">{num(tal.spells) > 0 && <>Free spells: <b>{tal.spells}</b>. </>}{num(tal.cfp) > 0 && <>Free complex forms: <b>{tal.cfp}</b>.</>}</p>
        )}
      </div>
    </Panel>
  );
}

function AttributesPanel({ ch, d, update }) {
  const create = ch.mode === 'create';
  const row = (k) => {
    const a = d.attr[k];
    if (!a.enabled) return null;
    const special = SPECIAL_KEYS.includes(k);
    const karmaLevels = a.k + a.a;
    return (
      <tr key={k} class={cx(a.natural >= a.max && !special && 'atmax')}>
        <th>{ATTR_NAME[k]}<small>{k}</small></th>
        <td class="num dim">{a.min}</td>
        <td class="dotscell">
          <Dots value={a.natural} max={a.max} bonus={a.total > a.natural ? a.total - a.natural : 0}
            min={a.base}
            onChange={(v) => update((x) => setAttrRating(x, d, k, v))} />
        </td>
        <td class="num strong">{a.total}{a.lost > 0 && <span class="neg" title="Essence loss"> −{a.lost}</span>}{a.burned > 0 && <span class="neg" title="Burned in play"> −{a.burned} burned</span>}{a.bonus !== 0 && <span class="aug" title="Augmentation / effects"> ({a.bonus > 0 ? '+' : ''}{a.bonus})</span>}</td>
        <td class="num dim">{a.max}</td>
        <td class="num cost">{a.burned > 0 ? <button type="button" class="ghost sm" title="Bring a burned point back (GM ruling, or after re-buying it with Karma)" onClick={() => update((x) => restoreBurnedEdge(x))}>restore</button> : karmaLevels > 0 ? `${a.kCost + a.aCost} K` : a.p > 0 ? `${a.p} pt` : ''}</td>
      </tr>
    );
  };
  return (
    <Panel
      title="Attributes"
      right={create && (
        <span class="pips">
          <span class={cx('pip', d.used.attrPts > d.pri.attrPtsTotal && 'bad')}>Attribute pts {d.used.attrPts}/{d.pri.attrPtsTotal}</span>
          <span class={cx('pip', d.used.specialPts > d.pri.specialPtsTotal && 'bad')}>Special {d.used.specialPts}/{d.pri.specialPtsTotal}</span>
        </span>
      )}
    >
      <table class="tbl attrs">
        <thead><tr><th>Attribute</th><th class="num">Min</th><th>Rating</th><th class="num">Total</th><th class="num">Max</th><th class="num">Spent</th></tr></thead>
        <tbody>
          {ATTR_KEYS.map(row)}
          <tr class="sep"><td colSpan="6" /></tr>
          {SPECIAL_KEYS.map(row)}
          <tr>
            <th>Essence<small>ESS</small></th>
            <td class="num dim">0</td>
            <td class="dotscell"><Dots value={Math.floor(d.essence)} max={Math.floor(d.essMax)} onChange={() => {}} disabled /></td>
            <td class="num strong">{d.essence.toFixed(2)}</td>
            <td class="num dim">{d.essMax}</td>
            <td class="num" />
          </tr>
        </tbody>
      </table>
      <p class="hint">Rating dots buy with priority points first, then Karma. Blue dots come from augmentations and qualities.</p>
    </Panel>
  );
}

export function BuildTab() {
  const { ch, d, update } = useChar();
  return (
    <div class="tab">
      {ch.mode === 'create' && <PriorityGrid ch={ch} update={update} />}
      <HeritagePanel ch={ch} d={d} update={update} />
      <AttributesPanel ch={ch} d={d} update={update} />
      <Warn list={d.warnings} />
    </div>
  );
}
