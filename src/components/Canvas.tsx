import { useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  BaseEdge,
  getSmoothStepPath,
  type ConnectionLineComponentProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'

interface CanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (params: any) => void
  addNodeToCanvas: (type: string, pos?: { x: number; y: number }) => void
  onNodeSelect: (node: Node | null) => void
  onNodeContext: (event: React.MouseEvent, node: Node) => void
  focusNodeRef?: React.MutableRefObject<((nodeId: string) => void) | null>
}

function ConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({ sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY, sourcePosition: fromPosition, targetPosition: toPosition })
  return <BaseEdge path={path} style={{ stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
}

export function Canvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
  addNodeToCanvas, onNodeSelect, onNodeContext, focusNodeRef,
}: CanvasProps) {
  const nodeTypeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n.type])), [nodes])
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      const sourceType = connection.source ? nodeTypeMap.get(connection.source) : undefined
      const targetType = connection.target ? nodeTypeMap.get(connection.target) : undefined
      if (!sourceType || !targetType) return false
      if (sourceType === 'url' && targetType === 'method') return true
      if (sourceType === 'method' && targetType === 'method') return true
      return false
    },
    [nodeTypeMap],
  )
  const { screenToFlowPosition, setCenter } = useReactFlow()
  const addRef = useRef(addNodeToCanvas)
  addRef.current = addNodeToCanvas
  const onNodeSelectRef = useRef(onNodeSelect)
  onNodeSelectRef.current = onNodeSelect
  const onNodeContextRef = useRef(onNodeContext)
  onNodeContextRef.current = onNodeContext

  useEffect(() => {
    if (focusNodeRef) {
      focusNodeRef.current = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
          setCenter(node.position.x + 150, node.position.y + 50, { zoom: 1.2, duration: 300 })
          onNodeSelectRef.current(node)
        }
      }
    }
  }, [nodes, setCenter, focusNodeRef])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addRef.current(type, position)
    },
    [screenToFlowPosition],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if ((node.data as Record<string, unknown>)?.locked) return
      onNodeSelectRef.current(node)
    },
    [],
  )

  const onPaneClick = useCallback(() => {
    onNodeSelectRef.current(null)
  }, [])

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      onNodeContext(event, node)
    },
    [onNodeContext],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onNodeClick={onNodeClick}
      onNodeContextMenu={handleContextMenu}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: 'animated' }}
      connectionLineComponent={ConnectionLine}
      isValidConnection={isValidConnection}
      zoomOnScroll={true}
      zoomOnPinch={true}
      panOnDrag={true}
      fitView
      style={{ width: '100%', height: '100%' }}
    >
      <Background variant={BackgroundVariant.Dots} color="#a1a1aa" gap={20} size={1.5} />
    </ReactFlow>
  )
}
