'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, NotebookPen, Plus, PanelLeftClose } from 'lucide-react'
import { users } from '@/lib/notes-data'
import { SidebarContent } from '@/components/notes/sidebar-content'
import { useNotes } from '@/components/notes/notes-context'

type Props = {
  onCollapse?: () => void
  showCollapse?: boolean
}

export function SidebarPanel({ onCollapse, showCollapse }: Props) {
  const { addGroup } = useNotes()
  const [currentUser, setCurrentUser] = useState(users[0])
  const [switcherOpen, setSwitcherOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header: app name + user switcher */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <NotebookPen className="size-4" />
        </div>
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-sidebar-accent"
            aria-expanded={switcherOpen}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${currentUser.color}`}
            >
              {currentUser.initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">
                ふたりノート
              </span>
              <span className="block truncate text-xs text-muted-foreground leading-tight">
                {currentUser.name}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>

          {switcherOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-sidebar-border bg-popover p-1 shadow-md">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setCurrentUser(u)
                    setSwitcherOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${u.color}`}
                  >
                    {u.initial}
                  </span>
                  <span className="flex-1 text-popover-foreground">{u.name}</span>
                  {u.id === currentUser.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {showCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="サイドバーを閉じる"
            className="hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* Tree */}
      <SidebarContent />

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={addGroup}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent md:min-h-9"
        >
          <Plus className="size-4 text-muted-foreground" />
          新しいグループ
        </button>
      </div>
    </div>
  )
}
