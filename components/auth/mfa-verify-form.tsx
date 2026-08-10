'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

/**
 * ログイン時の 2 段階認証（TOTP）コード入力。
 * メール+パスワード認証で aal1 に到達したあと、登録済み factor に対して
 * 6 桁コードを検証して aal2 まで引き上げる。
 */
export function MfaVerifyForm() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const initialized = useRef(false)

  // 認証済みの TOTP factor を取得する
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error || !data) {
        setError('認証情報の取得に失敗しました。時間をおいて再度お試しください。')
        setReady(true)
        return
      }
      const totp = data.totp.find((f) => f.status === 'verified')
      if (!totp) {
        // 認証済み factor が無ければ登録画面へ
        router.replace('/auth/mfa/enroll')
        return
      }
      setFactorId(totp.id)
      setReady(true)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    })

    if (error) {
      setError('コードが正しくありません。もう一度お試しください。')
      setCode('')
      setLoading(false)
      return
    }

    router.replace('/notes')
    router.refresh()
  }

  async function handleCancel() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-balance">2段階認証</h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          認証アプリに表示されている6桁のコードを入力してください
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              認証コード
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              disabled={!ready || loading}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-center text-lg tracking-[0.5em] text-foreground outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!ready || loading || code.length !== 6}
            className="mt-2 h-11 w-full"
          >
            {loading ? '確認中...' : '認証する'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            className="h-9 w-full"
          >
            ログイン画面に戻る
          </Button>
        </div>
      </form>
    </div>
  )
}
