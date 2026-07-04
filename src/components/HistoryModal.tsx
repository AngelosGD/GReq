import { useState, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { palettes, methodLabels } from '../constants'

export interface HistoryEntry {
  id: string
  title: string
  url: string
  timestamp: number
  methodCount: number
  nodes: Node[]
  edges: Edge[]
}

export function HistoryModal({ onClose, onRetomar }: { onClose: () => void; onRetomar: (entry: HistoryEntry) => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    try {
      setEntries(JSON.parse(localStorage.getItem('greq-history') || '[]'))
    } catch { setEntries([]) }
  }, [])

  const removeEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id)
    setEntries(next)
    localStorage.setItem('greq-history', JSON.stringify(next))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-zinc-200/80 w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <span className="text-sm font-semibold text-zinc-800">Historial de grupos</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-8">No hay grupos guardados aún.</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-800 truncate">{entry.title}</span>
                  <span className="text-[9px] text-zinc-400 shrink-0">{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate mb-1.5">{entry.url || 'Sin URL'}</div>
                <div className="flex items-center gap-1">
                  {entry.nodes.filter((n: any) => n.type === 'method').map((n: any) => {
                    const p = palettes[methodLabels[n.data?.method] as keyof typeof palettes]
                    return <div key={n.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p?.dot ?? '#a1a1aa' }} />
                  })}
                  <span className="text-[9px] text-zinc-400 ml-1">{entry.methodCount} petición{entry.methodCount !== 1 ? 'es' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onRetomar(entry)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all"
                >
                  Retomar
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
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
