import type { Player, InjurySeverity } from '@/types/player';
import {
  INJURY_BASE_RATE,
  INJURY_POSITION_MODIFIER,
  INJURY_AGE_MODIFIER,
  INJURY_SEVERITY_RATES,
  INJURY_DURATION_CARDS,
  TOMMY_JOHN_RATE,
  TOMMY_JOHN_SUCCESS_RATE,
  TOMMY_JOHN_LEGEND_SUCCESS_RATE,
  AWAKENING_GAUGE_RATES,
} from '@/constants/balance';
import { chance, randomWeighted, randomInt } from '@/utils/random';

/** 二軍での怪我率減衰（仕様書C-2） */
const FARM_INJURY_RATE_MODIFIER = 0.50;

/** 怪我名テーブル（重さ別） */
const INJURY_NAMES: Record<InjurySeverity, string[]> = {
  minor: [
    '打撲',
    '軽い肉離れ',
    'デッドボールによる痛み',
    '指の捻挫',
    '軽い腰痛',
  ],
  moderate: [
    '肉離れ',
    'ハムストリング損傷',
    '肩の炎症',
    '足首の捻挫',
    '背中の張り',
    '膝の炎症',
  ],
  severe: [
    '靭帯損傷',
    '肩関節唇損傷',
    '膝前十字靭帯損傷',
    '肘の靭帯損傷',
    '腰椎椎間板ヘルニア',
  ],
  careerThreatening: [
    'アキレス腱断裂',
    '肘の重度靭帯断裂',
    '肩腱板完全断裂',
    '脊椎損傷',
  ],
};

/**
 * ポジション・役割に応じた怪我率補正を取得する
 * @param player - 選手オブジェクト
 * @returns 怪我率の倍率
 */
function getPositionModifier(player: Player): number {
  // 投手は役割で判定
  if (player.pitcherRole) {
    const roleModifier = INJURY_POSITION_MODIFIER[player.pitcherRole as keyof typeof INJURY_POSITION_MODIFIER];
    return roleModifier ?? INJURY_POSITION_MODIFIER.default;
  }

  // 捕手は補正あり
  if (player.position === 'C') {
    return INJURY_POSITION_MODIFIER.C;
  }

  return INJURY_POSITION_MODIFIER.default;
}

/**
 * 年齢に応じた怪我率補正を取得する
 * @param age - 選手の年齢
 * @returns 怪我率の倍率
 */
function getAgeModifier(age: number): number {
  if (age >= 35) return INJURY_AGE_MODIFIER.over35;
  if (age >= 30) return INJURY_AGE_MODIFIER.over30;
  return INJURY_AGE_MODIFIER.under30;
}

/**
 * 怪我の名前をランダムに取得する
 * @param severity - 怪我の重さ
 * @returns 怪我の名前
 */
function getInjuryName(severity: InjurySeverity): string {
  const names = INJURY_NAMES[severity];
  return names[randomInt(0, names.length - 1)];
}

/**
 * 怪我発生判定を行う（カードごとに呼ばれる）
 * 基本確率にポジション・年齢・二軍補正を掛けて判定する
 * @param player - 選手オブジェクト
 * @param isFarm - 二軍所属か（二軍は怪我率が低い）
 * @returns 怪我の発生結果
 */
export function checkInjury(
  player: Player,
  isFarm: boolean,
): { injured: boolean; name: string; severity: InjurySeverity; durationCards: number } {
  // 既に怪我中なら新たな怪我は発生しない
  if (player.injury.isInjured) {
    return { injured: false, name: '', severity: 'minor', durationCards: 0 };
  }

  // 怪我率を計算
  let injuryRate = INJURY_BASE_RATE;
  injuryRate *= getPositionModifier(player);
  injuryRate *= getAgeModifier(player.age);

  if (isFarm) {
    injuryRate *= FARM_INJURY_RATE_MODIFIER;
  }

  // 怪我発生判定
  if (!chance(injuryRate)) {
    return { injured: false, name: '', severity: 'minor', durationCards: 0 };
  }

  // 怪我の重さを決定
  const severity = randomWeighted(INJURY_SEVERITY_RATES as Record<InjurySeverity, number>);

  // 離脱期間を決定
  const durationRange = INJURY_DURATION_CARDS[severity];
  const durationCards = randomInt(durationRange.min, durationRange.max);

  // 怪我の名前を取得
  const name = getInjuryName(severity);

  // 選手の怪我状態を更新
  player.injury.isInjured = true;
  player.injury.name = name;
  player.injury.severity = severity;
  player.injury.remainingCards = durationCards;

  return { injured: true, name, severity, durationCards };
}

/**
 * トミージョン手術の判定を行う
 * 投手が重度の怪我をした場合にトミージョン手術が必要かを判定する
 * 手術成功時は球速が変動し、失敗時は大幅低下する
 * @param player - 選手オブジェクト（直接変更される）
 * @returns 手術が必要か、成功したか、球速変動量
 */
export function checkTommyJohn(player: Player): {
  needed: boolean;
  success: boolean;
  velocityChange: number;
} {
  // 投手でない場合は不要
  if (!player.pitcherStats) {
    return { needed: false, success: false, velocityChange: 0 };
  }

  // 重度以上の怪我でない場合は不要
  if (player.injury.severity !== 'severe' && player.injury.severity !== 'careerThreatening') {
    return { needed: false, success: false, velocityChange: 0 };
  }

  // 既にトミージョン手術済みの場合
  if (player.injury.hadTommyJohn) {
    return { needed: false, success: false, velocityChange: 0 };
  }

  // トミージョン手術が必要かどうかの判定
  if (!chance(TOMMY_JOHN_RATE)) {
    return { needed: false, success: false, velocityChange: 0 };
  }

  // 手術実施
  player.injury.hadTommyJohn = true;

  // 成功率はレジェンドかどうかで異なる
  const successRate = player.isLegend
    ? TOMMY_JOHN_LEGEND_SUCCESS_RATE
    : TOMMY_JOHN_SUCCESS_RATE;

  const success = chance(successRate);

  let velocityChange: number;
  if (success) {
    // 成功：球速微増〜微減（-2〜+3）
    velocityChange = randomInt(-2, 3);
  } else {
    // 失敗：球速大幅低下（-5〜-15）
    velocityChange = randomInt(-15, -5);
  }

  // 球速を反映
  player.pitcherStats.velocity = Math.max(1, player.pitcherStats.velocity + velocityChange);

  return { needed: true, success, velocityChange };
}

/**
 * 怪我の回復処理を行う（カードごとに呼ばれる）
 * 残りカード数を減らし、0になったら怪我を完治させる
 * @param player - 選手オブジェクト（直接変更される）
 */
export function healInjury(player: Player): void {
  if (!player.injury.isInjured) {
    return;
  }

  player.injury.remainingCards--;

  if (player.injury.remainingCards <= 0) {
    player.injury.isInjured = false;
    player.injury.name = '';
    player.injury.severity = 'minor';
    player.injury.remainingCards = 0;
  }
}

/**
 * 怪我中に覚醒ゲージを加算する（カードごとに呼ばれる）
 * 怪我の重さに応じてゲージが蓄積される
 * @param player - 選手オブジェクト（直接変更される）
 */
export function updateAwakeningGaugeFromInjury(player: Player): void {
  if (!player.injury.isInjured) {
    return;
  }

  let gaugeAdd: number;
  if (player.injury.severity === 'severe' || player.injury.severity === 'careerThreatening') {
    gaugeAdd = AWAKENING_GAUGE_RATES.severeInjury;
  } else if (player.injury.severity === 'minor') {
    gaugeAdd = AWAKENING_GAUGE_RATES.minorInjury;
  } else {
    // moderate
    gaugeAdd = AWAKENING_GAUGE_RATES.minorInjury;
  }

  player.awakening.gauge = Math.min(100, player.awakening.gauge + gaugeAdd);
}
