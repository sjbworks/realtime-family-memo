/**
 * Supabase Auth のエラーを画面に出す日本語メッセージへ変換する。
 *
 * 「失敗しました、もう一度」だけを出すと、弱いパスワードで弾かれたのか
 * リンクが切れたのかレート制限なのかが切り分けられない。既知のコードは
 * 対処のしかたまで書き、未知のコードは元の message を括弧で添える
 * （ユーザーがそのまま伝えられる状態にしておく）。
 *
 * コードは Supabase の error code 一覧より:
 * https://supabase.com/docs/guides/auth/debugging/error-codes
 */

type MaybeAuthError = {
  code?: string | null
  status?: number | null
  message?: string | null
} | null

const EXPIRED =
  'ログインの有効期限が切れました。ログイン画面から「パスワードを再設定」でメールを送り直し、新しいリンクからやり直してください。'

/** パスワード設定（updateUser({ password })）の失敗メッセージ。 */
export const messageForPasswordUpdateError = (error: MaybeAuthError): string => {
  const code = error?.code ?? null
  const status = error?.status ?? null
  const raw = error?.message ?? null

  switch (code) {
    case 'weak_password':
      // Supabase 側のパスワード要件（文字種・最小長）や漏洩パスワード検査で弾かれた
      return `このパスワードは使えません。英大文字・小文字・数字・記号を混ぜた、より長いものにしてください。${
        raw ? `（${raw}）` : ''
      }`
    case 'same_password':
      return '今までと同じパスワードは使えません。別のパスワードにしてください。'
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return EXPIRED
    case 'session_not_found':
    case 'session_expired':
    case 'user_not_found':
    case 'refresh_token_not_found':
      return EXPIRED
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '試行回数が多すぎます。少し時間をおいてからもう一度お試しください。'
    case 'insufficient_aal':
      return '2段階認証の確認が必要です。ログイン画面からやり直してください。'
    default:
      break
  }

  if (status === 401 || status === 403) return EXPIRED
  if (status === 429) return '試行回数が多すぎます。少し時間をおいてからもう一度お試しください。'

  return `パスワードを設定できませんでした（${raw ?? code ?? '原因不明'}）。この文言のまま伝えてもらえると原因が分かります。`
}
