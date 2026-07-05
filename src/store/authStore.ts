import { create } from 'zustand'

interface AuthStore {
  user: any | null
  checked: boolean
  setUser: (user: any | null) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  checked: false,
  setUser: (user) => set({ user, checked: true }),
}))
