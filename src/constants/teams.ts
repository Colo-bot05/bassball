import type { League, TeamAI, Facilities } from '@/types/team';

/** 球団初期設定 */
export interface TeamPreset {
  id: string;
  name: string;
  shortName: string;
  league: League;
  homeStadium: string;
  ai: TeamAI;
  initialFacilities: Facilities;
  broadcastRevenue: number;
}

const defaultFacilities: Facilities = {
  training: 1,
  bullpen: 1,
  rehab: 1,
  stadium: 3,
  scoutBase: 1,
  dormitory: 1,
};

/** 12球団の初期設定 */
export const TEAM_PRESETS: TeamPreset[] = [
  // セ・リーグ
  {
    id: 'giants',
    name: '巨人',
    shortName: '巨',
    league: 'central',
    homeStadium: '東京ドーム',
    ai: { budgetMode: 1.0, draftFocus: 0.3, winNowMode: 1.0, teamType: 'moneyball', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, stadium: 5, training: 3 },
    broadcastRevenue: 500000,
  },
  {
    id: 'tigers',
    name: '阪神',
    shortName: '神',
    league: 'central',
    homeStadium: '甲子園球場',
    ai: { budgetMode: 0.6, draftFocus: 0.8, winNowMode: 0.5, teamType: 'pitching', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, stadium: 5, bullpen: 2 },
    broadcastRevenue: 400000,
  },
  {
    id: 'carp',
    name: '広島',
    shortName: '広',
    league: 'central',
    homeStadium: 'マツダスタジアム',
    ai: { budgetMode: 0.3, draftFocus: 1.0, winNowMode: 0.2, teamType: 'development', mode: 'rebuilding' },
    initialFacilities: { ...defaultFacilities, dormitory: 3, scoutBase: 2 },
    broadcastRevenue: 200000,
  },
  {
    id: 'dragons',
    name: '中日',
    shortName: '中',
    league: 'central',
    homeStadium: 'バンテリンドーム',
    ai: { budgetMode: 0.4, draftFocus: 0.7, winNowMode: 0.4, teamType: 'pitching', mode: 'rebuilding' },
    initialFacilities: { ...defaultFacilities, bullpen: 2 },
    broadcastRevenue: 250000,
  },
  {
    id: 'baystars',
    name: 'DeNA',
    shortName: 'De',
    league: 'central',
    homeStadium: '横浜スタジアム',
    ai: { budgetMode: 0.7, draftFocus: 0.4, winNowMode: 0.7, teamType: 'hitting', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, stadium: 3, training: 2 },
    broadcastRevenue: 300000,
  },
  {
    id: 'swallows',
    name: 'ヤクルト',
    shortName: 'ヤ',
    league: 'central',
    homeStadium: '神宮球場',
    ai: { budgetMode: 0.5, draftFocus: 0.5, winNowMode: 0.5, teamType: 'balanced', mode: 'contender' },
    initialFacilities: { ...defaultFacilities },
    broadcastRevenue: 250000,
  },
  // パ・リーグ
  {
    id: 'hawks',
    name: 'ソフトバンク',
    shortName: 'ソ',
    league: 'pacific',
    homeStadium: 'PayPayドーム',
    ai: { budgetMode: 1.0, draftFocus: 0.7, winNowMode: 0.8, teamType: 'moneyball', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, stadium: 5, training: 4, dormitory: 3 },
    broadcastRevenue: 400000,
  },
  {
    id: 'buffaloes',
    name: 'オリックス',
    shortName: 'オ',
    league: 'pacific',
    homeStadium: '京セラドーム',
    ai: { budgetMode: 0.5, draftFocus: 0.8, winNowMode: 0.4, teamType: 'pitching', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, bullpen: 3 },
    broadcastRevenue: 250000,
  },
  {
    id: 'marines',
    name: 'ロッテ',
    shortName: 'ロ',
    league: 'pacific',
    homeStadium: 'ZOZOマリンスタジアム',
    ai: { budgetMode: 0.5, draftFocus: 0.5, winNowMode: 0.5, teamType: 'balanced', mode: 'contender' },
    initialFacilities: { ...defaultFacilities },
    broadcastRevenue: 200000,
  },
  {
    id: 'eagles',
    name: '楽天',
    shortName: '楽',
    league: 'pacific',
    homeStadium: '楽天モバイルパーク',
    ai: { budgetMode: 0.6, draftFocus: 0.4, winNowMode: 0.7, teamType: 'hitting', mode: 'contender' },
    initialFacilities: { ...defaultFacilities, stadium: 3, training: 2 },
    broadcastRevenue: 250000,
  },
  {
    id: 'lions',
    name: '西武',
    shortName: '西',
    league: 'pacific',
    homeStadium: 'ベルーナドーム',
    ai: { budgetMode: 0.4, draftFocus: 0.9, winNowMode: 0.3, teamType: 'development', mode: 'rebuilding' },
    initialFacilities: { ...defaultFacilities, dormitory: 2, scoutBase: 2 },
    broadcastRevenue: 200000,
  },
  {
    id: 'fighters',
    name: '日本ハム',
    shortName: '日',
    league: 'pacific',
    homeStadium: 'エスコンフィールド',
    ai: { budgetMode: 0.3, draftFocus: 0.9, winNowMode: 0.2, teamType: 'rebuilding', mode: 'rebuilding' },
    initialFacilities: { ...defaultFacilities, stadium: 5, dormitory: 2 },
    broadcastRevenue: 200000,
  },
];
