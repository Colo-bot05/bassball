import type { Player, GrowthType } from '@/types/player';
import {
  GROWTH_CURVES,
  AWAKENING_TRIGGER_THRESHOLD,
  AWAKENING_FIRE_CHANCE,
  AWAKENING_RESET_VALUE,
  AWAKENING_TYPE_RATES,
  AWAKENING_DURATION,
  TWO_WAY_GROWTH_RATE,
} from '@/constants/balance';
import { randomInt, chance, randomWeighted, randomChoice } from '@/utils/random';

/** 打者能力のキー一覧 */
const BATTER_STAT_KEYS = ['meet', 'power', 'speed', 'fielding', 'arm', 'eye'] as const;

/** 投手能力のキー一覧 */
const PITCHER_STAT_KEYS = ['velocity', 'control', 'breaking', 'stamina'] as const;

/** キャンプ成長対象の最大年齢 */
const CAMP_MAX_AGE = 25;

/** キャンプ成長の基本値 */
const CAMP_GROWTH_MIN = 1;
const CAMP_GROWTH_MAX = 3;

/** 引退判定時の最低能力合計閾値 */
const RETIREMENT_STAT_THRESHOLD = 180;

/** 引退判定における確率補正（年齢が引退レンジ内の場合） */
const RETIREMENT_BASE_CHANCE = 0.30;

/** 引退レンジ超過時の追加確率（1年あたり） */
const RETIREMENT_EXTRA_CHANCE_PER_YEAR = 0.20;

/** レジェンド判定の通算年数閾値 */
const LEGEND_SEASONS_THRESHOLD = 15;

/**
 * 成長カーブから成長量を取得する
 * @param growthType - 成長タイプ
 * @param age - 選手の年齢
 * @returns 成長量（min〜maxのランダム値）。該当する年齢レンジがなければ0
 */
function getGrowthAmount(growthType: GrowthType, age: number): number {
  const curve = GROWTH_CURVES[growthType];
  for (const range of curve.growth) {
    if (age >= range.ageMin && age <= range.ageMax) {
      return randomInt(range.min, range.max);
    }
  }
  return 0;
}

/**
 * 能力値にポテンシャル上限を適用してクランプする
 * @param value - 現在の能力値
 * @param cap - ポテンシャル上限（未設定なら100）
 * @returns クランプ後の能力値
 */
function clampStat(value: number, cap: number | undefined): number {
  const max = cap ?? 100;
  return Math.max(1, Math.min(max, value));
}

/**
 * 打者能力に成長を適用する
 * @param player - 選手オブジェクト
 * @param amount - 成長量
 */
function applyBatterGrowth(player: Player, amount: number): void {
  if (amount === 0) return;
  // ランダムに能力を選んで成長させる
  const statKey = randomChoice(BATTER_STAT_KEYS);
  const newValue = player.batterStats[statKey] + amount;
  player.batterStats[statKey] = clampStat(
    newValue,
    player.potential[statKey] as number | undefined,
  );
}

/**
 * 投手能力に成長を適用する
 * @param player - 選手オブジェクト
 * @param amount - 成長量
 */
function applyPitcherGrowth(player: Player, amount: number): void {
  if (!player.pitcherStats || amount === 0) return;
  const statKey = randomChoice(PITCHER_STAT_KEYS);
  const newValue = player.pitcherStats[statKey] + amount;
  player.pitcherStats[statKey] = clampStat(
    newValue,
    player.potential[statKey] as number | undefined,
  );
}

/**
 * 年間成長を適用する（シーズン終了時に呼ばれる）
 * 成長タイプと年齢に応じた成長カーブに基づいて能力値を上昇させる
 * 二刀流選手は成長率がTWO_WAY_GROWTH_RATE倍になる
 * @param player - 選手オブジェクト（直接変更される）
 * @param facilityBonus - 練習施設ボーナス（0〜1の割合）
 * @param dormitoryBonus - 寮施設ボーナス（0〜1の割合）
 */
export function applyYearlyGrowth(
  player: Player,
  facilityBonus: number,
  dormitoryBonus: number,
): void {
  const baseAmount = getGrowthAmount(player.growthType, player.age);
  const totalBonus = 1 + facilityBonus + dormitoryBonus;
  let amount = Math.round(baseAmount * totalBonus);

  // 二刀流は成長率を減衰
  if (player.isTwoWay) {
    amount = Math.round(amount * TWO_WAY_GROWTH_RATE);
  }

  // 打者能力に成長適用
  applyBatterGrowth(player, amount);

  // 投手の場合は投手能力にも成長適用
  if (player.pitcherStats) {
    const pitcherAmount = player.isTwoWay
      ? Math.round(getGrowthAmount(player.growthType, player.age) * totalBonus * TWO_WAY_GROWTH_RATE)
      : Math.round(getGrowthAmount(player.growthType, player.age) * totalBonus);
    applyPitcherGrowth(player, pitcherAmount);
  }
}

/**
 * 春季キャンプの成長イベントを適用する（若手選手向け）
 * 26歳未満の選手にキャンプ成長を付与する
 * @param player - 選手オブジェクト（直接変更される）
 * @param facilityBonus - 練習施設ボーナス
 * @param dormitoryBonus - 寮施設ボーナス
 */
export function applyCampGrowth(
  player: Player,
  facilityBonus: number,
  dormitoryBonus: number,
): void {
  if (player.age >= CAMP_MAX_AGE + 1) {
    return;
  }

  const totalBonus = 1 + facilityBonus + dormitoryBonus;
  const campAmount = Math.round(randomInt(CAMP_GROWTH_MIN, CAMP_GROWTH_MAX) * totalBonus);

  applyBatterGrowth(player, campAmount);

  if (player.pitcherStats) {
    const pitcherCampAmount = Math.round(randomInt(CAMP_GROWTH_MIN, CAMP_GROWTH_MAX) * totalBonus);
    applyPitcherGrowth(player, pitcherCampAmount);
  }
}

/**
 * 年齢による衰退を適用する（シーズン終了時に呼ばれる）
 * 成長タイプごとに定義された衰退開始年齢以降、能力が低下する
 * @param player - 選手オブジェクト（直接変更される）
 */
export function applyDecline(player: Player): void {
  const curve = GROWTH_CURVES[player.growthType];
  if (player.age < curve.declineStart) {
    return;
  }

  const declineAmount = randomInt(curve.declineRange.min, curve.declineRange.max);

  // 打者能力の衰退
  const batterKey = randomChoice(BATTER_STAT_KEYS);
  player.batterStats[batterKey] = Math.max(1, player.batterStats[batterKey] - declineAmount);

  // 投手能力の衰退
  if (player.pitcherStats) {
    const pitcherKey = randomChoice(PITCHER_STAT_KEYS);
    player.pitcherStats[pitcherKey] = Math.max(1, player.pitcherStats[pitcherKey] - declineAmount);
  }
}

/**
 * 覚醒判定を行う
 * 覚醒ゲージが閾値に達した場合、一定確率で覚醒イベントが発生する
 * @param player - 選手オブジェクト（直接変更される）
 * @returns 覚醒結果（覚醒したか、覚醒タイプ）
 */
export function checkAwakening(player: Player): { awakened: boolean; type: string | null } {
  // 既に覚醒中なら判定しない
  if (player.awakening.isAwakened) {
    return { awakened: false, type: null };
  }

  // ゲージが閾値未満なら判定しない
  if (player.awakening.gauge < AWAKENING_TRIGGER_THRESHOLD) {
    return { awakened: false, type: null };
  }

  // 覚醒発動判定
  if (!chance(AWAKENING_FIRE_CHANCE)) {
    // 不発：ゲージをリセット値まで減らす
    player.awakening.gauge = AWAKENING_RESET_VALUE;
    return { awakened: false, type: null };
  }

  // 覚醒タイプを決定
  const type = randomWeighted(AWAKENING_TYPE_RATES as Record<string, number>);

  // 覚醒状態を設定
  player.awakening.isAwakened = true;
  player.awakening.type = type as 'short' | 'medium' | 'permanent';
  player.awakening.gauge = 0;

  // 覚醒の持続期間を設定
  if (type === 'short') {
    player.awakening.remainingYears = AWAKENING_DURATION.short;
  } else if (type === 'medium') {
    player.awakening.remainingYears = randomInt(
      AWAKENING_DURATION.medium.min,
      AWAKENING_DURATION.medium.max,
    );
  } else {
    // permanent
    player.awakening.remainingYears = Infinity;
  }

  return { awakened: true, type };
}

/**
 * 大器晩成タイプの一発覚醒を判定する
 * lateBloomタイプの選手が覚醒年齢範囲内にいる場合に判定
 * @param player - 選手オブジェクト（直接変更される）
 * @returns 覚醒したかどうか
 */
export function applyLateBloomAwakening(player: Player): boolean {
  if (player.growthType !== 'lateBloom') {
    return false;
  }

  // 既に覚醒中なら判定しない
  if (player.awakening.isAwakened) {
    return false;
  }

  const lateBloomCurve = GROWTH_CURVES.lateBloom;
  const ageRange = lateBloomCurve.awakeningAgeRange;

  // 覚醒年齢範囲外ならスキップ
  if (player.age < ageRange.min || player.age > ageRange.max) {
    return false;
  }

  // 覚醒判定
  if (!chance(lateBloomCurve.awakeningChance)) {
    return false;
  }

  // 覚醒成功：大幅な能力上昇を適用
  const boostAmount = randomInt(lateBloomCurve.awakeningBoost.min, lateBloomCurve.awakeningBoost.max);

  // 打者能力をランダムに上昇
  const batterKey = randomChoice(BATTER_STAT_KEYS);
  player.batterStats[batterKey] = clampStat(
    player.batterStats[batterKey] + boostAmount,
    player.potential[batterKey] as number | undefined,
  );

  // 投手の場合は投手能力も上昇
  if (player.pitcherStats) {
    const pitcherKey = randomChoice(PITCHER_STAT_KEYS);
    const pitcherBoost = randomInt(lateBloomCurve.awakeningBoost.min, lateBloomCurve.awakeningBoost.max);
    player.pitcherStats[pitcherKey] = clampStat(
      player.pitcherStats[pitcherKey] + pitcherBoost,
      player.potential[pitcherKey] as number | undefined,
    );
  }

  // 覚醒状態を設定
  player.awakening.isAwakened = true;
  player.awakening.type = 'medium';
  player.awakening.remainingYears = randomInt(
    lateBloomCurve.postAwakeningYears.min,
    lateBloomCurve.postAwakeningYears.max,
  );

  return true;
}

/**
 * 引退判定を行う
 * 年齢が引退レンジに入り、能力が低下している場合に引退となる
 * @param player - 選手オブジェクト
 * @returns 引退すべきかどうか
 */
export function checkRetirement(player: Player): boolean {
  const curve = GROWTH_CURVES[player.growthType];
  const retireRange = curve.retireRange;

  // 引退レンジ未満なら引退しない
  if (player.age < retireRange.min) {
    return false;
  }

  // 能力値の合計を計算
  const stats = player.batterStats;
  const totalStats = stats.meet + stats.power + stats.speed + stats.fielding + stats.arm + stats.eye;

  // 能力値が閾値以下なら引退確率上昇
  const isLowStats = totalStats < RETIREMENT_STAT_THRESHOLD;

  // 引退レンジ超過年数に応じた追加確率
  const yearsOverMin = player.age - retireRange.min;
  let retireChance = RETIREMENT_BASE_CHANCE + yearsOverMin * RETIREMENT_EXTRA_CHANCE_PER_YEAR;

  if (isLowStats) {
    retireChance += 0.20;
  }

  // 引退レンジ上限を超えていたら必ず引退
  if (player.age >= retireRange.max) {
    return true;
  }

  return chance(retireChance);
}

/**
 * 引退選手の転生データを作成する
 * 引退選手の特徴を引き継いだ新人候補データを生成する
 * @param player - 引退する選手オブジェクト
 * @returns 転生プールに追加するエントリ
 */
export function addToReincarnationPool(player: Player): {
  name: string;
  position: string;
  potentialCap: number;
  growthTypeTendency: Record<string, number>;
  abilityCandidates: Record<string, number>;
  isLegend: boolean;
} {
  const stats = player.batterStats;
  const totalStats = stats.meet + stats.power + stats.speed + stats.fielding + stats.arm + stats.eye;

  // ポテンシャル上限は通算能力に基づく
  const potentialCap = Math.min(100, Math.round(totalStats / 6) + 10);

  // 成長タイプの傾向：元選手の成長タイプに寄る
  const growthTypeTendency: Record<string, number> = {
    early: 0.15,
    normal: 0.30,
    late: 0.20,
    unstable: 0.15,
    lateBloom: 0.20,
  };
  // 元の成長タイプの確率を上昇
  growthTypeTendency[player.growthType] += 0.20;

  // 能力候補：元選手の能力値を基に、能力の得意分野を引き継ぐ
  const abilityCandidates: Record<string, number> = {};
  for (const key of BATTER_STAT_KEYS) {
    abilityCandidates[key] = stats[key];
  }
  if (player.pitcherStats) {
    for (const key of PITCHER_STAT_KEYS) {
      abilityCandidates[key] = player.pitcherStats[key];
    }
  }

  // レジェンド判定：通算年数と能力で判定
  const isLegend = player.isLegend || player.careerStats.seasons >= LEGEND_SEASONS_THRESHOLD;

  return {
    name: player.name,
    position: player.position,
    potentialCap,
    growthTypeTendency,
    abilityCandidates,
    isLegend,
  };
}
