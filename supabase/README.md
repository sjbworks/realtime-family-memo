# supabase/

このプロジェクトの DB スキーマに関する SQL を置く場所。

## 運用

**マイグレーションは Supabase ダッシュボードの SQL Editor で手で当てている。** CLI
(`supabase` コマンド) は未導入で、`supabase/config.toml` も無いため、`supabase db push`
のような自動適用は動かない。ファイルはあくまで「当てた SQL の控え」。

- 再生するときはファイル名（先頭のタイムスタンプ）の順に実行する。
- ファイル名は `<timestamp>_<name>.sql` 形式で揃えてある。これは Supabase CLI が読む形式
  そのものなので、あとから `supabase link` → `db push` / `migration repair` に移行するときに
  ファイルをそのまま使える。

## このディレクトリは完全ではない

**ここにある SQL を全部流しても DB は再現できない。** 手で当てる運用を続けてきた結果、
初期から存在するものは控えが残っていない。現時点で欠けている主なもの:

- `public.pages` テーブル本体（`updated_at` を更新する `set_updated_at()` トリガを含む）
- `public.profiles` テーブルと、`auth.users` から同期するトリガ

新しくスキーマを変更するときは、ここにファイルを足してから当てること。欠けている分も、
触る機会があれば現行の DDL を起こして埋めていく。
