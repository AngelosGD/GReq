import { useEffect, useRef } from 'react'

export function ContextMenu({ x, y, onDuplicate, onDelete, onClose, collections, onAddToCollection, nodeId, locked, onToggleLock }: {
  x: number; y: number
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
  collections?: { id: string; name: string; nodeIds: string[] }[]
  onAddToCollection?: (collectionId: string, nodeId: string) => void
  nodeId?: string
  locked?: boolean
  onToggleLock?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-40 bg-white dark:bg-zinc-900 rounded-xl shadow-tinted-lg border border-zinc-200/70 dark:border-zinc-700/70 py-1.5 overflow-hidden screen-enter"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onDuplicate(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
      >
        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Duplicar
      </button>
      {onToggleLock && (
        <button
          onClick={() => { onToggleLock(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
        >
          <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {locked ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            )}
          </svg>
          {locked ? 'Desbloquear' : 'Bloquear'}
        </button>
      )}
      {collections && collections.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
          <div className="px-3.5 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Agregar a colección</div>
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => { onAddToCollection?.(col.id, nodeId!); onClose() }}
              className="w-full flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
            >
              <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              {col.name}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        Eliminar
      </button>
    </div>
  )
}
