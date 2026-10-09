// Sustained spells/complex forms (SR5 core p.166, p.282): sustaining a spell (or running a sustained
// complex form) past the action you cast it in costs a -2 dice pool modifier to everything you do, per
// spell/form currently sustained (a Sustaining focus can take over sustaining one of them for free instead -
// that's tracked as the `bonded` flag on the focus itself, in foci.js, not duplicated here). Play state, like
// ammo/Edge/marks - resets between sessions, so it lives in ch.play (see playState() in edge.js).
import { num } from './data.js';
import { playState } from './edge.js';

export const SUSTAIN_PENALTY = 2;
export const SUSTAIN_PAGE = 166;

const ensure = (x) => { x.play = { ...playState(x) }; };

export function addSustained(x, name) {
  ensure(x);
  const n = String(name || '').trim();
  if (!n) return;
  x.play.sustained = [...x.play.sustained, { uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: n }];
}

export function removeSustained(x, uid) {
  ensure(x);
  x.play.sustained = x.play.sustained.filter((s) => s.uid !== uid);
}

/** total dice pool penalty from everything currently sustained (a positive number of dice lost) */
export const sustainPenalty = (ch) => playState(ch).sustained.length * SUSTAIN_PENALTY;
