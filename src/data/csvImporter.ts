import type {
  Player,
  Position,
  ThrowHand,
  BatHand,
  GrowthType,
  PitcherRole,
  BatterStats,
  PitcherStats,
  BatterSeasonStats,
  PitcherSeasonStats,
  PitchType,
  PitchData,
} from '@/types/player';
import { randomInt, chance, randomChoice, generateId } from '@/utils/random';

/**
 * CSVの1行を表すデータ
 * 仕様書M-7に基づくフォーマット
 */
export interface CsvPlayerRow {
  name: string;
  teamId: string;
  position: string;
  age: number;
  throwHand: string;
  batHand: string;
  salary: number;
  // 打者成績
  battingAvg?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  obp?: number;
  ops?: number;
  // 投手成績
  era?: number;
  wins?: number;
  saves?: number;
  strikeouts?: number;
  walks?: number;
  inningsPitched?: number;
  // 追加
  isForeign?: boolean;
  role?: string;
  isDevelopment?: boolean;
}

const PITCH_TYPES: PitchType[] = [
  'curve', 'slider', 'cutter', 'fork', 'changeup',
  'shoot', 'sinker', 'twoSeam', 'splitter', 'knuckleCurve',
  'palm', 'knuckle',
];

/** CSVテキストをパースしてCsvPlayerRow配列に変換 */
export function parseCsv(csvText: string): CsvPlayerRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: CsvPlayerRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    rows.push({
      name: row['name'] || '',
      teamId: row['teamId'] || '',
      position: row['position'] || '',
      age: parseInt(row['age']) || 25,
      throwHand: row['throwHand'] || 'right',
      batHand: row['batHand'] || 'right',
      salary: parseInt(row['salary']) || 1000,
      battingAvg: parseFloat(row['battingAvg']) || undefined,
      homeRuns: parseInt(row['homeRuns']) || undefined,
      rbi: parseInt(row['rbi']) || undefined,
      stolenBases: parseInt(row['stolenBases']) || undefined,
      obp: parseFloat(row['obp']) || undefined,
      ops: parseFloat(row['ops']) || undefined,
      era: parseFloat(row['era']) || undefined,
      wins: parseInt(row['wins']) || undefined,
      saves: parseInt(row['saves']) || undefined,
      strikeouts: parseInt(row['strikeouts']) || undefined,
      walks: parseInt(row['walks']) || undefined,
      inningsPitched: parseFloat(row['inningsPitched']) || undefined,
      isForeign: row['isForeign'] === 'true',
      role: row['role'] || undefined,
    });
  }

  return rows;
}

/** ポジション文字列をPosition型に変換 */
function parsePosition(pos: string): Position {
  const map: Record<string, Position> = {
    '捕手': 'C', 'C': 'C', '捕': 'C',
    '一塁': '1B', '1B': '1B', '一': '1B',
    '二塁': '2B', '2B': '2B', '二': '2B',
    '三塁': '3B', '3B': '3B', '三': '3B',
    '遊撃': 'SS', 'SS': 'SS', '遊': 'SS',
    '左翼': 'LF', 'LF': 'LF', '左': 'LF',
    '中堅': 'CF', 'CF': 'CF', '中': 'CF',
    '右翼': 'RF', 'RF': 'RF', '右': 'RF',
    '投手': 'P', 'P': 'P', '投': 'P',
    'DH': 'DH',
    '外野': 'RF',
    '内野': '2B',
  };
  return map[pos] || 'RF';
}

/** 利き手変換 */
function parseThrowHand(hand: string): ThrowHand {
  return hand === '左' || hand === 'left' ? 'left' : 'right';
}

function parseBatHand(hand: string): BatHand {
  if (hand === '左' || hand === 'left') return 'left';
  if (hand === '両' || hand === 'switch') return 'switch';
  return 'right';
}

/** 成長タイプを年齢から推定（仕様書M-7） */
function estimateGrowthType(age: number): GrowthType {
  if (age <= 22) {
    return randomChoice(
      (['early', 'normal', 'late', 'unstable', 'lateBloom'] as const)
        .flatMap((t) => {
          const rates: Record<string, number> = {
            early: 30, normal: 30, late: 20, unstable: 10, lateBloom: 10,
          };
          return Array(rates[t]).fill(t);
        }),
    );
  }
  if (age <= 27) {
    return randomChoice(
      (['early', 'normal', 'late', 'unstable'] as const)
        .flatMap((t) => {
          const rates: Record<string, number> = {
            early: 10, normal: 40, late: 20, unstable: 10,
          };
          return Array(rates[t]).fill(t);
        }),
    );
  }
  if (age <= 32) {
    return randomChoice(
      (['normal', 'late', 'unstable'] as const)
        .flatMap((t) => {
          const rates: Record<string, number> = { normal: 50, late: 30, unstable: 20 };
          return Array(rates[t]).fill(t);
        }),
    );
  }
  return randomChoice(
    (['normal', 'late', 'unstable'] as const)
      .flatMap((t) => {
        const rates: Record<string, number> = { normal: 60, late: 30, unstable: 10 };
        return Array(rates[t]).fill(t);
      }),
  );
}

/** 打者成績から能力値を計算（仕様書M-7） */
function calculateBatterStats(row: CsvPlayerRow): BatterStats {
  const avg = row.battingAvg ?? 0.250;
  const hr = row.homeRuns ?? 10;
  const sb = row.stolenBases ?? 5;
  const obp = row.obp ?? 0.320;
  const pos = parsePosition(row.position);

  const meet = Math.min(100, Math.max(1, Math.round((avg - 0.180) * 350)));
  const power = Math.min(100, Math.max(1, Math.round(hr * 1.2 + 10)));
  const speed = Math.min(100, Math.max(1, Math.round(sb * 1.5 + 20)));
  const eye = Math.min(100, Math.max(1, Math.round((obp - 0.250) * 300)));

  const fieldingBase: Record<string, number> = {
    C: 65, SS: 65, '2B': 60, '3B': 55, CF: 55, LF: 50, RF: 50, '1B': 45, DH: 30, P: 30,
  };
  const fielding = Math.min(100, Math.max(1, (fieldingBase[pos] ?? 50) + randomInt(-5, 5)));

  const armBase: Record<string, number> = {
    C: 65, RF: 60, CF: 55, SS: 55, '3B': 55, '2B': 50, LF: 50, '1B': 45, DH: 30, P: 30,
  };
  const arm = Math.min(100, Math.max(1, (armBase[pos] ?? 50) + randomInt(-5, 5)));

  return { meet, power, speed, fielding, arm, eye };
}

/** 投手成績から能力値を計算（仕様書M-7） */
function calculatePitcherStats(row: CsvPlayerRow): PitcherStats {
  const k = row.strikeouts ?? 100;
  const ip = row.inningsPitched ?? 100;
  const bb = row.walks ?? 40;
  const isStarter = (row.role ?? 'starter') === 'starter' || (row.saves ?? 0) === 0;

  const kRate = ip > 0 ? k / ip : 1.0;
  const velocity = Math.min(100, Math.max(1, Math.round(kRate * 50 + 40)));
  const control = Math.min(100, Math.max(1, Math.round((1 - (ip > 0 ? bb / ip : 0.3)) * 110)));
  const breaking = Math.min(100, Math.max(1, 60 + randomInt(-15, 15)));
  const stamina = isStarter
    ? Math.min(100, Math.max(1, Math.round(ip * 0.5 + 30)))
    : Math.min(100, Math.max(1, randomInt(50, 65)));

  return { velocity, control, breaking, stamina };
}

/** 投手の変化球を生成 */
function generatePitches(): PitchData[] {
  const count = randomInt(1, 5);
  const available = [...PITCH_TYPES];
  const pitches: PitchData[] = [];

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = randomInt(0, available.length - 1);
    const type = available.splice(idx, 1)[0];
    pitches.push({ type, level: randomInt(1, 5) });
  }

  return pitches;
}

/** 特能を自動付与 */
function assignAbilities(row: CsvPlayerRow, isPitcher: boolean): string[] {
  const abilities: string[] = [];

  if (isPitcher) {
    if ((row.era ?? 9) <= 2.0 && chance(0.5)) abilities.push('antiPinch1');
  } else {
    if ((row.ops ?? 0) >= 0.9 && chance(0.5)) abilities.push('clutch1');
    if ((row.stolenBases ?? 0) >= 30 && chance(0.8)) abilities.push('stealing');
  }

  return abilities;
}

/** 投手の役割を判定 */
function determinePitcherRole(row: CsvPlayerRow): PitcherRole {
  if ((row.saves ?? 0) > 10) return 'closer';
  if (row.role === 'reliever' || row.role === 'setup') return row.role as PitcherRole;
  if ((row.inningsPitched ?? 0) < 50 && (row.wins ?? 0) < 5) return 'reliever';
  return 'starter';
}

/** 空の打撃成績 */
function emptyBatterSeasonStats(): BatterSeasonStats {
  return {
    games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    rbi: 0, runs: 0, stolenBases: 0, caughtStealing: 0, walks: 0,
    strikeouts: 0, sacrificeBunts: 0, sacrificeFlies: 0, hitByPitch: 0,
  };
}

/** 空の投手成績 */
function emptyPitcherSeasonStats(): PitcherSeasonStats {
  return {
    games: 0, gamesStarted: 0, wins: 0, losses: 0, saves: 0, holds: 0,
    inningsPitched: 0, hitsAllowed: 0, homeRunsAllowed: 0, strikeouts: 0,
    walks: 0, earnedRuns: 0,
  };
}

/** CSVの行データからPlayer型に変換 */
export function csvRowToPlayer(row: CsvPlayerRow): Player {
  const position = parsePosition(row.position);
  const isPitcher = position === 'P';
  const batterStats = calculateBatterStats(row);
  const pitcherStats = isPitcher ? calculatePitcherStats(row) : null;
  const pitches = isPitcher ? generatePitches() : [];
  const growthType = estimateGrowthType(row.age);
  const normalAbilities = assignAbilities(row, isPitcher);

  const potentialBonus = Math.max(0, Math.round((30 - row.age) * 1.5) + randomInt(0, 10));

  return {
    id: generateId(),
    name: row.name,
    age: row.age,
    teamId: row.teamId,
    position,
    subPositions: {},
    pitcherRole: isPitcher ? determinePitcherRole(row) : null,
    throwHand: parseThrowHand(row.throwHand),
    batHand: parseBatHand(row.batHand),
    batterStats,
    pitcherStats,
    pitches,
    growthType,
    potential: isPitcher
      ? {
          velocity: Math.min(100, (pitcherStats?.velocity ?? 50) + potentialBonus),
          control: Math.min(100, (pitcherStats?.control ?? 50) + potentialBonus),
          breaking: Math.min(100, (pitcherStats?.breaking ?? 50) + potentialBonus),
          stamina: Math.min(100, (pitcherStats?.stamina ?? 50) + potentialBonus),
        }
      : {
          meet: Math.min(100, batterStats.meet + potentialBonus),
          power: Math.min(100, batterStats.power + potentialBonus),
          speed: Math.min(100, batterStats.speed + potentialBonus),
          fielding: Math.min(100, batterStats.fielding + potentialBonus),
          arm: Math.min(100, batterStats.arm + potentialBonus),
          eye: Math.min(100, batterStats.eye + potentialBonus),
        },
    uniqueAbilities: [],
    normalAbilities,
    awakeningAbilities: [],
    condition: 'normal',
    awakening: { gauge: 0, isAwakened: false, type: null, remainingYears: 0 },
    slump: { isInSlump: false, remainingCards: 0 },
    injury: { isInjured: false, name: '', severity: 'minor', remainingCards: 0, hadTommyJohn: false },
    contract: { salary: row.salary, remainingYears: 0, promise: null, promiseKept: null },
    isFirstTeam: !(row.isDevelopment ?? false),
    isDevelopment: row.isDevelopment ?? false,
    isForeign: row.isForeign ?? false,
    isTwoWay: false,
    isLegend: false,
    yearsInFirstTeam: Math.max(0, row.age - 22),
    yearsAsPro: Math.max(1, row.age - 18),
    origin: row.age <= 22 ? 'highSchool' : row.age <= 25 ? 'college' : 'industrial',
    currentBatterStats: emptyBatterSeasonStats(),
    currentPitcherStats: emptyPitcherSeasonStats(),
    careerStats: {
      seasons: Math.max(1, row.age - 18),
      batterStats: emptyBatterSeasonStats(),
      pitcherStats: emptyPitcherSeasonStats(),
    },
    demotionCooldown: 0,
    farmConsecutiveYears: 0,
    isDisgruntled: false,
    isReturnedFromOverseas: false,
    reincarnationSource: null,
  };
}

/** CSV文字列から全選手を変換 */
export function importPlayersFromCsv(csvText: string): Player[] {
  const rows = parseCsv(csvText);
  return rows.map(csvRowToPlayer);
}
