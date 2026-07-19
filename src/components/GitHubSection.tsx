import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { importFromGithub, type GitHubEndpoint } from '../lib/github'

interface RepoInfo {
  id: string
  name: string
  url: string
  endpoints: GitHubEndpoint[]
}

interface GitHubRepo {
  name: string
  fullName: string
  url: string
  description: string
  private: boolean
}

interface Props {
  onClose: () => void
  onImport: (endpoints: GitHubEndpoint[]) => void
}

const methodColors: Record<string, { text: string; bg: string; border: string }> = {
  GET:    { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  POST:   { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  PUT:    { text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  PATCH:  { text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  DELETE: { text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  UPDATE: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
}

function extractPathParams(path: string): string[] {
  return (path.match(/\{(\w+)\}/g) || []).map((m) => m.slice(1, -1))
}

const TOKEN_KEY = 'greq-github-token'

function getGithubToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

async function fetchMyRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&type=all', {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
  const data = await res.json()
  return data.map((r: any) => ({
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description || '',
    private: r.private,
  }))
}

const REPOS_KEY = 'greq-github-repos'
const SELECTED_KEY = 'greq-github-selected-repo'

function loadRepos(): RepoInfo[] {
  try {
    const raw = localStorage.getItem(REPOS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RepoInfo[]
  } catch {
    /* ignore */
  }
  return []
}

function saveRepos(list: RepoInfo[]) {
  try {
    localStorage.setItem(REPOS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function genRepoId(): string {
  return `repo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function GitHubSection({ onClose, onImport }: Props) {
  const initialRepos = loadRepos()
  const initialSelected = (() => {
    const sel = localStorage.getItem(SELECTED_KEY)
    if (sel && initialRepos.some((r) => r.id === sel)) return sel
    return initialRepos[0]?.id ?? null
  })()
  const [repos, setRepos] = useState<RepoInfo[]>(initialRepos)
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(initialSelected)
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(() => {
    const repo = initialRepos.find((r) => r.id === initialSelected) ?? initialRepos[0]
    return repo ? new Set(repo.endpoints.map((e) => `${e.method}:${e.path}`)) : new Set()
  })
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(
    initialSelected ? new Set([initialSelected]) : new Set()
  )
  const [selectedEndpointForDetail, setSelectedEndpointForDetail] = useState<GitHubEndpoint | null>(null)

  // Manual URL add
  const [showAddForm, setShowAddForm] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // GitHub connect via OAuth
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [linking, setLinking] = useState(false)
  const [fetchingRepos, setFetchingRepos] = useState(false)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [selectedGithubRepos, setSelectedGithubRepos] = useState<Set<string>>(new Set())
  const [connectError, setConnectError] = useState('')

  const selectedRepo = repos.find((r) => r.id === selectedRepoId) ?? null

  const epKey = (ep: GitHubEndpoint) => `${ep.method}:${ep.path}`

  // Persist imported repos and current selection across sessions
  useEffect(() => {
    saveRepos(repos)
  }, [repos])

  useEffect(() => {
    if (selectedRepoId) localStorage.setItem(SELECTED_KEY, selectedRepoId)
    else localStorage.removeItem(SELECTED_KEY)
  }, [selectedRepoId])

  const toggleExpand = (id: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectRepo = (id: string) => {
    setSelectedRepoId(id)
    setSelectedEndpointForDetail(null)
    const repo = repos.find((r) => r.id === id)
    if (repo) setSelectedEndpoints(new Set(repo.endpoints.map(epKey)))
  }

  const toggleEndpoint = (ep: GitHubEndpoint) => {
    const key = epKey(ep)
    setSelectedEndpoints((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleLlevarADiagrama = () => {
    if (!selectedRepo) return
    const chosen = selectedRepo.endpoints.filter((ep) => selectedEndpoints.has(epKey(ep)))
    if (chosen.length === 0) return
    onImport(chosen)
  }

  // ── Add repo by URL ──
  const handleAdd = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const result = await importFromGithub(url)
      const id = genRepoId()
      const newRepo: RepoInfo = { id, name: result.title, url: url.trim(), endpoints: result.endpoints }
      setRepos((prev) => [...prev, newRepo])
      setSelectedRepoId(id)
      setSelectedEndpoints(new Set(result.endpoints.map(epKey)))
      setUrl('')
      setShowAddForm(false)
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }

  const removeRepo = (id: string) => {
    const next = repos.filter((r) => r.id !== id)
    setRepos(next)
    setExpandedRepos((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    if (selectedRepoId === id) {
      const fallback = next[0]?.id ?? null
      setSelectedRepoId(fallback)
      setSelectedEndpoints(fallback ? new Set(next[0].endpoints.map(epKey)) : new Set())
    }
  }

  // ── Connect via GitHub OAuth or username ──
  const handleLinkGithub = async () => {
    setLinking(true)
    setFetchingRepos(true)
    setConnectError('')
    try {
      const result = await invoke<{ email: string; name: string; accessToken: string }>('login_with_github', {
        clientId: import.meta.env.VITE_GITHUB_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
      })
      localStorage.setItem(TOKEN_KEY, result.accessToken)
      const repos = await fetchMyRepos(result.accessToken)
      setGithubRepos(repos)
      setSelectedGithubRepos(new Set(repos.map((r) => r.fullName)))
      setFetchingRepos(false)
      setLinking(false)
    } catch (e: any) {
      setConnectError(e?.message || 'Error al vincular GitHub')
      setFetchingRepos(false)
      setLinking(false)
    }
  }

  const openConnectDialog = () => {
    setShowConnectDialog(true)
    setGithubRepos([])
    setSelectedGithubRepos(new Set())
    setConnectError('')
    setLinking(false)
    const token = getGithubToken()
    if (token) {
      setFetchingRepos(true)
      fetchMyRepos(token)
        .then((repos) => {
          setGithubRepos(repos)
          setSelectedGithubRepos(new Set(repos.map((r) => r.fullName)))
        })
        .catch((e) => setConnectError(e?.message || 'Error al obtener repositorios'))
        .finally(() => setFetchingRepos(false))
    }
  }

  const toggleGhRepo = (fullName: string) => {
    setSelectedGithubRepos((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  const importSelectedGithubRepos = async () => {
    const selected = githubRepos.filter((r) => selectedGithubRepos.has(r.fullName))
    if (selected.length === 0) return
    setFetchingRepos(true)
    const newRepos: RepoInfo[] = []
    for (const ghRepo of selected) {
      try {
        const result = await importFromGithub(ghRepo.url)
        const id = genRepoId()
        newRepos.push({ id, name: result.title, url: ghRepo.url, endpoints: result.endpoints })
      } catch { /* skip failures */ }
    }
    if (newRepos.length > 0) {
      setRepos((prev) => [...prev, ...newRepos])
      setSelectedRepoId(newRepos[0].id)
      setSelectedEndpoints(new Set(newRepos[0].endpoints.map(epKey)))
      setExpandedRepos((prev) => new Set([...prev, ...newRepos.map((r) => r.id)]))
    }
    setFetchingRepos(false)
    setShowConnectDialog(false)
    setGithubRepos([])
  }

  const toggleSelectAllGh = () => {
    setSelectedGithubRepos(
      githubRepos.length === selectedGithubRepos.size
        ? new Set()
        : new Set(githubRepos.map((r) => r.fullName))
    )
  }

  // ══════════════════════════════════════════
  //  RENDER — Empty state
  // ══════════════════════════════════════════
  if (repos.length === 0 && !showAddForm) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-700 dark:text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
              </svg>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Desde GitHub</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Aún no tienes repositorios conectados</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
              Agrega al menos un repositorio de GitHub para importar sus endpoints y empezar a construir tus peticiones.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 transition-all active:scale-[0.98] w-64 justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar repositorio
              </button>
              <div className="flex items-center gap-3 w-64">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">o</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>
              <button
                onClick={openConnectDialog}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-400 transition-all active:scale-[0.98] w-64 justify-center"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                </svg>
                Conectar a GitHub
              </button>
            </div>
          </div>
        </div>

        {/* ── Connect dialog (username → repos) ── */}
        {showConnectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 dark:bg-black/40" onClick={() => setShowConnectDialog(false)}>
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl shadow-black/8 dark:shadow-black/40 w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conectar a GitHub</h3>
                <button onClick={() => setShowConnectDialog(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
                {!getGithubToken() && githubRepos.length === 0 && !fetchingRepos ? (
                  <>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Vinculá tu cuenta de GitHub para ver tus repositorios. Necesitás autorizar GReq para acceder a ellos.
                    </p>
                    <button
                      onClick={handleLinkGithub}
                      disabled={linking}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {linking ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                        </svg>
                      )}
                      {linking ? 'Vinculando...' : 'Vincular GitHub'}
                    </button>
                    {connectError && (
                      <p className="text-[11px] text-red-500 mt-1.5">{connectError}</p>
                    )}
                  </>
                ) : fetchingRepos ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-8 h-8 animate-spin text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm text-zinc-400 dark:text-zinc-500">Cargando repositorios...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
                        {githubRepos.length} repositorio{githubRepos.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={toggleSelectAllGh}
                        className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        {githubRepos.length === selectedGithubRepos.size ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200/50 dark:border-zinc-700/50 rounded-lg bg-white dark:bg-zinc-900 p-1.5">
                      {githubRepos.map((repo) => (
                        <label
                          key={repo.fullName}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGithubRepos.has(repo.fullName)}
                            onChange={() => toggleGhRepo(repo.fullName)}
                            className="accent-zinc-900 w-3.5 h-3.5"
                          />
                          <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate block">{repo.fullName}</span>
                            {repo.description && (
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block">{repo.description}</span>
                            )}
                          </div>
                          {repo.private && (
                            <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                              Privado
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {githubRepos.length > 0 && (
                <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
                  <button onClick={() => setShowConnectDialog(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={importSelectedGithubRepos}
                    disabled={selectedGithubRepos.size === 0 || fetchingRepos}
                    className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  >
                    {fetchingRepos && (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    Importar {selectedGithubRepos.size} repositorio{selectedGithubRepos.size !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════
  //  RENDER — Add repo form
  // ══════════════════════════════════════════
  if (showAddForm) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowAddForm(false); setUrl('') }} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Agregar repositorio</span>
          </div>
          <button onClick={() => { setShowAddForm(false); setUrl('') }} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50/30 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">URL del repositorio</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Ingresa la URL de un repositorio público de GitHub para analizar sus endpoints.</p>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/usuario/repo"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/50 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 outline-none focus:border-zinc-300 dark:border-zinc-600 transition-all placeholder-zinc-300 dark:placeholder-zinc-600"
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {loading && (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {loading ? 'Buscando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════
  //  RENDER — Main view (sidebar + overview)
  // ══════════════════════════════════════════
  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver
          </button>
          <div className="w-px h-4 bg-zinc-200" />
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-700 dark:text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
            </svg>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Desde GitHub</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar repositorio
          </button>
          <div className="w-px h-4 bg-zinc-200" />
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 flex-shrink-0 border-r border-zinc-200/60 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 flex flex-col">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em]">Repositorios</div>
            <button
              onClick={openConnectDialog}
              title="Traer repositorios"
              className="w-6 h-6 -mr-1 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {repos.map((repo) => {
              const expanded = expandedRepos.has(repo.id)
              const isSelected = selectedRepoId === repo.id
              return (
                <div key={repo.id}>
                  <div
                    className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected ? 'bg-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 dark:text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                    onClick={() => { selectRepo(repo.id); toggleExpand(repo.id) }}
                  >
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{repo.name}</div>
                      <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">{repo.endpoints.length} endpoints</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRepo(repo.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {expanded && (
                    <div className="ml-3.5 pl-2.5 border-l border-zinc-200/70 dark:border-zinc-700/50 my-0.5 space-y-0.5">
                      {repo.endpoints.length === 0 ? (
                        <div className="px-2 py-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">Sin endpoints detectados</div>
                      ) : (
                        repo.endpoints.map((ep, i) => {
                          const c = methodColors[ep.method] ?? { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200' }
                          const isSelected = selectedEndpoints.has(epKey(ep))
                          const isDetail = selectedEndpointForDetail?.path === ep.path && selectedEndpointForDetail?.method === ep.method
                          return (
                            <button
                              key={i}
                              onClick={() => { toggleEndpoint(ep); setSelectedEndpointForDetail(ep) }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                                isDetail ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${c.text} ${c.bg} border ${c.border}`}>{ep.method}</span>
                              <code className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex-1 min-w-0 truncate">{ep.path}</code>
                              {isSelected && (
                                <svg className="w-3.5 h-3.5 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          {selectedEndpointForDetail && selectedRepo ? (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ${
                    (methodColors[selectedEndpointForDetail.method] ?? { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200' }).text
                  } ${
                    (methodColors[selectedEndpointForDetail.method] ?? { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200' }).bg
                  } border ${
                    (methodColors[selectedEndpointForDetail.method] ?? { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200' }).border
                  }`}>
                    {selectedEndpointForDetail.method}
                  </span>
                  <code className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">{selectedEndpointForDetail.path}</code>
                </div>
                {selectedEndpointForDetail.summary && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedEndpointForDetail.summary}</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">URL</label>
                  <div className="mt-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2.5 border border-zinc-200/50 dark:border-zinc-700/50 break-all">
                    https://api.example.com{selectedEndpointForDetail.path}
                  </div>
                </div>

                {extractPathParams(selectedEndpointForDetail.path).length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Parámetros de ruta ({extractPathParams(selectedEndpointForDetail.path).length})
                    </label>
                    <div className="mt-1.5 space-y-1">
                      {extractPathParams(selectedEndpointForDetail.path).map((param) => (
                        <div key={param} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                          <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium">{param}</code>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">string</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-auto">requerido</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Seleccionado para importar</label>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className={`w-2 h-2 rounded-full ${selectedEndpoints.has(epKey(selectedEndpointForDetail)) ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    {selectedEndpoints.has(epKey(selectedEndpointForDetail))
                      ? 'Este endpoint será incluido al llevar a diagrama'
                      : 'Hacé clic en el endpoint en la barra lateral para seleccionarlo'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50/30">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {selectedEndpoints.size} endpoint{selectedEndpoints.size !== 1 ? 's' : ''} seleccionado{selectedEndpoints.size !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleLlevarADiagrama}
                  disabled={selectedEndpoints.size === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  Llevar a diagrama
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <svg className="w-14 h-14 mx-auto mb-5 text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                <h3 className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5">Seleccioná un endpoint</h3>
                <p className="text-xs text-zinc-300 dark:text-zinc-600 leading-relaxed">
                  Hacé clic en un endpoint de la barra lateral para ver sus detalles y luego llevarlo al diagrama.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {showConnectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 dark:bg-black/40" onClick={() => setShowConnectDialog(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl shadow-black/8 dark:shadow-black/40 w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conectar a GitHub</h3>
              <button onClick={() => setShowConnectDialog(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
              {!getGithubToken() && githubRepos.length === 0 && !fetchingRepos ? (
                <>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Vinculá tu cuenta de GitHub para ver tus repositorios. Necesitás autorizar GReq para acceder a ellos.
                  </p>
                  <button
                    onClick={handleLinkGithub}
                    disabled={linking}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {linking ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                      </svg>
                    )}
                    {linking ? 'Vinculando...' : 'Vincular GitHub'}
                  </button>
                  {connectError && (
                    <p className="text-[11px] text-red-500 mt-1.5">{connectError}</p>
                  )}
                </>
              ) : fetchingRepos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 animate-spin text-zinc-300 dark:text-zinc-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-zinc-400 dark:text-zinc-500">Cargando repositorios...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
                      {githubRepos.length} repositorio{githubRepos.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={toggleSelectAllGh}
                      className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      {githubRepos.length === selectedGithubRepos.size ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200/50 dark:border-zinc-700/50 rounded-lg bg-white dark:bg-zinc-900 p-1.5">
                    {githubRepos.map((repo) => (
                      <label
                        key={repo.fullName}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGithubRepos.has(repo.fullName)}
                          onChange={() => toggleGhRepo(repo.fullName)}
                          className="accent-zinc-900 w-3.5 h-3.5"
                        />
                        <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate block">{repo.fullName}</span>
                          {repo.description && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block">{repo.description}</span>
                          )}
                        </div>
                        {repo.private && (
                          <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                            Privado
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {githubRepos.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
                <button onClick={() => setShowConnectDialog(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={importSelectedGithubRepos}
                  disabled={selectedGithubRepos.size === 0 || fetchingRepos}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {fetchingRepos && (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Importar {selectedGithubRepos.size} repositorio{selectedGithubRepos.size !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
