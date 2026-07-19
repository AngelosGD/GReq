import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useExecStore } from '../../store/execStore'
import type { HttpMethod, NodeDataMethod } from '../../types'

type MethodNodeType = Node<Partial<NodeDataMethod>>

const methodStyles: Record<HttpMethod, { dot: string; from: string; to: string }> = {
  GET:    { dot: '#10b981', from: '#34d399', to: '#059669' },
  POST:   { dot: '#3b82f6', from: '#60a5fa', to: '#2563eb' },
  PUT:    { dot: '#f97316', from: '#fb923c', to: '#ea580c' },
  PATCH:  { dot: '#8b5cf6', from: '#a78bfa', to: '#7c3aed' },
  DELETE: { dot: '#ef4444', from: '#f87171', to: '#dc2626' },
  UPDATE: { dot: '#f59e0b', from: '#fbbf24', to: '#d97706' },
}

function MethodNode({ data, selected, id }: NodeProps<MethodNodeType>) {
  const [hover, setHover] = useState(false)
  const cfg = methodStyles[data.method ?? 'GET']
  const loading = useExecStore((s) => s.loading[id] ?? false)
  const executeFn = useExecStore((s) => s.executeFn)
  const locked = !!data.locked

  return (
    <div
      className={`
        relative bg-white dark:bg-zinc-900 rounded-xl transition-all duration-200
        ${selected && !locked
          ? 'border-zinc-300/80 dark:border-zinc-600/80 shadow-tinted-md'
          : 'border-zinc-200/60 dark:border-zinc-700/60 shadow-tinted hover:shadow-tinted-md hover:border-zinc-300/60 dark:hover:border-zinc-600/60'
        }
        ${locked ? 'opacity-70' : ''}
      `}
      style={{ minWidth: 180 }}
    >
      <div
        className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-60'}`}
        style={{ backgroundColor: cfg.dot, boxShadow: selected ? `0 0 6px ${cfg.dot}66` : 'none' }}
      />

      <div className="relative pl-5 pr-3.5 py-3">
        {locked && (
          <div className="absolute -top-2 right-3 z-10">
            <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot, boxShadow: `0 0 4px ${cfg.dot}44` }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.dot }}>
              {data.method}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">Solicitud</span>
            {data.repeatCount && data.repeatCount > 1 && (
              <span className="text-[8px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded leading-none">
                ×{data.repeatCount}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => executeFn?.(id)}
          disabled={loading || locked}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="nodrag w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white
                     transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: loading ? '#a1a1aa' : locked ? '#a1a1aa' : `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
            boxShadow: hover && !loading && !locked ? `0 4px 12px ${cfg.dot}44` : `0 1px 3px ${cfg.dot}22`,
            transform: hover && !loading && !locked ? 'translateY(-1px)' : 'translateY(0)',
          }}
        >
          {loading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : locked ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
          {loading ? 'Enviando...' : locked ? 'Bloqueado' : 'Ejecutar'}
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2 !border-white !shadow-tinted-md !transition-all !duration-200 hover:!scale-125"
        style={{ top: '50%', transform: 'translateY(-50%)', background: cfg.dot }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !shadow-tinted-md !transition-all !duration-200 hover:!scale-125"
        style={{ left: '50%', transform: 'translateX(-50%)', background: cfg.dot }}
      />
    </div>
  )
}

export default memo(MethodNode)
