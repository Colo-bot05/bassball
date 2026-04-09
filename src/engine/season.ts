import type { Team } from '@/types/team';
import type { MatchCard } from '@/types/game';
import { shuffle } from '@/utils/random';

/**
 * シーズンの対戦カードを生成（143試合分）
 * 同一リーグ5球団×25試合 = 125試合
 * 交流戦：他リーグ6球団×3試合 = 18試合
 * 合計143試合 → 3試合1カード ≒ 48カード
 */
export function generateSchedule(teams: Team[]): MatchCard[] {
  const central = teams.filter((t) => t.league === 'central');
  const pacific = teams.filter((t) => t.league === 'pacific');
  const matchups: { home: string; away: string }[] = [];

  // 同一リーグの対戦（各ペア25試合 = 13H + 12A or 12H + 13A）
  for (const leagueTeams of [central, pacific]) {
    for (let i = 0; i < leagueTeams.length; i++) {
      for (let j = i + 1; j < leagueTeams.length; j++) {
        const teamA = leagueTeams[i].id;
        const teamB = leagueTeams[j].id;
        // 13試合ホーム、12試合アウェイ（交互に設定）
        for (let g = 0; g < 25; g++) {
          if (g % 2 === 0) {
            matchups.push({ home: teamA, away: teamB });
          } else {
            matchups.push({ home: teamB, away: teamA });
          }
        }
      }
    }
  }

  // 交流戦（各球団がホーム/アウェイを振り分け）
  for (const cTeam of central) {
    for (const pTeam of pacific) {
      // 3試合：2H1A or 1H2A を交互
      const homeFirst = central.indexOf(cTeam) % 2 === 0;
      if (homeFirst) {
        matchups.push({ home: cTeam.id, away: pTeam.id });
        matchups.push({ home: cTeam.id, away: pTeam.id });
        matchups.push({ home: pTeam.id, away: cTeam.id });
      } else {
        matchups.push({ home: pTeam.id, away: cTeam.id });
        matchups.push({ home: pTeam.id, away: cTeam.id });
        matchups.push({ home: cTeam.id, away: pTeam.id });
      }
    }
  }

  // シャッフルしてカードに分割
  const shuffled = shuffle(matchups);

  // 3試合ずつカードにまとめる（同じ対戦カードの3連戦を作る）
  const cards: MatchCard[] = [];
  const grouped = groupIntoSeries(shuffled);

  let cardNumber = 1;
  for (const series of grouped) {
    cards.push({
      homeTeamId: series[0].home,
      awayTeamId: series[0].away,
      cardNumber,
      results: [],
      isPlayed: false,
    });
    cardNumber++;
  }

  return cards;
}

/**
 * 試合リストを3連戦のグループにまとめる
 * 同じホーム/アウェイの組み合わせを3試合ずつグループ化
 */
function groupIntoSeries(
  matchups: { home: string; away: string }[],
): { home: string; away: string }[][] {
  const remaining = [...matchups];
  const series: { home: string; away: string }[][] = [];

  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const group = [first];

    // 同じ対戦を2つ探す
    for (let needed = 0; needed < 2 && remaining.length > 0; needed++) {
      const idx = remaining.findIndex(
        (m) => m.home === first.home && m.away === first.away,
      );
      if (idx >= 0) {
        group.push(remaining.splice(idx, 1)[0]);
      } else {
        // 見つからない場合は逆パターンも含めて探す
        const revIdx = remaining.findIndex(
          (m) => m.home === first.away && m.away === first.home,
        );
        if (revIdx >= 0) {
          group.push(remaining.splice(revIdx, 1)[0]);
        } else if (remaining.length > 0) {
          // それでも見つからない場合は次の試合を追加
          group.push(remaining.shift()!);
        }
      }
    }

    series.push(group);
  }

  return series;
}

/** 順位表のエントリ */
export interface StandingsEntry {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  gamesBehind: number;
  rank: number;
  runsScored: number;
  runsAllowed: number;
}

/**
 * 順位表を計算する
 * 勝率で順位を決定。同率の場合は勝利数が多い方が上位。
 */
export function calculateStandings(
  teams: Team[],
  league: 'central' | 'pacific',
): StandingsEntry[] {
  const leagueTeams = teams.filter((t) => t.league === league);

  const entries: StandingsEntry[] = leagueTeams.map((t) => {
    const totalGames = t.record.wins + t.record.losses;
    const winRate = totalGames > 0 ? t.record.wins / totalGames : 0;
    return {
      teamId: t.id,
      teamName: t.name,
      wins: t.record.wins,
      losses: t.record.losses,
      draws: t.record.draws,
      winRate: Math.round(winRate * 1000) / 1000,
      gamesBehind: 0,
      rank: 0,
      runsScored: t.record.runsScored,
      runsAllowed: t.record.runsAllowed,
    };
  });

  // 勝率でソート（同率なら勝利数で）
  entries.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.wins - a.wins;
  });

  // 順位とゲーム差を計算
  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
    if (i === 0) {
      entries[i].gamesBehind = 0;
    } else {
      const leader = entries[0];
      const gb = (leader.wins - entries[i].wins - (leader.losses - entries[i].losses)) / 2;
      entries[i].gamesBehind = Math.round(gb * 10) / 10;
    }
  }

  return entries;
}

/**
 * チームの成績を更新する（試合結果を反映）
 */
export function updateTeamRecord(
  team: Team,
  homeScore: number,
  awayScore: number,
  isHome: boolean,
): void {
  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;

  team.record.runsScored += teamScore;
  team.record.runsAllowed += opponentScore;

  if (teamScore > opponentScore) {
    team.record.wins++;
  } else if (teamScore < opponentScore) {
    team.record.losses++;
  } else {
    team.record.draws++;
  }
}
