import Dexie from 'dexie';
import type { GameState } from '@/types/game';

/** セーブデータ用のDB定義 */
class SaveDatabase extends Dexie {
  saves!: Dexie.Table<{ slot: number; data: GameState }, number>;

  constructor() {
    super('YakutsukuSaveDB');
    this.version(1).stores({
      saves: 'slot',
    });
  }
}

const db = new SaveDatabase();

/** セーブスロット数 */
export const SAVE_SLOTS = {
  AUTO: 0,
  MANUAL_1: 1,
  MANUAL_2: 2,
  MANUAL_3: 3,
} as const;

/** セーブデータを保存 */
export async function saveGame(slot: number, state: GameState): Promise<void> {
  const data = { ...state, savedAt: new Date().toISOString() };
  await db.saves.put({ slot, data });
}

/** オートセーブ（スロット0に自動保存） */
export async function autoSave(state: GameState): Promise<void> {
  await saveGame(SAVE_SLOTS.AUTO, state);
}

/** セーブデータをロード */
export async function loadGame(slot: number): Promise<GameState | null> {
  const record = await db.saves.get(slot);
  return record?.data ?? null;
}

/** セーブスロットの一覧を取得 */
export async function listSaveSlots(): Promise<{ slot: number; savedAt: string; summary: string }[]> {
  const records = await db.saves.toArray();
  return records.map((r) => ({
    slot: r.slot,
    savedAt: r.data.savedAt,
    summary: `${r.data.gmName} - ${r.data.currentDate.year}年 ${r.data.currentPhase}`,
  }));
}

/** セーブデータを削除 */
export async function deleteSave(slot: number): Promise<void> {
  await db.saves.delete(slot);
}

/** セーブデータをJSONファイルとしてエクスポート */
export function exportSaveToJson(state: GameState, slot: number): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `yakutsuku_save${slot}_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSONファイルからセーブデータをインポート */
export function importSaveFromJson(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as GameState;
        if (!data.version || !data.teams || !data.players) {
          reject(new Error('無効なセーブデータです'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('JSONの解析に失敗しました'));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}
