import type { Node } from '@xyflow/react'
import { palettes, methodLabels } from '../constants'
import { getUrlData, getMethodData } from '../utils/nodeData'

export function GroupDeleteModal({ node, methods, onDeleteGroup, onDeleteNode, onCancel }: {
  node: Node
  methods: Node[]
  onDeleteGroup: () => void
  onDeleteNode: () => void
  onCancel: () => void
}) {
  const title = getUrlData(node).title || 'Sin título'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-zinc-200/80 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-zinc-800">Eliminar grupo</span>
            <p className="text-[11px] text-zinc-500">"{title}" está conectado a {methods.length} peticion{methods.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4 pl-11">
          {methods.map((m) => {
            const method = getMethodData(m).method || 'GET'
            const p = palettes[methodLabels[method] as keyof typeof palettes]
            return (
              <span key={m.id} className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase" style={{ backgroundColor: `${p?.dot}15`, color: p?.dot }}>
                {method}
              </span>
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={onDeleteGroup}
            className="w-full py-2 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all"
          >
            Eliminar todo el grupo
          </button>
          <button
            onClick={onDeleteNode}
            className="w-full py-2 rounded-xl text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            Eliminar solo el nodo base
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-600 active:scale-[0.98] transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
