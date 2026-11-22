---
name: kohitosagasi-workflow
description: kohitosagasi リポジトリの Issue 実装、PR 提出、レビュー修正、引き継ぎに使う。毎回本流の AGENTS.md と docs/WORKFLOW.md を読み、ドラフト PR、検査、CI、PR 報告、Ready for review まで進める。
---

# こひとさがしの共同開発手順

対象は `takahashitakashi110-debug/kohitosagasi`。このリポジトリで実装・レビュー対応・作業再開をするときに使う。
このスキルは `docs/WORKFLOW.md` v0.1 をもとに保存した入口であり、最新ルールの正本はリポジトリの文書とする。

## 始める前に

1. `git status --short --branch` と `git remote -v` で対象・未コミット変更を確認し、`git fetch origin` を実行する。
2. 作業ブランチにルールがまだ無い場合も、本流から直接読む。
   ```sh
   git show origin/claude/confident-gauss-tbl22i:AGENTS.md
   git show origin/claude/confident-gauss-tbl22i:docs/WORKFLOW.md
   git show origin/claude/confident-gauss-tbl22i:docs/HANDOVER.md
   ```
   本流は現在 `claude/confident-gauss-tbl22i`。改名されたら更新後のルールに従う。
3. 担当 Issue とリンク先の `docs/REQUEST_*.md`、既存 PR とレビューを読む。
   ファイルを直接指定された場合は対応する Issue を検索し、同じ依頼を確認する。識別できない場合は対象を確認する。
   Issue と依頼書が食い違ったらファイル側を正とし、固定版指定と、持ち主による追加依頼・許可を確認する。
4. 各自の接続済み GitHub アカウントを使う。認証情報を取得・共有しない。

## 実装から提出まで

1. 新規作業では最新の本流から `codex/<Issue番号>-<短い英語名>` ブランチを作る。
   再開・レビュー修正では依頼に対応する既存ブランチと PR を使い、追加コミットで対応する。
2. 着手したらすぐ本流向けのドラフト PR を作り、説明の1行目に `closes #<Issue番号>` を記す。
   既存 PR があれば説明・状態を確認して再利用する。
3. 依頼で許可された範囲を実装し、必要なテストを追加する。機能単位で小さくコミットする。
   追加の明示的なユーザー指示・持ち主のレビューで範囲が広がった場合は、その根拠を PR に記録する。
4. push 前に必ず次を実行し、実際の結果を保存する。
   ```sh
   npm run typecheck
   npm test
   npm run build
   ```
5. 作業ブランチへ push し、最新コミットの CI が成功したことを確認する。
   失敗した場合は原因を調べて修正し、同じ検査を行う。未実行・失敗を成功として報告しない。
6. `docs/HANDOVER.md` に実施内容・未達・判断の理由を残す。
   CI 成功後、下の形式で **PR にコメントしてから** Ready for review にする。
   Issue への報告が別途求められていても、PR の報告を省略しない。
7. 持ち主に PR 番号と URL、残る確認事項を伝える。Claude のレビュー合格後、持ち主が merge する。

## テストと変更の制約

- テストを弱めて通さず、skip・無効化で CI を通さない。
- テストの削除・期待値変更は、内容と理由を PR に記し、できればコミットを分ける。
- `tests/deduction.test.ts`、`tests/playthrough.test.ts`、`tests/camera.test.ts`、
  `tests/art.test.ts`、`tests/save.test.ts` の変更は、事前に Issue / PR で持ち主の了承を確認する。
  その修正・追記を持ち主が明示的に依頼済みなら、その了承を根拠に進める。
- 本流へ直接 push しない。自分の PR を merge しない。
- 他人のブランチや本流を rebase・amend・force push で書き換えない。レビュー修正は追加コミットにする。
- 依頼範囲外の設計変更は PR コメントで提案する。秘密情報をコミットしない。
- `docs/HANDOVER.md` §4 の差別化方針を守る。

## PR の報告形式（WORKFLOW.md §6）

```markdown
### 結果
完了 / 要確認（理由）

### 対象
closes #<Issue番号> / 依頼書: docs/REQUEST_*.md

### 変更したファイル
- path/to/file … 何をしたか

### 実行結果（実際に実行した出力を貼る）
npm run typecheck … 終了コード
npm test … Test Files / Tests の行
npm run build … built の行
CI … 最新コミットの結果と実行 URL

### テストの増減
追加: … / 変更・削除: …（理由）

### 未達・妥協したこと
なし / …

### 検査担当に見てほしいこと
…
```

レビューへの返信は同じ PR / 該当スレッドに書く。「任意」「nit」は対応しない判断も理由を返信する。
作業中断時も `docs/HANDOVER.md` を更新し、未完了事項と再開に必要な情報を残す。
