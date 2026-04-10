/**
 * 全12球団の選手データを動的に生成する
 * 各チーム約65名、合計約780名
 * 仕様書 M-7 に基づくステータス範囲
 */
import type { CsvPlayerRow } from '@/data/csvImporter';

// ---------------------------------------------------------------------------
// 日本語名ジェネレーター
// ---------------------------------------------------------------------------
const SURNAMES = [
  '佐藤', '田中', '鈴木', '高橋', '渡辺', '伊藤', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '松本', '井上', '木村', '林', '斎藤', '清水', '山口', '松田',
  '阿部', '森', '池田', '橋本', '石川', '前田', '藤田', '小川', '岡田', '後藤',
  '村田', '長谷川', '近藤', '石井', '斉藤', '坂本', '遠藤', '青木', '藤井', '西村',
  '福田', '太田', '三浦', '藤原', '岡本', '松井', '中島', '金子', '原', '中野',
  '河野', '菅原', '上田', '野村', '大塚', '千葉', '久保', '安藤', '丸山', '北村',
  '宮崎', '工藤', '内田', '高木', '平野', '杉山', '今村', '大野', '武田', '菊池',
  '和田', '土屋', '西田', '永田', '島田', '望月', '堀', '柳', '奥村', '岩田',
  '片岡', '黒田', '柳田', '吉川', '秋山', '浅野', '関', '新井', '谷口', '大谷',
  '中田', '星野', '松尾', '横山', '宮本', '小野', '田村', '戸田', '古田', '荒木',
  '栗原', '牧', '有原', '今井', '大山', '佐野', '村上', '塩見', '梅野', '外崎',
  '源田', '甲斐', '柳町', '髙濱', '紅林', '万波', '細川', '野口', '笠原', '石橋',
];

const FIRST_NAMES = [
  '翔太', '大輝', '健太', '拓也', '直人', '翔平', '雄太', '和也', '大地', '悠真',
  '蓮', '颯太', '陽斗', '悠斗', '奏太', '隼人', '駿', '涼太', '一輝', '海斗',
  '遼太', '康平', '将太', '龍之介', '裕太', '剛', '誠', '大樹', '圭吾', '慎太郎',
  '亮太', '勇人', '光', '恵太', '正志', '達也', '智也', '優太', '宏斗', '浩人',
  '洸太', '大夢', '凌', '瑛太', '壮亮', '輝明', '宗隆', '正尚', '朗希', '由伸',
  '大弥', '克樹', '浩大', '秀悟', '勇気', '柊', '陸', '匠', '奏', '樹',
];

/**
 * シード不要の簡易名前ジェネレーター
 * 同一チーム内での重複を避けるためSetで管理
 */
function createNameGenerator() {
  const used = new Set<string>();

  return function generateName(): string {
    // 最大100回試行して重複を回避
    for (let attempt = 0; attempt < 100; attempt++) {
      const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const name = surname + firstName;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    // フォールバック: 番号付き
    const fallback = `選手${used.size + 1}`;
    used.add(fallback);
    return fallback;
  };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const TEAM_IDS = [
  'giants', 'tigers', 'carp', 'dragons', 'baystars', 'swallows',
  'hawks', 'buffaloes', 'marines', 'eagles', 'lions', 'fighters',
] as const;

type FieldPosition = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
type PitcherRoleType = 'starter' | 'reliever' | 'setup' | 'closer';

interface SlotDef {
  position: string;
  role?: PitcherRoleType;
  isDevelopment?: boolean;
  tier: 'star' | 'regular' | 'bench' | 'dev';
}

/** チームごとのスロット定義を組み立てる */
function buildTeamSlots(): SlotDef[] {
  const slots: SlotDef[] = [];

  // --- 1軍投手 15名 ---
  // 先発6
  for (let i = 0; i < 6; i++) {
    slots.push({ position: 'P', role: 'starter', tier: i < 2 ? 'star' : 'regular' });
  }
  // 中継ぎ6
  for (let i = 0; i < 6; i++) {
    slots.push({ position: 'P', role: 'reliever', tier: i < 1 ? 'star' : 'regular' });
  }
  // セットアップ2
  slots.push({ position: 'P', role: 'setup', tier: 'star' });
  slots.push({ position: 'P', role: 'setup', tier: 'regular' });
  // クローザー1
  slots.push({ position: 'P', role: 'closer', tier: 'star' });

  // --- 1軍野手 26名 ---
  // 捕手3
  for (let i = 0; i < 3; i++) {
    slots.push({ position: 'C', tier: i === 0 ? 'star' : 'bench' });
  }
  // 内野 各3 = 12
  const infieldPositions: FieldPosition[] = ['1B', '2B', '3B', 'SS'];
  for (const pos of infieldPositions) {
    for (let i = 0; i < 3; i++) {
      slots.push({ position: pos, tier: i === 0 ? 'star' : (i === 1 ? 'regular' : 'bench') });
    }
  }
  // 外野 各3 = 9
  const outfieldPositions: FieldPosition[] = ['LF', 'CF', 'RF'];
  for (const pos of outfieldPositions) {
    for (let i = 0; i < 3; i++) {
      slots.push({ position: pos, tier: i === 0 ? 'star' : (i === 1 ? 'regular' : 'bench') });
    }
  }
  // ユーティリティ/DH 2
  slots.push({ position: 'DH', tier: 'regular' });
  slots.push({ position: 'DH', tier: 'bench' });

  // --- 育成選手 24名 (投手12 + 野手12) ---
  const devPitcherRoles: PitcherRoleType[] = [
    'starter', 'starter', 'starter', 'starter',
    'reliever', 'reliever', 'reliever', 'reliever',
    'reliever', 'reliever', 'reliever', 'reliever',
  ];
  for (const role of devPitcherRoles) {
    slots.push({ position: 'P', role, isDevelopment: true, tier: 'dev' });
  }
  const devFieldPositions: string[] = [
    'C', 'C', '1B', '2B', '2B', '3B', 'SS', 'SS', 'LF', 'CF', 'RF', 'RF',
  ];
  for (const pos of devFieldPositions) {
    slots.push({ position: pos, isDevelopment: true, tier: 'dev' });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// 年齢生成
// ---------------------------------------------------------------------------
function generateAge(tier: SlotDef['tier']): number {
  switch (tier) {
    case 'star':
      return randInt(25, 34);
    case 'regular':
      return randInt(23, 31);
    case 'bench':
      return randInt(22, 35);
    case 'dev':
      return randInt(18, 22);
  }
}

// ---------------------------------------------------------------------------
// 投手ステータス生成
// ---------------------------------------------------------------------------
function generatePitcherRow(
  name: string,
  teamId: string,
  slot: SlotDef,
): CsvPlayerRow {
  const age = generateAge(slot.tier);
  const role = slot.role!;
  const isDev = slot.isDevelopment ?? false;

  // tierに応じた品質係数 (0-1, 高いほど良い)
  let quality: number;
  switch (slot.tier) {
    case 'star':  quality = randFloat(0.7, 1.0); break;
    case 'regular': quality = randFloat(0.35, 0.7); break;
    case 'bench': quality = randFloat(0.15, 0.45); break;
    case 'dev':   quality = randFloat(0.0, 0.3); break;
  }

  const isStarter = role === 'starter';
  const isCloser = role === 'closer';

  // ERA: star投手は低ERA、dev投手は高ERA
  const era = roundTo(5.50 - quality * 4.0, 2); // 1.50 ~ 5.50

  // 勝利数
  let wins: number;
  if (isStarter) {
    wins = Math.round(quality * 18); // 0-18
  } else {
    wins = Math.round(quality * 5); // 0-5
  }

  // セーブ
  let saves = 0;
  if (isCloser) {
    saves = Math.round(quality * 40); // 0-40
  }

  // 奪三振
  let strikeouts: number;
  if (isStarter) {
    strikeouts = Math.round(20 + quality * 200); // 20-220
  } else {
    strikeouts = Math.round(20 + quality * 80); // 20-100
  }

  // 与四球
  const walks = Math.round(10 + (1 - quality) * 70); // 10-80

  // イニング数
  let inningsPitched: number;
  if (isStarter) {
    inningsPitched = roundTo(30 + quality * 170, 1); // 30-200
  } else {
    inningsPitched = roundTo(20 + quality * 60, 1); // 20-80
  }

  if (isDev) {
    // 育成選手は実績が少ない
    inningsPitched = roundTo(inningsPitched * 0.3, 1);
    strikeouts = Math.round(strikeouts * 0.3);
  }

  // 利き手: 左腕は約30%
  const throwHand = Math.random() < 0.3 ? 'left' : 'right';
  const batHand = throwHand; // 投手は投げ手で打つことが多い

  // 年俸: 品質と年齢に基づく
  const baseSalary = isDev
    ? randInt(500, 2000)
    : Math.round(1000 + quality * 60000 + (age > 28 ? quality * 15000 : 0));
  const salary = Math.min(80000, Math.max(1000, baseSalary));

  // 外国人: チームに数名
  const isForeign = !isDev && Math.random() < 0.08;

  return {
    name,
    teamId,
    position: 'P',
    age,
    throwHand,
    batHand,
    salary,
    era,
    wins,
    saves,
    strikeouts,
    walks,
    inningsPitched,
    isForeign,
    role,
    isDevelopment: isDev,
  };
}

// ---------------------------------------------------------------------------
// 野手ステータス生成
// ---------------------------------------------------------------------------
function generateBatterRow(
  name: string,
  teamId: string,
  slot: SlotDef,
): CsvPlayerRow {
  const age = generateAge(slot.tier);
  const isDev = slot.isDevelopment ?? false;

  let quality: number;
  switch (slot.tier) {
    case 'star':  quality = randFloat(0.7, 1.0); break;
    case 'regular': quality = randFloat(0.35, 0.7); break;
    case 'bench': quality = randFloat(0.15, 0.45); break;
    case 'dev':   quality = randFloat(0.0, 0.3); break;
  }

  // 打率: .200 ~ .320
  const battingAvg = roundTo(0.200 + quality * 0.120, 3);

  // 本塁打: 0 ~ 45 (ポジションで補正)
  let hrMax = 45;
  if (slot.position === 'C' || slot.position === 'SS' || slot.position === '2B') {
    hrMax = 25; // 守備職人系は長打力控えめ
  }
  const homeRuns = Math.round(quality * hrMax);

  // 打点: 10 ~ 120
  const rbi = Math.round(10 + quality * 110);

  // 盗塁: 0 ~ 40 (足の速い選手)
  let sbMax = 40;
  if (slot.position === '1B' || slot.position === 'DH' || slot.position === 'C') {
    sbMax = 10;
  }
  const stolenBases = Math.round(quality * sbMax * randFloat(0.0, 1.0));

  // 出塁率: .280 ~ .430
  const obp = roundTo(Math.max(battingAvg + 0.030, 0.280 + quality * 0.150), 3);

  // OPS: .550 ~ 1.050
  const slugging = roundTo(battingAvg + 0.050 + quality * 0.350, 3);
  const ops = roundTo(Math.max(0.550, Math.min(1.050, obp + slugging)), 3);

  // 利き手
  const throwHand = slot.position === 'C' || slot.position === '1B'
    ? (Math.random() < 0.85 ? 'right' : 'left')
    : (Math.random() < 0.75 ? 'right' : 'left');

  let batHand: string;
  if (Math.random() < 0.15) {
    batHand = 'switch';
  } else if (throwHand === 'left') {
    batHand = 'left';
  } else {
    batHand = Math.random() < 0.7 ? 'right' : 'left';
  }

  // 年俸
  const baseSalary = isDev
    ? randInt(500, 2000)
    : Math.round(1000 + quality * 55000 + (age > 28 ? quality * 20000 : 0));
  const salary = Math.min(80000, Math.max(1000, baseSalary));

  const isForeign = !isDev && Math.random() < 0.08;

  if (isDev) {
    // 育成選手は成績を抑えめに
    return {
      name,
      teamId,
      position: slot.position,
      age,
      throwHand,
      batHand,
      salary,
      battingAvg: roundTo(battingAvg * 0.85, 3),
      homeRuns: Math.round(homeRuns * 0.3),
      rbi: Math.round(rbi * 0.3),
      stolenBases: Math.round(stolenBases * 0.3),
      obp: roundTo(obp * 0.88, 3),
      ops: roundTo(ops * 0.80, 3),
      isForeign,
      isDevelopment: true,
    };
  }

  return {
    name,
    teamId,
    position: slot.position,
    age,
    throwHand,
    batHand,
    salary,
    battingAvg,
    homeRuns,
    rbi,
    stolenBases,
    obp,
    ops,
    isForeign,
    isDevelopment: false,
  };
}

// ---------------------------------------------------------------------------
// メイン生成関数
// ---------------------------------------------------------------------------

/**
 * 全12球団の選手データを生成 (~780名)
 * CsvPlayerRow[] を返すので、csvRowToPlayer() で Player に変換可能
 */
export function generateAllPlayers(): CsvPlayerRow[] {
  const slots = buildTeamSlots();
  const allPlayers: CsvPlayerRow[] = [];
  const nameGen = createNameGenerator();

  for (const teamId of TEAM_IDS) {
    for (const slot of slots) {
      const name = nameGen();
      const isPitcher = slot.position === 'P';
      const row = isPitcher
        ? generatePitcherRow(name, teamId, slot)
        : generateBatterRow(name, teamId, slot);
      allPlayers.push(row);
    }
  }

  return allPlayers;
}
