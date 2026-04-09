/**
 * やきゅつく令和版 - 試合シミュレーションエンジン
 *
 * 仕様書 G-2〜G-8 に基づく打席解決・継投・代打代走・盗塁を含む
 * フルイニングシミュレーション
 */

import type { Player } from '@/types/player';
import type { Team, BullpenSetting } from '@/types/team';
import type { GameResult, PlayerGameSummary } from '@/types/game';
import { random, chance, randomWeighted } from '@/utils/random';
import {
  BATTING_FORMULA_WEIGHTS,
  PITCHING_FORMULA_WEIGHTS,
  CONDITION_MODIFIER,
  HIT_RESULT_BY_POWER,
  OUT_RESULT_BY_VELOCITY,
  STAMINA_DECAY_PER_INNING,
  STAMINA_DECAY_PER_HIT,
  EXTENSION_INNINGS,
  TRIPLE_UPGRADE_CHANCE,
  TRIPLE_SPEED_THRESHOLD,
  HBP_RATE,
  SAME_SIDE_PENALTY,
  STEAL_BASE_SPEED_THRESHOLD,
  STEAL_ATTEMPT_RATE,
  STEAL_SPECIALIST_ATTEMPT_RATE,
} from '@/constants/balance';

// ============================================================
// 内部型定義
// ============================================================

/** 打席結果の種類 */
type AtBatOutcome =
  | 'homerun'
  | 'triple'
  | 'double'
  | 'single'
  | 'walk'
  | 'hbp'
  | 'strikeout'
  | 'groundout'
  | 'flyout'
  | 'error';

/** 塁上の走者状態（簡易モデル） */
interface BaseRunners {
  /** 一塁走者の選手ID（null = 空） */
  first: string | null;
  /** 二塁走者の選手ID（null = 空） */
  second: string | null;
  /** 三塁走者の選手ID（null = 空） */
  third: string | null;
}

/** 投手のゲーム内状態 */
interface PitcherGameState {
  playerId: string;
  currentStamina: number;
  maxStamina: number;
  hitsAllowed: number;
  runsAllowed: number;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  inningsPitched: number;
  /** このイニングで許したヒット数（スタミナ消耗計算用） */
  hitsThisInning: number;
  /** 失点を許した時点でのイニング（勝敗判定用） */
  entryInning: number;
  /** 責任走者数（自責点計算用） */
  responsibleRunners: number;
}

/** チームのゲーム内状態 */
interface TeamGameState {
  teamId: string;
  team: Team;
  lineup: string[];
  positions: Record<string, string>;
  currentBatterIndex: number;
  currentPitcher: PitcherGameState;
  pitcherHistory: PitcherGameState[];
  usedPitchers: Set<string>;
  usedPinchHitters: Set<string>;
  score: number;
  hits: number;
}

/** 選手のゲーム内打撃成績 */
interface BattingLine {
  atBats: number;
  hits: number;
  rbi: number;
  homeRuns: number;
  walks: number;
  strikeouts: number;
}

/** 選手のゲーム内投手成績 */
interface PitchingLine {
  inningsPitched: number;
  earnedRuns: number;
  strikeouts: number;
  walks: number;
  hitsAllowed: number;
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 選手IDから選手データを取得する
 * @param playerId - 選手ID
 * @param allPlayers - 全選手配列
 * @returns 見つかった選手。見つからなければ undefined
 */
function findPlayer(playerId: string, allPlayers: Player[]): Player | undefined {
  return allPlayers.find((p) => p.id === playerId);
}

/**
 * 特能を持っているか判定する
 * @param player - 選手
 * @param abilityId - 特能ID
 * @returns 保持していれば true
 */
function hasAbility(player: Player, abilityId: string): boolean {
  return (
    player.normalAbilities.includes(abilityId) ||
    player.uniqueAbilities.includes(abilityId) ||
    player.awakeningAbilities.includes(abilityId)
  );
}

/**
 * パワーティアを取得する（打者のパワー値に基づく）
 * @param power - パワー値(1-100)
 * @returns high | mid | low | vlow
 */
function getPowerTier(power: number): 'high' | 'mid' | 'low' | 'vlow' {
  if (power >= 80) return 'high';
  if (power >= 60) return 'mid';
  if (power >= 40) return 'low';
  return 'vlow';
}

/**
 * 球威ティアを取得する（投手の球威値に基づく）
 * @param velocity - 球威値(1-100)
 * @returns high | mid | low
 */
function getVelocityTier(velocity: number): 'high' | 'mid' | 'low' {
  if (velocity >= 80) return 'high';
  if (velocity >= 60) return 'mid';
  return 'low';
}

/**
 * スタミナ残量から投球パワー補正を計算する（仕様書G-5）
 * @param currentStamina - 現在のスタミナ
 * @param maxStamina - 最大スタミナ
 * @returns スタミナ補正値(0.6〜1.0)
 */
function getStaminaModifier(currentStamina: number, maxStamina: number): number {
  if (maxStamina <= 0) return 0.6;
  const ratio = currentStamina / maxStamina;
  if (ratio >= 0.80) return 1.0;
  if (ratio >= 0.60) return 0.9;
  if (ratio >= 0.40) return 0.75;
  return 0.6;
}

/**
 * バッテリー相性補正を取得する
 * @param team - チームデータ
 * @param pitcherId - 投手ID
 * @param catcherId - 捕手ID
 * @returns 相性補正値（0.95〜1.10程度）
 */
function getBatteryChemistryModifier(
  team: Team,
  pitcherId: string,
  catcherId: string,
): number {
  const chemistry = team.batteryChemistry.find(
    (bc) => bc.pitcherId === pitcherId && bc.catcherId === catcherId,
  );
  if (!chemistry) return 1.0;
  // 相性値 0-100 を 0.95-1.10 の補正に変換
  return 0.95 + (chemistry.value / 100) * 0.15;
}

/**
 * 守備ラインナップから捕手IDを取得する
 * @param positions - ポジションマッピング
 * @returns 捕手の選手ID、見つからない場合は null
 */
function findCatcherId(positions: Record<string, string>): string | null {
  for (const [playerId, pos] of Object.entries(positions)) {
    if (pos === 'C') return playerId;
  }
  return null;
}

/**
 * 得点圏に走者がいるか判定する
 * @param bases - 塁上走者
 * @returns 二塁または三塁に走者がいれば true
 */
function hasRunnersInScoringPosition(bases: BaseRunners): boolean {
  return bases.second !== null || bases.third !== null;
}

/**
 * 満塁か判定する
 * @param bases - 塁上走者
 * @returns 全塁に走者がいれば true
 */
function isBasesLoaded(bases: BaseRunners): boolean {
  return bases.first !== null && bases.second !== null && bases.third !== null;
}

/**
 * 塁上の走者数を返す
 * @param bases - 塁上走者
 * @returns 走者数(0-3)
 */
function countRunners(bases: BaseRunners): number {
  let count = 0;
  if (bases.first !== null) count++;
  if (bases.second !== null) count++;
  if (bases.third !== null) count++;
  return count;
}

// ============================================================
// コア計算関数（エクスポート）
// ============================================================

/**
 * 打者パワーを計算する（仕様書G-2 ステップ1）
 *
 * batterPower = (meet * 0.4 + power * 0.3 + eye * 0.3)
 *               * conditionModifier * abilityBonus * handednessModifier
 *
 * @param batter - 打者の選手データ
 * @param pitcher - 対戦投手の選手データ
 * @param context - 打席の状況コンテキスト
 * @returns 計算された打者パワー値
 */
export function calculateBatterPower(
  batter: Player,
  pitcher: Player,
  context: {
    runnersInScoringPosition: boolean;
    basesLoaded: boolean;
    inning: number;
    scoreDiff: number;
    isBottom: boolean;
  },
): number {
  const stats = batter.batterStats;

  // 基本値
  let basePower =
    stats.meet * BATTING_FORMULA_WEIGHTS.meet +
    stats.power * BATTING_FORMULA_WEIGHTS.power +
    stats.eye * BATTING_FORMULA_WEIGHTS.eye;

  // 調子補正
  const condMod = CONDITION_MODIFIER[batter.condition];
  basePower *= condMod;

  // --- 特能ボーナス ---
  let abilityBonus = 0;

  // 天才打者: ミート+10相当
  if (hasAbility(batter, 'geniusBatter')) {
    abilityBonus += 10 * BATTING_FORMULA_WEIGHTS.meet;
  }

  // 俊足巧打: ミート+5相当
  if (hasAbility(batter, 'speedContact')) {
    abilityBonus += 5 * BATTING_FORMULA_WEIGHTS.meet;
  }

  // チャンス○: 得点圏+5
  if (context.runnersInScoringPosition && hasAbility(batter, 'clutch1')) {
    abilityBonus += 5;
  }

  // チャンス◎: 得点圏+10
  if (context.runnersInScoringPosition && hasAbility(batter, 'clutch2')) {
    abilityBonus += 10;
  }

  // チャンス×: 得点圏-5
  if (context.runnersInScoringPosition && hasAbility(batter, 'clutchBad')) {
    abilityBonus -= 5;
  }

  // 超チャンス◎（覚醒特能）: 得点圏+20
  if (context.runnersInScoringPosition && hasAbility(batter, 'superClutch')) {
    abilityBonus += 20;
  }

  // 満塁男: 満塁時+15
  if (context.basesLoaded && hasAbility(batter, 'basesLoaded')) {
    abilityBonus += 15;
  }

  // サヨナラ男: 9回以降の僅差で+10
  if (
    context.inning >= 9 &&
    context.isBottom &&
    Math.abs(context.scoreDiff) <= 2 &&
    hasAbility(batter, 'walkoff')
  ) {
    abilityBonus += 10;
  }

  // 対左○: 左投手相手に+5
  if (pitcher.throwHand === 'left' && hasAbility(batter, 'antiLeft')) {
    abilityBonus += 5;
  }

  // ゾーン（覚醒特能）: 全打撃+10
  if (hasAbility(batter, 'zone')) {
    abilityBonus += 10;
  }

  basePower += abilityBonus;

  // --- 利き手補正 ---
  // 同じ利き手 (右投vs右打、左投vs左打) はペナルティ
  // スイッチヒッターは常にペナルティなし
  let handednessModifier = 1.0;
  if (batter.batHand !== 'switch') {
    const sameSide =
      (pitcher.throwHand === 'right' && batter.batHand === 'right') ||
      (pitcher.throwHand === 'left' && batter.batHand === 'left');
    if (sameSide) {
      handednessModifier = 1.0 - SAME_SIDE_PENALTY;
    }
  }

  basePower *= handednessModifier;

  return Math.max(basePower, 1);
}

/**
 * 投手パワーを計算する（仕様書G-2 ステップ2）
 *
 * pitcherPower = (velocity * 0.35 + control * 0.35 + breaking * 0.30)
 *                * conditionModifier * abilityBonus * staminaModifier * batteryChemistryModifier
 *
 * @param pitcher - 投手の選手データ
 * @param pitcherState - 投手のゲーム内状態
 * @param defensiveTeam - 守備側チーム
 * @param context - 投球状況コンテキスト
 * @returns 計算された投手パワー値
 */
export function calculatePitcherPower(
  pitcher: Player,
  pitcherState: PitcherGameState,
  defensiveTeam: Team,
  context: {
    runnersInScoringPosition: boolean;
    inning: number;
    catcherId: string | null;
  },
): number {
  const stats = pitcher.pitcherStats;
  if (!stats) return 1;

  // 基本値
  let basePower =
    stats.velocity * PITCHING_FORMULA_WEIGHTS.velocity +
    stats.control * PITCHING_FORMULA_WEIGHTS.control +
    stats.breaking * PITCHING_FORMULA_WEIGHTS.breaking;

  // 調子補正
  const condMod = CONDITION_MODIFIER[pitcher.condition];
  basePower *= condMod;

  // --- 特能ボーナス ---
  let abilityBonus = 0;

  // 豪腕: 球威+10相当
  if (hasAbility(pitcher, 'powerArm')) {
    abilityBonus += 10 * PITCHING_FORMULA_WEIGHTS.velocity;
  }

  // 精密機械: 制球+10相当
  if (hasAbility(pitcher, 'precisionMachine')) {
    abilityBonus += 10 * PITCHING_FORMULA_WEIGHTS.control;
  }

  // 怪物球威（覚醒特能）: 球威+15相当
  if (hasAbility(pitcher, 'monsterPower')) {
    abilityBonus += 15 * PITCHING_FORMULA_WEIGHTS.velocity;
  }

  // 対ピンチ○: 得点圏走者時+5
  if (context.runnersInScoringPosition && hasAbility(pitcher, 'antiPinch1')) {
    abilityBonus += 5;
  }

  // 対ピンチ◎: 得点圏走者時+10
  if (context.runnersInScoringPosition && hasAbility(pitcher, 'antiPinch2')) {
    abilityBonus += 10;
  }

  // 尻上がり: 7回以降+5
  if (context.inning >= 7 && hasAbility(pitcher, 'lateInning')) {
    abilityBonus += 5;
  }

  basePower += abilityBonus;

  // --- スタミナ補正（仕様書G-5） ---
  const staminaMod = getStaminaModifier(
    pitcherState.currentStamina,
    pitcherState.maxStamina,
  );
  basePower *= staminaMod;

  // --- バッテリー相性補正 ---
  const catcherId = context.catcherId;
  if (catcherId) {
    const chemMod = getBatteryChemistryModifier(defensiveTeam, pitcher.id, catcherId);
    basePower *= chemMod;
  }

  return Math.max(basePower, 1);
}

/**
 * 打席を解決する（仕様書G-2〜G-4）
 *
 * 1. 死球判定（HBP_RATE）
 * 2. 打者アドバンテージ = batterPower / (batterPower + pitcherPower) * 100
 * 3. 乱数判定 → 打者勝利 or 投手勝利
 * 4. 打者勝利時：ヒット種別をパワーティアに基づき決定
 * 5. 投手勝利時：アウト種別を球威ティアに基づき決定
 *
 * @param batter - 打者
 * @param pitcher - 投手
 * @param pitcherState - 投手のゲーム内状態
 * @param defensiveTeam - 守備側チーム
 * @param fieldingAvg - 守備側チームの平均守備力
 * @param context - 打席の状況
 * @returns 打席結果
 */
export function resolveAtBat(
  batter: Player,
  pitcher: Player,
  pitcherState: PitcherGameState,
  defensiveTeam: Team,
  fieldingAvg: number,
  context: {
    runnersInScoringPosition: boolean;
    basesLoaded: boolean;
    inning: number;
    scoreDiff: number;
    isBottom: boolean;
    catcherId: string | null;
  },
): AtBatOutcome {
  // --- 死球判定 ---
  if (chance(HBP_RATE)) {
    return 'hbp';
  }

  // --- パワー計算 ---
  const batterPower = calculateBatterPower(batter, pitcher, context);
  const pitcherPower = calculatePitcherPower(pitcher, pitcherState, defensiveTeam, {
    runnersInScoringPosition: context.runnersInScoringPosition,
    inning: context.inning,
    catcherId: context.catcherId,
  });

  // --- アドバンテージ判定 ---
  const advantage = (batterPower / (batterPower + pitcherPower)) * 100;
  const roll = random() * 100;

  if (roll <= advantage) {
    // ========== 打者勝利（ヒット/四球） ==========
    const powerTier = getPowerTier(batter.batterStats.power);
    const hitTable = HIT_RESULT_BY_POWER[powerTier];

    // 逃げ球: HR確率低下 → HR分をsingleに回す
    const adjustedTable: Record<string, number> = { ...hitTable };
    if (hasAbility(pitcher, 'escapeBall')) {
      const reduction = adjustedTable.hr * 0.3;
      adjustedTable.hr -= reduction;
      adjustedTable.single += reduction;
    }

    const hitResult = randomWeighted(adjustedTable as Record<string, number>) as
      | 'hr'
      | 'double'
      | 'single'
      | 'walk';

    if (hitResult === 'hr') return 'homerun';
    if (hitResult === 'walk') return 'walk';

    if (hitResult === 'double') {
      // 三塁打への昇格判定（仕様書G-3）
      if (
        batter.batterStats.speed >= TRIPLE_SPEED_THRESHOLD &&
        chance(TRIPLE_UPGRADE_CHANCE)
      ) {
        return 'triple';
      }
      // 広角打法: 二塁打が三塁打に昇格しやすい
      if (
        hasAbility(batter, 'wideAngle') &&
        batter.batterStats.speed >= TRIPLE_SPEED_THRESHOLD - 10 &&
        chance(TRIPLE_UPGRADE_CHANCE * 1.5)
      ) {
        return 'triple';
      }
      return 'double';
    }

    return 'single';
  } else {
    // ========== 投手勝利（アウト） ==========
    const velocity = pitcher.pitcherStats?.velocity ?? 50;
    const velocityTier = getVelocityTier(velocity);
    const outTable: Record<string, number> = { ...OUT_RESULT_BY_VELOCITY[velocityTier] };

    // 奪三振: 三振率+10%（相対的に増加）
    if (hasAbility(pitcher, 'strikeoutArtist')) {
      const boost = outTable.strikeout * 0.10;
      outTable.strikeout += boost;
      outTable.groundout -= boost * 0.5;
      outTable.flyout -= boost * 0.5;
    }

    // 粘り打ち: 三振率低下
    if (hasAbility(batter, 'toughAtBat')) {
      const reduction = outTable.strikeout * 0.15;
      outTable.strikeout -= reduction;
      outTable.groundout += reduction * 0.5;
      outTable.flyout += reduction * 0.5;
    }

    const outResult = randomWeighted(outTable as Record<string, number>) as
      | 'strikeout'
      | 'groundout'
      | 'flyout';

    if (outResult === 'strikeout') return 'strikeout';

    if (outResult === 'groundout') {
      // --- エラー判定（仕様書G-4） ---
      let errorRate = (100 - fieldingAvg) * 0.003;

      // 守備の達人（守備側）: エラー率半減
      // ここでは守備チーム全体の特能は考慮しない（個別判定は省略）
      // 守備の達人を持つ選手がラインナップにいれば半減
      if (hasAbility(pitcher, 'defenseMaster')) {
        errorRate *= 0.5;
      }

      if (chance(errorRate)) {
        return 'error';
      }
      return 'groundout';
    }

    return 'flyout';
  }
}

// ============================================================
// 塁上走者の進塁処理
// ============================================================

/**
 * 打席結果に基づいて走者を進塁させ、得点を計算する
 * @param outcome - 打席結果
 * @param bases - 現在の塁上走者
 * @param batterId - 打者のID
 * @returns 得点数と新しい塁上状態
 */
function advanceRunners(
  outcome: AtBatOutcome,
  bases: BaseRunners,
  batterId: string,
): { runsScored: number; newBases: BaseRunners } {
  let runsScored = 0;
  let newBases: BaseRunners = { first: null, second: null, third: null };

  switch (outcome) {
    case 'homerun': {
      // 全走者 + 打者が得点
      runsScored = 1; // 打者自身
      if (bases.first !== null) runsScored++;
      if (bases.second !== null) runsScored++;
      if (bases.third !== null) runsScored++;
      newBases = { first: null, second: null, third: null };
      break;
    }
    case 'triple': {
      // 全走者が得点、打者は三塁
      if (bases.first !== null) runsScored++;
      if (bases.second !== null) runsScored++;
      if (bases.third !== null) runsScored++;
      newBases = { first: null, second: null, third: batterId };
      break;
    }
    case 'double': {
      // 三塁走者・二塁走者が得点、一塁走者は三塁、打者は二塁
      if (bases.third !== null) runsScored++;
      if (bases.second !== null) runsScored++;
      newBases = {
        first: null,
        second: batterId,
        third: bases.first,
      };
      // 一塁走者が速い場合は得点の可能性もあるが、簡易モデルでは三塁進塁
      break;
    }
    case 'single': {
      // 三塁走者が得点、二塁走者は三塁（または得点: 50%）、
      // 一塁走者は二塁、打者は一塁
      if (bases.third !== null) runsScored++;
      if (bases.second !== null) {
        // 二塁走者はシングルヒットで得点するか三塁止まりか
        if (chance(0.6)) {
          runsScored++;
          newBases.third = null;
        } else {
          newBases.third = bases.second;
        }
      }
      newBases.second = bases.first;
      newBases.first = batterId;
      break;
    }
    case 'walk':
    case 'hbp': {
      // 押し出しチェック
      if (bases.first !== null && bases.second !== null && bases.third !== null) {
        // 満塁 → 押し出し
        runsScored++;
        newBases = {
          first: batterId,
          second: bases.first,
          third: bases.second,
        };
      } else if (bases.first !== null && bases.second !== null) {
        // 一二塁
        newBases = {
          first: batterId,
          second: bases.first,
          third: bases.second,
        };
      } else if (bases.first !== null) {
        // 一塁のみ
        newBases = {
          first: batterId,
          second: bases.first,
          third: bases.third,
        };
      } else {
        // 走者なし or 二塁/三塁のみ
        newBases = {
          first: batterId,
          second: bases.second,
          third: bases.third,
        };
      }
      break;
    }
    case 'error': {
      // エラー: 単打相当の進塁
      if (bases.third !== null) runsScored++;
      if (bases.second !== null) {
        if (chance(0.5)) {
          runsScored++;
        } else {
          newBases.third = bases.second;
        }
      }
      newBases.second = bases.first;
      newBases.first = batterId;
      break;
    }
    case 'groundout': {
      // ゴロアウト: 三塁走者がタッチアップ（犠飛的動き）はしない
      // 併殺の可能性（一塁走者がいる場合）
      if (bases.first !== null && bases.second === null && chance(0.4)) {
        // 併殺（ダブルプレー）: 一塁走者アウト、各走者据え置き
        newBases = { first: null, second: null, third: bases.third };
        // 三塁走者は得点
        if (bases.third !== null) {
          runsScored++;
          newBases.third = null;
        }
      } else {
        // 通常のゴロアウト
        // 三塁走者は得点機会なし（内野ゴロ）
        // ただし走者は1つずつ進塁できる可能性（簡易: 進塁しない）
        newBases = {
          first: bases.first,
          second: bases.second,
          third: bases.third,
        };
        // 一塁走者がいれば二塁へ（フォースプレイで打者アウト後）
        if (bases.first !== null) {
          newBases.second = bases.first;
          newBases.first = null;
          if (bases.second !== null) {
            newBases.third = bases.second;
          }
          if (bases.third !== null) {
            runsScored++;
            newBases.third = newBases.third === bases.second ? bases.second : null;
          }
        }
      }
      break;
    }
    case 'flyout': {
      // フライアウト: 三塁走者がいればタッチアップで得点の可能性
      newBases = {
        first: bases.first,
        second: bases.second,
        third: bases.third,
      };
      if (bases.third !== null && countRunners(bases) <= 2) {
        // 犠牲フライ: 50%の確率
        if (chance(0.5)) {
          runsScored++;
          newBases.third = null;
        }
      }
      break;
    }
    case 'strikeout': {
      // 三振: 走者は動かない
      newBases = { ...bases };
      break;
    }
  }

  return { runsScored, newBases };
}

// ============================================================
// 盗塁処理（仕様書G-8）
// ============================================================

/**
 * 盗塁を試みるか判定し、結果を返す
 * @param runner - 走者の選手データ
 * @param pitcher - 投手の選手データ
 * @param catcherArm - 捕手の肩力
 * @returns 盗塁成功なら true、試行しなかった場合は null
 */
function attemptSteal(
  runner: Player,
  pitcher: Player,
  catcherArm: number,
): boolean | null {
  // 走力が閾値未満なら試行しない
  if (runner.batterStats.speed < STEAL_BASE_SPEED_THRESHOLD) return null;

  // 試行率の決定
  const attemptRate = hasAbility(runner, 'stealing')
    ? STEAL_SPECIALIST_ATTEMPT_RATE
    : STEAL_ATTEMPT_RATE;

  if (!chance(attemptRate)) return null;

  // 成功率計算
  let successRate =
    (runner.batterStats.speed * 0.6 + (100 - catcherArm) * 0.4) / 100;

  // 盗塁○: 成功率+15%
  if (hasAbility(runner, 'stealing')) {
    successRate += 0.15;
  }

  // クイック○: 盗塁成功率低下
  if (hasAbility(pitcher, 'quickMotion')) {
    successRate -= 0.10;
  }

  successRate = Math.max(0, Math.min(1, successRate));

  return chance(successRate);
}

// ============================================================
// 継投判断（仕様書G-6）
// ============================================================

/**
 * 投手交代が必要か判定する
 * @param state - 現在の投手状態
 * @param pitcher - 投手の選手データ
 * @param inning - 現在のイニング（1始まり）
 * @param teamScore - 自チームの得点
 * @param opponentScore - 相手チームの得点
 * @param bullpen - ブルペン設定
 * @returns 交代すべきか
 */
function shouldChangePitcher(
  state: PitcherGameState,
  pitcher: Player,
  inning: number,
  teamScore: number,
  opponentScore: number,
  _bullpen: BullpenSetting, // eslint-disable-line @typescript-eslint/no-unused-vars
): { shouldChange: boolean; useCloser: boolean } {
  const staminaRatio = state.maxStamina > 0
    ? state.currentStamina / state.maxStamina
    : 0;
  const leadAmount = teamScore - opponentScore;
  const role = pitcher.pitcherRole;

  // 先発投手の交代条件（仕様書G-6）
  if (role === 'starter') {
    // スタミナが40%以下
    if (staminaRatio <= 0.40) {
      return { shouldChange: true, useCloser: false };
    }
    // 6回終了時にリード3点以内
    if (inning >= 7 && leadAmount > 0 && leadAmount <= 3) {
      return { shouldChange: true, useCloser: false };
    }
    // 5失点以上
    if (state.runsAllowed >= 5) {
      return { shouldChange: true, useCloser: false };
    }
    return { shouldChange: false, useCloser: false };
  }

  // 中継ぎ → クローザー交代条件（仕様書G-6）
  if (role === 'reliever' || role === 'setup') {
    // 8回終了時にリード3点以内ならクローザー投入
    if (inning >= 9 && leadAmount > 0 && leadAmount <= 3) {
      return { shouldChange: true, useCloser: true };
    }
    // 中継ぎのスタミナ切れ
    if (staminaRatio <= 0.30) {
      return { shouldChange: true, useCloser: false };
    }
    return { shouldChange: false, useCloser: false };
  }

  // クローザーは交代しない（基本的に）
  return { shouldChange: false, useCloser: false };
}

// ============================================================
// チーム状態初期化
// ============================================================

/**
 * チームのゲーム内状態を初期化する
 * @param team - チームデータ
 * @param allPlayers - 全選手配列
 * @param startingPitcherId - 先発投手ID
 * @returns 初期化されたチームゲーム状態
 */
function initTeamState(
  team: Team,
  allPlayers: Player[],
  startingPitcherId: string,
): TeamGameState {
  const pitcher = findPlayer(startingPitcherId, allPlayers);
  const maxStamina = pitcher?.pitcherStats?.stamina ?? 60;

  const pitcherState: PitcherGameState = {
    playerId: startingPitcherId,
    currentStamina: maxStamina,
    maxStamina,
    hitsAllowed: 0,
    runsAllowed: 0,
    earnedRuns: 0,
    strikeouts: 0,
    walks: 0,
    inningsPitched: 0,
    hitsThisInning: 0,
    entryInning: 1,
    responsibleRunners: 0,
  };

  return {
    teamId: team.id,
    team,
    lineup: [...team.lineup.order],
    positions: { ...team.lineup.positions },
    currentBatterIndex: 0,
    currentPitcher: pitcherState,
    pitcherHistory: [],
    usedPitchers: new Set([startingPitcherId]),
    usedPinchHitters: new Set(),
    score: 0,
    hits: 0,
  };
}

/**
 * 先発投手を選択する（ローテーションの先頭を使用）
 * @param team - チームデータ
 * @param allPlayers - 全選手配列
 * @returns 先発投手のID
 */
function selectStartingPitcher(team: Team, allPlayers: Player[]): string {
  // ローテーションから利用可能な投手を選ぶ
  for (const pitcherId of team.rotation.starters) {
    const p = findPlayer(pitcherId, allPlayers);
    if (p && !p.injury.isInjured) {
      return pitcherId;
    }
  }
  // フォールバック: チーム内の先発投手を探す
  for (const pid of team.playerIds) {
    const p = findPlayer(pid, allPlayers);
    if (p && p.pitcherRole === 'starter' && !p.injury.isInjured && p.isFirstTeam) {
      return pid;
    }
  }
  // 最終手段: 誰でもいいので投手を返す
  for (const pid of team.playerIds) {
    const p = findPlayer(pid, allPlayers);
    if (p && p.pitcherStats && !p.injury.isInjured && p.isFirstTeam) {
      return pid;
    }
  }
  return team.playerIds[0];
}

// ============================================================
// 継投・代打処理
// ============================================================

/**
 * 次の中継ぎ/クローザー投手を選択して交代する
 * @param teamState - チーム状態
 * @param allPlayers - 全選手配列
 * @param useCloser - クローザーを使うか
 * @param inning - 現在のイニング
 * @returns 交代が行われたか
 */
function changePitcher(
  teamState: TeamGameState,
  allPlayers: Player[],
  useCloser: boolean,
  inning: number,
): boolean {
  const bullpen = teamState.team.bullpen;

  // 現在の投手を履歴に保存
  teamState.pitcherHistory.push({ ...teamState.currentPitcher });

  let newPitcherId: string | null = null;

  if (useCloser && bullpen.closerId) {
    const closer = findPlayer(bullpen.closerId, allPlayers);
    if (
      closer &&
      !closer.injury.isInjured &&
      !teamState.usedPitchers.has(bullpen.closerId)
    ) {
      newPitcherId = bullpen.closerId;
    }
  }

  if (!newPitcherId) {
    // セットアッパーを試す
    for (const setupId of bullpen.setupIds) {
      if (!teamState.usedPitchers.has(setupId)) {
        const p = findPlayer(setupId, allPlayers);
        if (p && !p.injury.isInjured) {
          newPitcherId = setupId;
          break;
        }
      }
    }
  }

  if (!newPitcherId) {
    // 残りの中継ぎ投手を探す
    for (const pid of teamState.team.playerIds) {
      if (teamState.usedPitchers.has(pid)) continue;
      const p = findPlayer(pid, allPlayers);
      if (
        p &&
        p.pitcherStats &&
        (p.pitcherRole === 'reliever' || p.pitcherRole === 'setup') &&
        !p.injury.isInjured &&
        p.isFirstTeam
      ) {
        newPitcherId = pid;
        break;
      }
    }
  }

  if (!newPitcherId) {
    // 誰もいなければ交代しない
    return false;
  }

  const newPitcher = findPlayer(newPitcherId, allPlayers)!;
  const maxStamina = newPitcher.pitcherStats?.stamina ?? 60;

  teamState.currentPitcher = {
    playerId: newPitcherId,
    currentStamina: maxStamina,
    maxStamina,
    hitsAllowed: 0,
    runsAllowed: 0,
    earnedRuns: 0,
    strikeouts: 0,
    walks: 0,
    inningsPitched: 0,
    hitsThisInning: 0,
    entryInning: inning,
    responsibleRunners: 0,
  };

  teamState.usedPitchers.add(newPitcherId);
  return true;
}

/**
 * 代打の判定と実行（仕様書G-7）
 *
 * - 7回以降: 非DH制で投手の打席に代打
 * - 8回以降: 調子が bad/terrible の打者に代打
 *
 * @param teamState - 打撃側チーム状態
 * @param allPlayers - 全選手配列
 * @param inning - 現在のイニング
 * @param useDH - DH制使用か
 * @param batterId - 打席に立つ打者ID
 * @returns 代打後の打者ID（代打なしなら元の打者ID）
 */
function considerPinchHit(
  teamState: TeamGameState,
  allPlayers: Player[],
  inning: number,
  useDH: boolean,
  batterId: string,
): string {
  const batter = findPlayer(batterId, allPlayers);
  if (!batter) return batterId;

  const bullpen = teamState.team.bullpen;
  let shouldPinchHit = false;

  // 7回以降: 非DH制で投手の打順に代打
  if (inning >= 7 && !useDH && batter.position === 'P') {
    shouldPinchHit = true;
  }

  // 8回以降: 調子が悪い打者に代打
  if (
    inning >= 8 &&
    (batter.condition === 'bad' || batter.condition === 'terrible')
  ) {
    shouldPinchHit = true;
  }

  if (!shouldPinchHit) return batterId;

  // 代打の切り札を使う
  const pinchHitterId = bullpen.pinchHitterId;
  if (
    pinchHitterId &&
    !teamState.usedPinchHitters.has(pinchHitterId)
  ) {
    const ph = findPlayer(pinchHitterId, allPlayers);
    if (ph && !ph.injury.isInjured) {
      teamState.usedPinchHitters.add(pinchHitterId);
      // ラインナップの該当位置を置換
      const idx = teamState.lineup.indexOf(batterId);
      if (idx >= 0) {
        teamState.lineup[idx] = pinchHitterId;
      }
      return pinchHitterId;
    }
  }

  // 代打の切り札がいなければベンチから探す
  for (const pid of teamState.team.playerIds) {
    if (teamState.usedPinchHitters.has(pid)) continue;
    if (teamState.lineup.includes(pid)) continue;
    const p = findPlayer(pid, allPlayers);
    if (
      p &&
      p.position !== 'P' &&
      !p.injury.isInjured &&
      p.isFirstTeam &&
      p.condition !== 'terrible'
    ) {
      teamState.usedPinchHitters.add(pid);
      const idx = teamState.lineup.indexOf(batterId);
      if (idx >= 0) {
        teamState.lineup[idx] = pid;
      }
      return pid;
    }
  }

  return batterId;
}

// ============================================================
// 守備力平均計算
// ============================================================

/**
 * チームの平均守備力を計算する
 * @param teamState - チーム状態
 * @param allPlayers - 全選手配列
 * @returns 平均守備力(0-100)
 */
function calculateTeamFieldingAverage(
  teamState: TeamGameState,
  allPlayers: Player[],
): number {
  let total = 0;
  let count = 0;
  for (const playerId of teamState.lineup) {
    const player = findPlayer(playerId, allPlayers);
    if (player) {
      total += player.batterStats.fielding;
      count++;
    }
  }
  return count > 0 ? total / count : 50;
}

// ============================================================
// イニングスタミナ消耗処理（仕様書G-5）
// ============================================================

/**
 * イニング終了時の投手スタミナ消耗を処理する
 *
 * 消耗量 = STAMINA_DECAY_PER_INNING + (被安打数 * STAMINA_DECAY_PER_HIT)
 * 鉄腕特能: 消耗30%軽減
 *
 * @param pitcherState - 投手状態
 * @param pitcher - 投手の選手データ
 */
function applyInningStaminaDecay(
  pitcherState: PitcherGameState,
  pitcher: Player,
): void {
  let decay = STAMINA_DECAY_PER_INNING +
    pitcherState.hitsThisInning * STAMINA_DECAY_PER_HIT;

  // 鉄腕: スタミナ消耗30%減
  if (hasAbility(pitcher, 'ironArm')) {
    decay *= 0.7;
  }

  // 打たれ強い: 被安打によるスタミナ消耗軽減
  if (hasAbility(pitcher, 'resilient')) {
    decay -= pitcherState.hitsThisInning * STAMINA_DECAY_PER_HIT * 0.3;
  }

  pitcherState.currentStamina = Math.max(0, pitcherState.currentStamina - decay);
  pitcherState.hitsThisInning = 0;
}

// ============================================================
// 勝利投手・敗戦投手・セーブ投手の判定
// ============================================================

/**
 * 勝利・敗戦・セーブ投手を判定する
 *
 * @param homeState - ホームチーム状態
 * @param awayState - アウェイチーム状態
 * @param allPlayers - 全選手配列
 * @param inningScores - イニングスコア配列
 * @returns 勝利/敗戦/セーブ投手情報
 */
function determineWinLossSave(
  homeState: TeamGameState,
  awayState: TeamGameState,
  allPlayers: Player[],
  inningScores: { home: number; away: number }[],
): {
  winningPitcher: { id: string; name: string } | null;
  losingPitcher: { id: string; name: string } | null;
  savePitcher: { id: string; name: string } | null;
} {
  const homeTotal = homeState.score;
  const awayTotal = awayState.score;

  if (homeTotal === awayTotal) {
    // 引き分け
    return { winningPitcher: null, losingPitcher: null, savePitcher: null };
  }

  const winnerIsHome = homeTotal > awayTotal;
  // 各チーム状態には「そのチームの投手」がいる。
  // homeState はホームチームの状態 → ホームチームの投手を含む。
  // awayState はアウェイチームの状態 → アウェイチームの投手を含む。
  // ホームチームの投手はアウェイの攻撃時に投げる。
  const winPitcherState = winnerIsHome ? homeState : awayState;
  const losePitcherState = winnerIsHome ? awayState : homeState;

  // 全投手履歴を統合
  const winPitchers = [
    ...winPitcherState.pitcherHistory,
    winPitcherState.currentPitcher,
  ];
  const losePitchers = [
    ...losePitcherState.pitcherHistory,
    losePitcherState.currentPitcher,
  ];

  // --- 勝利投手 ---
  // リードを奪った時点で投げていた投手、またはリードを維持した投手
  // 簡易版: 最初にリードした時に投げていた投手 or 最も長いイニングを投げた投手
  let winPitcherId: string | null = null;

  // イニングスコアから「リードが入れ替わった時点」を追跡
  let runningHome = 0;
  let runningAway = 0;
  let leadChangePitcherIdx = 0;

  for (let i = 0; i < inningScores.length; i++) {
    const prevDiff = runningHome - runningAway;
    runningHome += inningScores[i].home;
    runningAway += inningScores[i].away;
    const newDiff = runningHome - runningAway;

    // 勝ったチームがリードを取った瞬間
    if (winnerIsHome && newDiff > 0 && prevDiff <= 0) {
      // ホームがリードを取った → その時に投げていたホーム投手
      leadChangePitcherIdx = i;
    }
    if (!winnerIsHome && newDiff < 0 && prevDiff >= 0) {
      leadChangePitcherIdx = i;
    }
  }

  // そのイニング時点の投手を特定（簡易: エントリーイニングで判定）
  for (let j = winPitchers.length - 1; j >= 0; j--) {
    if (winPitchers[j].entryInning <= leadChangePitcherIdx + 1) {
      winPitcherId = winPitchers[j].playerId;
      break;
    }
  }

  // フォールバック: 先発投手
  if (!winPitcherId) {
    winPitcherId = winPitchers[0].playerId;
  }

  // --- 敗戦投手 ---
  // リードを許した時点で投げていた投手
  // 簡易版: 最も多く失点した投手
  let losePitcherId: string | null = null;
  let maxEarnedRuns = -1;
  for (const p of losePitchers) {
    if (p.earnedRuns > maxEarnedRuns) {
      maxEarnedRuns = p.earnedRuns;
      losePitcherId = p.playerId;
    }
  }
  if (!losePitcherId) {
    losePitcherId = losePitchers[0].playerId;
  }

  // --- セーブ投手 ---
  // 最終投手が勝利投手と異なり、リード3点以内で1イニング以上投げた場合
  let savePitcherId: string | null = null;
  const finalPitcher = winPitcherState.currentPitcher;
  const scoreDiff = Math.abs(homeTotal - awayTotal);
  if (
    finalPitcher.playerId !== winPitcherId &&
    finalPitcher.inningsPitched >= 1 &&
    scoreDiff <= 3
  ) {
    savePitcherId = finalPitcher.playerId;
  }

  // 名前解決
  const resolveNamedPitcher = (id: string | null) => {
    if (!id) return null;
    const p = findPlayer(id, allPlayers);
    return p ? { id: p.id, name: p.name } : null;
  };

  return {
    winningPitcher: resolveNamedPitcher(winPitcherId),
    losingPitcher: resolveNamedPitcher(losePitcherId),
    savePitcher: resolveNamedPitcher(savePitcherId),
  };
}

// ============================================================
// メインのシミュレーション関数
// ============================================================

/**
 * 1試合をシミュレーションする
 *
 * 9イニング制（延長は最大12回まで）。各イニングの表裏で打席を解決し、
 * 継投・代打・盗塁を含むフルシミュレーションを行う。
 *
 * @param homeTeam - ホームチームデータ
 * @param awayTeam - アウェイチームデータ
 * @param allPlayers - ゲーム内の全選手データ配列
 * @param useDH - DH制を使用するか（パ・リーグ = true）
 * @returns 試合結果
 */
export function simulateGame(
  homeTeam: Team,
  awayTeam: Team,
  allPlayers: Player[],
  useDH: boolean,
): GameResult {
  // --- 初期化 ---
  const homeStarterId = selectStartingPitcher(homeTeam, allPlayers);
  const awayStarterId = selectStartingPitcher(awayTeam, allPlayers);

  const homeState = initTeamState(homeTeam, allPlayers, homeStarterId);
  const awayState = initTeamState(awayTeam, allPlayers, awayStarterId);

  const inningScores: { home: number; away: number }[] = [];
  const homeRunsList: { playerId: string; playerName: string; teamId: string }[] = [];
  const highlights: string[] = [];

  // 選手別成績トラッカー
  const battingLines = new Map<string, BattingLine>();
  const pitchingLines = new Map<string, PitchingLine>();

  /**
   * 打撃成績を取得（なければ初期化）
   */
  function getBattingLine(playerId: string): BattingLine {
    if (!battingLines.has(playerId)) {
      battingLines.set(playerId, {
        atBats: 0,
        hits: 0,
        rbi: 0,
        homeRuns: 0,
        walks: 0,
        strikeouts: 0,
      });
    }
    return battingLines.get(playerId)!;
  }

  /**
   * 投手成績を取得（なければ初期化）
   */
  function getPitchingLine(playerId: string): PitchingLine {
    if (!pitchingLines.has(playerId)) {
      pitchingLines.set(playerId, {
        inningsPitched: 0,
        earnedRuns: 0,
        strikeouts: 0,
        walks: 0,
        hitsAllowed: 0,
      });
    }
    return pitchingLines.get(playerId)!;
  }

  // 先発投手を成績トラッカーに登録
  getPitchingLine(homeStarterId);
  getPitchingLine(awayStarterId);

  /**
   * 守備側チームの平均守備力と捕手情報を取得する
   */
  function getDefensiveInfo(defensiveState: TeamGameState) {
    const fieldingAvg = calculateTeamFieldingAverage(defensiveState, allPlayers);
    const catcherId = findCatcherId(defensiveState.positions);
    const catcher = catcherId ? findPlayer(catcherId, allPlayers) : null;
    const catcherArm = catcher?.batterStats.arm ?? 50;
    return { fieldingAvg, catcherId, catcherArm };
  }

  // --- イニングループ ---
  let gameOver = false;

  for (let inning = 1; inning <= EXTENSION_INNINGS && !gameOver; inning++) {
    const inningScore = { home: 0, away: 0 };

    // ======== 表（アウェイ攻撃、ホーム守備）========
    {
      const offenseState = awayState;
      const defenseState = homeState;
      const defInfo = getDefensiveInfo(defenseState);

      let outs = 0;
      let bases: BaseRunners = { first: null, second: null, third: null };
      let inningRuns = 0;

      while (outs < 3) {
        // 打者取得
        let batterId = offenseState.lineup[offenseState.currentBatterIndex % offenseState.lineup.length];

        // 代打判定（仕様書G-7）
        batterId = considerPinchHit(offenseState, allPlayers, inning, useDH, batterId);
        const batter = findPlayer(batterId, allPlayers);
        if (!batter) {
          outs++;
          offenseState.currentBatterIndex++;
          continue;
        }

        const pitcher = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
        if (!pitcher) {
          outs++;
          continue;
        }

        // --- 盗塁判定（仕様書G-8）---
        if (bases.first !== null && bases.second === null) {
          const runner = findPlayer(bases.first, allPlayers);
          if (runner) {
            const stealResult = attemptSteal(runner, pitcher, defInfo.catcherArm);
            if (stealResult !== null) {
              if (stealResult) {
                // 盗塁成功
                bases.second = bases.first;
                bases.first = null;
                highlights.push(
                  `${runner.name}が盗塁成功！`,
                );
              } else {
                // 盗塁失敗（アウト）
                bases.first = null;
                outs++;
                highlights.push(
                  `${runner.name}が盗塁失敗...`,
                );
                if (outs >= 3) break;
              }
            }
          }
        }

        // --- 打席解決 ---
        const scoreDiff = offenseState.score - defenseState.score;
        const outcome = resolveAtBat(
          batter,
          pitcher,
          defenseState.currentPitcher,
          defenseState.team,
          defInfo.fieldingAvg,
          {
            runnersInScoringPosition: hasRunnersInScoringPosition(bases),
            basesLoaded: isBasesLoaded(bases),
            inning,
            scoreDiff,
            isBottom: false,
            catcherId: defInfo.catcherId,
          },
        );

        // --- 成績記録 ---
        const batLine = getBattingLine(batterId);
        const pitLine = getPitchingLine(defenseState.currentPitcher.playerId);

        const isHit =
          outcome === 'homerun' ||
          outcome === 'triple' ||
          outcome === 'double' ||
          outcome === 'single';
        const isOut =
          outcome === 'strikeout' ||
          outcome === 'groundout' ||
          outcome === 'flyout';
        const isWalkLike = outcome === 'walk' || outcome === 'hbp';

        if (isHit || isOut || outcome === 'error') {
          batLine.atBats++;
        }
        if (isWalkLike) {
          batLine.walks++;
          pitLine.walks++;
        }
        if (isHit) {
          batLine.hits++;
          pitLine.hitsAllowed++;
          defenseState.currentPitcher.hitsAllowed++;
          defenseState.currentPitcher.hitsThisInning++;
          offenseState.hits++;
        }
        if (outcome === 'strikeout') {
          batLine.strikeouts++;
          pitLine.strikeouts++;
          defenseState.currentPitcher.strikeouts++;
        }

        // --- 走者進塁 ---
        const { runsScored, newBases } = advanceRunners(outcome, bases, batterId);
        bases = newBases;

        if (runsScored > 0) {
          inningRuns += runsScored;
          offenseState.score += runsScored;
          batLine.rbi += runsScored;
          defenseState.currentPitcher.runsAllowed += runsScored;
          defenseState.currentPitcher.earnedRuns += outcome === 'error'
            ? Math.max(0, runsScored - 1)
            : runsScored;
          pitLine.earnedRuns += outcome === 'error'
            ? Math.max(0, runsScored - 1)
            : runsScored;
        }

        if (outcome === 'homerun') {
          batLine.homeRuns++;
          const hrPlayerName = batter.name;
          homeRunsList.push({
            playerId: batterId,
            playerName: hrPlayerName,
            teamId: offenseState.teamId,
          });
          // 注意: runsScored にはすでにHR分が含まれている
          if (runsScored >= 4) {
            highlights.push(
              `${hrPlayerName}が満塁ホームラン！${runsScored}打点！`,
            );
          } else if (runsScored >= 2) {
            highlights.push(
              `${hrPlayerName}が${runsScored}ランホームラン！`,
            );
          } else {
            highlights.push(`${hrPlayerName}がソロホームラン！`);
          }
        }

        // アウトカウント更新
        if (isOut) {
          outs++;
        }
        // エラーはアウトにならない
        // ゴロアウトで併殺の場合は advanceRunners 内で処理済み
        // （ただし追加アウトのカウントは簡易モデルでは省略）

        offenseState.currentBatterIndex =
          (offenseState.currentBatterIndex + 1) % offenseState.lineup.length;
      }

      inningScore.away = inningRuns;

      // イニング終了: 投手スタミナ消耗
      const homePitcher = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
      if (homePitcher) {
        applyInningStaminaDecay(defenseState.currentPitcher, homePitcher);
      }
      defenseState.currentPitcher.inningsPitched++;
      const homePitLine = getPitchingLine(defenseState.currentPitcher.playerId);
      homePitLine.inningsPitched++;

      // --- 継投判定（イニング間） ---
      if (homePitcher) {
        const changeResult = shouldChangePitcher(
          defenseState.currentPitcher,
          homePitcher,
          inning,
          defenseState.score,
          offenseState.score,
          defenseState.team.bullpen,
        );
        if (changeResult.shouldChange) {
          const changed = changePitcher(
            defenseState,
            allPlayers,
            changeResult.useCloser,
            inning,
          );
          if (changed) {
            const newP = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
            if (newP) {
              getPitchingLine(newP.id); // 初期化
              highlights.push(
                `${homeTeam.shortName}: ${newP.name}がマウンドへ`,
              );
            }
          }
        }
      }
    }

    // ======== 9回裏以降: ホームチームがリードしていれば試合終了 ========
    if (inning >= 9 && homeState.score > awayState.score) {
      // 裏の攻撃なしで試合終了（サヨナラの必要なし）
      // ただし、表の攻撃で逆転されていなければ
      // → 表の攻撃後にホームがリードなら裏は不要
      inningScores.push(inningScore);
      gameOver = true;
      continue;
    }

    // ======== 裏（ホーム攻撃、アウェイ守備）========
    {
      const offenseState = homeState;
      const defenseState = awayState;
      const defInfo = getDefensiveInfo(defenseState);

      let outs = 0;
      let bases: BaseRunners = { first: null, second: null, third: null };
      let inningRuns = 0;

      while (outs < 3) {
        // サヨナラ判定: 9回以降の裏でホームがリードしたら即終了
        if (inning >= 9 && offenseState.score > defenseState.score) {
          break;
        }

        // 打者取得
        let batterId = offenseState.lineup[offenseState.currentBatterIndex % offenseState.lineup.length];

        // 代打判定
        batterId = considerPinchHit(offenseState, allPlayers, inning, useDH, batterId);
        const batter = findPlayer(batterId, allPlayers);
        if (!batter) {
          outs++;
          offenseState.currentBatterIndex++;
          continue;
        }

        const pitcher = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
        if (!pitcher) {
          outs++;
          continue;
        }

        // --- 盗塁判定 ---
        if (bases.first !== null && bases.second === null) {
          const runner = findPlayer(bases.first, allPlayers);
          if (runner) {
            const stealResult = attemptSteal(runner, pitcher, defInfo.catcherArm);
            if (stealResult !== null) {
              if (stealResult) {
                bases.second = bases.first;
                bases.first = null;
                highlights.push(`${runner.name}が盗塁成功！`);
              } else {
                bases.first = null;
                outs++;
                highlights.push(`${runner.name}が盗塁失敗...`);
                if (outs >= 3) break;
              }
            }
          }
        }

        // --- 打席解決 ---
        const scoreDiff = offenseState.score - defenseState.score;
        const outcome = resolveAtBat(
          batter,
          pitcher,
          defenseState.currentPitcher,
          defenseState.team,
          defInfo.fieldingAvg,
          {
            runnersInScoringPosition: hasRunnersInScoringPosition(bases),
            basesLoaded: isBasesLoaded(bases),
            inning,
            scoreDiff,
            isBottom: true,
            catcherId: defInfo.catcherId,
          },
        );

        // --- 成績記録 ---
        const batLine = getBattingLine(batterId);
        const pitLine = getPitchingLine(defenseState.currentPitcher.playerId);

        const isHit =
          outcome === 'homerun' ||
          outcome === 'triple' ||
          outcome === 'double' ||
          outcome === 'single';
        const isOut =
          outcome === 'strikeout' ||
          outcome === 'groundout' ||
          outcome === 'flyout';
        const isWalkLike = outcome === 'walk' || outcome === 'hbp';

        if (isHit || isOut || outcome === 'error') {
          batLine.atBats++;
        }
        if (isWalkLike) {
          batLine.walks++;
          pitLine.walks++;
        }
        if (isHit) {
          batLine.hits++;
          pitLine.hitsAllowed++;
          defenseState.currentPitcher.hitsAllowed++;
          defenseState.currentPitcher.hitsThisInning++;
          offenseState.hits++;
        }
        if (outcome === 'strikeout') {
          batLine.strikeouts++;
          pitLine.strikeouts++;
          defenseState.currentPitcher.strikeouts++;
        }

        // --- 走者進塁 ---
        const { runsScored, newBases } = advanceRunners(outcome, bases, batterId);
        bases = newBases;

        if (runsScored > 0) {
          inningRuns += runsScored;
          offenseState.score += runsScored;
          batLine.rbi += runsScored;
          defenseState.currentPitcher.runsAllowed += runsScored;
          defenseState.currentPitcher.earnedRuns += outcome === 'error'
            ? Math.max(0, runsScored - 1)
            : runsScored;
          pitLine.earnedRuns += outcome === 'error'
            ? Math.max(0, runsScored - 1)
            : runsScored;
        }

        if (outcome === 'homerun') {
          batLine.homeRuns++;
          homeRunsList.push({
            playerId: batterId,
            playerName: batter.name,
            teamId: offenseState.teamId,
          });
          if (runsScored >= 4) {
            highlights.push(
              `${batter.name}が満塁ホームラン！${runsScored}打点！`,
            );
          } else if (runsScored >= 2) {
            highlights.push(
              `${batter.name}が${runsScored}ランホームラン！`,
            );
          } else {
            highlights.push(`${batter.name}がソロホームラン！`);
          }

          // サヨナラホームラン判定
          if (inning >= 9 && offenseState.score > defenseState.score) {
            highlights.push(`${batter.name}のサヨナラホームラン！`);
          }
        }

        if (isOut) {
          outs++;
        }

        offenseState.currentBatterIndex =
          (offenseState.currentBatterIndex + 1) % offenseState.lineup.length;
      }

      inningScore.home = inningRuns;

      // イニング終了: 投手スタミナ消耗
      const awayPitcher = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
      if (awayPitcher) {
        applyInningStaminaDecay(defenseState.currentPitcher, awayPitcher);
      }
      defenseState.currentPitcher.inningsPitched++;
      const awayPitLine = getPitchingLine(defenseState.currentPitcher.playerId);
      awayPitLine.inningsPitched++;

      // --- 継投判定 ---
      if (awayPitcher) {
        const changeResult = shouldChangePitcher(
          defenseState.currentPitcher,
          awayPitcher,
          inning,
          defenseState.score,
          offenseState.score,
          defenseState.team.bullpen,
        );
        if (changeResult.shouldChange) {
          const changed = changePitcher(
            defenseState,
            allPlayers,
            changeResult.useCloser,
            inning,
          );
          if (changed) {
            const newP = findPlayer(defenseState.currentPitcher.playerId, allPlayers);
            if (newP) {
              getPitchingLine(newP.id);
              highlights.push(
                `${awayTeam.shortName}: ${newP.name}がマウンドへ`,
              );
            }
          }
        }
      }
    }

    inningScores.push(inningScore);

    // サヨナラ判定
    if (inning >= 9 && homeState.score > awayState.score) {
      gameOver = true;
    }

    // 延長の引き分け判定
    if (inning >= EXTENSION_INNINGS && homeState.score === awayState.score) {
      gameOver = true;
    }

    // 9回終了後にスコア差がある場合も終了
    if (inning >= 9 && homeState.score !== awayState.score) {
      gameOver = true;
    }
  }

  // --- 最終投手の成績を確定 ---
  // 履歴に残っていない現在の投手を最終確定
  // （ループ内でイニング数は更新済み）

  // --- 勝敗判定 ---
  const { winningPitcher, losingPitcher, savePitcher } = determineWinLossSave(
    homeState,
    awayState,
    allPlayers,
    inningScores,
  );

  // --- 選手成績サマリー構築 ---
  const playerSummaries: PlayerGameSummary[] = [];
  const processedPlayers = new Set<string>();

  // 打撃成績のある選手
  for (const [playerId, batting] of battingLines.entries()) {
    const player = findPlayer(playerId, allPlayers);
    if (!player) continue;
    processedPlayers.add(playerId);

    const pitching = pitchingLines.get(playerId) ?? null;
    const teamId =
      homeState.lineup.includes(playerId) ||
      homeState.pitcherHistory.some((p) => p.playerId === playerId) ||
      homeState.currentPitcher.playerId === playerId
        ? homeState.teamId
        : awayState.teamId;

    playerSummaries.push({
      playerId,
      playerName: player.name,
      teamId,
      batting:
        batting.atBats > 0 || batting.walks > 0
          ? batting
          : null,
      pitching: pitching
        ? {
            inningsPitched: pitching.inningsPitched,
            earnedRuns: pitching.earnedRuns,
            strikeouts: pitching.strikeouts,
            walks: pitching.walks,
            hitsAllowed: pitching.hitsAllowed,
          }
        : null,
    });
  }

  // 投手成績のみの選手（打席に立たなかった投手）
  for (const [playerId, pitching] of pitchingLines.entries()) {
    if (processedPlayers.has(playerId)) continue;
    const player = findPlayer(playerId, allPlayers);
    if (!player) continue;

    const teamId =
      homeState.pitcherHistory.some((p) => p.playerId === playerId) ||
      homeState.currentPitcher.playerId === playerId
        ? homeState.teamId
        : awayState.teamId;

    playerSummaries.push({
      playerId,
      playerName: player.name,
      teamId,
      batting: null,
      pitching: {
        inningsPitched: pitching.inningsPitched,
        earnedRuns: pitching.earnedRuns,
        strikeouts: pitching.strikeouts,
        walks: pitching.walks,
        hitsAllowed: pitching.hitsAllowed,
      },
    });
  }

  // --- ハイライト: 試合結果サマリー ---
  const homeTotal = homeState.score;
  const awayTotal = awayState.score;
  if (homeTotal === awayTotal) {
    highlights.unshift(
      `${awayTeam.shortName} ${awayTotal} - ${homeTotal} ${homeTeam.shortName}（引き分け）`,
    );
  } else if (homeTotal > awayTotal) {
    highlights.unshift(
      `${homeTeam.shortName}が${homeTotal}-${awayTotal}で${awayTeam.shortName}に勝利！`,
    );
  } else {
    highlights.unshift(
      `${awayTeam.shortName}が${awayTotal}-${homeTotal}で${homeTeam.shortName}に勝利！`,
    );
  }

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    inningScores,
    winningPitcher,
    losingPitcher,
    savePitcher,
    homeRuns: homeRunsList,
    highlights,
    playerSummaries,
  };
}
