import type { StandingsEntry } from '@/engine/season';

interface Props {
  title: string;
  standings: StandingsEntry[];
  playerTeamId: string;
}

/** 順位表コンポーネント */
export function StandingsView({ title, standings, playerTeamId }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-bold mb-2 text-gray-300">{title}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="py-1 w-6">#</th>
            <th className="py-1 text-left">球団</th>
            <th className="py-1">勝</th>
            <th className="py-1">敗</th>
            <th className="py-1">分</th>
            <th className="py-1">率</th>
            <th className="py-1">差</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr
              key={s.teamId}
              className={`border-b border-gray-700/50 ${
                s.teamId === playerTeamId ? 'text-yellow-300 font-bold' : 'text-gray-300'
              }`}
            >
              <td className="py-1 text-center">{s.rank}</td>
              <td className="py-1">{s.teamName}</td>
              <td className="py-1 text-center">{s.wins}</td>
              <td className="py-1 text-center">{s.losses}</td>
              <td className="py-1 text-center">{s.draws}</td>
              <td className="py-1 text-center">{s.winRate.toFixed(3)}</td>
              <td className="py-1 text-center">{s.gamesBehind > 0 ? s.gamesBehind : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
