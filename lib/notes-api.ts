import { createClient } from '@/lib/supabase/client'
import type { Block, PartialBlock } from '@blocknote/core'
import type { Group, Page, Profile } from '@/lib/notes-data'

/**
 * public.pages の行。parent_id が null ならサイドバーのグループ、
 * 値が入っていればそのグループ配下のページを表す。
 */
export type PageRow = {
  id: string
  parent_id: string | null
  title: string
  position: number | null
  created_by: string | null
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type CurrentUser = { id: string; name: string }

const ROW_COLUMNS = 'id, parent_id, title, position, created_by, updated_by, created_at, updated_at'

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error

  const user = data.user
  if (!user) return null

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name =
    [meta.display_name, meta.name, meta.full_name].find((v): v is string => typeof v === 'string' && v.trim() !== '') ??
    user.email?.split('@')[0] ??
    'ユーザー'

  return { id: user.id, name }
}

/**
 * 表示名の一覧。auth.users はクライアントから読めないので public.profiles を引く。
 * 行はトリガで作られるため、アプリ側で INSERT することはない。
 */
export const fetchProfiles = async (): Promise<Profile[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from('profiles').select('id, display_name')

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.display_name as string) || 'ユーザー',
  }))
}

export const fetchPageRows = async (): Promise<PageRow[]> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pages')
    .select(ROW_COLUMNS)
    .order('position', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as PageRow[]
}

export const insertPageRow = async (input: {
  parentId: string | null
  title: string
  position: number
  userId: string
}): Promise<PageRow> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pages')
    .insert({
      parent_id: input.parentId,
      title: input.title,
      position: input.position,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select(ROW_COLUMNS)
    .single()

  if (error) throw error
  return data as PageRow
}

export const updatePageTitle = async (id: string, title: string, userId: string): Promise<void> => {
  const supabase = createClient()
  const { error } = await supabase.from('pages').update({ title, updated_by: userId }).eq('id', id)

  if (error) throw error
}

/**
 * pages.content(jsonb) は BlockNote のブロック配列をそのまま入れている。
 * 本文はサイドバーのツリーとは別に、開いたページの分だけ都度読む。
 */
export const fetchPageContent = async (id: string): Promise<PartialBlock[] | null> => {
  const supabase = createClient()
  const { data, error } = await supabase.from('pages').select('content').eq('id', id).single()

  if (error) throw error

  // 未編集のページは null または [] なので、空ドキュメント扱いの null に寄せる
  const content = (data as { content: unknown } | null)?.content
  if (!Array.isArray(content) || content.length === 0) return null
  return content as PartialBlock[]
}

/** 本文の保存。競合解決はせず last-write-wins（後から書いた側が勝つ） */
export const updatePageContent = async (id: string, content: Block[], userId: string): Promise<void> => {
  const supabase = createClient()
  const { error } = await supabase.from('pages').update({ content, updated_by: userId }).eq('id', id)

  if (error) throw error
}

/** 子ページは FK の ON DELETE CASCADE で一緒に削除される */
export const deletePageRow = async (id: string): Promise<void> => {
  const supabase = createClient()
  const { error } = await supabase.from('pages').delete().eq('id', id)
  if (error) throw error
}

export const toPage = (row: PageRow, groupId: string): Page => {
  return {
    id: row.id,
    groupId,
    title: row.title,
    updatedById: row.updated_by,
    updatedAt: row.updated_at,
  }
}

/** フラットな行の配列を、サイドバー用の 2 階層ツリーに畳む */
export const buildTree = (rows: PageRow[]): Group[] => {
  const groups: Group[] = []
  const byId = new Map<string, Group>()

  for (const row of rows) {
    if (row.parent_id !== null) continue
    const group: Group = { id: row.id, name: row.title, pages: [] }
    byId.set(group.id, group)
    groups.push(group)
  }

  for (const row of rows) {
    if (row.parent_id === null) continue
    // 孫以降の階層は今のサイドバーでは表示しないため、親がグループの行だけ拾う
    const group = byId.get(row.parent_id)
    if (!group) continue
    group.pages.push(toPage(row, group.id))
  }

  return groups
}

export const toErrorMessage = (e: unknown, fallback: string): string => {
  if (e instanceof Error && e.message) return `${fallback}（${e.message}）`
  return fallback
}
