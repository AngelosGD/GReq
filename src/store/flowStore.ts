import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

interface FlowSnapshot {
  nodes: Node[]
  edges: Edge[]
}

interface FlowStoreState {
  past: FlowSnapshot[]
  future: FlowSnapshot[]
  takeSnapshot: (nodes: Node[], edges: Edge[]) => void
  undo: () => FlowSnapshot | null
  redo: () => FlowSnapshot | null
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

const MAX_HISTORY = 50

export const useFlowStore = create<FlowStoreState>((set, get) => ({
  past: [],
  future: [],

  takeSnapshot: (nodes, edges) => {
    const snapshot: FlowSnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    }
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    }))
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return null

    const snapshot = past[past.length - 1]
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [...s.future, {
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
      }],
    }))
    return snapshot
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return null

    const snapshot = future[future.length - 1]
    set((s) => ({
      future: s.future.slice(0, -1),
      past: [...s.past, snapshot],
    }))
    return snapshot
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}))
