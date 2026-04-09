import type { SpecialAbility } from '@/types/specialAbility';

/** 全特能の定義マップ */
export const ABILITY_DEFINITIONS: Record<string, SpecialAbility> = {
  // ========================================
  // 固有特能
  // ========================================
  geniusBatter: {
    id: 'geniusBatter',
    name: '天才打者',
    description: 'ミート判定時に+10補正',
    category: 'unique',
    target: 'batter',
  },
  powerArm: {
    id: 'powerArm',
    name: '豪腕',
    description: '球威判定時に+10補正',
    category: 'unique',
    target: 'pitcher',
  },
  ironArm: {
    id: 'ironArm',
    name: '鉄腕',
    description: 'スタミナ消耗30%減',
    category: 'unique',
    target: 'pitcher',
  },
  speedContact: {
    id: 'speedContact',
    name: '俊足巧打',
    description: '走力+ミートの複合判定が有利',
    category: 'unique',
    target: 'batter',
  },
  defenseMaster: {
    id: 'defenseMaster',
    name: '守備の達人',
    description: '守備判定時にエラー率半減',
    category: 'unique',
    target: 'batter',
  },
  precisionMachine: {
    id: 'precisionMachine',
    name: '精密機械',
    description: '制球判定時に+10補正',
    category: 'unique',
    target: 'pitcher',
  },
  twoWay: {
    id: 'twoWay',
    name: '二刀流',
    description: '投手と野手の両方で出場可能',
    category: 'unique',
    target: 'both',
  },

  // ========================================
  // 通常特能（打者系）
  // ========================================
  clutch1: {
    id: 'clutch1',
    name: 'チャンス○',
    description: '得点圏での打撃+5',
    category: 'normal',
    target: 'batter',
  },
  clutch2: {
    id: 'clutch2',
    name: 'チャンス◎',
    description: '得点圏での打撃+10',
    category: 'normal',
    target: 'batter',
  },
  antiLeft: {
    id: 'antiLeft',
    name: '対左○',
    description: '左投手への打撃+5',
    category: 'normal',
    target: 'batter',
  },
  wideAngle: {
    id: 'wideAngle',
    name: '広角打法',
    description: '打球方向の偏りが減る（長打率微増）',
    category: 'normal',
    target: 'batter',
  },
  toughAtBat: {
    id: 'toughAtBat',
    name: '粘り打ち',
    description: '2ストライク後の三振率低下',
    category: 'normal',
    target: 'batter',
  },
  firstPitch: {
    id: 'firstPitch',
    name: '初球○',
    description: '初球の打撃+5',
    category: 'normal',
    target: 'batter',
  },
  basesLoaded: {
    id: 'basesLoaded',
    name: '満塁男',
    description: '満塁時の打撃+15',
    category: 'normal',
    target: 'batter',
  },
  walkoff: {
    id: 'walkoff',
    name: 'サヨナラ男',
    description: '9回以降の僅差で打撃+10',
    category: 'normal',
    target: 'batter',
  },
  stealing: {
    id: 'stealing',
    name: '盗塁○',
    description: '盗塁成功率+15%',
    category: 'normal',
    target: 'batter',
  },
  goodThrow: {
    id: 'goodThrow',
    name: '送球○',
    description: '送球エラー率半減',
    category: 'normal',
    target: 'batter',
  },
  moodMaker: {
    id: 'moodMaker',
    name: 'ムードメーカー',
    description: 'チーム全体の調子に微プラス',
    category: 'normal',
    target: 'batter',
  },
  clutchBad: {
    id: 'clutchBad',
    name: 'チャンス×',
    description: '得点圏での打撃-5',
    category: 'normal',
    target: 'batter',
  },
  moodBreaker: {
    id: 'moodBreaker',
    name: 'ムードブレイカー',
    description: 'チーム調子に微マイナス',
    category: 'normal',
    target: 'batter',
  },

  // ========================================
  // 通常特能（投手系）
  // ========================================
  antiPinch1: {
    id: 'antiPinch1',
    name: '対ピンチ○',
    description: '得点圏に走者がいる時+5',
    category: 'normal',
    target: 'pitcher',
  },
  antiPinch2: {
    id: 'antiPinch2',
    name: '対ピンチ◎',
    description: '得点圏に走者がいる時+10',
    category: 'normal',
    target: 'pitcher',
  },
  escapeBall: {
    id: 'escapeBall',
    name: '逃げ球',
    description: '被本塁打率低下',
    category: 'normal',
    target: 'pitcher',
  },
  strikeoutArtist: {
    id: 'strikeoutArtist',
    name: '奪三振',
    description: '三振率+10%',
    category: 'normal',
    target: 'pitcher',
  },
  quickMotion: {
    id: 'quickMotion',
    name: 'クイック○',
    description: '走者の盗塁成功率を下げる',
    category: 'normal',
    target: 'pitcher',
  },
  resilient: {
    id: 'resilient',
    name: '打たれ強い',
    description: '連打されても能力が下がりにくい',
    category: 'normal',
    target: 'pitcher',
  },
  lateInning: {
    id: 'lateInning',
    name: '尻上がり',
    description: '7回以降に能力+5',
    category: 'normal',
    target: 'pitcher',
  },
  extraInning: {
    id: 'extraInning',
    name: '回またぎ○',
    description: '中継ぎ時の回またぎでの能力低下なし',
    category: 'normal',
    target: 'pitcher',
  },
  winLuck: {
    id: 'winLuck',
    name: '勝ち運',
    description: '味方の援護率が微増',
    category: 'normal',
    target: 'pitcher',
  },

  // ========================================
  // 覚醒特能
  // ========================================
  superClutch: {
    id: 'superClutch',
    name: '超チャンス◎',
    description: '得点圏+20（期間限定1年 or 永続）',
    category: 'awakening',
    target: 'batter',
  },
  monsterPower: {
    id: 'monsterPower',
    name: '怪物球威',
    description: '球威+15（期間限定）',
    category: 'awakening',
    target: 'pitcher',
  },
  zone: {
    id: 'zone',
    name: 'ゾーン',
    description: '全打撃パラメータ+10（短期1年のみ）',
    category: 'awakening',
    target: 'batter',
  },
  indomitable: {
    id: 'indomitable',
    name: '不屈',
    description: 'スランプ耐性。スランプ期間半減（永続）',
    category: 'awakening',
    target: 'both',
  },
  steelBody: {
    id: 'steelBody',
    name: '鋼の肉体',
    description: '怪我率半減（永続・レア）',
    category: 'awakening',
    target: 'both',
  },
};
