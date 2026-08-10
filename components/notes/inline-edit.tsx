'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'

type Props = {
  initial: string
  placeholder?: string
  onCommit: (value: string) => void
  onCancel: () => void
  className?: string
}

export function InlineEdit({ initial, placeholder, onCommit, onCancel, className }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  // guard so blur doesn't fire a second commit/cancel after Enter/Escape
  const settled = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function commit() {
    if (settled.current) return
    settled.current = true
    onCommit(ref.current?.value ?? '')
  }

  function cancel() {
    if (settled.current) return
    settled.current = true
    onCancel()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // respect IME composition (CJK input)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={initial}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      className={className}
    />
  )
}
