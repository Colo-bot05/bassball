import { useState, useCallback } from 'react';
import { initRandom, generateId } from '@/utils/random';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import type { GameResult, GameEvent, GameState } from '@/types/game';
import { createInitialTeams } from '@/data/initialTeams';
import { generateSchedule, calculateStandings } from '@/engine/season';
import { simulateGame } from '@/engine/simulation';
import { updateCondition, checkSlump } from '@/engine/condition';
import { checkInjury, healInjury, updateAwakeningGaugeFromInjury } from '@/engine/injury';
import { applyYearlyGrowth, applyDecline, checkAwakening, checkRetirement } from '@/engine/growth';
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

type Screen = 'title' | 'home' | 'game' | 'standings' | 'roster' | 'events' | 'settings' | 'scout' | 'management';

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
  hasSaveData: boolean;
  postseasonResult: PostseasonResult | null;
  showPostseason: boolean;
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

/** 1カード分をシミュレーション（純粋関数に近い形で処理） */
function simulateOneCard(prev: AppState): AppState {
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

  // 個人成績を蓄積
  accumulatePlayerStats(prev.players, results);

  // 調子・怪我・覚醒を更新
  const newEvents = [...prev.events];
  processCardEffects(prev.players, newEvents, prev.year, prev.currentCard + 1, prev.difficulty);

  const newSchedule = [...prev.schedule];
  newSchedule[prev.currentCard] = { ...card, results };

  return {
    ...prev,
    schedule: newSchedule,
    currentCard: prev.currentCard + 1,
    recentResults: results,
    events: newEvents.slice(-20),
  };
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
      schedule: state.schedule.map((c) => ({
        ...c,
        isPlayed: c.results.length > 0,
      })),
      currentCardIndex: state.currentCard,
    };
  }, [state]);

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
        recentResults: result.japanSeriesResult.games.slice(-1),
      };
    });
  }, []);

  /** オフシーズン処理（実際のエンジンを使用） */
  const processOffseason = useCallback(() => {
    setState((prev) => {
      const gameState = buildGameState();

      const diffMod = DIFFICULTY_MODIFIERS[prev.difficulty];

      // 年間成長・衰えを適用（難易度補正付き）
      for (const player of prev.players) {
        const team = prev.teams.find((t) => t.playerIds.includes(player.id));
        const isPlayerTeam = team?.id === prev.playerTeamId;
        const facilityBonus = team ? (team.facilities.training - 1) * 0.05 : 0;
        const dormBonus = team && player.age <= 25 ? (team.facilities.dormitory - 1) * 0.03 : 0;
        const growthMult = isPlayerTeam ? diffMod.growthMultiplier : 1.0;
        applyYearlyGrowth(player, facilityBonus * growthMult, dormBonus * growthMult);
        applyDecline(player);
      }

      // offseason.ts の統合処理を実行
      const offseasonEvents = runOffseason(gameState);

      // 引退判定
      const retiredPlayers: Player[] = [];
      for (const player of prev.players) {
        if (checkRetirement(player)) {
          retiredPlayers.push(player);
        }
      }

      // 引退イベント
      const retirementEvents: GameEvent[] = retiredPlayers.map((p) => ({
        id: generateId(),
        type: 'retirement' as const,
        title: `${p.name}が引退`,
        message: `${p.name}（${p.age}歳）が現役を引退しました。${p.yearsAsPro}年間お疲れ様でした。`,
        date: { year: prev.year, month: 11, cardNumber: 0 },
        playerId: p.id,
        teamId: p.teamId,
        isRead: false,
      }));

      // 引退選手を除外
      const retiredIds = new Set(retiredPlayers.map((p) => p.id));
      const activePlayers = prev.players.filter((p) => !retiredIds.has(p.id));

      // 選手を加齢、成績リセット
      for (const player of activePlayers) {
        player.age++;
        player.yearsAsPro++;
        if (player.isFirstTeam) player.yearsInFirstTeam++;
        player.currentBatterStats = {
          games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
          rbi: 0, runs: 0, stolenBases: 0, caughtStealing: 0, walks: 0,
          strikeouts: 0, sacrificeBunts: 0, sacrificeFlies: 0, hitByPitch: 0,
        };
        player.currentPitcherStats = {
          games: 0, gamesStarted: 0, wins: 0, losses: 0, saves: 0, holds: 0,
          inningsPitched: 0, hitsAllowed: 0, homeRunsAllowed: 0, strikeouts: 0,
          walks: 0, earnedRuns: 0,
        };
      }

      // 新しいスケジュール生成
      const newSchedule = generateSchedule(prev.teams).map((card) => ({
        homeTeamId: card.homeTeamId,
        awayTeamId: card.awayTeamId,
        cardNumber: card.cardNumber,
        results: [],
      }));

      // チーム成績リセット
      const resetTeams = prev.teams.map((t) => ({
        ...t,
        record: { wins: 0, losses: 0, draws: 0, runsScored: 0, runsAllowed: 0 },
        playerIds: t.playerIds.filter((id) => !retiredIds.has(id)),
      }));

      const allEvents = [
        ...prev.events,
        ...offseasonEvents,
        ...retirementEvents,
        {
          id: generateId(),
          type: 'milestone' as const,
          title: `${prev.year + 1}年シーズン開始`,
          message: 'オフシーズンが終了し、新シーズンが始まります。',
          date: { year: prev.year + 1, month: 2, cardNumber: 0 },
          playerId: null,
          teamId: null,
          isRead: false,
        },
      ].slice(-20);

      return {
        ...prev,
        year: prev.year + 1,
        currentCard: 0,
        recentResults: [],
        schedule: newSchedule,
        teams: resetTeams,
        players: activePlayers,
        screen: 'home',
        events: allEvents,
        postseasonResult: null,
        showPostseason: false,
      };
    });
  }, [buildGameState]);

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
      schedule: gameState.schedule.map((c) => ({
        homeTeamId: c.homeTeamId,
        awayTeamId: c.awayTeamId,
        cardNumber: c.cardNumber,
        results: c.results,
      })),
      currentCard: gameState.currentCardIndex,
      recentResults: [],
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
          schedule: gameState.schedule.map((c) => ({
            homeTeamId: c.homeTeamId,
            awayTeamId: c.awayTeamId,
            cardNumber: c.cardNumber,
            results: c.results,
          })),
          currentCard: gameState.currentCardIndex,
          recentResults: [],
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
              state.recentResults.map((result, i) => (
                <GameResultView key={i} result={result} teams={state.teams} />
              ))
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
            <div className="space-y-4">
              <StandingsView title="セ・リーグ" standings={calculateStandings(state.teams, 'central')} playerTeamId={state.playerTeamId} />
              <StandingsView title="パ・リーグ" standings={calculateStandings(state.teams, 'pacific')} playerTeamId={state.playerTeamId} />
            </div>
          </div>
        </div>
      );

    case 'roster':
      return playerTeam ? (
        <RosterScreen team={playerTeam} players={state.players} onBack={() => navigate('home')} />
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
