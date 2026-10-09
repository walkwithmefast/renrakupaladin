// Martial arts (SR5 core p.148): a style costs martialArtKarma and comes with freeTechniques techniques
// of your choice from that style's list; each technique beyond that costs techniqueKarma.
import { num } from './data.js';

export const MARTIAL_ARTS_PAGE = 148;

/** Karma for one style, given how many techniques it currently has */
export const styleKarma = (R, techCount) => R.martialArtKarma + Math.max(0, num(techCount) - R.freeTechniques) * R.techniqueKarma;

export const totalMartialArtKarma = (R, styles) => (styles || []).reduce((s, st) => s + styleKarma(R, (st.techniques || []).length), 0);
