import type { GameResult } from '@/types/game';
import type { Team } from '@/types/team';

interface Props {
  result: GameResult;
  teams: Team[];
}

/** 試合結果表示コンポーネント */
export function GameResultView({ result, teams }: Props) {
  const homeTeam = teams.find((t) => t.id === result.homeTeamId);
  const awayTeam = teams.find((t) => t.id === result.awayTeamId);
  const homeName = homeTeam?.shortName ?? result.homeTeamId;
  const awayName = awayTeam?.shortName ?? result.awayTeamId;

  const homeTotal = result.inningScores.reduce((sum, s) => sum + s.home, 0);
  const awayTotal = result.inningScores.reduce((sum, s) => sum + s.away, 0);

  return (
    <div className="bg-gray-800 rounded-lg p-3 mb-2">
      {/* スコアボード */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center">
          <thead>
            <tr className="text-gray-500">
              <th className="w-8"></th>
              {result.inningScores.map((_, i) => (
                <th key={i} className="w-6">{i + 1}</th>
              ))}
              <th className="w-8 font-bold">計</th>
            </tr>
          </thead>
          <tbody>
            <tr className={homeTotal > awayTotal ? 'text-white font-bold' : 'text-gray-400'}>
              <td className="text-left">{homeName}</td>
              {result.inningScores.map((s, i) => (
                <td key={i}>{s.home}</td>
              ))}
              <td className="font-bold">{homeTotal}</td>
            </tr>
            <tr className={awayTotal > homeTotal ? 'text-white font-bold' : 'text-gray-400'}>
              <td className="text-left">{awayName}</td>
              {result.inningScores.map((s, i) => (
                <td key={i}>{s.away}</td>
              ))}
              <td className="font-bold">{awayTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 勝利/敗戦/セーブ投手 */}
      <div className="flex gap-3 mt-2 text-xs text-gray-400">
        {result.winningPitcher && (
          <span>○ {result.winningPitcher.name}</span>
        )}
        {result.losingPitcher && (
          <span>● {result.losingPitcher.name}</span>
        )}
        {result.savePitcher && (
          <span>S {result.savePitcher.name}</span>
        )}
      </div>

      {/* 本塁打 */}
      {result.homeRuns.length > 0 && (
        <div className="text-xs text-yellow-400 mt-1">
          HR: {result.homeRuns.map((hr) => hr.playerName).join(', ')}
        </div>
      )}

      {/* ハイライト */}
      {result.highlights.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          {result.highlights[0]}
        </div>
      )}
    </div>
  );
}
