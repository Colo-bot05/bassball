import type { Team } from '@/types/team';
import type { GameEvent } from '@/types/game';

interface Props {
  team: Team;
  gmName: string;
  year: number;
  cardNumber: number;
  totalCards: number;
  events: GameEvent[];
  onNavigate: (screen: string) => void;
  onAdvanceCard: () => void;
  onAdvanceMonth: () => void;
  isSeasonOver: boolean;
  onProcessOffseason: () => void;
  postseasonDone?: boolean;
}

/** 秘書のセリフを生成 */
function getSecretaryMessage(team: Team, isSeasonOver: boolean): string {
  if (isSeasonOver) return 'シーズンが終了しました。オフシーズンの処理を行いましょう。';

  const record = team.record;
  const totalGames = record.wins + record.losses;
  if (totalGames === 0) return 'いよいよシーズン開幕です！頑張りましょう！';

  const winRate = record.wins / totalGames;
  if (winRate >= 0.6) return 'チームは絶好調ですね！このまま優勝を目指しましょう！';
  if (winRate >= 0.5) return '順調に勝ち星を重ねています。もう一段ギアを上げましょう！';
  if (winRate >= 0.4) return '少し苦しい展開ですが、まだまだ巻き返せます！';
  return '厳しい状況ですが、若手の成長に期待しましょう。';
}

/** ホーム画面 */
export function HomeScreen({
  team,
  gmName,
  year,
  cardNumber,
  totalCards,
  events,
  onNavigate,
  onAdvanceCard,
  onAdvanceMonth,
  isSeasonOver,
  onProcessOffseason,
  postseasonDone,
}: Props) {
  const unreadCount = events.filter((e) => !e.isRead).length;
  const progress = totalCards > 0 ? Math.round((cardNumber / totalCards) * 100) : 0;

  const menuItems = [
    { id: 'roster', label: '編成', icon: '👥' },
    { id: 'scout', label: 'スカウト', icon: '🔍' },
    { id: 'management', label: '球団管理', icon: '🏢' },
    { id: 'standings', label: '順位表', icon: '📊' },
    { id: 'settings', label: '設定', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{team.name}</h1>
            <p className="text-xs text-gray-400">GM {gmName} ・ {year}年</p>
          </div>
          <div className="text-right">
            <p className="text-sm">{team.record.wins}勝 {team.record.losses}敗 {team.record.draws}分</p>
            <p className="text-xs text-gray-400">カード {cardNumber}/{totalCards} ({progress}%)</p>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* 秘書メッセージ */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-300">{getSecretaryMessage(team, isSeasonOver)}</p>
        </div>

        {/* 通知バッジ */}
        {unreadCount > 0 && (
          <button
            onClick={() => onNavigate('events')}
            className="w-full bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-3 mb-4 text-left"
          >
            <span className="text-yellow-400 text-sm font-medium">
              {unreadCount}件の新着通知があります
            </span>
          </button>
        )}

        {/* 試合進行ボタン */}
        <div className="flex gap-2 mb-6">
          {!isSeasonOver ? (
            <>
              <button
                onClick={onAdvanceCard}
                className="flex-1 bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition"
              >
                進む
              </button>
              <button
                onClick={onAdvanceMonth}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-4 rounded-lg text-sm transition"
              >
                月送り
              </button>
            </>
          ) : (
            <button
              onClick={onProcessOffseason}
              className="flex-1 bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition"
            >
              {postseasonDone ? 'オフシーズンへ' : 'CS・日本シリーズへ'}
            </button>
          )}
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition"
            >
              <span className="text-2xl block mb-1">{item.icon}</span>
              <span className="text-xs text-gray-300">{item.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
