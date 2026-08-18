'use client'

import dynamic from 'next/dynamic'
import { formatRelativeTime, resolveUserName, type Page } from '@/lib/notes-data'
import { useNotes } from '@/components/notes/notes-context'

// BlockNote は ProseMirror ベースで SSR できないうえ重いので、クライアント側で遅延読み込みする
const PageBlockEditor = dynamic(
  () => import('@/components/notes/page-block-editor').then((m) => m.PageBlockEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
)

function EditorSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-3 md:pl-12" aria-hidden>
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
    </div>
  )
}

type Props = {
  page: Page
  currentUser: { id: string; name: string } | null
}

export function NoteEditor({ page, currentUser }: Props) {
  const { contentPageId, initialContent, handleContentChange } = useNotes()

  // 本文がまだ届いていない（または読み込みに失敗した）ページではエディタを出さない。
  // 空ドキュメントで既存の内容を上書きしてしまうのを防ぐため。
  const contentReady = contentPageId === page.id

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 md:px-8 md:py-10">
      {/* Title */}
      <h1
        key={page.id}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className="text-2xl font-bold tracking-tight text-foreground outline-none text-balance md:text-3xl"
      >
        {page.title}
      </h1>

      {/* Meta */}
      <p className="mt-2 text-xs text-muted-foreground">
        最終更新: {resolveUserName(page.updatedById, currentUser)} ・{' '}
        {formatRelativeTime(page.updatedAt)}
      </p>

      {/* Body */}
      <div className="mt-6">
        {contentReady ? (
          <PageBlockEditor
            key={page.id}
            initialContent={initialContent}
            onChange={handleContentChange}
          />
        ) : (
          <EditorSkeleton />
        )}
      </div>
    </div>
  )
}
