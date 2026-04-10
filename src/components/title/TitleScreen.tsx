import { useState } from 'react';
import { TEAM_PRESETS } from '@/constants/teams';

interface Props {
  onNewGame: (teamId: string, gmName: string, difficulty: 'easy' | 'normal' | 'hard') => void;
  onLoad: () => void;
  onImport: () => void;
  hasSaveData: boolean;
}

/** タイトル画面 */
export function TitleScreen({ onNewGame, onLoad, onImport, hasSaveData }: Props) {
  const [step, setStep] = useState<'title' | 'teamSelect' | 'gmName'>('title');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [gmName, setGmName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  const handleStartGame = () => {
    if (selectedTeamId && gmName.trim()) {
      onNewGame(selectedTeamId, gmName.trim(), difficulty);
    }
  };

  if (step === 'title') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-bold mb-2">やきゅつく</h1>
        <p className="text-xl text-gray-400 mb-12">令和版</p>
        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={() => setStep('teamSelect')}
            className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold text-lg transition"
          >
            ニューゲーム
          </button>
          {hasSaveData && (
            <button
              onClick={onLoad}
              className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition"
            >
              つづきから
            </button>
          )}
          <button
            onClick={onImport}
            className="bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm text-gray-400 transition"
          >
            セーブデータを読み込む
          </button>
        </div>
        <p className="mt-12 text-xs text-gray-600">プロ野球球団経営シミュレーション</p>
      </div>
    );
  }

  if (step === 'teamSelect') {
    const centralTeams = TEAM_PRESETS.filter((t) => t.league === 'central');
    const pacificTeams = TEAM_PRESETS.filter((t) => t.league === 'pacific');

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">球団を選択</h2>

          <h3 className="text-sm text-gray-400 mb-2">セ・リーグ</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {centralTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`p-3 rounded-lg text-center text-sm font-medium transition ${
                  selectedTeamId === t.id
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <h3 className="text-sm text-gray-400 mb-2">パ・リーグ</h3>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {pacificTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`p-3 rounded-lg text-center text-sm font-medium transition ${
                  selectedTeamId === t.id
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('title')}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg transition"
            >
              戻る
            </button>
            <button
              onClick={() => selectedTeamId && setStep('gmName')}
              disabled={!selectedTeamId}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-bold transition"
            >
              決定
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto mt-12">
        <h2 className="text-2xl font-bold text-center mb-8">GM情報</h2>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">GM名</label>
          <input
            type="text"
            value={gmName}
            onChange={(e) => setGmName(e.target.value)}
            placeholder="名前を入力"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-2">難易度</label>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`py-2 rounded-lg text-sm font-medium transition ${
                  difficulty === d
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {d === 'easy' ? 'やさしい' : d === 'normal' ? 'ふつう' : 'きびしい'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStep('teamSelect')}
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg transition"
          >
            戻る
          </button>
          <button
            onClick={handleStartGame}
            disabled={!gmName.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-bold transition"
          >
            ゲーム開始
          </button>
        </div>
      </div>
    </div>
  );
}
