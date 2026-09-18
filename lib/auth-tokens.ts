import { REDIRECT_PARAM } from '@/lib/auth-redirect'
import type { createClient } from '@/lib/supabase/client'

/**
 * 招待 / パスワード再設定メールのリンクから戻ってきた URL を読み、セッションを張るためのヘルパー。
 *
 * Supabase のメールリンクは発行経路によって受け取り方が 3 通りある:
 *   - `#access_token=...&refresh_token=...` … ダッシュボードからの招待（implicit フロー）
 *   - `?code=...`                           … アプリから送った再設定メール（PKCE フロー）
 *   - `?token_hash=...&type=...`            … メールテンプレートを TokenHash 形式にした場合
 * どれも一度しか使えないので、読み取ったら URL からは消す。
 */

type SupabaseBrowserClient = ReturnType<typeof createClient>

export type AuthLinkType = 'invite' | 'recovery' | 'signup' | 'magiclink' | 'email' | 'email_change'

export type AuthLinkParams =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: AuthLinkType | null }
  | { kind: 'code'; code: string; type: AuthLinkType | null }
  | { kind: 'tokenHash'; tokenHash: string; type: AuthLinkType }
  | { kind: 'error'; message: string }

const EXPIRED_MESSAGE =
  'リンクの有効期限が切れているか、すでに使用済みです。ログイン画面から「パスワードを再設定」をやり直してください。'

const messageForError = (code: string | null, description: string): string => {
  if (code === 'otp_expired' || code === 'access_denied') return EXPIRED_MESSAGE
  return `リンクの処理に失敗しました（${description}）。`
}

/**
 * URL から認証リンクのパラメータを読む。
 * Supabase クライアントを作る前に呼ぶこと（detectSessionInUrl が先にハッシュを消してしまう）。
 */
export const readAuthLinkParams = (): AuthLinkParams | null => {
  if (typeof window === 'undefined') return null

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const pick = (key: string) => hash.get(key) ?? query.get(key)

  const errorCode = pick('error_code') ?? pick('error')
  if (errorCode) return { kind: 'error', message: messageForError(errorCode, pick('error_description') ?? errorCode) }

  const type = (pick('type') as AuthLinkType | null) ?? null

  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken, type }

  const code = query.get('code')
  if (code) return { kind: 'code', code, type }

  const tokenHash = pick('token_hash')
  if (tokenHash && type) return { kind: 'tokenHash', tokenHash, type }

  return null
}

/** 使い終わった（あるいは壊れた）リンクのパラメータを URL から消す。redirect だけは残す。 */
export const clearAuthLinkFromUrl = () => {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const redirect = url.searchParams.get(REDIRECT_PARAM)
  url.hash = ''
  url.search = ''
  if (redirect) url.searchParams.set(REDIRECT_PARAM, redirect)
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

/** 読み取ったパラメータからセッションを確立する。 */
export const consumeAuthLink = async (
  supabase: SupabaseBrowserClient,
  params: AuthLinkParams
): Promise<{ ok: boolean; message?: string }> => {
  if (params.kind === 'error') return { ok: false, message: params.message }

  if (params.kind === 'tokens') {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    })
    return error ? { ok: false, message: EXPIRED_MESSAGE } : { ok: true }
  }

  if (params.kind === 'code') {
    // PKCE は送信時に保存した code_verifier が要る = メールを開いた端末が
    // 送信した端末と違うと交換できない。
    const { error } = await supabase.auth.exchangeCodeForSession(params.code)
    return error
      ? {
          ok: false,
          message: 'リンクを開いた端末とメールを送った端末が違うか、リンクの有効期限が切れています。同じ端末・ブラウザでやり直してください。',
        }
      : { ok: true }
  }

  const { error } = await supabase.auth.verifyOtp({ type: params.type, token_hash: params.tokenHash })
  return error ? { ok: false, message: EXPIRED_MESSAGE } : { ok: true }
}
