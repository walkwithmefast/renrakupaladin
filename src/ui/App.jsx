import { useEffect, useRef, useState } from 'preact/hooks';
import {
  useStore, useChar, closeInspect, createChar, openChar, deleteChar, duplicateChar, setReport, undo, redo, canUndo, canRedo, downloadJSON,
  useViewMode, setViewMode, fileMode, isDirty, saveChar, autosave, saveAll, downloadAll, openCharactersFolder, folderLoadErrors, getState,
} from '../store.js';
import { BuildTab } from './BuildTab.jsx';
import { SkillsTab } from './SkillsTab.jsx';
import { QualitiesTab } from './QualitiesTab.jsx';
import { MagicTab } from './MagicTab.jsx';
import { AugmentsTab } from './AugmentsTab.jsx';
import { GearTab } from './GearTab.jsx';
import { LifeTab } from './LifeTab.jsx';
import { SheetTab } from './SheetTab.jsx';
import { SettingsTab } from './SettingsTab.jsx';
import { PlayGear, PlayAugments, PlayMagic, PlayMagicFocus, PlayDrones, PlayVehicles, PlayDecker, Journal } from './PlayTabs.jsx';
import { isDrone } from '../engine/drones.js';
import { Sidebar } from './Sidebar.jsx';
import { cx, Modal, ConfirmDialog, AlertDialog } from './common.jsx';
import { importFiles } from '../importFile.js';
import { InspectDrawer } from './Inspect.jsx';
import { RollTray } from './Roller.jsx';
import { APP_VERSION } from '../version.js';
import { exportCharacterSheet, sheetPdfAvailable } from '../pdfFill.js';
import { Wallet } from './Wallet.jsx';
import { effectiveMode, modeSetting, toggleMode } from '../theme.js';
import { SunIcon, MoonIcon } from './icons.jsx';

const BUILD_TABS = [
  ['build', 'Build', BuildTab],
  ['skills', 'Skills', SkillsTab],
  ['qualities', 'Qualities', QualitiesTab],
  ['magic', 'Magic', MagicTab],
  ['augments', 'Augments', AugmentsTab],
  ['gear', 'Gear', GearTab],
  ['life', 'Life', LifeTab],
  ['sheet', 'Sheet', SheetTab],
  ['settings', 'Settings', SettingsTab],
];

// Play mode: locked to play state (damage, Edge, ammo, journal) and, in career mode, buying/adding inventory
// (weapons/armor/gear/vehicles/cyberware/bioware/Fake SINs - a real purchase or loot, same as Build) - #44.
// Priorities, attributes, skills, qualities and magic/tradition choices still only change in Build mode.
const PLAY_TABS = [
  ['sheet', 'Sheet', SheetTab],
  ['gear', 'Gear', PlayGear],
  ['magic', 'Magic', PlayMagic],
  ['journal', 'Journal', Journal],
];
// Focus pages (Settings -> Focus pages): more detailed Play-mode pages for a specialized character, on by
// default and always relevance-gated (a rigger doesn't need to go find a setting first) - a player can opt out
// per page if they'd rather keep Play mode leaner. Drones/Vehicles are extra tabs that appear once the
// character actually has one of that kind; Magic isn't a separate tab - its toggle swaps in a fuller version
// (with a Sustained spells/forms tracker) of the Magic tab that's already there. Matrix isn't part of this at
// all - unlike these, it's not optional: anyone with a device (or a technomancer's living persona) gets it.
function tabsFor(mode, d, focusPages) {
  if (mode !== 'play') return BUILD_TABS;
  const magicOn = !!(d && (d.attr.MAG.enabled || d.attr.RES.enabled));
  // on by default (Settings -> Focus pages lets a player opt out; unset/undefined means "never touched the
  // setting", which should read as on, not off - an explicit `false` from unchecking still wins)
  const fp = { drone: true, magic: true, ...focusPages };
  const list = PLAY_TABS
    .filter(([k]) => k !== 'magic' || magicOn)
    .map(([k, label, C]) => (k === 'magic' && fp.magic ? [k, label, PlayMagicFocus] : [k, label, C]));
  const extra = [];
  // Augments (Cyberware/Bioware): career mode only - buying new 'ware is a real, priced purchase, same as
  // Build's Augments tab (which this reuses wholesale, see PlayTabs.jsx's PlayAugments). Not opt-in, like Gear.
  if (d && !d.create) extra.push(['augments', 'Augments', PlayAugments]);
  if (fp.drone && d && d.items.vehicles.some((e) => isDrone(e.def))) extra.push(['drones', 'Drones', PlayDrones]);
  if (fp.drone && d && d.items.vehicles.some((e) => !isDrone(e.def))) extra.push(['vehicles', 'Vehicles', PlayVehicles]);
  // the Matrix tab is where all Matrix content lives in Play mode, so it isn't opt-in: anyone with a device (or a
  // technomancer's living persona) gets it
  if (d && (d.matrix.devices.length > 0 || d.attr.RES.enabled)) extra.push(['decker', 'Matrix', PlayDecker]);
  const journalIdx = list.findIndex(([k]) => k === 'journal');
  list.splice(journalIdx === -1 ? list.length : journalIdx, 0, ...extra);
  return list;
}

const readTab = (mode) => { try { return localStorage.getItem('crm.tab.' + mode) || (mode === 'play' ? 'sheet' : 'build'); } catch { return mode === 'play' ? 'sheet' : 'build'; } };

/** Build | Play switch */
function ModeSwitch({ ch, mode }) {
  return (
    <div class="modeswitch" role="radiogroup" aria-label="Mode">
      {[['build', 'Build', 'Edit the character'], ['play', 'Play', 'Locked, made for the table']].map(([k, label, hint]) => (
        <button key={k} type="button" role="radio" aria-checked={mode === k} title={hint} class={cx('mode-opt', mode === k && 'on', k)} onClick={() => setViewMode(ch.id, k)}>{label}</button>
      ))}
    </div>
  );
}

function Welcome() {
  const st = useStore();
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const input = e.currentTarget;
    await importFiles(input.files);
    input.value = '';
  };
  return (
    <div class="welcome">
      <h1>Renraku <span>Paladin</span></h1>
      <p>A fast, offline Shadowrun 5th Edition character builder. Everything is calculated as you click.</p>
      <div class="row gap center">
        <button type="button" class="primary big" onClick={createChar}>Create a new runner</button>
        <button type="button" class="big" onClick={() => fileRef.current.click()}>Import a character</button>
        <input ref={fileRef} type="file" accept=".chum5,.json,.xml" multiple hidden onChange={onFile} />
      </div>
      {st.order.length > 0 && (
        <ul class="recent">
          {st.order.map((id) => <li key={id}><button type="button" class="link" onClick={() => openChar(id)}>{st.chars[id].info.alias || st.chars[id].info.name || 'Unnamed runner'}</button> <small>{st.chars[id].metatype}</small></li>)}
        </ul>
      )}
    </div>
  );
}

/** Save: commits the open character to its file. Everything else that acts on a character lives in CharMenu. */
function SaveButton({ ch }) {
  if (!fileMode()) {
    return <button type="button" class="savebtn" disabled title="Running in a browser: characters are kept in this browser automatically. Open the desktop app to save them as files.">Saved</button>;
  }
  const dirty = isDirty(ch.id);
  return (
    <button type="button" class={cx('savebtn', dirty && 'dirty')} disabled={!dirty} onClick={() => saveChar(ch.id)}
      title={dirty ? 'Save this character to its file (Ctrl+S)' : 'All changes are saved to the characters folder'}>
      {dirty ? 'Save' : 'Saved'}
    </button>
  );
}

/** the "Character" drop-down: new / copy / import / export / PDF / folder / delete */
/** Character -> Rename: name and street name (the top bar used to carry a name box, which pushed it onto two rows) */
function RenameDialog({ ch, onClose }) {
  const { update } = useChar();
  const [name, setName] = useState(ch.info.name || '');
  const [alias, setAlias] = useState(ch.info.alias || '');
  const save = () => { update((x) => { x.info.name = name.trim(); x.info.alias = alias.trim(); }); onClose(); };
  return (
    <Modal title="Rename" onClose={onClose} footer={<><button type="button" onClick={onClose}>Cancel</button><button type="button" class="primary" onClick={save}>Save</button></>}>
      <div class="fields">
        <label class="field"><span class="lbl">Name</span><input value={name} autoFocus onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
        <label class="field"><span class="lbl">Street name / alias</span><input value={alias} onInput={(e) => setAlias(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
      </div>
      <p class="hint">The list of characters shows the street name when there is one. Also editable under Life → Biography.</p>
    </Modal>
  );
}

function CharMenu({ ch, d, playing }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  const onFile = async (e) => {
    const input = e.currentTarget;
    await importFiles(input.files);
    input.value = '';
  };
  const onPdf = async () => {
    setPdfBusy(true);
    try {
      const { missing } = await exportCharacterSheet(ch, d);
      if (missing.length) console.warn(`Character-sheet PDF: the template has no field named ${missing.join(', ')}`);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(false);
    }
  };
  const name = ch.info.name || ch.info.alias || 'this character';
  // [label, onClick, {hint, danger, hidden}] - null draws a divider
  const items = [
    ['New character', createChar, { hint: 'Start a new runner' }],
    ['Rename…', () => setRenaming(true), { hint: 'Change the name or street name' }],
    ['Duplicate', () => duplicateChar(ch.id), { hint: 'Make a copy of this character', hidden: playing }],
    ['Import…', () => fileRef.current.click(), { hint: 'A Chummer5a .chum5 save, a Renraku Paladin .rp.json file, or an "Export all" file' }],
    null,
    ['Export this character', () => downloadJSON(ch), { hint: 'Download this character as a .rp.json file' }],
    ['Export all characters', downloadAll, { hint: 'Every character in one file - Import reads it back' }],
    ['Fill PDF character sheet', onPdf, { hint: 'Fill the character-sheet PDF with this character and download it', hidden: !sheetPdfAvailable() }],
    ['Open characters folder', openCharactersFolder, { hint: 'Show the folder the character files are saved in', hidden: !fileMode() }],
    null,
    ['Delete character', () => setDeleting(true), { hint: 'Delete this character', danger: true, hidden: playing }],
  ].filter((x) => !x || !x[2].hidden)
    .filter((x, i, a) => x || (i > 0 && a[i - 1] && i < a.length - 1)); // no leading/trailing/double dividers
  return (
    <div class="charmenu" ref={wrapRef}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} disabled={pdfBusy}>
        {pdfBusy ? 'Filling PDF…' : 'Character ▾'}
      </button>
      {open && (
        <div class="menu" role="menu" aria-label="Character">
          {items.map((x, i) => (x ? (
            <button key={x[0]} type="button" role="menuitem" class={cx(x[2].danger && 'danger')} title={x[2].hint}
              onClick={() => { setOpen(false); x[1](); }}>{x[0]}</button>
          ) : <hr key={'sep' + i} />))}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".chum5,.json,.xml" multiple hidden onChange={onFile} />
      {renaming && <RenameDialog ch={ch} onClose={() => setRenaming(false)} />}
      {deleting && (
        <ConfirmDialog title="Delete character" danger confirmLabel="Delete"
          message={`Delete ${name}?${fileMode() ? ' Its file goes to the Recycle Bin.' : ' This cannot be undone.'}`}
          onConfirm={() => deleteChar(ch.id)} onClose={() => setDeleting(false)} />
      )}
      {pdfError && <AlertDialog title="Fill PDF character sheet" message={pdfError} onClose={() => setPdfError(null)} />}
    </div>
  );
}

/** quick light/dark flip; Settings -> Appearance has the full choice (incl. following the OS) and the themes */
function ModeToggle() {
  useStore();
  const showing = effectiveMode();
  const sys = modeSetting() === 'system';
  const next = showing === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" class="ghost iconbtn" onClick={toggleMode} aria-label={`Switch to ${next} mode`}
      title={`${showing === 'dark' ? 'Dark' : 'Light'} mode${sys ? ' (following your system)' : ''}. Click for ${next}; Settings has more.`}>
      {showing === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function TopBar({ tab, setTab, tabs, mode }) {
  const barRef = useRef(null);
  // the sticky sidebar sits just under the bar, whose height changes when it wraps onto two rows
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${Math.round(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const st = useStore();
  const { ch, d, update } = useChar();
  const playing = mode === 'play';
  return (
    <header class="top" ref={barRef}>
      <div class="brand">Renraku<span>Paladin</span><small class="ver">{APP_VERSION}</small></div>
      <ModeSwitch ch={ch} mode={mode} />
      <nav class="tabs" role="tablist" aria-label="Sections">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} class={cx('tab-btn', tab === k && 'on')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      <div class="tools">
        <select value={st.currentId || ''} onChange={(e) => openChar(e.currentTarget.value)} aria-label="Character">
          {st.order.map((id) => <option key={id} value={id}>{st.chars[id].info.alias || st.chars[id].info.name || 'Unnamed runner'}</option>)}
        </select>
        {!playing && <button type="button" class="ghost" onClick={undo} disabled={!canUndo()} title="Undo (Ctrl+Z)">↶</button>}
        {!playing && <button type="button" class="ghost" onClick={redo} disabled={!canRedo()} title="Redo (Ctrl+Y)">↷</button>}
        <ModeToggle />
        {playing && <Wallet />}
        <SaveButton ch={ch} />
        <CharMenu ch={ch} d={d} playing={playing} />
      </div>
    </header>
  );
}

function ImportReport({ report, onClose }) {
  const bySection = new Map();
  for (const u of report.unmatched) {
    if (!bySection.has(u.section)) bySection.set(u.section, []);
    bySection.get(u.section).push(u);
  }
  const bad = report.checks.filter((c) => !c.ok);
  const counts = Object.entries(report.imported).filter(([, n]) => n > 0);
  return (
    <Modal title={`Imported ${report.name}`} onClose={onClose} footer={<button type="button" class="primary" onClick={onClose}>Done</button>}>
      {report.plain ? <p>{report.count ? `Loaded ${report.name} from an "Export all" file.` : 'The character was loaded from a Renraku Paladin file.'}{fileMode() ? ' Saved to the characters folder.' : ''}</p> : (
        <>
          {counts.length > 0 && <div class="chips">{counts.map(([k, n]) => <span key={k} class="chip on">{k} {n}</span>)}</div>}
          {report.checks.length > 0 && (
            <>
              <h4>Checked against the numbers Chummer saved</h4>
              <table class="tbl compact">
                <tbody>
                  {report.checks.map((c) => (
                    <tr key={c.label}><th>{c.label}</th><td class="num">{c.mine}</td><td class="num dim">Chummer {c.theirs}</td><td class={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗ differs'}</td></tr>
                  ))}
                </tbody>
              </table>
              {bad.length > 0 && <p class="hint">Differences usually mean a house rule, custom item or unsupported bonus in the original. Review those areas.</p>}
            </>
          )}
          {report.unmatched.length > 0 && (
            <>
              <h4>Not found in the game data ({report.unmatched.length})</h4>
              {[...bySection.entries()].map(([sec, list]) => (
                <p key={sec} class="wrapline"><b>{sec}:</b> {list.map((u) => u.name).join(', ')}</p>
              ))}
              <p class="hint">These were left out. They may come from a custom data pack or a book that is not enabled.</p>
            </>
          )}
          {report.notes.length > 0 && (
            <>
              <h4>Notes</h4>
              <ul class="plain">{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

export function App() {
  const st = useStore();
  const mode = useViewMode();
  const [tabs, setTabs] = useState(() => ({ build: readTab('build'), play: readTab('play') }));
  const [folderAlert, setFolderAlert] = useState(null);
  // moving to another page commits the open character to its file (autosave; no-op in a plain browser)
  const choose = (t) => { closeInspect(); setTabs((o) => ({ ...o, [mode]: t })); try { localStorage.setItem('crm.tab.' + mode, t); } catch { /* ignore */ } autosave(); };
  const { d } = useChar();

  useEffect(() => {
    // closing the window saves whatever hasn't been saved yet
    const bye = () => saveAll();
    window.addEventListener('beforeunload', bye);
    const errs = folderLoadErrors();
    if (errs.length) setTimeout(() => setFolderAlert(`Some files in the characters folder couldn't be opened and were skipped:\n\n${errs.map((x) => `${x.file}: ${x.message}`).join('\n')}`), 300);
    return () => window.removeEventListener('beforeunload', bye);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        // works mid-typing too: blur first so a half-typed field (which commits on change) is included
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        setTimeout(() => { const id = getState().currentId; if (id && isDirty(id)) saveChar(id); }, 0);
        return;
      }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!st.currentId || !st.chars[st.currentId]) {
    return (
      <>
        <Welcome />
        {st.report && <ImportReport report={st.report} onClose={() => setReport(null)} />}
        {folderAlert && <AlertDialog title="Characters folder" message={folderAlert} onClose={() => setFolderAlert(null)} />}
      </>
    );
  }
  const list = tabsFor(mode, d, st.settings.focusPages);
  const tab = tabs[mode];
  const Active = (list.find((t) => t[0] === tab) || list[0])[2];
  return (
    <div class={cx('app', mode)}>
      <TopBar tab={(list.find((t) => t[0] === tab) || list[0])[0]} setTab={choose} tabs={list} mode={mode} />
      <div class={cx('layout', mode === 'play' && 'solo')}>
        <main id="main"><Active /></main>
        {mode === 'build' && <Sidebar />}
      </div>
      {st.report && <ImportReport report={st.report} onClose={() => setReport(null)} />}
      {folderAlert && <AlertDialog title="Characters folder" message={folderAlert} onClose={() => setFolderAlert(null)} />}
      <InspectDrawer />
      <RollTray />
    </div>
  );
}
