import type { GameState, GameEvent, GameEventType } from '@/types/game';
import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import { generateId } from '@/utils/random';
import { calculateTitles, checkHallOfFame } from '@/engine/awards';
import { checkFAEligibility, decideFADeclaration, negotiateFA } from '@/engine/freeAgent';
import { calculateDesiredSalary, negotiateContract } from '@/engine/contract';
import { proposeAITrade } from '@/engine/trade';
import { generateDraftCandidates, conductDraft } from '@/engine/draft';
import { processFinances } from '@/engine/finances';
import { checkRetirement } from '@/engine/growth';
import { calculateStandings } from '@/engine/season';

/**
 * ゲームイベントを生成するヘルパー
 * @param type - イベント種類
 * @param title - タイトル
 * @param message - メッセージ
 * @param year - ゲーム内年
 * @param playerId - 関連選手ID
 * @param teamId - 関連球団ID
 * @returns GameEventオブジェクト
 */
function createEvent(
  type: GameEventType,
  title: string,
  message: string,
  year: number,
  playerId: string | null,
  teamId: string | null,
): GameEvent {
  return {
    id: generateId(),
    type,
    title,
    message,
    date: { year, month: 11, cardNumber: 0 },
    playerId,
    teamId,
    isRead: false,
  };
}

/**
 * チームIDから球団名を取得する
 * @param teamId - 球団ID
 * @param teams - 全球団
 * @returns 球団名
 */
function getTeamName(teamId: string, teams: Team[]): string {
  return teams.find((t) => t.id === teamId)?.name ?? '不明';
}

/**
 * チームの順位を取得する
 * @param teamId - 球団ID
 * @param teams - 全球団
 * @returns 順位（1-6）
 */
function getTeamRank(teamId: string, teams: Team[]): number {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return 6;

  const standings = calculateStandings(teams, team.league);
  const entry = standings.find((s) => s.teamId === teamId);
  return entry?.rank ?? 6;
}

/**
 * オフシーズン処理を一括実行する
 * 表彰 → FA宣言 → 契約更改 → FA交渉 → トレード → 外国人スカウト → 戦力外/引退 → ドラフト → キャンプ準備
 * の順序で処理を行い、発生したイベントを返す
 * @param state - ゲーム状態オブジェクト（直接変更される）
 * @returns 生成されたイベントの配列
 */
export function processOffseason(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const year = state.currentDate.year;

  // ========================================
  // 1. 表彰式
  // ========================================
  const titles = calculateTitles(state.players, state.teams);
  for (const title of titles) {
    events.push(
      createEvent(
        'milestone',
        '表彰',
        `${title.playerName}（${title.teamName}）が${title.title}を獲得（${title.value}）`,
        year,
        null,
        null,
      ),
    );
  }

  // 殿堂入りチェック（簡略版：seasonRecordsからMVP回数を集計）
  const hofCandidates = state.hallOfFame.length > 0 ? [] : []; // 基盤のみ
  const hofNames = checkHallOfFame(hofCandidates);
  for (const name of hofNames) {
    events.push(
      createEvent('milestone', '殿堂入り', `${name}が殿堂入りを果たしました`, year, null, null),
    );
    state.hallOfFame.push({ name, inductionYear: year, career: '' });
  }

  // ========================================
  // 2. FA宣言
  // ========================================
  const faDeclaredPlayers: Player[] = [];

  for (const player of state.players) {
    const eligibility = checkFAEligibility(player);
    if (!eligibility.domestic && !eligibility.overseas) continue;

    const team = state.teams.find((t) => t.id === player.teamId);
    if (!team || team.isPlayerControlled) continue; // プレイヤー球団の選手はスキップ

    if (decideFADeclaration(player, team)) {
      faDeclaredPlayers.push(player);
      events.push(
        createEvent(
          'faDeclaration',
          'FA宣言',
          `${player.name}（${team.name}）がFA宣言しました`,
          year,
          player.id,
          team.id,
        ),
      );
    }
  }

  // ========================================
  // 3. 契約更改（FA宣言していない選手）
  // ========================================
  for (const player of state.players) {
    if (faDeclaredPlayers.includes(player)) continue;
    if (player.contract.remainingYears > 0) {
      player.contract.remainingYears--;
      continue;
    }

    const team = state.teams.find((t) => t.id === player.teamId);
    if (!team) continue;
    if (team.isPlayerControlled) continue; // プレイヤー球団はUI操作

    const desiredSalary = calculateDesiredSalary(player);
    // AIは希望年俸の85-110%をオファー
    const offerRatio = 0.85 + team.ai.budgetMode * 0.25;
    const offeredSalary = Math.round(desiredSalary * offerRatio);

    const result = negotiateContract(player, offeredSalary, null);

    if (result.success) {
      player.contract.salary = offeredSalary;
      player.contract.remainingYears = 0;
      player.contract.promise = null;
      player.contract.promiseKept = null;
      player.isDisgruntled = result.isDisgruntled;
    } else {
      // 契約不合意 → 自由契約予備軍（後で処理）
      player.isDisgruntled = true;
    }
  }

  // ========================================
  // 4. FA交渉
  // ========================================
  for (const player of faDeclaredPlayers) {
    const currentTeam = state.teams.find((t) => t.id === player.teamId);
    if (!currentTeam) continue;

    const currentRank = getTeamRank(currentTeam.id, state.teams);
    const desiredSalary = calculateDesiredSalary(player);

    // 入札チームを決定（資金力が高く、そのポジションが弱いチーム）
    const biddingTeams = state.teams
      .filter((t) => t.id !== player.teamId && !t.isPlayerControlled)
      .filter((t) => t.ai.winNowMode > 0.5 || t.ai.budgetMode > 0.6)
      .slice(0, 3)
      .map((t) => ({
        teamId: t.id,
        offerSalary: Math.round(desiredSalary * (0.9 + t.ai.budgetMode * 0.3)),
        teamRank: getTeamRank(t.id, state.teams),
      }));

    const currentTeamInfo = {
      teamId: currentTeam.id,
      offerSalary: Math.round(desiredSalary * 1.0),
      teamRank: currentRank,
      promiseKept: player.contract.promiseKept ?? true,
      isDisgruntled: player.isDisgruntled,
    };

    const winnerTeamId = negotiateFA(player, biddingTeams, currentTeamInfo);

    if (winnerTeamId !== player.teamId) {
      // 移籍処理
      const oldTeam = state.teams.find((t) => t.id === player.teamId);
      const newTeam = state.teams.find((t) => t.id === winnerTeamId);

      if (oldTeam) {
        oldTeam.playerIds = oldTeam.playerIds.filter((id) => id !== player.id);
      }
      if (newTeam) {
        newTeam.playerIds.push(player.id);
      }

      const bidInfo = biddingTeams.find((b) => b.teamId === winnerTeamId);
      player.contract.salary = bidInfo?.offerSalary ?? desiredSalary;
      player.teamId = winnerTeamId;
      player.isDisgruntled = false;
      player.contract.remainingYears = 2; // FA移籍は通常3年契約
      player.contract.promise = null;
      player.contract.promiseKept = null;

      events.push(
        createEvent(
          'faDeclaration',
          'FA移籍',
          `${player.name}が${getTeamName(winnerTeamId, state.teams)}に移籍しました`,
          year,
          player.id,
          winnerTeamId,
        ),
      );
    }
  }

  // ========================================
  // 5. トレード
  // ========================================
  for (let i = 0; i < state.teams.length; i++) {
    for (let j = i + 1; j < state.teams.length; j++) {
      const fromTeam = state.teams[i];
      const toTeam = state.teams[j];

      // プレイヤー球団はAIトレードしない
      if (fromTeam.isPlayerControlled || toTeam.isPlayerControlled) continue;

      const tradeResult = proposeAITrade(fromTeam, toTeam, state.players);
      if (!tradeResult) continue;

      // トレード実行
      for (const playerId of tradeResult.fromPlayerIds) {
        const player = state.players.find((p) => p.id === playerId);
        if (player) {
          player.teamId = toTeam.id;
          fromTeam.playerIds = fromTeam.playerIds.filter((id) => id !== playerId);
          toTeam.playerIds.push(playerId);
        }
      }
      for (const playerId of tradeResult.toPlayerIds) {
        const player = state.players.find((p) => p.id === playerId);
        if (player) {
          player.teamId = fromTeam.id;
          toTeam.playerIds = toTeam.playerIds.filter((id) => id !== playerId);
          fromTeam.playerIds.push(playerId);
        }
      }

      const fromNames = tradeResult.fromPlayerIds
        .map((id) => state.players.find((p) => p.id === id)?.name ?? '不明')
        .join('、');
      const toNames = tradeResult.toPlayerIds
        .map((id) => state.players.find((p) => p.id === id)?.name ?? '不明')
        .join('、');

      events.push(
        createEvent(
          'tradeOffer',
          'トレード成立',
          `${fromTeam.name}の${fromNames} ⇔ ${toTeam.name}の${toNames} のトレードが成立`,
          year,
          null,
          null,
        ),
      );
    }
  }

  // ========================================
  // 6. 外国人スカウト（簡易版）
  // ========================================
  // 外国人選手の帰国・新規獲得はここで処理
  for (const team of state.teams) {
    if (team.isPlayerControlled) continue;

    // 帰国判定（外国人で成績が悪い場合）
    const foreignPlayers = state.players.filter(
      (p) => p.teamId === team.id && p.isForeign,
    );
    for (const fp of foreignPlayers) {
      const stats = fp.position === 'P' ? fp.currentPitcherStats : fp.currentBatterStats;
      if (stats.games < 30) {
        // 出場少ない外国人は退団
        team.playerIds = team.playerIds.filter((id) => id !== fp.id);
        state.players = state.players.filter((p) => p.id !== fp.id);
        events.push(
          createEvent(
            'overseas',
            '外国人退団',
            `${fp.name}（${team.name}）が退団しました`,
            year,
            fp.id,
            team.id,
          ),
        );
      }
    }
  }

  // ========================================
  // 7. 戦力外通告・引退処理
  // ========================================
  const retiredPlayers: Player[] = [];

  for (const player of [...state.players]) {
    if (checkRetirement(player)) {
      retiredPlayers.push(player);
      const teamName = getTeamName(player.teamId, state.teams);

      events.push(
        createEvent(
          'retirement',
          '引退',
          `${player.name}（${teamName}）が現役引退しました（${player.yearsAsPro}年間のプロ生活）`,
          year,
          player.id,
          player.teamId,
        ),
      );

      // 球団から除外
      const team = state.teams.find((t) => t.id === player.teamId);
      if (team) {
        team.playerIds = team.playerIds.filter((id) => id !== player.id);
      }

      // 選手リストから除外
      state.players = state.players.filter((p) => p.id !== player.id);
    }
  }

  // ========================================
  // 8. ドラフト
  // ========================================
  const existingNames = state.players.map((p) => p.name);
  const candidates = generateDraftCandidates(state.reincarnationPool, existingNames);
  const draftPicks = conductDraft(candidates, state.teams, state.players);

  for (const pick of draftPicks) {
    const player = candidates.find((c) => c.id === pick.playerId);
    if (!player) continue;

    // 選手を球団に追加
    const team = state.teams.find((t) => t.id === pick.teamId);
    if (team) {
      team.playerIds.push(player.id);
    }
    state.players.push(player);

    if (pick.round <= 3) {
      events.push(
        createEvent(
          'scoutReport',
          'ドラフト指名',
          `${getTeamName(pick.teamId, state.teams)}が${pick.round}巡目で${player.name}（${player.position}）を指名`,
          year,
          player.id,
          pick.teamId,
        ),
      );
    }
  }

  // 使用された転生エントリをプールから除去
  const draftedNames = new Set(
    draftPicks
      .map((pick) => candidates.find((c) => c.id === pick.playerId))
      .filter((p): p is Player => p !== undefined && p.reincarnationSource !== null)
      .map((p) => p.reincarnationSource!),
  );
  state.reincarnationPool = state.reincarnationPool.filter(
    (entry) => !draftedNames.has(entry.name),
  );

  // ========================================
  // 9. 財務処理
  // ========================================
  for (const team of state.teams) {
    const rank = getTeamRank(team.id, state.teams);
    const financeResult = processFinances(team, state.players, rank);

    if (financeResult.isDeficit) {
      events.push(
        createEvent(
          'milestone',
          '赤字決算',
          `${team.name}が${Math.abs(financeResult.profit)}万円の赤字決算（${team.finances.consecutiveDeficitYears}年連続）`,
          year,
          null,
          team.id,
        ),
      );
    }
  }

  // ========================================
  // 10. キャンプ準備
  // ========================================
  // シーズン成績をリセット
  for (const player of state.players) {
    player.age++;
    player.yearsAsPro++;
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
    player.demotionCooldown = 0;
  }

  // チーム成績をリセット
  for (const team of state.teams) {
    team.record = { wins: 0, losses: 0, draws: 0, runsScored: 0, runsAllowed: 0 };
  }

  // フェーズを更新
  state.currentDate.year++;
  state.currentDate.month = 2;
  state.currentDate.cardNumber = 0;
  state.currentPhase = 'camp';
  state.offseasonStep = null;

  return events;
}
