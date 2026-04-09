import { useState } from 'react';
import { importPlayersFromCsv } from '@/data/csvImporter';
import { SAMPLE_CSV } from '@/data/samplePlayers';
import { initRandom } from '@/utils/random';
import type { Player } from '@/types/player';

/** 能力値をランク文字に変換 */
function statToRank(value: number): string {
  if (value >= 90) return 'S';
  if (value >= 75) return 'A';
  if (value >= 60) return 'B';
  if (value >= 45) return 'C';
  if (value >= 30) return 'D';
  if (value >= 15) return 'E';
  return 'F';
}

/** ランクに応じた色クラスを返す */
function rankColor(value: number): string {
  if (value >= 90) return 'text-yellow-400';
  if (value >= 75) return 'text-red-400';
  if (value >= 60) return 'text-orange-400';
  if (value >= 45) return 'text-blue-400';
  if (value >= 30) return 'text-green-400';
  return 'text-gray-500';
}

function loadInitialPlayers(): Player[] {
  initRandom(12345);
  return importPlayersFromCsv(SAMPLE_CSV);
}

function App() {
  const [players] = useState<Player[]>(loadInitialPlayers);
  const [filter, setFilter] = useState<'all' | 'batter' | 'pitcher'>('all');

  const filtered = players.filter((p) => {
    if (filter === 'batter') return p.position !== 'P';
    if (filter === 'pitcher') return p.position === 'P';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold">やきゅつく令和版</h1>
        <p className="text-gray-400 mt-1">選手一覧（Phase1動作確認）</p>
      </header>

      <div className="flex justify-center gap-2 mb-4">
        {(['all', 'batter', 'pitcher'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {f === 'all' ? '全員' : f === 'batter' ? '野手' : '投手'}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto">
        <p className="text-gray-400 text-sm mb-2">{filtered.length}名</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 px-3 text-left">名前</th>
                <th className="py-2 px-2">球団</th>
                <th className="py-2 px-2">Pos</th>
                <th className="py-2 px-2">年齢</th>
                {filter !== 'pitcher' && (
                  <>
                    <th className="py-2 px-1">ミ</th>
                    <th className="py-2 px-1">パ</th>
                    <th className="py-2 px-1">走</th>
                    <th className="py-2 px-1">守</th>
                    <th className="py-2 px-1">肩</th>
                    <th className="py-2 px-1">眼</th>
                  </>
                )}
                {filter !== 'batter' && (
                  <>
                    <th className="py-2 px-1">球威</th>
                    <th className="py-2 px-1">制球</th>
                    <th className="py-2 px-1">変化</th>
                    <th className="py-2 px-1">スタ</th>
                  </>
                )}
                <th className="py-2 px-2">成長</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-2 px-3 font-medium">{p.name}</td>
                  <td className="py-2 px-2 text-center text-gray-400">{p.teamId}</td>
                  <td className="py-2 px-2 text-center">{p.position}</td>
                  <td className="py-2 px-2 text-center">{p.age}</td>
                  {filter !== 'pitcher' && (
                    <>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.meet)}`}>
                        {statToRank(p.batterStats.meet)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.power)}`}>
                        {statToRank(p.batterStats.power)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.speed)}`}>
                        {statToRank(p.batterStats.speed)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.fielding)}`}>
                        {statToRank(p.batterStats.fielding)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.arm)}`}>
                        {statToRank(p.batterStats.arm)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.batterStats.eye)}`}>
                        {statToRank(p.batterStats.eye)}
                      </td>
                    </>
                  )}
                  {filter !== 'batter' && p.pitcherStats && (
                    <>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.pitcherStats.velocity)}`}>
                        {statToRank(p.pitcherStats.velocity)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.pitcherStats.control)}`}>
                        {statToRank(p.pitcherStats.control)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.pitcherStats.breaking)}`}>
                        {statToRank(p.pitcherStats.breaking)}
                      </td>
                      <td className={`py-2 px-1 text-center font-mono ${rankColor(p.pitcherStats.stamina)}`}>
                        {statToRank(p.pitcherStats.stamina)}
                      </td>
                    </>
                  )}
                  {filter !== 'batter' && !p.pitcherStats && (
                    <>
                      <td className="py-2 px-1 text-center text-gray-600">-</td>
                      <td className="py-2 px-1 text-center text-gray-600">-</td>
                      <td className="py-2 px-1 text-center text-gray-600">-</td>
                      <td className="py-2 px-1 text-center text-gray-600">-</td>
                    </>
                  )}
                  <td className="py-2 px-2 text-center text-xs text-gray-400">
                    {p.growthType === 'early' && '早熟'}
                    {p.growthType === 'normal' && '普通'}
                    {p.growthType === 'late' && '晩成'}
                    {p.growthType === 'unstable' && '不安定'}
                    {p.growthType === 'lateBloom' && '晩年覚醒'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
