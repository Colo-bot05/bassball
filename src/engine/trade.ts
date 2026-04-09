import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import { randomFloat, chance } from '@/utils/random';

/** トレード提案の最低価値差（これ以下の差額ではトレードしない） */
const MIN_VALUE_BALANCE = 0.8;

/** トレード提案の最大価値差 */
const MAX_VALUE_BALANCE = 1.25;

/** トレード成立の基本確率 */
const TRADE_BASE_CHANCE = 0.30;

/** 再建モードのチームがトレードに応じやすい倍率 */
const REBUILDING_TRADE_BONUS = 1.5;

/**
 * 選手のトレード価値を計算する
 * 能力値・年齢・契約年数・将来性を総合的に評価
 * @param player - 選手オブジェクト
 * @returns トレード価値（0-200のスコア）
 */
export function evaluateTradeValue(player: Player): number {
  let value = 0;

  // 基本能力値
  if (player.position === 'P' && player.pitcherStats) {
    value +=
      (player.pitcherStats.velocity + player.pitcherStats.control +
        player.pitcherStats.breaking + player.pitcherStats.stamina) / 4;
  } else {
    value +=
      (player.batterStats.meet + player.batterStats.power +
        player.batterStats.speed + player.batterStats.fielding +
        player.batterStats.arm + player.batterStats.eye) / 6;
  }

  // シーズン成績ボーナス
  if (player.position === 'P') {
    value += player.currentPitcherStats.wins * 3;
    value += player.currentPitcherStats.saves * 2;
    if (player.currentPitcherStats.inningsPitched > 0) {
      const era = (player.currentPitcherStats.earnedRuns * 9) / player.currentPitcherStats.inningsPitched;
      if (era < 3.0) value += 15;
    }
  } else {
    value += player.currentBatterStats.homeRuns * 1.5;
    if (player.currentBatterStats.atBats > 0) {
      const avg = player.currentBatterStats.hits / player.currentBatterStats.atBats;
      if (avg >= 0.300) value += 15;
    }
  }

  // 年齢補正: 若いほど将来性が高い
  if (player.age <= 24) {
    value *= 1.3;
  } else if (player.age <= 28) {
    value *= 1.1;
  } else if (player.age >= 33) {
    value *= 0.7;
  } else if (player.age >= 30) {
    value *= 0.9;
  }

  // 年俸が高い選手はトレード価値が下がる（人件費負担）
  if (player.contract.salary > 20000) {
    value *= 0.85;
  } else if (player.contract.salary > 10000) {
    value *= 0.9;
  }

  // 不満選手は出しやすい
  if (player.isDisgruntled) {
    value *= 0.8;
  }

  // レジェンドは基本的にトレードしにくい
  if (player.isLegend) {
    value *= 0.6;
  }

  return Math.max(0, Math.round(value));
}

/**
 * AIがポジション別の戦力バランスを評価し、弱いポジションを特定する
 * @param team - 球団オブジェクト
 * @param allPlayers - 全選手データ
 * @returns 弱いポジションのリスト
 */
function findWeakPositions(team: Team, allPlayers: Player[]): string[] {
  const teamPlayers = allPlayers.filter((p) => p.teamId === team.id && !p.isDevelopment);
  const positionStrength: Record<string, number> = {};

  for (const player of teamPlayers) {
    const pos = player.position;
    const strength = player.position === 'P' && player.pitcherStats
      ? (player.pitcherStats.velocity + player.pitcherStats.control + player.pitcherStats.breaking) / 3
      : (player.batterStats.meet + player.batterStats.power + player.batterStats.fielding) / 3;

    if (!positionStrength[pos] || strength > positionStrength[pos]) {
      positionStrength[pos] = strength;
    }
  }

  // 平均以下のポジションを弱点とする
  const values = Object.values(positionStrength);
  const average = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  return Object.entries(positionStrength)
    .filter(([, strength]) => strength < average)
    .map(([pos]) => pos);
}

/**
 * AIがトレード提案を行う
 * 自チームの弱点を補強し、相手チームにも利益があるトレードを提案
 * @param fromTeam - 提案元球団
 * @param toTeam - 提案先球団
 * @param allPlayers - 全選手データ
 * @returns トレード提案（成立しない場合はnull）
 */
export function proposeAITrade(
  fromTeam: Team,
  toTeam: Team,
  allPlayers: Player[],
): { fromPlayerIds: string[]; toPlayerIds: string[] } | null {
  // そもそもトレードを試みるか確率判定
  let tradeChance = TRADE_BASE_CHANCE;
  if (fromTeam.ai.mode === 'rebuilding') {
    tradeChance *= REBUILDING_TRADE_BONUS;
  }
  if (!chance(tradeChance)) {
    return null;
  }

  const fromPlayers = allPlayers.filter(
    (p) => p.teamId === fromTeam.id && !p.isDevelopment && p.contract.remainingYears <= 1,
  );
  const toPlayers = allPlayers.filter(
    (p) => p.teamId === toTeam.id && !p.isDevelopment && p.contract.remainingYears <= 1,
  );

  if (fromPlayers.length === 0 || toPlayers.length === 0) {
    return null;
  }

  // 弱点ポジション特定
  const fromWeakPositions = findWeakPositions(fromTeam, allPlayers);
  const toWeakPositions = findWeakPositions(toTeam, allPlayers);

  // 提案元が欲しい選手を相手から探す
  const wantedFromTo = toPlayers
    .filter((p) => fromWeakPositions.includes(p.position))
    .sort((a, b) => evaluateTradeValue(b) - evaluateTradeValue(a));

  // 提案先が欲しそうな選手を自チームから探す
  const offerFromFrom = fromPlayers
    .filter((p) => toWeakPositions.includes(p.position))
    .sort((a, b) => evaluateTradeValue(b) - evaluateTradeValue(a));

  if (wantedFromTo.length === 0 || offerFromFrom.length === 0) {
    return null;
  }

  // 最も価値の近い組み合わせを探す
  const targetPlayer = wantedFromTo[0];
  const targetValue = evaluateTradeValue(targetPlayer);

  // 単数対単数のトレードを試みる
  for (const offerPlayer of offerFromFrom) {
    const offerValue = evaluateTradeValue(offerPlayer);
    const ratio = targetValue > 0 ? offerValue / targetValue : 0;

    // 価値がおおよそ釣り合う場合にトレード成立
    if (ratio >= MIN_VALUE_BALANCE && ratio <= MAX_VALUE_BALANCE) {
      // レジェンド同士のトレードは起きにくい
      if (targetPlayer.isLegend || offerPlayer.isLegend) {
        if (!chance(0.1)) continue;
      }

      // ランダム要素も加味
      const noise = randomFloat(-0.1, 0.1);
      if (ratio + noise >= MIN_VALUE_BALANCE) {
        return {
          fromPlayerIds: [offerPlayer.id],
          toPlayerIds: [targetPlayer.id],
        };
      }
    }
  }

  return null;
}
