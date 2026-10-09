// Initiation (magicians/adepts, SR5 core p.326-329) and Submersion (technomancers, p.258-259): raising
// your Grade costs Karma and lets you learn a metamagic technique / echo. The Karma formula uses the
// same initiationKarma/initiationFlat/metamagicKarma constants already in rules.js.
import { num, idx } from './data.js';

export const INITIATION_PAGE = 326;
export const SUBMERSION_PAGE = 258;

// A technique learned at Initiation/Submersion comes from one of four different catalogue files, disambiguated
// by the owned entry's own `.kind` (set at add-time by InitiationPanel, ui/MagicTab.jsx) - there's no single
// "metamagics" catalogue the way there is for spells or qualities.
export const METAMAGIC_KINDS = {
  metamagic: { file: 'metamagic', list: 'metamagics', label: 'Metamagic' },
  art: { file: 'metamagic', list: 'arts', label: 'Art' },
  enhancement: { file: 'powers', list: 'enhancements', label: 'Power enhancement' },
  echo: { file: 'echoes', list: 'echoes', label: 'Echo' },
};

/** an owned technique's catalogue def, resolved through its `.kind` (there's no `.id` stored on these - see above) */
export function metamagicDef(it) {
  const c = METAMAGIC_KINDS[it && it.kind];
  return c ? idx(c.file, c.list).byName.get(String(it.name || '').toLowerCase()) || null : null;
}

/** the same lookup by catalogue id (for the Inspector's un-owned/picker-row view) - ids are unique across all
 *  four catalogues, so this just tries each until one matches. */
export function metamagicDefById(id) {
  for (const kind of Object.keys(METAMAGIC_KINDS)) {
    const def = idx(METAMAGIC_KINDS[kind].file, METAMAGIC_KINDS[kind].list).byId.get(id);
    if (def) return { def, kind };
  }
  return null;
}

/** cumulative Karma spent reaching `grade` (each step costs step*initiationKarma + initiationFlat) */
export function totalGradeKarma(R, grade) {
  const g = Math.max(0, Math.round(num(grade)));
  let total = 0;
  for (let i = 1; i <= g; i++) total += i * R.initiationKarma + R.initiationFlat;
  return total;
}

/**
 * total Karma spent on Initiation/Submersion + techniques. "Every time you gain an initiate grade (including the first),
 * you learn a metamagic" (SR5 core p.325; echoes likewise, p.258) - so one technique per grade is paid for by the grade;
 * only techniques beyond that cost `metamagicKarma` each (it used to charge for every one - v28 fix).
 */
export function totalMetamagicKarma(R, grade, count) {
  const g = Math.max(0, Math.round(num(grade)));
  const extra = Math.max(0, Math.round(num(count)) - g);
  return totalGradeKarma(R, g) + extra * R.metamagicKarma;
}
