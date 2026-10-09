// setSettings() (store.js): two toggles fired in the same synchronous tick (two checkboxes clicked before a
// re-render lands - see PROJECT_STATUS.md's bug list) used to build both patches from the same render-time
// snapshot, so the second call's write clobbered the first. Fixed by accepting a functional updater that reads
// the live `state.settings` at call time, same shape as React/Preact's setState(prev => ...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';

const { setSettings, getState } = await import('../src/store.js');

test('an object patch still merges onto settings (unchanged behavior)', () => {
  setSettings({ theme: 'terminal' });
  assert.equal(getState().settings.theme, 'terminal');
});

test('a functional patch reads the live settings, not a stale snapshot - two synchronous calls both land', () => {
  setSettings({ focusPages: {} });
  const setFocus = (k, v) => setSettings((s) => ({ focusPages: { drone: false, magic: false, ...s.focusPages, [k]: v } }));
  // this is the exact shape of the bug: two toggles built from render-time data lost the first one
  setFocus('drone', true);
  setFocus('magic', true);
  assert.deepEqual(getState().settings.focusPages, { drone: true, magic: true });
});

test('an object-literal patch (the old failure mode) really would drop the first toggle, confirming the test is meaningful', () => {
  setSettings({ focusPages: {} });
  const staleFocus = getState().settings.focusPages; // captured once, like a component's render-time snapshot
  const setFocusStale = (k, v) => setSettings({ focusPages: { drone: false, magic: false, ...staleFocus, [k]: v } });
  setFocusStale('drone', true);
  setFocusStale('magic', true);
  assert.deepEqual(getState().settings.focusPages, { drone: false, magic: true }, 'demonstrates why the object form is unsafe for this');
});
