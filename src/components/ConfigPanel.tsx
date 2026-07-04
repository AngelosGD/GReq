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

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200/70 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isUrl ? 'bg-emerald-400' : 'bg-blue-400'}`} />
          <span className="text-xs font-semibold text-zinc-700 capitalize">
            {node.type === 'url' ? 'URL' : ((node.data as Record<string, unknown>)?.method as string) || 'Method'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
