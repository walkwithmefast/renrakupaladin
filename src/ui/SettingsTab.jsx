import { useState } from 'preact/hooks';
import { useStore, setSettings, getState, bookList, fileMode } from '../store.js';
import { canReadPdfs, readSummary, readFromPdfs, cancelRead, chooseFolder, forgetRead } from '../rulebook.js';
import { DEFAULT_RULES } from '../engine/rules.js';
import { Panel, Field, Stepper, SourceRef, cx, bookUrl, pdfBase, ConfirmDialog } from './common.jsx';
import { APP_VERSION } from '../version.js';
import { THEMES, MODES, themeId, modeSetting, effectiveMode, setTheme, setMode } from '../theme.js';

const RULE_FIELDS = [
  ['buildKarma', 'Starting Karma', 0, 100],
  ['qualityKarmaLimit', 'Quality Karma limit (each way)', 0, 100],
  ['maxAvailCreate', 'Max availability at creation', 0, 30],
  ['karmaCarryover', 'Karma carry-over', 0, 30],
  ['nuyenCarryover', 'Nuyen carry-over', 0, 50000],
  ['maxKarmaToNuyen', 'Max Karma → nuyen', 0, 30],
  ['attrKarma', 'Attribute Karma (× new rating)', 1, 20],
  ['newSkillKarma', 'Skill Karma (× new rating)', 1, 10],
  ['newGroupKarma', 'Skill group Karma (× new rating)', 1, 20],
  ['specKarma', 'Specialization Karma', 1, 20],
  ['spellKarma', 'Spell Karma', 1, 20],
  ['contactKarmaMult', 'Free contact Karma (× CHA)', 0, 10],
];

// progress across the reader's stages: identifying PDFs, reading each book, drug profiles
const STAGE_SPAN = { books: [0, 0.15], text: [0.15, 0.97], drugs: [0.97, 1] };
const stageLabel = (p) => (p.stage === 'books' ? `Recognizing ${p.label}` : p.stage === 'text' ? `Reading ${p.label}` : 'Reading drug profiles');

/** Settings -> Rulebook PDFs, desktop app only: read descriptions out of the PDFs in the chosen folder */
function ReadDescriptions() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [result, setResult] = useState(null);
  const [forgetting, setForgetting] = useState(false);
  const sum = readSummary();
  const run = async () => {
    setBusy(true); setResult(null); setProg(null);
    const r = await readFromPdfs(st.settings.pdfBase || '', (p) => setProg(p));
    setBusy(false); setProg(null); setResult(r);
  };
  const pct = prog ? (() => { const [a, b] = STAGE_SPAN[prog.stage] || [0, 1]; return a + (b - a) * (prog.n ? prog.i / prog.n : 0); })() : 0;
  return (
    <div class="readdesc">
      <h4>Descriptions from your PDFs</h4>
      <p class="hint">
        Item pages can quote each entry's own rules text from the rulebook. This reads it out of the PDFs in the folder above -
        your books, on this computer; nothing is sent anywhere. It takes a few minutes for a full collection, and only needs doing
        once (again if you add books).
      </p>
      {busy ? (
        <div class="readprog" role="status" aria-live="polite">
          <div class="bar"><div class="fill" style={{ transform: `scaleX(${pct})` }} /></div>
          <span class="small">{prog ? `${stageLabel(prog)} (${prog.i + 1} of ${prog.n})…` : 'Starting…'}</span>
          <button type="button" class="sm" onClick={cancelRead}>Cancel</button>
        </div>
      ) : (
        <div class="row gap">
          <button type="button" class="primary" onClick={run}>{sum ? 'Read descriptions again' : 'Read descriptions from my PDFs'}</button>
          {sum && <button type="button" class="ghost" onClick={() => setForgetting(true)}>Forget them</button>}
        </div>
      )}
      {forgetting && (
        <ConfirmDialog title="Forget descriptions" confirmLabel="Forget them"
          message="Forget the descriptions read from your PDFs? (Your own edits are kept.)"
          onConfirm={() => { forgetRead(); setResult(null); }} onClose={() => setForgetting(false)} />
      )}
      {result && !result.ok && !result.cancelled && (
        <p class="bad small">{result.error}{result.log ? <><br /><code class="pre">{result.log}</code></> : null}</p>
      )}
      {result && result.cancelled && <p class="hint">Cancelled - nothing was changed.</p>}
      {result && result.ok && <p class="ok small">Done in {result.summary.seconds}s.</p>}
      {sum && (
        <p class="hint">
          <b>{sum.text.toLocaleString()}</b> descriptions and <b>{sum.drugs}</b> drug profiles from <b>{Object.keys(sum.books).length}</b> books,
          read from <code>{sum.folder}</code> on {new Date(sum.created).toLocaleString()}.
          {sum.unmatched.length > 0 && <> Not recognized as a Shadowrun 5E book (skipped): {sum.unmatched.join(', ')}.</>}
        </p>
      )}
    </div>
  );
}

/** Settings -> Appearance: theme cards (each previewed in the mode that's showing) + System / Dark / Light */
function Appearance() {
  useStore();
  const current = themeId();
  const mode = modeSetting();
  const showing = effectiveMode();
  return (
    <Panel title="Appearance" sub={`Applies to every character. Now showing: ${showing}${mode === 'system' ? ' (following your system)' : ''}.`}>
      <div class="row gap wrap">
        <div class="modeswitch" role="radiogroup" aria-label="Light or dark">
          {MODES.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} class={cx('mode-opt', mode === k && 'on')} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div class="themes" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const [bg, panel, accent, second] = t[showing];
          return (
            <button key={t.id} type="button" role="radio" aria-checked={current === t.id} class={cx('themecard', current === t.id && 'on')} onClick={() => setTheme(t.id)}>
              <span class="tpreview" style={{ background: bg }} aria-hidden="true">
                <span class="tpanel" style={{ background: panel }}>
                  <i style={{ background: accent }} /><i style={{ background: second }} /><b style={{ background: accent }} />
                </span>
              </span>
              <span class="tname" style={t.id === 'terminal' ? { fontFamily: 'var(--mono)' } : undefined}>{t.name}</span>
              <span class="tblurb">{t.blurb}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function SettingsTab() {
  const st = useStore();
  const enabled = st.settings.books;
  const books = bookList();
  const isOn = (code) => (enabled ? enabled.includes(code) : !/German-Only/.test(books.find((b) => b.code === code).name));
  const setBooks = (list) => setSettings({ books: list });
  // built from the live `s` the updater is handed, not the `enabled`/`books` closed over at render time, so two
  // toggles fired before a re-render lands (two checkboxes clicked back to back) don't clobber one another
  const toggle = (code) => setSettings((s) => {
    const on = s.books ? s.books.includes(code) : !/German-Only/.test(books.find((b) => b.code === code).name);
    const cur = s.books || books.filter((b) => !/German-Only/.test(b.name)).map((b) => b.code);
    return { books: on ? cur.filter((c) => c !== code) : [...cur, code] };
  });
  const rules = { ...DEFAULT_RULES, ...st.settings.rules };
  const setRule = (k, v) => setSettings((s) => ({ rules: { ...s.rules, [k]: v } }));
  const hasPdf = (code) => window.SR5BOOKS && window.SR5BOOKS[code];
  const focus = { drone: true, magic: true, ...st.settings.focusPages };
  const setFocus = (k, v) => setSettings((s) => ({ focusPages: { drone: true, magic: true, ...s.focusPages, [k]: v } }));

  return (
    <div class="tab">
      <Appearance />
      <Panel
        title="Source books"
        sub="Only items from ticked books appear in the pickers."
        right={
          <>
            <button type="button" class="ghost sm" onClick={() => setBooks(books.filter((b) => !/German-Only/.test(b.name)).map((b) => b.code))}>English books</button>
            <button type="button" class="ghost sm" onClick={() => setBooks(['SR5'])}>Core only</button>
            <button type="button" class="ghost sm" onClick={() => setBooks(books.filter((b) => hasPdf(b.code)).map((b) => b.code))}>Books I have PDFs for</button>
          </>
        }
      >
        <div class="book-grid">
          {books.map((b) => (
            <label key={b.code} class={cx('book', isOn(b.code) && 'on')}>
              <input type="checkbox" checked={isOn(b.code)} onChange={() => toggle(b.code)} />
              <span class="bn">{b.name}</span>
              <span class="bc">{b.code}{hasPdf(b.code) ? ' · PDF' : ''}</span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Rulebook PDFs" sub="Page links open your PDF at the right page">
        <p class="hint" style={{ marginTop: 0 }}>
          Links look for the PDFs in the <b>Shadowrun 5e</b> folder next to this app. If you move the app or the books, {canReadPdfs() ? 'choose' : 'paste'} the folder
          here (for example <code>E:\Games\Shadowrun 5e</code>).
        </p>
        <div class="row gap end">
          <Field label="PDF folder (leave empty for the default)" wide>
            <input value={st.settings.pdfBase || ''} placeholder="../../Shadowrun 5e/" onChange={(e) => setSettings({ pdfBase: e.currentTarget.value })} />
          </Field>
          {canReadPdfs() && (
            <button type="button" onClick={async () => { const f = await chooseFolder(st.settings.pdfBase); if (f) setSettings({ pdfBase: f }); }}>Browse…</button>
          )}
        </div>
        <p class="hint">
          {Object.keys(window.SR5BOOKS || {}).length} books matched to PDFs.{' '}
          {bookUrl('SR5', 284) && <a class="src big" href={bookUrl('SR5', 284)} target="_blank" rel="noopener">Test: open the core book at p.284 (Fireball) ↗</a>}
        </p>
        <p class="hint">Now looking in: <code>{(() => { try { return decodeURI(pdfBase()); } catch { return pdfBase(); } })()}</code></p>
        {canReadPdfs() && <ReadDescriptions />}
      </Panel>

      <Panel title="Focus pages" sub="Extra, more detailed Play-mode pages - on by default whenever they're relevant; turn one off here if you'd rather keep Play mode leaner.">
        <div class="focus-toggles">
          <div class="focus-toggle">
            <label class="check big"><input type="checkbox" checked={focus.drone} onChange={(e) => setFocus('drone', e.currentTarget.checked)} /> Drones &amp; vehicles</label>
            <p class="hint">Dedicated "Drones" and "Vehicles" tabs: everything you own of each as a full stat card, with its modifications. Each only shows up once you own at least one of that kind.</p>
          </div>
          <div class="focus-toggle">
            <label class="check big"><input type="checkbox" checked={focus.magic} onChange={(e) => setFocus('magic', e.currentTarget.checked)} /> Magic</label>
            <p class="hint">Adds a Sustained spells/forms tracker to the Magic tab (SR5 core p.166: −2 dice pool per spell or form you're sustaining). Shows up if you have Magic or Resonance.</p>
          </div>
        </div>
        <p class="hint">In Play mode the <b>Matrix</b> tab appears on its own for anyone with a commlink, cyberdeck or RCC, or with Resonance: it holds the devices, persona, Marks &amp; Overwatch Score, and programs.</p>
      </Panel>

      <Panel title="House rules" sub="Defaults follow the core rulebook. Changes apply to every character.">
        <div class="fields">
          {RULE_FIELDS.map(([k, label, min, max]) => (
            <Field key={k} label={label}>
              <Stepper value={rules[k]} min={min} max={max} step={max > 1000 ? 1000 : 1} onChange={(v) => setRule(k, v)} width="90px" />
            </Field>
          ))}
        </div>
        <button type="button" class="ghost" onClick={() => setSettings({ rules: {} })}>Reset to core rules</button>
      </Panel>

      <Panel title="About" right={<span class="pip">{APP_VERSION}</span>}>
        <p>
          Renraku Paladin is an offline Shadowrun 5th Edition character builder. Game data (metatypes, skills, qualities, gear, spells…)
          is converted from the Chummer5a data files; rule formulas were checked against the Shadowrun 5th Edition core rulebook.
          Chummer5a is licensed GPL-3.0, so this project's derived data is too. Shadowrun is a trademark of its respective owners; this is an unofficial fan tool.
        </p>
        <p class="dim">{fileMode()
          ? <>Each character is saved as a file in the <b>characters</b> folder (Character ▾ → Open characters folder). Descriptions you edit are saved in the <b>rulebook</b> folder next to it.</>
          : <>Your characters are stored in this browser (localStorage). Use <b>Character ▾ → Export</b> to keep backups.</>}</p>
      </Panel>
    </div>
  );
}
