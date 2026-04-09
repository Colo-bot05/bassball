import { useState, useCallback } from 'react';
import { initRandom } from '@/utils/random';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import type { GameResult } from '@/types/game';
import { createInitialTeams } from '@/data/initialTeams';
import { generateSchedule, calculateStandings } from '@/engine/season';
import { simulateGame } from '@/engine/simulation';
import { GameResultView } from '@/components/game/GameResultView';
import { StandingsView } from '@/components/game/StandingsView';

interface GameCard {
  homeTeamId: string;
  awayTeamId: string;
  cardNumber: number;
  results: GameResult[];
}

interface SeasonState {
  teams: Team[];
  players: Player[];
  schedule: GameCard[];
  currentCard: number;
  recentResults: GameResult[];
  playerTeamId: string;
}

function initSeason(): SeasonState {
  initRandom(Date.now());
  const { teams, players } = createInitialTeams();

  // プレイヤーの球団を巨人に設定（仮）
  const playerTeamId = 'giants';
  const playerTeam = teams.find((t) => t.id === playerTeamId);
  if (playerTeam) playerTeam.isPlayerControlled = true;

  const rawSchedule = generateSchedule(teams);
  const schedule: GameCard[] = rawSchedule.map((card) => ({
    homeTeamId: card.homeTeamId,
    awayTeamId: card.awayTeamId,
    cardNumber: card.cardNumber,
    results: [],
  }));

  return {
    teams,
    players,
    schedule,
    currentCard: 0,
    recentResults: [],
    playerTeamId,
  };
}

function App() {
  const [state, setState] = useState<SeasonState>(initSeason);
  const [view, setView] = useState<'game' | 'standings'>('game');

  const centralStandings = calculateStandings(state.teams, 'central');
  const pacificStandings = calculateStandings(state.teams, 'pacific');

  /** 1カード分（3試合）を進める */
  const advanceCard = useCallback(() => {
    setState((prev) => {
      if (prev.currentCard >= prev.schedule.length) return prev;

      const card = prev.schedule[prev.currentCard];
      const homeTeam = prev.teams.find((t) => t.id === card.homeTeamId);
      const awayTeam = prev.teams.find((t) => t.id === card.awayTeamId);

      if (!homeTeam || !awayTeam) return prev;

      const useDH = homeTeam.league === 'pacific';
      const results: GameResult[] = [];

      // 3試合をシミュレーション
      for (let g = 0; g < 3; g++) {
        const result = simulateGame(homeTeam, awayTeam, prev.players, useDH);
        results.push(result);

        // チーム成績を更新
        const homeScore = result.inningScores.reduce((s, i) => s + i.home, 0);
        const awayScore = result.inningScores.reduce((s, i) => s + i.away, 0);

        if (homeScore > awayScore) {
          homeTeam.record.wins++;
          awayTeam.record.losses++;
        } else if (awayScore > homeScore) {
          awayTeam.record.wins++;
          homeTeam.record.losses++;
        } else {
          homeTeam.record.draws++;
          awayTeam.record.draws++;
        }
        homeTeam.record.runsScored += homeScore;
        homeTeam.record.runsAllowed += awayScore;
        awayTeam.record.runsScored += awayScore;
        awayTeam.record.runsAllowed += homeScore;
      }

      const newSchedule = [...prev.schedule];
      newSchedule[prev.currentCard] = { ...card, results };

      return {
        ...prev,
        schedule: newSchedule,
        currentCard: prev.currentCard + 1,
        recentResults: results,
      };
    });
  }, []);

  /** 月単位で一気に進める（約8カード） */
  const advanceMonth = useCallback(() => {
    for (let i = 0; i < 8; i++) {
      advanceCard();
    }
  }, [advanceCard]);

  const totalCards = state.schedule.length;
  const isSeasonOver = state.currentCard >= totalCards;
  const progress = totalCards > 0 ? Math.round((state.currentCard / totalCards) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 p-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">やきゅつく令和版</h1>
          <p className="text-xs text-gray-400">
            カード {state.currentCard}/{totalCards} ({progress}%)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('game')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'game' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            試合
          </button>
          <button
            onClick={() => setView('standings')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'standings' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            順位表
          </button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {view === 'game' && (
          <>
            {/* 進むボタン */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={advanceCard}
                disabled={isSeasonOver}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:text-gray-400 py-3 rounded font-bold transition"
              >
                {isSeasonOver ? 'シーズン終了' : '進む（1カード）'}
              </button>
              <button
                onClick={advanceMonth}
                disabled={isSeasonOver}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 px-4 py-3 rounded text-sm transition"
              >
                月送り
              </button>
            </div>

            {/* 直近の試合結果 */}
            {state.recentResults.length > 0 ? (
              <div>
                <h2 className="text-sm font-bold text-gray-400 mb-2">試合結果</h2>
                {state.recentResults.map((result, i) => (
                  <GameResultView key={i} result={result} teams={state.teams} />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg">「進む」ボタンで試合を開始</p>
                <p className="text-sm mt-2">1カード = 3試合分の結果が表示されます</p>
              </div>
            )}

            {/* ミニ順位表 */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StandingsView
                title="セ・リーグ"
                standings={centralStandings}
                playerTeamId={state.playerTeamId}
              />
              <StandingsView
                title="パ・リーグ"
                standings={pacificStandings}
                playerTeamId={state.playerTeamId}
              />
            </div>
          </>
        )}

        {view === 'standings' && (
          <div className="space-y-4">
            <StandingsView
              title="セ・リーグ順位表"
              standings={centralStandings}
              playerTeamId={state.playerTeamId}
            />
            <StandingsView
              title="パ・リーグ順位表"
              standings={pacificStandings}
              playerTeamId={state.playerTeamId}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
