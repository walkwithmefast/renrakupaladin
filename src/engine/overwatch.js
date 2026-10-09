// Matrix Marks and Overwatch Score (SR5 core p.229-232). Both are play state, not build state - they're
// reset between runs and aren't part of the character's permanent build, so they live in ch.play like
// ammo counts and Edge (see playState() in edge.js), not in a normal owned-item list.
//
// This only tracks the numbers, on purpose: it doesn't try to auto-add hits to Overwatch Score for you.
// The core rulebook has the GM roll that secretly, off the exact test that was just run, and OS is
// normally hidden from the player entirely - this app has no way to know what illegal action you just
// took or roll dice on the GM's behalf, so it's a clock you (or your GM) advance by hand as you play.
import { num } from './data.js';
import { playState } from './edge.js';

export const MARK_MAX = 3; // SR5 core p.231: a persona can't have more than 3 marks on one icon
export const OS_CONVERGENCE = 40; // SR5 core p.232: Overwatch Score reaching this triggers Convergence
export const MARKS_PAGE = 231;
export const OS_PAGE = 232;

const ensure = (x) => { x.play = { ...playState(x) }; };

export function addMarkTarget(x, target) {
  ensure(x);
  const name = String(target || '').trim();
  if (!name) return;
  x.play.marks = [...x.play.marks, { uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, target: name, marks: 1 }];
}

export function setMarks(x, uid, n) {
  ensure(x);
  x.play.marks = x.play.marks.map((m) => (m.uid === uid ? { ...m, marks: Math.max(0, Math.min(MARK_MAX, Math.round(num(n)))) } : m));
}

export function removeMarkTarget(x, uid) {
  ensure(x);
  x.play.marks = x.play.marks.filter((m) => m.uid !== uid);
}

export function setOverwatch(x, n) {
  ensure(x);
  x.play.overwatch = Math.max(0, Math.round(num(n)));
}

export function addOverwatch(x, delta) {
  ensure(x);
  x.play.overwatch = Math.max(0, x.play.overwatch + Math.round(num(delta)));
}

export function resetOverwatch(x) {
  ensure(x);
  x.play.overwatch = 0;
}
