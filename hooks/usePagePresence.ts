'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type EditorInfo = { userId: string; userName: string }

/** どのページの presence かを持たせて、切り替え直後に前のページの値を返さないようにする */
type PagePresence = { pageId: string; editors: EditorInfo[] }

/**
 * 同じページを開いている他のユーザーを Supabase Realtime の presence で返す。
 *
 * pageId / userId が未確定のうちは購読しない。空文字のまま track すると
 * 相手側の presence に空のエントリが載ってしまうため。
 */
export const usePagePresence = (pageId: string | null, currentUser: EditorInfo | null): EditorInfo[] => {
  const [presence, setPresence] = useState<PagePresence | null>(null)

  // オブジェクトのまま deps に入れると毎レンダー貼り直しになるので分解して渡す
  const userId = currentUser?.userId ?? null
  const userName = currentUser?.userName ?? null

  useEffect(() => {
    if (!pageId || !userId) return

    const supabase = createClient()
    const channel = supabase.channel(`page:${pageId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<EditorInfo>()
        const editors = Object.values(state)
          .flat()
          .filter((p) => p.userId !== userId)
        setPresence({ pageId, editors })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, userName: userName ?? '' })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pageId, userId, userName])

  return presence?.pageId === pageId ? presence.editors : []
}
