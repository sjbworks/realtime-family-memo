'use client'

import { GripVertical, Plus } from 'lucide-react'
import { formatRelativeTime, resolveUserName, type Page } from '@/lib/notes-data'

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'todo'; text: string; done: boolean }
  | { type: 'quote'; text: string }

const sampleContent: Record<string, Block[]> = {
  cleaning: [
    { type: 'h2', text: '今週の担当' },
    { type: 'p', text: '曜日ごとにゆるく分担しています。無理なときは声をかけて交代でOK。' },
    { type: 'todo', text: '月・水・金：リビングと水回り（はるか）', done: true },
    { type: 'todo', text: '火・木：キッチンとゴミまとめ（たくみ）', done: false },
    { type: 'todo', text: '土：一緒に大掃除タイム', done: false },
    { type: 'h2', text: 'メモ' },
    { type: 'bullet', text: '洗剤のストックが残りわずか' },
    { type: 'bullet', text: '浴室の換気扇フィルターは月末に交換' },
    { type: 'quote', text: '完璧を目指さず、7割できたら花丸にしよう。' },
  ],
  belongings: [
    { type: 'h2', text: '毎日の持ち物' },
    { type: 'todo', text: '連絡帳', done: true },
    { type: 'todo', text: 'お着替え一式（上下・下着）', done: true },
    { type: 'todo', text: 'エプロン2枚', done: false },
    { type: 'todo', text: 'お昼寝用タオルケット（金曜持ち帰り）', done: false },
    { type: 'h2', text: '名前つけリスト' },
    { type: 'bullet', text: 'コップ・歯ブラシ' },
    { type: 'bullet', text: '長靴とレインコート' },
    { type: 'quote', text: '週明けは補充を忘れずに！日曜夜にふたりでチェック。' },
  ],
}

const defaultContent: Block[] = [
  { type: 'p', text: 'ここにメモを書いていきます。「/」でブロックを追加できます。' },
  { type: 'bullet', text: '箇条書きで気軽にメモ' },
  { type: 'todo', text: 'やることを追加してみる', done: false },
]

function BlockControls() {
  return (
    <div className="absolute -left-12 top-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100">
      <button
        type="button"
        aria-label="ブロックを追加"
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        aria-label="ブロックを移動"
        className="inline-flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  )
}

function renderBlock(block: Block, i: number) {
  const base = 'group/block relative'
  switch (block.type) {
    case 'h1':
      return (
        <div key={i} className={base}>
          <BlockControls />
          <h2 className="mt-4 text-2xl font-bold text-foreground text-balance">{block.text}</h2>
        </div>
      )
    case 'h2':
      return (
        <div key={i} className={base}>
          <BlockControls />
          <h3 className="mt-5 text-lg font-bold text-foreground text-balance">{block.text}</h3>
        </div>
      )
    case 'p':
      return (
        <div key={i} className={base}>
          <BlockControls />
          <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>
        </div>
      )
    case 'bullet':
      return (
        <div key={i} className={`${base} flex items-start gap-2`}>
          <BlockControls />
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
          <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>
        </div>
      )
    case 'todo':
      return (
        <div key={i} className={`${base} flex items-start gap-2`}>
          <BlockControls />
          <span
            className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded border ${
              block.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
            }`}
            aria-hidden
          >
            {block.done && (
              <svg viewBox="0 0 12 12" className="size-3" fill="none">
                <path
                  d="M2.5 6.2 5 8.5 9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <p
            className={`text-[15px] leading-relaxed ${
              block.done ? 'text-muted-foreground line-through' : 'text-foreground/90'
            }`}
          >
            {block.text}
          </p>
        </div>
      )
    case 'quote':
      return (
        <div key={i} className={base}>
          <BlockControls />
          <blockquote className="border-l-2 border-primary pl-4 text-[15px] italic leading-relaxed text-muted-foreground">
            {block.text}
          </blockquote>
        </div>
      )
  }
}

type Props = {
  page: Page
  currentUser: { id: string; name: string } | null
}

export function NoteEditor({ page, currentUser }: Props) {
  const blocks = sampleContent[page.id] ?? defaultContent

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

      {/* Blocks */}
      <div className="mt-6 flex flex-col gap-2 pl-0 md:pl-12">
        {blocks.map((block, i) => renderBlock(block, i))}

        {/* empty trailing line to add blocks */}
        <div className="group/block relative">
          <BlockControls />
          <p className="text-[15px] leading-relaxed text-muted-foreground/60">
            「/」でコマンド、入力で本文を追加…
          </p>
        </div>
      </div>
    </div>
  )
}
