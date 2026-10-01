'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** グループ行の並びか、あるグループ配下のページの並びか */
export type ReorderKind = 'group' | 'page'

export type ReorderHandler = (
  kind: ReorderKind,
  /** ページなら親グループ id、グループなら null */
  listId: string | null,
  fromIndex: number,
  toIndex: number
) => void

export type DragState = {
  kind: ReorderKind
  listId: string | null
  fromIndex: number
  toIndex: number
  /** 挿入線を引く位置（ul の上端からの px）。並びが変わらない位置では null */
  indicatorTop: number | null
}

export type ReorderHandleArgs = {
  kind: ReorderKind
  listId: string | null
  index: number
  /** 並びの長さ。1 件しかないリストでは掴めないようにする */
  count: number
  /** aria-label に使う行の名前 */
  label: string
}

/** ドラッグ開始と判定するまでの移動量。つまみのタップだけで動き出さないようにする */
const DRAG_THRESHOLD = 4

/** 行の位置。すべて ul の上端を基準にした相対値で持つ */
type Measurement = { top: number; height: number }

type Session = {
  kind: ReorderKind
  listId: string | null
  fromIndex: number
  toIndex: number
  /** 掴んだ行。transform は state を介さず直接書いて指に追従させる */
  row: HTMLElement
  /** 行を並べている ul。位置の基準 */
  list: HTMLElement
  /** 掴んだ時点の各行の位置。ドラッグ中は他の行を動かさないので測り直さない */
  items: Measurement[]
  startY: number
  /** 閾値を超えてドラッグとして成立したか */
  active: boolean
  pointerId: number
}

/** 指の位置が、掴んだ行を抜いた並びの何番目に当たるか */
const targetIndex = (items: Measurement[], fromIndex: number, y: number): number => {
  let to = fromIndex

  for (let i = 0; i < items.length; i++) {
    if (i === fromIndex) continue
    const middle = items[i].top + items[i].height / 2
    // 上へ: 中間点を越えた最初の行の位置に入る
    if (i < fromIndex) {
      if (y < middle) return i
      continue
    }
    // 下へ: 中間点を越えた最後の行の直後に入る
    if (y > middle) to = i
  }

  return to
}

const indicatorTop = (items: Measurement[], fromIndex: number, toIndex: number): number | null => {
  if (toIndex === fromIndex) return null
  const item = items[toIndex]
  return toIndex < fromIndex ? item.top : item.top + item.height
}

/**
 * サイドバーの行を掴んで並び替えるためのフック。Pointer Events なので
 * マウスでもタッチでも動く。ドラッグ中は掴んだ行だけを transform で動かし、
 * 落ちる位置は挿入線で示す（他の行を動かさないので測り直しが要らない）。
 */
export const useSidebarReorder = (onReorder: ReorderHandler) => {
  const [drag, setDrag] = useState<DragState | null>(null)
  const session = useRef<Session | null>(null)

  const snapshot = (s: Session): DragState => ({
    kind: s.kind,
    listId: s.listId,
    fromIndex: s.fromIndex,
    toIndex: s.toIndex,
    indicatorTop: indicatorTop(s.items, s.fromIndex, s.toIndex),
  })

  const finish = (commit: boolean) => {
    const s = session.current
    session.current = null
    setDrag(null)
    if (!s) return

    s.row.style.transform = ''
    if (commit && s.active && s.toIndex !== s.fromIndex) {
      onReorder(s.kind, s.listId, s.fromIndex, s.toIndex)
    }
  }

  const handleProps = ({ kind, listId, index, count, label }: ReorderHandleArgs) => ({
    'aria-label': `${label}を並び替え`,
    disabled: count < 2,
    // タッチでスクロールに取られないよう、つまみの上ではブラウザのジェスチャを切る
    style: { touchAction: 'none' as const },

    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (count < 2) return

      const handle = e.currentTarget
      const row = handle.closest('li')
      const list = row?.parentElement
      if (!row || !list) return

      const rows = [...list.querySelectorAll<HTMLElement>(':scope > li')]
      // 期待した行を掴めていない（DOM とツリーがずれている）ときは何もしない
      if (rows[index] !== row) return

      const listTop = list.getBoundingClientRect().top
      session.current = {
        kind,
        listId,
        fromIndex: index,
        toIndex: index,
        row,
        list,
        items: rows.map((el) => {
          const rect = el.getBoundingClientRect()
          return { top: rect.top - listTop, height: rect.height }
        }),
        startY: e.clientY - listTop,
        active: false,
        pointerId: e.pointerId,
      }
      handle.setPointerCapture(e.pointerId)
    },

    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = session.current
      if (!s || s.pointerId !== e.pointerId) return

      // ul の上端は毎回引き直す。基準を揃えておけばドラッグ中にスクロールしてもずれない
      const y = e.clientY - s.list.getBoundingClientRect().top
      const dy = y - s.startY

      if (!s.active) {
        if (Math.abs(dy) < DRAG_THRESHOLD) return
        s.active = true
        setDrag(snapshot(s))
      }
      s.row.style.transform = `translateY(${dy}px)`

      const to = targetIndex(s.items, s.fromIndex, y)
      if (to === s.toIndex) return
      s.toIndex = to
      setDrag(snapshot(s))
    },

    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
    // 掴んだ行が消えた等でキャプチャを失ったとき。pointerup 後は session が無いので空振りする
    onLostPointerCapture: () => finish(false),

    // ドラッグできない環境向けの経路。つまみにフォーカスして上下キーで動かす
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      if (delta === 0) return

      const to = index + delta
      if (to < 0 || to >= count) return
      e.preventDefault()
      onReorder(kind, listId, index, to)
    },
  })

  return { drag, handleProps }
}
