import type { Node } from '@xyflow/react'
import { UrlConfig } from './UrlConfig'
import { MethodConfig } from './MethodConfig'
import { VariablesHint } from './VariablesHint'
import { ResponseSection } from './ResponseSection'

const configMethodColors: Record<string, string> = {
  GET: '#10b981', POST: '#3b82f6', PUT: '#f97316',
  PATCH: '#8b5cf6', DELETE: '#ef4444', UPDATE: '#f59e0b',
}

export function ConfigPanel({ node, setNodeData, onClose }: {
  node: Node
  setNodeData: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const isUrl = node.type === 'url'
  const isMethod = node.type === 'method'
  const method = (node.data as Record<string, unknown>)?.method as string | undefined
  const label = isUrl ? 'URL' : method || 'Method'
  const dotColor = isUrl ? '#10b981' : (method ? configMethodColors[method] : '#a1a1aa') || '#a1a1aa'

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200/50 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 4px ${dotColor}66` }} />
          <span className="text-[11px] font-semibold text-zinc-600">{label}</span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all duration-150"
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
