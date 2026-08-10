'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

/**
 * TOTP factor の登録フロー。
 * 1. enroll で QR コードと秘密鍵を発行
 * 2. ユーザーが認証アプリに登録し、表示された 6 桁コードを入力
 * 3. challengeAndVerify で有効化 → セッションが aal2 に上がる
 */
export function MfaEnrollForm() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  // マウント時に factor を発行する（未検証の古い factor は掃除してから作り直す）
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()
    ;(async () => {
      // 途中離脱で残った未検証 factor を削除しておく
      const { data: list } = await supabase.auth.mfa.listFactors()
      if (list) {
        for (const factor of list.totp) {
          if (factor.status !== 'verified') {
            await supabase.auth.mfa.unenroll({ factorId: factor.id })
          }
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      })
      if (error || !data) {
        setError('2段階認証の準備に失敗しました。ページを再読み込みしてください。')
        return
      }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    })()
  }, [])

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
      setError('コードが正しくありません。認証アプリの表示を確認してください。')
      setCode('')
      setLoading(false)
      return
    }

    // 有効化に成功するとセッションは aal2。保護ルートへ進める。
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
          <ShieldPlus className="size-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-balance">
          2段階認証の設定
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          認証アプリ（Google Authenticator や 1Password など）で
          <br />
          QRコードを読み取ってください
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-48 items-center justify-center rounded-lg border border-border bg-white p-2">
              {qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCode} alt="2段階認証のQRコード" className="size-full" />
              ) : (
                <span className="text-sm text-muted-foreground">読み込み中...</span>
              )}
            </div>

            {secret && (
              <div className="w-full text-center">
                <p className="text-xs text-muted-foreground">
                  QRを読み取れない場合はこのキーを手動入力
                </p>
                <code className="mt-1 block break-all rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-foreground">
                  {secret}
                </code>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code" className="text-sm font-medium text-foreground">
                確認コード
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                disabled={!factorId || loading}
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
              disabled={!factorId || loading || code.length !== 6}
              className="mt-2 h-11 w-full"
            >
              {loading ? '確認中...' : '有効にする'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="h-9 w-full"
            >
              ログイン画面に戻る
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
