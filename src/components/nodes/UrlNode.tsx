import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

type UrlNodeData = { url?: string }
type UrlNodeType = Node<UrlNodeData>

function UrlNode({ data, selected }: NodeProps<UrlNodeType>) {
  const [url, setUrl] = useState(data.url ?? '')
  const [focused, setFocused] = useState(false)

  return (
    <div
      className={`
        relative bg-white rounded-2xl transition-all duration-300
        ${selected
          ? 'shadow-[0_0_0_2px_rgba(16,185,129,0.2),0_8px_32px_rgba(16,185,129,0.12),0_2px_8px_rgba(0,0,0,0.06)]'
          : 'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.05)]'
        }
      `}
    >
      {/* Glass shine overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/80 to-transparent pointer-events-none" />

      {/* Gradient border (appears on selection) */}
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          padding: 1.5,
          background: 'linear-gradient(135deg, #34d399, #10b981, #059669)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Base border */}
      <div
        className={`
          absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300
          ${selected ? 'opacity-0' : 'opacity-100'}
        `}
        style={{
          border: '1.5px solid rgba(0,0,0,0.06)',
        }}
      />

      {/* Inner content */}
      <div className="relative pl-6 pr-4 py-3.5">
        {/* Accent bar */}
        <div
          className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all duration-300 ${
            focused
              ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'bg-gradient-to-b from-emerald-400/80 to-emerald-500/80'
          }`}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="relative w-2 h-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 ring-[3px] ring-emerald-400/20" />
            {selected && (
              <div className="w-2 h-2 rounded-full bg-emerald-400/30 animate-ping absolute inset-0" />
            )}
          </div>
          <span className="text-[10px] font-semibold text-zinc-400/80 uppercase tracking-[0.18em]">
            URL
          </span>
        </div>

        {/* Input */}
        <div
          className={`
            flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all duration-200
            ${focused || url
              ? 'border-emerald-400/60 bg-white ring-[3px] ring-emerald-400/10'
              : 'border-zinc-200/80 bg-zinc-50/70 hover:border-zinc-300/80'
            }
          `}
        >
          <svg
            className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
              focused || url ? 'text-emerald-400' : 'text-zinc-300'
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="https://api.ejemplo.com"
            className="nodrag w-full bg-transparent text-xs font-mono text-zinc-700 placeholder:text-zinc-400/60 outline-none tracking-tight"
          />
          {url && (
            <button
              onClick={() => setUrl('')}
              className="nodrag p-0.5 rounded hover:bg-zinc-100 text-zinc-300 hover:text-zinc-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-[2.5px] !border-white !shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'linear-gradient(135deg, #34d399, #059669)',
        }}
      />
    </div>
  )
}

export default memo(UrlNode)
