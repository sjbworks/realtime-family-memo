-- サイドバーの並び替えを 1 文の UPDATE で適用する RPC。
--
-- クライアントから行ごとに UPDATE を投げると、一部だけ成功したときに position が
-- 半端に書かれた状態で残る。アプリ側はローカル state を巻き戻すので DB と UI が食い違い、
-- しかも次の並び替えは「ローカルの position と添字が違う行」しか書き直さないため、
-- そのズレを素通りして直らない。単一ステートメント = 単一トランザクションにして、
-- 全部入るか全部入らないかのどちらかにする。
--
-- pages.id が uuid でない環境では下の v(id uuid, ...) が p.id と型不一致になり、
-- この関数の作成時点でエラーになる（実行時に黙って壊れることはない）。
-- その場合は実際の型に合わせること。

create or replace function public.reorder_pages(items jsonb)
returns void
language sql
-- security invoker のまま。pages の RLS（ログイン済みなら全許可）をそのまま効かせる
security invoker
set search_path = ''
as $$
  update public.pages p
     set "position" = v."position"
    from jsonb_to_recordset(items) as v(id uuid, "position" int)
   where p.id = v.id;
$$;

-- 関数は既定で PUBLIC に EXECUTE が付く。加えて Supabase は public スキーマの関数に
-- alter default privileges で anon / authenticated へ直接 EXECUTE を付けているため、
-- PUBLIC からの revoke だけでは anon に残る。anon も明示的に落とす。
-- （pages の RLS が auth.uid() を要求するので anon が呼んでも 0 行だが、念のため）
revoke execute on function public.reorder_pages(jsonb) from public;
revoke execute on function public.reorder_pages(jsonb) from anon;
grant execute on function public.reorder_pages(jsonb) to authenticated;
