import type { Player, GrowthType, Position, PlayerOrigin } from '@/types/player';
import type { ReincarnationEntry } from '@/types/game';
import { randomInt, randomWeighted, chance, generateId } from '@/utils/random';
import { DRAFT_ORIGIN_RATES } from '@/constants/balance';

/**
 * 転生プールに選手を追加する
 * 引退した選手のデータから転生エントリを生成
 */
export function createReincarnationEntry(player: Player): ReincarnationEntry {
  // ポテンシャル上限は前世の能力値ベース
  const maxStat = player.position === 'P' && player.pitcherStats
    ? Math.max(player.pitcherStats.velocity, player.pitcherStats.control, player.pitcherStats.breaking)
    : Math.max(player.batterStats.meet, player.batterStats.power, player.batterStats.speed);

  // 成長タイプの傾向（前世の成長タイプを基準に確率設定）
  const growthTypeTendency: Record<string, number> = {
    early: 0.1,
    normal: 0.2,
    late: 0.2,
    unstable: 0.1,
    lateBloom: 0.1,
  };
  // 前世の成長タイプに高い確率を設定
  growthTypeTendency[player.growthType] = 0.5;

  // 特能候補（前世の特能を基準に取得確率を設定）
  const abilityCandidates: Record<string, number> = {};
  for (const abilityId of [...player.uniqueAbilities, ...player.normalAbilities]) {
    abilityCandidates[abilityId] = player.isLegend ? 0.7 : 0.4;
  }

  return {
    name: player.name,
    position: player.position,
    potentialCap: maxStat,
    growthTypeTendency,
    abilityCandidates,
    isLegend: player.isLegend,
  };
}

/**
 * 転生プールからドラフト候補を生成する
 * 転生選手は新人として再登場する
 */
export function generateReincarnatedPlayer(
  entry: ReincarnationEntry,
  existingNames: string[],
): Player | null {
  // 同名の現役選手がいたら転生しない
  if (existingNames.includes(entry.name)) return null;

  const position = entry.position as Position;
  const isPitcher = position === 'P';

  // 成長タイプを傾向に基づいて決定
  const growthType = randomWeighted(entry.growthTypeTendency as Record<GrowthType, number>);

  // 出身を決定
  const origin = randomWeighted(DRAFT_ORIGIN_RATES as Record<PlayerOrigin, number>);
  const age = origin === 'highSchool' ? 18 : origin === 'college' ? 22 : 25;

  // ポテンシャル上限（前世の±10%のブレ）
  const potentialCap = Math.min(100, Math.max(30, entry.potentialCap + randomInt(-10, 10)));

  // 現在能力は新人レベル（18歳相当でリセット）
  const baseAbility = randomInt(20, 40);

  // 特能を候補リストから確率で取得
  const uniqueAbilities: string[] = [];
  const normalAbilities: string[] = [];
  for (const [abilityId, prob] of Object.entries(entry.abilityCandidates)) {
    if (chance(prob)) {
      if (['geniusBatter', 'powerArm', 'ironArm', 'speedContact', 'defenseMaster', 'precisionMachine', 'twoWay'].includes(abilityId)) {
        uniqueAbilities.push(abilityId);
      } else {
        normalAbilities.push(abilityId);
      }
    }
  }

  const emptyBatterStats = () => ({
    games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    rbi: 0, runs: 0, stolenBases: 0, caughtStealing: 0, walks: 0,
    strikeouts: 0, sacrificeBunts: 0, sacrificeFlies: 0, hitByPitch: 0,
  });

  const emptyPitcherStats = () => ({
    games: 0, gamesStarted: 0, wins: 0, losses: 0, saves: 0, holds: 0,
    inningsPitched: 0, hitsAllowed: 0, homeRunsAllowed: 0, strikeouts: 0,
    walks: 0, earnedRuns: 0,
  });

  return {
    id: generateId(),
    name: entry.name,
    age,
    teamId: '',
    position,
    subPositions: {},
    pitcherRole: isPitcher ? 'starter' : null,
    throwHand: 'right',
    batHand: 'right',
    batterStats: {
      meet: baseAbility + randomInt(-5, 5),
      power: baseAbility + randomInt(-5, 5),
      speed: baseAbility + randomInt(-5, 5),
      fielding: baseAbility + randomInt(-5, 5),
      arm: baseAbility + randomInt(-5, 5),
      eye: baseAbility + randomInt(-5, 5),
    },
    pitcherStats: isPitcher ? {
      velocity: baseAbility + randomInt(-5, 10),
      control: baseAbility + randomInt(-5, 5),
      breaking: baseAbility + randomInt(-5, 5),
      stamina: baseAbility + randomInt(0, 15),
    } : null,
    pitches: [],
    growthType,
    potential: isPitcher
      ? { velocity: potentialCap, control: potentialCap - 5, breaking: potentialCap - 5, stamina: potentialCap - 10 }
      : { meet: potentialCap, power: potentialCap - 5, speed: potentialCap - 5, fielding: potentialCap - 10, arm: potentialCap - 10, eye: potentialCap - 5 },
    uniqueAbilities,
    normalAbilities,
    awakeningAbilities: [],
    condition: 'normal',
    awakening: { gauge: 0, isAwakened: false, type: null, remainingYears: 0 },
    slump: { isInSlump: false, remainingCards: 0 },
    injury: { isInjured: false, name: '', severity: 'minor', remainingCards: 0, hadTommyJohn: false },
    contract: { salary: 1000, remainingYears: 0, promise: null, promiseKept: null },
    isFirstTeam: false,
    isDevelopment: false,
    isForeign: false,
    isTwoWay: uniqueAbilities.includes('twoWay'),
    isLegend: entry.isLegend,
    yearsInFirstTeam: 0,
    yearsAsPro: 0,
    origin,
    currentBatterStats: emptyBatterStats(),
    currentPitcherStats: emptyPitcherStats(),
    careerStats: {
      seasons: 0,
      batterStats: emptyBatterStats(),
      pitcherStats: emptyPitcherStats(),
    },
    demotionCooldown: 0,
    farmConsecutiveYears: 0,
    isDisgruntled: false,
    isReturnedFromOverseas: false,
    reincarnationSource: entry.name,
  };
}
