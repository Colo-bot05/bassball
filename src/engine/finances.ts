import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import { FACILITY_EFFECTS } from '@/constants/balance';

/** 基本チケット収入（万円） */
const BASE_TICKET_REVENUE = 200000;

/** 順位ボーナス倍率（1位=1.3, 2位=1.15, ... 6位=0.7） */
const RANK_MULTIPLIERS = [0, 1.30, 1.15, 1.05, 0.95, 0.85, 0.70] as const;

/** 基本グッズ収入（万円） */
const BASE_MERCHANDISE_REVENUE = 50000;

/** 基本スポンサー収入（万円） */
const BASE_SPONSOR_REVENUE = 80000;

/** スタッフ給与基本額（万円） */
const BASE_STAFF_SALARY = 30000;

/** 施設1レベルあたりの維持費（万円） */
const FACILITY_MAINTENANCE_PER_LEVEL = 5000;

/** スカウト派遣費基本額（万円） */
const BASE_SCOUT_EXPENSE = 10000;

/** スカウト施設レベルあたりの追加派遣費（万円） */
const SCOUT_EXPENSE_PER_LEVEL = 3000;

/** 優勝ボーナス収入（万円） */
const CHAMPION_BONUS = 50000;

/** Bクラスのペナルティ倍率（スポンサー減少） */
const B_CLASS_SPONSOR_PENALTY = 0.85;

/**
 * シーズン収入を計算する
 * チケット・放映権・グッズ・スポンサーの4項目で構成
 * @param team - 球団オブジェクト
 * @param rank - リーグ内順位（1-6）
 * @returns 各収入項目と合計
 */
export function calculateSeasonRevenue(
  team: Team,
  rank: number,
): { ticket: number; broadcast: number; merchandise: number; sponsor: number; total: number } {
  const rankMultiplier = RANK_MULTIPLIERS[rank] ?? 1.0;

  // チケット収入: 基本額 × 順位倍率 × 球場レベル補正
  const stadiumCapacity = FACILITY_EFFECTS.stadium[team.facilities.stadium] ?? 30000;
  const ticket = Math.round(
    (BASE_TICKET_REVENUE * rankMultiplier * stadiumCapacity) / 30000,
  );

  // 放映権料: チームごとの固定値（teams.tsのbroadcastRevenueと同等）
  const broadcast = team.finances.broadcastRevenue;

  // グッズ収入: 基本額 × 順位倍率
  let merchandise = Math.round(BASE_MERCHANDISE_REVENUE * rankMultiplier);
  // 優勝チームにはボーナス
  if (rank === 1) {
    merchandise += CHAMPION_BONUS;
  }

  // スポンサー収入: 基本額 × 順位倍率 × 資金力
  let sponsor = Math.round(BASE_SPONSOR_REVENUE * rankMultiplier * team.ai.budgetMode);
  // Bクラス（4-6位）はスポンサーが減る
  if (rank >= 4) {
    sponsor = Math.round(sponsor * B_CLASS_SPONSOR_PENALTY);
  }

  const total = ticket + broadcast + merchandise + sponsor;

  return { ticket, broadcast, merchandise, sponsor, total };
}

/**
 * シーズン支出を計算する
 * 年俸総額・スタッフ給与・施設維持費・スカウト派遣費で構成
 * @param team - 球団オブジェクト
 * @param allPlayers - 全選手データ
 * @returns 各支出項目と合計
 */
export function calculateSeasonExpenses(
  team: Team,
  allPlayers: Player[],
): { salary: number; staff: number; facility: number; scout: number; total: number } {
  // 選手年俸総額
  const teamPlayers = allPlayers.filter((p) => p.teamId === team.id);
  const salary = teamPlayers.reduce((sum, p) => sum + p.contract.salary, 0);

  // スタッフ給与
  const staff = BASE_STAFF_SALARY;

  // 施設維持費: 全施設のレベル合計 × 単価
  const totalFacilityLevel =
    team.facilities.training +
    team.facilities.bullpen +
    team.facilities.rehab +
    team.facilities.stadium +
    team.facilities.scoutBase +
    team.facilities.dormitory;
  const facility = totalFacilityLevel * FACILITY_MAINTENANCE_PER_LEVEL;

  // スカウト派遣費
  const scout = BASE_SCOUT_EXPENSE + team.facilities.scoutBase * SCOUT_EXPENSE_PER_LEVEL;

  const total = salary + staff + facility + scout;

  return { salary, staff, facility, scout, total };
}

/**
 * 財務処理を行い、球団の収支を更新する
 * @param team - 球団オブジェクト（直接変更される）
 * @param allPlayers - 全選手データ
 * @param rank - リーグ内順位（1-6）
 * @returns 収支結果
 */
export function processFinances(
  team: Team,
  allPlayers: Player[],
  rank: number,
): { profit: number; isDeficit: boolean } {
  const revenue = calculateSeasonRevenue(team, rank);
  const expenses = calculateSeasonExpenses(team, allPlayers);

  const profit = revenue.total - expenses.total;
  const isDeficit = profit < 0;

  // 財務情報を更新
  team.finances.ticketRevenue = revenue.ticket;
  team.finances.broadcastRevenue = revenue.broadcast;
  team.finances.merchandiseRevenue = revenue.merchandise;
  team.finances.sponsorRevenue = revenue.sponsor;
  team.finances.totalSalary = expenses.salary;
  team.finances.staffSalary = expenses.staff;
  team.finances.facilityMaintenance = expenses.facility;
  team.finances.scoutExpense = expenses.scout;

  // 資金残高を更新
  team.finances.balance += profit;

  // 赤字連続年数を更新
  if (isDeficit) {
    team.finances.consecutiveDeficitYears++;
  } else {
    team.finances.consecutiveDeficitYears = 0;
  }

  return { profit, isDeficit };
}
