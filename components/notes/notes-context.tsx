'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { groups as initialGroups, users, type Group, type Page } from '@/lib/notes-data'

type EditKind = 'group' | 'page'
type Editing = { id: string; kind: EditKind; isNew: boolean } | null

type NotesContextValue = {
  groups: Group[]
  openGroups: Record<string, boolean>
  activePageId: string
  activePage: Page
  editingId: string | null
  drawerOpen: boolean
  collapsed: boolean
  saving: boolean
  setDrawerOpen: (open: boolean) => void
  setCollapsed: (collapsed: boolean) => void
  selectPage: (id: string) => void
  toggleGroup: (id: string) => void
  addGroup: () => void
  addPage: (groupId: string) => void
  commitEdit: (value: string) => void
  cancelEdit: () => void
}

const NotesContext = createContext<NotesContextValue | null>(null)

export function useNotes() {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotes must be used within NotesProvider')
  return ctx
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    home: true,
    nursery: true,
  })
  const [activePageId, setActivePageId] = useState('cleaning')
  const [editing, setEditing] = useState<Editing>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)

  const allPages = useMemo(() => groups.flatMap((g) => g.pages), [groups])
  const activePage =
    allPages.find((p) => p.id === activePageId) ?? groups[0]?.pages[0] ?? allPages[0]

  // simulate autosave when switching pages: setSaving(true) is triggered from
  // the event handlers below, and this effect clears it after a delay.
  useEffect(() => {
    if (!saving) return
    const t = setTimeout(() => setSaving(false), 1000)
    return () => clearTimeout(t)
  }, [saving])

  function selectPage(id: string) {
    setActivePageId(id)
    setDrawerOpen(false)
    setSaving(true)
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function addGroup() {
    const id = `group-${Date.now()}`
    setGroups((prev) => [...prev, { id, name: '', pages: [] }])
    setOpenGroups((prev) => ({ ...prev, [id]: true }))
    setEditing({ id, kind: 'group', isNew: true })
  }

  function addPage(groupId: string) {
    const id = `page-${Date.now()}`
    setOpenGroups((prev) => ({ ...prev, [groupId]: true }))
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              pages: [
                ...g.pages,
                { id, title: '', updatedBy: users[0].name, updatedAt: 'たった今' },
              ],
            }
          : g,
      ),
    )
    setEditing({ id, kind: 'page', isNew: true })
  }

  function commitEdit(value: string) {
    if (!editing) return
    const trimmed = value.trim()
    if (editing.kind === 'group') {
      const name = trimmed || '無題のグループ'
      setGroups((prev) => prev.map((g) => (g.id === editing.id ? { ...g, name } : g)))
    } else {
      const title = trimmed || '無題'
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          pages: g.pages.map((p) => (p.id === editing.id ? { ...p, title } : p)),
        })),
      )
      // navigate to the freshly created page
      setActivePageId(editing.id)
      setDrawerOpen(false)
      setSaving(true)
    }
    setEditing(null)
  }

  function cancelEdit() {
    if (!editing) return
    if (editing.isNew) {
      if (editing.kind === 'group') {
        setGroups((prev) => prev.filter((g) => g.id !== editing.id))
      } else {
        setGroups((prev) =>
          prev.map((g) => ({ ...g, pages: g.pages.filter((p) => p.id !== editing.id) })),
        )
      }
    }
    setEditing(null)
  }

  const value: NotesContextValue = {
    groups,
    openGroups,
    activePageId,
    activePage,
    editingId: editing?.id ?? null,
    drawerOpen,
    collapsed,
    saving,
    setDrawerOpen,
    setCollapsed,
    selectPage,
    toggleGroup,
    addGroup,
    addPage,
    commitEdit,
    cancelEdit,
  }

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}
