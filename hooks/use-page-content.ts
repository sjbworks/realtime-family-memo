'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Block, PartialBlock } from '@blocknote/core'
import { fetchPageContent, toErrorMessage, updatePageContent } from '@/lib/notes-api'

/** 入力が止まってから pages.content を UPDATE するまでの待ち時間 */
const SAVE_DEBOUNCE_MS = 800

export type ContentStatus = 'idle' | 'saving' | 'saved' | 'error'

/** 読み込みが完了した本文。どのページのものかを持たせてエディタの key に使う */
type LoadedContent = { pageId: string; blocks: PartialBlock[] | null }

export type PageContentState = {
  /** 本文の読み込みが済んでいるページ id。開いているページと一致したらエディタを出す */
  contentPageId: string | null
  /** BlockNote の initialContent。null は空ドキュメント（BlockNote の既定に任せる） */
  initialContent: PartialBlock[] | null
  contentStatus: ContentStatus
  contentError: string | null
  handleContentChange: (blocks: Block[]) => void
  dismissContentError: () => void
}

/**
 * 開いているページの本文を読み込み、編集を debounce して保存する。
 *
 * 保存は last-write-wins。CRDT も差分マージもしないので、ふたりが同じページを
 * 同時に編集すると後に書いた側の内容で丸ごと上書きされる。
 *
 * NOTE: 現時点で pages.content を購読している Realtime は無いので、外から来た更新で
 * エディタが再描画されることはない。あとで購読を足すときは、そのままエディタへ
 * 流し込まないこと。BlockNote は key を変えると作り直しになるため、
 * カーソル位置と IME の変換中の文字が飛ぶ。最低限:
 *   - 自分が書いた更新は無視する（updated_by が自分 / 送信直後の echo）
 *   - pendingRef に未保存の変更がある間は反映しない
 *   - 反映するとしても replaceBlocks() で差分を当てるか、
 *     「パートナーが更新しました。再読み込みしますか？」を出してユーザーに委ねる
 */
export function usePageContent(pageId: string | null, userId: string | null): PageContentState {
  const [loaded, setLoaded] = useState<LoadedContent | null>(null)
  const [status, setStatus] = useState<ContentStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** まだ DB に書けていない最新ドキュメント。ページ切り替え時の書き出しにも使う */
  const pendingRef = useRef<{ pageId: string; blocks: Block[] } | null>(null)
  const mountedRef = useRef(true)
  /** 遅れて返ってきた古い保存レスポンスで状態を上書きしないための世代番号 */
  const saveSeqRef = useRef(0)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  /** 溜まっている変更を debounce の残り時間を待たずに書き出す */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null

    if (!userId) {
      if (mountedRef.current) {
        setError('ログイン情報を取得できませんでした')
        setStatus('error')
      }
      return
    }

    const seq = ++saveSeqRef.current
    try {
      await updatePageContent(pending.pageId, pending.blocks, userId)
      // 保存中にさらに入力が来ていたら、まだ「保存済み」ではない
      if (mountedRef.current && seq === saveSeqRef.current && !pendingRef.current) {
        setError(null)
        setStatus('saved')
      }
    } catch (e) {
      if (mountedRef.current && seq === saveSeqRef.current) {
        setError(toErrorMessage(e, 'メモの内容を保存できませんでした'))
        setStatus('error')
      }
    }
  }, [userId])

  // ページを開いたら本文を読む。読み込み中と失敗時は loaded を差し替えないので
  // contentPageId が開いているページと一致せず、エディタは出ない。
  // 中身の分からないページを空ドキュメントで上書きしてしまうのを防ぐため。
  useEffect(() => {
    if (!pageId) return

    let cancelled = false

    fetchPageContent(pageId)
      .then((blocks) => {
        if (!cancelled) setLoaded({ pageId, blocks })
      })
      .catch((e) => {
        if (!cancelled) setError(toErrorMessage(e, 'メモの内容を読み込めませんでした'))
      })

    return () => {
      cancelled = true
    }
  }, [pageId])

  // ページを切り替える / 画面を離れるときは debounce 待ちの変更を取りこぼさない。
  // pendingRef が書き込み先のページ id を持っているので、切り替え後の
  // ページに誤って書くことはない。
  useEffect(
    () => () => {
      void flush()
    },
    [pageId, flush]
  )

  // debounce 中にタブを閉じるとその分の編集が消えるため、そのときだけ確認を出す
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const contentPageId = loaded?.pageId ?? null

  const handleContentChange = useCallback(
    (blocks: Block[]) => {
      if (!contentPageId) return

      pendingRef.current = { pageId: contentPageId, blocks }
      setStatus('saving')

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void flush()
      }, SAVE_DEBOUNCE_MS)
    },
    [contentPageId, flush]
  )

  const dismissContentError = useCallback(() => {
    setError(null)
    setStatus((prev) => (prev === 'error' ? 'idle' : prev))
  }, [])

  return {
    contentPageId,
    initialContent: loaded?.blocks ?? null,
    contentStatus: status,
    contentError: error,
    handleContentChange,
    dismissContentError,
  }
}
