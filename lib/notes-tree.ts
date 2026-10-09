/**
 * サイドバーのツリー（Group[]）に対する純粋な操作。
 * React にも Supabase にも触らないので、notes-context.tsx から切り離してここに置く。
 */
import { toPage, type PageRow } from '@/lib/notes-api'
import { DEFAULT_GROUP_TITLE, DEFAULT_PAGE_TITLE, type Group, type Page } from '@/lib/notes-data'

/** グループ（parent_id が null の行）か、その中のページか */
export type EditKind = 'group' | 'page'

const DRAFT_PREFIX = 'draft-'

/** 未保存の新規行に振る id。INSERT が返ってくるまでの間だけ使う */
export const newDraftId = (): string => `${DRAFT_PREFIX}${Date.now()}`

export const isDraftId = (id: string): boolean => id.startsWith(DRAFT_PREFIX)

/** 空欄のまま確定されたときは DB 側の default と揃えたタイトルにする */
export const resolveTitle = (value: string, kind: EditKind): string => {
  return value.trim() || (kind === 'group' ? DEFAULT_GROUP_TITLE : DEFAULT_PAGE_TITLE)
}

export const findPage = (groups: Group[], pageId: string | null): Page | null => {
  if (!pageId) return null
  for (const group of groups) {
    const page = group.pages.find((p) => p.id === pageId)
    if (page) return page
  }
  return null
}

export const findTitle = (groups: Group[], id: string, kind: EditKind): string | null => {
  if (kind === 'group') return groups.find((g) => g.id === id)?.name ?? null
  return findPage(groups, id)?.title ?? null
}

export const findGroupIdOfPage = (groups: Group[], pageId: string): string | null => {
  return groups.find((g) => g.pages.some((p) => p.id === pageId))?.id ?? null
}

export const renameNode = (groups: Group[], id: string, kind: EditKind, name: string): Group[] => {
  if (kind === 'group') {
    return groups.map((g) => (g.id === id ? { ...g, name } : g))
  }
  return groups.map((g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === id ? { ...p, title: name } : p)),
  }))
}

export const replaceDraft = (groups: Group[], draftId: string, kind: EditKind, row: PageRow): Group[] => {
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
export const nextPosition = (siblings: { position: number | null }[]): number => {
  return siblings.reduce((max, s) => Math.max(max, s.position ?? -1), -1) + 1
}

/**
 * 並び替えの計算。並べ直した配列と、DB に書き戻す必要のある行だけを返す。
 * position は必ず 0 から振り直すので、null や重複が入っていた行もここで揃う。
 * 動かせないとき（範囲外 / 未保存の下書きを含む）は null。
 */
export const applyReorder = <T extends { id: string; position: number | null }>(
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
export const neighborPageId = (groups: Group[], removedId: string): string | null => {
  const group = groups.find((g) => g.pages.some((p) => p.id === removedId))
  if (group) {
    const index = group.pages.findIndex((p) => p.id === removedId)
    const sibling = group.pages[index + 1] ?? group.pages[index - 1]
    if (sibling) return sibling.id
  }
  return groups.flatMap((g) => g.pages).find((p) => p.id !== removedId)?.id ?? null
}
