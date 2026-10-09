import { useMemo, useState } from 'preact/hooks';
import { selectPowerSpec } from '../engine/grantedPowers.js';
import { PowerGrantPicker } from './GrantedPowers.jsx';
import { useChar, enabledBooks } from '../store.js';
import { idx, arr, num, txt, ATTR_KEYS, sourceOk } from '../engine/data.js';
import { uid } from '../engine/character.js';
import { describeEffects, effectsOf, attrSlots } from '../engine/effects.js';
import { reqContext, blockedReason } from '../engine/requirements.js';
import { Panel, Picker, SourceRef, Warn, InspectLink, Empty, Field, bookUrl, cx, ConfirmDialog, Stepper } from './common.jsx';
import { useUnavailable } from './unavailable.js';
import { groupFamilies, familyFor } from '../engine/families.js';
import { styleKarma, MARTIAL_ARTS_PAGE } from '../engine/martialarts.js';
import { CustomQualityForm } from './CustomItem.jsx';
import { SkillChoice } from './common.jsx';
import { CritterPowersPanel } from './ExtraPowers.jsx';
import { madeManContact, qualityMaxLevel } from '../engine/qualityPerks.js';
import { QualityChoices, addQualityItems } from './QualityChoices.jsx';

const MENTOR_PAGE = 320;

// a family ("Allergy", "Free Insect Spirit", ...) shows as one picker row carrying its chosen variant's stats
const familyRow = (fam, variant) => ({ ...variant, name: fam.base, _fam: fam, _variant: variant });
const qualitySearch = (q) => (q._fam ? `${q._fam.base} ${q._fam.variants.map((v) => v.desc).join(' ')}` : q.name);
const variantLabel = (v) => `${v.desc || '(standard)'} · ${Math.abs(num(v.def.karma))} K`;

function QualityList({ ch, d, update, kind }) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(null); // {def, why}: picked past the availability/etc. limit, confirming before it's added
  const unavailable = useUnavailable('qualities');
  const pos = kind === 'Positive';
  const list = d.qualities.filter((q) => (q.def.category === kind));
  const ctx = reqContext(ch, d);
  const books = enabledBooks();
  const grouped = useMemo(() => groupFamilies(idx('qualities', 'qualities').list.filter((q) => q.category === kind && !q.hide && sourceOk(q, books))), [kind, books]);
  // which variant each family row in the picker currently offers (default: the first one this character can take)
  const [picked, setPicked] = useState({});
  const pickerItems = useMemo(() => grouped.rows.map((r) => {
    if (r.def) return r.def;
    const vs = r.family.variants;
    const v = vs.find((x) => x.def.id === picked[r.family.base]) || vs.find((x) => !(unavailable && unavailable(x.def))) || vs[0];
    return familyRow(r.family, v.def);
  }), [grouped, picked, unavailable]);
  const create = ch.mode === 'create';
  const sum = list.filter((q) => !q.auto).reduce((s, q) => s + Math.abs(q.karma), 0);
  // SR5 core p.71: the Positive limit stretches by any Negative Karma taken beyond its own 25-Karma limit.
  const negTotal = d.qualities.filter((q) => !q.auto && q.def.category === 'Negative').reduce((s, q) => s + Math.abs(q.karma), 0);
  const limit = pos ? d.R.qualityKarmaLimit + Math.max(0, negTotal - d.R.qualityKarmaLimit) : d.R.qualityKarmaLimit;

  const add = (def) => update((x) => {
    x.qualities.push({ uid: uid(), id: def.id, name: def.name, a: x.mode === 'career', choice: {}, note: '' });
    // Made Man (Run Faster p.148): comes with a free syndicate group contact at Loyalty 3
    if (def.bonus && def.bonus.mademan !== undefined && !x.contacts.some((c) => c.mademan)) x.contacts.push(madeManContact(uid()));
    // Dead SIN / Busted Cyberware come with an item (free)
    addQualityItems(x, def, def.name);
  });
  const remove = (q) => update((x) => { x.qualities = x.qualities.filter((z) => z.uid !== q.uid); });

  return (
    <Panel
      title={pos ? 'Positive qualities' : 'Negative qualities'}
      right={
        <>
          {create && <span class={cx('pip', sum > limit && 'bad')}>{sum}/{limit} Karma</span>}
          <button type="button" onClick={() => setCustom(true)} title="A quality that isn't in the books: a GM's blessing, a curse, a house rule">Custom…</button>
          <button type="button" class="primary" onClick={() => setAdding(true)}>+ Add</button>
        </>
      }
    >
      {custom && <CustomQualityForm category={kind} onClose={() => setCustom(false)} />}
      {list.length === 0 && <p class="empty">None yet.</p>}
      <ul class="rows">
        {list.map((q) => {
          const fx = describeEffects(effectsOf(q.def.bonus, {}, q.choice));
          const slots = attrSlots(q.def.bonus);
          const isAttrChoice = q.def.bonus && q.def.bonus.selectattributes && !slots.length;
          const fam = !q.auto && familyFor(q.def.name, grouped.families);
          return (
            <li key={q.uid} class={cx('row-item', q.auto && 'auto')}>
              <div class="main">
                <span class="name"><InspectLink kind="qualities" {...(q.auto ? { id: q.id } : { uid: q.uid })}>{fam ? fam.base : q.name}</InspectLink></span>
                {fam && (
                  <select class="variant" value={q.def.id} aria-label={`${fam.base}: which one`}
                    onChange={(e) => {
                      const v = fam.variants.find((x) => x.def.id === e.currentTarget.value);
                      if (v) update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); t.id = v.def.id; t.name = v.def.name; t.choice = {}; });
                    }}>
                    {fam.variants.map((v) => <option key={v.def.id} value={v.def.id}>{variantLabel(v)}</option>)}
                  </select>
                )}
                {q.auto && <span class="tag" title={q.grantedBy ? `comes with ${q.grantedBy}` : undefined}>{q.grantedBy ? `from ${q.grantedBy}` : 'granted'}</span>}
                {fx && <span class="fx">{fx}</span>}
              </div>
              {q.def.bonus && q.def.bonus.selectskill && !q.auto && (
                <SkillChoice d={d} spec={q.def.bonus.selectskill} value={(q.choice || {}).skill}
                  onChange={(v) => update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); t.choice = { ...t.choice, skill: v }; })} />
              )}
              <QualityChoices q={q} ch={ch} d={d} update={update} />
              {!q.auto && slots.map((sl, i) => (
                <select key={`slot${i}`} class="choicesel" value={((q.choice || {}).attrs || [])[i] || ''} aria-label={`${q.name}: attribute pick ${i + 1}`}
                  title={`+${txt(sl.val)} to one of ${sl.attrs.join(', ')}`}
                  onChange={(e) => { const v = e.currentTarget.value; update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); const attrs = [...((t.choice || {}).attrs || [])]; attrs[i] = v; t.choice = { ...t.choice, attrs }; }); }}>
                  <option value="">— +{txt(sl.val)} {sl.attrs.join('/')} —</option>
                  {sl.attrs.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              ))}
              {isAttrChoice && !q.auto && (
                <select value={q.choice.attr || ''} onChange={(e) => update((x) => { const t = x.qualities.find((z) => z.uid === q.uid); t.choice = { ...t.choice, attr: e.currentTarget.value }; })}>
                  <option value="">— attribute —</option>
                  {ATTR_KEYS.map((a) => <option key={a}>{a}</option>)}
                </select>
              )}
              {!q.auto && (
                <input class="note" placeholder={fam ? 'your label, e.g. what it is' : 'note / choice'} value={q.note || ''}
                  onChange={(e) => update((x) => { x.qualities.find((z) => z.uid === q.uid).note = e.currentTarget.value; }, { record: false })} />
              )}
              {!q.auto && qualityMaxLevel(q.def) > 1 && (
                <span class="qlevel" title={`This quality can be taken up to ${qualityMaxLevel(q.def)} times / levels`}>
                  <span class="dim small">level</span>
                  <Stepper value={q.level || 1} min={1} max={qualityMaxLevel(q.def)} onChange={(v) => update((x) => { x.qualities.find((z) => z.uid === q.uid).level = v; })} />
                </span>
              )}
              <span class="num cost" title={q.freeBy ? `free with ${q.freeBy}` : undefined}>{q.freeBy ? 'free' : q.auto ? 'free' : q.def.bonus && q.def.bonus.nuyenamt !== undefined ? `${(num(txt(q.def.bonus.nuyenamt)) * (q.level || 1)).toLocaleString('en-US')}¥` : q.karma === 0 ? '0 K' : `${q.karma > 0 ? '' : '+'}${Math.abs(q.karma)} K`}</span>
              <SourceRef source={q.def.source} page={q.def.page} />
              {!q.auto && <button type="button" class="ghost sm" onClick={() => remove(q)} aria-label={`Remove ${q.name}`}>✕</button>}
            </li>
          );
        })}
      </ul>
      {adding && (
        <Picker
          title={`Add ${kind.toLowerCase()} quality`}
          items={pickerItems}
          searchText={qualitySearch}
          multi
          inspectKind="qualities"
          unavailable={unavailable}
          onClose={() => setAdding(false)}
          onPick={(row) => {
            const def = row._variant || row;
            const why = blockedReason(def, ctx);
            if (why) { setPendingBlocked({ def, why }); return; }
            add(def);
          }}
          columns={[
            { key: 'name', label: 'Quality', get: (q) => (q._fam ? (
              <span class="famname">
                {q._fam.base}
                <select class="variant" value={q.id} aria-label={`${q._fam.base}: which one`}
                  onChange={(e) => { const id = e.currentTarget.value; setPicked((p) => ({ ...p, [q._fam.base]: id })); }}>
                  {q._fam.variants.map((v) => <option key={v.def.id} value={v.def.id}>{variantLabel(v)}</option>)}
                </select>
              </span>
            ) : q.name) },
            { key: 'karma', label: 'Karma', cls: 'num', get: (q) => Math.abs(num(q.karma)) },
            { key: 'source', label: 'Book', get: (q) => <SourceRef source={q.source} page={q.page} /> },
          ]}
        />
      )}
      {pendingBlocked && (
        <ConfirmDialog title="Add quality" confirmLabel="Add anyway"
          message={`${pendingBlocked.def.name}: ${pendingBlocked.why}. Add anyway?`}
          onConfirm={() => add(pendingBlocked.def)} onClose={() => setPendingBlocked(null)} />
      )}
    </Panel>
  );
}

function StyleRow({ st, R, update }) {
  const [adding, setAdding] = useState(false);
  const def = idx('martialarts', 'martialarts').byName.get(String(st.name).toLowerCase());
  const validNames = new Set(arr(def && def.techniques).map((t) => t.name));
  const techCatalog = idx('martialarts', 'techniques').list.filter((t) => validNames.has(t.name));
  const cost = styleKarma(R, (st.techniques || []).length);
  return (
    <li class="row-item martial-style">
      <div class="main">
        <span class="name">{st.name}</span>
        {def && <SourceRef source={def.source} page={def.page} />}
        <span class="num cost">{cost} K</span>
        <button type="button" class="ghost sm" aria-label={`Remove ${st.name}`} onClick={() => update((x) => { x.martialArts = x.martialArts.filter((z) => z.uid !== st.uid); })}>✕</button>
      </div>
      <div class="mods">
        {(st.techniques || []).map((t, i) => (
          <span key={t.uid} class="chip on removable">
            {t.name}
            <button type="button" aria-label={`Remove ${t.name}`} onClick={() => update((x) => { const s = x.martialArts.find((z) => z.uid === st.uid); s.techniques.splice(i, 1); })}>✕</button>
          </span>
        ))}
        <button type="button" class="chip ghost" onClick={() => setAdding(true)}>+ technique</button>
      </div>
      {adding && (
        <Picker title={`Techniques for ${st.name}`} items={techCatalog} multi onClose={() => setAdding(false)}
          onPick={(t) => update((x) => { const s = x.martialArts.find((z) => z.uid === st.uid); (s.techniques ||= []).push({ uid: uid(), name: t.name }); })}
          columns={[{ key: 'name', label: 'Technique' }, { key: 'source', label: 'Book', get: (t) => <SourceRef source={t.source} page={t.page} /> }]} />
      )}
    </li>
  );
}

function MartialArtsPanel({ ch, d, update }) {
  const [adding, setAdding] = useState(false);
  const list = ch.martialArts || [];
  const all = idx('martialarts', 'martialarts').list;
  const total = list.reduce((s, st) => s + styleKarma(d.R, (st.techniques || []).length), 0);
  return (
    <Panel
      title="Martial arts"
      sub={`p.${MARTIAL_ARTS_PAGE} - a style costs ${d.R.martialArtKarma} Karma with ${d.R.freeTechniques} free techniques, ${d.R.techniqueKarma} Karma each after that`}
      right={<><span class="pip">{total} Karma</span><button type="button" class="primary" onClick={() => setAdding(true)}>+ Add</button></>}
    >
      {list.length === 0 ? <Empty>No martial art styles yet.</Empty> : (
        <ul class="rows">{list.map((st) => <StyleRow key={st.uid} st={st} R={d.R} update={update} />)}</ul>
      )}
      {adding && (
        <Picker title="Add a martial art style" items={all} onClose={() => setAdding(false)}
          onPick={(def) => update((x) => { x.martialArts = [...(x.martialArts || []), { uid: uid(), name: def.name, techniques: [] }]; })}
          columns={[{ key: 'name', label: 'Style' }, { key: 'source', label: 'Book', get: (m) => <SourceRef source={m.source} page={m.page} /> }]} />
      )}
    </Panel>
  );
}

function MentorSpiritPanel({ ch, d, update }) {
  if (!d.mentor.hasQuality) return null;
  const all = idx('mentors', 'mentors').list;
  const def = d.mentor.def;
  const url = bookUrl('SR5', MENTOR_PAGE);
  const advFx = def && describeEffects(effectsOf(def.bonus, {}));
  const pickFx = (choice) => choice && describeEffects(effectsOf(choice.bonus, {}));
  return (
    <Panel title="Mentor spirit" sub={`p.${MENTOR_PAGE} - from the Mentor Spirit quality`}>
      <Field label="Mentor">
        <select value={ch.mentor || ''} onChange={(e) => update((x) => { x.mentor = e.currentTarget.value; x.mentorChoice = ''; x.mentorPower = ''; })}>
          <option value="">— pick a mentor —</option>
          {all.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
      </Field>
      {def && (
        <>
          <p class="hint"><b>Advantage:</b> {def.advantage}{advFx && ` (${advFx})`}</p>
          <p class="hint"><b>Disadvantage:</b> {def.disadvantage}</p>
          {arr(def.choices).length > 0 && (
            <Field label="Choose one" hint="the specific option this mentor's advantage grants you">
              <select value={ch.mentorChoice || ''} onChange={(e) => update((x) => { x.mentorChoice = e.currentTarget.value; x.mentorPower = ''; })}>
                <option value="">— choose —</option>
                {arr(def.choices).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {ch.mentorChoice && (() => { const c = arr(def.choices).find((x) => x.name === ch.mentorChoice); const fx = pickFx(c); return fx ? <p class="hint">{fx}</p> : null; })()}
          {(() => {
            // an adept option that grants a free power (Chaos, Artist, Holy Text...): pick which one
            const spec = selectPowerSpec(d.mentor.pick && d.mentor.pick.bonus);
            return spec && (
              <div class="mods">
                <PowerGrantPicker spec={spec} d={d} label="Free power" value={ch.mentorPower} choice={ch.mentorPowerChoice || {}}
                  onChange={(v) => update((x) => { x.mentorPower = v; x.mentorPowerChoice = {}; })}
                  onChoice={(patch) => update((x) => { x.mentorPowerChoice = { ...(x.mentorPowerChoice || {}), ...patch }; })} />
              </div>
            );
          })()}
          <SourceRef source={def.source} page={def.page} />
        </>
      )}
      {url && <p class="hint"><a href={url} target="_blank" rel="noopener">SR5 core p.{MENTOR_PAGE} ↗</a></p>}
    </Panel>
  );
}

export function QualitiesTab() {
  const { ch, d, update } = useChar();
  return (
    <div class="tab cols-2">
      <QualityList ch={ch} d={d} update={update} kind="Positive" />
      <QualityList ch={ch} d={d} update={update} kind="Negative" />
      <MartialArtsPanel ch={ch} d={d} update={update} />
      <MentorSpiritPanel ch={ch} d={d} update={update} />
      <CritterPowersPanel ch={ch} d={d} update={update} />
      <Warn list={d.warnings.filter((w) => /qualit/i.test(w.msg))} />
    </div>
  );
}
