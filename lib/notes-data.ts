export type User = {
  id: string
  name: string
  initial: string
  color: string
}

export type Page = {
  id: string
  title: string
  updatedBy: string
  updatedAt: string
}

export type Group = {
  id: string
  name: string
  pages: Page[]
}

export const users: User[] = [
  { id: 'haruka', name: 'はるか', initial: 'は', color: 'bg-primary text-primary-foreground' },
  { id: 'takumi', name: 'たくみ', initial: 'た', color: 'bg-presence text-primary-foreground' },
]

export const groups: Group[] = [
  {
    id: 'home',
    name: '家のこと',
    pages: [
      { id: 'cleaning', title: '掃除当番表', updatedBy: 'はるか', updatedAt: '3分前' },
      { id: 'trash', title: 'ゴミ出しカレンダー', updatedBy: 'たくみ', updatedAt: '昨日' },
      { id: 'shopping', title: '買い物リスト', updatedBy: 'はるか', updatedAt: '2日前' },
    ],
  },
  {
    id: 'nursery',
    name: '保育園のこと',
    pages: [
      { id: 'belongings', title: '持ち物リスト', updatedBy: 'たくみ', updatedAt: '1時間前' },
      { id: 'events', title: '行事予定', updatedBy: 'はるか', updatedAt: '4日前' },
      { id: 'contact', title: '連絡帳メモ', updatedBy: 'たくみ', updatedAt: '1週間前' },
    ],
  },
]
