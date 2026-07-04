import { useFlowStore } from '../store/flowStore'

export function useUndoRedo() {
  const canUndo = useFlowStore((s) => s.past.length > 0)
  const canRedo = useFlowStore((s) => s.future.length > 0)
  const undo = useFlowStore((s) => s.undo)
  const redo = useFlowStore((s) => s.redo)

  return { undo, redo, canUndo, canRedo }
}
