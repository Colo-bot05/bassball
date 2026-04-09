# ClaudeCode指示書：やきゅつく令和版（GitHub運用版）

---

## あなたへの依頼

プロ野球球団経営シミュレーションゲーム「やきゅつく令和版」を開発してください。
すべての開発作業はGitHub上で管理します。ローカルでnpmビルドやnpm run devは使いません。

仕様は以下の2つのドキュメントに記載されています。

1. **元の仕様書**（この指示書の末尾に貼り付け）
2. **完全仕様書（補足版）**（この指示書の末尾に貼り付け）

補足版が元の仕様書より優先されます。矛盾がある場合は補足版に従ってください。

---

## 技術スタック（確定）

```
フレームワーク  ： React + TypeScript
ビルドツール   ： Vite
UIライブラリ   ： Tailwind CSS + shadcn/ui
データ保存     ： IndexedDB（Dexie.js）+ JSONエクスポート/インポート
乱数管理       ： seedrandom.js
ホスティング   ： Azure Static Web Apps（Free プラン）
リポジトリ     ： https://github.com/Colo-bot05/bassball
```

---

## 最重要ルール：ローカルビルド禁止

```
■ ローカルでは以下を実行しないこと
  - npm run dev
  - npm run build
  - npm start
  - その他ローカルサーバー起動系コマンド

■ ビルドとデプロイはすべてGitHub Actionsが自動で行う
  - PRを出す → CIが型チェック＋ビルド確認を自動実行
  - mainにmerge → Azure Static Web Appsに自動デプロイ

■ ローカルで行うこと
  - git操作（clone, branch, commit, push）
  - npm install（依存関係のインストールのみ。package.jsonやpackage-lock.json更新のため）
  - コードの作成・編集
  - ghコマンド（GitHub CLI）でのIssue・PR操作
```

---

## GitHub運用ルール

### リポジトリ

```
URL: https://github.com/Colo-bot05/bassball
```

### ブランチ戦略（GitHub Flow ベース）

```
main              ： 本番ブランチ。常に動く状態を維持。直接pushしない。
  └─ develop      ： 開発ブランチ。各フェーズの成果をここに集約。
      └─ feature/* ： 機能ブランチ。1Issue＝1ブランチ。

■ ブランチ名の命名規則
  feature/phase{N}-{Issue番号}-{短い説明}
  例：
    feature/phase0-setup-repo
    feature/phase1-01-vite-init
    feature/phase1-02-tailwind-setup
    feature/phase1-03-player-types
    feature/phase2-10-at-bat-logic
    fix/{Issue番号}-{説明}       ← バグ修正用
    hotfix/{説明}               ← 緊急修正用

■ 1ブランチ＝1Issue＝小さめの単位で切る
  NG：feature/phase1（フェーズ全体を1ブランチ）← 大きすぎ
  OK：feature/phase1-03-player-types（型定義だけ）← これくらいが理想
```

### プルリクエスト（PR）ルール

```
■ すべての変更はPR経由でmergeする（直接pushしない）

■ PRの作成手順
  1. feature/* ブランチで作業
  2. 作業完了後、develop ブランチ向けにPRを作成
  3. PRのタイトル：「[Phase1] #3 選手データの型定義を作成」のように、フェーズ番号＋Issue番号＋内容
  4. PRの本文に「Closes #番号」を含めること（merge時にIssueが自動クローズされる）

■ PRテンプレート（.github/pull_request_template.md として作成）

  ## 概要
  <!-- 何を変更したか -->

  ## 関連Issue
  <!-- Closes #番号 -->

  ## 変更内容
  - [ ] 変更点1
  - [ ] 変更点2

  ## テスト方法
  <!-- CIが通ることを確認。手動確認が必要なら手順を書く -->

■ develop → main へのPR
  各フェーズの完了時に、develop → main へPRを作成してmerge。
  タイトル例：「[Release] Phase1 完了：プロジェクト基盤＋データ構造」
  → mergeされると自動でAzureにデプロイされる
```

### Issue管理

```
■ 1Issue＝1つの小さなタスク
  大きなタスクは分割する。目安：1 Issueが1〜3ファイルの変更で完結する粒度

■ Issueの作り方
  - タイトル：「[Phase1] CSVからの選手データ変換機能を作る」
  - ラベル：phase0〜phase6, bug, enhancement, documentation
  - マイルストーン：Phase0〜Phase6

■ Issueの依存関係
  本文に「Depends on #番号」と書いて依存を明示
  → 依存先がmergeされてから着手する
```

### ラベル設定（フェーズ0で作成）

```
phase0     : ⚙️ Phase0：初期セットアップ
phase1     : 🟢 Phase1：基盤＋データ構造
phase2     : 🔵 Phase2：試合シミュレーション
phase3     : 🟡 Phase3：成長・調子・怪我・覚醒
phase4     : 🟠 Phase4：オフシーズン処理
phase5     : 🔴 Phase5：他球団AI
phase6     : 🟣 Phase6：UI統合
bug        : 🐛 バグ
enhancement: ✨ 機能追加
documentation: 📝 ドキュメント
ci-cd      : 🔧 CI/CD関連
```

---

## GitHub Actions（CI/CD）

### CI：PRごとの自動チェック

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: TypeScript型チェック
        run: npx tsc --noEmit

      - name: Lint（ESLint）
        run: npx eslint src/ --ext .ts,.tsx

      - name: ビルド確認
        run: npm run build
```

効果：
- PRを出すたびに自動で「コンパイルエラーがないか」「ビルドが通るか」チェック
- 失敗したらPRにバツ印がつく → merge前に気づける

### CD：Azure自動デプロイ

```
Azure Static Web Appsのセットアップ時に、Azureが自動的に
.github/workflows/azure-static-web-apps-*.yml を生成する。

→ main にmergeされると自動でAzureにデプロイされる
→ PRごとにプレビュー環境（ステージング）も自動生成される

■ Azure Static Web Appsの設定値（workflows内で使う）
  app_location: "/"
  output_location: "dist"
  api_location: ""
```

---

## Azure Static Web Apps セットアップ手順

### 全体像

```
あなたのPC                    GitHub                   Azure
  ↓                           ↓                        ↓
コードを書く → GitHubに上げる → 自動でAzureに公開される

つまり：
  1. コードを書く場所 = あなたのPC（ClaudeCodeで開発）
  2. コードを保管する場所 = GitHub
  3. アプリを公開する場所 = Azure Static Web Apps（無料プラン）
```

### STEP 0：Azureの無料サブスクリプションを作る（※まだ無い場合）

```
Azureにログインしても「サブスクリプション」が無いと何も作れない。
無料で作れるので、まず作る。

  1. https://azure.microsoft.com/ja-jp/free/ にアクセス
  2. 「無料で始める」をクリック
  3. Microsoftアカウントでサインイン
  4. クレジットカード情報を求められる ← 本人確認用。無料枠を超えない限り課金されない
     → Azure Static Web Appsの無料プランは月100GBの通信量まで完全無料
     → 個人利用のゲームなら100%超えない。安心してOK

  完了すると「Azure subscription 1」のようなサブスクリプションが自動で作られる。
  これで準備完了。
```

### STEP 1：Azure PortalでStatic Web Appsを作成する

```
  1. https://portal.azure.com にログイン

  2. 上部の検索バーに「Static Web Apps」と入力
     → 「静的 Web アプリ」が出てくるのでクリック

  3. 「＋作成」ボタンをクリック

  4. 「基本」タブで以下を入力：

     サブスクリプション    ： 表示されているもの（「Azure subscription 1」等）を選択
     リソースグループ      ： 「新規作成」→「yakutsuku-rg」と入力
     静的 Web アプリ名    ： yakutsuku-reiwa
     プランの種類          ： Free（無料）  ← ★必ずFreeを選ぶ★
     ソースのリージョン    ： East Asia（東アジア）

  5. デプロイの詳細：

     ソース              ： GitHub
     「GitHubアカウントでサインイン」をクリック → GitHub認証する

  6. GitHub認証後、以下が選べるようになる：

     組織                ： Colo-bot05
     リポジトリ           ： bassball
     ブランチ             ： main

  7. ビルドの詳細：

     ビルドのプリセット    ： React
     アプリの場所          ： /
     API の場所           ： （空欄のまま）
     出力先               ： dist

  8. 「確認および作成」をクリック → 内容を確認 → 「作成」をクリック

  ※ 画面にある「Marketplace」から探す場合：
     「static web app」で検索 → 一番左上の「静的 Web アプリ（Microsoft）」→
     「作成 ∨」のドロップダウンから「静的 Web アプリ」を選ぶ
```

### STEP 2：自動デプロイの確認

```
  作成が完了すると、Azureが自動的に：
    1. GitHubリポジトリに .github/workflows/azure-static-web-apps-*.yml を追加
       → PRとして自動でcommitされる
    2. コードをビルド
    3. ビルド結果をAzureにデプロイ（公開）

  → 数分待つとURLが発行される
  → 例：https://yakutsuku-reiwa-xxxxx.azurestaticapps.net

  → このURLにアクセスするとゲームが表示される
  → 以降はmainにmergeするだけで自動的にこのURLに反映される

  ■ 注意
    - Azure側が生成するworkflowファイルは手動で作成しない
    - Free プランの制限：月100GBの通信量（個人ゲームなら余裕）
    - カスタムドメインは後からでも設定可能
```

### Azureのトラブルシューティング

```
■ 「サブスクリプションが選べない」
  → STEP 0 をやっていない。Azure無料アカウントの作成が必要。

■ 「GitHubアカウントでサインイン」が出ない
  → デプロイの詳細の「ソース」を「GitHub」に変更する。

■ 「リポジトリが選べない」
  → GitHubのbassballリポジトリが空だと表示されないことがある。
  → Phase0でREADME.md等を先にpushしてからAzureセットアップを行う。

■ デプロイが失敗する（赤い×）
  → GitHub → リポジトリ → 「Actions」タブを確認
  → エラーメッセージをClaudeCodeに貼り付けて修正を依頼

■ URLにアクセスしても真っ白
  → ビルドの出力先が「dist」になっているか確認（Viteのデフォルトはdist）
```

---

## 開発の進め方

### 鉄則

```
1. 一度に全部作ろうとしない
2. 1Issue＝1ブランチ＝1PR
3. PRのCIが通ってからmerge
4. 各フェーズ完了時にdevelop → main へPR → Azureデプロイ
5. 次のフェーズに進む前に、デプロイされたアプリの動作確認をする
```

### 日常の開発フロー

```
1. 着手するIssueを選ぶ（例：#3 選手データの型定義）
2. developからブランチを切る
   git checkout develop
   git pull origin develop
   git checkout -b feature/phase1-03-player-types
3. コードを書く
4. commit → push
   git add .
   git commit -m "[Phase1] #3 選手データの型定義を作成"
   git push -u origin feature/phase1-03-player-types
5. GitHub上でdevelop向けにPRを作成
   gh pr create --base develop --title "[Phase1] #3 選手データの型定義を作成" --body "Closes #3"
6. CIが通ることを確認（GitHub上のPRページでチェック）
7. CIが通ったらmerge
   gh pr merge --squash
8. 次のIssueへ
```

### フェーズ完了時のフロー

```
1. develop → main へPRを作成
   gh pr create --base main --head develop --title "[Release] Phase1 完了"
2. CIが通ることを確認
3. merge → Azureに自動デプロイ
4. デプロイされたURLで動作確認
5. 次のフェーズへ
```

---

## フェーズ0：GitHub初期セットアップ

### ★★★ 重要：Azureの接続にはmainブランチにコードが必要 ★★★
```
Azureの Static Web Apps は「GitHubリポジトリのブランチ」を指定して接続する。
空のリポジトリにはブランチが存在しないため、Azure側で選択できない。

→ 必ず「STEP A：mainにpush」を先に完了してから「STEP B：Azure作成」を行うこと。
```

### STEP A：リポジトリ初期化＋mainにpush（ClaudeCodeで実行）

```
  1. リポジトリをclone
     git clone https://github.com/Colo-bot05/bassball.git
     cd bassball

  2. 最低限のファイルを作成してmainにpush（★Azureの前にやる★）
     - .gitignore（Node.js + Vite用）
     - README.md（プロジェクト概要）
     - .github/pull_request_template.md（PRテンプレート）
     - .github/workflows/ci.yml（CI設定）
     - eslint.config.js, .prettierrc（Lint設定）

     git add .
     git commit -m "[Phase0] リポジトリ初期化"
     git push -u origin main

  3. developブランチを作成してpush
     git checkout -b develop
     git push -u origin develop

  4. gh CLIでラベルを一括作成
     gh label create "phase0" --color "808080" --description "Phase0：初期セットアップ"
     gh label create "phase1" --color "00CC00" --description "Phase1：基盤＋データ構造"
     gh label create "phase2" --color "0066FF" --description "Phase2：試合シミュレーション"
     gh label create "phase3" --color "FFCC00" --description "Phase3：成長・調子・怪我・覚醒"
     gh label create "phase4" --color "FF8800" --description "Phase4：オフシーズン処理"
     gh label create "phase5" --color "FF0000" --description "Phase5：他球団AI"
     gh label create "phase6" --color "9900FF" --description "Phase6：UI統合"
     gh label create "ci-cd" --color "666666" --description "CI/CD関連"

  5. マイルストーンの作成
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase0" -f description="初期セットアップ"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase1" -f description="基盤＋データ構造"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase2" -f description="試合シミュレーション"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase3" -f description="成長・調子・怪我・覚醒"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase4" -f description="オフシーズン処理"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase5" -f description="他球団AI"
     gh api repos/Colo-bot05/bassball/milestones -f title="Phase6" -f description="UI統合"

  6. 全Issue（後述の一覧）を一括作成（gh issue create で1件ずつ）
```

### STEP B：Azure Static Web Apps作成（※宮本さんが手動で操作）

```
  ★ STEP Aが完了してmainブランチにコードがある状態で行うこと ★

  1. Azureの無料サブスクリプションが無い場合はまず作成
     → この指示書の「STEP 0：Azureの無料サブスクリプションを作る」を参照

  2. Azure PortalでStatic Web Appsを作成
     → この指示書の「STEP 1：Azure PortalでStatic Web Appsを作成する」を参照
     → 「ブランチ」の選択で「main」が出るようになっているはず

  3. Azureが自動生成するworkflowファイルのPRがGitHub上に出るのでmerge
     → Azureデプロイが動くようになる
```

### STEP C：フェーズ0の残りの作業（ClaudeCodeで実行）

```
  7. Vite + React + TypeScript プロジェクト初期化
     → Phase1のIssue #9 だが、CIを正常に動かすためにここでやってもOK
     → npm create vite@latest . -- --template react-ts
     → package.json が生成される → CIの npm ci が通るようになる
```

**フェーズ0の完了条件：**
- mainブランチにコードがpushされている
- developブランチが存在する
- 全Issueが作成されている
- ラベルとマイルストーンが設定されている
- GitHub ActionsのCIがリポジトリにある
- Azure Static Web Appsが作成され、workflowがリポジトリにある
- Azure上のURLにアクセスできる（Viteのデフォルト画面が表示される）

---

## Issue一覧（細分化版）

### Phase0：初期セットアップ（8件）

```
#1  [Phase0] リポジトリ初期化（.gitignore, README.md）
#2  [Phase0] developブランチ作成＋ブランチ保護ルール設定
#3  [Phase0] GitHub Labels＋Milestones作成
#4  [Phase0] PRテンプレート作成（.github/pull_request_template.md）
#5  [Phase0] GitHub Actions CI設定（ci.yml）
#6  [Phase0] ESLint + Prettier設定
#7  [Phase0] 全Issue一括作成（Phase1〜Phase6）
#8  [Phase0] Azure Static Web Apps作成＋workflowファイル追加
     → ★ #1〜#5がmergeされてリポジトリにコードがある状態で行う
     → Azure Portalでの手動操作が必要（指示書のSTEP 0〜2に従う）
     → Azureが自動生成するworkflowファイルのPRをmergeする
```

### Phase1：プロジェクト基盤＋データ構造（14件）

```
#9   [Phase1] Vite + React + TypeScript プロジェクト初期化
     → npm create vite@latest . -- --template react-ts して結果をcommit
     Depends on #1, #5, #6

#10  [Phase1] Tailwind CSS セットアップ
     → tailwind.config.ts, postcss.config.js, index.cssの設定
     Depends on #9

#11  [Phase1] shadcn/ui セットアップ
     → components.json, 共通コンポーネントの導入
     Depends on #10

#12  [Phase1] 型定義：Player（選手）の型を作成
     → src/types/player.ts
     → 打者/投手のstats, 球種, 成長タイプ, 特能, 覚醒ゲージ, 契約, 怪我 等
     Depends on #9

#13  [Phase1] 型定義：Team（球団）, TeamAI, Facilities, Finances
     → src/types/team.ts
     Depends on #12

#14  [Phase1] 型定義：GameState, GameDate, GameEvent, Records
     → src/types/game.ts, src/types/index.ts（re-export）
     Depends on #12, #13

#15  [Phase1] 型定義：SpecialAbility（特能）全種類の定義
     → src/types/specialAbility.ts
     → 固有特能・通常特能・覚醒特能の全リスト
     Depends on #12

#16  [Phase1] 定数ファイル：バランス数値（確率・補正値）
     → src/constants/balance.ts
     → 怪我確率, 成長曲線, 調子遷移確率, 覚醒確率 等
     Depends on #12

#17  [Phase1] 定数ファイル：球団AI初期値（12球団分）
     → src/constants/teams.ts
     → 巨人〜日本ハムのbudgetMode, draftFocus, winNowMode
     Depends on #13

#18  [Phase1] 定数ファイル：特能の効果定義
     → src/constants/abilities.ts
     Depends on #15

#19  [Phase1] seedrandom.js導入＋乱数ユーティリティ関数
     → src/utils/random.ts
     → random, randomFloat, randomChoice, randomWeighted
     Depends on #9

#20  [Phase1] CSV → Player変換機能
     → src/data/csvImporter.ts
     → CSVフォーマット定義, 成績→能力値の自動変換ロジック
     → テスト用CSVデータ（1球団12人分）
     Depends on #12, #16, #19

#21  [Phase1] セーブ/ロード基盤（IndexedDB + Dexie.js）
     → src/data/saveManager.ts
     → オートセーブ（スロット0）、手動セーブ（スロット1〜3）
     → JSONエクスポート/インポート機能
     Depends on #14

#22  [Phase1] 選手一覧表示画面（動作確認用の仮UI）
     → src/App.tsx を修正してCSVから生成した選手リストを表示
     → Phase1の完了確認用
     Depends on #20, #21
```

**Phase1の完了条件：**
- CIが全部通る（型チェック＋ビルド成功）
- Azureにデプロイして、ブラウザで選手一覧が表示される
- セーブ/ロード/エクスポート/インポートが動作する

### Phase2：試合シミュレーションエンジン（12件）

```
#23  [Phase2] 打席判定ロジック：打者総合力・投手総合力の計算
     → src/engine/simulation.ts（打席判定部分）
     → 仕様書G-2〜G-4に従う
     Depends on #16, #19

#24  [Phase2] 打席判定ロジック：出塁判定（HR/二塁打/単打/四球/三塁打）
     → simulation.tsの出塁判定部分
     Depends on #23

#25  [Phase2] 打席判定ロジック：アウト判定（三振/ゴロ/フライ/エラー）
     → simulation.tsのアウト判定部分
     Depends on #23

#26  [Phase2] 投手スタミナ消耗ロジック
     → src/engine/simulation.ts（スタミナ部分）
     → 仕様書G-5に従う
     Depends on #23

#27  [Phase2] 継投判断ロジック（先発→中継ぎ→抑え）
     → src/engine/simulation.ts（継投部分）
     → 仕様書G-6に従う
     Depends on #26

#28  [Phase2] 代打・代走判断ロジック
     → src/engine/simulation.ts（代打代走部分）
     → 仕様書G-7に従う
     Depends on #23

#29  [Phase2] 盗塁判定ロジック
     → src/engine/simulation.ts（盗塁部分）
     → 仕様書G-8に従う
     Depends on #23

#30  [Phase2] 1試合シミュレーション統合（simulateGame関数）
     → 打席判定+スタミナ+継投+代打代走+盗塁をまとめる
     → GameResult型の返却
     → 延長12回、DH制の考慮
     Depends on #24, #25, #26, #27, #28, #29

#31  [Phase2] シーズン対戦カード生成（143試合分）
     → src/engine/season.ts
     → リーグ内125試合＋交流戦18試合のスケジュール生成
     Depends on #14

#32  [Phase2] 順位表計算ロジック
     → src/engine/season.ts（順位表部分）
     → 勝率、ゲーム差、同率時の順位決定
     Depends on #31

#33  [Phase2] 試合結果表示画面
     → src/components/game/GameResult.tsx
     → イニングスコア、勝利投手/敗戦投手/セーブ、ハイライトテキスト
     → 3試合分（1カード）まとめて表示
     → 仕様書O-3に従う
     Depends on #30

#34  [Phase2] シーズン進行UI（「進む」ボタン＋順位表表示）
     → 1カード分の試合を計算して結果を表示
     → 順位表の自動更新
     → 「一気に進む」ボタン（月単位・シーズン一括）
     Depends on #30, #31, #32, #33
```

**Phase2の完了条件：**
- CIが全部通る
- Azureにデプロイして「進む」ボタンで試合が進む
- 順位表が正しく更新される
- 1シーズンを最後まで回せる

### Phase3：成長・調子・怪我・覚醒システム（10件）

```
#35  [Phase3] 調子変動ロジック
     → src/engine/condition.ts
     → 毎カードごとの5段階調子遷移（仕様書F-6）
     → 直近成績補正、ムードメーカー補正、スランプ補正
     Depends on #16

#36  [Phase3] 成長処理：成長タイプ別の年間成長値計算
     → src/engine/growth.ts
     → 早熟/普通/晩成/不安定/晩年覚醒の成長曲線（仕様書P-1）
     Depends on #16

#37  [Phase3] 成長処理：キャンプ成長イベント＋施設レベル補正
     → src/engine/growth.ts（キャンプ部分）
     → 施設レベルによる成長速度ボーナス
     Depends on #36

#38  [Phase3] 怪我システム：発生判定＋怪我種類＋離脱期間
     → src/engine/injury.ts
     → 仕様書P-2に従う
     → ポジション補正、年齢補正、特能補正
     Depends on #16, #19

#39  [Phase3] 怪我システム：トミージョン手術
     → src/engine/injury.ts（トミージョン部分）
     → 成功/失敗判定、レジェンド補正
     Depends on #38

#40  [Phase3] 覚醒システム：覚醒ゲージ蓄積＋覚醒イベント発火
     → src/engine/growth.ts（覚醒部分）
     → 仕様書P-3に従う
     → ゲージ蓄積速度、覚醒発生確率、短期/中期/永続の分岐
     Depends on #16, #15

#41  [Phase3] 覚醒特能の付与ロジック
     → src/engine/growth.ts（覚醒特能部分）
     → 覚醒特能リストからの選択、期間管理
     Depends on #40, #18

#42  [Phase3] スランプシステム＋ピンチはチャンス連動
     → src/engine/condition.ts（スランプ部分）
     → 長期スランプの発生条件と効果
     → スランプ中の覚醒ゲージ蓄積
     Depends on #35, #40

#43  [Phase3] 衰えロジック（年齢による能力低下）
     → src/engine/growth.ts（衰え部分）
     → 成長タイプ別の衰え開始年齢と低下幅
     Depends on #36

#44  [Phase3] 引退判定＋転生プールへの追加
     → src/engine/growth.ts（引退部分）
     → src/engine/reincarnation.ts（転生プール管理）
     → 引退条件の判定、転生プールへの登録
     Depends on #43
```

### Phase4：オフシーズン処理（14件）

```
#45  [Phase4] 表彰式：タイトル判定ロジック
     → src/engine/awards.ts
     → 首位打者、HR王、最多勝、MVP、新人王、ベストナイン等（仕様書K-6）
     Depends on #14

#46  [Phase4] 殿堂入り判定
     → src/engine/awards.ts（殿堂部分）
     → 仕様書K-7の条件に従う
     Depends on #45

#47  [Phase4] FA宣言判定ロジック
     → src/engine/freeAgent.ts
     → FA権取得条件（国内8年/海外9年）、宣言判断
     → 仕様書I-1〜I-2
     Depends on #16

#48  [Phase4] FA交渉ロジック（残留率計算＋他球団競合）
     → src/engine/freeAgent.ts（交渉部分）
     → 仕様書I-3〜I-4、P-4
     Depends on #47

#49  [Phase4] 契約更改・年俸交渉ロジック
     → src/engine/contract.ts
     → 年俸提示、約束、不成立時の効果
     Depends on #14

#50  [Phase4] トレードロジック（AI判断＋成立条件）
     → src/engine/trade.ts
     → 仕様書J-1〜J-5
     → 球団タイプ別の判断補正
     Depends on #17

#51  [Phase4] 外国人スカウト結果処理
     → src/engine/overseas.ts（スカウト結果部分）
     → 地域別の候補者生成
     Depends on #19, #20

#52  [Phase4] 戦力外通告・引退処理
     → src/engine/roster.ts
     → 戦力外の判断基準、引退→転生プール追加
     Depends on #44

#53  [Phase4] ドラフト候補生成（架空選手＋転生枠）
     → src/engine/draft.ts
     → 毎年80〜120人、高校/大学/社会人比率
     → 転生枠3〜7人の混入（仕様書L-4）
     → 当たり年判定（仕様書H-2）
     Depends on #19, #44

#54  [Phase4] ドラフト会議ロジック（くじ引き＋育成ドラフト）
     → src/engine/draft.ts（会議部分）
     → 1巡目重複指名→抽選、外れ1位、育成ドラフト
     → 仕様書H-3〜H-6
     Depends on #53

#55  [Phase4] 架空選手の名前自動生成
     → src/data/nameGenerator.ts
     → 姓200種×名200種のランダム組み合わせ
     → 同姓同名チェック
     Depends on #19

#56  [Phase4] 海外移籍・帰国システム
     → src/engine/overseas.ts（海外移籍部分）
     → 仕様書I-6（海外での成績判定、帰国判定、海外引退判定）
     Depends on #16, #19

#57  [Phase4] 財務処理（収支計算）＋施設投資
     → src/engine/finances.ts
     → 仕様書D-2〜D-6、E-1〜E-2
     → 収入（チケット/放映権/グッズ/スポンサー）、支出（年俸/スタッフ/施設維持）
     → 赤字3年連続ペナルティ
     Depends on #14

#58  [Phase4] オフシーズン統合処理（①〜⑩の順序実行）
     → src/engine/offseason.ts
     → 仕様書A-7の順序で全処理を呼び出し
     Depends on #45〜#57の全部
```

### Phase5：他球団AI（6件）

```
#59  [Phase5] 球団AI：性格パラメータ＋状態管理
     → src/engine/teamAI.ts
     → budgetMode, draftFocus, winNowMode
     → contender⇔rebuilding切り替え
     Depends on #17

#60  [Phase5] AIドラフト判断ロジック
     → src/engine/teamAI.ts（ドラフト部分）
     → 弱点補強＋方針に基づく指名
     Depends on #59, #54

#61  [Phase5] AI FA行動ロジック
     → src/engine/teamAI.ts（FA部分）
     → 金満→全力、育成→スルー
     Depends on #59, #48

#62  [Phase5] AIトレード判断ロジック
     → src/engine/teamAI.ts（トレード部分）
     → ポジション不足優先、球団タイプ補正
     Depends on #59, #50

#63  [Phase5] AIの起用ロジック（スタメン・ローテ・継投方針）
     → src/engine/teamAI.ts（起用部分）
     → 育成型→若手、勝利型→ベテラン
     Depends on #59

#64  [Phase5] 黄金期システム
     → src/engine/teamAI.ts（黄金期部分）
     → 仕様書P-5
     → 発動条件、バフ内容、期間管理
     Depends on #59
```

### Phase6：UI統合（12件）

```
#65  [Phase6] タイトル画面（ニューゲーム/ロード/インポート）
     → src/components/title/TitleScreen.tsx
     → 球団選択画面、GM名入力、難易度選択
     → 仕様書N-1
     Depends on #21

#66  [Phase6] ホーム画面（オフィス＋秘書）
     → src/components/home/HomeScreen.tsx
     → 秘書のセリフ、通知バッジ、メニューナビゲーション
     → 仕様書O-1
     Depends on #14

#67  [Phase6] 編成画面：オーダー設定＋ローテーション設定
     → src/components/roster/RosterScreen.tsx
     → 打順、守備位置、DH、先発ローテ、中継ぎ・抑え設定
     → 仕様書O-4
     Depends on #14

#68  [Phase6] 編成画面：一軍⇔二軍入れ替え＋選手詳細
     → src/components/roster/PlayerDetail.tsx
     → src/components/roster/SwapScreen.tsx
     → 二軍成績表示、コーチコメント
     Depends on #67

#69  [Phase6] スカウト画面（国内＋海外）
     → src/components/scout/ScoutScreen.tsx
     → 候補者一覧、スカウトコメント、海外派遣
     → 仕様書O-5
     Depends on #53

#70  [Phase6] 球団管理センター：記録室
     → src/components/management/RecordScreen.tsx
     → 個人成績、通算記録、殿堂、球団の歴史
     → 仕様書K-1〜K-8
     Depends on #45

#71  [Phase6] 球団管理センター：施設投資画面
     → src/components/management/FacilityScreen.tsx
     → 施設一覧、レベル、投資ボタン、コスト表示
     Depends on #57

#72  [Phase6] 球団管理センター：分析＋財務画面
     → src/components/management/AnalysisScreen.tsx
     → チーム戦力グラフ、順位推移、収支サマリー
     Depends on #57

#73  [Phase6] オフシーズン各画面（表彰/FA/契約更改/トレード/ドラフト）
     → src/components/offseason/*.tsx
     → 各フェーズの操作UI
     Depends on #58

#74  [Phase6] 通知・イベントシステム
     → src/components/common/NotificationSystem.tsx
     → 通知バッジ、一覧表示、最新20件保持
     → 仕様書O-2
     Depends on #66

#75  [Phase6] レスポンシブ対応（スマホメイン）
     → 全画面のモバイル最適化
     → タップ操作に最適化したUIサイズ
     Depends on #65〜#74の全部

#76  [Phase6] OBデータベース（500人分）
     → src/data/obDatabase.ts
     → レジェンド100人、黄金期150人、近代150人、名脇役100人
     → 仕様書L-3の構造に従う
     Depends on #44
```

---

## フォルダ構成

```
bassball/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # CI（型チェック+ビルド）
│   │   └── azure-static-web-apps-*.yml  # Azure自動デプロイ（自動生成）
│   └── pull_request_template.md      # PRテンプレート
├── public/
├── src/
│   ├── components/        # UI部品
│   │   ├── title/         # タイトル画面
│   │   ├── home/          # ホーム画面
│   │   ├── roster/        # 編成画面
│   │   ├── scout/         # スカウト画面
│   │   ├── game/          # 試合結果画面
│   │   ├── management/    # 球団管理センター
│   │   ├── offseason/     # オフシーズン各画面
│   │   └── common/        # 共通UI部品（通知等）
│   ├── engine/            # ゲームロジック（UIに依存しない）
│   │   ├── simulation.ts  # 試合シミュレーション
│   │   ├── season.ts      # シーズン進行管理
│   │   ├── growth.ts      # 成長・衰え・覚醒
│   │   ├── condition.ts   # 調子変動・スランプ
│   │   ├── injury.ts      # 怪我・トミージョン
│   │   ├── draft.ts       # ドラフト
│   │   ├── freeAgent.ts   # FA
│   │   ├── contract.ts    # 契約更改
│   │   ├── trade.ts       # トレード
│   │   ├── overseas.ts    # 海外移籍・帰国・外国人スカウト
│   │   ├── teamAI.ts      # 他球団AI
│   │   ├── reincarnation.ts # 転生システム
│   │   ├── awards.ts      # 表彰・殿堂
│   │   ├── finances.ts    # 財務・施設
│   │   ├── roster.ts      # ロースター管理・戦力外
│   │   └── offseason.ts   # オフシーズン統合処理
│   ├── data/              # データ管理
│   │   ├── csvImporter.ts # CSV→Player変換
│   │   ├── initialTeams.ts# 12球団の初期設定
│   │   ├── obDatabase.ts  # OB500人のデータ
│   │   ├── nameGenerator.ts # 架空選手の名前生成
│   │   └── saveManager.ts # セーブ/ロード/エクスポート
│   ├── types/             # 型定義
│   │   ├── player.ts
│   │   ├── team.ts
│   │   ├── game.ts
│   │   ├── specialAbility.ts
│   │   └── index.ts
│   ├── constants/         # 定数・バランス数値
│   │   ├── balance.ts     # 確率・補正値など
│   │   ├── teams.ts       # 球団AI初期値
│   │   └── abilities.ts   # 特能の定義
│   ├── utils/             # ユーティリティ
│   │   └── random.ts      # シード付き乱数
│   ├── App.tsx
│   └── main.tsx
├── data/                  # 初期データCSV
│   └── players_2025.csv
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── eslint.config.js
└── .prettierrc
```

---

## コーディングルール

```
1. TypeScriptのstrictモードを有効にすること
2. 型定義は /src/types/ にまとめること
3. ゲームロジック（シミュレーション等）は /src/engine/ に分離すること
   → UIに依存しない純粋な関数として書く
4. UI部品は /src/components/ に配置すること
5. データ管理は /src/data/ に配置すること
6. 各関数にはJSDocコメントで説明を書くこと（日本語OK）
7. マジックナンバーは定数として /src/constants/ に定義すること
   （例：MAX_ROSTER_SIZE = 70, INJURY_BASE_RATE = 0.005）
8. 仕様書に記載された確率や数値は、定数ファイルに集約して
   後からバランス調整しやすくすること
9. ESLintとPrettierの設定に従うこと
10. commitメッセージは「[PhaseN] #Issue番号 やったこと」形式
```

---

## 仕様書に明記されていないが必要な補足事項

### 補足1：二刀流の扱い

```
初期データに大谷翔平のような二刀流選手が含まれる。
以下のルールで処理する：

- 二刀流選手は打者パラメータと投手パラメータの両方を持つ
- 「二刀流」は固有特能として実装
- 先発登板日は投手として出場し、打順にも入る（DH解除相当）
- 非登板日は野手（DH or 外野）として出場可能
- 怪我リスクは投手と野手の両方の判定を受ける（リスク高め）
- 成長は投打それぞれ独立して計算（成長速度は通常の80%ずつ）
- 転生時に「二刀流」特能がつく確率は5%（超レア）
```

### 補足2：ドラフト候補のうち転生でない選手の名前生成

```
毎年80〜120人のドラフト候補のうち、転生枠（3〜7人）以外は架空選手。
架空選手の名前は自動生成する：

- 姓リスト：200種類（佐藤、田中、鈴木、高橋…等の日本人姓）
- 名リスト：200種類（翔太、大輝、蓮、悠真…等の日本人名）
- 組み合わせてランダム生成
- 現役選手と同姓同名にならないようチェック
```

### 補足3：バッテリー相性の計算

```
元の仕様書に「投手×捕手で相性あり」「継続起用で強化」「S〜Dランク」とある。
以下のロジックで実装する：

- 各投手×捕手のペアに相性値（0〜100）を持たせる
- 初期値：ランダム（30〜70）
- 一緒に出場した試合ごとに+2ずつ上昇（上限100）
- 相性値 → ランク変換：
    S: 90〜100（投球力に+5%補正）
    A: 75〜89（+3%）
    B: 50〜74（補正なし）
    C: 30〜49（-3%）
    D:  0〜29（-5%）
- 捕手が変わるとゼロからやり直し
```

---

## 最重要：ゲームデザイン思想（常に意識すること）

```
■ めんどくさくない
  → 操作は意思決定のみ。細かい管理作業はAI自動。

■ 簡単じゃない
  → プレイヤーを弱体化するのではなく、ライバルを強くする。

■ ストレスフリー
  → ネガティブイベント（怪我・スランプ・FA流出）は
    必ず別のポジティブなリターンへの布石にする。
    覚醒ゲージ、若手ブースト、転生システムがそれを担う。
```

---

## この指示書の使い方

```
1. この指示書全文をClaudeCode（デスクトップアプリ）に渡す
2. 「フェーズ0から始めてください」と伝える
3. ClaudeCodeがIssue作成、ブランチ作成、CI設定を自動で行う
4. フェーズ1以降は Issue→ブランチ→コード→PR→CIチェック→merge の流れ
5. 各フェーズ完了時にdevelop→mainへPR→Azureデプロイ→動作確認

■ Azure Static Web Appsの作成だけは手動
  Azure Portalでの操作が必要（この指示書内の手順に従う）
  それ以外はすべてClaudeCodeに任せてOK
```

---

## 末尾に貼り付けるもの（この下に仕様書を貼る）

この指示書を渡す際に、以下の2つのドキュメントの全文を末尾に貼り付けてください：

1. 元の仕様書（「やきゅつく令和版 開発仕様書」全文）
   → ClaudeCode指示書_完全版.md の「【仕様書1】」部分
2. 完全仕様書（補足版）（「やきゅつく令和版_完全仕様書_補足.md」の全文）
   → ClaudeCode指示書_完全版.md の「【仕様書2】」部分
