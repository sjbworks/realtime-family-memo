import type { ReactNode } from 'react'
import { NotesApp } from '@/components/notes/notes-app'
import { NotesProvider } from '@/components/notes/notes-context'

/**
 * 開いているページは URL（/notes/<pageId>）が持つ。
 * ページを切り替えるたびにツリーを読み直さずに済むよう、画面一式はセグメントを
 * またいで残る layout 側に置き、page.tsx は何も描画しない。
 */
export default function NotesLayout({ children }: { children: ReactNode }) {
  return (
    <NotesProvider>
      <NotesApp />
      {children}
    </NotesProvider>
  )
}
