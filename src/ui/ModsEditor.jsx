// Interactive "mods / add-ons" editors for owned items that bundle other items: weapon accessories,
// armor modifications, a cyberdeck's Attribute Array + the programs running on it, and the read-only
// "comes with" list for gear that bundles other gear (a deck's Sim Module, Commlink Functionality, ...).
// Shared by the Gear tab's table rows (src/ui/GearTab.jsx) and the Inspector drawer (src/ui/Inspect.jsx)
// so both show and edit the same things instead of one being a read-only summary of the other.
// Each component owns its section heading and returns null when it has nothing to show, so callers can
// just drop them in without deciding first whether there's anything to render.
import { useState } from 'preact/hooks';
import { idx, num, txt, arr } from '../engine/data.js';
import { priceItem } from '../engine/character.js';
import { deckConfig, isProgramDef } from '../engine/matrix.js';
import { newOwned, gearDescendants } from '../engine/gearBundle.js';
import { effectsOf, describeEffects } from '../engine/effects.js';
import { evalAvail, fmtAvail, variableRange } from '../engine/expr.js';
import { Picker, nuyen, cx } from './common.jsx';
import { bookCol, cost as costCell } from './items.jsx';
import { openInspect, useChar } from '../store.js';
import { useUnavailable } from './unavailable.js';
import { modRatingRange, vehicleVars, vehicleStatView, STAT_LABEL, armorCapacity, weaponMounts } from '../engine/mods.js';

/**
 * Rating picker on a fitted add-on (only when the add-on has ratings). A drone attribute upgrade's rating is the
 * stat's new value, so it reads "Armor 6" rather than "R6". Long ranges (a Maker Mag goes to 1000) get a number box.
 */
function ModRating({ range, rating, onChange, readOnly, name }) {
  if (!range) return null;
  const label = (n) => (range.upgraded ? `${STAT_LABEL[range.upgraded]} ${n}` : `R${n}`);
  const r = Math.min(Math.max(rating || range.min, range.min), range.max);
  if (readOnly) return <span class="modrating">{label(r)}</span>;
  const count = range.max - range.min + 1;
  const title = range.upgraded ? `Upgraded ${STAT_LABEL[range.upgraded]}: the drone's new value (at most twice its starting value)` : 'Rating';
  if (count > 30) {
    return <input class="modrating" type="number" min={range.min} max={range.max} value={r} title={title} aria-label={`${name} rating`}
      onChange={(e) => { const v = Math.round(Number(e.currentTarget.value)); if (v >= range.min && v <= range.max) onChange(v); }} />;
  }
  return (
    <select class="modrating" value={r} title={title} aria-label={`${name} rating`} onChange={(e) => onChange(Number(e.currentTarget.value))}>
      {Array.from({ length: count }, (_, k) => range.min + k).map((n) => <option key={n} value={n}>{label(n)}</option>)}
    </select>
  );
}

/**
 * Price box on a fitted add-on whose own cost is a Chummer "Variable(min-max)" range (e.g. Interchangeable Bed,
 * Customized (Drone)) - without this the mod has no way to be priced at all and evaluates as min-max nuyen (a
 * large *refund* instead of a charge; see PROJECT_STATUS.md's bug list). Picking the mod seeds `variable` at
 * the range's minimum (matching `newOwned()`'s behavior for top-level items); this lets the player raise it.
 */
function ModVariable({ md, value, onChange, readOnly }) {
  const vr = variableRange(md.cost);
  if (!vr) return null;
  if (readOnly) return <span class="modvar">{nuyen(value ?? vr.min)}</span>;
  return (
    <input class="modvar" type="number" min={vr.min} max={vr.max} value={value ?? vr.min} title={`Variable cost ${nuyen(vr.min)}-${nuyen(vr.max)}`}
      aria-label={`${md.name} cost`} onChange={(e) => { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) onChange(Math.min(vr.max, Math.max(vr.min, v))); }} />
  );
}

/** a compact "what it is / what it does" summary for a hover tooltip on a bundled item's chip */
export function gearBlurb(def, it) {
  const vars = { Rating: (it && it.rating) || num(def.minrating, 1) };
  const parts = [];
  if (def.category) parts.push(def.category);
  const availRaw = txt(def.avail);
  if (availRaw) parts.push(`Avail ${fmtAvail(evalAvail(availRaw, vars))}`);
  const fx = describeEffects(effectsOf(def.bonus, vars, {}));
  if (fx) parts.push(fx);
  parts.push(it && it.free ? 'included, no extra cost' : `${nuyen(priceItem('gear', def, { rating: vars.Rating, qty: 1 }).cost)}`);
  return parts.join(' · ');
}

// ---- weapons: accessories --------------------------------------------------------------
export function WeaponAccessories({ it, def, update, readOnly, heading }) {
  const unavailable = useUnavailable('accessories', 'weapons');
  const [adding, setAdding] = useState(false);
  const all = idx('weapons', 'accessories').list;
  const owned = it.mods || [];
  const mounts = weaponMounts(def, it, idx('weapons', 'accessories'));
  const body = (
    <div class="mods">
      {owned.map((m, i) => {
        const md = idx('weapons', 'accessories').byId.get(m.id);
        return md ? (
          <span key={i} class="chip on removable" title={`${md.mount || ''} · ${md.avail || ''} · ${nuyen(priceItem('weapons', md, { rating: m.rating || 1, variable: m.variable }, { parentCost: priceItem('weapons', def, it).cost }).cost)}`}>
            {md.name}
            <ModRating range={modRatingRange('weapons', md, def)} rating={m.rating} readOnly={readOnly} name={md.name}
              onChange={(v) => update((x) => { x.weapons.find((z) => z.uid === it.uid).mods[i].rating = v; })} />
            <ModVariable md={md} value={m.variable} readOnly={readOnly}
              onChange={(v) => update((x) => { x.weapons.find((z) => z.uid === it.uid).mods[i].variable = v; })} />
            {!readOnly && <button type="button" aria-label={`Remove ${md.name}`} onClick={() => update((x) => { const w = x.weapons.find((z) => z.uid === it.uid); w.mods.splice(i, 1); })}>✕</button>}
          </span>
        ) : null;
      })}
      {owned.length === 0 && readOnly && <span class="dim small">No accessories</span>}
      {!readOnly && <button type="button" class="chip ghost" onClick={() => setAdding(true)}>+ accessory</button>}
      {mounts && (owned.length > 0 || !readOnly) && (
        <span class={cx('pip', 'slotpip', mounts.conflicts.length && 'bad')}
          title={`Mounts (SR5 core p.431): ${mounts.mounts.map((mt) => { const p = mounts.placed.find((x) => x.mount === mt); return `${mt}: ${p ? p.name : 'free'}`; }).join(' · ')}${mounts.conflicts.length ? ` · no room for ${mounts.conflicts.join(', ')}` : ''}`}>
          Mounts {mounts.placed.length}/{mounts.mounts.length}
        </span>
      )}
      {adding && (
        <Picker unavailable={unavailable} title={`Accessories for ${def.name}`} items={all} multi category={(a) => a.mount || ''} onClose={() => setAdding(false)}
          onPick={(a) => update((x) => { const w = x.weapons.find((z) => z.uid === it.uid); const vr = variableRange(a.cost); (w.mods ||= []).push({ id: a.id, rating: (modRatingRange('weapons', a, def) || { min: 1 }).min, ...(vr ? { variable: vr.min } : {}) }); })}
          columns={[
            { key: 'name', label: 'Accessory' }, { key: 'mount', label: 'Mount' }, { key: 'avail', label: 'Avail' },
            { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol,
          ]} />
      )}
    </div>
  );
  return heading ? <section><h4>Accessories</h4>{body}</section> : body;
}

// ---- armor: modifications ---------------------------------------------------------------
export function ArmorModsList({ it, def, update, readOnly, heading }) {
  const unavailable = useUnavailable('armormods', 'armor');
  const [adding, setAdding] = useState(false);
  const all = idx('armor', 'mods').list;
  const owned = it.mods || [];
  const cap = armorCapacity(def, it, idx('armor', 'mods'));
  const body = (
    <div class="mods">
      {owned.map((m, i) => {
        const md = idx('armor', 'mods').byId.get(m.id);
        return md ? (
          <span key={i} class="chip on removable" title={`${md.category || ''}${String(arr(md.armor)[0]) !== '0' ? ` · Armor ${arr(md.armor)[0]}` : ''} · ${nuyen(priceItem('armor', md, { rating: m.rating || 1, variable: m.variable }, { parentCost: priceItem('armor', def, it).cost }).cost)}`}>
            {md.name}
            <ModRating range={modRatingRange('armor', md, def)} rating={m.rating} readOnly={readOnly} name={md.name}
              onChange={(v) => update((x) => { x.armor.find((z) => z.uid === it.uid).mods[i].rating = v; })} />
            <ModVariable md={md} value={m.variable} readOnly={readOnly}
              onChange={(v) => update((x) => { x.armor.find((z) => z.uid === it.uid).mods[i].variable = v; })} />
            {!readOnly && <button type="button" aria-label={`Remove ${md.name}`} onClick={() => update((x) => { x.armor.find((z) => z.uid === it.uid).mods.splice(i, 1); })}>✕</button>}
          </span>
        ) : null;
      })}
      {owned.length === 0 && readOnly && <span class="dim small">No modifications</span>}
      {!readOnly && <button type="button" class="chip ghost" onClick={() => setAdding(true)}>+ modification</button>}
      {cap && (owned.length > 0 || !readOnly) && (
        <span class={cx('pip', 'slotpip', cap.used > cap.total && 'bad')} title="Armor mods use Capacity (SR5 core p.437)">Capacity {cap.used}/{cap.total}</span>
      )}
      {adding && (
        <Picker unavailable={unavailable} title={`Modifications for ${def.name}`} items={all} multi category={(a) => a.category} onClose={() => setAdding(false)}
          onPick={(a) => update((x) => { const vr = variableRange(a.cost); (x.armor.find((z) => z.uid === it.uid).mods ||= []).push({ id: a.id, rating: (modRatingRange('armor', a, def) || { min: 1 }).min, ...(vr ? { variable: vr.min } : {}) }); })}
          columns={[{ key: 'name', label: 'Mod' }, { key: 'armor', label: 'Armor' }, { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', get: costCell, cls: 'num' }, bookCol]} />
      )}
    </div>
  );
  return heading ? <section><h4>Modifications</h4>{body}</section> : body;
}

// ---- vehicles/drones: modifications -----------------------------------------------------
/** Rigger 5.0 room for mods: a drone's Mod Points, or a vehicle's slots per category (engine/mods.js modSlots) */
function SlotBudget({ slots }) {
  if (!slots) return null;
  if (slots.drone) {
    return <span class={cx('pip', 'slotpip', slots.left < 0 && 'bad')} title="Rigger 5.0 p.122: Mod Points = Body (or what the model has free); the first +1 to an attribute (+3 Armor) is free, downgrades give back 1 at most">
      Mod Points {slots.used}/{slots.total}</span>;
  }
  const shown = slots.cats.filter((c) => c.used !== 0 || c.left < 0);
  return (
    <span class="slotcats" title="Rigger 5.0 p.151: slots equal to Body in each of six categories">
      {(shown.length ? shown : slots.cats.slice(0, 1)).map((c) => <span key={c.cat} class={cx('pip', 'slotpip', c.left < 0 && 'bad')}>{c.cat} {c.used}/{c.total}</span>)}
      {!shown.length && <small class="dim">each category {slots.cats[0].total}</small>}
    </span>
  );
}

export function VehicleModsList({ it, def, update, readOnly, heading }) {
  const unavailable = useUnavailable('vehiclemods', 'vehicles');
  const { d } = useChar();
  const entry = d && d.items.vehicles.find((e) => e.it.uid === it.uid);
  const slots = entry && entry.stats && entry.stats.slots;
  const [adding, setAdding] = useState(false);
  const all = idx('vehicles', 'mods').list;
  const owned = it.mods || [];
  const body = (
    <div class="mods">
      {owned.map((m, i) => {
        const md = idx('vehicles', 'mods').byId.get(m.id);
        return md ? (
          <span key={i} class="chip on removable" title={`${md.category || ''} · ${md.avail || ''} · ${nuyen(priceItem('vehicles', md, { rating: m.rating || 1, variable: m.variable }, { vars: vehicleVars(def), parentCost: priceItem('vehicles', def, it).cost }).cost)}`}>
            {md.name}
            <ModRating range={modRatingRange('vehicles', md, def)} rating={m.rating} readOnly={readOnly} name={md.name}
              onChange={(v) => update((x) => { x.vehicles.find((z) => z.uid === it.uid).mods[i].rating = v; })} />
            <ModVariable md={md} value={m.variable} readOnly={readOnly}
              onChange={(v) => update((x) => { x.vehicles.find((z) => z.uid === it.uid).mods[i].variable = v; })} />
            {!readOnly && <button type="button" aria-label={`Remove ${md.name}`} onClick={() => update((x) => { x.vehicles.find((z) => z.uid === it.uid).mods.splice(i, 1); })}>✕</button>}
          </span>
        ) : null;
      })}
      {owned.length === 0 && readOnly && <span class="dim small">No modifications</span>}
      {!readOnly && <button type="button" class="chip ghost" onClick={() => setAdding(true)}>+ modification</button>}
      <SlotBudget slots={slots} />
      {adding && (
        <Picker unavailable={unavailable} title={`Modifications for ${def.name}`} items={all} multi category={(a) => a.category} onClose={() => setAdding(false)}
          onPick={(a) => update((x) => { const vr = variableRange(a.cost); (x.vehicles.find((z) => z.uid === it.uid).mods ||= []).push({ id: a.id, rating: (modRatingRange('vehicles', a, def) || { min: 1 }).min, ...(vr ? { variable: vr.min } : {}) }); })}
          columns={[{ key: 'name', label: 'Mod' }, { key: 'category', label: 'Category' }, { key: 'slots', label: 'Slots', cls: 'num' }, { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', get: costCell, cls: 'num' }, bookCol]} />
      )}
    </div>
  );
  return heading ? <section><h4>Modifications</h4>{body}</section> : body;
}

// ---- cyberdecks/RCCs: Attribute Array configuration --------------------------------------
export function DeckConfigEditor({ it, def, update, readOnly }) {
  const c = deckConfig(it, def);
  if (!c) return null;
  const setAsdf = (key, value) => update((x) => {
    const g = x.gear.find((z) => z.uid === it.uid);
    if (!g) return;
    g.asdf = { a: c.a, s: c.s, d: c.d, f: c.f, [key]: value };
  }, { record: false });
  const LABELS = [['a', 'Attack'], ['s', 'Sleaze'], ['d', 'Data Processing'], ['f', 'Firewall']];
  return (
    <section>
      <h4>Attribute array</h4>
      <div class="deck-config">
        <div class="stat-grid tight">
          {LABELS.map(([k, label]) => (
            <div class="stat" key={k}>
              <span class="lbl">{label}</span>
              {readOnly ? <b>{c[k]}</b> : (
                <select class={cx('asdf', !c.ok && 'bad')} value={c[k]} aria-label={`${def.name} ${label}`} onChange={(ev) => setAsdf(k, Number(ev.currentTarget.value))}>
                  {[...new Set(c.arr)].sort((x, y) => y - x).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
        {!c.ok && <p class="hint bad">Assign each of {c.arr.join('/')} exactly once.</p>}
      </div>
    </section>
  );
}

// ---- cyberdecks/commlinks: programs currently running here -------------------------------
export function DeviceProgramsEditor({ it, def, d, update, readOnly }) {
  const unavailable = useUnavailable('gear');
  const dev = d.matrix.devices.find((x) => x.uid === it.uid);
  const hackingOk = dev && dev.kind === 'deck';
  const allOwned = d.items.gear.filter((e) => isProgramDef(e.def));
  const running = allOwned.filter((e) => e.it.device === it.uid);
  const stored = allOwned.filter((e) => e.it.device !== it.uid && (hackingOk || e.def.category !== 'Hacking Programs'));
  const [adding, setAdding] = useState(false);
  const catalogDefs = idx('gear', 'gears').list.filter((g) => isProgramDef(g) && (hackingOk || g.category !== 'Hacking Programs'));
  return (
    <section>
      <h4>Programs running here</h4>
      <div class="mods">
        {running.map((e) => (
          <span key={e.it.uid} class="chip on removable">
            {e.def.name}
            {!readOnly && <button type="button" aria-label={`Stop running ${e.def.name}`} onClick={() => update((x) => { const g = x.gear.find((z) => z.uid === e.it.uid); if (g) g.device = ''; })}>✕</button>}
          </span>
        ))}
        {running.length === 0 && <span class="dim small">Nothing running</span>}
        {!readOnly && stored.length > 0 && (
          <select value="" aria-label={`Run an owned program on ${def.name}`}
            onChange={(ev) => { const uid = ev.currentTarget.value; if (uid) update((x) => { const g = x.gear.find((z) => z.uid === uid); if (g) g.device = it.uid; }); }}>
            <option value="">Run an owned program…</option>
            {stored.map((e) => <option key={e.it.uid} value={e.it.uid}>{e.def.name}{e.it.device ? ' (switch)' : ''}</option>)}
          </select>
        )}
        {!readOnly && <button type="button" class="chip ghost" onClick={() => setAdding(true)}>+ new program</button>}
        {adding && (
          <Picker unavailable={unavailable} title={`Programs for ${def.name}`} inspectKind="gear" items={catalogDefs} multi category={(g) => g.category} onClose={() => setAdding(false)}
            onPick={(g) => update((x) => { const nu = newOwned('gear', g); nu.device = it.uid; x.gear.push(nu); })}
            columns={[{ key: 'name', label: 'Program' }, { key: 'category', label: 'Category' }, { key: 'avail', label: 'Avail' }, { key: 'cost', label: 'Cost', cls: 'num', get: costCell }, bookCol]} />
        )}
      </div>
    </section>
  );
}

// ---- gear that bundles other gear: "comes with" list - hover for details, click to open its own page ----
export function BundleIncludes({ it, d }) {
  const kids = gearDescendants(d.items.gear, it.uid);
  if (kids.length === 0) return null;
  return (
    <section>
      <h4>Comes with</h4>
      <div class="mods">
        {kids.map((k) => (
          <button key={k.it.uid} type="button" class="chip kid" title={gearBlurb(k.def, k.it)} onClick={() => openInspect('gear', { uid: k.it.uid })}>
            {k.def.name}{num(k.it.rating) > 0 ? ` (rtg ${k.it.rating})` : ''}
          </button>
        ))}
      </div>
    </section>
  );
}

/** the same "comes with" info as a single compact, comma-joined line for a table row (each name still
 * hoverable for details and clickable to open its own page) - used where a full chip section would be
 * too heavy: the Matrix devices table and the Play-mode Gear list. */
export function BundledLine({ it, d, label = 'Includes' }) {
  const kids = gearDescendants(d.items.gear, it.uid);
  if (kids.length === 0) return null;
  return (
    <div class="bundle-note">
      <small>
        {label}:{' '}
        {kids.map((k, i) => (
          <span key={k.it.uid}>
            {i > 0 && ', '}
            <button type="button" class="kidlink" title={gearBlurb(k.def, k.it)} onClick={() => openInspect('gear', { uid: k.it.uid })}>{k.def.name}</button>
          </span>
        ))}
      </small>
    </div>
  );
}

/** one stat of an owned vehicle, with its modifications applied (highlighted + tooltip when a mod changed it) */
export function VehStat({ e, k, as = 'td' }) {
  const v = e.stats ? vehicleStatView(e.stats, k) : { text: k === 'armor' ? arr(e.def.armor).join('') : e.def[k], tip: null };
  const Tag = as;
  return <Tag class={cx(v.tip && 'boosted')} title={v.tip || undefined}>{v.text}</Tag>;
}

/**
 * Which ammunition a firearm has loaded (`weapons[].ammo` = an ammunition gear id; engine/weapons.js applies its
 * damage / AP / type changes). Offers the ammo types the character owns, plus whatever is loaded now.
 */
export function AmmoSelect({ it, def, update }) {
  const { d } = useChar();
  if (!d || def.type === 'Melee' || !/^\d+\(/.test(String(def.ammo || ''))) return null;
  const owned = [];
  for (const e of d.items.gear) if (e.def.category === 'Ammunition' && !owned.some((o) => o.id === e.def.id)) owned.push(e.def);
  const cur = it.ammo && idx('gear', 'gears').byId.get(it.ammo);
  if (cur && !owned.some((o) => o.id === cur.id)) owned.unshift(cur);
  if (!owned.length) return null;
  const label = (g) => String(g.name).replace(/^Ammo:\s*/, '');
  return (
    <select class="ammosel" value={it.ammo || ''} aria-label={`Ammo loaded in ${def.name}`} title="Loaded ammunition: changes damage, AP and damage type"
      onChange={(e) => { const v = e.currentTarget.value; update((x) => { const w = x.weapons.find((z) => z.uid === it.uid); if (w) { if (v) w.ammo = v; else delete w.ammo; } }, { record: false }); }}>
      <option value="">Regular rounds</option>
      {owned.map((g) => <option key={g.id} value={g.id}>{label(g)}</option>)}
    </select>
  );
}
