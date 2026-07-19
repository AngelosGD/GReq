import { useCallback, useRef, useEffect } from 'react'
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
  focusNodeRef?: React.MutableRefObject<((nodeId: string) => void) | null>
}

export function Canvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
  addNodeToCanvas, onNodeSelect, onNodeContext, focusNodeRef,
}: CanvasProps) {
  const { screenToFlowPosition, setCenter } = useReactFlow()
  const addRef = useRef(addNodeToCanvas)
  addRef.current = addNodeToCanvas

  useEffect(() => {
    if (focusNodeRef) {
      focusNodeRef.current = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
          setCenter(node.position.x + 150, node.position.y + 50, { zoom: 1.2, duration: 300 })
          onNodeSelect(node)
        }
      }
    }
  }, [nodes, setCenter, onNodeSelect, focusNodeRef])

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
