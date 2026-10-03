'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Block, PartialBlock } from '@blocknote/core'
import { usePageContent } from '@/hooks/use-page-content'
import { DEFAULT_GROUP_TITLE, DEFAULT_PAGE_TITLE, type Group, type Page, type Profile } from '@/lib/notes-data'
import {
  buildTree,
  deletePageRow,
  fetchPageRows,
  fetchProfiles,
  getCurrentUser,
  insertPageRow,
  toErrorMessage,
  toPage,
  updatePagePositions,
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
  /** updated_by の uuid → 表示名。resolveUserName() に渡す */
  profiles: Map<string, Profile>
  /** 自分以外のユーザー。招待制の 2 人なので実質パートナー 1 人 */
  partner: Profile | null
  /** 本文の読み込みが済んでいるページ id。エディタの key と出し分けに使う */
  contentPageId: string | null
  /** BlockNote の initialContent。null なら空ドキュメント */
  initialContent: PartialBlock[] | null
  handleContentChange: (blocks: Block[]) => void
  /** ページ本文の見出しからの改名。空文字なら既定タイトルに戻す */
  renamePage: (id: string, title: string) => void
  setDrawerOpen: (open: boolean) => void
  setCollapsed: (collapsed: boolean) => void
  selectPage: (id: string) => void
  toggleGroup: (id: string) => void
  addGroup: () => void
  addPage: (groupId: string) => void
  startRename: (id: string, kind: EditKind) => void
  /** グループ配下のページを fromIndex から toIndex へ移す */
  reorderPages: (groupId: string, fromIndex: number, toIndex: number) => void
  reorderGroups: (fromIndex: number, toIndex: number) => void
  removePage: (id: string) => void
  removeGroup: (id: string) => void
  commitEdit: (value: string) => void
  cancelEdit: () => void
  dismissError: () => void
}

const NotesContext = createContext<NotesContextValue | null>(null)

const DRAFT_PREFIX = 'draft-'
const isDraftId = (id: string) => id.startsWith(DRAFT_PREFIX)

/** ノート画面のルート。ここに開いているページの id を足したものが URL になる */
export const NOTES_PATH = '/notes'

/** 共有できる URL。/notes/<pageId> を開くとそのページが選択された状態で始まる */
export const pagePath = (pageId: string) => `${NOTES_PATH}/${encodeURIComponent(pageId)}`

const pageIdFromPath = (pathname: string): string | null => {
  if (!pathname.startsWith(`${NOTES_PATH}/`)) return null
  const [segment] = pathname.slice(NOTES_PATH.length + 1).split('/')
  return segment ? decodeURIComponent(segment) : null
}

// ------------------------------------------------------------------ helpers

/** 空欄のまま確定されたときは DB 側の default と揃えた既定タイトルにする */
const resolveTitle = (value: string, kind: EditKind): string => {
  return value.trim() || (kind === 'group' ? DEFAULT_GROUP_TITLE : DEFAULT_PAGE_TITLE)
}

const findPage = (groups: Group[], pageId: string | null): Page | null => {
  if (!pageId) return null
  for (const group of groups) {
    const page = group.pages.find((p) => p.id === pageId)
    if (page) return page
  }
  return null
}

const findTitle = (groups: Group[], id: string, kind: EditKind): string | null => {
  if (kind === 'group') return groups.find((g) => g.id === id)?.name ?? null
  return findPage(groups, id)?.title ?? null
}

const findGroupIdOfPage = (groups: Group[], pageId: string): string | null => {
  return groups.find((g) => g.pages.some((p) => p.id === pageId))?.id ?? null
}

const renameNode = (groups: Group[], id: string, kind: EditKind, name: string): Group[] => {
  if (kind === 'group') {
    return groups.map((g) => (g.id === id ? { ...g, name } : g))
  }
  return groups.map((g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === id ? { ...p, title: name } : p)),
  }))
}

const replaceDraft = (groups: Group[], draftId: string, kind: EditKind, row: PageRow): Group[] => {
  if (kind === 'group') {
    return groups.map((g) =>
      g.id === draftId
        ? {
            ...g,
            id: row.id,
            name: row.title,
            position: row.position,
            pages: g.pages.map((p) => ({ ...p, groupId: row.id })),
          }
        : g
    )
  }
  return groups.map((g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === draftId ? toPage(row, g.id) : p)),
  }))
}

/**
 * 末尾に足す行の position。既存の兄弟の最大値 + 1 にする。
 *
 * 配列の添字（length - 1）で代用すると、途中の行を削除したあと position が 0,2 のように
 * 飛んだ並びで破綻する。新しい行が既存の行より小さい値を貰い、画面では末尾に見えているのに
 * リロードすると上に飛ぶ（グループ側では既存の行と同じ値になり重複する）。
 * 下書きは position を持たないので -1 扱いで数に入らない。
 */
const nextPosition = (siblings: { position: number | null }[]): number => {
  return siblings.reduce((max, s) => Math.max(max, s.position ?? -1), -1) + 1
}

/**
 * 並び替えの計算。並べ直した配列と、DB に書き戻す必要のある行だけを返す。
 * position は必ず 0 から振り直すので、null や重複が入っていた行もここで揃う。
 * 動かせないとき（範囲外 / 未保存の下書きを含む）は null。
 */
const applyReorder = <T extends { id: string; position: number | null }>(
  list: T[],
  fromIndex: number,
  toIndex: number
): { next: T[]; updates: { id: string; position: number }[] } | null => {
  if (fromIndex === toIndex) return null
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return null

  const moved = [...list]
  const [item] = moved.splice(fromIndex, 1)
  moved.splice(toIndex, 0, item)

  // 下書きはまだ行が無いので position を振れない
  if (moved.some((i) => isDraftId(i.id))) return null

  return {
    next: moved.map((i, index) => ({ ...i, position: index })),
    updates: moved.flatMap((i, index) => (i.position === index ? [] : [{ id: i.id, position: index }])),
  }
}

/** 削除したページの代わりに選択するページ（同じグループの隣 → 全体の先頭） */
const neighborPageId = (groups: Group[], removedId: string): string | null => {
  const group = groups.find((g) => g.pages.some((p) => p.id === removedId))
  if (group) {
    const index = group.pages.findIndex((p) => p.id === removedId)
    const sibling = group.pages[index + 1] ?? group.pages[index - 1]
    if (sibling) return sibling.id
  }
  return groups.flatMap((g) => g.pages).find((p) => p.id !== removedId)?.id ?? null
}

export const useNotes = () => {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotes must be used within NotesProvider')
  return ctx
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [groups, setGroups] = useState<Group[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Editing>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [profileList, setProfileList] = useState<Profile[]>([])

  // 開いているページは state ではなく URL が持つ。共有された /notes/<pageId> を
  // 踏めばそのページが開き、戻る / 進むもブラウザ任せで動く。
  // ツリーに無い id（削除済み・他人の作った URL の打ち間違い）は選択しない。
  const routePageId = pageIdFromPath(pathname)
  const activePage = findPage(groups, routePageId)
  const activePageId = activePage?.id ?? null

  // 本文の読み込み / 保存。保存中・エラーはサイドバー操作と同じ表示に合流させる
  const { contentPageId, initialContent, contentStatus, contentError, handleContentChange, dismissContentError } =
    usePageContent(activePageId, currentUser?.id ?? null)

  const saving = pending > 0 || contentStatus === 'saving'
  const profiles = new Map(profileList.map((p) => [p.id, p]))
  const partner = profileList.find((p) => p.id !== currentUser?.id) ?? null

  // 初回ロード: ログインユーザーと pages ツリーを取得する
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [user, rows, people] = await Promise.all([
          getCurrentUser(),
          fetchPageRows(),
          // profiles をまだ作っていない環境でもノート自体は使えるようにする。
          // 引けなければ resolveUserName() が「パートナー」にフォールバックする。
          fetchProfiles().catch(() => [] as Profile[]),
        ])
        if (cancelled) return

        const tree = buildTree(rows)
        setCurrentUser(user)
        setProfileList(people)
        setGroups(tree)
        setOpenGroups(Object.fromEntries(tree.map((g) => [g.id, true])))
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

  // URL がページを指していない / 存在しない id を指しているときだけ先頭のページへ寄せる。
  // 読み込みが終わるまで待つのは、共有 URL のページをツリーが揃う前に見失わないため。
  useEffect(() => {
    if (loading) return
    if (routePageId && findPage(groups, routePageId)) return

    const first = groups.flatMap((g) => g.pages).find((p) => !isDraftId(p.id))
    if (first) router.replace(pagePath(first.id))
    else if (routePageId) router.replace(NOTES_PATH)
  }, [loading, groups, routePageId, router])

  /** 保存インジケータを出しつつ実行し、失敗したら rollback して理由を表示する */
  const runSave = async (fn: () => Promise<void>, message: string, rollback?: () => void) => {
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

  /**
   * DB のツリーを引き直してローカルを合わせる。並び替えの保存に失敗したときの戻し方。
   *
   * RPC で単一トランザクションになったので失敗＝未適用が基本だが、
   * 「UPDATE は通ったのに応答が返ってこなかった」ケースだけは区別できない。
   * ここで snapshot に巻き戻すと DB と UI が食い違ったまま残り、しかも次の並び替えは
   * 差分計算（position と添字の比較）でそのズレを素通りして直さない。DB 側に合わせる。
   */
  const resyncTree = async () => {
    try {
      const rows = await fetchPageRows()
      const tree = buildTree(rows)
      setGroups(tree)
      // 開閉状態は保ったまま、新しく現れたグループだけ開いておく
      setOpenGroups((prev) => Object.fromEntries(tree.map((g) => [g.id, prev[g.id] ?? true])))
    } catch {
      // 引き直しにも失敗したら、runSave が出す並び替えのエラーをそのまま見せる
    }
  }

  const selectPage = (id: string) => {
    setDrawerOpen(false)
    // 下書きはまだ URL にできない。INSERT 後に実 id で改めて選択される
    if (isDraftId(id)) return
    router.push(pagePath(id))
  }

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // 空の行を DB に作らないよう、新規作成はまず下書きとしてローカルに置き、
  // 名前が確定した commitEdit のタイミングで INSERT する。
  const addGroup = () => {
    const id = `${DRAFT_PREFIX}${Date.now()}`
    setGroups((prev) => [...prev, { id, name: '', pages: [], position: null }])
    setOpenGroups((prev) => ({ ...prev, [id]: true }))
    setEditing({ id, kind: 'group', isNew: true })
  }

  const addPage = (groupId: string) => {
    const id = `${DRAFT_PREFIX}${Date.now()}`
    setOpenGroups((prev) => ({ ...prev, [groupId]: true }))
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              pages: [
                ...g.pages,
                { id, groupId, title: '', updatedById: currentUser?.id ?? null, updatedAt: null, position: null },
              ],
            }
          : g
      )
    )
    setEditing({ id, kind: 'page', isNew: true })
  }

  const startRename = (id: string, kind: EditKind) => {
    setEditing({ id, kind, isNew: false })
  }

  const reorderPages = (groupId: string, fromIndex: number, toIndex: number) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    const result = applyReorder(group.pages, fromIndex, toIndex)
    if (!result) return

    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, pages: result.next } : g)))
    void runSave(
      () => updatePagePositions(result.updates),
      'ページの並び替えを保存できませんでした',
      () => void resyncTree()
    )
  }

  const reorderGroups = (fromIndex: number, toIndex: number) => {
    const result = applyReorder(groups, fromIndex, toIndex)
    if (!result) return

    setGroups(result.next)
    void runSave(
      () => updatePagePositions(result.updates),
      'グループの並び替えを保存できませんでした',
      () => void resyncTree()
    )
  }

  const removeDraft = (target: NonNullable<Editing>) => {
    if (target.kind === 'group') {
      setGroups((prev) => prev.filter((g) => g.id !== target.id))
      setOpenGroups((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== target.id)))
    } else {
      setGroups((prev) => prev.map((g) => ({ ...g, pages: g.pages.filter((p) => p.id !== target.id) })))
    }
  }

  /**
   * 既存の行の名前を変更する。サイドバーのインライン編集と、
   * ページ本文の見出し（note-editor.tsx）の両方から呼ばれる。
   */
  const applyRename = (id: string, kind: EditKind, value: string) => {
    if (isDraftId(id)) return

    const title = resolveTitle(value, kind)
    const before = findTitle(groups, id, kind)
    if (before === null || before === title) return

    setGroups((prev) => renameNode(prev, id, kind, title))
    void runSave(
      async () => {
        if (!currentUser) throw new Error('ログイン情報を取得できませんでした')
        await updatePageTitle(id, title, currentUser.id)
      },
      '名前の変更を保存できませんでした',
      () => setGroups((prev) => renameNode(prev, id, kind, before))
    )
  }

  const createNode = (target: NonNullable<Editing>, title: string) => {
    // 入力中の下書きに名前だけ反映しておき、INSERT 後に実 id へ差し替える
    setGroups((prev) => renameNode(prev, target.id, target.kind, title))

    const groupId = target.kind === 'page' ? findGroupIdOfPage(groups, target.id) : null
    const siblings = target.kind === 'group' ? groups : (groups.find((g) => g.id === groupId)?.pages ?? [])
    const position = nextPosition(siblings)

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
      () => removeDraft(target)
    )
  }

  const commitEdit = (value: string) => {
    if (!editing) return
    const target = editing
    setEditing(null)

    if (target.isNew) {
      createNode(target, resolveTitle(value, target.kind))
      return
    }

    applyRename(target.id, target.kind, value)
  }

  const cancelEdit = () => {
    if (!editing) return
    if (editing.isNew) removeDraft(editing)
    setEditing(null)
  }

  const removePage = (id: string) => {
    if (isDraftId(id)) {
      removeDraft({ id, kind: 'page', isNew: true })
      if (editing?.id === id) setEditing(null)
      return
    }

    const snapshot = groups
    const previousActiveId = activePageId

    setGroups((prev) => prev.map((g) => ({ ...g, pages: g.pages.filter((p) => p.id !== id) })))
    if (editing?.id === id) setEditing(null)
    if (activePageId === id) {
      const neighbor = neighborPageId(groups, id)
      router.replace(neighbor ? pagePath(neighbor) : NOTES_PATH)
    }

    void runSave(
      () => deletePageRow(id),
      'ページを削除できませんでした',
      () => {
        setGroups(snapshot)
        if (previousActiveId) router.replace(pagePath(previousActiveId))
      }
    )
  }

  const removeGroup = (id: string) => {
    if (isDraftId(id)) {
      removeDraft({ id, kind: 'group', isNew: true })
      if (editing?.id === id) setEditing(null)
      return
    }

    const snapshot = groups
    const previousActiveId = activePageId
    const previousOpenGroups = openGroups
    const removed = groups.find((g) => g.id === id)
    // 配下のページも消えるので、編集中・表示中がその中にあれば畳む
    const holdsEditing =
      editing !== null && (editing.id === id || (removed?.pages.some((p) => p.id === editing.id) ?? false))
    const holdsActive = removed?.pages.some((p) => p.id === activePageId) ?? false

    setGroups((prev) => prev.filter((g) => g.id !== id))
    setOpenGroups((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)))
    if (holdsEditing) setEditing(null)
    if (holdsActive) {
      const next = groups.filter((g) => g.id !== id).flatMap((g) => g.pages)[0]
      router.replace(next ? pagePath(next.id) : NOTES_PATH)
    }

    void runSave(
      () => deletePageRow(id),
      'グループを削除できませんでした',
      () => {
        setGroups(snapshot)
        setOpenGroups(previousOpenGroups)
        if (previousActiveId) router.replace(pagePath(previousActiveId))
      }
    )
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
    error: error ?? contentError,
    currentUser,
    profiles,
    partner,
    contentPageId,
    initialContent,
    handleContentChange,
    renamePage: (id: string, title: string) => applyRename(id, 'page', title),
    setDrawerOpen,
    setCollapsed,
    selectPage,
    toggleGroup,
    addGroup,
    addPage,
    startRename,
    reorderPages,
    reorderGroups,
    removePage,
    removeGroup,
    commitEdit,
    cancelEdit,
    dismissError: () => {
      setError(null)
      dismissContentError()
    },
  }

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}
