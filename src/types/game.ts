import type { Player } from './player';
import type { Team, TeamRecord } from './team';

/** ゲーム内日付 */
export interface GameDate {
  year: number;
  month: number;
  /** カード番号（シーズン内で何カード目か） */
  cardNumber: number;
}

/** シーズンフェーズ */
export type SeasonPhase =
  | 'camp' // キャンプ
  | 'preseason' // オープン戦
  | 'regularSeason' // レギュラーシーズン
  | 'allStar' // オールスター
  | 'cs' // クライマックスシリーズ
  | 'japanSeries' // 日本シリーズ
  | 'offseason'; // オフシーズン

/** オフシーズンの段階 */
export type OffseasonStep =
  | 'awards' // 表彰式
  | 'faDeclaration' // FA宣言
  | 'contractRenewal' // 契約更改
  | 'faNegotiation' // FA交渉
  | 'trade' // トレード
  | 'foreignScout' // 外国人スカウト結果
  | 'release' // 戦力外通告
  | 'draft' // ドラフト
  | 'freeAgentPickup' // 自由契約選手獲得
  | 'campPrep'; // キャンプ準備

/** 難易度 */
export type Difficulty = 'easy' | 'normal' | 'hard';

/** イベントの種類 */
export type GameEventType =
  | 'injury' // 怪我
  | 'recovery' // 復帰
  | 'faDeclaration' // FA宣言
  | 'slumpStart' // スランプ突入
  | 'slumpEnd' // スランプ脱出
  | 'awakening' // 覚醒
  | 'milestone' // マイルストーン
  | 'tradeOffer' // トレードオファー
  | 'scoutReport' // スカウト報告
  | 'facilityComplete' // 施設完成
  | 'rankChange' // 順位変動
  | 'retirement' // 引退
  | 'overseas' // 海外移籍
  | 'return' // 帰国
  | 'goldenEra'; // 黄金期

/** ゲームイベント */
export interface GameEvent {
  id: string;
  type: GameEventType;
  title: string;
  message: string;
  date: GameDate;
  /** 関連選手ID */
  playerId: string | null;
  /** 関連球団ID */
  teamId: string | null;
  /** 既読か */
  isRead: boolean;
}

/** 海外移籍中の選手 */
export interface OverseasPlayer {
  /** 元の選手データ */
  player: Player;
  /** 移籍元球団ID */
  originalTeamId: string;
  /** 海外滞在年数 */
  yearsOverseas: number;
  /** 活躍度 */
  performance: 'great' | 'average' | 'struggling';
}

/** 転生プールの選手 */
export interface ReincarnationEntry {
  /** 元の選手名 */
  name: string;
  /** 元のポジション */
  position: string;
  /** ポテンシャル上限 */
  potentialCap: number;
  /** 成長タイプの傾向（確率マップ） */
  growthTypeTendency: Record<string, number>;
  /** 特能候補（ID:取得確率） */
  abilityCandidates: Record<string, number>;
  /** レジェンドフラグ */
  isLegend: boolean;
}

/** タイトル記録 */
export interface TitleRecord {
  year: number;
  title: string;
  playerName: string;
  teamName: string;
  value: string;
}

/** 年度別チーム成績 */
export interface SeasonRecord {
  year: number;
  teamRecords: Record<string, TeamRecord & { rank: number }>;
  titles: TitleRecord[];
  champion: string;
  japanSeriesWinner: string | null;
}

/** セーブデータ構造 */
export interface GameState {
  /** データ形式バージョン */
  version: string;
  /** 保存日時 */
  savedAt: string;
  /** 乱数シード */
  seed: number;
  /** ゲーム内日付 */
  currentDate: GameDate;
  /** 現在のシーズンフェーズ */
  currentPhase: SeasonPhase;
  /** オフシーズンの段階 */
  offseasonStep: OffseasonStep | null;
  /** プレイヤーの球団ID */
  playerTeamId: string;
  /** GM名 */
  gmName: string;
  /** 難易度 */
  difficulty: Difficulty;
  /** 全12球団 */
  teams: Team[];
  /** 全選手 */
  players: Player[];
  /** 転生プール */
  reincarnationPool: ReincarnationEntry[];
  /** 海外移籍中の選手 */
  overseasPlayers: OverseasPlayer[];
  /** イベント（最新20件） */
  events: GameEvent[];
  /** 過去の年度別記録 */
  seasonRecords: SeasonRecord[];
  /** 殿堂入り選手 */
  hallOfFame: { name: string; inductionYear: number; career: string }[];
  /** 対戦カード */
  schedule: MatchCard[];
  /** 現在のカードインデックス */
  currentCardIndex: number;
}

/** 対戦カード */
export interface MatchCard {
  /** ホーム球団ID */
  homeTeamId: string;
  /** アウェイ球団ID */
  awayTeamId: string;
  /** カード番号 */
  cardNumber: number;
  /** 3試合の結果 */
  results: GameResult[];
  /** 消化済みか */
  isPlayed: boolean;
}

/** 試合結果 */
export interface GameResult {
  /** ホーム球団ID */
  homeTeamId: string;
  /** アウェイ球団ID */
  awayTeamId: string;
  /** イニングスコア */
  inningScores: { home: number; away: number }[];
  /** 勝利投手 */
  winningPitcher: { id: string; name: string } | null;
  /** 敗戦投手 */
  losingPitcher: { id: string; name: string } | null;
  /** セーブ投手 */
  savePitcher: { id: string; name: string } | null;
  /** 本塁打リスト */
  homeRuns: { playerId: string; playerName: string; teamId: string }[];
  /** ハイライトテキスト */
  highlights: string[];
  /** 各選手の成績概要 */
  playerSummaries: PlayerGameSummary[];
}

/** 選手の試合成績概要 */
export interface PlayerGameSummary {
  playerId: string;
  playerName: string;
  teamId: string;
  /** 打者成績 */
  batting: {
    atBats: number;
    hits: number;
    rbi: number;
    homeRuns: number;
    walks: number;
    strikeouts: number;
  } | null;
  /** 投手成績 */
  pitching: {
    inningsPitched: number;
    earnedRuns: number;
    strikeouts: number;
    walks: number;
    hitsAllowed: number;
  } | null;
}
