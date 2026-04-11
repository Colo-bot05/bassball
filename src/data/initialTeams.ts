import type { Team } from '@/types/team';
import type { Player, Position } from '@/types/player';
import { TEAM_PRESETS } from '@/constants/teams';
import { csvRowToPlayer } from '@/data/csvImporter';
import { generateAllPlayers } from '@/data/samplePlayers';

/** 空のチーム成績 */
function emptyRecord() {
  return { wins: 0, losses: 0, draws: 0, runsScored: 0, runsAllowed: 0 };
}

/** 空の財務 */
function emptyFinances(broadcastRevenue: number) {
  return {
    balance: 1000000,
    ticketRevenue: 0,
    broadcastRevenue,
    merchandiseRevenue: 0,
    sponsorRevenue: 0,
    totalSalary: 0,
    staffSalary: 50000,
    facilityMaintenance: 10000,
    scoutExpense: 5000,
    consecutiveDeficitYears: 0,
  };
}

/** ポジション重複なしでスタメン9人を選ぶ */
function buildLineup(fielders: Player[], isDH: boolean): Player[] {
  const positions: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const lineup: Player[] = [];
  const usedIds = new Set<string>();

  // 各ポジションから最も年俸の高い（＝実力の高い）選手を1人ずつ選ぶ
  for (const pos of positions) {
    const candidate = fielders
      .filter((p) => p.position === pos && !usedIds.has(p.id) && p.isFirstTeam && !p.injury.isInjured)
      .sort((a, b) => b.contract.salary - a.contract.salary)[0];
    if (candidate) {
      lineup.push(candidate);
      usedIds.add(candidate.id);
    }
  }

  // DH制の場合、9人目としてDH or 余った野手から最も打力の高い選手
  if (isDH && lineup.length === 8) {
    const dhCandidate = fielders
      .filter((p) => !usedIds.has(p.id) && p.isFirstTeam && !p.injury.isInjured)
      .sort((a, b) => (b.batterStats.power + b.batterStats.meet) - (a.batterStats.power + a.batterStats.meet))[0];
    if (dhCandidate) {
      lineup.push(dhCandidate);
      usedIds.add(dhCandidate.id);
    }
  }

  // DH無しの場合もまだ8人なら残りから補充
  while (lineup.length < 9) {
    const extra = fielders.find((p) => !usedIds.has(p.id) && p.isFirstTeam && !p.injury.isInjured);
    if (!extra) break;
    lineup.push(extra);
    usedIds.add(extra.id);
  }

  return lineup;
}

/**
 * 初期12球団データを生成
 */
export function createInitialTeams(): { teams: Team[]; players: Player[] } {
  const allPlayers = generateAllPlayers().map(csvRowToPlayer);

  const teams: Team[] = TEAM_PRESETS.map((preset) => {
    const teamPlayers = allPlayers.filter((p) => p.teamId === preset.id);
    const pitchers = teamPlayers.filter((p) => p.position === 'P');
    const fielders = teamPlayers.filter((p) => p.position !== 'P');

    const starters = pitchers.filter((p) => p.pitcherRole === 'starter').slice(0, 6);
    const closer = pitchers.find((p) => p.pitcherRole === 'closer');
    const setups = pitchers
      .filter((p) => p.pitcherRole === 'setup' || p.pitcherRole === 'reliever')
      .slice(0, 2);

    const isDH = preset.league === 'pacific';
    const lineup = buildLineup(fielders, isDH);
    const dhPlayer = isDH && lineup.length === 9 ? lineup[8] : null;

    return {
      id: preset.id,
      name: preset.name,
      shortName: preset.shortName,
      league: preset.league,
      homeStadium: preset.homeStadium,
      ai: { ...preset.ai },
      facilities: { ...preset.initialFacilities },
      finances: emptyFinances(preset.broadcastRevenue),
      playerIds: teamPlayers.map((p) => p.id),
      lineup: {
        order: lineup.map((p) => p.id),
        positions: Object.fromEntries(
          lineup.map((p, i) => [p.id, isDH && i === 8 ? 'DH' as Position : p.position]),
        ),
        dhPlayerId: dhPlayer?.id ?? null,
      },
      rotation: {
        starters: starters.map((p) => p.id),
      },
      bullpen: {
        closerId: closer?.id ?? null,
        setupIds: setups.map((p) => p.id),
        pinchHitterId: null,
        pinchRunnerId: null,
        starterPullStamina: 40,
        closerEntryLeadMax: 3,
      },
      record: emptyRecord(),
      batteryChemistry: [],
      goldenEra: { isActive: false, remainingYears: 0 },
      isPlayerControlled: false,
    };
  });

  return { teams, players: allPlayers };
}
