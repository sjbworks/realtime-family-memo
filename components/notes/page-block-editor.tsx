'use client'

import type { Block, PartialBlock } from '@blocknote/core'
import { ja } from '@blocknote/core/locales'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useIsDarkTheme } from '@/hooks/use-is-dark-theme'

type Props = {
  /** null なら BlockNote 既定の空ドキュメントから始める */
  initialContent: PartialBlock[] | null
  onChange: (blocks: Block[]) => void
}

/**
 * BlockNote 本体。SSR できないので note-editor.tsx から dynamic(ssr:false) で読む。
 *
 * useCreateBlockNote は deps 既定 [] で一度しかエディタを作らない。initialContent の
 * 差し替えは効かないので、ページを切り替えるときは呼び出し側が key を変えて
 * 丸ごと再マウントさせること。
 */
export function PageBlockEditor({ initialContent, onChange }: Props) {
  const isDark = useIsDarkTheme()

  const editor = useCreateBlockNote({
    initialContent: initialContent ?? undefined,
    dictionary: ja,
  })

  return (
    <BlockNoteView
      editor={editor}
      theme={isDark ? 'dark' : 'light'}
      // ドラッグハンドル / ＋ ボタンはブロックの左外側に出るので、その分の余白を確保する
      className="bn-page-editor md:pl-12"
      onChange={(instance) => onChange(instance.document)}
    />
  )
}
