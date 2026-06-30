import { create } from 'zustand'

export interface StoredResponse {
  status: number
  statusText: string
  headers: { key: string; value: string }[]
  body: string
  durationMs: number
}

interface ExecStore {
  loading: Record<string, boolean>
  setLoading: (id: string, val: boolean) => void
  executeFn: ((nodeId: string) => Promise<void>) | null
  setExecuteFn: (fn: ((nodeId: string) => Promise<void>) | null) => void
  responses: Record<string, StoredResponse>
  setResponse: (id: string, res: StoredResponse) => void
  clearResponse: (id: string) => void
}

export const useExecStore = create<ExecStore>((set) => ({
  loading: {},
  setLoading: (id, val) => set((s) => ({ loading: { ...s.loading, [id]: val } })),
  executeFn: null,
  setExecuteFn: (fn) => set({ executeFn: fn }),
  responses: {},
  setResponse: (id, res) => set((s) => ({ responses: { ...s.responses, [id]: res } })),
  clearResponse: (id) => set((s) => {
    const { [id]: _, ...rest } = s.responses
    return { responses: rest }
  }),
}))
