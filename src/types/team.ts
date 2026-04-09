import type { Position } from './player';

/** リーグ */
export type League = 'central' | 'pacific';

/** 球団タイプ */
export type TeamType =
  | 'moneyball' // 金満即戦力型
  | 'development' // 育成特化型
  | 'balanced' // バランス型
  | 'pitching' // 投手王国型
  | 'hitting' // 打撃特化型
  | 'rebuilding'; // 再建モード型

/** 球団AIパラメータ */
export interface TeamAI {
  /** 資金力 (0.0-1.0) */
  budgetMode: number;
  /** ドラフト・育成重視度 (0.0-1.0) */
  draftFocus: number;
  /** 即戦力・優勝優先度 (0.0-1.0) */
  winNowMode: number;
  /** 球団タイプ */
  teamType: TeamType;
  /** contender（優勝争い）か rebuilding（再建中）か */
  mode: 'contender' | 'rebuilding';
}

/** 施設 */
export interface Facilities {
  /** 練習施設 Lv.1-5 */
  training: number;
  /** ブルペン施設 Lv.1-5 */
  bullpen: number;
  /** リハビリ施設 Lv.1-5 */
  rehab: number;
  /** 球場 Lv.1-5 */
  stadium: number;
  /** スカウト拠点 Lv.1-5 */
  scoutBase: number;
  /** 寮 Lv.1-5 */
  dormitory: number;
}

/** 財務情報 */
export interface Finances {
  /** 資金（万円） */
  balance: number;
  /** チケット収入 */
  ticketRevenue: number;
  /** 放映権料 */
  broadcastRevenue: number;
  /** グッズ収入 */
  merchandiseRevenue: number;
  /** スポンサー収入 */
  sponsorRevenue: number;
  /** 選手年俸総額 */
  totalSalary: number;
  /** スタッフ給与 */
  staffSalary: number;
  /** 施設維持費 */
  facilityMaintenance: number;
  /** スカウト派遣費 */
  scoutExpense: number;
  /** 赤字連続年数 */
  consecutiveDeficitYears: number;
}

/** 先発ローテーション設定 */
export interface RotationSetting {
  /** 先発投手ID (6人) */
  starters: string[];
}

/** 打順設定 */
export interface LineupSetting {
  /** 打順 (1-9番の選手ID配列) */
  order: string[];
  /** 守備位置マッピング（選手ID → ポジション） */
  positions: Record<string, Position>;
  /** DH選手ID（パ・リーグのみ） */
  dhPlayerId: string | null;
}

/** 継投・起用設定 */
export interface BullpenSetting {
  /** 抑え投手ID */
  closerId: string | null;
  /** セットアッパーID (2人) */
  setupIds: string[];
  /** 代打の切り札ID */
  pinchHitterId: string | null;
  /** 代走の切り札ID */
  pinchRunnerId: string | null;
  /** 先発降板条件：スタミナ閾値 (%) */
  starterPullStamina: number;
  /** 抑え投入条件：点差 */
  closerEntryLeadMax: number;
}

/** チーム成績 */
export interface TeamRecord {
  wins: number;
  losses: number;
  draws: number;
  /** 得点合計 */
  runsScored: number;
  /** 失点合計 */
  runsAllowed: number;
}

/** バッテリー相性 */
export interface BatteryChemistry {
  /** 投手ID */
  pitcherId: string;
  /** 捕手ID */
  catcherId: string;
  /** 相性値 (0-100) */
  value: number;
}

/** 黄金期状態 */
export interface GoldenEra {
  /** 黄金期中か */
  isActive: boolean;
  /** 残り年数 */
  remainingYears: number;
}

/** 球団データ */
export interface Team {
  /** 球団ID */
  id: string;
  /** 球団名 */
  name: string;
  /** 略称 */
  shortName: string;
  /** リーグ */
  league: League;
  /** 本拠地球場名 */
  homeStadium: string;
  /** AIパラメータ */
  ai: TeamAI;
  /** 施設 */
  facilities: Facilities;
  /** 財務 */
  finances: Finances;
  /** 選手ID一覧 */
  playerIds: string[];
  /** 打順設定 */
  lineup: LineupSetting;
  /** ローテーション設定 */
  rotation: RotationSetting;
  /** 継投・起用設定 */
  bullpen: BullpenSetting;
  /** チーム成績 */
  record: TeamRecord;
  /** バッテリー相性リスト */
  batteryChemistry: BatteryChemistry[];
  /** 黄金期 */
  goldenEra: GoldenEra;
  /** プレイヤーが操作する球団か */
  isPlayerControlled: boolean;
}
