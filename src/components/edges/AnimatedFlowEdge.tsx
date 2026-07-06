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
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />

      <path
        d={edgePath}
        fill="none"
        stroke="url(#flow-gradient)"
        strokeWidth={2}
        className="animated-flow-edge"
        style={{ filter: selected ? 'drop-shadow(0 0 4px rgba(16,185,129,0.35))' : undefined }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
        strokeDasharray="3 6"
        className="animated-flow-dash"
      />

      <defs>
        <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

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
              className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-700 text-white text-[10px] shadow-md hover:bg-red-500 transition-colors"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
