import { create } from 'zustand'

export type Screen = 'onboarding' | 'auth' | 'main' | 'settings'

interface AppStore {
  screen: Screen
  goToAuth: () => void
  goToMain: () => void
  goToSettings: () => void
  goBack: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  screen: 'onboarding',
  goToAuth: () => set({ screen: 'auth' }),
  goToMain: () => set({ screen: 'main' }),
  goToSettings: () => set({ screen: 'settings' }),
  goBack: () => set({ screen: 'main' }),
}))
