// Appearance: which theme and light/dark mode the app is in (Settings -> Appearance, and the top-bar toggle).
// Applied as <html data-theme="..." data-mode="dark|light">; styles.css holds every theme's tokens. Mode "system"
// follows the OS and updates live when the OS switches.
import { getState, subscribe, setSettings } from './store.js';

export const THEMES = [
  { id: 'matrix', name: 'Matrix', blurb: 'Teal on midnight. The default.', dark: ['#0d1117', '#171e29', '#35d0c0', '#5aa9ff'], light: ['#f3f5f8', '#ffffff', '#0b8f83', '#1f6fd1'] },
  { id: 'renraku', name: 'Renraku', blurb: 'Corporate crimson on graphite.', dark: ['#100d0e', '#1d1819', '#ff4b5c', '#7aa8e8'], light: ['#f5f2f2', '#ffffff', '#c20e2c', '#2b63b0'] },
  { id: 'awakened', name: 'Awakened', blurb: 'Gold on deep violet, for the arcane.', dark: ['#0e0b15', '#1a1527', '#e8c05a', '#b08cff'], light: ['#f6f3fb', '#ffffff', '#6d42c9', '#946400'] },
  { id: 'neon', name: 'Street neon', blurb: 'Magenta and amber after dark.', dark: ['#0c0911', '#181221', '#ff3db2', '#ffb23d'], light: ['#fbf5fa', '#ffffff', '#b8157a', '#9a5600'] },
  { id: 'chrome', name: 'Chrome', blurb: 'Cool steel and ice blue.', dark: ['#0c1015', '#161c25', '#93bde9', '#7fd0c6'], light: ['#f1f4f7', '#ffffff', '#33669d', '#0f7d72'] },
  { id: 'terminal', name: 'Terminal', blurb: 'Green phosphor, all monospace.', dark: ['#030803', '#081408', '#3dff6e', '#8fe6ff'], light: ['#eef3e9', '#f9fcf6', '#137a2c', '#0b6184'] },
];
export const MODES = [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']];

const osLight = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
/** the chosen theme id (the old unused `theme: 'dark'` setting maps to the default) */
export const themeId = () => { const t = getState().settings.theme; return THEMES.some((x) => x.id === t) ? t : 'matrix'; };
export const modeSetting = () => { const m = getState().settings.mode; return m === 'dark' || m === 'light' ? m : 'system'; };
/** what's actually showing: 'dark' or 'light' */
export const effectiveMode = () => { const m = modeSetting(); return m === 'system' ? (osLight() ? 'light' : 'dark') : m; };

export function applyTheme() {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const t = themeId();
  const m = effectiveMode();
  if (el.dataset.theme !== t) el.dataset.theme = t;
  if (el.dataset.mode !== m) el.dataset.mode = m;
}

export const setTheme = (id) => setSettings({ theme: id });
export const setMode = (m) => setSettings({ mode: m });
/** the top-bar toggle: flip what's showing (from System it pins the opposite of the OS) */
export const toggleMode = () => setMode(effectiveMode() === 'dark' ? 'light' : 'dark');

applyTheme();
subscribe(applyTheme);
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
}
