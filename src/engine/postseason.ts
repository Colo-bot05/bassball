import type { Team } from '@/types/team';
import type { Player } from '@/types/player';
import type { GameResult } from '@/types/game';
import { simulateGame } from '@/engine/simulation';
import { calculateStandings } from '@/engine/season';

/** ポストシーズンの結果 */
export interface PostseasonResult {
  csFirstResults: { central: SeriesResult; pacific: SeriesResult };
  csFinalResults: { central: SeriesResult; pacific: SeriesResult };
  japanSeriesResult: SeriesResult;
  champion: string;
}

/** シリーズ結果 */
export interface SeriesResult {
  team1Id: string;
  team2Id: string;
  team1Wins: number;
  team2Wins: number;
  winnerId: string;
  games: GameResult[];
}

/** シリーズを実行（先にwinsNeeded勝した方が勝ち） */
function playSeries(
  team1: Team,
  team2: Team,
  players: Player[],
  winsNeeded: number,
  team1Advantage: number,
): SeriesResult {
  let team1Wins = team1Advantage;
  let team2Wins = 0;
  const games: GameResult[] = [];
  const useDH = team1.league === 'pacific' || team2.league === 'pacific';

  while (team1Wins < winsNeeded && team2Wins < winsNeeded) {
    const isTeam1Home = games.length % 2 === 0;
    const home = isTeam1Home ? team1 : team2;
    const away = isTeam1Home ? team2 : team1;
    const result = simulateGame(home, away, players, useDH);
    games.push(result);

    const homeScore = result.inningScores.reduce((s, i) => s + i.home, 0);
    const awayScore = result.inningScores.reduce((s, i) => s + i.away, 0);

    if (homeScore === awayScore) continue; // 引き分け再試合

    if (isTeam1Home) {
      if (homeScore > awayScore) team1Wins++;
      else team2Wins++;
    } else {
      if (awayScore > homeScore) team1Wins++;
      else team2Wins++;
    }
  }

  return {
    team1Id: team1.id,
    team2Id: team2.id,
    team1Wins,
    team2Wins,
    winnerId: team1Wins >= winsNeeded ? team1.id : team2.id,
    games,
  };
}

/**
 * ポストシーズンを実行
 * CS ファーストステージ: 2位 vs 3位（3試合制・2勝先勝）
 * CS ファイナルステージ: 1位 vs ファースト勝者（6試合制・4勝先勝、1位に1勝アドバンテージ）
 * 日本シリーズ: 7試合制・4勝先勝
 */
export function runPostseason(teams: Team[], players: Player[]): PostseasonResult {
  const centralStandings = calculateStandings(teams, 'central');
  const pacificStandings = calculateStandings(teams, 'pacific');

  const getTeam = (id: string) => teams.find((t) => t.id === id)!;

  // CS ファーストステージ
  const cFirstCentral = playSeries(
    getTeam(centralStandings[1].teamId),
    getTeam(centralStandings[2].teamId),
    players, 2, 0,
  );
  const cFirstPacific = playSeries(
    getTeam(pacificStandings[1].teamId),
    getTeam(pacificStandings[2].teamId),
    players, 2, 0,
  );

  // CS ファイナルステージ（1位チームに1勝アドバンテージ）
  const cFinalCentral = playSeries(
    getTeam(centralStandings[0].teamId),
    getTeam(cFirstCentral.winnerId),
    players, 4, 1,
  );
  const cFinalPacific = playSeries(
    getTeam(pacificStandings[0].teamId),
    getTeam(cFirstPacific.winnerId),
    players, 4, 1,
  );

  // 日本シリーズ
  const japanSeries = playSeries(
    getTeam(cFinalCentral.winnerId),
    getTeam(cFinalPacific.winnerId),
    players, 4, 0,
  );

  return {
    csFirstResults: { central: cFirstCentral, pacific: cFirstPacific },
    csFinalResults: { central: cFinalCentral, pacific: cFinalPacific },
    japanSeriesResult: japanSeries,
    champion: japanSeries.winnerId,
  };
}
