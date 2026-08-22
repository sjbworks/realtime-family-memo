import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser() を呼ぶことでセッション（アクセストークン）が更新される。
  // getUser と redirect の間にロジックを挟まないこと（セッション同期がずれる）。
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = path.startsWith('/notes')
  const isMfaVerify = path === '/auth/mfa'
  const isMfaEnroll = path === '/auth/mfa/enroll'
  const isMfaPage = isMfaVerify || isMfaEnroll
  const isLogin = path === '/'

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url)
  }

  // 未ログインで保護ルート / MFA ページにアクセス → ログイン画面へ
  if (!user) {
    if (isProtected || isMfaPage) return redirectTo('/')
    return supabaseResponse
  }

  // ログイン済み: 2段階認証(MFA)の到達レベルを確認する。
  //   currentLevel … 現在のセッションが到達している assurance level
  //   nextLevel    … 認証済み factor があれば "aal2"、無ければ "aal1"
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  // 認証済み factor はあるが、このセッションはまだコード未入力 → 検証が必要
  const needsVerify = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
  // 認証済み factor が無い → 2段階認証の登録が必要（必須ポリシー）
  const needsEnroll = aal?.nextLevel === 'aal1'
  const fullyAuthed = aal?.currentLevel === 'aal2'

  // コード検証が必要なら検証ページへ集約
  if (needsVerify && !isMfaVerify) return redirectTo('/auth/mfa')
  // 登録が必要なら登録ページへ集約
  if (needsEnroll && !isMfaEnroll) return redirectTo('/auth/mfa/enroll')
  // aal2 到達済みがログイン / MFA ページに留まっている → アプリへ
  if (fullyAuthed && (isLogin || isMfaPage)) return redirectTo('/notes')

  return supabaseResponse
}
