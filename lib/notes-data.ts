/** public.profiles の 1 行。表示名を uuid から引くために使う */
export type Profile = {
  id: string
  name: string
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

/** アバターに出す 1 文字。サロゲートペアで割れないよう配列に展開して取る */
export const initialOf = (name: string): string => {
  return [...name.trim()][0] ?? '？'
}

/**
 * アバターの色。ユーザーは 2 人だけなので DB に色を持たせず、
 * 自分＝primary / 相手＝presence に固定する（presence バナーの配色と揃う）。
 */
export const avatarColor = (isSelf: boolean): string => {
  return isSelf ? 'bg-primary text-primary-foreground' : 'bg-presence text-primary-foreground'
}

/** 新規作成時の既定タイトル（DB 側の default '無題' と揃えている） */
export const DEFAULT_PAGE_TITLE = '無題'
export const DEFAULT_GROUP_TITLE = '無題のグループ'

/**
 * updated_by の uuid を表示名にする。
 * profiles がまだ無い / 行が欠けている環境でも壊れないよう、
 * 引けなかったときは従来どおり「パートナー」にフォールバックする。
 */
export const resolveUserName = (
  userId: string | null,
  profiles: Map<string, Profile>,
  currentUser: Profile | null
): string => {
  if (!userId) return '不明'
  if (currentUser && userId === currentUser.id) return currentUser.name
  return profiles.get(userId)?.name ?? 'パートナー'
}

export const formatRelativeTime = (iso: string | null): string => {
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
