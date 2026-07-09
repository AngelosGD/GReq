import { useState, useMemo } from 'react'
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

function getGroup(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[0] || 'General'
}

async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
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

let repoCounter = 0

export function GitHubSection({ onClose, onImport }: Props) {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set())

  // Manual URL add
  const [showAddForm, setShowAddForm] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // GitHub connect via username
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [username, setUsername] = useState('')
  const [fetchingRepos, setFetchingRepos] = useState(false)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [selectedGithubRepos, setSelectedGithubRepos] = useState<Set<string>>(new Set())
  const [connectError, setConnectError] = useState('')

  const selectedRepo = repos.find((r) => r.id === selectedRepoId) ?? null

  const grouped = useMemo(() => {
    if (!selectedRepo) return {}
    const groups: Record<string, GitHubEndpoint[]> = {}
    for (const ep of selectedRepo.endpoints) {
      const g = getGroup(ep.path)
      if (!groups[g]) groups[g] = []
      groups[g].push(ep)
    }
    return groups
  }, [selectedRepo])

  const epKey = (ep: GitHubEndpoint) => `${ep.method}:${ep.path}`

  const toggleEndpoint = (ep: GitHubEndpoint) => {
    const key = epKey(ep)
    setSelectedEndpoints((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => {
    if (!selectedRepo) return
    setSelectedEndpoints(new Set(selectedRepo.endpoints.map(epKey)))
  }

  const deselectAll = () => setSelectedEndpoints(new Set())

  const importSelected = () => {
    if (!selectedRepo) return
    const chosen = selectedRepo.endpoints.filter((ep) => selectedEndpoints.has(epKey(ep)))
    if (chosen.length === 0) return
    onImport(chosen)
  }

  const importAll = () => {
    if (!selectedRepo) return
    onImport(selectedRepo.endpoints)
  }

  // ── Add repo by URL ──
  const handleAdd = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const result = await importFromGithub(url)
      const id = `repo-${++repoCounter}`
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
    setRepos((prev) => {
      const next = prev.filter((r) => r.id !== id)
      if (selectedRepoId === id) setSelectedRepoId(next[0]?.id ?? null)
      return next
    })
  }

  // ── Connect via GitHub username ──
  const openConnectDialog = () => {
    setShowConnectDialog(true)
    setUsername('')
    setGithubRepos([])
    setSelectedGithubRepos(new Set())
    setConnectError('')
  }

  const handleFetchRepos = async () => {
    if (!username.trim()) return
    setFetchingRepos(true)
    setConnectError('')
    try {
      const ghRepos = await fetchUserRepos(username.trim())
      setGithubRepos(ghRepos)
      setSelectedGithubRepos(new Set(ghRepos.map((r) => r.fullName)))
    } catch (e: any) {
      setConnectError(e?.message || 'Error al obtener repositorios')
    } finally {
      setFetchingRepos(false)
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
        const id = `repo-${++repoCounter}`
        newRepos.push({ id, name: result.title, url: ghRepo.url, endpoints: result.endpoints })
      } catch { /* skip failures */ }
    }
    if (newRepos.length > 0) {
      setRepos((prev) => [...prev, ...newRepos])
      setSelectedRepoId(newRepos[0].id)
      setSelectedEndpoints(new Set(newRepos[0].endpoints.map(epKey)))
    }
    setFetchingRepos(false)
    setShowConnectDialog(false)
    setGithubRepos([])
    setUsername('')
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
      <div className="h-full flex flex-col bg-white">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-700" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
              </svg>
              <span className="text-sm font-bold text-zinc-900 tracking-tight">Desde GitHub</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-900 mb-2">Aún no tienes repositorios conectados</h3>
            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
              Agrega al menos un repositorio de GitHub para importar sus endpoints y empezar a construir tus peticiones.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-[0.98] w-64 justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar repositorio
              </button>
              <div className="flex items-center gap-3 w-64">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">o</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>
              <button
                onClick={openConnectDialog}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-all active:scale-[0.98] w-64 justify-center"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setShowConnectDialog(false)}>
            <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Conectar a GitHub</h3>
                <button onClick={() => setShowConnectDialog(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ingresa tu usuario de GitHub para listar tus repositorios públicos. Selecciona los que quieras importar.
                </p>

                <div>
                  <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">
                    Usuario de GitHub
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ej: tu-usuario"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFetchRepos() }}
                      className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                      autoFocus
                    />
                    <button
                      onClick={handleFetchRepos}
                      disabled={fetchingRepos || !username.trim()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                      {fetchingRepos && (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {fetchingRepos ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {connectError && (
                    <p className="text-[11px] text-red-500 mt-1.5">{connectError}</p>
                  )}
                </div>

                {githubRepos.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.06em]">
                        {githubRepos.length} repositorio{githubRepos.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={toggleSelectAllGh}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        {githubRepos.length === selectedGithubRepos.size ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200/50 rounded-lg bg-white p-1.5">
                      {githubRepos.map((repo) => (
                        <label
                          key={repo.fullName}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGithubRepos.has(repo.fullName)}
                            onChange={() => toggleGhRepo(repo.fullName)}
                            className="accent-zinc-900 w-3.5 h-3.5"
                          />
                          <svg className="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-zinc-700 truncate block">{repo.fullName}</span>
                            {repo.description && (
                              <span className="text-[10px] text-zinc-400 truncate block">{repo.description}</span>
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
                  <button onClick={() => setShowConnectDialog(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={importSelectedGithubRepos}
                    disabled={selectedGithubRepos.size === 0 || fetchingRepos}
                    className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
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
      <div className="h-full flex flex-col bg-white">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowAddForm(false); setUrl('') }} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver
            </button>
            <div className="w-px h-4 bg-zinc-200" />
            <span className="text-sm font-bold text-zinc-900 tracking-tight">Agregar repositorio</span>
          </div>
          <button onClick={() => { setShowAddForm(false); setUrl('') }} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/30 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">URL del repositorio</h3>
              <p className="text-xs text-zinc-500 mb-4">Ingresa la URL de un repositorio público de GitHub para analizar sus endpoints.</p>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/usuario/repo"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                  className="flex-1 bg-white border border-zinc-200/60 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
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
    <div className="h-full flex flex-col bg-white">
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/70 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver
          </button>
          <div className="w-px h-4 bg-zinc-200" />
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
            </svg>
            <span className="text-sm font-bold text-zinc-900 tracking-tight">Desde GitHub</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar repositorio
          </button>
          <div className="w-px h-4 bg-zinc-200" />
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 border-r border-zinc-200/60 bg-white flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em]">Repositorios</div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => { setSelectedRepoId(repo.id); setSelectedEndpoints(new Set(repo.endpoints.map(epKey))) }}
                className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                  selectedRepoId === repo.id ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-10-12-10z"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{repo.name}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{repo.endpoints.length} endpoints</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeRepo(repo.id) }} className="w-5 h-5 flex items-center justify-center rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          {selectedRepo && (
            <>
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-100">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Overview</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {selectedRepo.endpoints.length} endpoint{selectedRepo.endpoints.length !== 1 ? 's' : ''} en {Object.keys(grouped).length} grupo{Object.keys(grouped).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">{selectedEndpoints.size} seleccionado{selectedEndpoints.size !== 1 ? 's' : ''}</span>
                  <div className="w-px h-3.5 bg-zinc-200" />
                  <button onClick={selectedEndpoints.size === selectedRepo.endpoints.length ? deselectAll : selectAll} className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors">
                    {selectedEndpoints.size === selectedRepo.endpoints.length ? 'Deseleccionar' : 'Seleccionar todos'}
                  </button>
                  <div className="w-px h-3.5 bg-zinc-200" />
                  <button onClick={importSelected} disabled={selectedEndpoints.size === 0} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    Importar {selectedEndpoints.size > 0 ? `${selectedEndpoints.size}` : ''}
                  </button>
                  <button onClick={importAll} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all">
                    Importar todo
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {Object.entries(grouped).map(([group, endpoints]) => (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0121.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      <span className="text-xs font-semibold text-zinc-600 capitalize">/{group}</span>
                      <span className="text-[9px] text-zinc-400">{endpoints.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      {endpoints.map((ep, i) => {
                        const c = methodColors[ep.method] ?? { text: 'text-zinc-600', bg: 'bg-zinc-100', border: 'border-zinc-200' }
                        const key = epKey(ep)
                        const checked = selectedEndpoints.has(key)
                        return (
                          <label key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors border border-transparent hover:border-zinc-200/50">
                            <input type="checkbox" checked={checked} onChange={() => toggleEndpoint(ep)} className="accent-zinc-900 w-3.5 h-3.5 shrink-0" />
                            <code className="text-xs font-mono text-zinc-700 flex-1 min-w-0 truncate">{ep.path}</code>
                            {ep.summary && <span className="text-[10px] text-zinc-400 truncate max-w-[200px] hidden sm:block">{ep.summary}</span>}
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${c.text} ${c.bg} border ${c.border}`}>{ep.method}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
