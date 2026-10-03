'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_REDIRECT, SET_PASSWORD_PATH, redirectTargetFromLocation } from '@/lib/auth-redirect'
import { useAuthLink } from '@/hooks/use-auth-link'

const MIN_LENGTH = 8

/**
 * 招待メール / パスワード再設定メールから辿り着く、パスワードを決める画面。
 * リンクのトークンは useAuthLink が処理済み（このページに直接 redirect_to した場合）か、
 * ログイン画面で処理済み（ダッシュボードからの招待は Site URL = / に戻ってくる）。
 */
export function SetPasswordForm() {
  const router = useRouter()
  const link = useAuthLink()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  // リンクの処理が終わってからセッションの有無を確かめる（無ければフォームを出さない）
  useEffect(() => {
    if (link.pending) return

    const run = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setHasSession(Boolean(user))
      } catch {
        // 例外はセッション無しとして扱う。checking を降ろさないと
        // 「確認しています...」から先に進めなくなる。
        setHasSession(false)
      } finally {
        setChecking(false)
      }
    }
    void run()
  }, [link.pending])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`パスワードは${MIN_LENGTH}文字以上にしてください。`)
      return
    }
    if (password !== confirmation) {
      setError('確認用のパスワードが一致しません。')
      return
    }

    setLoading(true)

    // 例外（env 未設定 / storage が触れない等）も失敗として扱う。
    // catch しないと loading を降ろせず、ボタンが「設定中...」で固まる。
    let ok = false
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      ok = !updateError
    } catch {
      ok = false
    }

    if (!ok) {
      setError('パスワードを設定できませんでした。時間をおいてもう一度お試しください。')
      setLoading(false)
      return
    }

    // 2段階認証が未登録なら middleware が登録画面へ回してくれる。
    // 戻り先がこの画面自身（MFA 経由でここへ戻された場合）なら /notes へ。
    const target = redirectTargetFromLocation()
    router.replace(target === SET_PASSWORD_PATH ? DEFAULT_REDIRECT : target)
    router.refresh()
  }

  const linkError = link.error
  const unusable = !link.pending && !checking && !hasSession

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-balance">パスワードの設定</h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          次回からこのパスワードでログインします
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {link.pending || checking ? (
          <p className="py-4 text-center text-sm text-muted-foreground">確認しています...</p>
        ) : unusable ? (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive text-pretty">
              {linkError ?? 'リンクの有効期限が切れているか、すでに使用済みです。'}
            </p>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => router.replace('/')}>
              ログイン画面へ
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                新しいパスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <p className="text-xs text-muted-foreground">{MIN_LENGTH}文字以上</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmation" className="text-sm font-medium text-foreground">
                確認のためもう一度
              </label>
              <input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 h-11 w-full">
              {loading ? '設定中...' : 'このパスワードにする'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
