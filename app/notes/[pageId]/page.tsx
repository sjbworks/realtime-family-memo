/**
 * 共有 URL /notes/<pageId> の受け口。id の解釈は NotesProvider が
 * usePathname() で行うので、ここは何も描画しない（画面は layout.tsx）。
 */
export default function NotesPageById() {
  return null
}
