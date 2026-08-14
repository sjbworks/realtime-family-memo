'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_GROUP_TITLE,
  DEFAULT_PAGE_TITLE,
  type Group,
  type Page,
} from '@/lib/notes-data'
import {
  buildTree,
  deletePageRow,
  fetchPageRows,
  getCurrentUser,
  insertPageRow,
  toErrorMessage,
  toPage,
  updatePageTitle,
  type CurrentUser,
  type PageRow,
} from '@/lib/notes-api'

type EditKind = 'group' | 'page'
/** 未保存の新規行かどうかを isNew で持つ。isNew の間だけ id は下書き id */
type Editing = { id: string; kind: EditKind; isNew: boolean } | null

type NotesContextValue = {
  groups: Group[]
  openGroups: Record<string, boolean>
  activePageId: string | null
  activePage: Page | null
  editingId: string | null
  drawerOpen: boolean
  collapsed: boolean
  saving: boolean
  loading: boolean
  error: string | null
  currentUser: CurrentUser | null
  setDrawerOpen: (open: boolean) => void
  setCollapsed: (collapsed: boolean) => void
  selectPage: (id: string) => void
  toggleGroup: (id: string) => void
  addGroup: () => void
  addPage: (groupId: string) => void
  startRename: (id: string, kind: EditKind) => void
  removePage: (id: string) => void
  commitEdit: (value: string) => void
  cancelEdit: () => void
  dismissError: () => void
}

const NotesContext = createContext<NotesContextValue | null>(null)

const DRAFT_PREFIX = 'draft-'
const isDraftId = (id: string) => id.startsWith(DRAFT_PREFIX)

export function useNotes() {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotes must be used within NotesProvider')
  return ctx
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const saving = pending > 0
  const activePage = findPage(groups, activePageId)

  // 初回ロード: ログインユーザーと pages ツリーを取得する
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [user, rows] = await Promise.all([getCurrentUser(), fetchPageRows()])
        if (cancelled) return

        const tree = buildTree(rows)
        setCurrentUser(user)
        setGroups(tree)
        setOpenGroups(Object.fromEntries(tree.map((g) => [g.id, true])))
        setActivePageId(tree.flatMap((g) => g.pages)[0]?.id ?? null)
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e, 'ページの読み込みに失敗しました'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  /** 保存インジケータを出しつつ実行し、失敗したら rollback して理由を表示する */
  async function runSave(fn: () => Promise<void>, message: string, rollback?: () => void) {
    setPending((p) => p + 1)
    setError(null)
    try {
      await fn()
    } catch (e) {
      rollback?.()
      setError(toErrorMessage(e, message))
    } finally {
      setPending((p) => p - 1)
    }
  }

  function selectPage(id: string) {
    setActivePageId(id)
    setDrawerOpen(false)
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // 空の行を DB に作らないよう、新規作成はまず下書きとしてローカルに置き、
  // 名前が確定した commitEdit のタイミングで INSERT する。
  function addGroup() {
    const id = `${DRAFT_PREFIX}${Date.now()}`
    setGroups((prev) => [...prev, { id, name: '', pages: [] }])
    setOpenGroups((prev) => ({ ...prev, [id]: true }))
    setEditing({ id, kind: 'group', isNew: true })
  }

  function addPage(groupId: string) {
    const id = `${DRAFT_PREFIX}${Date.now()}`
    setOpenGroups((prev) => ({ ...prev, [groupId]: true }))
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              pages: [
                ...g.pages,
                { id, groupId, title: '', updatedById: currentUser?.id ?? null, updatedAt: null },
              ],
            }
          : g,
      ),
    )
    setEditing({ id, kind: 'page', isNew: true })
  }

  function startRename(id: string, kind: EditKind) {
    setEditing({ id, kind, isNew: false })
  }

  function commitEdit(value: string) {
    if (!editing) return
    const target = editing
    setEditing(null)

    const trimmed = value.trim()
    const title =
      trimmed || (target.kind === 'group' ? DEFAULT_GROUP_TITLE : DEFAULT_PAGE_TITLE)

    if (target.isNew) {
      createNode(target, title)
      return
    }

    const before = findTitle(groups, target.id, target.kind)
    if (before === null || before === title) return

    setGroups((prev) => renameNode(prev, target.id, target.kind, title))
    void runSave(
      async () => {
        if (!currentUser) throw new Error('ログイン情報を取得できませんでした')
        await updatePageTitle(target.id, title, currentUser.id)
      },
      '名前の変更を保存できませんでした',
      () => setGroups((prev) => renameNode(prev, target.id, target.kind, before)),
    )
  }

  function createNode(target: NonNullable<Editing>, title: string) {
    // 入力中の下書きに名前だけ反映しておき、INSERT 後に実 id へ差し替える
    setGroups((prev) => renameNode(prev, target.id, target.kind, title))

    const groupId = target.kind === 'page' ? findGroupIdOfPage(groups, target.id) : null
    const position =
      target.kind === 'group'
        ? groups.length - 1
        : (groups.find((g) => g.id === groupId)?.pages.length ?? 1) - 1

    void runSave(
      async () => {
        if (!currentUser) throw new Error('ログイン情報を取得できませんでした')
        // 親グループ自体がまだ保存中（下書き id）のときは INSERT できない
        if (target.kind === 'page' && (!groupId || isDraftId(groupId))) {
          throw new Error('グループの保存が完了していません')
        }

        const row = await insertPageRow({
          parentId: target.kind === 'group' ? null : groupId,
          title,
          position,
          userId: currentUser.id,
        })

        setGroups((prev) => replaceDraft(prev, target.id, target.kind, row))
        setOpenGroups((prev) => {
          if (target.kind !== 'group') return prev
          const { [target.id]: wasOpen, ...rest } = prev
          return { ...rest, [row.id]: wasOpen ?? true }
        })
        if (target.kind === 'page') selectPage(row.id)
      },
      target.kind === 'group' ? 'グループを作成できませんでした' : 'ページを作成できませんでした',
      () => removeDraft(target),
    )
  }

  function cancelEdit() {
    if (!editing) return
    if (editing.isNew) removeDraft(editing)
    setEditing(null)
  }

  function removeDraft(target: NonNullable<Editing>) {
    if (target.kind === 'group') {
      setGroups((prev) => prev.filter((g) => g.id !== target.id))
      setOpenGroups((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => id !== target.id)),
      )
    } else {
      setGroups((prev) =>
        prev.map((g) => ({ ...g, pages: g.pages.filter((p) => p.id !== target.id) })),
      )
    }
  }

  function removePage(id: string) {
    if (isDraftId(id)) {
      removeDraft({ id, kind: 'page', isNew: true })
      if (editing?.id === id) setEditing(null)
      return
    }

    const snapshot = groups
    const previousActiveId = activePageId

    setGroups((prev) =>
      prev.map((g) => ({ ...g, pages: g.pages.filter((p) => p.id !== id) })),
    )
    if (editing?.id === id) setEditing(null)
    if (activePageId === id) setActivePageId(neighborPageId(groups, id))

    void runSave(() => deletePageRow(id), 'ページを削除できませんでした', () => {
      setGroups(snapshot)
      setActivePageId(previousActiveId)
    })
  }

  const value: NotesContextValue = {
    groups,
    openGroups,
    activePageId,
    activePage,
    editingId: editing?.id ?? null,
    drawerOpen,
    collapsed,
    saving,
    loading,
    error,
    currentUser,
    setDrawerOpen,
    setCollapsed,
    selectPage,
    toggleGroup,
    addGroup,
    addPage,
    startRename,
    removePage,
    commitEdit,
    cancelEdit,
    dismissError: () => setError(null),
  }

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

// ------------------------------------------------------------------ helpers

function findPage(groups: Group[], pageId: string | null): Page | null {
  if (!pageId) return null
  for (const group of groups) {
    const page = group.pages.find((p) => p.id === pageId)
    if (page) return page
  }
  return null
}

function findTitle(groups: Group[], id: string, kind: EditKind): string | null {
  if (kind === 'group') return groups.find((g) => g.id === id)?.name ?? null
  return findPage(groups, id)?.title ?? null
}

function findGroupIdOfPage(groups: Group[], pageId: string): string | null {
  return groups.find((g) => g.pages.some((p) => p.id === pageId))?.id ?? null
}

function renameNode(groups: Group[], id: string, kind: EditKind, name: string): Group[] {
  if (kind === 'group') {
    return groups.map((g) => (g.id === id ? { ...g, name } : g))
  }
  return groups.map((g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === id ? { ...p, title: name } : p)),
  }))
}

function replaceDraft(groups: Group[], draftId: string, kind: EditKind, row: PageRow): Group[] {
  if (kind === 'group') {
    return groups.map((g) =>
      g.id === draftId
        ? { ...g, id: row.id, name: row.title, pages: g.pages.map((p) => ({ ...p, groupId: row.id })) }
        : g,
    )
  }
  return groups.map((g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === draftId ? toPage(row, g.id) : p)),
  }))
}

/** 削除したページの代わりに選択するページ（同じグループの隣 → 全体の先頭） */
function neighborPageId(groups: Group[], removedId: string): string | null {
  const group = groups.find((g) => g.pages.some((p) => p.id === removedId))
  if (group) {
    const index = group.pages.findIndex((p) => p.id === removedId)
    const sibling = group.pages[index + 1] ?? group.pages[index - 1]
    if (sibling) return sibling.id
  }
  return groups.flatMap((g) => g.pages).find((p) => p.id !== removedId)?.id ?? null
}
