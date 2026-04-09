import type { Player } from '@/types/player';
import type { Team } from '@/types/team';
import {
  FA_DOMESTIC_YEARS,
  FA_DOMESTIC_YEARS_COLLEGE,
  FA_OVERSEAS_YEARS,
} from '@/constants/balance';
import { chance, randomFloat } from '@/utils/random';

/**
 * FA資格をチェックする
 * 国内FA: 一軍登録8年（大卒・社会人は7年）
 * 海外FA: 一軍登録9年
 * @param player - 選手オブジェクト
 * @returns 国内FA・海外FA資格の有無
 */
export function checkFAEligibility(player: Player): { domestic: boolean; overseas: boolean } {
  const isCollegeOrIndustrial = player.origin === 'college' || player.origin === 'industrial';
  const domesticThreshold = isCollegeOrIndustrial ? FA_DOMESTIC_YEARS_COLLEGE : FA_DOMESTIC_YEARS;

  return {
    domestic: player.yearsInFirstTeam >= domesticThreshold,
    overseas: player.yearsInFirstTeam >= FA_OVERSEAS_YEARS,
  };
}

/**
 * AIがFA宣言するかどうかを判断する
 * 不満がある、年俸が低い、チームが弱いなどの要因で宣言確率が上がる
 * @param player - 選手オブジェクト
 * @param team - 所属球団オブジェクト
 * @returns FA宣言するかどうか
 */
export function decideFADeclaration(player: Player, team: Team): boolean {
  let declarationChance = 0.15; // 基本宣言確率15%

  // 不満状態なら宣言確率大幅UP
  if (player.isDisgruntled) {
    declarationChance += 0.40;
  }

  // 約束が守られなかった場合
  if (player.contract.promiseKept === false) {
    declarationChance += 0.30;
  }

  // チームが再建モードの場合、ベテランは出たがる
  if (team.ai.mode === 'rebuilding' && player.age >= 28) {
    declarationChance += 0.15;
  }

  // 年俸が安いと感じる場合（能力に対して年俸が低い）
  const totalStats = player.batterStats.meet + player.batterStats.power +
    player.batterStats.speed + player.batterStats.fielding;
  const expectedSalary = totalStats * 15; // 大まかな期待年俸（万円）
  if (player.contract.salary < expectedSalary * 0.7) {
    declarationChance += 0.20;
  }

  // 若い選手はFAしにくい
  if (player.age < 28) {
    declarationChance -= 0.10;
  }

  // レジェンド選手は移籍しにくい
  if (player.isLegend) {
    declarationChance -= 0.10;
  }

  return chance(Math.max(0, Math.min(1, declarationChance)));
}

/** 入札チーム情報 */
interface BiddingTeamInfo {
  teamId: string;
  offerSalary: number;
  teamRank: number;
}

/** 現所属チーム情報 */
interface CurrentTeamInfo {
  teamId: string;
  offerSalary: number;
  teamRank: number;
  promiseKept: boolean;
  isDisgruntled: boolean;
}

/**
 * FA交渉を行い、獲得先を決定する
 * 重み付き: 年俸40% + チーム順位30% + 約束20% + 地元10%
 * @param player - 選手オブジェクト
 * @param biddingTeams - 入札球団の情報配列
 * @param currentTeam - 現所属球団の情報
 * @returns 獲得先の球団ID
 */
export function negotiateFA(
  _player: Player,
  biddingTeams: BiddingTeamInfo[],
  currentTeam: CurrentTeamInfo,
): string {
  if (biddingTeams.length === 0) {
    return currentTeam.teamId;
  }

  // 全候補チームを統合（現所属含む）
  const allTeams = [
    ...biddingTeams.map((t) => ({ ...t, isCurrent: false })),
    { ...currentTeam, isCurrent: true },
  ];

  // 最大値を取得して正規化に使用
  const maxSalary = Math.max(...allTeams.map((t) => t.offerSalary));
  const maxRank = 6; // 最下位

  const scores = allTeams.map((team) => {
    // 年俸スコア (40%): 高いほど良い
    const salaryScore = maxSalary > 0 ? (team.offerSalary / maxSalary) * 0.4 : 0;

    // チーム順位スコア (30%): 順位が高い（数値が小さい）ほど良い
    const rankScore = ((maxRank - team.teamRank + 1) / maxRank) * 0.3;

    // 約束スコア (20%): 現所属で約束が守られた/入札チームは中立
    let promiseScore = 0.1; // デフォルト中立
    if (team.isCurrent) {
      promiseScore = currentTeam.promiseKept ? 0.2 : 0;
      if (currentTeam.isDisgruntled) {
        promiseScore = 0;
      }
    }

    // 地元/現所属ボーナス (10%)
    const homeScore = team.isCurrent ? 0.1 : 0;

    const totalScore = salaryScore + rankScore + promiseScore + homeScore;

    // ランダムなブレを加える（±10%）
    const noise = randomFloat(-0.05, 0.05);

    return {
      teamId: team.teamId,
      score: Math.max(0, totalScore + noise),
    };
  });

  // スコアが最も高いチームを選択
  scores.sort((a, b) => b.score - a.score);
  return scores[0].teamId;
}
