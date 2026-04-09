import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import {
  GOLDEN_ERA_TRIGGER_RATE,
  GOLDEN_ERA_DURATION,
  GOLDEN_ERA_STAT_BOOST,
} from '@/constants/balance';
import { randomInt, chance, shuffle } from '@/utils/random';

/**
 * AIモードを更新する
 * 3年以上負け越し→再建モード、2年連続勝ち越し→contender
 */
export function updateAIMode(team: Team): void {
  if (team.isPlayerControlled) return;

  if (team.record.losses > team.record.wins) {
    if (team.ai.mode === 'rebuilding') return;
    // 簡易的に：負け越している→再建モード寄りにシフト
    team.ai.mode = 'rebuilding';
    team.ai.winNowMode = Math.max(0, team.ai.winNowMode - 0.2);
  } else if (team.record.wins > team.record.losses) {
    team.ai.mode = 'contender';
    team.ai.winNowMode = Math.min(1, team.ai.winNowMode + 0.1);
  }
}

/**
 * AIのドラフト指名ロジック
 * 球団タイプと弱点に基づいて候補を選ぶ
 */
export function aiSelectDraftPick(
  team: Team,
  candidates: Player[],
  allPlayers: Player[],
): Player | null {
  if (candidates.length === 0) return null;

  const teamPlayers = allPlayers.filter((p) => team.playerIds.includes(p.id));
  const pitcherCount = teamPlayers.filter((p) => p.position === 'P').length;
  const batterCount = teamPlayers.filter((p) => p.position !== 'P').length;
  const needPitcher = pitcherCount < batterCount * 0.6;

  // スコアリング
  const scored = candidates.map((c) => {
    let score = 0;

    // ポジション需要
    if (needPitcher && c.position === 'P') score += 20;
    if (!needPitcher && c.position !== 'P') score += 15;

    // 投手王国型は投手を優先
    if (team.ai.teamType === 'pitching' && c.position === 'P') score += 15;
    if (team.ai.teamType === 'hitting' && c.position !== 'P') score += 15;

    // 育成型は若い選手を好む
    if (team.ai.draftFocus > 0.7 && c.age <= 18) score += 20;
    if (team.ai.draftFocus > 0.7 && c.origin === 'highSchool') score += 10;

    // 即戦力型は大学/社会人を好む
    if (team.ai.winNowMode > 0.7 && c.age >= 22) score += 15;

    // 基本能力
    if (c.position === 'P' && c.pitcherStats) {
      score += (c.pitcherStats.velocity + c.pitcherStats.control) / 4;
    } else {
      score += (c.batterStats.meet + c.batterStats.power) / 4;
    }

    // レジェンドボーナス
    if (c.isLegend) score += 25;

    return { player: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.player ?? null;
}

/**
 * AIのFA参加判断
 */
export function aiDecideFA(
  team: Team,
  faPlayer: Player,
): { interested: boolean; offerSalary: number } {
  if (team.isPlayerControlled) return { interested: false, offerSalary: 0 };

  // 再建型・育成型はFAに消極的
  if (team.ai.mode === 'rebuilding' && faPlayer.age >= 30) {
    return { interested: false, offerSalary: 0 };
  }

  if (team.ai.budgetMode < 0.4) {
    return { interested: false, offerSalary: 0 };
  }

  // 金満型は積極的
  const interest = team.ai.budgetMode * 0.5 + team.ai.winNowMode * 0.3;
  if (!chance(interest)) {
    return { interested: false, offerSalary: 0 };
  }

  const baseSalary = faPlayer.contract.salary;
  const multiplier = 1.0 + team.ai.budgetMode * 0.3;
  const offerSalary = Math.round(baseSalary * multiplier);

  return { interested: true, offerSalary };
}

/**
 * AIのトレード評価
 */
export function aiEvaluateTradeProposal(
  team: Team,
  receiving: Player[],
  giving: Player[],
): boolean {
  if (team.isPlayerControlled) return false;

  const receivingValue = receiving.reduce((sum, p) => {
    const stats = p.position === 'P' && p.pitcherStats
      ? p.pitcherStats.velocity + p.pitcherStats.control
      : p.batterStats.meet + p.batterStats.power;
    const ageFactor = Math.max(0.5, 1 - (p.age - 25) * 0.05);
    return sum + stats * ageFactor;
  }, 0);

  const givingValue = giving.reduce((sum, p) => {
    const stats = p.position === 'P' && p.pitcherStats
      ? p.pitcherStats.velocity + p.pitcherStats.control
      : p.batterStats.meet + p.batterStats.power;
    const ageFactor = Math.max(0.5, 1 - (p.age - 25) * 0.05);
    return sum + stats * ageFactor;
  }, 0);

  // AIは慎重（1.2倍の価値が必要）
  const threshold = team.ai.teamType === 'rebuilding' ? 1.5 : 1.2;
  return receivingValue > givingValue * threshold;
}

/**
 * AIの自動ラインナップ設定
 */
export function aiSetLineup(team: Team, allPlayers: Player[]): void {
  const teamPlayers = allPlayers.filter(
    (p) => team.playerIds.includes(p.id) && p.isFirstTeam && !p.injury.isInjured,
  );

  const pitchers = teamPlayers.filter((p) => p.position === 'P');
  const fielders = teamPlayers.filter((p) => p.position !== 'P');

  // 野手を能力順にソート（育成型は若手優先、勝利型はベテラン優先）
  const sortedFielders = [...fielders].sort((a, b) => {
    const aTotal = a.batterStats.meet + a.batterStats.power + a.batterStats.speed;
    const bTotal = b.batterStats.meet + b.batterStats.power + b.batterStats.speed;

    if (team.ai.mode === 'contender') {
      return bTotal - aTotal; // 純粋に能力順
    }
    // 育成モード：若手にボーナス
    const aScore = aTotal + (a.age < 26 ? 30 : 0);
    const bScore = bTotal + (b.age < 26 ? 30 : 0);
    return bScore - aScore;
  });

  // 打順設定（最大9人）
  const lineup = sortedFielders.slice(0, 9);
  team.lineup.order = lineup.map((p) => p.id);
  team.lineup.positions = Object.fromEntries(
    lineup.map((p) => [p.id, p.position]),
  );
  team.lineup.dhPlayerId = team.league === 'pacific' && lineup.length > 0 ? lineup[0].id : null;

  // 先発ローテーション
  const starters = pitchers
    .filter((p) => p.pitcherRole === 'starter')
    .sort((a, b) => {
      const aP = a.pitcherStats ? a.pitcherStats.velocity + a.pitcherStats.control : 0;
      const bP = b.pitcherStats ? b.pitcherStats.velocity + b.pitcherStats.control : 0;
      return bP - aP;
    })
    .slice(0, 6);
  team.rotation.starters = starters.map((p) => p.id);

  // 抑え・セットアッパー
  const relievers = pitchers.filter((p) => p.pitcherRole !== 'starter');
  const closer = relievers.find((p) => p.pitcherRole === 'closer')
    ?? relievers.sort((a, b) => {
      const aP = a.pitcherStats ? a.pitcherStats.velocity : 0;
      const bP = b.pitcherStats ? b.pitcherStats.velocity : 0;
      return bP - aP;
    })[0];
  const setups = relievers
    .filter((p) => p.id !== closer?.id)
    .slice(0, 2);

  team.bullpen.closerId = closer?.id ?? null;
  team.bullpen.setupIds = setups.map((p) => p.id);
}

/**
 * 黄金期の判定
 * プレイヤーが2連覇以上 or 勝率.620以上で30%の確率で発動
 */
export function checkGoldenEra(
  teams: Team[],
  playerTeamId: string,
  playerWinRate: number,
  consecutiveChampionships: number,
): void {
  const shouldTrigger = consecutiveChampionships >= 2 || playerWinRate >= 0.620;
  if (!shouldTrigger) return;
  if (!chance(GOLDEN_ERA_TRIGGER_RATE)) return;

  // 既に黄金期中の球団を除外
  const eligible = teams.filter(
    (t) => t.id !== playerTeamId && !t.goldenEra.isActive,
  );
  if (eligible.length === 0) return;

  const shuffled = shuffle(eligible);
  const target = shuffled[0];
  target.goldenEra = {
    isActive: true,
    remainingYears: randomInt(GOLDEN_ERA_DURATION.min, GOLDEN_ERA_DURATION.max),
  };
}

/**
 * 黄金期バフを適用
 */
export function applyGoldenEraBuffs(team: Team, allPlayers: Player[]): void {
  if (!team.goldenEra.isActive) return;

  const teamPlayers = allPlayers
    .filter((p) => team.playerIds.includes(p.id))
    .sort((a, b) => {
      const aVal = a.position === 'P' && a.pitcherStats
        ? a.pitcherStats.velocity + a.pitcherStats.control
        : a.batterStats.meet + a.batterStats.power;
      const bVal = b.position === 'P' && b.pitcherStats
        ? b.pitcherStats.velocity + b.pitcherStats.control
        : b.batterStats.meet + b.batterStats.power;
      return bVal - aVal;
    })
    .slice(0, 5);

  for (const player of teamPlayers) {
    if (player.position === 'P' && player.pitcherStats) {
      player.pitcherStats.velocity = Math.min(100, player.pitcherStats.velocity + GOLDEN_ERA_STAT_BOOST);
      player.pitcherStats.control = Math.min(100, player.pitcherStats.control + GOLDEN_ERA_STAT_BOOST);
    } else {
      player.batterStats.meet = Math.min(100, player.batterStats.meet + GOLDEN_ERA_STAT_BOOST);
      player.batterStats.power = Math.min(100, player.batterStats.power + GOLDEN_ERA_STAT_BOOST);
    }
  }
}

/**
 * 黄金期のカウントダウン
 */
export function tickGoldenEra(team: Team): void {
  if (!team.goldenEra.isActive) return;

  team.goldenEra.remainingYears--;
  if (team.goldenEra.remainingYears <= 0) {
    team.goldenEra.isActive = false;
    team.goldenEra.remainingYears = 0;
  }
}
