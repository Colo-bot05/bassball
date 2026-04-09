import type { Player } from '@/types/player';
import type { Team } from '@/types/team';

/** タイトル結果 */
export interface TitleResult {
  title: string;
  playerName: string;
  teamName: string;
  value: string;
}

/** 規定打席数（試合数 × 3.1） */
const QUALIFYING_AT_BATS = 443;

/** 規定投球回（試合数 × 1.0） */
const QUALIFYING_INNINGS = 143;

/**
 * 打率を計算する
 * @param hits - 安打数
 * @param atBats - 打数
 * @returns 打率
 */
function calcBattingAvg(hits: number, atBats: number): number {
  if (atBats === 0) return 0;
  return hits / atBats;
}

/**
 * 防御率を計算する
 * @param earnedRuns - 自責点
 * @param inningsPitched - 投球回
 * @returns 防御率
 */
function calcERA(earnedRuns: number, inningsPitched: number): number {
  if (inningsPitched === 0) return Infinity;
  return (earnedRuns * 9) / inningsPitched;
}

/**
 * チームIDから球団名を取得する
 * @param teamId - 球団ID
 * @param teams - 全球団
 * @returns 球団名
 */
function getTeamName(teamId: string, teams: Team[]): string {
  return teams.find((t) => t.id === teamId)?.name ?? '不明';
}

/**
 * 打撃・投手のリーグタイトルを計算する
 * 首位打者、HR王、打点王、盗塁王、最多勝、最優秀防御率、最多奪三振、最多セーブ、MVP、新人王を選出
 * @param players - 全選手
 * @param teams - 全球団
 * @returns タイトル結果の配列
 */
export function calculateTitles(players: Player[], teams: Team[]): TitleResult[] {
  const titles: TitleResult[] = [];

  // リーグごとに処理
  const leagues = ['central', 'pacific'] as const;
  for (const league of leagues) {
    const leaguePrefix = league === 'central' ? 'セ・' : 'パ・';
    const leagueTeamIds = teams
      .filter((t) => t.league === league)
      .map((t) => t.id);
    const leaguePlayers = players.filter((p) => leagueTeamIds.includes(p.teamId));

    // 規定打席到達者
    const qualifiedBatters = leaguePlayers.filter(
      (p) => p.position !== 'P' && p.currentBatterStats.atBats >= QUALIFYING_AT_BATS,
    );

    // 規定投球回到達者
    const qualifiedPitchers = leaguePlayers.filter(
      (p) => p.position === 'P' && p.currentPitcherStats.inningsPitched >= QUALIFYING_INNINGS,
    );

    // --- 首位打者 ---
    if (qualifiedBatters.length > 0) {
      const sorted = [...qualifiedBatters].sort(
        (a, b) =>
          calcBattingAvg(b.currentBatterStats.hits, b.currentBatterStats.atBats) -
          calcBattingAvg(a.currentBatterStats.hits, a.currentBatterStats.atBats),
      );
      const winner = sorted[0];
      const avg = calcBattingAvg(winner.currentBatterStats.hits, winner.currentBatterStats.atBats);
      titles.push({
        title: `${leaguePrefix}首位打者`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `.${Math.round(avg * 1000).toString().padStart(3, '0')}`,
      });
    }

    // --- 本塁打王 ---
    if (qualifiedBatters.length > 0) {
      const sorted = [...qualifiedBatters].sort(
        (a, b) => b.currentBatterStats.homeRuns - a.currentBatterStats.homeRuns,
      );
      const winner = sorted[0];
      titles.push({
        title: `${leaguePrefix}本塁打王`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `${winner.currentBatterStats.homeRuns}本`,
      });
    }

    // --- 盗塁王 ---
    const baseSteelers = leaguePlayers.filter(
      (p) => p.position !== 'P' && p.currentBatterStats.stolenBases > 0,
    );
    if (baseSteelers.length > 0) {
      const sorted = [...baseSteelers].sort(
        (a, b) => b.currentBatterStats.stolenBases - a.currentBatterStats.stolenBases,
      );
      const winner = sorted[0];
      titles.push({
        title: `${leaguePrefix}盗塁王`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `${winner.currentBatterStats.stolenBases}盗塁`,
      });
    }

    // --- 最多勝 ---
    const winPitchers = leaguePlayers.filter(
      (p) => p.position === 'P' && p.currentPitcherStats.wins > 0,
    );
    if (winPitchers.length > 0) {
      const sorted = [...winPitchers].sort(
        (a, b) => b.currentPitcherStats.wins - a.currentPitcherStats.wins,
      );
      const winner = sorted[0];
      titles.push({
        title: `${leaguePrefix}最多勝`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `${winner.currentPitcherStats.wins}勝`,
      });
    }

    // --- 最優秀防御率 ---
    if (qualifiedPitchers.length > 0) {
      const sorted = [...qualifiedPitchers].sort(
        (a, b) =>
          calcERA(a.currentPitcherStats.earnedRuns, a.currentPitcherStats.inningsPitched) -
          calcERA(b.currentPitcherStats.earnedRuns, b.currentPitcherStats.inningsPitched),
      );
      const winner = sorted[0];
      const era = calcERA(winner.currentPitcherStats.earnedRuns, winner.currentPitcherStats.inningsPitched);
      titles.push({
        title: `${leaguePrefix}最優秀防御率`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: era.toFixed(2),
      });
    }

    // --- 最多奪三振 ---
    const kPitchers = leaguePlayers.filter(
      (p) => p.position === 'P' && p.currentPitcherStats.strikeouts > 0,
    );
    if (kPitchers.length > 0) {
      const sorted = [...kPitchers].sort(
        (a, b) => b.currentPitcherStats.strikeouts - a.currentPitcherStats.strikeouts,
      );
      const winner = sorted[0];
      titles.push({
        title: `${leaguePrefix}最多奪三振`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `${winner.currentPitcherStats.strikeouts}奪三振`,
      });
    }

    // --- 最多セーブ ---
    const savePitchers = leaguePlayers.filter(
      (p) => p.position === 'P' && p.currentPitcherStats.saves > 0,
    );
    if (savePitchers.length > 0) {
      const sorted = [...savePitchers].sort(
        (a, b) => b.currentPitcherStats.saves - a.currentPitcherStats.saves,
      );
      const winner = sorted[0];
      titles.push({
        title: `${leaguePrefix}最多セーブ`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: `${winner.currentPitcherStats.saves}セーブ`,
      });
    }

    // --- MVP ---
    // 打者: 打率×100 + HR×3 + 打点×0.5 + 盗塁×2
    // 投手: 勝利数×5 + セーブ×3 + 奪三振×0.3 - 防御率×10
    const mvpCandidates = leaguePlayers
      .filter((p) => p.currentBatterStats.games >= 50 || p.currentPitcherStats.games >= 20)
      .map((p) => {
        let score = 0;
        if (p.position !== 'P') {
          const avg = calcBattingAvg(p.currentBatterStats.hits, p.currentBatterStats.atBats);
          score =
            avg * 100 +
            p.currentBatterStats.homeRuns * 3 +
            p.currentBatterStats.rbi * 0.5 +
            p.currentBatterStats.stolenBases * 2;
        } else {
          const era = calcERA(p.currentPitcherStats.earnedRuns, p.currentPitcherStats.inningsPitched);
          score =
            p.currentPitcherStats.wins * 5 +
            p.currentPitcherStats.saves * 3 +
            p.currentPitcherStats.strikeouts * 0.3 -
            (era === Infinity ? 30 : era * 10);
        }
        return { player: p, score };
      })
      .sort((a, b) => b.score - a.score);

    if (mvpCandidates.length > 0) {
      const winner = mvpCandidates[0].player;
      titles.push({
        title: `${leaguePrefix}MVP`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: winner.position === 'P'
          ? `${winner.currentPitcherStats.wins}勝`
          : `.${Math.round(calcBattingAvg(winner.currentBatterStats.hits, winner.currentBatterStats.atBats) * 1000).toString().padStart(3, '0')}`,
      });
    }

    // --- 新人王 ---
    const rookies = leaguePlayers.filter((p) => p.yearsAsPro <= 1);
    const rookieCandidates = rookies
      .filter((p) => p.currentBatterStats.games >= 30 || p.currentPitcherStats.games >= 10)
      .map((p) => {
        let score = 0;
        if (p.position !== 'P') {
          const avg = calcBattingAvg(p.currentBatterStats.hits, p.currentBatterStats.atBats);
          score = avg * 80 + p.currentBatterStats.homeRuns * 3 + p.currentBatterStats.rbi * 0.5;
        } else {
          const era = calcERA(p.currentPitcherStats.earnedRuns, p.currentPitcherStats.inningsPitched);
          score = p.currentPitcherStats.wins * 5 + p.currentPitcherStats.strikeouts * 0.3 - (era === Infinity ? 30 : era * 10);
        }
        return { player: p, score };
      })
      .sort((a, b) => b.score - a.score);

    if (rookieCandidates.length > 0) {
      const winner = rookieCandidates[0].player;
      titles.push({
        title: `${leaguePrefix}新人王`,
        playerName: winner.name,
        teamName: getTeamName(winner.teamId, teams),
        value: winner.position === 'P'
          ? `${winner.currentPitcherStats.wins}勝`
          : `${winner.currentBatterStats.hits}安打`,
      });
    }
  }

  return titles;
}

/**
 * 殿堂入り資格をチェックする
 * 条件: 引退後3年以上経過 かつ (通算2000安打以上 / 通算200勝以上 / 通算250セーブ以上 / MVP3回以上)
 * @param retiredPlayers - 引退選手データの配列
 * @returns 殿堂入り資格のある選手名の配列
 */
export function checkHallOfFame(
  retiredPlayers: {
    name: string;
    career: string;
    retiredYearsAgo: number;
    totalHits: number;
    totalWins: number;
    totalSaves: number;
    mvpCount: number;
  }[],
): string[] {
  return retiredPlayers
    .filter((p) => {
      // 引退後3年以上経過が必要
      if (p.retiredYearsAgo < 3) return false;

      // いずれかの条件を満たす
      return (
        p.totalHits >= 2000 ||
        p.totalWins >= 200 ||
        p.totalSaves >= 250 ||
        p.mvpCount >= 3
      );
    })
    .map((p) => p.name);
}
