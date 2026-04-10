import { useState } from 'react';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';

interface Props {
  players: Player[];
  teams: Team[];
  playerTeamId: string;
}

type RankTab = 'batting' | 'pitching';

/** 個人成績ランキング */
export function RankingsView({ players, teams, playerTeamId }: Props) {
  const [rankTab, setRankTab] = useState<RankTab>('batting');

  const getTeamShortName = (teamId: string): string => {
    const team = teams.find((t) => t.id === teamId);
    return team?.shortName ?? '';
  };

  // Batting rankings (filter: atBats >= 100)
  const qualifiedBatters = players.filter((p) => p.currentBatterStats.atBats >= 100);

  const avgTop10 = [...qualifiedBatters]
    .map((p) => ({
      player: p,
      value: p.currentBatterStats.atBats > 0
        ? p.currentBatterStats.hits / p.currentBatterStats.atBats
        : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const hrTop10 = [...qualifiedBatters]
    .map((p) => ({ player: p, value: p.currentBatterStats.homeRuns }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const rbiTop10 = [...qualifiedBatters]
    .map((p) => ({ player: p, value: p.currentBatterStats.rbi }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Pitching rankings (filter: IP >= 50)
  const qualifiedPitchers = players.filter((p) => p.currentPitcherStats.inningsPitched >= 50);

  const eraTop10 = [...qualifiedPitchers]
    .map((p) => ({
      player: p,
      value: p.currentPitcherStats.inningsPitched > 0
        ? (p.currentPitcherStats.earnedRuns * 9) / p.currentPitcherStats.inningsPitched
        : 99.99,
    }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 10);

  const winsTop10 = [...qualifiedPitchers]
    .map((p) => ({ player: p, value: p.currentPitcherStats.wins }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Saves: use all pitchers (closers may not have 50 IP)
  const allPitchers = players.filter((p) => p.currentPitcherStats.games > 0);
  const savesTop10 = [...allPitchers]
    .map((p) => ({ player: p, value: p.currentPitcherStats.saves }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const rowClass = (teamId: string) =>
    teamId === playerTeamId ? 'bg-yellow-900/30' : '';

  const renderTable = (
    title: string,
    data: { player: Player; value: number }[],
    formatValue: (v: number) => string,
  ) => (
    <div className="bg-gray-800 rounded-lg p-3 mb-3">
      <h4 className="text-xs font-bold text-gray-400 mb-2">{title}</h4>
      {data.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">該当選手なし</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="py-1 w-6">#</th>
              <th className="py-1 text-left">選手</th>
              <th className="py-1 text-left">球団</th>
              <th className="py-1 text-right">成績</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.player.id} className={`border-b border-gray-700/50 text-gray-300 ${rowClass(d.player.teamId)}`}>
                <td className="py-1 text-center">{i + 1}</td>
                <td className="py-1">{d.player.name}</td>
                <td className="py-1 text-gray-500">{getTeamShortName(d.player.teamId)}</td>
                <td className="py-1 text-right font-mono">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {(['batting', 'pitching'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setRankTab(t)}
            className={`flex-1 py-2 rounded text-sm font-medium transition ${
              rankTab === t ? 'bg-blue-600' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {t === 'batting' ? '打撃' : '投手'}
          </button>
        ))}
      </div>

      {rankTab === 'batting' && (
        <>
          {renderTable('打率 TOP10', avgTop10, (v) => v.toFixed(3))}
          {renderTable('本塁打 TOP10', hrTop10, (v) => String(v))}
          {renderTable('打点 TOP10', rbiTop10, (v) => String(v))}
        </>
      )}

      {rankTab === 'pitching' && (
        <>
          {renderTable('防御率 TOP10', eraTop10, (v) => v.toFixed(2))}
          {renderTable('勝利 TOP10', winsTop10, (v) => String(v))}
          {renderTable('セーブ TOP10', savesTop10, (v) => String(v))}
        </>
      )}
    </div>
  );
}
