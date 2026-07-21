import { useEffect, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'

export function useKeyboardShortcuts({
  undo, redo, setNodes, setEdges,
  selectedNode, deleteNode,
}: {
  undo: () => { nodes: Node[]; edges: Edge[] } | null
  redo: () => { nodes: Node[]; edges: Edge[] } | null
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void
  selectedNode: Node | null
  deleteNode: (node: Node) => void
}) {
  const selectedRef = useRef(selectedNode)
  const deleteRef = useRef(deleteNode)
  selectedRef.current = selectedNode
  deleteRef.current = deleteNode

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const snap = undo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y') && e.shiftKey) {
        e.preventDefault()
        const snap = redo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey) {
        e.preventDefault()
        const snap = redo()
        if (snap) {
          setNodes(snap.nodes)
          setEdges(snap.edges)
        }
        return
      }
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable
      if ((e.key === 'Delete' || e.key === 'Supr' || e.key === 'Backspace') && selectedRef.current && !isInput) {
        if ((selectedRef.current.data as Record<string, unknown>)?.locked) return
        e.preventDefault()
        deleteRef.current(selectedRef.current)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, setNodes, setEdges])
}