export type User = {
  id: string
  name: string
  initial: string
  color: string
}

/**
 * サイドバーの子ページ。DB 上は pages テーブルの parent_id が入っている行。
 */
export type Page = {
  id: string
  groupId: string
  title: string
  /** 最終更新者の auth.users.id。表示名の解決は resolveUserName() で行う */
  updatedById: string | null
  /** ISO8601。表示は formatRelativeTime() で相対表記にする */
  updatedAt: string | null
}

/**
 * サイドバーのグループ。DB 上は pages テーブルの parent_id が null の行。
 */
export type Group = {
  id: string
  name: string
  pages: Page[]
}

export const users: User[] = [
  { id: 'haruka', name: 'はるか', initial: 'は', color: 'bg-primary text-primary-foreground' },
  { id: 'takumi', name: 'たくみ', initial: 'た', color: 'bg-presence text-primary-foreground' },
]

/** 新規作成時の既定タイトル（DB 側の default '無題' と揃えている） */
export const DEFAULT_PAGE_TITLE = '無題'
export const DEFAULT_GROUP_TITLE = '無題のグループ'

/**
 * updated_by は uuid のみを持ち、表示名を引ける profiles テーブルがまだ無い。
 * 自分の更新なら自分の名前、それ以外は「パートナー」と表示する。
 */
export function resolveUserName(
  userId: string | null,
  currentUser: { id: string; name: string } | null,
): string {
  if (!userId) return '不明'
  if (currentUser && userId === currentUser.id) return currentUser.name
  return 'パートナー'
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '-'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '-'

  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 60) return 'たった今'
  if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 60 * 60 * 24) return `${Math.floor(diffSec / 3600)}時間前`
  if (diffSec < 60 * 60 * 24 * 7) return `${Math.floor(diffSec / 86400)}日前`

  return new Date(then).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}
