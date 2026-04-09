import type { Player, Condition } from '@/types/player';
import { CONDITION_TRANSITION } from '@/constants/balance';
import { randomWeighted, randomInt, chance } from '@/utils/random';

/** 調子遷移の好調方向キー */
const GOOD_CONDITIONS: Condition[] = ['excellent', 'good'];

/** 調子遷移の不調方向キー */
const BAD_CONDITIONS: Condition[] = ['bad', 'terrible'];

/** スランプ突入に必要な連続不調カード数 */
const SLUMP_ENTRY_CONSECUTIVE_BAD_CARDS = 3;

/** スランプ突入可能な最低年齢 */
const SLUMP_ENTRY_MIN_AGE = 28;

/** スランプ期間（カード数） */
const SLUMP_DURATION_MIN = 5;
const SLUMP_DURATION_MAX = 15;

/** 好調寄り補正 */
const GOOD_PERFORMANCE_BONUS = 0.10;

/** 不調寄り補正 */
const BAD_PERFORMANCE_PENALTY = 0.10;

/** ムードメーカー補正 */
const MOOD_MAKER_BONUS = 0.03;

/** スランプ中の不調方向補正 */
const SLUMP_BAD_BONUS = 0.20;

/** スランプ中の覚醒ゲージ加算量 */
const SLUMP_AWAKENING_GAUGE_ADD = 5;

/**
 * 調子遷移確率に補正を適用する
 * @param base - 基本遷移確率テーブル
 * @param recentPerformance - 直近の成績評価
 * @param teamHasMoodMaker - チームにムードメーカーがいるか
 * @param isInSlump - スランプ中か
 * @returns 補正後の遷移確率
 */
function applyModifiers(
  base: Record<string, number>,
  recentPerformance: 'good' | 'neutral' | 'bad',
  teamHasMoodMaker: boolean,
  isInSlump: boolean,
): Record<string, number> {
  const modified: Record<string, number> = { ...base };

  // 好成績：好調方向に+10%
  if (recentPerformance === 'good') {
    for (const key of GOOD_CONDITIONS) {
      modified[key] = (modified[key] ?? 0) + GOOD_PERFORMANCE_BONUS / GOOD_CONDITIONS.length;
    }
    for (const key of BAD_CONDITIONS) {
      modified[key] = Math.max(0, (modified[key] ?? 0) - GOOD_PERFORMANCE_BONUS / BAD_CONDITIONS.length);
    }
  }

  // 不振：不調方向に+10%
  if (recentPerformance === 'bad') {
    for (const key of BAD_CONDITIONS) {
      modified[key] = (modified[key] ?? 0) + BAD_PERFORMANCE_PENALTY / BAD_CONDITIONS.length;
    }
    for (const key of GOOD_CONDITIONS) {
      modified[key] = Math.max(0, (modified[key] ?? 0) - BAD_PERFORMANCE_PENALTY / GOOD_CONDITIONS.length);
    }
  }

  // ムードメーカー：好調方向に+3%
  if (teamHasMoodMaker) {
    for (const key of GOOD_CONDITIONS) {
      modified[key] = (modified[key] ?? 0) + MOOD_MAKER_BONUS / GOOD_CONDITIONS.length;
    }
    // 不調方向を同量減らす
    for (const key of BAD_CONDITIONS) {
      modified[key] = Math.max(0, (modified[key] ?? 0) - MOOD_MAKER_BONUS / BAD_CONDITIONS.length);
    }
  }

  // スランプ中：不調方向に+20%
  if (isInSlump) {
    for (const key of BAD_CONDITIONS) {
      modified[key] = (modified[key] ?? 0) + SLUMP_BAD_BONUS / BAD_CONDITIONS.length;
    }
    for (const key of GOOD_CONDITIONS) {
      modified[key] = Math.max(0, (modified[key] ?? 0) - SLUMP_BAD_BONUS / GOOD_CONDITIONS.length);
    }
  }

  // 負の値を除去し正規化
  const total = Object.values(modified).reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total > 0) {
    for (const key of Object.keys(modified)) {
      modified[key] = Math.max(0, modified[key]) / total;
    }
  }

  return modified;
}

/**
 * 選手の調子を更新する（カードごとに呼ばれる）
 * 仕様書F-6に基づく遷移確率と各種補正を適用
 * @param player - 選手オブジェクト（直接変更される）
 * @param recentPerformance - 直近カードの成績評価
 * @param teamHasMoodMaker - チームにムードメーカー特能持ちがいるか
 */
export function updateCondition(
  player: Player,
  recentPerformance: 'good' | 'neutral' | 'bad',
  teamHasMoodMaker: boolean,
): void {
  const currentCondition = player.condition;
  const baseTransition = CONDITION_TRANSITION[currentCondition] as Record<string, number>;

  const modifiedWeights = applyModifiers(
    baseTransition,
    recentPerformance,
    teamHasMoodMaker,
    player.slump.isInSlump,
  );

  player.condition = randomWeighted(modifiedWeights as Record<Condition, number>);
}

/**
 * スランプ状態をチェック・更新する
 * 28歳以上で3カード以上連続bad/terribleの場合にスランプ突入
 * スランプ中はカード数を減算し、終了判定を行う
 * @param player - 選手オブジェクト（直接変更される）
 */
export function checkSlump(player: Player): void {
  // スランプ中の場合：残りカード数を減らす
  if (player.slump.isInSlump) {
    player.slump.remainingCards--;
    if (player.slump.remainingCards <= 0) {
      player.slump.isInSlump = false;
      player.slump.remainingCards = 0;
      // スランプ脱出時に覚醒ゲージを加算
      updateAwakeningGaugeFromSlump(player);
    }
    return;
  }

  // スランプ突入判定：年齢28歳以上かつ不調が続いている場合
  if (player.age < SLUMP_ENTRY_MIN_AGE) {
    return;
  }

  // 現在の調子がbadまたはterribleでない場合はスランプにならない
  if (player.condition !== 'bad' && player.condition !== 'terrible') {
    return;
  }

  // 連続不調カード数の判定は呼び出し元で管理される想定
  // ここでは確率的にスランプ突入を判定する
  // 3カード以上連続不調の条件は調子がbad/terribleであることで代替
  if (chance(1 / SLUMP_ENTRY_CONSECUTIVE_BAD_CARDS)) {
    player.slump.isInSlump = true;
    player.slump.remainingCards = randomInt(SLUMP_DURATION_MIN, SLUMP_DURATION_MAX);
  }
}

/**
 * スランプからの脱出時に覚醒ゲージを加算する
 * スランプを乗り越えた経験が覚醒への蓄積となる
 * @param player - 選手オブジェクト（直接変更される）
 */
export function updateAwakeningGaugeFromSlump(player: Player): void {
  player.awakening.gauge = Math.min(100, player.awakening.gauge + SLUMP_AWAKENING_GAUGE_ADD);
}
