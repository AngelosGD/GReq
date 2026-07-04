import type { Node } from '@xyflow/react'

export function ResponseSection({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Record<string, unknown>) => void }) {
  const d = (node.data as Record<string, unknown>) ?? {}
  const responsesList = d.responses as unknown[] | undefined
  const singleRes = d.response as unknown

  const allRes = responsesList ?? (singleRes ? [singleRes] : [])
  if (allRes.length === 0) return null

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
          {allRes.length > 1 ? `Respuestas (${allRes.length})` : 'Respuesta'}
        </label>
        <button
          onClick={() => setNodeData(node.id, { response: undefined, responses: undefined })}
          className="text-[9px] text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Limpiar
        </button>
      </div>

      {allRes.map((res: any, idx: number) => {
        const statusColor =
          res.status >= 200 && res.status < 300 ? 'text-emerald-500'
          : res.status >= 300 && res.status < 400 ? 'text-amber-500'
          : res.status >= 400 ? 'text-red-500'
          : 'text-zinc-500'

        return (
          <div key={idx}>
            {allRes.length > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-zinc-100" />
                <span className="text-[9px] font-medium text-zinc-400">{idx + 1}/{allRes.length}</span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold ${statusColor}`}>{res.status}</span>
              <span className="text-[10px] text-zinc-500">{res.statusText}</span>
              <span className="text-[9px] text-zinc-400 ml-auto">{res.durationMs}ms</span>
            </div>

            <details className="group mb-2">
              <summary className="text-[10px] font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 transition-colors list-none flex items-center gap-1.5">
                <svg className="w-3 h-3 text-zinc-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Headers ({res.headers?.length ?? 0})
              </summary>
              <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto">
                {(res.headers as { key: string; value: string }[] ?? []).map((h: any, i: number) => (
                  <div key={i} className="flex gap-2 text-[9px] font-mono">
                    <span className="text-zinc-500 shrink-0">{h.key}:</span>
                    <span className="text-zinc-700 break-all">{h.value}</span>
                  </div>
                ))}
              </div>
            </details>

            <div className="mb-3">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Body</label>
              <pre className="w-full max-h-60 overflow-auto bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-700 leading-relaxed whitespace-pre-wrap break-all">
                {res.body}
              </pre>
            </div>
          </div>
        )
      })}
    </div>
  )
}
