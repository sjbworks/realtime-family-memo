-- パートナーの表示名を出すための auth.users のミラー。
--
-- auth.users はブラウザのクライアントから読めない（anon / authenticated に権限が無い）。
-- 一方サイドバーとページ本文の「最終更新: 〜さん」は pages.updated_by の uuid しか持って
-- いないので、uuid → 表示名を引くための行が public スキーマに必要になる。
--
-- アプリはこのテーブルを読むだけ。行は auth.users のトリガが作るので INSERT / UPDATE の
-- ポリシーは置かない（RLS 有効 + ポリシー無し = 拒否）。

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
);

-- 表示名の決め方。lib/notes-api.ts の getCurrentUser() と同じ優先順で揃える
-- （display_name → name → full_name → メールのローカル部 → 既定値）。
-- ここがずれると、同じユーザーが自分の画面と相手の画面で違う名前になる。
--
-- アプリ側は typeof === 'string' で弾いているが、ここは ->> が何でも文字列化する。
-- メタデータを手で非文字列に書き換えた場合だけ差が出る。
create or replace function public.profile_display_name(meta jsonb, email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'ユーザー'
  );
$$;

-- auth.users への INSERT / UPDATE を実行するのは supabase_auth_admin ロールで、
-- public.profiles への権限を持たない。security definer で関数の所有者（postgres）として
-- 書き込む。所有者はテーブルの RLS を通さないので、読み取り専用のポリシーのままでよい。
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.profile_display_name(new.raw_user_meta_data, new.email))
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

-- update of <列> を付けておくと、最終ログイン時刻のような無関係な更新では発火しない。
-- insert では列の指定にかかわらず発火する。
drop trigger if exists sync_profile on auth.users;
create trigger sync_profile
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_profile();

-- 既存ユーザーの分。トリガは以後の変更にしか反応しないので、ここで一度埋める
insert into public.profiles (id, display_name)
select u.id, public.profile_display_name(u.raw_user_meta_data, u.email)
  from auth.users u
on conflict (id) do update set display_name = excluded.display_name;

alter table public.profiles enable row level security;

-- pages と同じ条件。招待制の 2 人しかいないので、ログイン済みなら全員の行を読める
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  using (auth.uid() is not null);

-- Supabase は public スキーマのテーブルに alter default privileges で anon にも
-- 権限を付けている。RLS があるので anon が読んでも 0 行だが、明示的に落としておく
revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;

-- 関数は既定で PUBLIC に EXECUTE が付く。アプリから呼ぶものではないので落とす。
-- sync_profile() はトリガ関数なので、直接呼んでも「can only be called as trigger」で
-- 弾かれる。EXECUTE を残しても実害が無い一方、落とすと「トリガ発火時の EXECUTE 検査は
-- CREATE TRIGGER 時だけ」という前提に寄りかかることになる。壊れたときの影響が
-- ユーザー作成の失敗なので、ここは触らない。
revoke execute on function public.profile_display_name(jsonb, text) from public;
revoke execute on function public.profile_display_name(jsonb, text) from anon;
revoke execute on function public.profile_display_name(jsonb, text) from authenticated;

-- PostgREST のスキーマキャッシュを更新する。これを忘れると、テーブルはあるのに
-- アプリ側が PGRST205「Could not find the table」を受け取り続ける
notify pgrst, 'reload schema';
