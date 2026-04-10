import type { Team } from '@/types/team';
import type { Player } from '@/types/player';
import type { GameEvent } from '@/types/game';

interface Props {
  team: Team;
  players: Player[];
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
function getSecretaryMessage(team: Team, players: Player[], cardNumber: number, totalCards: number): string {
  if (cardNumber >= totalCards && totalCards > 0) {
    return 'シーズンが終了しました。オフシーズンの処理を行いましょう。';
  }

  const teamPlayers = players.filter((p) => team.playerIds.includes(p.id));
  const firstTeamPlayers = teamPlayers.filter((p) => p.isFirstTeam);

  const messages: string[] = [];

  // Injury count warning
  const injuredCount = firstTeamPlayers.filter((p) => p.injury.isInjured).length;
  if (injuredCount >= 3) {
    messages.push(`一軍に${injuredCount}人の怪我人がいます。編成の見直しが必要かもしれません。`);
  } else if (injuredCount > 0) {
    messages.push(`怪我人が${injuredCount}人います。早期復帰を祈りましょう。`);
  }

  // Hot players
  const hotPlayers = firstTeamPlayers.filter((p) => p.condition === 'excellent');
  if (hotPlayers.length > 0) {
    const name = hotPlayers[Math.floor(Math.random() * hotPlayers.length)].name;
    messages.push(`${name}が絶好調です！この勢いに期待しましょう！`);
  }

  // Cold players
  const coldPlayers = firstTeamPlayers.filter((p) => p.condition === 'terrible');
  if (coldPlayers.length > 0) {
    const name = coldPlayers[Math.floor(Math.random() * coldPlayers.length)].name;
    messages.push(`${name}が絶不調です...調子が戻るまで辛抱が必要ですね。`);
  }

  // Win streak detection
  const record = team.record;
  const totalGames = record.wins + record.losses;
  if (totalGames > 0) {
    const winRate = record.wins / totalGames;
    if (winRate >= 0.65) {
      messages.push('チームは絶好調ですね！このまま優勝を目指しましょう！');
    } else if (winRate < 0.35) {
      messages.push('厳しい状況ですが、若手の成長に期待しましょう。');
    }
  }

  // Season progress reminders
  if (totalCards > 0) {
    const progress = cardNumber / totalCards;
    if (progress < 0.05) {
      messages.push('いよいよシーズン開幕です！頑張りましょう！');
    } else if (progress >= 0.45 && progress < 0.55) {
      messages.push('シーズンも折り返しです。後半戦に向けて戦力を整えましょう！');
    } else if (progress >= 0.85) {
      messages.push('シーズン終盤です。最後まで気を抜かずに行きましょう！');
    }
  }

  // Fallback messages
  if (messages.length === 0) {
    const record = team.record;
    const totalGames = record.wins + record.losses;
    if (totalGames === 0) {
      messages.push('いよいよシーズン開幕です！頑張りましょう！');
    } else {
      const winRate = record.wins / totalGames;
      if (winRate >= 0.6) messages.push('順調に勝ち星を重ねています。もう一段ギアを上げましょう！');
      else if (winRate >= 0.5) messages.push('五分の戦いを続けています。ここから抜け出しましょう！');
      else if (winRate >= 0.4) messages.push('少し苦しい展開ですが、まだまだ巻き返せます！');
      else messages.push('厳しい状況ですが、若手の成長に期待しましょう。');
    }
  }

  // Pick randomly from applicable messages
  return messages[Math.floor(Math.random() * messages.length)];
}

/** ホーム画面 */
export function HomeScreen({
  team,
  players,
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
          <p className="text-sm text-gray-300">{getSecretaryMessage(team, players, cardNumber, totalCards)}</p>
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
