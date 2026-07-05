import { create } from 'zustand'

export type AIProvider = 'local' | 'gemini' | 'openai'

interface AIStore {
  provider: AIProvider
  apiKey: string
  modelLoading: boolean
  modelProgress: number
  setProvider: (p: AIProvider) => void
  setApiKey: (key: string) => void
  setModelLoading: (v: boolean) => void
  setModelProgress: (v: number) => void
}

export const useAIStore = create<AIStore>((set) => ({
  provider: (localStorage.getItem('greq-ai-provider') as AIProvider) || 'local',
  apiKey: '',
  modelLoading: false,
  modelProgress: 0,
  setProvider: (provider) => {
    localStorage.setItem('greq-ai-provider', provider)
    set({ provider })
  },
  setApiKey: (apiKey) => set({ apiKey }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setModelProgress: (modelProgress) => set({ modelProgress }),
}))
