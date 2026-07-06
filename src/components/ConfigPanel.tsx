import type { Node } from '@xyflow/react'
import { UrlConfig } from './UrlConfig'
import { MethodConfig } from './MethodConfig'
import { VariablesHint } from './VariablesHint'
import { ResponseSection } from './ResponseSection'

export function ConfigPanel({ node, setNodeData, onClose }: {
  node: Node
  setNodeData: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const isUrl = node.type === 'url'
  const isMethod = node.type === 'method'
  const label = isUrl ? 'URL' : ((node.data as Record<string, unknown>)?.method as string) || 'Method'

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200/60 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
          <span className="text-[11px] font-semibold text-zinc-600">{label}</span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isUrl && <UrlConfig node={node} setNodeData={setNodeData} />}
        {isMethod && <MethodConfig node={node} setNodeData={setNodeData} />}
        {isMethod && <VariablesHint />}
        {Boolean((node.data as Record<string, unknown>)?.response) && <ResponseSection node={node} setNodeData={setNodeData} />}
      </div>
    </aside>
  )
}
