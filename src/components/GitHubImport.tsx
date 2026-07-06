import { useState } from 'react'
import { importFromGithub, type GitHubEndpoint } from '../lib/github'

interface Props {
  onImport: (endpoints: GitHubEndpoint[]) => void
  onClose: () => void
}

export function GitHubImport({ onImport, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ title: string; endpoints: GitHubEndpoint[] } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const handleFetch = async () => {
    if (!url.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const data = await importFromGithub(url)
      setResult(data)
      setSelected(new Set(data.endpoints.map((_, i) => i)))
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (i: number) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const handleImport = () => {
    if (!result) return
    const chosen = result.endpoints.filter((_, i) => selected.has(i))
    onImport(chosen)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[520px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Importar desde GitHub</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">
              URL del repositorio
            </label>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/usuario/repo"
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetch() }}
                className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
              />
              <button
                onClick={handleFetch}
                disabled={loading || !url.trim()}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {loading && (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.06em]">
                  {result.title} — {result.endpoints.length} endpoints
                </span>
                <button
                  onClick={() => {
                    setSelected(new Set(result.endpoints.length === selected.size ? [] : result.endpoints.map((_, i) => i)))
                  }}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {result.endpoints.length === selected.size ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {result.endpoints.map((ep, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                      className="accent-zinc-900 w-3.5 h-3.5"
                    />
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      ep.method === 'GET' ? 'text-emerald-600 bg-emerald-50' :
                      ep.method === 'POST' ? 'text-blue-600 bg-blue-50' :
                      ep.method === 'PUT' || ep.method === 'PATCH' ? 'text-amber-600 bg-amber-50' :
                      'text-red-600 bg-red-50'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-600 truncate">{ep.path}</span>
                    {ep.summary && (
                      <span className="text-[10px] text-zinc-400 truncate ml-auto">{ep.summary}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Importar {selected.size} endpoint{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
