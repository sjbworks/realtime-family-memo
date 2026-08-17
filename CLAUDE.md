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

**One DB table backs the sidebar tree.** `public.pages` is self-referencing: a row with `parent_id IS NULL` is a _group_ (folder), a row with `parent_id` set is a _page_ inside it. Columns: `id`, `parent_id`, `title`, `content` (jsonb, unused so far), `position`, `created_by`/`updated_by` (→ `auth.users`), `created_at`/`updated_at`. RLS grants full access to any logged-in user (`auth.uid() IS NOT NULL`) — the app is invite-only for two people, so there is no per-workspace scoping. Ordering is `position` then `created_at`.

**All DB access goes through `lib/notes-api.ts`** (browser Supabase client): `fetchPageRows`, `insertPageRow`, `updatePageTitle`, `deletePageRow`, `getCurrentUser`, plus `buildTree()` which folds the flat rows into the 2-level `Group[]` the sidebar renders. Deeper nesting is dropped by `buildTree` — the sidebar only shows two levels.

**State lives in one client-side context.** `components/notes/notes-context.tsx` (`NotesProvider` / `useNotes`) owns the tree, active selection, sidebar/drawer state, inline-editing state, and the loading/saving/error flags. All notes UI reads and mutates through `useNotes()`. Conventions to preserve when adding operations:

- **Drafts, not empty rows.** `addGroup`/`addPage` insert a local item with a `draft-` id and mark it `editing`; the `INSERT` happens in `commitEdit`, and `cancelEdit` just drops the draft. `replaceDraft` swaps in the real row id afterwards.
- **Optimistic + rollback.** Mutations update state first, then call the API inside `runSave(fn, message, rollback)`, which drives the "保存中…/保存済み" indicator and surfaces failures via `error` (banner in `notes-app.tsx`).

Still mock, be aware when changing it:

- Page body content in `components/notes/note-editor.tsx` comes from a hardcoded `sampleContent` map keyed by page id (so DB-created pages fall back to `defaultContent`); the editor renders a static block-type union and title is a bare `contentEditable` (edits are not captured, and `content` is never written).
- `users` in `lib/notes-data.ts` is still dummy — used by the avatar and the sidebar user switcher. There is no `profiles` table, so `updated_by` (uuid) is rendered via `resolveUserName()`: your own name, otherwise "パートナー".
- Partner presence ("〜さんも開いています") is faked via a hardcoded `partnerViewing` Set in `notes-app.tsx`.

**Real-time is partially scaffolded but unused.** `hooks/usePagePresence.ts` implements Supabase Realtime presence (channel `page:${pageId}`, tracks `{userId, userName}`, returns other editors) but is **not yet consumed** by any component. Wiring it into `NotesApp`/context is the natural next step to replace the faked presence. The sidebar tree is also not subscribed to Postgres changes, so a partner's create/rename/delete only appears after reload. `@tiptap/starter-kit` is installed but the editor does not use it yet.

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
