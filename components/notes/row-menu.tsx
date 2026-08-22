'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const MENU_WIDTH = 176
const MENU_HEIGHT = 84

type Props = {
  label: string
  onRename: () => void
  onDelete: () => void
  className?: string
}

/**
 * サイドバー行の「…」メニュー。サイドバーが overflow-y-auto で切れるため、
 * メニュー本体は fixed で配置してボタン位置に合わせる。
 */
export function RowMenu({ label, onRename, onDelete, className }: Props) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!position) return

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setPosition(null)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPosition(null)
        buttonRef.current?.focus()
      }
    }
    const close = () => setPosition(null)

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    // スクロール / リサイズで座標がずれるので閉じる
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [position])

  function toggle() {
    if (position) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const flipUp = rect.bottom + MENU_HEIGHT > window.innerHeight
    setPosition({
      top: flipUp ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  function run(action: () => void) {
    setPosition(null)
    action()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={`${label}のメニュー`}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        className={cn(
          'mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-sidebar-border hover:text-sidebar-foreground',
          className,
          // メニューを開いている間は hover が外れても消さない
          position && 'bg-sidebar-border text-sidebar-foreground opacity-100 md:opacity-100'
        )}
      >
        <MoreVertical className="size-4" />
      </button>

      {position && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${label}の操作`}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRename)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Pencil className="size-4 text-muted-foreground" />
            名前を変更
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onDelete)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            削除
          </button>
        </div>
      )}
    </>
  )
}
