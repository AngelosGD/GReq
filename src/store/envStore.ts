import { create } from 'zustand'

export interface EnvVar {
  key: string
  value: string
}

export interface EnvProfile {
  name: string
  vars: EnvVar[]
}

const STORAGE_KEY = 'greq-env-profiles'
const ACTIVE_KEY = 'greq-env-active'

function loadProfiles(): EnvProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : [{ name: 'dev', vars: [] }, { name: 'staging', vars: [] }, { name: 'prod', vars: [] }]
  } catch {
    return [{ name: 'dev', vars: [] }, { name: 'staging', vars: [] }, { name: 'prod', vars: [] }]
  }
}

function loadActive(): string {
  return localStorage.getItem(ACTIVE_KEY) || 'dev'
}

interface EnvStore {
  profiles: EnvProfile[]
  activeProfile: string
  setActiveProfile: (name: string) => void
  getActiveVars: () => EnvVar[]
  upsertVar: (profileName: string, key: string, value: string) => void
  removeVar: (profileName: string, key: string) => void
  renameProfile: (oldName: string, newName: string) => void
  addProfile: (name: string) => boolean
  removeProfile: (name: string) => void
}

function persist(profiles: EnvProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export const useEnvStore = create<EnvStore>((set, get) => ({
  profiles: loadProfiles(),
  activeProfile: loadActive(),

  setActiveProfile: (name) => {
    localStorage.setItem(ACTIVE_KEY, name)
    set({ activeProfile: name })
  },

  getActiveVars: () => {
    const { profiles, activeProfile } = get()
    return profiles.find((p) => p.name === activeProfile)?.vars ?? []
  },

  upsertVar: (profileName, key, value) => {
    set((s) => {
      const profiles = s.profiles.map((p) => {
        if (p.name !== profileName) return p
        const exists = p.vars.findIndex((v) => v.key === key)
        const vars = exists >= 0
          ? p.vars.map((v, i) => i === exists ? { key, value } : v)
          : [...p.vars, { key, value }]
        return { ...p, vars }
      })
      persist(profiles)
      return { profiles }
    })
  },

  removeVar: (profileName, key) => {
    set((s) => {
      const profiles = s.profiles.map((p) => {
        if (p.name !== profileName) return p
        return { ...p, vars: p.vars.filter((v) => v.key !== key) }
      })
      persist(profiles)
      return { profiles }
    })
  },

  renameProfile: (oldName, newName) => {
    set((s) => {
      const profiles = s.profiles.map((p) => {
        if (p.name !== oldName) return p
        return { ...p, name: newName }
      })
      persist(profiles)
      const active = s.activeProfile === oldName ? newName : s.activeProfile
      localStorage.setItem(ACTIVE_KEY, active)
      return { profiles, activeProfile: active }
    })
  },

  addProfile: (name) => {
    const { profiles } = get()
    if (profiles.find((p) => p.name === name)) return false
    const updated = [...profiles, { name, vars: [] }]
    persist(updated)
    set({ profiles: updated })
    return true
  },

  removeProfile: (name) => {
    set((s) => {
      const profiles = s.profiles.filter((p) => p.name !== name)
      persist(profiles)
      const active = s.activeProfile === name
        ? (profiles[0]?.name ?? 'dev')
        : s.activeProfile
      localStorage.setItem(ACTIVE_KEY, active)
      return { profiles, activeProfile: active }
    })
  },
}))
