import { useState, useCallback } from 'react';
import { initRandom, generateId } from '@/utils/random';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import type { GameResult, GameEvent, GameState } from '@/types/game';
import { createInitialTeams } from '@/data/initialTeams';
import { calculateStandings, generateRoundSchedule } from '@/engine/season';
import type { RoundCard } from '@/engine/season';
import { simulateGame } from '@/engine/simulation';
import { updateCondition, checkSlump } from '@/engine/condition';
import { checkInjury, healInjury, updateAwakeningGaugeFromInjury } from '@/engine/injury';
import { applyYearlyGrowth, applyDecline, checkAwakening } from '@/engine/growth';
import { processOffseason as runOffseason } from '@/engine/offseason';
import { autoSave, loadGame, listSaveSlots, exportSaveToJson, importSaveFromJson, saveGame } from '@/data/saveManager';
import { runPostseason } from '@/engine/postseason';
import type { PostseasonResult } from '@/engine/postseason';
import { DIFFICULTY_MODIFIERS } from '@/constants/balance';
import { TitleScreen } from '@/components/title/TitleScreen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { GameResultView } from '@/components/game/GameResultView';
import { StandingsView } from '@/components/game/StandingsView';
import { RosterScreen } from '@/components/roster/RosterScreen';
import { NotificationSystem } from '@/components/common/NotificationSystem';
import { RankingsView } from '@/components/game/RankingsView';

type Screen = 'title' | 'home' | 'game' | 'standings' | 'roster' | 'events' | 'settings' | 'scout' | 'management' | 'offseasonSummary';

interface AppState {
  screen: Screen;
  teams: Team[];
  players: Player[];
  schedule: RoundCard[];
  currentCard: number;
  /** 最新ラウンドの全試合結果。外側配列=各マッチアップ、内側配列=3連戦 */
  recentResults: GameResult[][];
  playerTeamId: string;
  gmName: string;
  year: number;
  difficulty: 'easy' | 'normal' | 'hard';
  events: GameEvent[];
  hasSaveData: boolean;
  postseasonResult: PostseasonResult | null;
  showPostseason: boolean;
}

/** MatchCard[]（セーブデータ）→ RoundCard[]（アプリ内）に復元 */
function rebuildRoundsFromMatchCards(matchCards: { homeTeamId: string; awayTeamId: string; cardNumber: number; results: GameResult[]; isPlayed: boolean }[]): RoundCard[] {
  const byCardNumber = new Map<number, typeof matchCards>();
  for (const mc of matchCards) {
    const arr = byCardNumber.get(mc.cardNumber) ?? [];
    arr.push(mc);
    byCardNumber.set(mc.cardNumber, arr);
  }
  const rounds: RoundCard[] = [];
  const sortedKeys = [...byCardNumber.keys()].sort((a, b) => a - b);
  for (const cn of sortedKeys) {
    const cards = byCardNumber.get(cn)!;
    const results = new Map<string, GameResult[]>();
    let isPlayed = false;
    for (const c of cards) {
      if (c.results.length > 0) {
        results.set(`${c.homeTeamId}-vs-${c.awayTeamId}`, c.results);
        isPlayed = true;
      }
      if (c.isPlayed) isPlayed = true;
    }
    rounds.push({
      cardNumber: cn,
      matchups: cards.map((c) => ({ homeTeamId: c.homeTeamId, awayTeamId: c.awayTeamId })),
      results,
      isPlayed,
    });
  }
  return rounds;
}

/** ラウンド結果からプレイヤーチームの試合結果を取得 */
function getMyTeamResults(roundResults: GameResult[][], playerTeamId: string): GameResult[] {
  for (const matchResults of roundResults) {
    if (matchResults.length > 0 && (matchResults[0].homeTeamId === playerTeamId || matchResults[0].awayTeamId === playerTeamId)) {
      return matchResults;
    }
  }
  return [];
}

/** 個人成績をPlayerに書き戻す */
function accumulatePlayerStats(players: Player[], results: GameResult[]): void {
  for (const result of results) {
    for (const summary of result.playerSummaries) {
      const player = players.find((p) => p.id === summary.playerId);
      if (!player) continue;

      if (summary.batting) {
        player.currentBatterStats.atBats += summary.batting.atBats;
        player.currentBatterStats.hits += summary.batting.hits;
        player.currentBatterStats.homeRuns += summary.batting.homeRuns;
        player.currentBatterStats.rbi += summary.batting.rbi;
        player.currentBatterStats.walks += summary.batting.walks;
        player.currentBatterStats.strikeouts += summary.batting.strikeouts;
        player.currentBatterStats.games++;
      }
      if (summary.pitching) {
        player.currentPitcherStats.inningsPitched += summary.pitching.inningsPitched;
        player.currentPitcherStats.earnedRuns += summary.pitching.earnedRuns;
        player.currentPitcherStats.strikeouts += summary.pitching.strikeouts;
        player.currentPitcherStats.walks += summary.pitching.walks;
        player.currentPitcherStats.hitsAllowed += summary.pitching.hitsAllowed;
        player.currentPitcherStats.games++;
      }
    }
  }
}

/** カード進行時に調子・怪我・覚醒ゲージを更新 */
function processCardEffects(players: Player[], events: GameEvent[], year: number, cardNumber: number, difficulty: 'easy' | 'normal' | 'hard'): void {
  const diffMod = DIFFICULTY_MODIFIERS[difficulty];
  const hasMoodMaker = players.some(
    (p) => p.isFirstTeam && p.normalAbilities.includes('moodMaker'),
  );

  for (const player of players) {
    if (!player.isFirstTeam && player.position !== 'P') continue;

    // 調子変動
    const recentPerf = player.currentBatterStats.hits > 0 ? 'good' : 'neutral';
    updateCondition(player, recentPerf as 'good' | 'neutral' | 'bad', hasMoodMaker);
    checkSlump(player);

    // 怪我回復
    if (player.injury.isInjured) {
      healInjury(player);
      updateAwakeningGaugeFromInjury(player);
      if (!player.injury.isInjured) {
        events.push({
          id: generateId(),
          type: 'recovery',
          title: `${player.name}が復帰`,
          message: `${player.name}が怪我から復帰しました。`,
          date: { year, month: Math.ceil(cardNumber / 4) + 3, cardNumber },
          playerId: player.id,
          teamId: player.teamId,
          isRead: false,
        });
      }
    }

    // 怪我判定
    if (!player.injury.isInjured) {
      const injuryResult = checkInjury(player, !player.isFirstTeam);
      // 難易度による怪我確率補正（easyなら0.7倍で怪我しにくい）
      const injuryHappens = injuryResult.injured && Math.random() < diffMod.injuryMultiplier;
      if (injuryHappens) {
        player.injury = {
          isInjured: true,
          name: injuryResult.name,
          severity: injuryResult.severity,
          remainingCards: injuryResult.durationCards,
          hadTommyJohn: player.injury.hadTommyJohn,
        };
        events.push({
          id: generateId(),
          type: 'injury',
          title: `${player.name}が${injuryResult.name}`,
          message: `${player.name}が${injuryResult.name}で離脱。復帰まで約${injuryResult.durationCards}カード。`,
          date: { year, month: Math.ceil(cardNumber / 4) + 3, cardNumber },
          playerId: player.id,
          teamId: player.teamId,
          isRead: false,
        });
      }
    }

    // 覚醒チェック
    if (player.awakening.gauge >= 100) {
      const awakeningResult = checkAwakening(player);
      if (awakeningResult.awakened) {
        events.push({
          id: generateId(),
          type: 'awakening',
          title: `${player.name}が覚醒！`,
          message: `${player.name}が覚醒しました！（${awakeningResult.type}）`,
          date: { year, month: Math.ceil(cardNumber / 4) + 3, cardNumber },
          playerId: player.id,
          teamId: player.teamId,
          isRead: false,
        });
      }
    }
  }
}

/** 1ラウンド分をシミュレーション（全6マッチアップを同時進行） */
function simulateOneCard(prev: AppState): AppState {
  if (prev.currentCard >= prev.schedule.length) return prev;

  const round = prev.schedule[prev.currentCard];
  const allMatchResults: GameResult[][] = [];

  for (const matchup of round.matchups) {
    const homeTeam = prev.teams.find((t) => t.id === matchup.homeTeamId);
    const awayTeam = prev.teams.find((t) => t.id === matchup.awayTeamId);
    if (!homeTeam || !awayTeam) continue;

    const useDH = homeTeam.league === 'pacific';
    const matchResults: GameResult[] = [];

    for (let g = 0; g < 3; g++) {
      const result = simulateGame(homeTeam, awayTeam, prev.players, useDH);
      matchResults.push(result);

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

    // 個人成績を蓄積
    accumulatePlayerStats(prev.players, matchResults);
    allMatchResults.push(matchResults);
  }

  // 調子・怪我・覚醒を更新
  const newEvents = [...prev.events];
  processCardEffects(prev.players, newEvents, prev.year, prev.currentCard + 1, prev.difficulty);

  const newSchedule = [...prev.schedule];
  const updatedResults = new Map(round.results);
  for (const matchResults of allMatchResults) {
    if (matchResults.length > 0) {
      const key = `${matchResults[0].homeTeamId}-vs-${matchResults[0].awayTeamId}`;
      updatedResults.set(key, matchResults);
    }
  }
  newSchedule[prev.currentCard] = { ...round, results: updatedResults, isPlayed: true };

  return {
    ...prev,
    schedule: newSchedule,
    currentCard: prev.currentCard + 1,
    recentResults: allMatchResults,
    events: newEvents.slice(-20),
  };
}

function App() {
  const [standingsTab, setStandingsTab] = useState<'team' | 'individual'>('team');

  const [state, setState] = useState<AppState>({
    screen: 'title',
    teams: [],
    players: [],
    schedule: [] as RoundCard[],
    currentCard: 0,
    recentResults: [] as GameResult[][],
    playerTeamId: '',
    gmName: '',
    year: 2025,
    difficulty: 'normal',
    events: [],
    hasSaveData: false,
    postseasonResult: null,
    showPostseason: false,
  });

  // 起動時にセーブデータの有無をチェック
  useState(() => {
    listSaveSlots().then((slots) => {
      if (slots.length > 0) {
        setState((prev) => ({ ...prev, hasSaveData: true }));
      }
    });
  });

  /** ニューゲーム開始 */
  const handleNewGame = useCallback(
    (teamId: string, gmName: string, difficulty: 'easy' | 'normal' | 'hard') => {
      initRandom(Date.now());
      const { teams, players } = createInitialTeams();

      const playerTeam = teams.find((t) => t.id === teamId);
      if (playerTeam) playerTeam.isPlayerControlled = true;

      const schedule = generateRoundSchedule(teams);

      setState({
        screen: 'home',
        teams,
        players,
        schedule,
        currentCard: 0,
        recentResults: [] as GameResult[][],
        playerTeamId: teamId,
        gmName,
        year: 2025,
        difficulty,
        events: [],
        hasSaveData: false,
        postseasonResult: null,
        showPostseason: false,
      });
    },
    [],
  );

  /** 1カード進める */
  const advanceCard = useCallback(() => {
    setState((prev) => {
      const next = simulateOneCard(prev);
      return { ...next, screen: 'game' };
    });
  }, []);

  /** 月送り（8カード分を1回のsetStateで処理） */
  const advanceMonth = useCallback(() => {
    setState((prev) => {
      let current = prev;
      for (let i = 0; i < 8; i++) {
        if (current.currentCard >= current.schedule.length) break;
        current = simulateOneCard(current);
      }
      return { ...current, screen: 'game' };
    });
  }, []);

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

  /** RoundCard[] → MatchCard[] への変換（セーブ用） */
  const flattenSchedule = useCallback((rounds: RoundCard[]) => {
    const matchCards: { homeTeamId: string; awayTeamId: string; cardNumber: number; results: GameResult[]; isPlayed: boolean }[] = [];
    for (const round of rounds) {
      for (const matchup of round.matchups) {
        const key = `${matchup.homeTeamId}-vs-${matchup.awayTeamId}`;
        const results = round.results.get(key) ?? [];
        matchCards.push({
          homeTeamId: matchup.homeTeamId,
          awayTeamId: matchup.awayTeamId,
          cardNumber: round.cardNumber,
          results,
          isPlayed: round.isPlayed,
        });
      }
    }
    return matchCards;
  }, []);

  /** GameStateを構築するヘルパー */
  const buildGameState = useCallback((): GameState => {
    return {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      seed: Date.now(),
      currentDate: { year: state.year, month: 4, cardNumber: state.currentCard },
      currentPhase: 'regularSeason',
      offseasonStep: null,
      playerTeamId: state.playerTeamId,
      gmName: state.gmName,
      difficulty: state.difficulty,
      teams: state.teams,
      players: state.players,
      reincarnationPool: [],
      overseasPlayers: [],
      events: state.events,
      seasonRecords: [],
      hallOfFame: [],
      schedule: flattenSchedule(state.schedule),
      currentCardIndex: state.currentCard,
    };
  }, [state, flattenSchedule]);

  /** CS・日本シリーズを実行 */
  const runPostseasonHandler = useCallback(() => {
    setState((prev) => {
      const result = runPostseason(prev.teams, prev.players);
      const champion = prev.teams.find((t) => t.id === result.champion);
      const events: GameEvent[] = [
        ...prev.events,
        {
          id: generateId(),
          type: 'milestone' as const,
          title: `${champion?.name ?? ''}が日本一！`,
          message: `${prev.year}年日本シリーズを制しました！`,
          date: { year: prev.year, month: 10, cardNumber: 0 },
          playerId: null,
          teamId: result.champion,
          isRead: false,
        },
      ].slice(-20);
      return {
        ...prev,
        postseasonResult: result,
        showPostseason: true,
        events,
        screen: 'game' as Screen,
        recentResults: [result.japanSeriesResult.games.slice(-1)],
      };
    });
  }, []);

  /** オフシーズン処理（実際のエンジンを使用） */
  const processOffseason = useCallback(() => {
    setState((prev) => {
      // prevから直接GameStateを構築（stale closure回避）
      const gameState: GameState = {
        version: '1.0.0',
        savedAt: new Date().toISOString(),
        seed: Date.now(),
        currentDate: { year: prev.year, month: 4, cardNumber: prev.currentCard },
        currentPhase: 'regularSeason',
        offseasonStep: null,
        playerTeamId: prev.playerTeamId,
        gmName: prev.gmName,
        difficulty: prev.difficulty,
        teams: prev.teams,
        players: prev.players,
        reincarnationPool: [],
        overseasPlayers: [],
        events: prev.events,
        seasonRecords: [],
        hallOfFame: [],
        schedule: flattenSchedule(prev.schedule),
        currentCardIndex: prev.currentCard,
      };

      // 難易度補正付き成長（offseason.tsの前に実行）
      const diffMod = DIFFICULTY_MODIFIERS[prev.difficulty];
      for (const player of gameState.players) {
        const team = gameState.teams.find((t) => t.playerIds.includes(player.id));
        const isPlayerTeam = team?.id === prev.playerTeamId;
        const facilityBonus = team ? (team.facilities.training - 1) * 0.05 : 0;
        const dormBonus = team && player.age <= 25 ? (team.facilities.dormitory - 1) * 0.03 : 0;
        const growthMult = isPlayerTeam ? diffMod.growthMultiplier : 1.0;
        applyYearlyGrowth(player, facilityBonus * growthMult, dormBonus * growthMult);
        applyDecline(player);
      }

      // オフシーズン処理（gameStateを直接変更する。age++/成績リセット/チーム成績リセットも含む）
      const offseasonEvents = runOffseason(gameState);

      // offseason.tsが年齢加算・成績リセット・チーム成績リセットを実施済み
      // 新しいスケジュール生成（変更済みteamsを使用）
      const newSchedule = generateRoundSchedule(gameState.teams);

      return {
        ...prev,
        year: gameState.currentDate.year,
        currentCard: 0,
        recentResults: [] as GameResult[][],
        schedule: newSchedule,
        teams: gameState.teams,
        players: gameState.players,
        screen: 'offseasonSummary' as Screen,
        events: [...prev.events, ...offseasonEvents].slice(-50),
        postseasonResult: null,
        showPostseason: false,
      };
    });
  }, []);

  /** セーブ */
  const handleSave = useCallback(async (slot: number) => {
    const gameState = buildGameState();
    await saveGame(slot, gameState);
    await autoSave(gameState);
  }, [buildGameState]);

  /** ロード */
  const handleLoad = useCallback(async () => {
    const saves = await listSaveSlots();
    if (saves.length === 0) return;
    // 最新のセーブをロード
    const latestSlot = saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0].slot;
    const gameState = await loadGame(latestSlot);
    if (!gameState) return;

    initRandom(gameState.seed);
    setState({
      screen: 'home',
      teams: gameState.teams,
      players: gameState.players,
      schedule: rebuildRoundsFromMatchCards(gameState.schedule),
      currentCard: gameState.currentCardIndex,
      recentResults: [] as GameResult[][],
      playerTeamId: gameState.playerTeamId,
      gmName: gameState.gmName,
      year: gameState.currentDate.year,
      difficulty: gameState.difficulty,
      events: gameState.events,
      hasSaveData: true,
      postseasonResult: null,
      showPostseason: false,
    });
  }, []);

  /** エクスポート */
  const handleExport = useCallback(() => {
    const gameState = buildGameState();
    exportSaveToJson(gameState, 1);
  }, [buildGameState]);

  /** インポート */
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const gameState = await importSaveFromJson(file);
        initRandom(gameState.seed);
        setState({
          screen: 'home',
          teams: gameState.teams,
          players: gameState.players,
          schedule: rebuildRoundsFromMatchCards(gameState.schedule),
          currentCard: gameState.currentCardIndex,
          recentResults: [] as GameResult[][],
          playerTeamId: gameState.playerTeamId,
          gmName: gameState.gmName,
          year: gameState.currentDate.year,
          difficulty: gameState.difficulty,
          events: gameState.events,
          hasSaveData: true,
          postseasonResult: null,
          showPostseason: false,
        });
      } catch {
        alert('セーブデータの読み込みに失敗しました');
      }
    };
    input.click();
  }, []);

  const playerTeam = state.teams.find((t) => t.id === state.playerTeamId);
  const totalCards = state.schedule.length;
  const isSeasonOver = state.currentCard >= totalCards && totalCards > 0;

  // タイトル画面
  if (state.screen === 'title') {
    return (
      <TitleScreen
        onNewGame={handleNewGame}
        onLoad={handleLoad}
        onImport={handleImport}
        hasSaveData={state.hasSaveData}
      />
    );
  }

  // ゲーム中の画面ルーティング
  switch (state.screen) {
    case 'home':
      return playerTeam ? (
        <HomeScreen
          team={playerTeam}
          players={state.players}
          gmName={state.gmName}
          year={state.year}
          cardNumber={state.currentCard}
          totalCards={totalCards}
          events={state.events}
          onNavigate={navigate}
          onAdvanceCard={advanceCard}
          onAdvanceMonth={advanceMonth}
          isSeasonOver={isSeasonOver}
          onProcessOffseason={state.postseasonResult ? processOffseason : runPostseasonHandler}
          postseasonDone={!!state.postseasonResult}
        />
      ) : null;

    case 'game':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">試合結果</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 hover:text-white text-sm">
                ホームへ
              </button>
            </div>

            {state.recentResults.length > 0 ? (
              <>
                {/* 自チームの3連戦を詳細表示 */}
                {(() => {
                  const myResults = getMyTeamResults(state.recentResults, state.playerTeamId);
                  return myResults.length > 0 ? (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-yellow-300 mb-2">自チーム試合結果</h3>
                      {myResults.map((result, i) => (
                        <GameResultView key={`my-${i}`} result={result} teams={state.teams} />
                      ))}
                    </div>
                  ) : null;
                })()}
                {/* 他の試合をコンパクト表示 */}
                <div>
                  <h3 className="text-sm font-bold text-gray-400 mb-2">他球場の結果</h3>
                  {state.recentResults
                    .filter((matchResults) =>
                      matchResults.length > 0 &&
                      matchResults[0].homeTeamId !== state.playerTeamId &&
                      matchResults[0].awayTeamId !== state.playerTeamId
                    )
                    .map((matchResults, mi) => {
                      if (matchResults.length === 0) return null;
                      const home = state.teams.find((t) => t.id === matchResults[0].homeTeamId);
                      const away = state.teams.find((t) => t.id === matchResults[0].awayTeamId);
                      const homeName = home?.shortName ?? matchResults[0].homeTeamId;
                      const awayName = away?.shortName ?? matchResults[0].awayTeamId;
                      return (
                        <div key={`other-${mi}`} className="bg-gray-800 rounded px-3 py-2 mb-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 font-bold w-16 text-right">{homeName}</span>
                            <span className="text-gray-500">vs</span>
                            <span className="text-gray-300 font-bold w-16">{awayName}</span>
                            <span className="text-gray-500 ml-auto">
                              {matchResults.map((r) => {
                                const hs = r.inningScores.reduce((s, inn) => s + inn.home, 0);
                                const as_ = r.inningScores.reduce((s, inn) => s + inn.away, 0);
                                return `${hs}-${as_}`;
                              }).join(' / ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">まだ試合結果がありません</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StandingsView title="セ・リーグ" standings={calculateStandings(state.teams, 'central')} playerTeamId={state.playerTeamId} />
              <StandingsView title="パ・リーグ" standings={calculateStandings(state.teams, 'pacific')} playerTeamId={state.playerTeamId} />
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={advanceCard} disabled={isSeasonOver} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-bold transition">
                {isSeasonOver ? 'シーズン終了' : '次のカードへ'}
              </button>
              <button onClick={advanceMonth} disabled={isSeasonOver} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg text-sm transition">
                月送り
              </button>
              <button onClick={() => navigate('home')} className="bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-lg transition">
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
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => setStandingsTab('team')}
                className={`flex-1 py-2 rounded text-sm font-medium transition ${
                  standingsTab === 'team' ? 'bg-blue-600' : 'bg-gray-800 text-gray-400'
                }`}
              >
                チーム順位
              </button>
              <button
                onClick={() => setStandingsTab('individual')}
                className={`flex-1 py-2 rounded text-sm font-medium transition ${
                  standingsTab === 'individual' ? 'bg-blue-600' : 'bg-gray-800 text-gray-400'
                }`}
              >
                個人成績
              </button>
            </div>
            {standingsTab === 'team' ? (
              <div className="space-y-4">
                <StandingsView title="セ・リーグ" standings={calculateStandings(state.teams, 'central')} playerTeamId={state.playerTeamId} />
                <StandingsView title="パ・リーグ" standings={calculateStandings(state.teams, 'pacific')} playerTeamId={state.playerTeamId} />
              </div>
            ) : (
              <RankingsView players={state.players} teams={state.teams} playerTeamId={state.playerTeamId} />
            )}
          </div>
        </div>
      );

    case 'roster':
      return playerTeam ? (
        <RosterScreen
          team={playerTeam}
          players={state.players}
          onBack={() => navigate('home')}
          onSwapLineup={(i1, i2) => {
            setState((prev) => {
              const t = prev.teams.find((t) => t.id === prev.playerTeamId);
              if (!t) return prev;
              const order = [...t.lineup.order];
              [order[i1], order[i2]] = [order[i2], order[i1]];
              t.lineup.order = order;
              return { ...prev };
            });
          }}
          onSwapRotation={(i1, i2) => {
            setState((prev) => {
              const t = prev.teams.find((t) => t.id === prev.playerTeamId);
              if (!t) return prev;
              const starters = [...t.rotation.starters];
              [starters[i1], starters[i2]] = [starters[i2], starters[i1]];
              t.rotation.starters = starters;
              return { ...prev };
            });
          }}
          onToggleFirstTeam={(playerId) => {
            setState((prev) => {
              const player = prev.players.find((p) => p.id === playerId);
              if (!player) return prev;
              player.isFirstTeam = !player.isFirstTeam;
              return { ...prev };
            });
          }}
          onReplaceLineup={(index, newPlayerId) => {
            setState((prev) => {
              const t = prev.teams.find((t) => t.id === prev.playerTeamId);
              if (!t) return prev;
              const order = [...t.lineup.order];
              order[index] = newPlayerId;
              t.lineup.order = order;
              return { ...prev };
            });
          }}
          onReplaceRotation={(index, newPlayerId) => {
            setState((prev) => {
              const t = prev.teams.find((t) => t.id === prev.playerTeamId);
              if (!t) return prev;
              const starters = [...t.rotation.starters];
              starters[index] = newPlayerId;
              t.rotation.starters = starters;
              return { ...prev };
            });
          }}
        />
      ) : null;

    case 'events':
      return (
        <NotificationSystem events={state.events} onMarkRead={markEventRead} onBack={() => navigate('home')} />
      );

    case 'scout':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">スカウト</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 text-sm">戻る</button>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
              <p>スカウト情報はオフシーズンのドラフト前に届きます。</p>
              <p className="text-sm mt-2">シーズン中はスカウトが情報収集中です。</p>
            </div>
          </div>
        </div>
      );

    case 'management':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">球団管理センター</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 text-sm">戻る</button>
            </div>
            <div className="space-y-3">
              {playerTeam && (
                <>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-gray-400 mb-2">施設</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>練習施設 Lv.{playerTeam.facilities.training}</div>
                      <div>ブルペン Lv.{playerTeam.facilities.bullpen}</div>
                      <div>リハビリ Lv.{playerTeam.facilities.rehab}</div>
                      <div>球場 Lv.{playerTeam.facilities.stadium}</div>
                      <div>スカウト拠点 Lv.{playerTeam.facilities.scoutBase}</div>
                      <div>寮 Lv.{playerTeam.facilities.dormitory}</div>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-gray-400 mb-2">財務</h3>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400">資金</span>
                        <span>{(playerTeam.finances.balance / 10000).toFixed(1)}億円</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">赤字年数</span>
                        <span className={playerTeam.finances.consecutiveDeficitYears > 0 ? 'text-red-400' : ''}>
                          {playerTeam.finances.consecutiveDeficitYears}年
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );

    case 'offseasonSummary': {
      const awards = state.events.filter((e) => e.type === 'milestone' && e.title.includes('MVP') || e.title.includes('最多') || e.title.includes('首位'));
      const faEvents = state.events.filter((e) => e.type === 'faDeclaration');
      const tradeEvents = state.events.filter((e) => e.title.includes('トレード'));
      const retireEvents = state.events.filter((e) => e.type === 'retirement');
      const otherEvents = state.events.filter((e) => !awards.includes(e) && !faEvents.includes(e) && !tradeEvents.includes(e) && !retireEvents.includes(e) && !e.isRead);

      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">{state.year}年 オフシーズン</h2>

            {awards.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-3">
                <h3 className="text-sm font-bold text-yellow-400 mb-2">表彰</h3>
                {awards.map((e) => <p key={e.id} className="text-sm text-gray-300">{e.message}</p>)}
              </div>
            )}

            {faEvents.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-3">
                <h3 className="text-sm font-bold text-blue-400 mb-2">FA移籍</h3>
                {faEvents.map((e) => <p key={e.id} className="text-sm text-gray-300">{e.message}</p>)}
              </div>
            )}

            {tradeEvents.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-3">
                <h3 className="text-sm font-bold text-green-400 mb-2">トレード</h3>
                {tradeEvents.map((e) => <p key={e.id} className="text-sm text-gray-300">{e.message}</p>)}
              </div>
            )}

            {retireEvents.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-3">
                <h3 className="text-sm font-bold text-gray-400 mb-2">引退</h3>
                {retireEvents.map((e) => <p key={e.id} className="text-sm text-gray-300">{e.message}</p>)}
              </div>
            )}

            {otherEvents.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mb-3">
                <h3 className="text-sm font-bold text-gray-400 mb-2">その他</h3>
                {otherEvents.slice(0, 10).map((e) => <p key={e.id} className="text-sm text-gray-300">{e.title}: {e.message}</p>)}
              </div>
            )}

            <button
              onClick={() => navigate('home')}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition mt-4"
            >
              {state.year}年シーズンへ
            </button>
          </div>
        </div>
      );
    }

    case 'settings':
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">設定</h2>
              <button onClick={() => navigate('home')} className="text-gray-400 text-sm">戻る</button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleSave(1)}
                className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-left transition font-medium"
              >
                セーブ（スロット1）
              </button>
              <button
                onClick={handleExport}
                className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-lg text-left transition"
              >
                セーブデータを書き出す（JSON）
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
