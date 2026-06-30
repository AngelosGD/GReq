import { memo } from 'react'
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'

function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow()
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  })

  const handleDelete = () => {
    setEdges((eds) => eds.filter((e) => e.id !== id))
  }

  return (
    <>
      {/* Hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />

      {/* Gradient path */}
      <path
        d={edgePath}
        fill="none"
        stroke="url(#flow-gradient)"
        strokeWidth={2.5}
        className="animated-flow-edge"
        style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' : undefined }}
      />

      {/* Dashed flow overlay */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1.5}
        strokeDasharray="4 8"
        className="animated-flow-dash"
      />

      {/* Gradient def */}
      <defs>
        <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Delete button on selection */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center justify-center"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <button
              onClick={handleDelete}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-800 text-white
                         text-[10px] shadow-lg hover:bg-red-500 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(AnimatedFlowEdge)
