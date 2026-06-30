import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useReactFlow, type Node as FlowNode, type Edge } from '@xyflow/react'
import { palettes, methodLabels } from '../constants'

export function NodeSearch({ nodes, edges }: { nodes: FlowNode[]; edges: Edge[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { setCenter } = useReactFlow()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'url' && (n.data as any)?.title)
      .map((n) => ({
        urlNode: n,
        methods: edges
          .filter((e) => e.source === n.id)
          .map((e) => nodes.find((node) => node.id === e.target))
          .filter(Boolean) as FlowNode[],
      }))
      .filter(
        (g) =>
          !query ||
          (g.urlNode.data as any).title.toLowerCase().includes(query.toLowerCase()),
      )
  }, [nodes, edges, query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const focusNode = useCallback(
    (node: FlowNode) => {
      const x = node.position.x + (node.measured?.width ?? 200) / 2
      const y = node.position.y + (node.measured?.height ?? 100) / 2
      setCenter(x, y, { zoom: 1.5, duration: 300 })
      setOpen(false)
    },
    [setCenter],
  )

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
        title="Buscar grupo"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        Grupos
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-72 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)] border border-zinc-200/80 z-20 overflow-hidden">
          <div className="p-2.5 border-b border-zinc-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar grupos..."
              className="w-full bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-700 placeholder:text-zinc-400 outline-none focus:border-emerald-400 transition-all"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {groups.length === 0 && (
              <p className="text-[11px] text-zinc-400 text-center py-4">
                {query ? 'Sin resultados' : 'No hay grupos con nombre'}
              </p>
            )}
            {groups.map((g) => {
              const title = (g.urlNode.data as any).title
              const isExpanded = expanded[g.urlNode.id]
              return (
                <div key={g.urlNode.id}>
                  <button
                    onClick={() => focusNode(g.urlNode)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                  >
                    <svg className="w-3 h-3 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-[11px] font-semibold text-zinc-700 truncate flex-1">{title}</span>
                    {g.methods.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpanded((prev) => ({ ...prev, [g.urlNode.id]: !isExpanded }))
                        }}
                        className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400 transition-colors"
                      >
                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </button>
                  {isExpanded &&
                    g.methods.map((m) => {
                      const method = (m.data as any)?.method ?? 'GET'
                      const p = palettes[methodLabels[method] as keyof typeof palettes]
                      return (
                        <button
                          key={m.id}
                          onClick={() => focusNode(m)}
                          className="w-full flex items-center gap-2 pl-7 pr-2.5 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: p?.dot ?? '#a1a1aa' }}
                          />
                          <span
                            className="text-[10px] font-mono font-bold uppercase"
                            style={{ color: p?.dot ?? '#a1a1aa' }}
                          >
                            {method}
                          </span>
                          <span className="text-[10px] text-zinc-400 truncate">Solicitud</span>
                        </button>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
