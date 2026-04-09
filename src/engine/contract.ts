import type { Player } from '@/types/player';
import { chance } from '@/utils/random';

/** 年俸計算の基本係数 */
const SALARY_BASE_MULTIPLIER = 10;

/** 最低年俸（万円） */
const MIN_SALARY = 440;

/** 最大年俸（万円） */
const MAX_SALARY = 100000;

/** 不満閾値（提示額が希望の何割以下で不満が溜まるか） */
const DISGRUNTLED_THRESHOLD = 0.65;

/** 契約成功の最低提示割合（希望年俸の何割以上で受け入れるか） */
const ACCEPT_THRESHOLD = 0.75;

/** 約束による受け入れ閾値の緩和 */
const PROMISE_THRESHOLD_REDUCTION = 0.10;

/**
 * 選手の希望年俸を計算する
 * 能力値・成績・年齢・実績に基づいて適正年俸を算出
 * @param player - 選手オブジェクト
 * @returns 希望年俸（万円）
 */
export function calculateDesiredSalary(player: Player): number {
  let baseSalary = 0;

  if (player.position === 'P' && player.pitcherStats) {
    // 投手の場合
    const statAvg =
      (player.pitcherStats.velocity + player.pitcherStats.control +
        player.pitcherStats.breaking + player.pitcherStats.stamina) / 4;
    baseSalary = statAvg * SALARY_BASE_MULTIPLIER;

    // シーズン成績による加算
    baseSalary += player.currentPitcherStats.wins * 300;
    baseSalary += player.currentPitcherStats.saves * 200;
    baseSalary += player.currentPitcherStats.holds * 100;
    baseSalary += player.currentPitcherStats.strikeouts * 10;

    // 防御率が低いほどボーナス
    if (player.currentPitcherStats.inningsPitched > 0) {
      const era = (player.currentPitcherStats.earnedRuns * 9) / player.currentPitcherStats.inningsPitched;
      if (era < 2.0) baseSalary += 3000;
      else if (era < 3.0) baseSalary += 1500;
      else if (era < 4.0) baseSalary += 500;
    }
  } else {
    // 打者の場合
    const statAvg =
      (player.batterStats.meet + player.batterStats.power +
        player.batterStats.speed + player.batterStats.fielding +
        player.batterStats.arm + player.batterStats.eye) / 6;
    baseSalary = statAvg * SALARY_BASE_MULTIPLIER;

    // シーズン成績による加算
    baseSalary += player.currentBatterStats.homeRuns * 100;
    baseSalary += player.currentBatterStats.rbi * 30;
    baseSalary += player.currentBatterStats.stolenBases * 50;

    // 打率による加算
    if (player.currentBatterStats.atBats > 0) {
      const avg = player.currentBatterStats.hits / player.currentBatterStats.atBats;
      if (avg >= 0.330) baseSalary += 3000;
      else if (avg >= 0.300) baseSalary += 1500;
      else if (avg >= 0.280) baseSalary += 500;
    }
  }

  // 年齢補正: 全盛期（27-31歳）は高め、若手・ベテランは控えめ
  if (player.age >= 27 && player.age <= 31) {
    baseSalary *= 1.2;
  } else if (player.age <= 23) {
    baseSalary *= 0.7;
  } else if (player.age >= 35) {
    baseSalary *= 0.8;
  }

  // プロ年数による補正
  baseSalary += player.yearsAsPro * 100;

  // レジェンドボーナス
  if (player.isLegend) {
    baseSalary *= 1.3;
  }

  // 前年年俸から大きく下がらないように（ダウン幅は最大30%）
  const floorSalary = player.contract.salary * 0.7;
  baseSalary = Math.max(baseSalary, floorSalary);

  return Math.max(MIN_SALARY, Math.min(MAX_SALARY, Math.round(baseSalary)));
}

/**
 * 契約更改を行う
 * 提示年俸が希望の一定割合以上なら合意。約束がある場合は基準が緩和される。
 * 提示が極端に低いと不満状態になる。
 * @param player - 選手オブジェクト
 * @param offeredSalary - 提示年俸（万円）
 * @param promise - 約束（ポスティング容認、レギュラー起用など）
 * @returns 合意成否と不満フラグ
 */
export function negotiateContract(
  player: Player,
  offeredSalary: number,
  promise: string | null,
): { success: boolean; isDisgruntled: boolean } {
  const desiredSalary = calculateDesiredSalary(player);

  // 約束がある場合はハードルが下がる
  const threshold = promise ? ACCEPT_THRESHOLD - PROMISE_THRESHOLD_REDUCTION : ACCEPT_THRESHOLD;
  const ratio = offeredSalary / desiredSalary;

  // 基本合意判定
  let success = ratio >= threshold;

  // ギリギリの場合は確率で合意/不合意
  if (!success && ratio >= threshold - 0.10) {
    success = chance(0.4);
  }

  // 希望の大幅ダウンなら不満
  const isDisgruntled = ratio < DISGRUNTLED_THRESHOLD;

  // 不満状態でも契約自体は成立する場合がある（複数年契約中など）
  if (player.contract.remainingYears > 0) {
    return { success: true, isDisgruntled: false };
  }

  return { success, isDisgruntled };
}
