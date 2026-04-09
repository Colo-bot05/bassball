# やきゅつく令和版

プロ野球球団経営シミュレーションゲーム

## 技術スタック

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- IndexedDB (Dexie.js)
- Azure Static Web Apps

## デプロイURL

https://gray-water-08278fc10.1.azurestaticapps.net

## 開発

```bash
git clone https://github.com/Colo-bot05/bassball.git
cd bassball
npm install
```

すべての変更はPR経由でmergeします。直接pushは禁止です。

## ブランチ戦略

- `main` - 本番ブランチ（Azure自動デプロイ）
- `develop` - 開発ブランチ
- `feature/*` - 機能ブランチ
