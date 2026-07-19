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
  const locked = !!(node.data as Record<string, unknown>)?.locked

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 4px ${dotColor}66` }} />
          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{label}</span>
          {locked && (
            <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNodeData(node.id, { locked: !locked })}
            className={`w-5 h-5 flex items-center justify-center rounded transition-all duration-150 ${
              locked
                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={locked ? 'Desbloquear nodo' : 'Bloquear nodo'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {locked ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              )}
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
