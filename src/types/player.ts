/** 守備ポジション */
export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'P' | 'DH';

/** 投手の役割 */
export type PitcherRole = 'starter' | 'reliever' | 'closer' | 'setup';

/** 利き手（投） */
export type ThrowHand = 'right' | 'left';

/** 利き手（打） */
export type BatHand = 'right' | 'left' | 'switch';

/** 成長タイプ */
export type GrowthType = 'early' | 'normal' | 'late' | 'unstable' | 'lateBloom';

/** 調子 */
export type Condition = 'excellent' | 'good' | 'normal' | 'bad' | 'terrible';

/** 変化球の種類 */
export type PitchType =
  | 'curve'
  | 'slider'
  | 'cutter'
  | 'fork'
  | 'changeup'
  | 'shoot'
  | 'sinker'
  | 'twoSeam'
  | 'splitter'
  | 'knuckleCurve'
  | 'palm'
  | 'knuckle';

/** 怪我の重さ */
export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'careerThreatening';

/** 出身区分 */
export type PlayerOrigin = 'highSchool' | 'college' | 'industrial' | 'independent';

/** 打者の能力値 */
export interface BatterStats {
  /** ミート (1-100) */
  meet: number;
  /** パワー (1-100) */
  power: number;
  /** 走力 (1-100) */
  speed: number;
  /** 守備 (1-100) */
  fielding: number;
  /** 肩 (1-100) */
  arm: number;
  /** 選球眼 (1-100) */
  eye: number;
}

/** 投手の能力値 */
export interface PitcherStats {
  /** 球威 (1-100) */
  velocity: number;
  /** 制球 (1-100) */
  control: number;
  /** 変化 (1-100) */
  breaking: number;
  /** スタミナ (1-100) */
  stamina: number;
}

/** 変化球データ */
export interface PitchData {
  type: PitchType;
  /** レベル (1-7) */
  level: number;
}

/** 怪我の状態 */
export interface InjuryState {
  /** 怪我しているか */
  isInjured: boolean;
  /** 怪我の種類名 */
  name: string;
  /** 重さ */
  severity: InjurySeverity;
  /** 残り離脱カード数 */
  remainingCards: number;
  /** トミージョン手術を受けたか */
  hadTommyJohn: boolean;
}

/** 契約情報 */
export interface Contract {
  /** 年俸（万円） */
  salary: number;
  /** 残り契約年数（0=単年, 1以上=複数年残り） */
  remainingYears: number;
  /** 約束 */
  promise: PlayerPromise | null;
  /** 約束を守ったか */
  promiseKept: boolean | null;
}

/** 約束の種類 */
export type PlayerPromise =
  | 'posting' // ポスティング容認
  | 'regularStarter' // レギュラー起用
  | 'closerRole' // 抑え起用
  | 'faAccept' // FA容認
  | 'salaryIncrease'; // 来年年俸UP

/** シーズン成績（打者） */
export interface BatterSeasonStats {
  games: number;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  stolenBases: number;
  caughtStealing: number;
  walks: number;
  strikeouts: number;
  sacrificeBunts: number;
  sacrificeFlies: number;
  hitByPitch: number;
}

/** シーズン成績（投手） */
export interface PitcherSeasonStats {
  games: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  inningsPitched: number;
  hitsAllowed: number;
  homeRunsAllowed: number;
  strikeouts: number;
  walks: number;
  earnedRuns: number;
}

/** 通算記録 */
export interface CareerStats {
  seasons: number;
  batterStats: BatterSeasonStats;
  pitcherStats: PitcherSeasonStats;
}

/** 覚醒の種類 */
export type AwakeningType = 'short' | 'medium' | 'permanent';

/** 覚醒状態 */
export interface AwakeningState {
  /** 覚醒ゲージ (0-100) */
  gauge: number;
  /** 現在覚醒中か */
  isAwakened: boolean;
  /** 覚醒タイプ */
  type: AwakeningType | null;
  /** 覚醒残り年数 */
  remainingYears: number;
}

/** スランプ状態 */
export interface SlumpState {
  /** スランプ中か */
  isInSlump: boolean;
  /** スランプ残りカード数 */
  remainingCards: number;
}

/** 選手データ */
export interface Player {
  /** 一意のID */
  id: string;
  /** 選手名 */
  name: string;
  /** 年齢 */
  age: number;
  /** 所属球団ID */
  teamId: string;
  /** メインポジション */
  position: Position;
  /** サブポジション（守備適性 0-100） */
  subPositions: Partial<Record<Position, number>>;
  /** 投手の役割 */
  pitcherRole: PitcherRole | null;
  /** 利き手（投） */
  throwHand: ThrowHand;
  /** 利き手（打） */
  batHand: BatHand;
  /** 打者能力値 */
  batterStats: BatterStats;
  /** 投手能力値（投手のみ） */
  pitcherStats: PitcherStats | null;
  /** 変化球リスト（投手のみ） */
  pitches: PitchData[];
  /** 成長タイプ */
  growthType: GrowthType;
  /** ポテンシャル上限（各パラメータの上限値） */
  potential: Partial<BatterStats> & Partial<PitcherStats>;
  /** 固有特能ID一覧 */
  uniqueAbilities: string[];
  /** 通常特能ID一覧 */
  normalAbilities: string[];
  /** 覚醒特能ID一覧 */
  awakeningAbilities: string[];
  /** 調子 */
  condition: Condition;
  /** 覚醒状態 */
  awakening: AwakeningState;
  /** スランプ状態 */
  slump: SlumpState;
  /** 怪我状態 */
  injury: InjuryState;
  /** 契約情報 */
  contract: Contract;
  /** 一軍登録中か */
  isFirstTeam: boolean;
  /** 育成選手か */
  isDevelopment: boolean;
  /** 外国人選手か */
  isForeign: boolean;
  /** 二刀流か */
  isTwoWay: boolean;
  /** レジェンドフラグ */
  isLegend: boolean;
  /** 一軍登録年数 */
  yearsInFirstTeam: number;
  /** プロ入り年数 */
  yearsAsPro: number;
  /** 出身 */
  origin: PlayerOrigin;
  /** 現シーズン打撃成績 */
  currentBatterStats: BatterSeasonStats;
  /** 現シーズン投手成績 */
  currentPitcherStats: PitcherSeasonStats;
  /** 通算記録 */
  careerStats: CareerStats;
  /** 降格後の再登録不可残りカード数 */
  demotionCooldown: number;
  /** 二軍連続在籍年数（塩漬けリスク用） */
  farmConsecutiveYears: number;
  /** 不満状態 */
  isDisgruntled: boolean;
  /** 海外帰り */
  isReturnedFromOverseas: boolean;
  /** 転生元の名前（転生選手の場合） */
  reincarnationSource: string | null;
}
