'use client'

import { NotebookPen, Plus, PanelLeftClose } from 'lucide-react'
import { avatarColor, initialOf } from '@/lib/notes-data'
import { SidebarContent } from '@/components/notes/sidebar-content'
import { useNotes } from '@/components/notes/notes-context'

type Props = {
  onCollapse?: () => void
  showCollapse?: boolean
}

export function SidebarPanel({ onCollapse, showCollapse }: Props) {
  const { addGroup, currentUser } = useNotes()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header: app name + logged-in user.
          v0 の「ユーザー切り替え」ドロップダウンはダミーデータ前提のものだった。
          実際の認証ではログイン中のアカウントは固定なので、表示のみにしている。 */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <NotebookPen className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1">
          {currentUser && (
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${avatarColor(true)}`}
            >
              {initialOf(currentUser.name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">ふたりノート</span>
            <span className="block truncate text-xs text-muted-foreground leading-tight">
              {currentUser?.name ?? '読み込み中...'}
            </span>
          </span>
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
