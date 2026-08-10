import { NotesApp } from '@/components/notes/notes-app'
import { NotesProvider } from '@/components/notes/notes-context'

export default function NotesPage() {
  return (
    <NotesProvider>
      <NotesApp />
    </NotesProvider>
  )
}
