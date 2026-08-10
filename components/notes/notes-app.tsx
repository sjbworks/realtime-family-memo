'use client'

import { Check, Cloud, Loader2, LogOut, Menu, PanelLeftOpen, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { users } from '@/lib/notes-data'
import { SidebarPanel } from '@/components/notes/sidebar-panel'
import { NoteEditor } from '@/components/notes/note-editor'
import { ThemeToggle } from '@/components/theme-toggle'
import { useNotes } from '@/components/notes/notes-context'
import { createClient } from '@/lib/supabase/client'

// pages where the partner is currently viewing (demo)
const partnerViewing = new Set(['cleaning', 'belongings'])

export function NotesApp() {
  const {
    activePageId,
    activePage,
    drawerOpen,
    collapsed,
    saving,
    setDrawerOpen,
    setCollapsed,
  } = useNotes()

  const router = useRouter()
  const partner = users[1]
  const showPresence = partnerViewing.has(activePageId)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      {!collapsed && (
        <aside className="hidden w-60 shrink-0 border-r border-sidebar-border md:block">
          <SidebarPanel onCollapse={() => setCollapsed(true)} showCollapse />
        </aside>
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] animate-in fade-in"
          />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs border-r border-sidebar-border shadow-xl duration-200 animate-in slide-in-from-left">
            <SidebarPanel />
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:px-5">
          {/* mobile hamburger */}
          <button
            type="button"
            aria-label="メニューを開く"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* desktop expand button when collapsed */}
          {collapsed && (
            <button
              type="button"
              aria-label="サイドバーを開く"
              onClick={() => setCollapsed(false)}
              className="hidden size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground md:inline-flex"
            >
              <PanelLeftOpen className="size-5" />
            </button>
          )}

          {/* center title (mobile) / breadcrumb (desktop) */}
          <div className="min-w-0 flex-1 text-center md:text-left">
            <span className="block truncate text-sm font-medium text-foreground md:hidden">
              {activePage.title}
            </span>
            <span className="hidden truncate text-sm text-muted-foreground md:block">
              マイページ / {activePage.title}
            </span>
          </div>

          {/* save indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span className="hidden sm:inline">保存中...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5 text-primary" />
                <span className="hidden sm:inline">保存済み</span>
              </>
            )}
          </div>

          <ThemeToggle className="size-9 shrink-0" />

          {/* current user avatar */}
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${users[0].color}`}
            aria-label={`ログイン中: ${users[0].name}`}
          >
            {users[0].initial}
          </span>

          {/* sign out */}
          <button
            type="button"
            aria-label="ログアウト"
            onClick={handleSignOut}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          {/* Presence banner */}
          {showPresence && (
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-5 pt-4 md:px-8">
              <div className="flex w-full items-center gap-2 rounded-md border border-presence/40 bg-presence/10 px-3 py-2 text-sm text-presence-foreground">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${partner.color}`}
                >
                  {partner.initial}
                </span>
                <Cloud className="size-3.5 shrink-0 text-presence" />
                <span className="truncate">
                  {partner.name}さんもこのページを開いています
                </span>
              </div>
            </div>
          )}

          <NoteEditor page={activePage} />
        </main>
      </div>
    </div>
  )
}
