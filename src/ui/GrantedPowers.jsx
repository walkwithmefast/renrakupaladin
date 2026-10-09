// "Pick a power" controls for bonuses that grant a free adept power (engine/grantedPowers.js): a Qi Focus's held power
// and a mentor spirit's adept option; plus the read-only list of free powers shown with the adept powers.
import { arr } from '../engine/data.js';
import { grantablePowers } from '../engine/grantedPowers.js';
import { describeEffects, effectsOf } from '../engine/effects.js';
import { InspectLink, SkillChoice } from './common.jsx';

/**
 * @param {{spec, rating, value: string, choice: object, onChange: (powerId: string) => void, onChoice: (patch) => void, readOnly, d}} props
 */
export function PowerGrantPicker({ spec, rating = 1, value, choice = {}, onChange, onChoice, readOnly, d, label = 'Holds the power' }) {
  const options = grantablePowers(spec, rating);
  const current = options.find((o) => o.def.id === value);
  const stale = value && !current; // e.g. the focus's Force was lowered below what the power needs
  const def = current && current.def;
  return (
    <span class="grant-pick">
      <label class="dim small">{label}</label>
      <select value={value || ''} disabled={readOnly} aria-label={label} onChange={(e) => onChange(e.currentTarget.value)}>
        <option value="">— pick a power —</option>
        {options.map((o) => (
          <option key={o.def.id} value={o.def.id}>{o.def.name}{o.def.levels === 'True' ? ` ${o.level}` : ''} ({o.def.points} PP{o.def.levels === 'True' ? '/level' : ''})</option>
        ))}
      </select>
      {def && def.bonus && def.bonus.selectskill && (
        <SkillChoice d={d} spec={def.bonus.selectskill} value={choice.skill} onChange={(v) => onChoice({ skill: v })} />
      )}
      {def && def.bonus && def.bonus.selectattribute && (
        <select class="choicesel" value={choice.attr || ''} disabled={readOnly} aria-label="Which attribute" onChange={(e) => onChoice({ attr: e.currentTarget.value })}>
          <option value="">— attribute —</option>
          {arr(def.bonus.selectattribute.attribute).map((a) => <option key={a}>{a}</option>)}
        </select>
      )}
      {stale && <span class="pip bad">The held power no longer fits - pick again</span>}
    </span>
  );
}

/** the free powers the character currently has (bonded Qi foci, mentor), under the bought adept powers */
export function GrantedPowersList({ d }) {
  const list = d.powerGrants || [];
  if (!list.length) return null;
  return (
    <div class="granted">
      <h4 class="sub">Free powers <small class="dim">no Power Points</small></h4>
      <ul class="plain">
        {list.map((g, i) => {
          const fx = describeEffects(effectsOf(g.def.bonus, { Rating: g.level }));
          return (
            <li key={i}>
              <InspectLink kind="powers" id={g.def.id}>{g.def.name}</InspectLink>
              {g.def.levels === 'True' && <b> {g.level}</b>}
              <small class="dim"> · from {g.src}</small>
              {fx && <small class="fx"> {fx}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

