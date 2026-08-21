# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`). Dev and build use **Turbopack**.

```bash
pnpm install        # install dependencies
pnpm dev            # dev server at http://localhost:3000 (next dev --turbopack)
pnpm build          # production build (next build --turbopack)
pnpm start          # serve production build
```

There is **no lint or test script** in the active `package.json` and no test framework configured.

## Environment

The Supabase browser client (`lib/supabase/client.ts`) requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase の Publishable API Key / 旧 anon public key)

These are read with the non-null `!` assertion, so a missing value fails at runtime, not build time.

## Architecture

Next.js 15 App Router + React 19 + Tailwind CSS v4. The app is a couple's shared-memo (Notion-like) tool; UI copy is in Japanese.

Two routes:

- `app/page.tsx` — login screen (`components/login-form.tsx`).
- `app/notes/page.tsx` — the main app, wraps `<NotesApp>` in `<NotesProvider>`.

**One DB table backs the sidebar tree.** `public.pages` is self-referencing: a row with `parent_id IS NULL` is a _group_ (folder), a row with `parent_id` set is a _page_ inside it. Columns: `id`, `parent_id`, `title`, `content` (jsonb, BlockNote のブロック配列), `position`, `created_by`/`updated_by` (→ `auth.users`), `created_at`/`updated_at` (`updated_at` は Supabase 側のトリガで自動更新されるので、アプリからは書かない). RLS grants full access to any logged-in user (`auth.uid() IS NOT NULL`) — the app is invite-only for two people, so there is no per-workspace scoping. Ordering is `position` then `created_at`.

**All DB access goes through `lib/notes-api.ts`** (browser Supabase client): `fetchPageRows`, `insertPageRow`, `updatePageTitle`, `deletePageRow`, `getCurrentUser`, `fetchPageContent`/`updatePageContent` (本文 jsonb; ツリーとは別に開いているページの分だけ読む), plus `buildTree()` which folds the flat rows into the 2-level `Group[]` the sidebar renders. Deeper nesting is dropped by `buildTree` — the sidebar only shows two levels.

**State lives in one client-side context.** `components/notes/notes-context.tsx` (`NotesProvider` / `useNotes`) owns the tree, active selection, sidebar/drawer state, inline-editing state, and the loading/saving/error flags. All notes UI reads and mutates through `useNotes()`. Conventions to preserve when adding operations:

- **Drafts, not empty rows.** `addGroup`/`addPage` insert a local item with a `draft-` id and mark it `editing`; the `INSERT` happens in `commitEdit`, and `cancelEdit` just drops the draft. `replaceDraft` swaps in the real row id afterwards.
- **Optimistic + rollback.** Mutations update state first, then call the API inside `runSave(fn, message, rollback)`, which drives the "保存中…/保存済み" indicator and surfaces failures via `error` (banner in `notes-app.tsx`).

Still mock, be aware when changing it:

- Partner presence ("〜さんも開いています") is faked via a hardcoded `partnerViewing` Set in `notes-app.tsx`.

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

**Real-time is partially scaffolded but unused.** `hooks/usePagePresence.ts` implements Supabase Realtime presence (channel `page:${pageId}`, tracks `{userId, userName}`, returns other editors) but is **not yet consumed** by any component. Wiring it into `NotesApp`/context is the natural next step to replace the faked presence. The sidebar tree is also not subscribed to Postgres changes, so a partner's create/rename/delete only appears after reload.

## Conventions

- Path alias `@/*` maps to the repo root (`@/lib`, `@/components`, `@/hooks`).
- shadcn/ui is configured (`components.json`, style `base-nova`, RSC on). UI primitives go in `components/ui`; icons from `lucide-react`; compose classes with `cn()` from `lib/utils.ts`.
- Theming: `components/theme-toggle.tsx` toggles a `dark`/`light` class on `<html>`. It reads the initial class but does **not** persist choice or read system preference.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true` — **type errors do not fail the build**, so rely on the editor/`tsc` for type checking, not `pnpm build`.
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
