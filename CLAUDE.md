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

**State lives in one client-side context.** `components/notes/notes-context.tsx` (`NotesProvider` / `useNotes`) owns groups, pages, active selection, sidebar/drawer state, and inline-editing state. All notes UI reads and mutates through `useNotes()` — there is no server persistence yet. `addGroup`/`addPage` generate ids from `Date.now()` and put the new item into a transient "editing" state that `commitEdit`/`cancelEdit` finalize or roll back.

**The current UI is a demo/mock, not yet wired to a backend.** Be aware when changing it:
- Seed data (groups, pages, users) is hardcoded in `lib/notes-data.ts`.
- Page body content in `components/notes/note-editor.tsx` comes from a hardcoded `sampleContent` map keyed by page id; the editor renders a static block-type union and title is a bare `contentEditable` (edits are not captured).
- Autosave ("保存中…/保存済み") is a simulated `setTimeout` in the context, not a real save.
- Partner presence ("〜さんも開いています") is faked via a hardcoded `partnerViewing` Set in `notes-app.tsx`.

**Real-time is partially scaffolded but unused.** `hooks/usePagePresence.ts` implements Supabase Realtime presence (channel `page:${pageId}`, tracks `{userId, userName}`, returns other editors) but is **not yet consumed** by any component. Wiring it into `NotesApp`/context is the natural next step to replace the faked presence. `@tiptap/starter-kit` is installed but the editor does not use it yet.

## Conventions

- Path alias `@/*` maps to the repo root (`@/lib`, `@/components`, `@/hooks`).
- shadcn/ui is configured (`components.json`, style `base-nova`, RSC on). UI primitives go in `components/ui`; icons from `lucide-react`; compose classes with `cn()` from `lib/utils.ts`.
- Theming: `components/theme-toggle.tsx` toggles a `dark`/`light` class on `<html>`. It reads the initial class but does **not** persist choice or read system preference.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true` — **type errors do not fail the build**, so rely on the editor/`tsc` for type checking, not `pnpm build`.

## UI dependencies

The notes UI is built with shadcn/ui on top of `@base-ui/react` primitives, `lucide-react` icons, and `class-variance-authority` / `clsx` / `tailwind-merge` (via `cn()`). `tw-animate-css` is imported in `app/globals.css` for animation utilities. The `shadcn` CLI is a devDependency — run `pnpm dlx shadcn@latest add <component>` to scaffold new UI primitives into `components/ui`.
