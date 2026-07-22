import { useState, useEffect, useMemo } from 'react'
import { invokeWithTimeout } from '../lib/tauri'
import { importFromGithub, invalidateGithubCache, type GitHubEndpoint } from '../lib/github'

interface RepoInfo {
  id: string
  name: string
  url: string
  endpoints: GitHubEndpoint[]
  openapiUrl?: string
  baseUrl?: string
  cached?: boolean
  scanned?: boolean
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
  onCreateMockApi?: (endpoints: GitHubEndpoint[]) => void
}

const methodColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  GET:    { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  POST:   { text: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  PUT:    { text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  PATCH:  { text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  DELETE: { text: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
  UPDATE: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', dot: 'bg-violet-500' },
}

const TOKEN_KEY = 'greq-github-token'
const REPOS_KEY = 'greq-github-repos'
const SELECTED_KEY = 'greq-github-selected-repo'

function getGithubToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function loadRepos(): RepoInfo[] {
  try {
    const raw = localStorage.getItem(REPOS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RepoInfo[]
  } catch { /* ignore */ }
  return []
}

function saveRepos(list: RepoInfo[]) {
  try { localStorage.setItem(REPOS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

function genRepoId(): string {
  return `repo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function fetchMyRepos(token: string): Promise<GitHubRepo[]> {
  let allRepos: GitHubRepo[] = []
  let page = 1
  let hasMore = true
  while (hasMore) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&type=all`,
      { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
    const data = await res.json()
    for (const r of data) {
      allRepos.push({
        name: r.name,
        fullName: r.full_name,
        url: r.html_url,
        description: r.description || '',
        private: r.private,
      })
    }
    hasMore = data.length === 100
    page++
  }
  return allRepos
}

function paramsFromEndpoint(ep: GitHubEndpoint): { path: { name: string; type: string; required: boolean }[]; query: { name: string; type: string; required: boolean }[] } {
  const path: { name: string; type: string; required: boolean }[] = []
  const query: { name: string; type: string; required: boolean }[] = []
  if (ep.params) {
    for (const p of ep.params) {
      if (p.in === 'query') query.push({ name: p.name, type: p.type, required: p.required ?? false })
      else path.push({ name: p.name, type: p.type, required: p.required ?? false })
    }
  }
  const fromPath = (ep.path.match(/\{(\w+)\}/g) || []).map((m) => m.slice(1, -1))
  for (const name of fromPath) {
    if (!path.find((p) => p.name === name)) path.push({ name, type: 'string', required: true })
  }
  return { path, query }
}

export function GitHubSection({ onClose, onImport, onCreateMockApi }: Props) {
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
  const [searchQuery, setSearchQuery] = useState('')

  // Manual URL add
  const [showAddForm, setShowAddForm] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // GitHub connect via OAuth
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [linking, setLinking] = useState(false)
  const [fetchingRepos, setFetchingRepos] = useState(false)
  const [refreshingRepos, setRefreshingRepos] = useState<Set<string>>(new Set())
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [selectedGithubRepos, setSelectedGithubRepos] = useState<Set<string>>(new Set())
  const [connectError, setConnectError] = useState('')

  const selectedRepo = repos.find((r) => r.id === selectedRepoId) ?? null

  const epKey = (ep: GitHubEndpoint) => `${ep.method}:${ep.path}`

  // Persist
  useEffect(() => { saveRepos(repos) }, [repos])
  useEffect(() => {
    if (selectedRepoId) localStorage.setItem(SELECTED_KEY, selectedRepoId)
    else localStorage.removeItem(SELECTED_KEY)
  }, [selectedRepoId])

  // Filter endpoints by search
  const filteredEndpoints = useMemo(() => {
    if (!selectedRepo) return []
    const q = searchQuery.toLowerCase().trim()
    if (!q) return selectedRepo.endpoints
    return selectedRepo.endpoints.filter(
      (ep) =>
        ep.method.toLowerCase().includes(q) ||
        ep.path.toLowerCase().includes(q) ||
        ep.summary?.toLowerCase().includes(q)
    )
  }, [selectedRepo, searchQuery])

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
    setSearchQuery('')
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
      const newRepo: RepoInfo = { id, name: result.title, url: url.trim(), endpoints: result.endpoints, openapiUrl: result.openapiUrl, baseUrl: result.baseUrl, cached: result.cached, scanned: result.scanned }
      setRepos((prev) => [...prev, newRepo])
      setSelectedRepoId(id)
      setSelectedEndpoints(new Set(result.endpoints.map(epKey)))
      setExpandedRepos((prev) => new Set([...prev, id]))
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
      setSelectedEndpointForDetail(null)
    }
  }

  // ── Refresh repo ──
  const refreshRepo = async (repo: RepoInfo) => {
    setRefreshingRepos((prev) => new Set([...prev, repo.id]))
    invalidateGithubCache(repo.url)
    try {
      const result = await importFromGithub(repo.url)
      const updated: RepoInfo = { ...repo, endpoints: result.endpoints, openapiUrl: result.openapiUrl, baseUrl: result.baseUrl, cached: result.cached, scanned: result.scanned }
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? updated : r)))
      if (selectedRepoId === repo.id) {
        setSelectedEndpoints(new Set(result.endpoints.map(epKey)))
        setSelectedEndpointForDetail(null)
      }
    } catch { /* keep old data */ }
    setRefreshingRepos((prev) => {
      const next = new Set(prev)
      next.delete(repo.id)
      return next
    })
  }

  // ── Connect via GitHub OAuth ──
  const handleLinkGithub = async () => {
    setLinking(true)
    setFetchingRepos(true)
    setConnectError('')
    try {
      const result = await invokeWithTimeout<{ email: string; name: string; accessToken: string }>('login_with_github', {
        clientId: import.meta.env.VITE_GITHUB_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
      })
      localStorage.setItem(TOKEN_KEY, result.accessToken)
      const repos = await fetchMyRepos(result.accessToken)
      setGithubRepos(repos)
      setSelectedGithubRepos(new Set(repos.map((r) => r.fullName)))
    } catch (e: unknown) {
      setConnectError((e as { message?: string })?.message || 'Error al vincular GitHub')
    }
    setFetchingRepos(false)
    setLinking(false)
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
        newRepos.push({ id, name: result.title, url: ghRepo.url, endpoints: result.endpoints, openapiUrl: result.openapiUrl, baseUrl: result.baseUrl, cached: result.cached, scanned: result.scanned })
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
  //  RENDER
  // ══════════════════════════════════════════
  const renderHeader = (title: string, subtitle?: string) => (
    <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
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
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</span>
        </div>
      </div>
      {subtitle && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{subtitle}</span>}
    </header>
  )

  // ── Empty state ──
  if (repos.length === 0 && !showAddForm) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
        {renderHeader('Desde GitHub')}
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

        {showConnectDialog && renderConnectDialog()}
      </div>
    )
  }

  // ── Add repo form ──
  if (showAddForm) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 dark:border-zinc-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowAddForm(false); setUrl('') }} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Agregar repositorio</span>
          </div>
          <button onClick={() => { setShowAddForm(false); setUrl('') }} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
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
                  {loading ? 'Analizando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════
  //  Main view
  // ══════════════════════════════════════════
  const selectedEp = selectedEndpointForDetail
  const { path: pathParams, query: queryParams } = selectedEp ? paramsFromEndpoint(selectedEp) : { path: [], query: [] }

  function renderConnectDialog() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 dark:bg-black/40" onClick={() => setShowConnectDialog(false)}>
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl shadow-black/8 dark:shadow-black/40 w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conectar a GitHub</h3>
            <button onClick={() => setShowConnectDialog(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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
                {connectError && <p className="text-[11px] text-red-500 mt-1.5">{connectError}</p>}
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
              <button onClick={() => setShowConnectDialog(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {renderHeader('Desde GitHub', selectedRepo ? `${selectedRepo.endpoints.length} endpoints` : undefined)}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-60 flex-shrink-0 border-r border-zinc-200/60 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 flex flex-col">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em]">Repositorios</div>
            <button
              onClick={openConnectDialog}
              title="Traer repositorios"
              className="w-6 h-6 -mr-1 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          {/* Search */}
          {selectedRepo && (
            <div className="px-3 pb-2">
              <div className="relative">
                <svg className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar endpoints..."
                  className="w-full bg-zinc-100 dark:bg-zinc-800/80 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 outline-none transition-all placeholder-zinc-400 dark:placeholder-zinc-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {repos.map((repo) => {
              const expanded = expandedRepos.has(repo.id)
              const isSelected = selectedRepoId === repo.id
              const isRefreshing = refreshingRepos.has(repo.id)
              const displayEndpoints = isSelected ? filteredEndpoints : repo.endpoints
              return (
                <div key={repo.id}>
                  <div
                    className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(repo.id) }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" onClick={(e) => { e.stopPropagation(); selectRepo(repo.id); toggleExpand(repo.id) }}>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                    </svg>
                    <div
                      className="flex-1 min-w-0"
                      onClick={(e) => { e.stopPropagation(); selectRepo(repo.id); toggleExpand(repo.id) }}
                    >
                      <div className="text-xs font-medium truncate flex items-center gap-1.5">
                        {repo.name}
                        {repo.cached && (
                          <span className="text-[7px] font-semibold uppercase px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500">Cache</span>
                        )}
                        {repo.scanned && (
                          <span className="text-[7px] font-semibold uppercase px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400">Scan</span>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">{repo.endpoints.length} endpoints</div>
                    </div>

                    {/* Refresh */}
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshRepo(repo) }}
                      disabled={isRefreshing}
                      className="w-5 h-5 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-blue-500 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-30"
                      title="Re-escanear repositorio"
                    >
                      <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                    </button>

                    {/* Delete */}
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
                      {displayEndpoints.length === 0 ? (
                        <div className="px-2 py-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {searchQuery ? 'Sin resultados' : 'Sin endpoints detectados'}
                        </div>
                      ) : (
                        displayEndpoints.map((ep, i) => {
                          const c = methodColors[ep.method] ?? { text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200', dot: 'bg-zinc-400' }
                          const isEpSelected = selectedEndpoints.has(epKey(ep))
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
                              {isEpSelected && (
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

        {/* ── Detail / Preview ── */}
        <main className="flex-1 flex flex-col min-w-0">
          {selectedEp && selectedRepo ? (
            <>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ${methodColors[selectedEp.method]?.text || 'text-zinc-600'} ${methodColors[selectedEp.method]?.bg || 'bg-zinc-100'} border ${methodColors[selectedEp.method]?.border || 'border-zinc-200'}`}>
                    {selectedEp.method}
                  </span>
                  <code className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate">{selectedEp.path}</code>
                </div>
                {selectedEp.summary && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedEp.summary}</p>
                )}
                {selectedEp.description && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 italic">{selectedEp.description}</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Full URL Preview */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">URL real</span>
                  </div>
                  <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2.5 border border-zinc-200/50 dark:border-zinc-700/50 break-all">
                    {(selectedEp.baseUrl || selectedRepo.baseUrl || 'https://api.example.com')}{selectedEp.path}
                  </div>
                </section>

                {/* Path Parameters */}
                {pathParams.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Parámetros de ruta ({pathParams.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {pathParams.map((param) => (
                        <div key={param.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                          <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium">{param.name}</code>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{param.type}</span>
                          {param.required && (
                            <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-200/50 dark:border-red-800 ml-auto">Requerido</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Query Parameters */}
                {queryParams.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                      </svg>
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Parámetros de consulta ({queryParams.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {queryParams.map((param) => (
                        <div key={param.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                          <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium">{param.name}</code>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{param.type}</span>
                          {param.required && (
                            <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-200/50 dark:border-red-800 ml-auto">Requerido</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Headers */}
                {selectedEp.headers && selectedEp.headers.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                      </svg>
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Headers ({selectedEp.headers.length})</span>
                    </div>
                    <div className="space-y-1">
                      {selectedEp.headers.map((h) => (
                        <div key={h.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                          <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium">{h.name}</code>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">: {h.value || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Request Body */}
                {selectedEp.body && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Cuerpo de la petición</span>
                      {selectedEp.contentType && (
                        <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-500 ml-auto">{selectedEp.contentType}</span>
                      )}
                    </div>
                    <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2.5 border border-zinc-200/50 dark:border-zinc-700/50 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{selectedEp.body}</pre>
                  </section>
                )}

                {/* Visual Testing Preview */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Vista previa en diagrama</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${methodColors[selectedEp.method]?.bg || 'bg-zinc-100'} ${methodColors[selectedEp.method]?.text || 'text-zinc-600'} border ${methodColors[selectedEp.method]?.border || 'border-zinc-200'}`}>{selectedEp.method}</span>
                      <code className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex-1 truncate">{(selectedEp.baseUrl || selectedRepo.baseUrl || 'https://api.example.com')}{selectedEp.path}</code>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span>→ Nodo URL con la URL completa</span>
                      <span>→ Nodo Method con método {selectedEp.method}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>URL</span>
                      </div>
                      <svg className="w-3 h-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <span className={`w-2 h-2 rounded-full ${methodColors[selectedEp.method]?.dot || 'bg-zinc-400'}`} />
                        <span>{selectedEp.method}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Selection status */}
                <section>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className={`w-2 h-2 rounded-full ${selectedEndpoints.has(epKey(selectedEp)) ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    {selectedEndpoints.has(epKey(selectedEp))
                      ? 'Este endpoint será incluido al llevar a diagrama'
                      : 'Hacé clic en el endpoint en la barra lateral para seleccionarlo'}
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {selectedEndpoints.size} endpoint{selectedEndpoints.size !== 1 ? 's' : ''} seleccionado{selectedEndpoints.size !== 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCreateMockApi?.(selectedRepo.endpoints.filter((ep) => selectedEndpoints.has(epKey(ep))))}
                    disabled={selectedEndpoints.size === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                    Crear Mock API
                  </button>
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

      {showConnectDialog && renderConnectDialog()}
    </div>
  )
}
