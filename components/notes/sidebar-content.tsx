'use client'

import { ChevronDown, ChevronRight, FileText, Folder, GripVertical, Plus, Search } from 'lucide-react'
import { useNotes } from '@/components/notes/notes-context'
import { InlineEdit } from '@/components/notes/inline-edit'
import { RowMenu } from '@/components/notes/row-menu'
import { DEFAULT_PAGE_TITLE, type Page } from '@/lib/notes-data'

export function SidebarContent() {
  const {
    groups,
    openGroups,
    activePageId,
    editingId,
    loading,
    selectPage,
    toggleGroup,
    addPage,
    startRename,
    removePage,
    commitEdit,
    cancelEdit,
  } = useNotes()

  function confirmDelete(page: Page) {
    const title = page.title || DEFAULT_PAGE_TITLE
    if (window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) {
      removePage(page.id)
    }
  }

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3" aria-label="ページ一覧">
      {/* Search */}
      <div className="mb-2 px-1">
        <div className="flex h-9 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-muted-foreground">
          <Search className="size-4 shrink-0" />
          <input
            type="text"
            placeholder="検索"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {loading && <p className="px-2 py-2 text-sm text-muted-foreground">読み込み中...</p>}

      {!loading && groups.length === 0 && (
        <p className="px-2 py-2 text-sm text-muted-foreground text-pretty">
          まだグループがありません。下の「新しいグループ」から作成してください。
        </p>
      )}

      <ul className="flex flex-col gap-0.5">
        {groups.map((group) => (
          <li key={group.id}>
            <div className="group/g flex items-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex min-h-11 flex-1 items-center gap-1.5 rounded-md px-2 text-left md:min-h-9"
                aria-expanded={openGroups[group.id]}
              >
                <span className="text-muted-foreground">
                  {openGroups[group.id] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <Folder className="size-4 shrink-0 text-accent-foreground" />
                {editingId === group.id ? (
                  <InlineEdit
                    initial={group.name}
                    placeholder="グループ名"
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    className="w-full min-w-0 rounded-sm bg-background px-1 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-ring"
                  />
                ) : (
                  <span className="truncate text-sm font-medium">{group.name}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => addPage(group.id)}
                aria-label={`${group.name || 'グループ'}にページを追加`}
                className="mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {openGroups[group.id] && (
              <ul className="mb-1 ml-3.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-1.5">
                {group.pages.map((page) => {
                  const active = page.id === activePageId
                  const isEditing = editingId === page.id
                  return (
                    <li key={page.id}>
                      <div
                        className={`group/p flex items-center rounded-md transition-colors ${
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover/p:opacity-100">
                          <GripVertical className="size-3.5" />
                        </span>
                        {isEditing ? (
                          <span className="flex min-h-11 flex-1 items-center gap-2 pr-1 md:min-h-8">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <InlineEdit
                              initial={page.title}
                              placeholder="ページ名"
                              onCommit={commitEdit}
                              onCancel={cancelEdit}
                              className="w-full min-w-0 rounded-sm bg-background px-1 py-0.5 text-sm text-foreground outline-none ring-1 ring-ring"
                            />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectPage(page.id)}
                            className="flex min-h-11 flex-1 items-center gap-2 truncate rounded-md pr-1 text-left md:min-h-8"
                          >
                            <FileText
                              className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                            />
                            <span className="truncate text-sm">{page.title}</span>
                          </button>
                        )}
                        <RowMenu
                          label={page.title || DEFAULT_PAGE_TITLE}
                          onRename={() => startRename(page.id, 'page')}
                          onDelete={() => confirmDelete(page)}
                          className="md:opacity-0 md:group-hover/p:opacity-100"
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
