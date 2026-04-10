/**
 * 全12球団の実在NPB選手データ（2025シーズン / 2024成績ベース）
 * 各チーム約40名の1軍選手 + 約25名の育成選手（自動生成）
 * 合計約780名
 */
import type { CsvPlayerRow } from '@/data/csvImporter';

// ---------------------------------------------------------------------------
// 日本語名ジェネレーター（育成選手用）
// ---------------------------------------------------------------------------
const SURNAMES = [
  '佐藤', '田中', '鈴木', '高橋', '渡辺', '伊藤', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '松本', '井上', '木村', '林', '斎藤', '清水', '山口', '松田',
  '阿部', '森', '池田', '橋本', '石川', '前田', '藤田', '小川', '岡田', '後藤',
  '村田', '長谷川', '近藤', '石井', '斉藤', '坂本', '遠藤', '青木', '藤井', '西村',
  '福田', '太田', '三浦', '藤原', '岡本', '松井', '中島', '金子', '原', '中野',
  '河野', '菅原', '上田', '野村', '大塚', '千葉', '久保', '安藤', '丸山', '北村',
  '宮崎', '工藤', '内田', '高木', '平野', '杉山', '今村', '大野', '武田', '菊池',
  '和田', '土屋', '西田', '永田', '島田', '望月', '堀', '奥村', '岩田', '片岡',
  '黒田', '吉川', '秋山', '浅野', '関', '新井', '谷口', '大谷', '星野', '松尾',
  '横山', '宮本', '小野', '田村', '戸田', '古田', '荒木', '柳町', '髙濱', '野口',
  '笠原', '石橋', '竹内', '白石', '川口', '市川', '浜田', '相沢', '柴田', '須藤',
  '堀内', '富田', '杉本', '平田', '川崎', '本田', '沢田', '中山', '早川', '飯田',
];

const FIRST_NAMES = [
  '翔太', '大輝', '健太', '拓也', '直人', '翔平', '雄太', '和也', '大地', '悠真',
  '蓮', '颯太', '陽斗', '悠斗', '奏太', '隼人', '駿', '涼太', '一輝', '海斗',
  '遼太', '康平', '将太', '龍之介', '裕太', '剛', '誠', '大樹', '圭吾', '慎太郎',
  '亮太', '勇人', '光', '恵太', '正志', '達也', '智也', '優太', '宏斗', '浩人',
  '洸太', '大夢', '凌', '瑛太', '壮亮', '輝明', '宗隆', '正尚', '朗希', '由伸',
  '大弥', '克樹', '浩大', '秀悟', '勇気', '柊', '陸', '匠', '奏', '樹',
];

function createNameGenerator() {
  const used = new Set<string>();

  return function generateName(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const name = surname + firstName;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    const fallback = `育成選手${used.size + 1}`;
    used.add(fallback);
    return fallback;
  };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// 育成選手の自動生成
// ---------------------------------------------------------------------------
type PitcherRoleType = 'starter' | 'reliever' | 'setup' | 'closer';

function generateDevPitcher(
  name: string,
  teamId: string,
  role: PitcherRoleType,
): CsvPlayerRow {
  const age = randInt(18, 22);
  const throwHand = Math.random() < 0.3 ? 'left' : 'right';
  return {
    name,
    teamId,
    position: 'P',
    age,
    throwHand,
    batHand: throwHand,
    salary: randInt(300, 1500),
    era: roundTo(3.5 + Math.random() * 4.0, 2),
    wins: randInt(0, 3),
    saves: role === 'closer' ? randInt(0, 5) : 0,
    strikeouts: randInt(10, 50),
    walks: randInt(10, 40),
    inningsPitched: roundTo(randInt(10, 60), 1),
    isForeign: false,
    role,
    isDevelopment: true,
  };
}

function generateDevBatter(
  name: string,
  teamId: string,
  position: string,
): CsvPlayerRow {
  const age = randInt(18, 22);
  const throwHand = Math.random() < 0.3 ? 'left' : 'right';
  const batHand = Math.random() < 0.15 ? 'switch' : (Math.random() < 0.4 ? 'left' : 'right');
  const avg = roundTo(0.150 + Math.random() * 0.100, 3);
  const obp = roundTo(avg + 0.030 + Math.random() * 0.050, 3);
  return {
    name,
    teamId,
    position,
    age,
    throwHand,
    batHand,
    salary: randInt(300, 1500),
    battingAvg: avg,
    homeRuns: randInt(0, 5),
    rbi: randInt(0, 15),
    stolenBases: randInt(0, 5),
    obp,
    ops: roundTo(obp + avg + 0.050 + Math.random() * 0.100, 3),
    isForeign: false,
    isDevelopment: true,
  };
}

function generateDevPlayers(teamId: string, nameGen: () => string): CsvPlayerRow[] {
  const devPlayers: CsvPlayerRow[] = [];

  // 育成投手 13名
  const devPitcherRoles: PitcherRoleType[] = [
    'starter', 'starter', 'starter', 'starter',
    'reliever', 'reliever', 'reliever', 'reliever',
    'reliever', 'reliever', 'reliever', 'reliever', 'reliever',
  ];
  for (const role of devPitcherRoles) {
    devPlayers.push(generateDevPitcher(nameGen(), teamId, role));
  }

  // 育成野手 12名
  const devPositions = ['C', 'C', '1B', '2B', '2B', '3B', 'SS', 'SS', 'LF', 'CF', 'RF', 'RF'];
  for (const pos of devPositions) {
    devPlayers.push(generateDevBatter(nameGen(), teamId, pos));
  }

  return devPlayers;
}

// ---------------------------------------------------------------------------
// ヘルパー: 打者/投手データ作成
// ---------------------------------------------------------------------------
function batter(
  name: string, teamId: string, position: string, age: number,
  throwHand: string, batHand: string, salary: number,
  battingAvg: number, homeRuns: number, rbi: number,
  stolenBases: number, obp: number, ops: number,
  isForeign?: boolean,
): CsvPlayerRow {
  return {
    name, teamId, position, age, throwHand, batHand, salary,
    battingAvg, homeRuns, rbi, stolenBases, obp, ops,
    isForeign: isForeign ?? false, isDevelopment: false,
  };
}

function pitcher(
  name: string, teamId: string, age: number,
  throwHand: string, batHand: string, salary: number,
  role: string, era: number, wins: number, saves: number,
  strikeouts: number, walks: number, inningsPitched: number,
  isForeign?: boolean,
): CsvPlayerRow {
  return {
    name, teamId, position: 'P', age, throwHand, batHand, salary,
    era, wins, saves, strikeouts, walks, inningsPitched,
    isForeign: isForeign ?? false, role, isDevelopment: false,
  };
}

// ---------------------------------------------------------------------------
// 全12球団の実在選手データ
// ---------------------------------------------------------------------------

function giantsPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('戸郷翔征', 'giants', 24, 'right', 'right', 18000, 'starter', 2.72, 12, 0, 154, 42, 178.0),
    pitcher('菅野智之', 'giants', 35, 'right', 'right', 60000, 'starter', 2.95, 10, 0, 128, 32, 155.0),
    pitcher('グリフィン', 'giants', 30, 'right', 'right', 12000, 'starter', 3.15, 9, 0, 120, 35, 148.0, true),
    pitcher('ヘルナンデス', 'giants', 28, 'left', 'left', 10000, 'starter', 3.45, 7, 0, 105, 38, 135.0, true),
    pitcher('山﨑伊織', 'giants', 26, 'right', 'right', 5000, 'starter', 3.28, 8, 0, 112, 30, 142.0),
    pitcher('赤星優志', 'giants', 25, 'right', 'right', 2500, 'starter', 3.85, 5, 0, 78, 35, 110.0),
    pitcher('横川凱', 'giants', 24, 'left', 'left', 2000, 'starter', 4.10, 4, 0, 65, 28, 95.0),
    pitcher('大勢', 'giants', 26, 'right', 'right', 10000, 'closer', 1.85, 2, 37, 68, 18, 55.0),
    pitcher('中川皓太', 'giants', 30, 'left', 'left', 8000, 'setup', 2.45, 3, 2, 58, 20, 62.0),
    pitcher('高梨雄平', 'giants', 33, 'left', 'left', 6000, 'setup', 2.78, 2, 1, 48, 15, 55.0),
    pitcher('バルドナード', 'giants', 27, 'right', 'right', 5000, 'reliever', 2.90, 3, 0, 52, 18, 50.0, true),
    pitcher('船迫大雅', 'giants', 25, 'right', 'right', 2000, 'reliever', 3.20, 2, 0, 45, 16, 48.0),
    pitcher('鈴木康平', 'giants', 28, 'right', 'right', 3000, 'reliever', 3.55, 2, 0, 40, 20, 45.0),
    pitcher('今村信貴', 'giants', 31, 'left', 'left', 4000, 'reliever', 3.80, 1, 0, 35, 18, 42.0),
    pitcher('堀田賢慎', 'giants', 24, 'right', 'right', 1500, 'reliever', 4.20, 1, 0, 30, 15, 38.0),
    pitcher('田中千晴', 'giants', 25, 'right', 'right', 1500, 'reliever', 3.95, 1, 0, 32, 14, 40.0),
    // --- 野手 ---
    batter('坂本勇人', 'giants', 'SS', 37, 'right', 'right', 55000, 0.268, 12, 52, 2, 0.342, 0.748),
    batter('岡本和真', 'giants', '3B', 28, 'right', 'right', 50000, 0.280, 30, 95, 1, 0.373, 0.880),
    batter('丸佳浩', 'giants', 'CF', 36, 'right', 'left', 40000, 0.265, 15, 55, 3, 0.365, 0.785),
    batter('門脇誠', 'giants', 'SS', 24, 'right', 'left', 3500, 0.250, 6, 35, 12, 0.315, 0.680),
    batter('秋広優人', 'giants', 'LF', 22, 'right', 'left', 2000, 0.248, 8, 30, 5, 0.310, 0.690),
    batter('吉川尚輝', 'giants', '2B', 29, 'right', 'left', 12000, 0.272, 5, 38, 15, 0.338, 0.720),
    batter('中田翔', 'giants', '1B', 35, 'right', 'right', 25000, 0.252, 18, 65, 0, 0.320, 0.760),
    batter('長野久義', 'giants', 'RF', 40, 'right', 'right', 8000, 0.245, 5, 22, 1, 0.305, 0.665),
    batter('大城卓三', 'giants', 'C', 31, 'right', 'left', 9000, 0.270, 10, 45, 1, 0.340, 0.750),
    batter('岸田行倫', 'giants', 'C', 28, 'right', 'right', 3000, 0.225, 3, 18, 0, 0.290, 0.600),
    batter('小林誠司', 'giants', 'C', 35, 'right', 'right', 5000, 0.210, 1, 10, 0, 0.270, 0.530),
    batter('ウォーカー', 'giants', 'RF', 33, 'right', 'left', 15000, 0.275, 20, 68, 2, 0.355, 0.830, true),
    batter('浅野翔吾', 'giants', 'CF', 21, 'right', 'left', 1500, 0.240, 5, 20, 8, 0.305, 0.650),
    batter('萩尾匡也', 'giants', 'RF', 25, 'right', 'right', 1800, 0.235, 7, 25, 3, 0.295, 0.660),
    batter('中山礼都', 'giants', 'SS', 23, 'right', 'left', 1500, 0.230, 3, 15, 6, 0.290, 0.620),
    batter('松原聖弥', 'giants', 'LF', 29, 'right', 'left', 2500, 0.255, 4, 22, 8, 0.310, 0.670),
    batter('増田陸', 'giants', '2B', 24, 'right', 'right', 1500, 0.238, 4, 18, 3, 0.295, 0.640),
    batter('オコエ瑠偉', 'giants', 'CF', 27, 'right', 'right', 2000, 0.245, 3, 15, 10, 0.300, 0.650),
    batter('泉口友汰', 'giants', '3B', 23, 'right', 'right', 1000, 0.228, 2, 12, 2, 0.285, 0.600),
    batter('湯浅大', 'giants', '1B', 26, 'right', 'left', 1200, 0.240, 6, 22, 1, 0.300, 0.670),
    batter('立岡宗一郎', 'giants', 'LF', 34, 'right', 'left', 3000, 0.250, 2, 15, 5, 0.305, 0.640),
    batter('北村拓己', 'giants', '3B', 29, 'right', 'right', 2000, 0.232, 5, 20, 1, 0.290, 0.630),
    batter('梶谷隆幸', 'giants', 'DH', 36, 'right', 'left', 10000, 0.242, 8, 28, 3, 0.315, 0.700),
    batter('若林晃弘', 'giants', '2B', 31, 'right', 'switch', 3000, 0.238, 4, 18, 5, 0.300, 0.640),
  ];
}

function tigersPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('才木浩人', 'tigers', 26, 'right', 'right', 8000, 'starter', 2.40, 12, 0, 168, 45, 180.0),
    pitcher('村上頌樹', 'tigers', 26, 'right', 'right', 8000, 'starter', 2.65, 10, 0, 135, 28, 170.0),
    pitcher('ビーズリー', 'tigers', 28, 'right', 'right', 10000, 'starter', 3.20, 8, 0, 110, 32, 145.0, true),
    pitcher('大竹耕太郎', 'tigers', 29, 'left', 'left', 5000, 'starter', 3.45, 7, 0, 95, 30, 140.0),
    pitcher('伊藤将司', 'tigers', 28, 'left', 'left', 5000, 'starter', 3.60, 6, 0, 88, 28, 130.0),
    pitcher('西勇輝', 'tigers', 34, 'right', 'right', 20000, 'starter', 3.75, 5, 0, 80, 25, 120.0),
    pitcher('青柳晃洋', 'tigers', 31, 'right', 'right', 10000, 'starter', 3.90, 4, 0, 75, 35, 105.0),
    pitcher('岩崎優', 'tigers', 33, 'left', 'left', 12000, 'closer', 2.10, 2, 30, 55, 14, 52.0),
    pitcher('石井大智', 'tigers', 27, 'right', 'right', 3500, 'setup', 2.55, 3, 5, 55, 16, 55.0),
    pitcher('桐敷拓馬', 'tigers', 26, 'left', 'left', 3000, 'setup', 2.80, 3, 3, 50, 18, 52.0),
    pitcher('加治屋蓮', 'tigers', 33, 'right', 'right', 5000, 'reliever', 3.15, 2, 0, 42, 20, 48.0),
    pitcher('島本浩也', 'tigers', 31, 'left', 'left', 3500, 'reliever', 3.30, 2, 0, 38, 15, 45.0),
    pitcher('浜地真澄', 'tigers', 28, 'right', 'right', 3000, 'reliever', 3.50, 1, 0, 35, 12, 42.0),
    pitcher('及川雅貴', 'tigers', 24, 'left', 'left', 1500, 'reliever', 3.85, 1, 0, 40, 22, 40.0),
    pitcher('ゲラ', 'tigers', 30, 'right', 'right', 8000, 'reliever', 2.30, 4, 8, 65, 15, 58.0, true),
    pitcher('岡留英貴', 'tigers', 25, 'right', 'right', 1200, 'reliever', 4.10, 1, 0, 28, 14, 35.0),
    // --- 野手 ---
    batter('佐藤輝明', 'tigers', '3B', 26, 'right', 'left', 10000, 0.262, 24, 70, 3, 0.330, 0.800),
    batter('近本光司', 'tigers', 'CF', 30, 'left', 'left', 18000, 0.285, 5, 42, 30, 0.345, 0.740),
    batter('大山悠輔', 'tigers', '1B', 30, 'right', 'right', 20000, 0.278, 22, 80, 2, 0.365, 0.840),
    batter('中野拓夢', 'tigers', 'SS', 28, 'right', 'left', 10000, 0.275, 3, 35, 20, 0.330, 0.700),
    batter('森下翔太', 'tigers', 'RF', 24, 'right', 'right', 4000, 0.270, 18, 60, 5, 0.335, 0.790),
    batter('梅野隆太郎', 'tigers', 'C', 33, 'right', 'right', 12000, 0.240, 6, 30, 2, 0.305, 0.650),
    batter('木浪聖也', 'tigers', 'SS', 30, 'right', 'left', 5000, 0.265, 2, 28, 5, 0.310, 0.660),
    batter('島田海吏', 'tigers', 'LF', 28, 'right', 'left', 3500, 0.258, 3, 22, 18, 0.315, 0.670),
    batter('ノイジー', 'tigers', 'LF', 30, 'right', 'right', 15000, 0.260, 15, 55, 2, 0.310, 0.740, true),
    batter('坂本誠志郎', 'tigers', 'C', 31, 'right', 'right', 6000, 0.232, 3, 18, 0, 0.300, 0.610),
    batter('原口文仁', 'tigers', 'C', 33, 'right', 'right', 4000, 0.245, 5, 22, 0, 0.310, 0.670),
    batter('渡邉諒', 'tigers', '3B', 29, 'right', 'right', 3000, 0.248, 4, 20, 2, 0.300, 0.650),
    batter('小幡竜平', 'tigers', 'SS', 24, 'right', 'left', 2000, 0.235, 1, 12, 8, 0.290, 0.600),
    batter('前川右京', 'tigers', 'LF', 22, 'right', 'left', 1500, 0.255, 8, 28, 3, 0.310, 0.700),
    batter('糸原健斗', 'tigers', '2B', 32, 'right', 'left', 5000, 0.260, 2, 20, 2, 0.330, 0.670),
    batter('植田海', 'tigers', '2B', 29, 'right', 'right', 2500, 0.225, 1, 12, 12, 0.285, 0.580),
    batter('板山祐太郎', 'tigers', 'RF', 29, 'right', 'left', 2000, 0.242, 3, 15, 3, 0.295, 0.630),
    batter('小野寺暖', 'tigers', 'RF', 26, 'right', 'right', 1500, 0.238, 6, 20, 2, 0.295, 0.660),
    batter('ミエセス', 'tigers', 'DH', 28, 'right', 'right', 5000, 0.240, 12, 38, 0, 0.295, 0.720, true),
    batter('豊田寛', 'tigers', 'CF', 26, 'right', 'right', 1200, 0.230, 2, 10, 5, 0.285, 0.600),
    batter('井上広大', 'tigers', 'RF', 23, 'right', 'right', 1200, 0.228, 5, 18, 1, 0.285, 0.630),
    batter('熊谷敬宥', 'tigers', '2B', 29, 'right', 'right', 2500, 0.230, 1, 10, 8, 0.290, 0.590),
    batter('長坂拳弥', 'tigers', 'DH', 30, 'right', 'right', 2000, 0.218, 3, 12, 0, 0.275, 0.570),
    batter('遠藤成', 'tigers', '1B', 23, 'right', 'left', 1000, 0.225, 3, 14, 1, 0.280, 0.600),
  ];
}

function carpPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('床田寛樹', 'carp', 30, 'left', 'left', 10000, 'starter', 2.78, 10, 0, 130, 35, 168.0),
    pitcher('九里亜蓮', 'carp', 33, 'right', 'right', 12000, 'starter', 3.10, 8, 0, 115, 38, 155.0),
    pitcher('大瀬良大地', 'carp', 33, 'right', 'right', 18000, 'starter', 3.40, 7, 0, 100, 30, 140.0),
    pitcher('森下暢仁', 'carp', 27, 'right', 'right', 8000, 'starter', 3.25, 8, 0, 125, 32, 150.0),
    pitcher('アドゥワ誠', 'carp', 26, 'right', 'right', 3000, 'starter', 3.65, 5, 0, 78, 28, 118.0),
    pitcher('玉村昇悟', 'carp', 24, 'left', 'left', 2000, 'starter', 3.95, 4, 0, 70, 30, 105.0),
    pitcher('遠藤淳志', 'carp', 28, 'right', 'right', 2500, 'starter', 4.15, 3, 0, 62, 25, 95.0),
    pitcher('栗林良吏', 'carp', 29, 'right', 'right', 12000, 'closer', 1.75, 2, 35, 72, 15, 52.0),
    pitcher('矢崎拓也', 'carp', 31, 'right', 'right', 6000, 'setup', 2.50, 3, 5, 55, 18, 58.0),
    pitcher('島内颯太郎', 'carp', 28, 'right', 'right', 3500, 'setup', 2.85, 2, 3, 48, 16, 50.0),
    pitcher('ターリー', 'carp', 30, 'left', 'left', 5000, 'reliever', 3.10, 2, 0, 42, 18, 45.0, true),
    pitcher('塹江敦哉', 'carp', 28, 'left', 'left', 2500, 'reliever', 3.40, 1, 0, 38, 15, 42.0),
    pitcher('森浦大輔', 'carp', 26, 'left', 'left', 2500, 'reliever', 3.55, 2, 0, 40, 20, 44.0),
    pitcher('黒原拓未', 'carp', 25, 'left', 'left', 1500, 'reliever', 3.80, 1, 0, 35, 18, 38.0),
    pitcher('コルニエル', 'carp', 28, 'right', 'right', 5000, 'reliever', 3.20, 3, 0, 50, 15, 48.0, true),
    pitcher('益田武尚', 'carp', 27, 'right', 'right', 1500, 'reliever', 4.00, 1, 0, 30, 12, 35.0),
    // --- 野手 ---
    batter('秋山翔吾', 'carp', 'RF', 36, 'right', 'left', 20000, 0.275, 8, 45, 5, 0.350, 0.770),
    batter('菊池涼介', 'carp', '2B', 35, 'right', 'right', 22000, 0.255, 5, 35, 8, 0.310, 0.670),
    batter('小園海斗', 'carp', 'SS', 24, 'right', 'left', 5000, 0.280, 10, 50, 10, 0.335, 0.760),
    batter('堂林翔太', 'carp', '3B', 33, 'right', 'right', 5000, 0.255, 10, 40, 2, 0.315, 0.720),
    batter('末包昇大', 'carp', 'LF', 28, 'right', 'right', 3500, 0.260, 14, 48, 3, 0.325, 0.760),
    batter('坂倉将吾', 'carp', 'C', 27, 'right', 'left', 8000, 0.278, 8, 42, 2, 0.345, 0.770),
    batter('マクブルーム', 'carp', '1B', 31, 'right', 'left', 12000, 0.268, 22, 72, 1, 0.340, 0.820, true),
    batter('田中広輔', 'carp', 'SS', 35, 'right', 'right', 5000, 0.235, 3, 20, 5, 0.305, 0.620),
    batter('野間峻祥', 'carp', 'CF', 31, 'left', 'left', 4000, 0.268, 3, 25, 12, 0.325, 0.690),
    batter('上本崇司', 'carp', '2B', 33, 'right', 'switch', 3000, 0.248, 2, 15, 5, 0.310, 0.640),
    batter('會澤翼', 'carp', 'C', 36, 'right', 'right', 8000, 0.238, 5, 25, 0, 0.300, 0.640),
    batter('石原貴規', 'carp', 'C', 27, 'right', 'right', 1500, 0.220, 2, 10, 0, 0.280, 0.570),
    batter('松山竜平', 'carp', 'DH', 39, 'right', 'left', 6000, 0.250, 6, 28, 0, 0.315, 0.690),
    batter('デビッドソン', 'carp', '3B', 32, 'right', 'right', 5000, 0.248, 12, 42, 1, 0.310, 0.730, true),
    batter('田村俊介', 'carp', 'LF', 21, 'left', 'left', 1000, 0.245, 4, 15, 5, 0.300, 0.650),
    batter('宇草孔基', 'carp', 'CF', 26, 'right', 'left', 1500, 0.238, 3, 12, 10, 0.295, 0.630),
    batter('矢野雅哉', 'carp', 'SS', 26, 'right', 'right', 1500, 0.225, 1, 10, 8, 0.280, 0.580),
    batter('中村奨成', 'carp', 'RF', 25, 'right', 'right', 1500, 0.235, 3, 14, 3, 0.290, 0.630),
    batter('韮澤雄也', 'carp', '3B', 24, 'right', 'left', 1200, 0.230, 2, 12, 2, 0.285, 0.600),
    batter('中村健人', 'carp', 'RF', 27, 'right', 'right', 1500, 0.232, 5, 18, 2, 0.290, 0.640),
    batter('羽月隆太郎', 'carp', '2B', 24, 'right', 'left', 1200, 0.240, 1, 10, 10, 0.295, 0.610),
    batter('二俣翔一', 'carp', '1B', 22, 'right', 'right', 800, 0.225, 3, 12, 1, 0.280, 0.600),
    batter('シャイナー', 'carp', 'LF', 29, 'right', 'left', 8000, 0.258, 18, 58, 1, 0.330, 0.800, true),
    batter('久保修', 'carp', 'DH', 25, 'right', 'right', 1000, 0.228, 2, 10, 1, 0.280, 0.590),
  ];
}

function dragonsPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('高橋宏斗', 'dragons', 22, 'right', 'right', 6000, 'starter', 2.55, 11, 0, 160, 40, 175.0),
    pitcher('柳裕也', 'dragons', 30, 'right', 'right', 15000, 'starter', 3.15, 8, 0, 120, 35, 155.0),
    pitcher('涌井秀章', 'dragons', 39, 'right', 'right', 15000, 'starter', 3.50, 6, 0, 90, 28, 130.0),
    pitcher('小笠原慎之介', 'dragons', 27, 'left', 'left', 8000, 'starter', 3.35, 7, 0, 110, 35, 145.0),
    pitcher('メヒア', 'dragons', 28, 'right', 'right', 8000, 'starter', 3.60, 6, 0, 95, 30, 128.0, true),
    pitcher('梅津晃大', 'dragons', 28, 'right', 'right', 3000, 'starter', 3.85, 4, 0, 75, 28, 110.0),
    pitcher('仲地礼亜', 'dragons', 25, 'right', 'right', 1500, 'starter', 4.10, 3, 0, 65, 25, 95.0),
    pitcher('松山晋也', 'dragons', 28, 'right', 'right', 5000, 'closer', 2.00, 2, 28, 60, 16, 50.0),
    pitcher('ライデル・マルティネス', 'dragons', 28, 'right', 'right', 20000, 'setup', 1.50, 3, 15, 72, 10, 55.0, true),
    pitcher('清水達也', 'dragons', 27, 'right', 'right', 3000, 'setup', 2.70, 2, 5, 50, 18, 52.0),
    pitcher('藤嶋健人', 'dragons', 28, 'left', 'left', 3500, 'reliever', 3.20, 2, 0, 42, 16, 45.0),
    pitcher('祖父江大輔', 'dragons', 37, 'right', 'right', 8000, 'reliever', 3.40, 1, 0, 35, 12, 42.0),
    pitcher('福谷浩司', 'dragons', 33, 'right', 'right', 5000, 'reliever', 3.55, 1, 0, 30, 14, 40.0),
    pitcher('齋藤綱記', 'dragons', 28, 'left', 'left', 2000, 'reliever', 3.70, 1, 0, 35, 16, 38.0),
    pitcher('橋本侑樹', 'dragons', 27, 'left', 'left', 1800, 'reliever', 3.90, 1, 0, 32, 15, 36.0),
    pitcher('松葉貴大', 'dragons', 34, 'left', 'left', 3000, 'reliever', 4.05, 1, 0, 28, 12, 35.0),
    // --- 野手 ---
    batter('岡林勇希', 'dragons', 'CF', 23, 'left', 'left', 4500, 0.282, 4, 35, 22, 0.330, 0.720),
    batter('細川成也', 'dragons', 'RF', 25, 'right', 'right', 5000, 0.268, 22, 65, 3, 0.335, 0.820),
    batter('石川昂弥', 'dragons', '3B', 23, 'right', 'right', 3000, 0.260, 15, 50, 2, 0.325, 0.770),
    batter('村松開人', 'dragons', 'SS', 24, 'right', 'left', 2500, 0.265, 3, 28, 10, 0.320, 0.680),
    batter('木下拓哉', 'dragons', 'C', 33, 'right', 'right', 8000, 0.248, 6, 32, 1, 0.310, 0.670),
    batter('カリステ', 'dragons', 'SS', 28, 'right', 'right', 5000, 0.255, 10, 42, 5, 0.305, 0.720, true),
    batter('ディカーソン', 'dragons', 'LF', 35, 'right', 'left', 8000, 0.258, 15, 52, 1, 0.325, 0.770, true),
    batter('ビシエド', 'dragons', '1B', 36, 'right', 'right', 30000, 0.252, 12, 48, 0, 0.310, 0.720, true),
    batter('福永裕基', 'dragons', '2B', 28, 'right', 'right', 2500, 0.250, 5, 25, 3, 0.305, 0.665),
    batter('龍空', 'dragons', 'SS', 22, 'right', 'left', 1500, 0.230, 2, 15, 8, 0.290, 0.600),
    batter('宇佐見真吾', 'dragons', 'C', 31, 'right', 'left', 3000, 0.235, 4, 20, 0, 0.295, 0.630),
    batter('加藤匠馬', 'dragons', 'C', 31, 'right', 'right', 2000, 0.215, 2, 12, 1, 0.275, 0.560),
    batter('大島洋平', 'dragons', 'CF', 39, 'left', 'left', 15000, 0.258, 2, 22, 8, 0.320, 0.670),
    batter('高橋周平', 'dragons', '3B', 31, 'right', 'left', 10000, 0.245, 6, 28, 1, 0.305, 0.660),
    batter('鵜飼航丞', 'dragons', 'RF', 25, 'right', 'right', 1200, 0.228, 8, 25, 1, 0.285, 0.650),
    batter('田中幹也', 'dragons', '2B', 26, 'right', 'right', 1500, 0.240, 1, 10, 12, 0.295, 0.610),
    batter('山本泰寛', 'dragons', '2B', 30, 'right', 'right', 2500, 0.235, 2, 15, 3, 0.295, 0.610),
    batter('後藤駿太', 'dragons', 'LF', 28, 'left', 'left', 1500, 0.238, 3, 14, 5, 0.295, 0.630),
    batter('アキーノ', 'dragons', 'RF', 30, 'right', 'right', 5000, 0.235, 15, 45, 1, 0.290, 0.720, true),
    batter('石橋康太', 'dragons', 'DH', 24, 'right', 'right', 1200, 0.225, 4, 16, 0, 0.280, 0.600),
    batter('溝脇隼人', 'dragons', '1B', 29, 'right', 'right', 1500, 0.228, 3, 14, 1, 0.285, 0.600),
    batter('ブライト健太', 'dragons', 'LF', 25, 'right', 'right', 1200, 0.230, 5, 18, 5, 0.285, 0.630),
    batter('濱将乃介', 'dragons', 'CF', 23, 'right', 'right', 800, 0.222, 1, 8, 6, 0.275, 0.570),
    batter('板山祐太郎', 'dragons', 'DH', 29, 'right', 'left', 1500, 0.232, 3, 14, 1, 0.290, 0.610),
  ];
}

function baystarsPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('東克樹', 'baystars', 28, 'left', 'left', 10000, 'starter', 2.45, 13, 0, 155, 38, 175.0),
    pitcher('濱口遥大', 'baystars', 30, 'left', 'left', 8000, 'starter', 3.30, 7, 0, 100, 42, 135.0),
    pitcher('大貫晋一', 'baystars', 30, 'right', 'right', 6000, 'starter', 3.45, 7, 0, 105, 30, 140.0),
    pitcher('石田裕太郎', 'baystars', 23, 'right', 'right', 1500, 'starter', 3.70, 5, 0, 80, 28, 115.0),
    pitcher('ケイ', 'baystars', 27, 'right', 'right', 8000, 'starter', 3.55, 6, 0, 110, 35, 130.0, true),
    pitcher('平良拳太郎', 'baystars', 29, 'right', 'right', 4000, 'starter', 3.80, 4, 0, 75, 25, 108.0),
    pitcher('ジャクソン', 'baystars', 31, 'right', 'right', 15000, 'closer', 1.80, 3, 38, 75, 15, 55.0, true),
    pitcher('山崎康晃', 'baystars', 32, 'right', 'right', 20000, 'setup', 2.35, 3, 8, 60, 14, 58.0),
    pitcher('伊勢大夢', 'baystars', 27, 'right', 'right', 5000, 'setup', 2.65, 3, 5, 55, 18, 52.0),
    pitcher('森原康平', 'baystars', 31, 'right', 'right', 4000, 'reliever', 2.80, 2, 3, 48, 15, 50.0),
    pitcher('ウェンデルケン', 'baystars', 31, 'right', 'right', 6000, 'reliever', 2.90, 3, 2, 55, 16, 52.0, true),
    pitcher('徳山壮磨', 'baystars', 25, 'right', 'right', 1500, 'reliever', 3.60, 1, 0, 38, 18, 42.0),
    pitcher('入江大生', 'baystars', 26, 'right', 'right', 2000, 'reliever', 3.45, 2, 0, 42, 20, 45.0),
    pitcher('坂本裕哉', 'baystars', 27, 'left', 'left', 2500, 'reliever', 3.75, 1, 0, 35, 15, 40.0),
    pitcher('中川虎大', 'baystars', 25, 'right', 'right', 1200, 'reliever', 4.00, 1, 0, 30, 14, 35.0),
    pitcher('宮國椋丞', 'baystars', 31, 'right', 'right', 2000, 'reliever', 3.85, 1, 0, 28, 12, 38.0),
    // --- 野手 ---
    batter('牧秀悟', 'baystars', '2B', 26, 'right', 'right', 15000, 0.290, 28, 88, 3, 0.370, 0.890),
    batter('宮崎敏郎', 'baystars', '3B', 36, 'right', 'right', 22000, 0.285, 12, 55, 1, 0.365, 0.810),
    batter('佐野恵太', 'baystars', 'LF', 30, 'right', 'left', 12000, 0.278, 15, 60, 2, 0.345, 0.800),
    batter('筒香嘉智', 'baystars', 'DH', 33, 'right', 'left', 30000, 0.265, 22, 70, 1, 0.360, 0.850),
    batter('関根大気', 'baystars', 'CF', 29, 'right', 'left', 5000, 0.272, 5, 32, 18, 0.340, 0.730),
    batter('オースティン', 'baystars', 'RF', 33, 'right', 'right', 25000, 0.280, 25, 75, 2, 0.375, 0.900, true),
    batter('林琢真', 'baystars', 'SS', 25, 'right', 'left', 2500, 0.258, 3, 22, 15, 0.315, 0.670),
    batter('伊藤光', 'baystars', 'C', 36, 'right', 'right', 8000, 0.240, 5, 28, 0, 0.315, 0.660),
    batter('山本祐大', 'baystars', 'C', 27, 'right', 'right', 3500, 0.250, 4, 22, 1, 0.310, 0.660),
    batter('戸柱恭孝', 'baystars', 'C', 34, 'right', 'right', 5000, 0.228, 3, 18, 0, 0.295, 0.610),
    batter('京田陽太', 'baystars', 'SS', 30, 'right', 'left', 5000, 0.245, 2, 18, 8, 0.300, 0.630),
    batter('柴田竜拓', 'baystars', '2B', 32, 'right', 'left', 3500, 0.235, 1, 12, 5, 0.300, 0.610),
    batter('蝦名達夫', 'baystars', 'RF', 26, 'right', 'right', 2000, 0.255, 8, 30, 5, 0.310, 0.700),
    batter('楠本泰史', 'baystars', 'LF', 28, 'right', 'left', 2500, 0.260, 5, 22, 2, 0.320, 0.700),
    batter('梶原昂希', 'baystars', 'CF', 25, 'right', 'left', 1500, 0.245, 3, 15, 12, 0.300, 0.650),
    batter('知野直人', 'baystars', '3B', 27, 'right', 'right', 1500, 0.230, 4, 16, 3, 0.285, 0.620),
    batter('大和', 'baystars', 'SS', 38, 'right', 'switch', 5000, 0.232, 1, 12, 3, 0.290, 0.590),
    batter('度会隆輝', 'baystars', 'LF', 22, 'right', 'left', 1500, 0.252, 8, 30, 5, 0.315, 0.710),
    batter('石上泰輝', 'baystars', 'SS', 23, 'right', 'right', 1000, 0.225, 1, 8, 5, 0.280, 0.580),
    batter('西浦直亨', 'baystars', '1B', 32, 'right', 'right', 3000, 0.235, 6, 22, 1, 0.295, 0.650),
    batter('ソト', 'baystars', '1B', 33, 'right', 'right', 15000, 0.255, 18, 58, 0, 0.320, 0.780, true),
    batter('勝又温史', 'baystars', 'DH', 24, 'right', 'right', 1200, 0.228, 4, 14, 2, 0.280, 0.610),
    batter('神里和毅', 'baystars', 'CF', 30, 'right', 'left', 2500, 0.242, 3, 15, 10, 0.300, 0.640),
    batter('桑原将志', 'baystars', 'RF', 31, 'right', 'left', 5000, 0.248, 5, 25, 8, 0.305, 0.670),
  ];
}

function swallowsPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('奥川恭伸', 'swallows', 23, 'right', 'right', 5000, 'starter', 3.10, 7, 0, 110, 30, 130.0),
    pitcher('小川泰弘', 'swallows', 34, 'right', 'right', 15000, 'starter', 3.45, 7, 0, 100, 32, 140.0),
    pitcher('高橋奎二', 'swallows', 28, 'left', 'left', 6000, 'starter', 3.55, 6, 0, 95, 35, 128.0),
    pitcher('サイスニード', 'swallows', 32, 'right', 'right', 10000, 'starter', 3.30, 8, 0, 115, 28, 150.0, true),
    pitcher('吉村貢司郎', 'swallows', 27, 'right', 'right', 2500, 'starter', 3.70, 5, 0, 85, 30, 118.0),
    pitcher('ピーターズ', 'swallows', 30, 'left', 'left', 8000, 'starter', 3.60, 5, 0, 90, 32, 125.0, true),
    pitcher('山野太一', 'swallows', 25, 'left', 'left', 1500, 'starter', 4.20, 3, 0, 60, 28, 95.0),
    pitcher('田口麗斗', 'swallows', 29, 'left', 'left', 8000, 'closer', 2.15, 2, 32, 62, 16, 55.0),
    pitcher('清水昇', 'swallows', 28, 'right', 'right', 5000, 'setup', 2.55, 3, 5, 55, 18, 55.0),
    pitcher('木澤尚文', 'swallows', 27, 'right', 'right', 3000, 'setup', 2.80, 2, 3, 48, 20, 50.0),
    pitcher('星知弥', 'swallows', 29, 'right', 'right', 2500, 'reliever', 3.30, 2, 0, 40, 15, 45.0),
    pitcher('大西広樹', 'swallows', 27, 'right', 'right', 2000, 'reliever', 3.55, 1, 0, 35, 16, 42.0),
    pitcher('今野龍太', 'swallows', 28, 'right', 'right', 2000, 'reliever', 3.70, 1, 0, 32, 14, 38.0),
    pitcher('石山泰稚', 'swallows', 36, 'right', 'right', 5000, 'reliever', 3.85, 1, 0, 28, 12, 35.0),
    pitcher('長谷川宙輝', 'swallows', 27, 'left', 'left', 1500, 'reliever', 4.00, 1, 0, 30, 18, 36.0),
    pitcher('嘉弥真新也', 'swallows', 33, 'left', 'left', 2000, 'reliever', 3.60, 1, 0, 25, 10, 32.0),
    // --- 野手 ---
    batter('村上宗隆', 'swallows', '3B', 26, 'right', 'left', 60000, 0.270, 35, 95, 5, 0.380, 0.920),
    batter('山田哲人', 'swallows', '2B', 33, 'right', 'right', 50000, 0.258, 15, 50, 10, 0.350, 0.780),
    batter('塩見泰隆', 'swallows', 'CF', 30, 'right', 'right', 10000, 0.272, 12, 45, 18, 0.345, 0.780),
    batter('長岡秀樹', 'swallows', 'SS', 24, 'right', 'right', 4000, 0.265, 5, 35, 12, 0.310, 0.690),
    batter('中村悠平', 'swallows', 'C', 34, 'right', 'right', 15000, 0.245, 5, 28, 2, 0.320, 0.670),
    batter('サンタナ', 'swallows', 'LF', 30, 'right', 'right', 12000, 0.268, 20, 65, 2, 0.340, 0.820, true),
    batter('オスナ', 'swallows', '1B', 30, 'right', 'right', 12000, 0.272, 18, 62, 1, 0.335, 0.800, true),
    batter('濱田太貴', 'swallows', 'RF', 24, 'right', 'right', 2000, 0.248, 10, 35, 3, 0.305, 0.710),
    batter('丸山和郁', 'swallows', 'CF', 25, 'left', 'left', 1800, 0.252, 3, 18, 15, 0.310, 0.660),
    batter('内山壮真', 'swallows', 'C', 22, 'right', 'right', 2000, 0.238, 6, 22, 2, 0.300, 0.660),
    batter('松本直樹', 'swallows', 'C', 26, 'right', 'right', 1500, 0.220, 2, 12, 0, 0.280, 0.570),
    batter('西村瑠伊斗', 'swallows', 'SS', 21, 'right', 'right', 800, 0.225, 1, 8, 5, 0.280, 0.570),
    batter('太田賢吾', 'swallows', '2B', 27, 'right', 'left', 1800, 0.240, 2, 14, 5, 0.295, 0.620),
    batter('宮本丈', 'swallows', '3B', 29, 'right', 'left', 2500, 0.242, 4, 18, 2, 0.300, 0.640),
    batter('並木秀尊', 'swallows', 'CF', 26, 'right', 'left', 1200, 0.235, 1, 10, 20, 0.290, 0.600),
    batter('青木宣親', 'swallows', 'DH', 43, 'right', 'left', 15000, 0.255, 3, 18, 1, 0.330, 0.680),
    batter('山崎晃大朗', 'swallows', 'LF', 30, 'left', 'left', 2500, 0.250, 3, 15, 8, 0.305, 0.650),
    batter('北村拓己', 'swallows', '1B', 29, 'right', 'right', 2000, 0.232, 5, 20, 1, 0.290, 0.630),
    batter('武岡龍世', 'swallows', 'SS', 23, 'right', 'left', 1200, 0.228, 2, 12, 5, 0.285, 0.600),
    batter('奥村展征', 'swallows', 'RF', 28, 'right', 'left', 2000, 0.238, 4, 16, 3, 0.295, 0.630),
    batter('橋本星哉', 'swallows', 'DH', 23, 'right', 'right', 1000, 0.222, 3, 12, 0, 0.280, 0.590),
    batter('古賀優大', 'swallows', 'LF', 27, 'right', 'right', 1500, 0.230, 2, 10, 2, 0.285, 0.590),
    batter('赤羽由紘', 'swallows', '1B', 25, 'right', 'left', 1200, 0.235, 5, 18, 1, 0.290, 0.640),
    batter('中山翔太', 'swallows', 'RF', 24, 'right', 'right', 1000, 0.225, 4, 14, 2, 0.280, 0.610),
  ];
}

function hawksPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('有原航平', 'hawks', 33, 'right', 'right', 20000, 'starter', 3.05, 10, 0, 135, 32, 165.0),
    pitcher('東浜巨', 'hawks', 33, 'right', 'right', 12000, 'starter', 3.25, 8, 0, 110, 30, 150.0),
    pitcher('石川柊太', 'hawks', 33, 'right', 'right', 10000, 'starter', 3.45, 7, 0, 100, 28, 140.0),
    pitcher('大関友久', 'hawks', 26, 'left', 'left', 4000, 'starter', 3.15, 8, 0, 115, 35, 148.0),
    pitcher('板東湧梧', 'hawks', 28, 'right', 'right', 3000, 'starter', 3.70, 5, 0, 80, 28, 120.0),
    pitcher('スチュワート', 'hawks', 27, 'right', 'right', 8000, 'starter', 3.55, 6, 0, 95, 30, 130.0, true),
    pitcher('和田毅', 'hawks', 43, 'left', 'left', 10000, 'starter', 3.85, 4, 0, 70, 22, 105.0),
    pitcher('オスナ', 'hawks', 29, 'right', 'right', 15000, 'closer', 1.65, 3, 40, 78, 12, 55.0, true),
    pitcher('モイネロ', 'hawks', 30, 'left', 'left', 25000, 'setup', 1.40, 4, 10, 85, 14, 60.0, true),
    pitcher('松本裕樹', 'hawks', 27, 'left', 'left', 4000, 'setup', 2.50, 3, 5, 55, 18, 55.0),
    pitcher('甲斐野央', 'hawks', 27, 'right', 'right', 3500, 'reliever', 2.85, 2, 2, 50, 16, 50.0),
    pitcher('津森宥紀', 'hawks', 28, 'right', 'right', 3000, 'reliever', 3.10, 2, 0, 42, 15, 45.0),
    pitcher('藤井皓哉', 'hawks', 28, 'right', 'right', 3000, 'reliever', 3.30, 2, 0, 40, 16, 42.0),
    pitcher('田浦文丸', 'hawks', 26, 'left', 'left', 2000, 'reliever', 3.55, 1, 0, 35, 18, 40.0),
    pitcher('杉山一樹', 'hawks', 27, 'right', 'right', 1500, 'reliever', 3.80, 1, 0, 30, 14, 38.0),
    pitcher('尾形崇斗', 'hawks', 23, 'right', 'right', 1200, 'reliever', 4.10, 1, 0, 28, 16, 35.0),
    // --- 野手 ---
    batter('柳田悠岐', 'hawks', 'LF', 36, 'right', 'left', 62000, 0.275, 20, 68, 5, 0.380, 0.880),
    batter('山川穂高', 'hawks', '1B', 33, 'right', 'right', 25000, 0.262, 30, 90, 2, 0.355, 0.870),
    batter('近藤健介', 'hawks', 'DH', 31, 'right', 'left', 36000, 0.295, 18, 72, 3, 0.400, 0.900),
    batter('今宮健太', 'hawks', 'SS', 33, 'right', 'right', 22000, 0.255, 8, 40, 10, 0.310, 0.690),
    batter('周東佑京', 'hawks', 'CF', 28, 'right', 'left', 8000, 0.268, 3, 28, 40, 0.320, 0.680),
    batter('甲斐拓也', 'hawks', 'C', 32, 'right', 'right', 18000, 0.235, 8, 35, 3, 0.300, 0.650),
    batter('牧原大成', 'hawks', '2B', 32, 'right', 'left', 8000, 0.278, 5, 35, 12, 0.325, 0.720),
    batter('栗原陵矢', 'hawks', '3B', 28, 'right', 'left', 8000, 0.265, 15, 55, 5, 0.335, 0.780),
    batter('中村晃', 'hawks', 'RF', 34, 'right', 'left', 15000, 0.272, 5, 32, 2, 0.345, 0.730),
    batter('ウォーカー', 'hawks', 'LF', 29, 'right', 'left', 8000, 0.258, 12, 45, 3, 0.325, 0.755, true),
    batter('三森大貴', 'hawks', '2B', 26, 'right', 'left', 3000, 0.255, 4, 22, 8, 0.310, 0.670),
    batter('野村大樹', 'hawks', '3B', 24, 'right', 'right', 1500, 0.248, 6, 25, 1, 0.305, 0.680),
    batter('海野隆司', 'hawks', 'C', 27, 'right', 'right', 2000, 0.225, 3, 15, 1, 0.285, 0.600),
    batter('渡邉陸', 'hawks', 'C', 22, 'right', 'right', 1000, 0.215, 2, 10, 0, 0.275, 0.560),
    batter('柳町達', 'hawks', 'RF', 27, 'right', 'left', 2000, 0.260, 4, 20, 5, 0.315, 0.680),
    batter('正木智也', 'hawks', 'LF', 25, 'right', 'right', 1500, 0.242, 8, 28, 2, 0.300, 0.700),
    batter('川瀬晃', 'hawks', 'SS', 27, 'right', 'left', 2000, 0.240, 2, 14, 8, 0.295, 0.620),
    batter('増田珠', 'hawks', '1B', 25, 'right', 'right', 1500, 0.235, 5, 18, 2, 0.290, 0.640),
    batter('リチャード', 'hawks', 'DH', 27, 'right', 'right', 1500, 0.232, 8, 28, 0, 0.285, 0.660),
    batter('佐藤直樹', 'hawks', 'CF', 26, 'left', 'left', 1500, 0.230, 2, 12, 12, 0.285, 0.600),
    batter('仲田慶介', 'hawks', 'CF', 23, 'right', 'right', 1000, 0.228, 1, 8, 8, 0.280, 0.580),
    batter('井上朋也', 'hawks', '3B', 22, 'right', 'right', 1000, 0.225, 3, 12, 2, 0.280, 0.600),
    batter('生海', 'hawks', 'SS', 21, 'right', 'right', 800, 0.218, 1, 6, 5, 0.272, 0.560),
    batter('緒方理貢', 'hawks', '1B', 21, 'right', 'left', 800, 0.222, 3, 10, 1, 0.278, 0.590),
  ];
}

function buffaloesPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('宮城大弥', 'buffaloes', 23, 'left', 'left', 12000, 'starter', 2.60, 12, 0, 155, 38, 175.0),
    pitcher('山崎福也', 'buffaloes', 32, 'left', 'left', 8000, 'starter', 3.10, 9, 0, 110, 30, 155.0),
    pitcher('田嶋大樹', 'buffaloes', 29, 'left', 'left', 6000, 'starter', 3.30, 7, 0, 100, 32, 140.0),
    pitcher('山岡泰輔', 'buffaloes', 29, 'right', 'right', 10000, 'starter', 3.40, 7, 0, 105, 28, 138.0),
    pitcher('曽谷龍平', 'buffaloes', 23, 'left', 'left', 2000, 'starter', 3.65, 5, 0, 85, 30, 120.0),
    pitcher('エスピノーザ', 'buffaloes', 27, 'right', 'right', 8000, 'starter', 3.20, 8, 0, 120, 32, 148.0, true),
    pitcher('山下舜平大', 'buffaloes', 22, 'right', 'right', 2000, 'starter', 3.80, 4, 0, 72, 28, 108.0),
    pitcher('平野佳寿', 'buffaloes', 41, 'right', 'right', 20000, 'closer', 2.10, 2, 30, 58, 12, 52.0),
    pitcher('ワゲスパック', 'buffaloes', 30, 'right', 'right', 8000, 'setup', 2.30, 3, 8, 62, 15, 55.0, true),
    pitcher('山田修義', 'buffaloes', 33, 'left', 'left', 4000, 'setup', 2.70, 2, 5, 48, 16, 50.0),
    pitcher('阿部翔太', 'buffaloes', 31, 'right', 'right', 3500, 'reliever', 3.00, 2, 0, 42, 14, 48.0),
    pitcher('比嘉幹貴', 'buffaloes', 42, 'right', 'right', 3000, 'reliever', 3.20, 1, 0, 30, 10, 38.0),
    pitcher('本田仁海', 'buffaloes', 25, 'right', 'right', 1500, 'reliever', 3.50, 1, 0, 35, 16, 40.0),
    pitcher('小木田敦也', 'buffaloes', 26, 'right', 'right', 1500, 'reliever', 3.70, 1, 0, 30, 14, 38.0),
    pitcher('近藤大亮', 'buffaloes', 31, 'right', 'right', 3500, 'reliever', 3.40, 1, 0, 35, 12, 42.0),
    pitcher('吉田凌', 'buffaloes', 27, 'right', 'right', 1200, 'reliever', 4.00, 1, 0, 28, 15, 35.0),
    // --- 野手 ---
    batter('頓宮裕真', 'buffaloes', '1B', 27, 'right', 'right', 8000, 0.288, 18, 68, 1, 0.365, 0.850),
    batter('森友哉', 'buffaloes', 'C', 29, 'right', 'left', 25000, 0.280, 15, 58, 2, 0.370, 0.840),
    batter('杉本裕太郎', 'buffaloes', 'RF', 33, 'right', 'right', 10000, 0.255, 20, 62, 2, 0.325, 0.790),
    batter('中川圭太', 'buffaloes', '2B', 28, 'right', 'right', 5000, 0.270, 8, 42, 5, 0.335, 0.740),
    batter('紅林弘太郎', 'buffaloes', 'SS', 23, 'right', 'right', 4000, 0.262, 10, 45, 5, 0.315, 0.730),
    batter('西川龍馬', 'buffaloes', 'LF', 29, 'right', 'left', 15000, 0.285, 12, 55, 3, 0.355, 0.810),
    batter('T-岡田', 'buffaloes', 'DH', 37, 'right', 'left', 10000, 0.242, 12, 42, 0, 0.310, 0.720),
    batter('若月健矢', 'buffaloes', 'C', 29, 'right', 'right', 5000, 0.235, 4, 22, 1, 0.295, 0.630),
    batter('太田椋', 'buffaloes', 'SS', 24, 'right', 'right', 2500, 0.248, 5, 25, 8, 0.305, 0.670),
    batter('宗佑磨', 'buffaloes', '3B', 28, 'right', 'right', 6000, 0.258, 6, 32, 10, 0.315, 0.700),
    batter('ゴンザレス', 'buffaloes', 'RF', 29, 'right', 'right', 8000, 0.260, 18, 60, 2, 0.330, 0.800, true),
    batter('野口智哉', 'buffaloes', '2B', 25, 'right', 'left', 2000, 0.252, 3, 18, 8, 0.310, 0.660),
    batter('石川亮', 'buffaloes', 'C', 30, 'right', 'right', 2500, 0.218, 2, 12, 0, 0.278, 0.560),
    batter('福田周平', 'buffaloes', 'CF', 31, 'right', 'left', 4000, 0.262, 3, 22, 10, 0.330, 0.690),
    batter('渡部遼人', 'buffaloes', 'CF', 25, 'left', 'left', 1500, 0.245, 2, 12, 12, 0.300, 0.630),
    batter('来田涼斗', 'buffaloes', 'LF', 22, 'right', 'left', 1000, 0.235, 3, 14, 6, 0.290, 0.630),
    batter('廣岡大志', 'buffaloes', '3B', 27, 'right', 'right', 2000, 0.228, 8, 25, 2, 0.285, 0.660),
    batter('安達了一', 'buffaloes', 'SS', 38, 'right', 'right', 4000, 0.232, 2, 14, 2, 0.290, 0.600),
    batter('西野真弘', 'buffaloes', '1B', 34, 'right', 'left', 2500, 0.240, 3, 16, 3, 0.300, 0.630),
    batter('大里昂生', 'buffaloes', '2B', 22, 'right', 'right', 800, 0.225, 1, 8, 5, 0.278, 0.575),
    batter('山足達也', 'buffaloes', 'SS', 30, 'right', 'right', 2000, 0.230, 1, 10, 5, 0.288, 0.590),
    batter('小田裕也', 'buffaloes', 'RF', 33, 'right', 'left', 2000, 0.238, 2, 10, 8, 0.298, 0.620),
    batter('セデーニョ', 'buffaloes', 'DH', 27, 'right', 'right', 5000, 0.248, 15, 48, 1, 0.310, 0.760, true),
    batter('佐野皓大', 'buffaloes', 'LF', 27, 'right', 'left', 1500, 0.232, 2, 10, 6, 0.288, 0.600),
  ];
}

function marinesPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('佐々木朗希', 'marines', 23, 'right', 'right', 16000, 'starter', 2.10, 10, 0, 180, 35, 155.0),
    pitcher('小島和哉', 'marines', 28, 'left', 'left', 6000, 'starter', 3.20, 8, 0, 110, 32, 155.0),
    pitcher('種市篤暉', 'marines', 26, 'right', 'right', 4000, 'starter', 3.35, 7, 0, 120, 35, 140.0),
    pitcher('西野勇士', 'marines', 32, 'right', 'right', 5000, 'starter', 3.50, 6, 0, 90, 28, 130.0),
    pitcher('メルセデス', 'marines', 30, 'left', 'left', 8000, 'starter', 3.60, 5, 0, 85, 30, 125.0, true),
    pitcher('中森俊介', 'marines', 23, 'right', 'right', 1500, 'starter', 3.85, 4, 0, 70, 28, 108.0),
    pitcher('河村説人', 'marines', 27, 'right', 'right', 1500, 'starter', 4.10, 3, 0, 60, 25, 95.0),
    pitcher('益田直也', 'marines', 35, 'right', 'right', 20000, 'closer', 2.20, 2, 32, 55, 15, 52.0),
    pitcher('澤村拓一', 'marines', 36, 'right', 'right', 10000, 'setup', 2.40, 3, 5, 58, 18, 55.0),
    pitcher('西村天裕', 'marines', 30, 'right', 'right', 4000, 'setup', 2.75, 2, 3, 48, 16, 50.0),
    pitcher('坂本光士郎', 'marines', 28, 'left', 'left', 2500, 'reliever', 3.10, 2, 0, 42, 15, 45.0),
    pitcher('鈴木昭汰', 'marines', 26, 'left', 'left', 2000, 'reliever', 3.40, 1, 0, 38, 18, 42.0),
    pitcher('ゲレーロ', 'marines', 29, 'right', 'right', 6000, 'reliever', 2.80, 3, 2, 55, 14, 50.0, true),
    pitcher('国吉佑樹', 'marines', 33, 'right', 'right', 3000, 'reliever', 3.55, 1, 0, 35, 16, 40.0),
    pitcher('廣畑敦也', 'marines', 27, 'right', 'right', 1500, 'reliever', 3.70, 1, 0, 32, 14, 38.0),
    pitcher('東妻勇輔', 'marines', 28, 'right', 'right', 2000, 'reliever', 3.85, 1, 0, 30, 15, 36.0),
    // --- 野手 ---
    batter('安田尚憲', 'marines', '1B', 25, 'right', 'left', 5000, 0.258, 15, 55, 2, 0.330, 0.770),
    batter('藤原恭大', 'marines', 'CF', 24, 'left', 'left', 3500, 0.265, 8, 35, 15, 0.325, 0.730),
    batter('ポランコ', 'marines', 'LF', 32, 'right', 'right', 15000, 0.268, 22, 70, 3, 0.340, 0.830, true),
    batter('荻野貴司', 'marines', 'RF', 39, 'right', 'right', 10000, 0.270, 3, 25, 12, 0.335, 0.710),
    batter('松川虎生', 'marines', 'C', 22, 'right', 'right', 2500, 0.230, 5, 22, 1, 0.290, 0.620),
    batter('中村奨吾', 'marines', '2B', 32, 'right', 'right', 15000, 0.258, 8, 42, 8, 0.330, 0.730),
    batter('岡大海', 'marines', 'CF', 33, 'right', 'right', 5000, 0.252, 4, 20, 10, 0.315, 0.670),
    batter('ブロッソー', 'marines', '3B', 30, 'right', 'right', 8000, 0.255, 18, 58, 1, 0.325, 0.790, true),
    batter('佐藤都志也', 'marines', 'C', 27, 'right', 'left', 3000, 0.248, 5, 25, 2, 0.310, 0.670),
    batter('田村龍弘', 'marines', 'C', 31, 'right', 'right', 3000, 0.222, 3, 15, 0, 0.285, 0.580),
    batter('友杉篤輝', 'marines', 'SS', 24, 'right', 'right', 1500, 0.242, 2, 15, 10, 0.295, 0.620),
    batter('茶谷健太', 'marines', 'SS', 27, 'right', 'right', 1500, 0.230, 2, 12, 5, 0.288, 0.600),
    batter('石川慎吾', 'marines', 'DH', 29, 'right', 'left', 2000, 0.245, 6, 22, 1, 0.305, 0.670),
    batter('角中勝也', 'marines', 'LF', 38, 'right', 'left', 8000, 0.260, 3, 20, 2, 0.330, 0.690),
    batter('高部瑛斗', 'marines', 'CF', 26, 'right', 'left', 2000, 0.255, 2, 15, 18, 0.310, 0.650),
    batter('山口航輝', 'marines', 'RF', 24, 'right', 'right', 2000, 0.238, 12, 38, 1, 0.295, 0.710),
    batter('井上晴哉', 'marines', '1B', 33, 'right', 'right', 4000, 0.240, 10, 35, 0, 0.305, 0.700),
    batter('平沢大河', 'marines', 'SS', 27, 'right', 'left', 2000, 0.225, 3, 14, 5, 0.285, 0.600),
    batter('池田来翔', 'marines', '2B', 24, 'right', 'right', 1200, 0.232, 2, 10, 5, 0.288, 0.600),
    batter('和田康士朗', 'marines', 'LF', 25, 'right', 'left', 1200, 0.228, 1, 8, 15, 0.280, 0.580),
    batter('髙濱祐仁', 'marines', '3B', 28, 'right', 'right', 1800, 0.235, 5, 18, 1, 0.290, 0.640),
    batter('菅野剛士', 'marines', 'RF', 30, 'right', 'right', 1500, 0.235, 3, 12, 3, 0.295, 0.620),
    batter('山本大斗', 'marines', 'DH', 22, 'right', 'right', 800, 0.220, 3, 12, 2, 0.275, 0.590),
    batter('小川龍成', 'marines', '2B', 26, 'right', 'left', 1500, 0.235, 1, 8, 8, 0.290, 0.600),
  ];
}

function eaglesPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('田中将大', 'eagles', 36, 'right', 'right', 40000, 'starter', 3.50, 7, 0, 100, 30, 135.0),
    pitcher('岸孝之', 'eagles', 40, 'right', 'right', 20000, 'starter', 3.30, 7, 0, 95, 25, 130.0),
    pitcher('早川隆久', 'eagles', 25, 'left', 'left', 5000, 'starter', 3.15, 9, 0, 135, 38, 160.0),
    pitcher('荘司康誠', 'eagles', 24, 'right', 'right', 2500, 'starter', 3.55, 6, 0, 105, 32, 128.0),
    pitcher('瀧中瞭太', 'eagles', 28, 'right', 'right', 3000, 'starter', 3.70, 5, 0, 80, 28, 118.0),
    pitcher('藤井聖', 'eagles', 27, 'left', 'left', 2000, 'starter', 3.85, 4, 0, 72, 30, 110.0),
    pitcher('内星龍', 'eagles', 23, 'left', 'left', 1500, 'starter', 4.10, 3, 0, 65, 28, 98.0),
    pitcher('松井裕樹', 'eagles', 29, 'left', 'left', 15000, 'closer', 1.90, 2, 35, 70, 16, 52.0),
    pitcher('則本昂大', 'eagles', 33, 'right', 'right', 25000, 'setup', 2.35, 4, 8, 62, 18, 58.0),
    pitcher('宋家豪', 'eagles', 31, 'right', 'right', 5000, 'setup', 2.65, 2, 5, 50, 15, 52.0),
    pitcher('鈴木翔天', 'eagles', 27, 'left', 'left', 2500, 'reliever', 3.10, 2, 0, 42, 16, 45.0),
    pitcher('酒居知史', 'eagles', 31, 'right', 'right', 3000, 'reliever', 3.30, 2, 0, 38, 14, 42.0),
    pitcher('西口直人', 'eagles', 25, 'right', 'right', 1500, 'reliever', 3.55, 1, 0, 35, 16, 40.0),
    pitcher('渡辺翔太', 'eagles', 24, 'left', 'left', 1200, 'reliever', 3.75, 1, 0, 32, 18, 38.0),
    pitcher('ターレー', 'eagles', 32, 'right', 'right', 5000, 'reliever', 3.20, 2, 2, 48, 14, 48.0, true),
    pitcher('弓削隼人', 'eagles', 28, 'left', 'left', 1500, 'reliever', 4.00, 1, 0, 28, 15, 35.0),
    // --- 野手 ---
    batter('浅村栄斗', 'eagles', '1B', 34, 'right', 'right', 40000, 0.268, 22, 78, 3, 0.350, 0.830),
    batter('島内宏明', 'eagles', 'LF', 34, 'left', 'left', 15000, 0.265, 12, 50, 5, 0.345, 0.780),
    batter('小深田大翔', 'eagles', '2B', 26, 'right', 'switch', 5000, 0.268, 3, 28, 18, 0.330, 0.700),
    batter('辰己涼介', 'eagles', 'CF', 28, 'right', 'left', 8000, 0.272, 10, 45, 12, 0.340, 0.770),
    batter('鈴木大地', 'eagles', '3B', 35, 'right', 'left', 12000, 0.260, 8, 42, 3, 0.325, 0.720),
    batter('太田光', 'eagles', 'C', 28, 'right', 'right', 5000, 0.242, 5, 28, 2, 0.305, 0.660),
    batter('フランコ', 'eagles', 'SS', 26, 'right', 'right', 8000, 0.258, 15, 52, 5, 0.320, 0.770, true),
    batter('阿部寿樹', 'eagles', '2B', 33, 'right', 'right', 5000, 0.252, 5, 25, 3, 0.310, 0.670),
    batter('小郷裕哉', 'eagles', 'RF', 27, 'right', 'left', 3000, 0.260, 5, 28, 8, 0.315, 0.690),
    batter('村林一輝', 'eagles', 'SS', 27, 'right', 'right', 2000, 0.235, 3, 18, 8, 0.290, 0.620),
    batter('伊藤裕季也', 'eagles', '3B', 26, 'right', 'left', 1500, 0.242, 6, 22, 2, 0.300, 0.660),
    batter('石原彪', 'eagles', 'C', 26, 'right', 'right', 2000, 0.225, 3, 15, 1, 0.285, 0.600),
    batter('岡島豪郎', 'eagles', 'C', 35, 'right', 'left', 3000, 0.232, 2, 12, 0, 0.295, 0.600),
    batter('茂木栄五郎', 'eagles', 'DH', 31, 'right', 'left', 6000, 0.248, 8, 32, 3, 0.315, 0.710),
    batter('武藤敦貴', 'eagles', 'LF', 23, 'left', 'left', 1200, 0.240, 3, 14, 8, 0.295, 0.630),
    batter('田中和基', 'eagles', 'CF', 30, 'right', 'switch', 2000, 0.235, 5, 18, 10, 0.295, 0.650),
    batter('銀次', 'eagles', '1B', 37, 'right', 'left', 5000, 0.252, 3, 18, 0, 0.310, 0.650),
    batter('ギッテンス', 'eagles', 'DH', 30, 'right', 'right', 5000, 0.245, 15, 48, 0, 0.305, 0.740, true),
    batter('渡邉佳明', 'eagles', '3B', 27, 'right', 'left', 1500, 0.235, 2, 12, 2, 0.290, 0.610),
    batter('黒川史陽', 'eagles', '2B', 23, 'right', 'left', 1500, 0.240, 3, 14, 3, 0.295, 0.630),
    batter('入江大樹', 'eagles', 'RF', 22, 'right', 'right', 1000, 0.225, 4, 16, 3, 0.280, 0.620),
    batter('水上桂', 'eagles', 'LF', 24, 'right', 'right', 1000, 0.228, 2, 10, 5, 0.282, 0.590),
    batter('平良竜哉', 'eagles', 'SS', 23, 'right', 'right', 1000, 0.225, 2, 10, 4, 0.280, 0.590),
    batter('辰見鑛太郎', 'eagles', 'RF', 22, 'right', 'right', 800, 0.220, 3, 12, 2, 0.275, 0.590),
  ];
}

function lionsPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('高橋光成', 'lions', 27, 'right', 'right', 12000, 'starter', 3.00, 10, 0, 145, 38, 170.0),
    pitcher('平良海馬', 'lions', 25, 'right', 'right', 8000, 'starter', 2.80, 9, 0, 140, 32, 158.0),
    pitcher('隅田知一郎', 'lions', 25, 'left', 'left', 4000, 'starter', 3.30, 7, 0, 120, 35, 145.0),
    pitcher('今井達也', 'lions', 26, 'right', 'right', 5000, 'starter', 3.50, 6, 0, 110, 38, 135.0),
    pitcher('松本航', 'lions', 27, 'right', 'right', 3000, 'starter', 3.75, 5, 0, 85, 30, 120.0),
    pitcher('渡邉勇太朗', 'lions', 25, 'right', 'right', 2000, 'starter', 3.90, 4, 0, 72, 28, 110.0),
    pitcher('武内夏暉', 'lions', 23, 'left', 'left', 2000, 'starter', 3.45, 6, 0, 100, 30, 128.0),
    pitcher('増田達至', 'lions', 36, 'right', 'right', 15000, 'closer', 2.15, 2, 30, 55, 14, 52.0),
    pitcher('水上由伸', 'lions', 26, 'right', 'right', 3500, 'setup', 2.55, 3, 5, 52, 16, 55.0),
    pitcher('甲斐野央', 'lions', 27, 'right', 'right', 3000, 'setup', 2.80, 2, 3, 48, 18, 50.0),
    pitcher('佐藤隼輔', 'lions', 25, 'left', 'left', 2000, 'reliever', 3.20, 2, 0, 42, 16, 45.0),
    pitcher('豆田泰志', 'lions', 21, 'right', 'right', 1200, 'reliever', 3.50, 1, 0, 38, 18, 40.0),
    pitcher('森脇亮介', 'lions', 30, 'right', 'right', 2500, 'reliever', 3.40, 1, 0, 35, 14, 42.0),
    pitcher('ボー', 'lions', 28, 'right', 'right', 5000, 'reliever', 3.30, 2, 0, 45, 15, 48.0, true),
    pitcher('本田圭佑', 'lions', 28, 'right', 'right', 2000, 'reliever', 3.70, 1, 0, 30, 14, 38.0),
    pitcher('田村伊知郎', 'lions', 29, 'right', 'right', 1500, 'reliever', 3.85, 1, 0, 28, 12, 36.0),
    // --- 野手 ---
    batter('源田壮亮', 'lions', 'SS', 31, 'right', 'left', 22000, 0.268, 3, 30, 20, 0.325, 0.695),
    batter('外崎修汰', 'lions', '2B', 31, 'right', 'right', 12000, 0.260, 12, 48, 15, 0.330, 0.760),
    batter('山村崇嘉', 'lions', '3B', 23, 'right', 'left', 2000, 0.255, 12, 42, 2, 0.315, 0.740),
    batter('蛭間拓哉', 'lions', 'LF', 24, 'left', 'left', 2000, 0.258, 8, 32, 8, 0.320, 0.720),
    batter('中村剛也', 'lions', 'DH', 41, 'right', 'right', 15000, 0.235, 15, 48, 0, 0.310, 0.730),
    batter('岸潤一郎', 'lions', 'CF', 26, 'right', 'right', 2500, 0.262, 5, 25, 12, 0.315, 0.690),
    batter('古賀悠斗', 'lions', 'C', 25, 'right', 'right', 2500, 0.240, 5, 22, 2, 0.300, 0.650),
    batter('アギラー', 'lions', '1B', 33, 'right', 'right', 8000, 0.255, 20, 65, 1, 0.325, 0.800, true),
    batter('マキノン', 'lions', '3B', 31, 'right', 'right', 8000, 0.262, 18, 58, 2, 0.335, 0.790, true),
    batter('柘植世那', 'lions', 'C', 27, 'right', 'right', 2000, 0.225, 3, 15, 1, 0.285, 0.600),
    batter('炭谷銀仁朗', 'lions', 'C', 37, 'right', 'right', 5000, 0.218, 2, 10, 0, 0.278, 0.560),
    batter('金子侑司', 'lions', 'CF', 34, 'right', 'switch', 5000, 0.245, 3, 18, 15, 0.305, 0.640),
    batter('西川愛也', 'lions', 'LF', 25, 'right', 'left', 1500, 0.248, 5, 20, 5, 0.300, 0.660),
    batter('鳥越康介', 'lions', 'SS', 24, 'right', 'right', 1200, 0.232, 2, 12, 8, 0.290, 0.610),
    batter('長谷川信哉', 'lions', 'RF', 24, 'right', 'right', 1200, 0.240, 5, 18, 5, 0.295, 0.650),
    batter('若林楽人', 'lions', 'CF', 25, 'right', 'left', 1500, 0.235, 2, 10, 18, 0.290, 0.610),
    batter('滝澤夏央', 'lions', 'SS', 20, 'right', 'left', 800, 0.225, 1, 8, 8, 0.280, 0.575),
    batter('佐藤龍世', 'lions', '1B', 26, 'right', 'right', 1500, 0.235, 6, 22, 1, 0.290, 0.650),
    batter('児玉亮涼', 'lions', 'RF', 24, 'right', 'right', 1200, 0.230, 3, 14, 5, 0.285, 0.620),
    batter('高木渉', 'lions', 'LF', 27, 'right', 'left', 1500, 0.240, 3, 14, 6, 0.295, 0.630),
    batter('渡部健人', 'lions', 'DH', 25, 'right', 'right', 1500, 0.228, 8, 25, 0, 0.285, 0.660),
    batter('平沼翔太', 'lions', '2B', 28, 'right', 'left', 2000, 0.235, 2, 12, 3, 0.290, 0.610),
    batter('元山飛優', 'lions', 'SS', 26, 'right', 'left', 1500, 0.228, 1, 8, 5, 0.282, 0.580),
    batter('ペイトン', 'lions', 'RF', 28, 'right', 'right', 5000, 0.248, 12, 40, 3, 0.310, 0.730, true),
  ];
}

function fightersPlayers(): CsvPlayerRow[] {
  return [
    // --- 投手 ---
    pitcher('伊藤大海', 'fighters', 27, 'right', 'right', 10000, 'starter', 2.85, 10, 0, 150, 38, 170.0),
    pitcher('加藤貴之', 'fighters', 33, 'left', 'left', 8000, 'starter', 3.10, 8, 0, 110, 28, 155.0),
    pitcher('上沢直之', 'fighters', 30, 'right', 'right', 12000, 'starter', 3.25, 8, 0, 125, 32, 160.0),
    pitcher('北山亘基', 'fighters', 26, 'right', 'right', 3000, 'starter', 3.50, 6, 0, 95, 30, 135.0),
    pitcher('金村尚真', 'fighters', 24, 'right', 'right', 2500, 'starter', 3.40, 6, 0, 100, 28, 130.0),
    pitcher('鈴木健矢', 'fighters', 27, 'right', 'right', 2000, 'starter', 3.75, 4, 0, 72, 28, 115.0),
    pitcher('バーヘイゲン', 'fighters', 31, 'right', 'right', 8000, 'starter', 3.55, 5, 0, 88, 25, 125.0, true),
    pitcher('田中正義', 'fighters', 30, 'right', 'right', 5000, 'closer', 2.00, 3, 32, 65, 16, 55.0),
    pitcher('河野竜生', 'fighters', 27, 'left', 'left', 3500, 'setup', 2.55, 3, 5, 52, 18, 55.0),
    pitcher('池田隆英', 'fighters', 28, 'right', 'right', 2500, 'setup', 2.80, 2, 3, 45, 16, 48.0),
    pitcher('石川直也', 'fighters', 28, 'right', 'right', 2500, 'reliever', 3.10, 2, 0, 42, 15, 45.0),
    pitcher('ザバラ', 'fighters', 29, 'left', 'left', 5000, 'reliever', 2.90, 2, 2, 50, 14, 48.0, true),
    pitcher('山本拓実', 'fighters', 25, 'right', 'right', 1500, 'reliever', 3.50, 1, 0, 35, 16, 40.0),
    pitcher('堀瑞輝', 'fighters', 27, 'left', 'left', 2000, 'reliever', 3.65, 1, 0, 32, 18, 38.0),
    pitcher('齋藤友貴哉', 'fighters', 28, 'right', 'right', 1500, 'reliever', 3.80, 1, 0, 30, 14, 36.0),
    pitcher('福田俊', 'fighters', 26, 'left', 'left', 1200, 'reliever', 4.00, 1, 0, 28, 16, 35.0),
    // --- 野手 ---
    batter('万波中正', 'fighters', 'RF', 25, 'right', 'right', 5000, 0.265, 25, 72, 5, 0.325, 0.840),
    batter('清宮幸太郎', 'fighters', '1B', 26, 'right', 'left', 5000, 0.258, 18, 55, 1, 0.340, 0.800),
    batter('野村佑希', 'fighters', '3B', 24, 'right', 'right', 3000, 0.260, 12, 45, 3, 0.315, 0.750),
    batter('マルティネス', 'fighters', 'CF', 28, 'right', 'right', 10000, 0.272, 15, 55, 8, 0.335, 0.800, true),
    batter('松本剛', 'fighters', 'RF', 32, 'right', 'right', 6000, 0.278, 5, 32, 8, 0.340, 0.740),
    batter('郡司裕也', 'fighters', 'C', 27, 'right', 'right', 3000, 0.245, 8, 35, 1, 0.315, 0.700),
    batter('水野達稀', 'fighters', 'SS', 23, 'right', 'right', 2000, 0.252, 5, 25, 15, 0.310, 0.680),
    batter('レイエス', 'fighters', 'LF', 29, 'right', 'right', 8000, 0.258, 18, 58, 2, 0.320, 0.790, true),
    batter('淺間大基', 'fighters', 'CF', 29, 'right', 'left', 3000, 0.250, 4, 18, 10, 0.310, 0.660),
    batter('奈良間大己', 'fighters', 'SS', 24, 'right', 'right', 1500, 0.238, 3, 15, 8, 0.295, 0.630),
    batter('マヌエル', 'fighters', 'DH', 27, 'right', 'right', 5000, 0.252, 15, 48, 1, 0.310, 0.755, true),
    batter('石井一成', 'fighters', '2B', 28, 'right', 'left', 2500, 0.245, 3, 18, 5, 0.300, 0.640),
    batter('上川畑大悟', 'fighters', 'SS', 27, 'right', 'left', 2000, 0.240, 2, 14, 8, 0.295, 0.620),
    batter('田宮裕涼', 'fighters', 'C', 24, 'right', 'left', 2000, 0.255, 3, 18, 5, 0.310, 0.660),
    batter('伏見寅威', 'fighters', 'C', 34, 'right', 'right', 3000, 0.225, 3, 15, 0, 0.285, 0.600),
    batter('五十幡亮汰', 'fighters', 'CF', 25, 'right', 'left', 1500, 0.240, 1, 10, 22, 0.290, 0.610),
    batter('加藤豪将', 'fighters', '1B', 30, 'right', 'left', 2000, 0.238, 5, 20, 1, 0.300, 0.650),
    batter('今川優馬', 'fighters', 'RF', 25, 'right', 'right', 1500, 0.242, 6, 22, 3, 0.295, 0.670),
    batter('細川凌平', 'fighters', 'LF', 22, 'right', 'left', 1000, 0.228, 2, 10, 5, 0.285, 0.600),
    batter('佐藤龍世', 'fighters', '3B', 26, 'right', 'right', 1500, 0.232, 4, 16, 2, 0.288, 0.630),
    batter('矢澤宏太', 'fighters', 'LF', 24, 'left', 'left', 2500, 0.235, 4, 15, 8, 0.295, 0.640),
    batter('谷内亮太', 'fighters', '2B', 33, 'right', 'right', 2000, 0.230, 2, 12, 3, 0.290, 0.600),
    batter('古川裕大', 'fighters', 'DH', 26, 'right', 'right', 1500, 0.225, 3, 14, 1, 0.285, 0.610),
    batter('野村佑希', 'fighters', '1B', 24, 'right', 'right', 1500, 0.235, 5, 18, 1, 0.290, 0.640),
  ];
}

// ---------------------------------------------------------------------------
// メイン生成関数
// ---------------------------------------------------------------------------

/**
 * 全12球団の選手データを生成 (~780名)
 * 実在NPB選手（2025シーズン / 2024成績ベース）+ 育成選手（自動生成）
 */
export function generateAllPlayers(): CsvPlayerRow[] {
  const allPlayers: CsvPlayerRow[] = [];
  const nameGen = createNameGenerator();

  // 実在選手データ
  const teamPlayerFns: Array<() => CsvPlayerRow[]> = [
    giantsPlayers,
    tigersPlayers,
    carpPlayers,
    dragonsPlayers,
    baystarsPlayers,
    swallowsPlayers,
    hawksPlayers,
    buffaloesPlayers,
    marinesPlayers,
    eaglesPlayers,
    lionsPlayers,
    fightersPlayers,
  ];

  const teamIds = [
    'giants', 'tigers', 'carp', 'dragons', 'baystars', 'swallows',
    'hawks', 'buffaloes', 'marines', 'eagles', 'lions', 'fighters',
  ];

  for (let i = 0; i < teamPlayerFns.length; i++) {
    const realPlayers = teamPlayerFns[i]();
    allPlayers.push(...realPlayers);
    allPlayers.push(...generateDevPlayers(teamIds[i], nameGen));
  }

  return allPlayers;
}
