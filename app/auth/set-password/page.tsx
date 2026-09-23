import { SetPasswordForm } from '@/components/auth/set-password-form'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Page() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <SetPasswordForm />
    </main>
  )
}
