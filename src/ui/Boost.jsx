// Attribute Boost in Play mode (engine/boost.js): roll Magic + level, type in the hits, and the boost runs for
// 2 x hits Combat Turns, adding to dice pools; "End of turn" counts it down and says how much Drain to take.
import { useState } from 'preact/hooks';
import { itemDef } from '../engine/character.js';
import { playState } from '../engine/edge.js';
import { isAttributeBoost, boostPool, boostAmount, startBoost, tickBoosts, endBoost, BOOST_PAGE } from '../engine/boost.js';
import { arr, ATTR_NAME } from '../engine/data.js';
import { Panel, bookUrl } from './common.jsx';
import { RollButton } from './Roller.jsx';

function BoostRow({ p, def, d, update }) {
  const [hits, setHits] = useState('');
  const [attr, setAttr] = useState((p.choice && p.choice.attr) || '');
  const level = p.level || 1;
  const pool = boostPool(d, level);
  const options = arr(def.bonus && def.bonus.selectattribute && def.bonus.selectattribute.attribute);
  const n = Number(hits) || 0;
  const adds = attr && n > 0 ? boostAmount(d, attr, n) : 0;
  const go = () => { if (adds > 0) { update((x) => startBoost(x, d, { attr, hits: n, level, src: `${def.name} ${level}` }), { record: false }); setHits(''); } };
  return (
    <div class="boost-row">
      <span class="grow"><b>{def.name}</b> {level}{p.choice && p.choice.attr ? <small class="dim"> ({p.choice.attr})</small> : ''}</span>
      <span class="dim small">Magic + {level} = {pool}</span>
      <RollButton pool={pool} label={`${def.name} (Magic + ${level})`} />
      {!(p.choice && p.choice.attr) && (
        <select value={attr} aria-label="Attribute to boost" onChange={(e) => setAttr(e.currentTarget.value)}>
          <option value="">— attribute —</option>
          {options.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      <input type="number" min="0" class="var" placeholder="hits" value={hits} aria-label="Hits rolled" onInput={(e) => setHits(e.currentTarget.value)} />
      <button type="button" class="primary sm" disabled={adds <= 0} onClick={go}
        title={attr && n > 0 && adds < n ? `Capped at ${ATTR_NAME[attr]}'s augmented maximum` : undefined}>
        {adds > 0 ? `Boost ${attr} +${adds} for ${2 * n} turns` : 'Boost'}
      </button>
    </div>
  );
}

/** the Attribute Boost controls + active boosts; renders nothing for characters without the power */
export function BoostPanel({ ch, d, update }) {
  const [ended, setEnded] = useState([]);
  const powers = ch.powers.map((p) => ({ p, def: itemDef('powers', p) })).filter((x) => isAttributeBoost(x.def));
  const active = playState(ch).boosts;
  if (!powers.length && !active.length) return null;
  const url = bookUrl('SR5', BOOST_PAGE);
  const endTurn = () => {
    let out = [];
    update((x) => { out = tickBoosts(x); }, { record: false });
    setEnded(out);
  };
  return (
    <Panel title="Attribute Boost" sub="each hit +1 to the attribute for dice pools only; lasts 2 × hits Combat Turns, then Drain = the power's level"
      right={url && <a class="src" href={url} target="_blank" rel="noopener">SR5 core p.{BOOST_PAGE} ↗</a>}>
      {powers.map(({ p, def }) => <BoostRow key={p.uid} p={p} def={def} d={d} update={update} />)}
      {active.length > 0 && (
        <ul class="plain boosts">
          {active.map((b) => (
            <li key={b.uid} class="row gap">
              <span class="pip on">{b.attr} +{b.v}</span>
              <span class="grow">{ATTR_NAME[b.attr]} {d.attr[b.attr].total} → <b>{d.attr[b.attr].pool}</b> for pools · <b>{b.turns}</b> turn{b.turns === 1 ? '' : 's'} left · Drain {b.drain} when it ends</span>
              <button type="button" class="ghost sm" onClick={() => { update((x) => endBoost(x, b.uid), { record: false }); setEnded([b]); }}>End now</button>
            </li>
          ))}
        </ul>
      )}
      {active.length > 0 && <button type="button" onClick={endTurn}>End of Combat Turn (−1 turn)</button>}
      {ended.length > 0 && (
        <p class="hint warn" role="status">
          {ended.map((b) => `${b.attr} boost ended - resist ${b.drain} Drain`).join('; ')}.
          {' '}<button type="button" class="ghost sm" onClick={() => setEnded([])}>OK</button>
        </p>
      )}
    </Panel>
  );
}
