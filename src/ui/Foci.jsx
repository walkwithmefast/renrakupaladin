// Focus bonding: the interactive "Bonded" toggle + Karma cost shown under an owned focus's row (Gear tab)
// and in its Inspector drawer section. SR5 core p.313-315: a focus must be bonded (Karma = Force x a
// per-type multiplier) before its bonus applies, and the combined Force of every bonded focus can't exceed
// your Magic attribute - character.js already turns that into a warning; this just shows/edits the state.
import { isFocus, bondMultiplier, bondKarma, FOCUS_TABLE_PAGE } from '../engine/foci.js';
import { num, idx } from '../engine/data.js';
import { selectPowerSpec } from '../engine/grantedPowers.js';
import { bookUrl, cx } from './common.jsx';
import { PowerGrantPicker } from './GrantedPowers.jsx';
import { describeEffects, effectsOf } from '../engine/effects.js';

export function FocusBonding({ it, def, d, update, readOnly, heading }) {
  if (!isFocus(def)) return null;
  const force = Math.max(0, num(it.rating, 0));
  const mult = bondMultiplier(def);
  const karma = bondKarma(def, force);
  const url = bookUrl('SR5', FOCUS_TABLE_PAGE);
  const spec = selectPowerSpec(def.bonus);
  const choice = it.choice || {};
  const setChoice = (patch) => update((x) => { const g = x.gear.find((z) => z.uid === it.uid); if (g) g.choice = { ...(g.choice || {}), ...patch }; });
  // SR5 core p.318: no more bonded foci than Magic, total Force at most Magic x 5; above Magic is only an addiction risk
  const lim = d && d.magic.fociLimits;
  const over = !!(it.bonded && lim && (lim.count > lim.maxCount || lim.force > lim.maxForce));
  const risk = !!(it.bonded && lim && !over && lim.addictionRisk);
  const fx = def.bonus ? describeEffects(effectsOf(def.bonus, { Rating: force || 1 })) : '';
  const weaponFocus = !!(def.bonus && def.bonus.weaponspecificdice !== undefined);
  const melee = weaponFocus && d ? d.items.weapons.filter((e) => e.def.type === 'Melee') : [];
  const body = (
    <div class="mods focus-bond">
      <label class="check">
        <input type="checkbox" checked={!!it.bonded} disabled={readOnly}
          onChange={(e) => update((x) => { const g = x.gear.find((z) => z.uid === it.uid); if (g) g.bonded = e.currentTarget.checked; })} />
        Bonded
      </label>
      <span class="dim small">
        Force {force} × {mult} = {karma} Karma to bond
        {' '}({url ? <a href={url} target="_blank" rel="noopener">SR5 p.{FOCUS_TABLE_PAGE}</a> : `SR5 core p.${FOCUS_TABLE_PAGE}`})
      </span>
      {fx && <span class={cx('small', it.bonded ? 'fx' : 'dim')}>{it.bonded ? fx : `${fx} once bonded`}</span>}
      {over && <span class="pip bad" title={`At most ${lim.maxCount} bonded foci (your Magic) with a total Force of ${lim.maxForce} (Magic x 5)`}>Over the bonding limit</span>}
      {risk && <span class="pip warn" title="SR5 core p.319: using foci whose combined Force is above your Magic risks focus addiction">Force {lim.force} &gt; Magic: addiction risk</span>}
      {weaponFocus && d && (
        <span class="grant-pick">
          <label class="dim small">This focus is</label>
          <select value={choice.weapon || ''} disabled={readOnly} aria-label="Which melee weapon is the focus" onChange={(e) => setChoice({ weapon: e.currentTarget.value })}>
            <option value="">— pick your melee weapon —</option>
            {melee.map((e) => <option key={e.it.uid} value={e.it.uid}>{e.def.name}</option>)}
          </select>
          {melee.length === 0 && <span class="dim small">add the melee weapon it's enchanted into first</span>}
        </span>
      )}
      {spec && d && (
        <PowerGrantPicker spec={spec} rating={force} value={choice.power} choice={choice} d={d} readOnly={readOnly}
          onChange={(v) => setChoice({ power: v, skill: undefined, attr: undefined })} onChoice={setChoice} />
      )}
      {spec && !it.bonded && choice.power && <span class="dim small">works once bonded</span>}
      {def.bonus && def.bonus.selecttradition !== undefined && (
        <span class="grant-pick">
          <label class="dim small">Tradition</label>
          <select value={choice.tradition || ''} disabled={readOnly} aria-label="Tradition the focus was made in" onChange={(e) => setChoice({ tradition: e.currentTarget.value })}>
            <option value="">Same as yours</option>
            {idx('traditions', 'traditions').list.filter((t) => !t.hide).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </span>
      )}
    </div>
  );
  return heading ? <section><h4>Bonding</h4>{body}</section> : body;
}
