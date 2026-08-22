'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { DEFAULT_PAGE_TITLE, formatRelativeTime, resolveUserName, type Page } from '@/lib/notes-data'
import { useNotes } from '@/components/notes/notes-context'

function EditorSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-3 md:pl-12" aria-hidden>
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
    </div>
  )
}

// BlockNote は ProseMirror ベースで SSR できないうえ重いので、クライアント側で遅延読み込みする
const PageBlockEditor = dynamic(() => import('@/components/notes/page-block-editor').then((m) => m.PageBlockEditor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

/**
 * ページ見出し兼タイトル入力。確定（blur / Enter）でサイドバーと DB に反映する。
 *
 * 中身を JSX の子要素として持たせると、保存のたびに page.title が返ってきて
 * React が contentEditable を描き直し、カーソルが先頭へ飛ぶ。そのため子要素は
 * 持たせず DOM に直接書き、外からの変更は編集中でないときだけ反映する。
 * ページを切り替えたときは呼び出し側が key を変えて作り直す。
 */
function PageTitle({ pageId, title }: { pageId: string; title: string }) {
  const { renamePage } = useNotes()
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el === document.activeElement) return
    if (el.textContent !== title) el.textContent = title
  }, [title])

  const commit = () => {
    const el = ref.current
    if (!el) return

    const next = (el.textContent ?? '').trim()
    renamePage(pageId, next)
    // 空欄のまま確定したら既定タイトルに戻る。renamePage 側の解決結果と
    // 表示を揃えるため、DOM にも同じ値を書き戻しておく。
    el.textContent = next || DEFAULT_PAGE_TITLE
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLHeadingElement>) => {
    // IME の変換確定 Enter を保存の Enter と取り違えない
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur() // blur ハンドラが commit する
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      if (ref.current) ref.current.textContent = title
      ref.current?.blur()
    }
  }

  // 見出しに書式や改行が紛れ込まないよう、貼り付けはプレーンテキストに落とす
  const handlePaste = (e: ClipboardEvent<HTMLHeadingElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ')
    // 非推奨 API だが、contentEditable の undo 履歴を保てるのは今のところこれだけ
    document.execCommand('insertText', false, text)
  }

  return (
    <h1
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      aria-label="ページタイトル"
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className="min-h-[1.2em] text-2xl font-bold tracking-tight text-foreground outline-none text-balance md:text-3xl"
    />
  )
}

type Props = {
  page: Page
  currentUser: { id: string; name: string } | null
}

export function NoteEditor({ page, currentUser }: Props) {
  const { contentPageId, initialContent, handleContentChange, profiles } = useNotes()

  // 本文がまだ届いていない（または読み込みに失敗した）ページではエディタを出さない。
  // 空ドキュメントで既存の内容を上書きしてしまうのを防ぐため。
  const contentReady = contentPageId === page.id

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 md:px-8 md:py-10">
      <PageTitle key={page.id} pageId={page.id} title={page.title} />

      {/* Meta */}
      <p className="mt-2 text-xs text-muted-foreground">
        最終更新: {resolveUserName(page.updatedById, profiles, currentUser)} ・ {formatRelativeTime(page.updatedAt)}
      </p>

      {/* Body */}
      <div className="mt-6">
        {contentReady ? (
          <PageBlockEditor key={page.id} initialContent={initialContent} onChange={handleContentChange} />
        ) : (
          <EditorSkeleton />
        )}
      </div>
    </div>
  )
}
