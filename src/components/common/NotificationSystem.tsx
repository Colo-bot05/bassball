import type { GameEvent } from '@/types/game';

interface Props {
  events: GameEvent[];
  onMarkRead: (id: string) => void;
  onBack: () => void;
}

/** 通知・イベントシステム */
export function NotificationSystem({ events, onMarkRead, onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">通知</h2>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">
            戻る
          </button>
        </div>

        {events.length === 0 ? (
          <p className="text-gray-500 text-center py-8">通知はありません</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => onMarkRead(event.id)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  event.isRead ? 'bg-gray-800/50' : 'bg-gray-800 border-l-4 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${event.isRead ? 'text-gray-400' : 'text-white'}`}>
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{event.message}</p>
                  </div>
                  {!event.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
