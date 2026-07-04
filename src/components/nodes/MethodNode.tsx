import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { palettes } from '../../constants'
import { useExecStore } from '../../store/execStore'
import type { HttpMethod, NodeDataMethod } from '../../types'

type MethodNodeType = Node<Partial<NodeDataMethod>>

type MethodStyle = {
  from: string
  to: string
  dot: string
  shadow: string
  ring: string
  border: string
}

function buildMethodStyle(key: 'get' | 'post' | 'delete' | 'update', shadow: string, ring: string): MethodStyle {
  const p = palettes[key]
  return { from: p.from, to: p.to, dot: p.dot, border: p.border, shadow, ring }
}

const methodStyles: Record<HttpMethod, MethodStyle> = {
  GET:    buildMethodStyle('get',    'rgba(16,185,129,0.15)', 'rgba(16,185,129,0.2)'),
  POST:   buildMethodStyle('post',   'rgba(59,130,246,0.15)', 'rgba(59,130,246,0.2)'),
  DELETE: buildMethodStyle('delete', 'rgba(239,68,68,0.15)',  'rgba(239,68,68,0.2)'),
  UPDATE: buildMethodStyle('update', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.2)'),
}

function MethodNode({ data, selected, id }: NodeProps<MethodNodeType>) {
  const [hover, setHover] = useState(false)
  const cfg = methodStyles[data.method ?? 'GET']
  const loading = useExecStore((s) => s.loading[id] ?? false)
  const executeFn = useExecStore((s) => s.executeFn)

  return (
    <div
      className={`
        relative bg-white rounded-2xl transition-all duration-300
        ${selected
          ? 'shadow-[0_0_0_2px_var(--ring),0_8px_32px_var(--shadow),0_2px_8px_rgba(0,0,0,0.06)]'
          : 'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.05)]'
        }
      `}
      style={{
        ['--shadow' as string]: cfg.shadow,
        ['--ring' as string]: cfg.ring,
        minWidth: 180,
      }}
    >
      {/* Glass shine */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/80 to-transparent pointer-events-none" />

      {/* Base border */}
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300 ${
          selected ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ border: '1.5px solid rgba(0,0,0,0.06)' }}
      />

      {/* Selection gradient border */}
      <div
        className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          padding: 1.5,
          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Header gradient strip */}
      <div
        className="relative h-2 w-full rounded-t-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
          boxShadow: `0 2px 12px ${cfg.shadow}`,
        }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
      </div>

      {/* Content */}
      <div className="relative p-4 pt-3.5">
        {/* Method badge + label row */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative w-2 h-2">
              <div
                className="w-2 h-2 rounded-full ring-[3px]"
                style={{
                  backgroundColor: cfg.dot,
                  boxShadow: `0 0 8px ${cfg.shadow}`,
                }}
              />
              {selected && (
                <div
                  className="w-2 h-2 rounded-full animate-ping absolute inset-0"
                  style={{ backgroundColor: `${cfg.dot}60` }}
                />
              )}
            </div>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: cfg.dot }}
            >
              {data.method}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400/60 font-medium tracking-tight">Solicitud</span>
            {data.repeatCount && data.repeatCount > 1 && (
              <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded-md leading-none">
                ×{data.repeatCount}
              </span>
            )}
          </div>
        </div>

        {/* Execute button */}
        <button
          onClick={() => executeFn?.(id)}
          disabled={loading}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="nodrag w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white
                     transition-all active:scale-[0.97] disabled:opacity-70 disabled:cursor-wait"
          style={{
            background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
            boxShadow: hover
              ? `0 4px 16px ${cfg.shadow}, 0 1px 4px rgba(0,0,0,0.1)`
              : `0 1px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)`,
            transform: hover ? 'translateY(-1px)' : 'translateY(0)',
          }}
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
          {loading ? 'Enviando...' : 'Ejecutar'}
        </button>
      </div>

      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-[2.5px] !border-white !shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
        }}
      />

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-[2.5px] !border-white !shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
        }}
      />
    </div>
  )
}

export default memo(MethodNode)
