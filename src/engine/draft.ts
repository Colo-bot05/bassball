import type { Player, Position, GrowthType, PlayerOrigin, PitcherRole, ThrowHand, BatHand, PitchType } from '@/types/player';
import type { Team } from '@/types/team';
import type { ReincarnationEntry } from '@/types/game';
import {
  DRAFT_CANDIDATES_RANGE,
  DRAFT_REINCARNATION_RANGE,
  DRAFT_GOOD_YEAR_CHANCE,
  DRAFT_GODLY_YEAR_CHANCE,
  DRAFT_MAX_ROUNDS,
  DRAFT_ORIGIN_RATES,
} from '@/constants/balance';
import {
  randomInt,
  chance,
  randomChoice,
  randomWeighted,
  generateId,
} from '@/utils/random';
import { generateReincarnatedPlayer } from '@/engine/reincarnation';

// ========================================
// 名前生成
// ========================================

/** 日本人の姓（50音順、50以上） */
const SURNAMES: readonly string[] = [
  '田中', '鈴木', '佐藤', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '松本', '井上', '木村', '林', '斎藤', '清水', '山口',
  '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '岡田', '後藤', '長谷川',
  '村上', '近藤', '石井', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田',
  '三浦', '岡本', '松田', '中川', '中島', '原', '小野', '田村', '竹内', '金子',
  '和田', '中野', '上田', '丸山', '今井', '大野', '河野', '宮崎', '高木', '安藤',
];

/** 日本人の名（50音順、50以上） */
const FIRST_NAMES: readonly string[] = [
  '翔太', '大輝', '蓮', '悠人', '陽翔', '湊', '蒼', '律', '悠真', '朝陽',
  '結翔', '大和', '颯真', '拓海', '瑛太', '海斗', '陸', '颯太', '健太', '雄大',
  '翔', '遥斗', '一翔', '駿', '蒼空', '奏太', '樹', '大翔', '悠斗', '隼人',
  '直人', '和也', '裕太', '拓也', '翼', '将太', '龍之介', '慎太郎', '大地', '光',
  '優斗', '誠', '勇気', '亮', '昇太', '航', '遼', '剛', '諒', '圭',
  '健', '匠', '凛', '晃', '秀', '慧', '聡', '怜', '玲', '旭',
];

/**
 * ランダムな日本人名を生成する（既存選手名と重複しない）
 * @param existingNames - 既存選手名の配列
 * @returns 生成された名前
 */
function generateName(existingNames: string[]): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = `${randomChoice(SURNAMES)}${randomChoice(FIRST_NAMES)}`;
    if (!existingNames.includes(name)) {
      return name;
    }
  }
  // フォールバック: 数字付きで一意にする
  return `${randomChoice(SURNAMES)}${randomChoice(FIRST_NAMES)}${randomInt(1, 99)}`;
}

/** 野手ポジション一覧 */
const FIELDER_POSITIONS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/** 投手ロール一覧 */
const PITCHER_ROLES: readonly PitcherRole[] = ['starter', 'reliever', 'closer', 'setup'];

/** 変化球タイプ一覧 */
const PITCH_TYPES: readonly PitchType[] = [
  'curve', 'slider', 'cutter', 'fork', 'changeup', 'shoot',
  'sinker', 'twoSeam', 'splitter', 'knuckleCurve',
];

/**
 * 空の打撃シーズン成績を生成する
 * @returns 初期化された打撃成績
 */
function emptyBatterSeasonStats() {
  return {
    games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    rbi: 0, runs: 0, stolenBases: 0, caughtStealing: 0, walks: 0,
    strikeouts: 0, sacrificeBunts: 0, sacrificeFlies: 0, hitByPitch: 0,
  };
}

/**
 * 空の投手シーズン成績を生成する
 * @returns 初期化された投手成績
 */
function emptyPitcherSeasonStats() {
  return {
    games: 0, gamesStarted: 0, wins: 0, losses: 0, saves: 0, holds: 0,
    inningsPitched: 0, hitsAllowed: 0, homeRunsAllowed: 0, strikeouts: 0,
    walks: 0, earnedRuns: 0,
  };
}

/**
 * ドラフト候補の新人選手を生成する
 * @param existingNames - 既存選手名の配列
 * @param isGoodYear - 豊作年フラグ
 * @param isGodlyYear - 大豊作年フラグ
 * @returns 生成された新人選手
 */
function generateNewPlayer(existingNames: string[], isGoodYear: boolean, isGodlyYear: boolean): Player {
  const origin = randomWeighted(DRAFT_ORIGIN_RATES as Record<PlayerOrigin, number>);
  const age = origin === 'highSchool' ? 18
    : origin === 'college' ? 22
    : origin === 'industrial' ? 24
    : randomInt(22, 28);

  const isPitcher = chance(0.45); // 45%の確率で投手
  const position: Position = isPitcher ? 'P' : randomChoice(FIELDER_POSITIONS);

  // 基礎能力値の決定
  let baseMin = 20;
  let baseMax = 45;
  if (isGodlyYear) {
    baseMin = 35;
    baseMax = 60;
  } else if (isGoodYear) {
    baseMin = 28;
    baseMax = 52;
  }

  // 出身による能力補正
  if (origin === 'highSchool') {
    baseMax -= 5; // 高卒は即戦力度が低い
  } else if (origin === 'college' || origin === 'industrial') {
    baseMin += 5; // 大卒・社会人は即戦力度が高い
  }

  const baseAbility = randomInt(baseMin, baseMax);

  // ポテンシャル上限
  let potentialMin = 55;
  let potentialMax = 85;
  if (isGodlyYear) {
    potentialMin = 70;
    potentialMax = 100;
  } else if (isGoodYear) {
    potentialMin = 60;
    potentialMax = 95;
  }
  // 高卒はポテンシャルが高くなりやすい
  if (origin === 'highSchool') {
    potentialMin += 5;
    potentialMax = Math.min(100, potentialMax + 5);
  }
  const potentialCap = randomInt(potentialMin, potentialMax);

  // 成長タイプ
  const growthWeights: Record<GrowthType, number> = {
    early: origin === 'highSchool' ? 0.1 : 0.2,
    normal: 0.35,
    late: origin === 'highSchool' ? 0.3 : 0.15,
    unstable: 0.1,
    lateBloom: origin === 'highSchool' ? 0.15 : 0.2,
  };
  const growthType = randomWeighted(growthWeights);

  // 利き手
  const throwHand: ThrowHand = chance(0.75) ? 'right' : 'left';
  const batHand: BatHand = chance(0.65) ? 'right' : chance(0.5) ? 'left' : 'switch';

  // 変化球（投手のみ）
  const pitches = isPitcher
    ? Array.from({ length: randomInt(2, 4) }, () => ({
        type: randomChoice(PITCH_TYPES),
        level: randomInt(1, 4),
      }))
    : [];

  // サブポジション（野手のみ、30%の確率で1つ）
  const subPositions: Partial<Record<Position, number>> = {};
  if (!isPitcher && chance(0.3)) {
    const subPos = randomChoice(FIELDER_POSITIONS.filter((p) => p !== position));
    subPositions[subPos] = randomInt(30, 60);
  }

  const name = generateName(existingNames);
  existingNames.push(name);

  return {
    id: generateId(),
    name,
    age,
    teamId: '',
    position,
    subPositions,
    pitcherRole: isPitcher ? randomChoice(PITCHER_ROLES) : null,
    throwHand,
    batHand,
    batterStats: {
      meet: baseAbility + randomInt(-8, 8),
      power: baseAbility + randomInt(-8, 8),
      speed: baseAbility + randomInt(-8, 8),
      fielding: baseAbility + randomInt(-5, 5),
      arm: baseAbility + randomInt(-5, 5),
      eye: baseAbility + randomInt(-5, 5),
    },
    pitcherStats: isPitcher ? {
      velocity: baseAbility + randomInt(-5, 15),
      control: baseAbility + randomInt(-5, 8),
      breaking: baseAbility + randomInt(-5, 8),
      stamina: baseAbility + randomInt(0, 15),
    } : null,
    pitches,
    growthType,
    potential: isPitcher
      ? { velocity: potentialCap, control: potentialCap - 5, breaking: potentialCap - 5, stamina: potentialCap - 10 }
      : { meet: potentialCap, power: potentialCap - 5, speed: potentialCap - 5, fielding: potentialCap - 10, arm: potentialCap - 10, eye: potentialCap - 5 },
    uniqueAbilities: [],
    normalAbilities: [],
    awakeningAbilities: [],
    condition: 'normal',
    awakening: { gauge: 0, isAwakened: false, type: null, remainingYears: 0 },
    slump: { isInSlump: false, remainingCards: 0 },
    injury: { isInjured: false, name: '', severity: 'minor', remainingCards: 0, hadTommyJohn: false },
    contract: { salary: 1000, remainingYears: 0, promise: null, promiseKept: null },
    isFirstTeam: false,
    isDevelopment: false,
    isForeign: false,
    isTwoWay: false,
    isLegend: false,
    yearsInFirstTeam: 0,
    yearsAsPro: 0,
    origin,
    currentBatterStats: emptyBatterSeasonStats(),
    currentPitcherStats: emptyPitcherSeasonStats(),
    careerStats: {
      seasons: 0,
      batterStats: emptyBatterSeasonStats(),
      pitcherStats: emptyPitcherSeasonStats(),
    },
    demotionCooldown: 0,
    farmConsecutiveYears: 0,
    isDisgruntled: false,
    isReturnedFromOverseas: false,
    reincarnationSource: null,
  };
}

/**
 * ドラフト候補選手を生成する
 * 転生選手を3-7人混ぜ、残りは新規生成で80-120人の候補を作成
 * @param reincarnationPool - 転生プール
 * @param existingPlayerNames - 既存選手名の配列
 * @returns ドラフト候補選手の配列
 */
export function generateDraftCandidates(
  reincarnationPool: ReincarnationEntry[],
  existingPlayerNames: string[],
): Player[] {
  const candidates: Player[] = [];
  const usedNames = [...existingPlayerNames];

  // 豊作年・大豊作年の判定
  const isGodlyYear = chance(DRAFT_GODLY_YEAR_CHANCE);
  const isGoodYear = !isGodlyYear && chance(DRAFT_GOOD_YEAR_CHANCE);

  // 転生選手を生成
  const reincarnationCount = randomInt(
    DRAFT_REINCARNATION_RANGE.min,
    Math.min(DRAFT_REINCARNATION_RANGE.max, reincarnationPool.length),
  );
  const selectedEntries = reincarnationPool.slice(0, reincarnationCount);

  for (const entry of selectedEntries) {
    const reincarnated = generateReincarnatedPlayer(entry, usedNames);
    if (reincarnated) {
      candidates.push(reincarnated);
      usedNames.push(reincarnated.name);
    }
  }

  // 残りを新規選手で埋める
  const totalCandidates = randomInt(DRAFT_CANDIDATES_RANGE.min, DRAFT_CANDIDATES_RANGE.max);
  const newCount = totalCandidates - candidates.length;

  for (let i = 0; i < newCount; i++) {
    candidates.push(generateNewPlayer(usedNames, isGoodYear, isGodlyYear));
  }

  return candidates;
}

/**
 * チームの弱点ポジションを特定する
 * @param team - 球団オブジェクト
 * @param allPlayers - 全選手データ
 * @returns 最も弱いポジション
 */
function findTeamWeakestPosition(team: Team, allPlayers: Player[]): Position {
  const teamPlayers = allPlayers.filter((p) => p.teamId === team.id);
  const positionCounts: Partial<Record<Position, number>> = {};

  for (const player of teamPlayers) {
    positionCounts[player.position] = (positionCounts[player.position] ?? 0) + 1;
  }

  // 投手が少ないか野手が少ないか判断
  const pitcherCount = positionCounts['P'] ?? 0;
  const fielderCount = teamPlayers.length - pitcherCount;

  // 投手が少なければ投手を優先
  if (pitcherCount < 12) return 'P';

  // 各野手ポジションでカバーが薄いところ
  let weakestPos: Position = 'CF';
  let minCount = Infinity;
  for (const pos of FIELDER_POSITIONS) {
    const count = positionCounts[pos] ?? 0;
    if (count < minCount) {
      minCount = count;
      weakestPos = pos;
    }
  }

  // 野手全体が少ない場合
  if (fielderCount < 15) return weakestPos;

  return weakestPos;
}

/**
 * ドラフト会議を実施する
 * 最大8巡（DRAFT_MAX_ROUNDS）、各チームは弱点ポジションを優先して指名
 * @param candidates - ドラフト候補選手の配列
 * @param teams - 全球団の配列
 * @param allPlayers - 既存の全選手データ
 * @returns ドラフト指名結果の配列
 */
export function conductDraft(
  candidates: Player[],
  teams: Team[],
  allPlayers: Player[],
): { teamId: string; playerId: string; round: number }[] {
  const picks: { teamId: string; playerId: string; round: number }[] = [];
  const remainingCandidates = [...candidates];
  const currentPlayers = [...allPlayers];

  // 前年順位の逆順（下位チームから指名）で仮の指名順を決める
  // TeamRecordの勝率で降順ソート → 勝率が低いチームが先に指名
  const sortedTeams = [...teams].sort((a, b) => {
    const aGames = a.record.wins + a.record.losses;
    const bGames = b.record.wins + b.record.losses;
    const aRate = aGames > 0 ? a.record.wins / aGames : 0.5;
    const bRate = bGames > 0 ? b.record.wins / bGames : 0.5;
    return aRate - bRate; // 勝率が低い順
  });

  for (let round = 1; round <= DRAFT_MAX_ROUNDS; round++) {
    for (const team of sortedTeams) {
      if (remainingCandidates.length === 0) break;

      // 弱点ポジションを特定
      const weakPosition = findTeamWeakestPosition(team, currentPlayers);

      // 弱点ポジションの候補を探す
      let target = remainingCandidates.find((c) => c.position === weakPosition);

      // 見つからない場合は能力値が最も高い候補を選ぶ
      if (!target) {
        const sorted = [...remainingCandidates].sort((a, b) => {
          const aVal = a.position === 'P' && a.pitcherStats
            ? (a.pitcherStats.velocity + a.pitcherStats.control + a.pitcherStats.breaking) / 3
            : (a.batterStats.meet + a.batterStats.power + a.batterStats.speed) / 3;
          const bVal = b.position === 'P' && b.pitcherStats
            ? (b.pitcherStats.velocity + b.pitcherStats.control + b.pitcherStats.breaking) / 3
            : (b.batterStats.meet + b.batterStats.power + b.batterStats.speed) / 3;
          return bVal - aVal;
        });
        target = sorted[0];
      }

      if (target) {
        // 指名確定
        const idx = remainingCandidates.indexOf(target);
        remainingCandidates.splice(idx, 1);

        target.teamId = team.id;
        picks.push({
          teamId: team.id,
          playerId: target.id,
          round,
        });

        currentPlayers.push(target);
      }
    }
  }

  return picks;
}
