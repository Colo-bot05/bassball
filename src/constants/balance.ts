/**
 * ゲームバランスの定数
 * 仕様書の確率・補正値を集約
 */

// ========================================
// ロースター制限
// ========================================
export const MAX_ROSTER_SIZE = 70;
export const MAX_FIRST_TEAM_SIZE = 29;
export const MAX_FIRST_TEAM_PITCHERS = 15;
export const MAX_FIRST_TEAM_FIELDERS = 14;
export const MAX_FOREIGN_FIRST_TEAM = 4;
export const DEMOTION_COOLDOWN_CARDS = 4;

// ========================================
// シーズン設定
// ========================================
export const TOTAL_GAMES = 143;
export const GAMES_PER_CARD = 3;
export const TOTAL_CARDS = Math.ceil(TOTAL_GAMES / GAMES_PER_CARD);
export const LEAGUE_GAMES = 125;
export const INTERLEAGUE_GAMES = 18;
export const EXTENSION_INNINGS = 12;

// ========================================
// 調子遷移確率 (仕様書F-6)
// ========================================
export const CONDITION_TRANSITION = {
  excellent: { excellent: 0.20, good: 0.40, normal: 0.30, bad: 0.10, terrible: 0.00 },
  good:      { excellent: 0.15, good: 0.30, normal: 0.40, bad: 0.15, terrible: 0.00 },
  normal:    { excellent: 0.05, good: 0.25, normal: 0.40, bad: 0.25, terrible: 0.05 },
  bad:       { excellent: 0.00, good: 0.10, normal: 0.40, bad: 0.30, terrible: 0.20 },
  terrible:  { excellent: 0.00, good: 0.10, normal: 0.30, bad: 0.40, terrible: 0.20 },
} as const;

/** 調子が成績に与える補正 (仕様書P-6) */
export const CONDITION_MODIFIER = {
  excellent: 1.15,
  good: 1.07,
  normal: 1.00,
  bad: 0.92,
  terrible: 0.80,
} as const;

// ========================================
// 怪我 (仕様書P-2)
// ========================================
export const INJURY_BASE_RATE = 0.005;

export const INJURY_POSITION_MODIFIER = {
  starter: 1.5,
  reliever: 1.3,
  closer: 1.3,
  setup: 1.3,
  C: 1.2,
  default: 1.0,
} as const;

export const INJURY_AGE_MODIFIER = {
  under30: 1.0,
  over30: 1.3,
  over35: 1.8,
} as const;

export const INJURY_SEVERITY_RATES = {
  minor: 0.60,
  moderate: 0.30,
  severe: 0.08,
  careerThreatening: 0.02,
} as const;

export const INJURY_DURATION_CARDS = {
  minor: { min: 1, max: 2 },
  moderate: { min: 5, max: 15 },
  severe: { min: TOTAL_CARDS, max: TOTAL_CARDS },
  careerThreatening: { min: TOTAL_CARDS + 24, max: TOTAL_CARDS * 2 },
} as const;

export const TOMMY_JOHN_RATE = 0.30;
export const TOMMY_JOHN_SUCCESS_RATE = 0.70;
export const TOMMY_JOHN_LEGEND_SUCCESS_RATE = 0.85;

// ========================================
// 成長 (仕様書P-1, F-7)
// ========================================
export const GROWTH_CURVES = {
  early: {
    growth: [
      { ageMin: 18, ageMax: 20, min: 5, max: 8 },
      { ageMin: 21, ageMax: 24, min: 3, max: 5 },
      { ageMin: 25, ageMax: 27, min: 0, max: 2 },
    ],
    declineStart: 28,
    declineRange: { min: 2, max: 5 },
    retireRange: { min: 32, max: 35 },
  },
  normal: {
    growth: [
      { ageMin: 18, ageMax: 22, min: 2, max: 4 },
      { ageMin: 23, ageMax: 27, min: 4, max: 7 },
      { ageMin: 28, ageMax: 31, min: 0, max: 2 },
    ],
    declineStart: 32,
    declineRange: { min: 1, max: 4 },
    retireRange: { min: 35, max: 38 },
  },
  late: {
    growth: [
      { ageMin: 18, ageMax: 25, min: 1, max: 3 },
      { ageMin: 26, ageMax: 30, min: 3, max: 5 },
      { ageMin: 31, ageMax: 35, min: 0, max: 2 },
    ],
    declineStart: 36,
    declineRange: { min: 1, max: 3 },
    retireRange: { min: 37, max: 42 },
  },
  unstable: {
    growth: [
      { ageMin: 18, ageMax: 99, min: -3, max: 8 },
    ],
    declineStart: 30,
    declineRange: { min: 0, max: 6 },
    retireRange: { min: 33, max: 40 },
  },
  lateBloom: {
    growth: [
      { ageMin: 18, ageMax: 28, min: 1, max: 2 },
    ],
    awakeningAgeRange: { min: 29, max: 33 },
    awakeningChance: 0.50,
    awakeningBoost: { min: 15, max: 25 },
    postAwakeningYears: { min: 3, max: 5 },
    declineStart: 35,
    declineRange: { min: 1, max: 3 },
    retireRange: { min: 35, max: 40 },
  },
} as const;

// ========================================
// 覚醒 (仕様書P-3)
// ========================================
export const AWAKENING_TRIGGER_THRESHOLD = 100;
export const AWAKENING_FIRE_CHANCE = 0.40;
export const AWAKENING_RESET_VALUE = 50;

export const AWAKENING_TYPE_RATES = {
  short: 0.50,
  medium: 0.35,
  permanent: 0.15,
} as const;

export const AWAKENING_GAUGE_RATES = {
  slump: 5,
  severeInjury: 3,
  minorInjury: 1,
  normal: 0,
} as const;

export const AWAKENING_DURATION = {
  short: 1,
  medium: { min: 2, max: 5 },
  permanent: Infinity,
} as const;

// ========================================
// FA (仕様書P-4, I-1)
// ========================================
export const FA_DOMESTIC_YEARS = 8;
export const FA_DOMESTIC_YEARS_COLLEGE = 7;
export const FA_OVERSEAS_YEARS = 9;
export const FA_BASE_RETENTION_RATE = 0.50;

// ========================================
// 施設 (仕様書E-1, E-2)
// ========================================
export const FACILITY_UPGRADE_COST = [0, 50000, 100000, 200000, 400000] as const;

export const FACILITY_EFFECTS = {
  training: [0, 0, 0.05, 0.10, 0.15, 0.20],
  bullpen: [0, 0, 0.03, 0.06, 0.09, 0.12],
  rehab: [0, 0, 0.10, 0.20, 0.30, 0.40],
  stadium: [0, 25000, 30000, 35000, 40000, 45000],
  dormitory: [0, 0, 0.03, 0.05, 0.08, 0.10],
} as const;

// ========================================
// ドラフト (仕様書H-1, H-2)
// ========================================
export const DRAFT_CANDIDATES_RANGE = { min: 80, max: 120 };
export const DRAFT_REINCARNATION_RANGE = { min: 3, max: 7 };
export const DRAFT_GOOD_YEAR_CHANCE = 0.15;
export const DRAFT_GODLY_YEAR_CHANCE = 0.03;
export const DRAFT_MAX_ROUNDS = 8;

export const DRAFT_ORIGIN_RATES = {
  highSchool: 0.40,
  college: 0.35,
  industrial: 0.20,
  independent: 0.05,
} as const;

// ========================================
// 二軍 (仕様書C-2)
// ========================================
export const FARM_EXP_RATE = 0.70;
export const FARM_YOUNG_EXP_RATE = 1.00;
export const FARM_YOUNG_AGE_LIMIT = 25;
export const FARM_INJURY_RATE_MODIFIER = 0.50;
export const FARM_STALE_YEARS = 2;
export const FARM_STALE_GROWTH_PENALTY = 0.50;

// ========================================
// 黄金期 (仕様書P-5)
// ========================================
export const GOLDEN_ERA_TRIGGER_RATE = 0.30;
export const GOLDEN_ERA_DURATION = { min: 3, max: 5 };
export const GOLDEN_ERA_STAT_BOOST = 5;
export const GOLDEN_ERA_CONDITION_BOOST = 0.10;

// ========================================
// 試合シミュレーション (仕様書G-2〜G-4)
// ========================================
export const BATTING_FORMULA_WEIGHTS = {
  meet: 0.4,
  power: 0.3,
  eye: 0.3,
} as const;

export const PITCHING_FORMULA_WEIGHTS = {
  velocity: 0.35,
  control: 0.35,
  breaking: 0.30,
} as const;

export const HIT_RESULT_BY_POWER = {
  high:   { hr: 0.20, double: 0.25, single: 0.40, walk: 0.15 },
  mid:    { hr: 0.10, double: 0.20, single: 0.45, walk: 0.25 },
  low:    { hr: 0.05, double: 0.15, single: 0.50, walk: 0.30 },
  vlow:   { hr: 0.02, double: 0.10, single: 0.53, walk: 0.35 },
} as const;

export const OUT_RESULT_BY_VELOCITY = {
  high: { strikeout: 0.45, groundout: 0.30, flyout: 0.25 },
  mid:  { strikeout: 0.30, groundout: 0.40, flyout: 0.30 },
  low:  { strikeout: 0.20, groundout: 0.45, flyout: 0.35 },
} as const;

export const STAMINA_DECAY_PER_INNING = 10;
export const STAMINA_DECAY_PER_HIT = 3;

export const STAMINA_MODIFIER = {
  full: { min: 0.80, max: 1.00, modifier: 1.00 },
  tired: { min: 0.60, max: 0.79, modifier: 0.90 },
  exhausted: { min: 0.40, max: 0.59, modifier: 0.75 },
  gassed: { min: 0, max: 0.39, modifier: 0.60 },
} as const;

export const TRIPLE_UPGRADE_CHANCE = 0.10;
export const TRIPLE_SPEED_THRESHOLD = 70;
export const HBP_RATE = 0.01;
export const SAME_SIDE_PENALTY = 0.05;

export const STEAL_BASE_SPEED_THRESHOLD = 65;
export const STEAL_ATTEMPT_RATE = 0.05;
export const STEAL_SPECIALIST_ATTEMPT_RATE = 0.15;

// ========================================
// 難易度補正 (仕様書N-4)
// ========================================
export const DIFFICULTY_MODIFIERS = {
  easy: {
    growthMultiplier: 1.2,
    injuryMultiplier: 0.7,
    goldenEra: false,
  },
  normal: {
    growthMultiplier: 1.0,
    injuryMultiplier: 1.0,
    goldenEra: true,
  },
  hard: {
    growthMultiplier: 1.0,
    injuryMultiplier: 1.0,
    goldenEra: true,
  },
} as const;

// ========================================
// 二刀流 (補足1)
// ========================================
export const TWO_WAY_GROWTH_RATE = 0.80;
export const TWO_WAY_REINCARNATION_CHANCE = 0.05;
