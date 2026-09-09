/**
 * 共有された /notes/<pageId> の URL を未ログインで踏むと、middleware がログイン /
 * 2 段階認証の画面へ飛ばしてしまう。認証を終えたあとに元の URL へ戻せるよう、
 * 行き先を redirect クエリで持ち回すためのヘルパー。
 */

export const REDIRECT_PARAM = 'redirect'
export const DEFAULT_REDIRECT = '/notes'

/**
 * 戻り先として使ってよい値だけを通す。オープンリダイレクトを避けるため、
 * 同一オリジンのノート画面（/notes 配下）以外は既定の /notes に丸める。
 */
export const sanitizeRedirect = (value: string | null | undefined): string => {
  if (!value) return DEFAULT_REDIRECT
  if (value !== DEFAULT_REDIRECT && !value.startsWith(`${DEFAULT_REDIRECT}/`) && !value.startsWith(`${DEFAULT_REDIRECT}?`)) {
    return DEFAULT_REDIRECT
  }
  return value
}

/** 認証フォームから呼ぶ、いま開いている URL の redirect クエリ（無ければ /notes） */
export const redirectTargetFromLocation = (): string => {
  if (typeof window === 'undefined') return DEFAULT_REDIRECT
  return sanitizeRedirect(new URLSearchParams(window.location.search).get(REDIRECT_PARAM))
}
