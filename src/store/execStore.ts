import { create } from 'zustand'

interface ExecStore {
  loading: Record<string, boolean>
  setLoading: (id: string, val: boolean) => void
  executeFn: ((nodeId: string) => Promise<void>) | null
  setExecuteFn: (fn: ((nodeId: string) => Promise<void>) | null) => void
}

export const useExecStore = create<ExecStore>((set) => ({
  loading: {},
  setLoading: (id, val) => set((s) => ({ loading: { ...s.loading, [id]: val } })),
  executeFn: null,
  setExecuteFn: (fn) => set({ executeFn: fn }),
}))
