'use client'

import { useSyncExternalStore } from 'react'

/**
 * globals.css のダーク判定と同じ条件を JS 側でも見る。
 * `.dark` / `.light` の明示指定が無いときだけ OS 設定にフォールバックする。
 *
 * NOTE: components/theme-toggle.tsx は `.dark` の有無だけを見ており、
 * OS がダーク・クラス未指定のときの判定がここと一致しない。
 */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)

  return () => {
    observer.disconnect()
    media.removeEventListener('change', callback)
  }
}

function getSnapshot() {
  const root = document.documentElement
  if (root.classList.contains('dark')) return true
  if (root.classList.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useIsDarkTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
