import { useState } from 'react';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';

interface Props {
  team: Team;
  players: Player[];
  onBack: () => void;
  onSwapLineup?: (index1: number, index2: number) => void;
  onSwapRotation?: (index1: number, index2: number) => void;
  onToggleFirstTeam?: (playerId: string) => void;
}

function statToRank(value: number): string {
  if (value >= 90) return 'S';
  if (value >= 75) return 'A';
  if (value >= 60) return 'B';
  if (value >= 45) return 'C';
  if (value >= 30) return 'D';
  if (value >= 15) return 'E';
  return 'F';
}

function rankColor(value: number): string {
  if (value >= 90) return 'text-yellow-400';
  if (value >= 75) return 'text-red-400';
  if (value >= 60) return 'text-orange-400';
  if (value >= 45) return 'text-blue-400';
  if (value >= 30) return 'text-green-400';
  return 'text-gray-500';
}

function conditionLabel(condition: string): { text: string; color: string } {
  switch (condition) {
    case 'excellent': return { text: '絶好調', color: 'text-red-400' };
    case 'good': return { text: '好調', color: 'text-orange-400' };
    case 'normal': return { text: '普通', color: 'text-gray-400' };
    case 'bad': return { text: '不調', color: 'text-blue-400' };
    case 'terrible': return { text: '絶不調', color: 'text-purple-400' };
    default: return { text: '普通', color: 'text-gray-400' };
  }
}

/** 編成画面 */
export function RosterScreen({ team, players, onBack, onSwapLineup, onSwapRotation, onToggleFirstTeam }: Props) {
  const [tab, setTab] = useState<'firstTeam' | 'farm' | 'rotation'>('firstTeam');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));
  const firstTeam = teamPlayers.filter((p) => p.isFirstTeam);
  const farm = teamPlayers.filter((p) => !p.isFirstTeam);

  const displayPlayers = tab === 'firstTeam' ? firstTeam
    : tab === 'farm' ? farm
    : firstTeam.filter((p) => p.position === 'P');

  if (selectedPlayer) {
    const p = selectedPlayer;
    const cond = conditionLabel(p.condition);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <button onClick={() => setSelectedPlayer(null)} className="text-gray-400 mb-4 text-sm">
            ← 一覧に戻る
          </button>
          <h2 className="text-2xl font-bold mb-1">{p.name}</h2>
          <p className="text-sm text-gray-400 mb-4">
            {p.age}歳 ・ {p.position} ・ {p.throwHand === 'right' ? '右投' : '左投'}{p.batHand === 'right' ? '右打' : p.batHand === 'left' ? '左打' : '両打'}
          </p>

          <div className="bg-gray-800 rounded-lg p-4 mb-3">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">調子</span>
              <span className={`text-sm font-bold ${cond.color}`}>{cond.text}</span>
            </div>
            {p.injury.isInjured && (
              <div className="text-red-400 text-sm mb-2">
                怪我: {p.injury.name}（残り{p.injury.remainingCards}カード）
              </div>
            )}
            {p.slump.isInSlump && (
              <div className="text-purple-400 text-sm mb-2">スランプ中</div>
            )}
          </div>

          {p.position !== 'P' && (
            <div className="bg-gray-800 rounded-lg p-4 mb-3">
              <h3 className="text-sm font-bold text-gray-400 mb-2">打撃能力</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(['meet', 'power', 'speed', 'fielding', 'arm', 'eye'] as const).map((stat) => (
                  <div key={stat} className="bg-gray-700 rounded p-2">
                    <p className="text-xs text-gray-400">
                      {stat === 'meet' ? 'ミート' : stat === 'power' ? 'パワー' : stat === 'speed' ? '走力' : stat === 'fielding' ? '守備' : stat === 'arm' ? '肩' : '選球眼'}
                    </p>
                    <p className={`text-lg font-bold ${rankColor(p.batterStats[stat])}`}>
                      {statToRank(p.batterStats[stat])}
                    </p>
                    <p className="text-xs text-gray-500">{p.batterStats[stat]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.pitcherStats && (
            <div className="bg-gray-800 rounded-lg p-4 mb-3">
              <h3 className="text-sm font-bold text-gray-400 mb-2">投手能力</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(['velocity', 'control', 'breaking', 'stamina'] as const).map((stat) => (
                  <div key={stat} className="bg-gray-700 rounded p-2">
                    <p className="text-xs text-gray-400">
                      {stat === 'velocity' ? '球威' : stat === 'control' ? '制球' : stat === 'breaking' ? '変化' : 'スタミナ'}
                    </p>
                    <p className={`text-lg font-bold ${rankColor(p.pitcherStats![stat])}`}>
                      {statToRank(p.pitcherStats![stat])}
                    </p>
                    <p className="text-xs text-gray-500">{p.pitcherStats![stat]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-4 mb-3">
            <h3 className="text-sm font-bold text-gray-400 mb-2">契約</h3>
            <p className="text-sm">年俸: {(p.contract.salary / 10000).toFixed(0)}億{p.contract.salary % 10000}万円</p>
            <p className="text-sm text-gray-400">プロ{p.yearsAsPro}年目 ・ {p.growthType === 'early' ? '早熟' : p.growthType === 'normal' ? '普通' : p.growthType === 'late' ? '晩成' : p.growthType === 'unstable' ? '不安定' : '晩年覚醒'}型</p>
          </div>

          {onToggleFirstTeam && (
            <button
              onClick={() => { onToggleFirstTeam(p.id); setSelectedPlayer(null); }}
              className={`w-full py-3 rounded-lg font-bold transition ${
                p.isFirstTeam
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {p.isFirstTeam ? '二軍に降格' : '一軍に昇格'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">編成</h2>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">戻る</button>
        </div>

        <div className="flex gap-1 mb-4">
          {(['firstTeam', 'farm', 'rotation'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded text-sm font-medium transition ${
                tab === t ? 'bg-blue-600' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t === 'firstTeam' ? `一軍(${firstTeam.length})` : t === 'farm' ? `二軍(${farm.length})` : 'ローテ'}
            </button>
          ))}
        </div>

        {/* 打順表示（一軍タブ時） */}
        {tab === 'firstTeam' && team.lineup.order.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-500 mb-2">打順</h3>
            <div className="space-y-1">
              {team.lineup.order.map((pid, idx) => {
                const p = players.find((pl) => pl.id === pid);
                if (!p) return null;
                return (
                  <div key={pid} className="flex items-center gap-2 bg-gray-800 rounded p-2">
                    <span className="w-6 text-center text-xs text-yellow-400 font-bold">{idx + 1}</span>
                    <span className="text-xs text-gray-500 w-6">{p.position}</span>
                    <span className="flex-1 text-sm">{p.name}</span>
                    {onSwapLineup && idx > 0 && (
                      <button onClick={() => onSwapLineup(idx, idx - 1)} className="text-xs text-blue-400 px-1">↑</button>
                    )}
                    {onSwapLineup && idx < team.lineup.order.length - 1 && (
                      <button onClick={() => onSwapLineup(idx, idx + 1)} className="text-xs text-blue-400 px-1">↓</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ローテーション表示（ローテタブ時） */}
        {tab === 'rotation' && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-500 mb-2">先発ローテーション</h3>
            <div className="space-y-1">
              {team.rotation.starters.map((pid, idx) => {
                const p = players.find((pl) => pl.id === pid);
                if (!p) return null;
                return (
                  <div key={pid} className="flex items-center gap-2 bg-gray-800 rounded p-2">
                    <span className="w-6 text-center text-xs text-green-400 font-bold">{idx + 1}</span>
                    <span className="flex-1 text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500">{p.pitcherStats ? `球${statToRank(p.pitcherStats.velocity)}制${statToRank(p.pitcherStats.control)}` : ''}</span>
                    {onSwapRotation && idx > 0 && (
                      <button onClick={() => onSwapRotation(idx, idx - 1)} className="text-xs text-blue-400 px-1">↑</button>
                    )}
                    {onSwapRotation && idx < team.rotation.starters.length - 1 && (
                      <button onClick={() => onSwapRotation(idx, idx + 1)} className="text-xs text-blue-400 px-1">↓</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 選手一覧 */}
        <div className="space-y-1">
          {displayPlayers.map((p) => {
            const cond = conditionLabel(p.condition);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left flex items-center gap-3 transition"
              >
                <div className="w-8 text-center">
                  <span className="text-xs text-gray-500">{p.position}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.age}歳</p>
                </div>
                <span className={`text-xs ${cond.color}`}>{cond.text}</span>
                {p.injury.isInjured && <span className="text-xs text-red-400">怪我</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
