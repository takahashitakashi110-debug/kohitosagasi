# AGENTS.md

このリポジトリで作業する AI エージェント（Codex / Claude など）へ。

作業を始める前に、次の順に読んでください。

1. [docs/WORKFLOW.md](docs/WORKFLOW.md) … GitHub 上の作業の進め方（必ず従う）
2. [docs/HANDOVER.md](docs/HANDOVER.md) … 今の状態、触るときの注意点、残りの作業
3. 担当する Issue と、そこからリンクされた `docs/REQUEST_*.md` … 依頼の詳細

要点:

- 本流へ直接 push しない。着手したらすぐドラフト PR を出す（`closes #Issue番号`）。
- push 前に `npm run typecheck` / `npm test` / `npm run build` を実行する。
- テストを弱めて通さない。重要なテストは変える前に了承を取る（WORKFLOW.md §5）。
- 報告は WORKFLOW.md §6 の形式で PR にコメントする。merge はしない。
