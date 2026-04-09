/** 特能のカテゴリ */
export type AbilityCategory = 'unique' | 'normal' | 'awakening';

/** 特能の対象 */
export type AbilityTarget = 'batter' | 'pitcher' | 'both';

/** 特能の定義 */
export interface SpecialAbility {
  /** 特能ID */
  id: string;
  /** 表示名 */
  name: string;
  /** 説明 */
  description: string;
  /** カテゴリ */
  category: AbilityCategory;
  /** 対象 */
  target: AbilityTarget;
}

// ========================================
// 固有特能
// ========================================

export const UNIQUE_ABILITIES = {
  geniusBatter: 'geniusBatter', // 天才打者
  powerArm: 'powerArm', // 豪腕
  ironArm: 'ironArm', // 鉄腕
  speedContact: 'speedContact', // 俊足巧打
  defenseMaster: 'defenseMaster', // 守備の達人
  precisionMachine: 'precisionMachine', // 精密機械
  twoWay: 'twoWay', // 二刀流
} as const;

// ========================================
// 通常特能（打者系）
// ========================================

export const BATTER_ABILITIES = {
  clutch1: 'clutch1', // チャンス○
  clutch2: 'clutch2', // チャンス◎
  antiLeft: 'antiLeft', // 対左○
  wideAngle: 'wideAngle', // 広角打法
  toughAtBat: 'toughAtBat', // 粘り打ち
  firstPitch: 'firstPitch', // 初球○
  basesLoaded: 'basesLoaded', // 満塁男
  walkoff: 'walkoff', // サヨナラ男
  stealing: 'stealing', // 盗塁○
  goodThrow: 'goodThrow', // 送球○
  moodMaker: 'moodMaker', // ムードメーカー
  clutchBad: 'clutchBad', // チャンス×
  moodBreaker: 'moodBreaker', // ムードブレイカー
} as const;

// ========================================
// 通常特能（投手系）
// ========================================

export const PITCHER_ABILITIES = {
  antiPinch1: 'antiPinch1', // 対ピンチ○
  antiPinch2: 'antiPinch2', // 対ピンチ◎
  escapeBall: 'escapeBall', // 逃げ球
  strikeoutArtist: 'strikeoutArtist', // 奪三振
  quickMotion: 'quickMotion', // クイック○
  resilient: 'resilient', // 打たれ強い
  lateInning: 'lateInning', // 尻上がり
  extraInning: 'extraInning', // 回またぎ○
  winLuck: 'winLuck', // 勝ち運
} as const;

// ========================================
// 覚醒特能
// ========================================

export const AWAKENING_ABILITIES = {
  superClutch: 'superClutch', // 超チャンス◎
  monsterPower: 'monsterPower', // 怪物球威
  zone: 'zone', // ゾーン
  indomitable: 'indomitable', // 不屈
  steelBody: 'steelBody', // 鋼の肉体
} as const;

/** 全特能IDの型 */
export type UniqueAbilityId = (typeof UNIQUE_ABILITIES)[keyof typeof UNIQUE_ABILITIES];
export type BatterAbilityId = (typeof BATTER_ABILITIES)[keyof typeof BATTER_ABILITIES];
export type PitcherAbilityId = (typeof PITCHER_ABILITIES)[keyof typeof PITCHER_ABILITIES];
export type AwakeningAbilityId = (typeof AWAKENING_ABILITIES)[keyof typeof AWAKENING_ABILITIES];
export type AbilityId = UniqueAbilityId | BatterAbilityId | PitcherAbilityId | AwakeningAbilityId;
