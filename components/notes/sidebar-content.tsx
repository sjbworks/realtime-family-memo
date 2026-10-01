'use client'

import { ChevronDown, ChevronRight, FileText, Folder, GripVertical, Plus, Search } from 'lucide-react'
import { useNotes } from '@/components/notes/notes-context'
import { InlineEdit } from '@/components/notes/inline-edit'
import { RowMenu } from '@/components/notes/row-menu'
import { useSidebarReorder, type DragState, type ReorderKind } from '@/hooks/use-sidebar-reorder'
import { cn } from '@/lib/utils'
import { DEFAULT_GROUP_TITLE, DEFAULT_PAGE_TITLE, type Group, type Page } from '@/lib/notes-data'

/**
 * つまみ。ホバーできる画面では邪魔なので隠し、タッチでは掴めないと困るので出しておく。
 * 1 件しかない並びでは場所だけ取って invisible にし、行の見た目を揃える。
 */
const handleClass = (count: number) =>
  cn(
    'inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground active:cursor-grabbing',
    count < 2
      ? 'invisible'
      : 'md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 md:focus-visible:opacity-100'
  )

/** ドラッグ中の行。掴んだ行の transform はフック側が直接書くので、ここは見た目だけ */
const draggedClass = (isDragged: boolean) => (isDragged ? 'relative z-10 opacity-60' : undefined)

const isDragged = (drag: DragState | null, kind: ReorderKind, listId: string | null, index: number) =>
  drag !== null && drag.kind === kind && drag.listId === listId && drag.fromIndex === index

const indicatorTop = (drag: DragState | null, kind: ReorderKind, listId: string | null) =>
  drag !== null && drag.kind === kind && drag.listId === listId ? drag.indicatorTop : null

/** 落ちる位置を示す線。ul の中に absolute で置くので他の行のレイアウトは動かない */
function DropIndicator({ top }: { top: number }) {
  return (
    <li aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <span className="block -translate-y-px border-t-2 border-dashed border-primary" />
    </li>
  )
}

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
    reorderPages,
    reorderGroups,
    removePage,
    removeGroup,
    commitEdit,
    cancelEdit,
  } = useNotes()

  const { drag, handleProps } = useSidebarReorder((kind, listId, fromIndex, toIndex) => {
    if (kind === 'group') reorderGroups(fromIndex, toIndex)
    else if (listId) reorderPages(listId, fromIndex, toIndex)
  })

  const confirmDelete = (page: Page) => {
    const title = page.title || DEFAULT_PAGE_TITLE
    if (window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) {
      removePage(page.id)
    }
  }

  const confirmDeleteGroup = (group: Group) => {
    const name = group.name || DEFAULT_GROUP_TITLE
    const detail = group.pages.length > 0 ? `中のページ ${group.pages.length} 件も削除されます。` : ''
    if (window.confirm(`「${name}」を削除しますか？${detail}この操作は取り消せません。`)) {
      removeGroup(group.id)
    }
  }

  const groupIndicator = indicatorTop(drag, 'group', null)

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3" aria-label="ページ一覧">
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

      <ul className="relative flex flex-col gap-0.5">
        {groups.map((group, groupIndex) => {
          const pageIndicator = indicatorTop(drag, 'page', group.id)
          return (
            <li key={group.id} className={draggedClass(isDragged(drag, 'group', null, groupIndex))}>
              <div className="group/row flex items-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
                <button
                  type="button"
                  {...handleProps({
                    kind: 'group',
                    listId: null,
                    index: groupIndex,
                    count: groups.length,
                    label: group.name || DEFAULT_GROUP_TITLE,
                  })}
                  className={handleClass(groups.length)}
                >
                  <GripVertical className="size-3.5" />
                </button>
                {editingId === group.id ? (
                  // 入力中は toggle ボタンで囲まない。囲むと入力欄へのクリックで閉じてしまう
                  <span className="flex min-h-11 flex-1 items-center gap-1.5 px-2 md:min-h-9">
                    <span className="text-muted-foreground">
                      {openGroups[group.id] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </span>
                    <Folder className="size-4 shrink-0 text-accent-foreground" />
                    <InlineEdit
                      initial={group.name}
                      placeholder="グループ名"
                      onCommit={commitEdit}
                      onCancel={cancelEdit}
                      className="w-full min-w-0 rounded-sm bg-background px-1 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-ring"
                    />
                  </span>
                ) : (
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
                    <span className="truncate text-sm font-medium">{group.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addPage(group.id)}
                  aria-label={`${group.name || 'グループ'}にページを追加`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground"
                >
                  <Plus className="size-4" />
                </button>
                <RowMenu
                  label={group.name || DEFAULT_GROUP_TITLE}
                  onRename={() => startRename(group.id, 'group')}
                  onDelete={() => confirmDeleteGroup(group)}
                />
              </div>

              {openGroups[group.id] && (
                <ul className="relative mb-1 ml-3.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-1.5">
                  {group.pages.map((page, pageIndex) => {
                    const active = page.id === activePageId
                    const isEditing = editingId === page.id
                    return (
                      <li key={page.id} className={draggedClass(isDragged(drag, 'page', group.id, pageIndex))}>
                        <div
                          className={`group/row flex items-center rounded-md transition-colors ${
                            active
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent'
                          }`}
                        >
                          <button
                            type="button"
                            {...handleProps({
                              kind: 'page',
                              listId: group.id,
                              index: pageIndex,
                              count: group.pages.length,
                              label: page.title || DEFAULT_PAGE_TITLE,
                            })}
                            className={handleClass(group.pages.length)}
                          >
                            <GripVertical className="size-3.5" />
                          </button>
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
                          />
                        </div>
                      </li>
                    )
                  })}
                  {pageIndicator !== null && <DropIndicator top={pageIndicator} />}
                </ul>
              )}
            </li>
          )
        })}
        {groupIndicator !== null && <DropIndicator top={groupIndicator} />}
      </ul>
    </nav>
  )
}
