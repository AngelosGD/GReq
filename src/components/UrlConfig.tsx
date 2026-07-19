import type { Node } from '@xyflow/react'
import { KeyValueEditor } from './KeyValueEditor'

export function UrlConfig({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Record<string, unknown>) => void }) {
  const d = (node.data as Record<string, unknown>) ?? {}
  const url = (d.url as string) ?? ''
  const groupTitle = (d.title as string) ?? ''

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em] block mb-1.5">Nombre del grupo</label>
          <input
            value={groupTitle}
            onChange={(e) => setNodeData(node.id, { title: e.target.value })}
          placeholder="e.g. Obtener usuario"
          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/50 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em] block mb-1.5">URL</label>
          <input
            value={url}
            onChange={(e) => setNodeData(node.id, { url: e.target.value })}
          placeholder="https://api.ejemplo.com"
          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/50 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em] block mb-1.5">Headers</label>
        <KeyValueEditor
          pairs={(d.headers as { key: string; value: string }[]) ?? []}
          onChange={(headers) => setNodeData(node.id, { headers })}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em] block mb-1.5">Query Params</label>
        <KeyValueEditor
          pairs={(d.params as { key: string; value: string }[]) ?? []}
          onChange={(params) => setNodeData(node.id, { params })}
        />
      </div>
    </div>
  )
}
