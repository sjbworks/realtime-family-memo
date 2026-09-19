# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`). Dev and build use **Turbopack**.

```bash
pnpm install        # install dependencies
pnpm dev            # dev server at http://localhost:3000 (next dev --turbopack)
pnpm build          # production build (next build --turbopack)
pnpm start          # serve production build
pnpm lint           # eslint .（flat config / eslint-config-next）
pnpm typecheck      # tsc --noEmit
```

There is **no test script** and no test framework configured — `pnpm lint` と `pnpm typecheck` が唯一のチェック。

- `eslint-config-next/core-web-vitals` には react-hooks v6 のルールが入っている。特に `react-hooks/set-state-in-effect` は effect 本体から直接 `setState` を呼ぶと **error**。非同期処理の結果で state を進めたいときは `hooks/use-auth-link.ts` の形（effect からは関数を呼ぶだけ、state 更新はその中）に倣う。
- TypeScript は devDependencies で別名解決している: `typescript` → `@typescript/typescript6`（typescript-eslint が TS7 の API に未対応なため）、`@typescript/native` が TS7。この bin は `tsc` ではなく `tsc6` なので、`next.config.ts` で `experimental.useTypeScriptCli: false` を立てて Compiler API 経由に戻している。

## Environment

The Supabase browser client (`lib/supabase/client.ts`) requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase の Publishable API Key / 旧 anon public key)

These are read with the non-null `!` assertion, so a missing value fails at runtime, not build time.

## Architecture

Next.js 16 App Router + React 19 + Tailwind CSS v4. The app is a couple's shared-memo (Notion-like) tool; UI copy is in Japanese.

Routes:

- `app/page.tsx` — login screen (`components/login-form.tsx`). 招待 / パスワード再設定メールのリンクもここ（Site URL）に戻ってくる。
- `app/notes/layout.tsx` — the app itself: wraps `<NotesApp>` in `<NotesProvider>`. `notes/page.tsx` と `notes/[pageId]/page.tsx` は受け口で **何も描画しない** — 画面一式をセグメントをまたいで残る layout に置くことで、ページを切り替えるたびにツリーを読み直さずに済ませている。開いているページ id は `NotesProvider` が `usePathname()` から読む。
- `app/auth/mfa/page.tsx` / `app/auth/mfa/enroll/page.tsx` — 2段階認証のコード入力 / 登録。
- `app/auth/set-password/page.tsx` — 招待・再設定リンクから来たユーザーがパスワードを決める画面。

**Auth is middleware-driven, and TOTP の2段階認証は必須。** `middleware.ts` → `lib/supabase/middleware.ts` が静的ファイル以外の全パスで走る。`getUser()` でセッションを更新し（`getUser()` と redirect の間にロジックを挟まないこと — セッション同期がずれる）、`mfa.getAuthenticatorAssuranceLevel()` の結果で振り分ける:

- 未ログインで `/notes` 配下 / MFA ページ → `/`
- `currentLevel: aal1` かつ `nextLevel: aal2`（factor はあるがコード未入力）→ `/auth/mfa`
- `nextLevel: aal1`（factor 無し）→ `/auth/mfa/enroll`
- `aal2` 到達済みがログイン / MFA ページに留まっている → 本来の行き先へ

行き先は `redirect` クエリで持ち回す（`lib/auth-redirect.ts`）。`sanitizeRedirect` はオープンリダイレクト避けの許可リストで、通すのは `/notes` 配下と `/auth/set-password` だけ。

**招待 / パスワード再設定リンクはアプリ側で受け取る。** Supabase のメールリンクは `/auth/v1/verify` を経由して Site URL にトークンを付けて戻してくるだけで、パスワード設定画面までは連れて行ってくれない。

- `lib/auth-tokens.ts` が URL を読む。受け取り方は 3 形式: `#access_token=...`（ダッシュボードからの招待 / implicit）、`?code=`（アプリから送る再設定メール / PKCE、**送信したのと同じブラウザでしか交換できない**）、`?token_hash=&type=`（メールテンプレートを TokenHash 形式にした場合）。`error_code=otp_expired` などのエラーもここで日本語メッセージに変換する。
- `hooks/use-auth-link.ts` は `createClient()` より **先に** URL を読む。Supabase クライアントは `detectSessionInUrl` でハッシュを勝手に消費するので、順番を入れ替えるとトークンを取り逃す。
- 招待リンクの戻り先は Site URL = `/` なので `login-form.tsx` が受け取り、成功したら `/auth/set-password` へ送る。middleware はこのパスを **MFA 登録リダイレクトから除外** している — 順番は「パスワード設定 → MFA 登録」。逆にすると登録の途中で離脱したときパスワード未設定のままになり、次回ログインできない。未ログインでも素通しするのは、トークンの消費がブラウザ側で起きてからセッションが張られるため。
- Supabase ダッシュボード側の設定が前提: Authentication → URL Configuration の **Site URL**（招待リンクの戻り先）と **Redirect URLs**（`resetPasswordForEmail` の `redirectTo` が許可リストに無いと Site URL に丸められる）。

**One DB table backs the sidebar tree.** `public.pages` is self-referencing: a row with `parent_id IS NULL` is a _group_ (folder), a row with `parent_id` set is a _page_ inside it. Columns: `id`, `parent_id`, `title`, `content` (jsonb, BlockNote のブロック配列), `position`, `created_by`/`updated_by` (→ `auth.users`), `created_at`/`updated_at` (`updated_at` は Supabase 側のトリガで自動更新されるので、アプリからは書かない). RLS grants full access to any logged-in user (`auth.uid() IS NOT NULL`) — the app is invite-only for two people, so there is no per-workspace scoping. Ordering is `position` then `created_at`.

**All DB access goes through `lib/notes-api.ts`** (browser Supabase client): `fetchPageRows`, `insertPageRow`, `updatePageTitle`, `deletePageRow`, `getCurrentUser`, `fetchPageContent`/`updatePageContent` (本文 jsonb; ツリーとは別に開いているページの分だけ読む), plus `buildTree()` which folds the flat rows into the 2-level `Group[]` the sidebar renders. Deeper nesting is dropped by `buildTree` — the sidebar only shows two levels.

**State lives in one client-side context.** `components/notes/notes-context.tsx` (`NotesProvider` / `useNotes`) owns the tree, active selection, sidebar/drawer state, inline-editing state, and the loading/saving/error flags. All notes UI reads and mutates through `useNotes()`. Conventions to preserve when adding operations:

- **Drafts, not empty rows.** `addGroup`/`addPage` insert a local item with a `draft-` id and mark it `editing`; the `INSERT` happens in `commitEdit`, and `cancelEdit` just drops the draft. `replaceDraft` swaps in the real row id afterwards.
- **Optimistic + rollback.** Mutations update state first, then call the API inside `runSave(fn, message, rollback)`, which drives the "保存中…/保存済み" indicator and surfaces failures via `error` (banner in `notes-app.tsx`).

**Display names come from `public.profiles`.** `auth.users` is not readable from the browser client, so the partner's name needs a mirror in the public schema. `supabase/migrations/20260819000000_profiles.sql` creates `profiles (id, display_name)` with an `auth.users` trigger that keeps it in sync and RLS letting any logged-in user read it. `fetchProfiles()` loads it once at startup into `NotesProvider`, which exposes a `profiles` map (uuid → `Profile`) and `partner` (the one profile that is not you).

- `resolveUserName(userId, profiles, currentUser)` falls back to "パートナー" when the map has no entry, so the app still works if the migration has not been run.
- Avatars carry no DB columns: `initialOf(name)` takes the first character and `avatarColor(isSelf)` fixes self to `primary` and the partner to `presence`. Adding a third user would need a real palette.
- The v0 "user switcher" dropdown in `sidebar-panel.tsx` was a fixture of the dummy data — with real auth the account is fixed, so it is now a plain display.

**Page body is BlockNote.** `components/notes/page-block-editor.tsx` wraps `@blocknote/shadcn`'s `BlockNoteView`; `note-editor.tsx` loads it via `next/dynamic({ ssr: false })` because BlockNote is ProseMirror-based and cannot render on the server. Rules to keep in mind:

- `useCreateBlockNote` builds the editor **once per mount** (its `deps` default to `[]`), so changing `initialContent` does nothing. Switching pages must remount via `key={page.id}` — that is why `usePageContent` reports `contentPageId` alongside the content.
- `hooks/use-page-content.ts` owns load + save: it fetches `content` for the open page, debounces edits by 800 ms, and writes last-write-wins. It flushes pending edits on page switch/unmount (so a fast switch does not drop the last keystrokes) and warns on `beforeunload` while a write is still queued. It is called from `NotesProvider`, so its saving/error state merges into the existing `saving` indicator and error banner.
- The **title** is the `PageTitle` component in `note-editor.tsx`: an uncontrolled `contentEditable` that commits on blur/Enter through `renamePage()`. Its children are written straight to the DOM rather than rendered from props — letting React re-render a `contentEditable`'s children moves the caret to the start on every keystroke. It only syncs from props when unfocused, and `key={page.id}` remounts it on page switch. `renamePage` shares `applyRename()` with the sidebar's inline rename, so both paths get the same optimistic update, rollback, and default-title handling.
- The editor is not rendered until the page's content has loaded, so a failed read can never overwrite a real page with an empty document.
- BlockNote's CSS is imported in `app/globals.css` and its `--bn-colors-*` variables are remapped to the shadcn tokens there. `@source "../node_modules/@blocknote/shadcn/dist/blocknote-shadcn.js"` is required — BlockNote ships Tailwind class names inside its dist JS, which Tailwind would otherwise not scan. BlockNote's stylesheet is outside Tailwind's cascade layers, so `.bn-*` rules beat Tailwind utilities; override them with `.bn-*` selectors rather than classes.
- `pnpm.overrides` pins `@tiptap/core`/`@tiptap/pm` to 3.30.1: `@tiptap/react` (pulled in by `@blocknote/react`) pins its peers exactly, and a stale 3.29.2 resolution breaks the build with a missing `createWidgetDecoration` export.

**Real-time presence is wired; the tree is not.** `hooks/usePagePresence.ts` implements Supabase Realtime presence (channel `page:${pageId}`, tracks `{userId, userName}`, returns other editors) and `notes-app.tsx` consumes it for the "〜さんも開いています" 表示 — payload に表示名を載せているので `profiles` を引かずに出せる。一方サイドバーのツリーは Postgres changes を購読していないので、パートナーの作成・リネーム・削除はリロードするまで見えない。

## Conventions

- Path alias `@/*` maps to the repo root (`@/lib`, `@/components`, `@/hooks`).
- shadcn/ui is configured (`components.json`, style `base-nova`, RSC on). UI primitives go in `components/ui`; icons from `lucide-react`; compose classes with `cn()` from `lib/utils.ts`.
- Theming: `components/theme-toggle.tsx` toggles a `dark`/`light` class on `<html>`. It reads the initial class but does **not** persist choice or read system preference.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true` — **type errors do not fail the build**, so use `pnpm typecheck`（と `pnpm lint`）for checking, not `pnpm build`.
- **Function style**: React components use `function` declarations; everything else (event handlers, utilities, callbacks) uses arrow functions.

```tsx
// Component: function declaration
export default function UserCard({ name }: Props) {
  // Handler: arrow function
  const handleClick = () => { ... };
  return <div onClick={handleClick}>{name}</div>;
}
```

## UI dependencies

The notes UI is built with shadcn/ui on top of `@base-ui/react` primitives, `lucide-react` icons, and `class-variance-authority` / `clsx` / `tailwind-merge` (via `cn()`). `tw-animate-css` is imported in `app/globals.css` for animation utilities. The `shadcn` CLI is a devDependency — run `pnpm dlx shadcn@latest add <component>` to scaffold new UI primitives into `components/ui`.
