'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearAuthLinkFromUrl, consumeAuthLink, readAuthLinkParams, type AuthLinkType } from '@/lib/auth-tokens'

export type AuthLinkState = {
  /** リンクのトークンを処理中（この間はフォームを出さない） */
  pending: boolean
  /** リンクからセッションを確立できた */
  signedIn: boolean
  /** invite / recovery など、リンクの種類 */
  type: AuthLinkType | null
  error: string | null
}

const IDLE: AuthLinkState = { pending: false, signedIn: false, type: null, error: null }

const UNEXPECTED_MESSAGE =
  'リンクを処理できませんでした。ログイン画面から「パスワードを再設定」をやり直してください。'

/**
 * マウント時に URL の認証リンク（招待 / パスワード再設定）を一度だけ処理する。
 * 何も付いていない普通のアクセスでは何もしない。
 */
export const useAuthLink = (): AuthLinkState => {
  const [state, setState] = useState<AuthLinkState>(IDLE)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // createClient() より先に読む。Supabase クライアントは detectSessionInUrl で
    // ハッシュを自動的に消費してしまうため。
    const params = readAuthLinkParams()
    if (!params) return

    clearAuthLinkFromUrl()

    // トークンの消費（= 外部システムへの問い合わせ）を始める。
    // pending を立ててからしか await しないのは、この間ログインフォームを
    // 出してしまうとリンクを踏んだ直後に一瞬フォームがちらつくため。
    const run = async () => {
      const type = params.kind === 'error' ? null : params.type ?? null
      setState({ pending: true, signedIn: false, type, error: null })
      try {
        const result = await consumeAuthLink(createClient(), params)
        setState({ pending: false, signedIn: result.ok, type, error: result.message ?? null })
      } catch {
        // 想定内の失敗は consumeAuthLink が message で返すので、ここに来るのは
        // env 未設定や storage が触れない等の例外だけ。pending を降ろさないと
        // 「確認しています...」から戻れなくなるので、必ずフォームまで戻す。
        setState({ pending: false, signedIn: false, type, error: UNEXPECTED_MESSAGE })
      }
    }
    void run()
  }, [])

  return state
}
