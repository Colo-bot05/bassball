import seedrandom from 'seedrandom';

/** シード付き乱数ジェネレータ */
let rng: seedrandom.PRNG;

/** 乱数シードを初期化 */
export function initRandom(seed: number | string): void {
  rng = seedrandom(String(seed));
}

/** 現在のRNGを取得（テスト用） */
export function getRng(): seedrandom.PRNG {
  return rng;
}

/** 0以上1未満のランダムな数を返す */
export function random(): number {
  return rng();
}

/** min以上max以下の整数を返す */
export function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** min以上max未満の浮動小数点数を返す */
export function randomFloat(min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** 配列からランダムに1つ選ぶ */
export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 確率に基づいてランダムに選ぶ（重み付き選択） */
export function randomWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + (w as number), 0);
  let r = rng() * total;

  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }

  return entries[entries.length - 1][0];
}

/** 確率判定（0-1の確率でtrue/falseを返す） */
export function chance(probability: number): boolean {
  return rng() < probability;
}

/** 配列をシャッフルする（Fisher-Yates） */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** ユニークIDを生成 */
export function generateId(): string {
  return `${Date.now()}-${Math.floor(rng() * 1000000)
    .toString(36)
    .padStart(4, '0')}`;
}
