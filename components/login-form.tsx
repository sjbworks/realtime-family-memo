'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { SET_PASSWORD_PATH, redirectTargetFromLocation } from '@/lib/auth-redirect'
import { useAuthLink } from '@/hooks/use-auth-link'

export function LoginForm() {
  const router = useRouter()
  // 招待メールのリンクは Site URL（= この画面）に戻ってくるので、ここで受け取る
  const link = useAuthLink()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  // 招待 / パスワード再設定リンクからセッションが張れたら、パスワードを決めてもらう
  useEffect(() => {
    if (!link.signedIn) return
    const needsPassword = link.type === 'invite' || link.type === 'recovery' || link.type === null
    router.replace(needsPassword ? SET_PASSWORD_PATH : redirectTargetFromLocation())
    router.refresh()
  }, [link.signedIn, link.type, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません。')
      setLoading(false)
      return
    }

    // サーバー側のセッション状態を反映させてから遷移する。
    // 共有 URL から飛ばされてきていれば、そのページへ戻す
    router.replace(redirectTargetFromLocation())
    router.refresh()
  }

  // 招待メールのリンクが切れていた場合もここから再発行できる
  const handleResetPassword = async () => {
    setError(null)
    if (!email) {
      setError('メールアドレスを入力してから押してください。')
      return
    }

    setResetting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${SET_PASSWORD_PATH}`,
    })
    setResetting(false)

    if (error) {
      setError('メールを送信できませんでした。時間をおいてもう一度お試しください。')
      return
    }
    setResetSent(true)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <NotebookPen className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-balance">ふたりノート</h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">夫婦で家事や保育園の情報を共有するメモ</p>
      </div>

      {link.pending || link.signedIn ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="py-4 text-center text-sm text-muted-foreground">確認しています...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {link.error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty">
                {link.error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>

            {resetSent ? (
              <p className="text-center text-xs text-muted-foreground text-pretty">
                パスワード設定用のメールを送りました。
                <br />
                同じブラウザでメール内のリンクを開いてください。
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="text-center text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-60"
              >
                {resetting ? '送信中...' : 'パスワードを設定・再設定する'}
              </button>
            )}
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground text-pretty">
        招待制のため、新規登録はありません。
        <br />
        パートナーから招待を受け取ってください。
      </p>
    </div>
  )
}
