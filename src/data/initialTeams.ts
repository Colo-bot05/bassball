import type { Team } from '@/types/team';
import type { Player } from '@/types/player';
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

    const lineup = fielders.slice(0, 9);

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
        positions: Object.fromEntries(lineup.map((p) => [p.id, p.position])),
        dhPlayerId: preset.league === 'pacific' && lineup.length > 0 ? lineup[0].id : null,
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
