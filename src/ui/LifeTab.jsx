import { useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { D, idx, arr, num, txt } from '../engine/data.js';
import { uid } from '../engine/character.js';
import { Panel, Picker, Stepper, Field, Empty, SourceRef, InspectLink, nuyen, cx, Warn, bookUrl } from './common.jsx';
import { madeManContact, TRUST_FUND_PAGE, MADE_MAN_PAGE, trustFundIncomeText } from '../engine/qualityPerks.js';

function Lifestyles({ ch, d, update }) {
  const [adding, setAdding] = useState(false);
  const defs = idx('lifestyles', 'lifestyles').list.filter((l) => !l.hide);
  const total = d.items.lifestyles.reduce((s, e) => s + e.cost, 0);
  const tf = d.trustFund; // Trust Fund quality (Run Faster p.151)
  const tierName = tf && (tf.lifestyle === 'Medium' ? 'Middle (Medium)' : tf.lifestyle);
  const addTrustLife = () => {
    const def = idx('lifestyles', 'lifestyles').byName.get(tf.lifestyle.toLowerCase());
    if (def) update((x) => { for (const z of x.lifestyles) delete z.trustFund; x.lifestyles.push({ uid: uid(), id: def.id, name: def.name, months: 1, trustFund: true }); });
  };
  const tfUrl = bookUrl('RF', TRUST_FUND_PAGE);
  return (
    <Panel title="Lifestyle" right={<><span class="pip">{nuyen(total)}</span><button type="button" class="primary" onClick={() => setAdding(true)}>+ Add</button></>}>
      {d.items.lifestyles.length === 0 ? <Empty>No lifestyle. Street lifestyle costs nothing.</Empty> : (
        <table class="tbl">
          <thead><tr><th>Lifestyle</th><th>Months</th><th class="num">Per month</th><th class="num">Total</th>{tf && <th>Trust fund</th>}<th /><th /></tr></thead>
          <tbody>
            {d.items.lifestyles.map(({ it, def, cost, trust }) => (
              <tr key={it.uid}>
                <td class="name"><InspectLink kind="lifestyles" uid={it.uid}>{it.label || def.name}</InspectLink><small>{it.label && it.label !== def.name ? `${def.name} · ` : ''}{def.dice ? `${def.dice} dice for lifestyle tests` : ''}{trust ? ' · paid by your trust fund' : ''}</small></td>
                <td><Stepper value={it.months || 1} min={1} max={120} onChange={(v) => update((x) => { x.lifestyles.find((z) => z.uid === it.uid).months = v; })} /></td>
                <td class="num">{nuyen(cost / (it.months || 1))}</td>
                <td class="num strong">{nuyen(cost)}</td>
                {tf && (
                  <td><label class="check"><input type="checkbox" checked={!!it.trustFund} aria-label={`${def.name} is paid by the trust fund`}
                    onChange={(e) => { const on = e.currentTarget.checked; update((x) => { for (const z of x.lifestyles) { if (z.uid === it.uid) z.trustFund = on; else if (on) delete z.trustFund; } }); }} /> pays it</label></td>
                )}
                <td><SourceRef source={def.source} page={def.page} /></td>
                <td class="act"><button type="button" class="ghost sm" onClick={() => update((x) => { x.lifestyles = x.lifestyles.filter((z) => z.uid !== it.uid); })} aria-label="Remove lifestyle">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tf && (
        <p class="hint">
          <b>Trust Fund {['', 'I', 'II', 'III', 'IV'][tf.level]}</b> pays a {tierName} lifestyle and {trustFundIncomeText(tf.level)}¥ a month (collect it from the Wallet in Play).
          {!tf.paid && <> Tick <b>pays it</b> on that lifestyle, or <button type="button" class="link" onClick={addTrustLife}>add a {tierName} lifestyle paid by the fund</button>.</>}
          {' '}{tfUrl && <a class="src" href={tfUrl} target="_blank" rel="noopener">Run Faster p.{TRUST_FUND_PAGE} ↗</a>}
        </p>
      )}
      {d.mt && d.fx.some((e) => e.t === 'lifestyle') && <p class="hint">Your metatype adds {d.fx.filter((e) => e.t === 'lifestyle').reduce((s, e) => s + e.v, 0)}% to lifestyle costs.</p>}
      {adding && (
        <Picker title="Choose a lifestyle" inspectKind="lifestyles" items={defs} onClose={() => setAdding(false)}
          onPick={(l) => update((x) => { x.lifestyles.push({ uid: uid(), id: l.id, name: l.name, months: 1 }); })}
          columns={[{ key: 'name', label: 'Lifestyle' }, { key: 'cost', label: 'Monthly', cls: 'num', get: (l) => nuyen(num(l.cost)) }, { key: 'dice', label: 'Dice' }, { key: 'source', label: 'Book', get: (l) => <SourceRef source={l.source} page={l.page} /> }]} />
      )}
    </Panel>
  );
}

function Contacts({ ch, d, update }) {
  const create = ch.mode === 'create';
  const types = arr(D.contacts && D.contacts.contacts).map((c) => txt(c.name || c));
  const patch = (u, f) => update((x) => { f(x.contacts.find((z) => z.uid === u)); });
  return (
    <Panel
      title="Contacts"
      right={
        <>
          <span class={cx('pip', create && d.contacts.paid > 0 && 'warn')} title="Connection + Loyalty in Karma. Free Karma = Charisma × 3.">
            {d.contacts.spent} Karma · {d.contacts.free} free
          </span>
          <button type="button" class="primary" onClick={() => update((x) => { x.contacts.push({ uid: uid(), name: '', role: '', connection: 1, loyalty: 1, notes: '', a: x.mode === 'career' }); })}>+ Add</button>
        </>
      }
    >
      {ch.contacts.length === 0 ? <Empty>No contacts yet. Every runner starts with Charisma × 3 free Karma to spend on them.</Empty> : (
        <table class="tbl contacts">
          <thead><tr><th>Name</th><th>Role</th><th>Connection</th><th>Loyalty</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {ch.contacts.map((c) => (
              <tr key={c.uid}>
                <td>
                  <input value={c.name} placeholder={c.mademan ? 'Syndicate name' : 'Name'} onChange={(e) => patch(c.uid, (t) => { t.name = e.currentTarget.value; })} />
                  {(c.free || c.group) && <small class="dim contact-tag">{[c.group && 'group', c.free && (c.mademan ? 'free · Made Man' : 'free')].filter(Boolean).join(' · ')}</small>}
                </td>
                <td>
                  <input list="contact-types" value={c.role} placeholder="Fixer, street doc…" onChange={(e) => patch(c.uid, (t) => { t.role = e.currentTarget.value; })} />
                </td>
                <td><Stepper value={num(c.connection, 1)} min={1} max={12} onChange={(v) => patch(c.uid, (t) => { t.connection = v; })} /></td>
                <td><Stepper value={num(c.loyalty, 1)} min={1} max={6} onChange={(v) => patch(c.uid, (t) => { t.loyalty = v; })} /></td>
                <td><input value={c.notes} placeholder="notes" onChange={(e) => patch(c.uid, (t) => { t.notes = e.currentTarget.value; })} /></td>
                <td class="act"><button type="button" class="ghost sm" onClick={() => update((x) => { x.contacts = x.contacts.filter((z) => z.uid !== c.uid); })} aria-label="Remove contact">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.madeMan && !d.madeMan.has && (
        <p class="hint">
          <b>Made Man</b> comes with your crime syndicate as a free group contact at Loyalty {d.madeMan.loyalty}.{' '}
          <button type="button" class="link" onClick={() => update((x) => { x.contacts.push(madeManContact(uid())); })}>Add the syndicate contact</button>
          {' '}{bookUrl('RF', MADE_MAN_PAGE) && <a class="src" href={bookUrl('RF', MADE_MAN_PAGE)} target="_blank" rel="noopener">Run Faster p.{MADE_MAN_PAGE} ↗</a>}
        </p>
      )}
      <datalist id="contact-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
    </Panel>
  );
}

function Bio({ ch, update }) {
  const f = (key, label, wide) => (
    <Field label={label} wide={wide}>
      <input value={ch.info[key] || ''} onChange={(e) => update((x) => { x.info[key] = e.currentTarget.value; }, { record: false })} />
    </Field>
  );
  const area = (key, label) => (
    <Field label={label} wide>
      <textarea rows="5" value={ch.info[key] || ''} onChange={(e) => update((x) => { x.info[key] = e.currentTarget.value; }, { record: false })} />
    </Field>
  );
  return (
    <Panel title="Biography">
      <div class="fields">
        {f('name', 'Name')}{f('alias', 'Street name / alias')}{f('player', 'Player')}
        {f('gender', 'Gender')}{f('age', 'Age')}{f('height', 'Height')}{f('weight', 'Weight')}
        {f('skin', 'Skin')}{f('hair', 'Hair')}{f('eyes', 'Eyes')}
      </div>
      {area('description', 'Description')}
      {area('background', 'Background')}
      {area('notes', 'Notes')}
    </Panel>
  );
}

export function LifeTab() {
  const { ch, d, update } = useChar();
  return (
    <div class="tab">
      <Lifestyles ch={ch} d={d} update={update} />
      <Contacts ch={ch} d={d} update={update} />
      <Bio ch={ch} update={update} />
      <Warn list={d.warnings.filter((w) => /[Cc]ontact/.test(w.msg))} />
    </div>
  );
}
