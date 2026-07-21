import { useState, useEffect } from 'react'
import { palettes, methodLabels } from '../constants'
import { useAuthStore } from '../store/authStore'
import { getHistory, deleteHistoryEntry, type HistoryEntry } from '../lib/database'

export function HistoryModal({ onClose, onRetomar }: { onClose: () => void; onRetomar: (entry: HistoryEntry) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) {
      getHistory(user.$id).then(setEntries).catch(() => setEntries([]))
    } else {
      try {
        setEntries(JSON.parse(localStorage.getItem('greq-history') || '[]'))
      } catch {
        setEntries([])
      }
    }
  }, [user])

  const removeEntry = async (id: string) => {
    const next = entries.filter((e) => e.id !== id)
    setEntries(next)
    if (user) {
      await deleteHistoryEntry(user.$id, id)
    } else {
      localStorage.setItem('greq-history', JSON.stringify(next))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-tinted-lg border border-zinc-200/70 dark:border-zinc-700/70 w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Historial de grupos</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 && (
            <div className="text-center py-10">
              <svg className="w-8 h-8 mx-auto mb-3 text-zinc-200 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">No hay grupos guardados aún.</p>
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-150">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{entry.title}</span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0">{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate mb-1.5">{entry.url || 'Sin URL'}</div>
                <div className="flex items-center gap-1">
                  {entry.nodes.filter((n) => n.type === 'method').map((n) => {
                    const method = (n.data as Record<string, unknown>)?.method as string | undefined
                    const p = method ? palettes[methodLabels[method] as keyof typeof palettes] : undefined
                    return <div key={n.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p?.dot ?? '#a1a1aa' }} />
                  })}
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 ml-1">{entry.methodCount} petición{entry.methodCount !== 1 ? 'es' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onRetomar(entry)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/15 transition-all duration-150"
                >
                  Retomar
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all duration-150"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
