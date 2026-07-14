import { memo, useState, useEffect } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { NodeDataUrl } from '../../types'

type UrlNodeType = Node<Partial<NodeDataUrl>>

function UrlNode({ data, selected, id }: NodeProps<UrlNodeType>) {
  const { updateNodeData } = useReactFlow()
  const [url, setUrl] = useState(data.url ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { setUrl(data.url ?? '') }, [data.url])

  return (
    <div
      className={`
        relative bg-white rounded-xl transition-all duration-200
        ${selected
          ? 'border-emerald-300/80 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_4px_14px_rgba(16,185,129,0.08)]'
          : 'border-zinc-200/60 shadow-tinted hover:shadow-tinted-md hover:border-zinc-300/60'
        }
      `}
    >
      <div
        className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full transition-all duration-300 ${
          focused ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.35)]' : 'bg-emerald-400/50'
        }`}
      />

      <div className="relative pl-5 pr-3.5 py-3">
        {data.title && (
          <div className="absolute -top-2 left-5 right-3.5 flex items-center gap-1.5">
            <span className="text-[8px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[160px]">
              {data.title}
            </span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
        )}

        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.3)]" />
          <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">URL</span>
        </div>

        <div
          className={`
            flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all duration-150
            ${focused || url ? 'border-emerald-400/50 bg-white shadow-[0_0_0_2px_rgba(16,185,129,0.06)]' : 'border-zinc-200/50 bg-zinc-50/50 hover:border-zinc-300/60'}
          `}
        >
          <svg
            className={`w-3.5 h-3.5 shrink-0 transition-colors duration-150 ${focused || url ? 'text-emerald-400' : 'text-zinc-300'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              updateNodeData(id, { url: e.target.value })
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="https://api.ejemplo.com"
            className="nodrag w-full bg-transparent text-[11px] font-mono text-zinc-700 placeholder:text-zinc-400/40 outline-none"
          />
          {url && (
            <button
              onClick={() => {
                setUrl('')
                updateNodeData(id, { url: '' })
              }}
              className="nodrag p-0.5 rounded text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2 !border-white !shadow-tinted-md !transition-all !duration-200 hover:!scale-125"
        style={{ top: '50%', transform: 'translateY(-50%)', background: '#10b981' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !border-2 !border-white !shadow-tinted-md !transition-all !duration-200 hover:!scale-125"
        style={{ top: '50%', transform: 'translateY(-50%)', background: '#10b981' }}
      />
    </div>
  )
}

export default memo(UrlNode)
