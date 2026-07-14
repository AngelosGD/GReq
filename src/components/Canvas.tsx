import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
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
}

export function Canvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
  addNodeToCanvas, onNodeSelect, onNodeContext,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const addRef = useRef(addNodeToCanvas)
  addRef.current = addNodeToCanvas

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
      onNodeSelect(node)
    },
    [onNodeSelect],
  )

  const onPaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

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
