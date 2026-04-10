import { useState, useCallback } from 'react';
import { initRandom } from '@/utils/random';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import type { GameResult, GameEvent } from '@/types/game';
import { createInitialTeams } from '@/data/initialTeams';
import { generateSchedule, calculateStandings } from '@/engine/season';
import { simulateGame } from '@/engine/simulation';
import { TitleScreen } from '@/components/title/TitleScreen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { GameResultView } from '@/components/game/GameResultView';
import { StandingsView } from '@/components/game/StandingsView';
import { RosterScreen } from '@/components/roster/RosterScreen';
import { NotificationSystem } from '@/components/common/NotificationSystem';

type Screen = 'title' | 'home' | 'game' | 'standings' | 'roster' | 'events' | 'settings';

interface GameCard {
  homeTeamId: string;
  awayTeamId: string;
  cardNumber: number;
  results: GameResult[];
}

interface AppState {
  screen: Screen;
  teams: Team[];
  players: Player[];
  schedule: GameCard[];
  currentCard: number;
  recentResults: GameResult[];
  playerTeamId: string;
  gmName: string;
  year: number;
  difficulty: 'easy' | 'normal' | 'hard';
  events: GameEvent[];
}

function App() {
  const [state, setState] = useState<AppState>({
    screen: 'title',
    teams: [],
    players: [],
    schedule: [],
    currentCard: 0,
    recentResults: [],
    playerTeamId: '',
    gmName: '',
    year: 2025,
    difficulty: 'normal',
    events: [],
  });

  /** ニューゲーム開始 */
  const handleNewGame = useCallback(
    (teamId: string, gmName: string, difficulty: 'easy' | 'normal' | 'hard') => {
      initRandom(Date.now());
      const { teams, players } = createInitialTeams();

      const playerTeam = teams.find((t) => t.id === teamId);
      if (playerTeam) playerTeam.isPlayerControlled = true;

      const rawSchedule = generateSchedule(teams);
      const schedule: GameCard[] = rawSchedule.map((card) => ({
        homeTeamId: card.homeTeamId,
        awayTeamId: card.awayTeamId,
        cardNumber: card.cardNumber,
        results: [],
      }));

      setState({
        screen: 'home',
        teams,
        players,
        schedule,
        currentCard: 0,
        recentResults: [],
        playerTeamId: teamId,
        gmName,
        year: 2025,
        difficulty,
        events: [],
      });
    },
    [],
  );

  /** 1カード進める */
  const advanceCard = useCallback(() => {
    setState((prev) => {
      if (prev.currentCard >= prev.schedule.length) return prev;

      const card = prev.schedule[prev.currentCard];
      const homeTeam = prev.teams.find((t) => t.id === card.homeTeamId);
      const awayTeam = prev.teams.find((t) => t.id === card.awayTeamId);

      if (!homeTeam || !awayTeam) return prev;

      const useDH = homeTeam.league === 'pacific';
      const results: GameResult[] = [];

      for (let g = 0; g < 3; g++) {
        const result = simulateGame(homeTeam, awayTeam, prev.players, useDH);
        results.push(result);

        const homeScore = result.inningScores.reduce((s, inn) => s + inn.home, 0);
        const awayScore = result.inningScores.reduce((s, inn) => s + inn.away, 0);

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
        screen: 'game',
      };
    });
  }, []);

  /** 月送り */
  const advanceMonth = useCallback(() => {
    for (let i = 0; i < 8; i++) {
      advanceCard();
    }
  }, [advanceCard]);

  /** 画面遷移 */
  const navigate = useCallback((screen: string) => {
    setState((prev) => ({ ...prev, screen: screen as Screen }));
  }, []);

  /** 通知を既読にする */
  const markEventRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === id ? { ...e, isRead: true } : e)),
    }));
  }, []);

  /** オフシーズン処理（簡易版） */
  const processOffseason = useCallback(() => {
    setState((prev) => ({
      ...prev,
      year: prev.year + 1,
      currentCard: 0,
      recentResults: [],
      schedule: generateSchedule(prev.teams).map((card) => ({
        homeTeamId: card.homeTeamId,
        awayTeamId: card.awayTeamId,
        cardNumber: card.cardNumber,
        results: [],
      })),
      // チーム成績リセット
      teams: prev.teams.map((t) => ({
        ...t,
        record: { wins: 0, losses: 0, draws: 0, runsScored: 0, runsAllowed: 0 },
      })),
      screen: 'home',
      events: [
        ...prev.events,
        {
          id: `offseason-${prev.year}`,
          type: 'milestone' as const,
          title: `${prev.year + 1}年シーズン開始`,
          message: 'オフシーズンが終了し、新シーズンが始まります。',
          date: { year: prev.year + 1, month: 2, cardNumber: 0 },
          playerId: null,
          teamId: null,
          isRead: false,
        },
      ].slice(-20),
    }));
  }, []);

  const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
  const totalCards = state.schedule.length;
  const isSeasonOver = state.currentCard >= totalCards && totalCards > 0;

  // タイトル画面
  if (state.screen === 'title') {
    return (
      <TitleScreen
        onNewGame={handleNewGame}
        onLoad={() => {}}
        onImport={() => {}}
        hasSaveData={false}
      />
    );
  }

  // ゲーム中の画面ルーティング
  switch (state.screen) {
    case 'home':
      return playerTeam ? (
        <HomeScreen
          team={playerTeam}
          gmName={state.gmName}
          year={state.year}
          cardNumber={state.currentCard}
          totalCards={totalCards}
          events={state.events}
          onNavigate={navigate}
          onAdvanceCard={() => { advanceCard(); navigate('game'); }}
          onAdvanceMonth={() => { advanceMonth(); navigate('game'); }}
          isSeasonOver={isSeasonOver}
          onProcessOffseason={processOffseason}
        />
      ) : null;

    case 'game':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">試合結果</h2>
              <button
                onClick={() => navigate('home')}
                className="text-gray-400 hover:text-white text-sm"
              >
                ホームへ
              </button>
            </div>

            {state.recentResults.length > 0 ? (
              state.recentResults.map((result, i) => (
                <GameResultView key={i} result={result} teams={state.teams} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">まだ試合結果がありません</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StandingsView
                title="セ・リーグ"
                standings={calculateStandings(state.teams, 'central')}
                playerTeamId={state.playerTeamId}
              />
              <StandingsView
                title="パ・リーグ"
                standings={calculateStandings(state.teams, 'pacific')}
                playerTeamId={state.playerTeamId}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={advanceCard}
                disabled={isSeasonOver}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-bold transition"
              >
                {isSeasonOver ? 'シーズン終了' : '次のカードへ'}
              </button>
              <button
                onClick={() => navigate('home')}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg transition"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      );

    case 'standings':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">順位表</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 text-sm">戻る</button>
            </div>
            <div className="space-y-4">
              <StandingsView
                title="セ・リーグ"
                standings={calculateStandings(state.teams, 'central')}
                playerTeamId={state.playerTeamId}
              />
              <StandingsView
                title="パ・リーグ"
                standings={calculateStandings(state.teams, 'pacific')}
                playerTeamId={state.playerTeamId}
              />
            </div>
          </div>
        </div>
      );

    case 'roster':
      return playerTeam ? (
        <RosterScreen
          team={playerTeam}
          players={state.players}
          onBack={() => navigate('home')}
        />
      ) : null;

    case 'events':
      return (
        <NotificationSystem
          events={state.events}
          onMarkRead={markEventRead}
          onBack={() => navigate('home')}
        />
      );

    case 'settings':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">設定</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 text-sm">戻る</button>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-lg text-left transition">
                セーブ
              </button>
              <button
                onClick={() => navigate('title')}
                className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-lg text-left text-red-400 transition"
              >
                タイトルに戻る
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <button onClick={() => navigate('home')} className="text-blue-400">ホームに戻る</button>
        </div>
      );
  }
}

export default App;
