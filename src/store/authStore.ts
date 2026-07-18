import { create } from 'zustand'

export interface AuthUser {
  $id: string
  email: string
  name?: string
}

interface AuthStore {
  user: AuthUser | null
  checked: boolean
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  checked: false,
  setUser: (user) => set({ user, checked: true }),
}))
