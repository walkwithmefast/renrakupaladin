import { useState } from 'preact/hooks';
import { useChar } from '../store.js';
import { oddsFor, KNOWLEDGE_TIERS, LANGUAGE_TIERS } from '../engine/odds.js';
import { Panel, cx } from './common.jsx';

// ---- category look & feel ---------------------------------------------------------------
const CATS = [
  { key: 'Language', label: 'Languages', tone: 'var(--accent)', attr: 'INT', blurb: 'Speak, read and write. Each language is its own skill.' },
  { key: 'Street', label: 'Street', tone: 'var(--phys)', attr: 'INT', blurb: 'Gangs, hangouts, fixers, who runs what.' },
  { key: 'Academic', label: 'Academic', tone: 'var(--ment)', attr: 'LOG', blurb: 'Book learning: sciences, history, magic theory.' },
  { key: 'Professional', label: 'Professional', tone: 'var(--warn)', attr: 'LOG', blurb: 'Trade know-how: corporations, security, craft.' },
  { key: 'Interest', label: 'Interests', tone: 'var(--spec)', attr: 'INT', blurb: 'Hobbies and passions: music, sports, games.' },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));

const Icon = ({ cat }) => {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  switch (cat) {
    case 'Language': return <svg {...p}><path d="M4 5h16v10H10l-4 4v-4H4z" /><path d="M8 9h8M8 12h5" /></svg>;
    case 'Street': return <svg {...p}><path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>;
    case 'Academic': return <svg {...p}><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5" /></svg>;
    case 'Professional': return <svg {...p}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>;
    default: return <svg {...p}><path d="M12 4l2.4 5 5.4.6-4 3.8 1.1 5.4L12 16l-4.9 2.8L8.2 13.4l-4-3.8 5.4-.6z" /></svg>;
  }
};

const pct = (c) => `${Math.round(c * 100)}%`;

function Odds({ pool, tiers, tone }) {
  const rows = oddsFor(pool, tiers);
  return (
    <div class="odds" style={{ '--kt': tone }} role="group" aria-label="Chance to reach each threshold">
      {rows.map((r) => (
        <div key={r.label} class="odd" title={`${r.text}. Chance of at least ${r.hits} hit${r.hits === 1 ? '' : 's'} with ${pool} dice: ${pct(r.chance)}`}>
          <span class="bar"><i style={{ height: `${Math.max(3, Math.round(r.chance * 100))}%` }} /></span>
          <b>{pct(r.chance)}</b>
          <small>{r.label}</small>
        </div>
      ))}
    </div>
  );
}

function SkillCard({ k, cat, open, onToggle }) {
  const isLang = k.cat === 'Language';
  const tiers = isLang ? LANGUAGE_TIERS : KNOWLEDGE_TIERS;
  const native = k.native;
  const untrained = !native && k.rating === 0;
  const rating = native ? 'N' : k.rating;
  const specPool = k.spec && !native ? k.pool + 2 : null;
  return (
    <article class={cx('kcard', native && 'native', open && 'open')} style={{ '--kt': cat.tone }}>
      <button type="button" class="khead" aria-expanded={open} onClick={onToggle} title="Show how this pool is made up">
        <span class="kicon"><Icon cat={k.cat} /></span>
        <span class="kname">
          <b>{k.name}</b>
          <small>{cat.label}{native ? '' : ` · ${k.attrKey}`}</small>
        </span>
        <span class="kpool">
          {native ? <b class="nat">Native</b> : untrained ? <b class="nat">—</b> : <><b>{k.pool}</b><small>dice</small></>}
        </span>
      </button>

      <div class="kmeter" aria-label={native ? 'Native speaker' : `Rating ${k.rating}`}>
        {native ? <span class="native-tag">Native speaker — no tests needed for everyday use</span> : untrained ? <span class="rt">No ranks yet</span> : (
          <>
            <span class="pips">{Array.from({ length: Math.max(6, k.rating) }, (_, i) => <span key={i} class={cx('pip-dot', i < k.rating && 'on')} />)}</span>
            <span class="rt">Rating {rating}</span>
          </>
        )}
        {k.spec && <span class="kspec" title={`Specialization: +2 dice when it applies${specPool ? ` (${specPool} dice)` : ''}`}>{k.spec}{specPool ? <b>{specPool}</b> : null}</span>}
      </div>

      {open && (
        <div class="kdetail">
          {!native && !untrained && <Odds pool={k.pool} tiers={tiers} tone={cat.tone} />}
          {!native && !untrained && <p>{k.attrKey} {k.pool - k.rating} + rating {k.rating} = <b>{k.pool}</b> dice{specPool ? <> · <b>{specPool}</b> when your specialization applies</> : null}.</p>}
          {isLang && !native && !untrained && <p>A foreign language caps the Social skill dice you can use at <b>{k.rating}</b> (core p.151).</p>}
          {isLang && <p class="dim">Language tests are rarely needed. The GM may call for one when precise translation matters. Speaking a lingo costs −2 dice.</p>}
          {!isLang && <p class="dim">Knowledge tests reveal information not everyone knows. Recalling something you studied on purpose uses Memory (LOG + WIL).</p>}
        </div>
      )}
    </article>
  );
}

/**
 * Knowledge & languages as browsable cards: pool, rating, specialization and the real odds of clearing each threshold
 * from the core book's Knowledge Skill Table (p.149) and Language Skill Table (p.151).
 */
export function KnowledgePanel() {
  const { d } = useChar();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const all = d.know;
  if (all.length === 0) return null;

  const term = q.trim().toLowerCase();
  const shown = all.filter((k) => (filter === 'all' || k.cat === filter) && (!term || `${k.name} ${k.spec || ''}`.toLowerCase().includes(term)));
  const counts = Object.fromEntries(CATS.map((c) => [c.key, all.filter((k) => k.cat === c.key).length]));
  const present = CATS.filter((c) => counts[c.key] > 0);
  const totalRanks = all.reduce((s, k) => s + (typeof k.rating === 'number' ? k.rating : 0), 0);

  return (
    <Panel
      title="Knowledge & languages"
      sub="tap a card for the dice breakdown and odds"
      right={
        <>
          <input class="search sm" placeholder="Do I know…?" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search knowledge and languages" />
          <span class="pip" title="Sum of all ranks">{all.length} skills · {totalRanks} ranks</span>
        </>
      }
    >
      <div class="kfilter" role="tablist" aria-label="Filter by type">
        <button type="button" role="tab" aria-selected={filter === 'all'} class={cx('kf', filter === 'all' && 'on')} onClick={() => setFilter('all')}>All <span>{all.length}</span></button>
        {present.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={filter === c.key} class={cx('kf', filter === c.key && 'on')} style={{ '--kt': c.tone }} onClick={() => setFilter(c.key)}>
            <Icon cat={c.key} /> {c.label} <span>{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? <p class="empty">Nothing you know matches "{q}".</p> : (
        present.filter((c) => shown.some((k) => k.cat === c.key)).map((c) => (
          <section key={c.key} class="ksection">
            {filter === 'all' && <h4 style={{ '--kt': c.tone }}><Icon cat={c.key} /> {c.label}<small>{c.blurb}</small></h4>}
            <div class="kgrid">
              {shown.filter((k) => k.cat === c.key).sort((a, b) => (b.native ? 99 : b.rating) - (a.native ? 99 : a.rating) || a.name.localeCompare(b.name)).map((k) => (
                <SkillCard key={k.uid} k={k} cat={c} open={openId === k.uid} onToggle={() => setOpenId(openId === k.uid ? null : k.uid)} />
              ))}
            </div>
          </section>
        ))
      )}

      <details class="khelp">
        <summary>How knowledge and language tests work</summary>
        <div class="khelp-grid">
          <div>
            <h5>Knowledge (p.149)</h5>
            <p>Roll Logic (Academic, Professional) or Intuition (Street, Interest) + the skill rating. The GM sets a threshold: <b>General 1</b>, <b>Detailed 2</b>, <b>Intricate 4</b>, <b>Obscure 6+</b>.</p>
          </div>
          <div>
            <h5>Languages (p.150–151)</h5>
            <p>Intuition + rating. Thresholds: basic conversation or a universal concept <b>1</b>, complex subject <b>2</b>, intricate <b>3</b>, obscure <b>4</b>. Lingo −2 dice, AR help +1 to +4.</p>
          </div>
          <div>
            <h5>The odds (in an opened card)</h5>
            <p>The chance of at least that many hits on the dice alone (5s and 6s hit), before wound penalties, Edge or anything the GM adds.</p>
          </div>
        </div>
      </details>
    </Panel>
  );
}
