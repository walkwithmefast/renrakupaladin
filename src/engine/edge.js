// Edge: spending, burning and regaining (SR5 core p.56-57).
//  - Spend 1 point per test/action on your own actions; only one point per test.
//  - Burning a point removes it permanently (re-buy with Karma later).
//  - You regain 1 point after a good meal and 8 hours' sleep, or when the GM rewards good play; never above your maximum.
import { num } from './data.js';

export const EDGE_SPEND = [
  { id: 'push', name: 'Push the Limit', text: 'Add your Edge rating to the test, before or after rolling. Sixes explode (a 6 is a hit and you re-roll it). Ignores limits. If used after the roll, only the Edge dice explode.' },
  { id: 'second', name: 'Second Chance', text: 'Re-roll every die that did not hit. It cannot fix a glitch, does not explode sixes, and has no effect on limits.' },
  { id: 'seize', name: 'Seize the Initiative', text: 'Move to the top of the initiative order for the whole Combat Turn, whatever your Initiative Score.' },
  { id: 'blitz', name: 'Blitz', text: 'Roll the maximum of five Initiative Dice for one Combat Turn.' },
  { id: 'close', name: 'Close Call', text: 'Negate one glitch, or turn a critical glitch into an ordinary glitch.' },
  { id: 'dead', name: "Dead Man's Trigger", text: 'When you are about to fall unconscious or die, make a Body + Willpower (3) test. On a success you may spend your remaining actions on a single action before blacking out.' },
];

export const EDGE_BURN = [
  { id: 'smackdown', name: 'Smackdown', text: 'Automatically succeed at an action you could perform, with four net hits. Limits have no effect.' },
  { id: 'notdead', name: 'Not Dead Yet', text: 'Survive a blow that should be fatal. The damage still happens, but you cling to life so others can stabilize you.' },
];

export const EDGE_REGAIN = [
  { id: 'rest', name: 'Meal and a night’s sleep', text: 'A fulfilling meal and at least eight hours of sleep restores one point.' },
  { id: 'gm', name: 'GM reward', text: 'The gamemaster refreshes one point for inventive or entertaining play.' },
];

const LOG_MAX = 60;

/** make sure the play-state object has every field we use */
export function playState(ch) {
  const p = ch.play || {};
  return {
    phys: num(p.phys), stun: num(p.stun), overflow: num(p.overflow),
    edgeUsed: num(p.edgeUsed), edgeBurned: num(p.edgeBurned),
    edgeLog: Array.isArray(p.edgeLog) ? p.edgeLog : [],
    rounds: p.rounds || {},
    marks: Array.isArray(p.marks) ? p.marks : [],
    overwatch: num(p.overwatch),
    sustained: Array.isArray(p.sustained) ? p.sustained : [],
    drones: p.drones && typeof p.drones === 'object' ? p.drones : {}, // per-drone damage / control mode (engine/drones.js)
    sin: typeof p.sin === 'string' ? p.sin : '', // uid of the Fake SIN in use, '' = own identity (engine/identity.js)
    matrixDmg: p.matrixDmg && typeof p.matrixDmg === 'object' ? p.matrixDmg : {}, // Matrix damage per device uid (engine/matrix.js)
    boosts: Array.isArray(p.boosts) ? p.boosts : [], // active Attribute Boosts [{uid, attr, v, turns, drain}] (engine/boost.js)
  };
}

/**
 * Wound modifier (SR5 core p.169): -1 per 3 boxes of Physical and of Stun damage. High Pain Tolerance (p.74) ignores
 * `d.woundIgnore` boxes on each track first.
 */
export function woundModifier(play, d) {
  const ignore = Math.max(0, Number(d && d.woundIgnore) || 0);
  const pen = (n) => Math.floor(Math.max(0, num(n) - ignore) / 3);
  return pen(play.phys) + pen(play.stun);
}

/** points that can still be spent, given the derived Edge total (which already excludes burned points) */
export const edgeAvailable = (d, play) => Math.max(0, d.attr.EDG.total - num(play.edgeUsed));

const note = (x, kind, id, name) => {
  x.play.edgeLog = [...(x.play.edgeLog || []), { t: Date.now(), kind, id, name }].slice(-LOG_MAX);
};
const ensure = (x) => { x.play = { ...playState(x) }; };

/** @returns {boolean} whether it did anything */
export function spendEdge(x, d, id) {
  ensure(x);
  const fx = EDGE_SPEND.find((e) => e.id === id);
  if (!fx || edgeAvailable(d, x.play) < 1) return false;
  x.play.edgeUsed += 1;
  note(x, 'spend', id, fx.name);
  return true;
}

export function burnEdge(x, d, id) {
  ensure(x);
  const fx = EDGE_BURN.find((e) => e.id === id);
  if (!fx || edgeAvailable(d, x.play) < 1) return false;
  x.play.edgeBurned += 1;
  note(x, 'burn', id, fx.name);
  return true;
}

export function regainEdge(x, id) {
  ensure(x);
  const fx = EDGE_REGAIN.find((e) => e.id === id);
  if (!fx || x.play.edgeUsed < 1) return false;
  x.play.edgeUsed -= 1;
  note(x, 'regain', id, fx.name);
  return true;
}

/** undo the most recent Edge action (fixes a mis-click) */
export function undoEdge(x) {
  ensure(x);
  const log = [...x.play.edgeLog];
  const last = log.pop();
  if (!last) return false;
  if (last.kind === 'spend') x.play.edgeUsed = Math.max(0, x.play.edgeUsed - 1);
  else if (last.kind === 'burn') x.play.edgeBurned = Math.max(0, x.play.edgeBurned - 1);
  else if (last.kind === 'regain') x.play.edgeUsed += 1;
  x.play.edgeLog = log;
  return true;
}

/** GM ruling / re-bought with Karma: bring a burned point back */
export function restoreBurnedEdge(x) {
  ensure(x);
  if (x.play.edgeBurned < 1) return false;
  x.play.edgeBurned -= 1;
  return true;
}
