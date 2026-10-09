// Rule constants. Defaults follow the SR5 core book and the Chummer5a "Standard" settings profile.
export const DEFAULT_RULES = {
  buildKarma: 25,
  qualityKarmaLimit: 25,      // max karma from positive AND from negative qualities at creation
  karmaCarryover: 7,
  nuyenCarryover: 5000,
  nuyenPerKarma: 2000,
  maxKarmaToNuyen: 10,
  maxAvailCreate: 12,
  maxDeviceRatingCreate: 6,
  maxSkillCreate: 6,
  maxSkill: 12,
  maxNaturalAttrAtLimitCreate: 1,
  contactKarmaMult: 3,          // free contact karma = CHA * 3
  knowledgeMult: 2,             // free knowledge points = (INT + LOG) * 2
  carryMult: 10,
  liftMult: 15,
  attrKarma: 5,
  newSkillKarma: 2, improveSkillKarma: 2,
  newKnowKarma: 1, improveKnowKarma: 1,
  newGroupKarma: 5, improveGroupKarma: 5,
  specKarma: 7,
  spellKarma: 5,
  complexFormKarma: 4,
  contactKarma: 1,
  mysAdeptPPKarma: 5,
  initiationKarma: 3, initiationFlat: 10,
  metamagicKarma: 15,
  boundSpiritKarma: 1,
  martialArtKarma: 7, freeTechniques: 2, techniqueKarma: 5,
  bannedGrades: ['Betaware', 'Deltaware', 'Gammaware'],
  maxInitDice: 5,
};

export const PRIORITY_KEYS = ['heritage', 'talent', 'attributes', 'skills', 'resources'];
export const PRIORITY_LABEL = {
  heritage: 'Metatype', talent: 'Magic / Resonance', attributes: 'Attributes', skills: 'Skills', resources: 'Resources',
};
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const SKILL_CATEGORY_ORDER = [
  'Combat Active', 'Physical Active', 'Social Active', 'Magical Active', 'Pseudo-Magical Active',
  'Resonance Active', 'Technical Active', 'Vehicle Active',
];

/** Sum of per-level karma costs stepping from `from` up by `levels`: mult * (from+1 + ... + from+levels) */
export function stepCost(from, levels, mult) {
  let c = 0;
  for (let i = 1; i <= levels; i++) c += (from + i) * mult;
  return c;
}

export const WOUND_STEP = 3; // boxes per -1 wound modifier
