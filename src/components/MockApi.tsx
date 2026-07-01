import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Props {
  onClose: () => void
}

const methods = ['GET', 'POST', 'DELETE', 'UPDATE'] as const
const STORAGE_KEY = 'greq-mock-apis'

const methodColors: Record<string, { dot: string; badge: string; text: string }> = {
  GET:    { dot: '#10b981', badge: '#d1fae5', text: '#059669' },
  POST:   { dot: '#3b82f6', badge: '#dbeafe', text: '#2563eb' },
  DELETE: { dot: '#ef4444', badge: '#fee2e2', text: '#dc2626' },
  UPDATE: { dot: '#f59e0b', badge: '#fef3c7', text: '#d97706' },
}

interface MockApiItem {
  id: string
  name: string
  method: string
  path: string
  port: number
  running: boolean
  serverId: string | null
  statusCode: number
  responseBody: string
}

type FilterMethod = 'Todas' | 'GET' | 'POST' | 'DELETE' | 'UPDATE'

interface Tab {
  id: string
  apiId: string | null
}

const randomPort = () => Math.floor(Math.random() * 10000) + 30000
const defaultBody = JSON.stringify({ id: 1, name: 'John Doe' }, null, 2)

export function MockApi({ onClose }: Props) {
  const [filter, setFilter] = useState<FilterMethod>('Todas')
  const [search, setSearch] = useState('')
  const [mockApis, setMockApis] = useState<MockApiItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const [formName, setFormName] = useState('')
  const [formMethod, setFormMethod] = useState('GET')
  const [formPath, setFormPath] = useState('')
  const [formPort, setFormPort] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [deleteTarget, setDeleteTarget] = useState<MockApiItem | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockApis.slice(0, 20)))
  }, [mockApis])

  const resetForm = () => {
    setFormName('')
    setFormMethod('GET')
    setFormPath('')
    setFormPort(String(randomPort()))
    setFormErrors({})
  }

  const filtered = mockApis
    .filter((a) => filter === 'Todas' || a.method === filter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeApi = activeTab?.apiId ? mockApis.find((a) => a.id === activeTab.apiId) ?? null : null

  const addTab = (apiId: string | null) => {
    const id = crypto.randomUUID()
    setTabs((t) => [...t, { id, apiId }])
    setActiveTabId(id)
  }

  const closeTab = (tabId: string) => {
    const next = tabs.filter((x) => x.id !== tabId)
    setTabs(next)
    if (activeTabId === tabId) {
      const idx = tabs.findIndex((x) => x.id === tabId)
      setActiveTabId(next[Math.min(idx, next.length - 1)]?.id ?? null)
    }
  }

  const selectApi = (apiId: string) => {
    if (activeTab?.apiId === apiId) return
    if (activeTabId) {
      setTabs((t) => t.map((tab) => (tab.id === activeTabId ? { ...tab, apiId } : tab)))
    } else {
      addTab(apiId)
    }
  }

  const startApi = async (api: MockApiItem) => {
    try {
      const info = await invoke<{ url: string; id: string }>('start_mock_server', {
        config: {
          path: api.path,
          method: api.method,
          status: api.statusCode,
          headers: [],
          body: api.responseBody || defaultBody,
          port: api.port,
        },
      })
      const url = new URL(info.url)
      setMockApis((a) =>
        a.map((x) =>
          x.id === api.id
            ? { ...x, running: true, serverId: info.id, port: Number(url.port) }
            : x
        )
      )
    } catch (e) {
      alert(`Error al iniciar: ${e}`)
    }
  }

  const stopApi = async (api: MockApiItem) => {
    if (!api.serverId) return
    try {
      await invoke('stop_mock_server', { id: api.serverId })
    } catch {
      // server might already be down
    }
    setMockApis((a) =>
      a.map((x) => (x.id === api.id ? { ...x, running: false, serverId: null } : x))
    )
  }

  const createApi = () => {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'El nombre es obligatorio'
    if (!formPath.trim()) errors.path = 'La ruta es obligatoria'
    if (!formPort.trim()) errors.port = 'El puerto es obligatorio'
    else if (isNaN(Number(formPort)) || Number(formPort) < 1 || Number(formPort) > 65535)
      errors.port = 'Puerto inválido (1-65535)'
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    if (mockApis.length >= 20) {
      alert('Límite de 20 APIs de prueba alcanzado')
      return
    }

    const id = crypto.randomUUID()
    const api: MockApiItem = {
      id,
      name: formName.trim(),
      method: formMethod,
      path: formPath.trim(),
      port: Number(formPort),
      running: false,
      serverId: null,
      statusCode: 200,
      responseBody: defaultBody,
    }
    setMockApis((a) => [...a, api])
    setShowModal(false)
    resetForm()
    selectApi(id)
  }

  const confirmDelete = (api: MockApiItem) => {
    if (api.running) {
      setDeleteTarget(api)
    } else {
      doDelete(api)
    }
  }

  const doDelete = async (api: MockApiItem) => {
    if (api.running && api.serverId) {
      try {
        await invoke('stop_mock_server', { id: api.serverId })
      } catch {}
    }
    setMockApis((a) => a.filter((x) => x.id !== api.id))
    setTabs((t) => t.map((tab) => (tab.apiId === api.id ? { ...tab, apiId: null } : tab)))
    setDeleteTarget(null)
  }

  const setStatusCode = (apiId: string, code: number) => {
    setMockApis((a) => a.map((x) => (x.id === apiId ? { ...x, statusCode: code } : x)))
  }

  const setResponseBody = (apiId: string, body: string) => {
    setMockApis((a) => a.map((x) => (x.id === apiId ? { ...x, responseBody: body } : x)))
  }

  return (
    <div className="h-full flex bg-white">
      {/* ─── Sidebar ─── */}
      <aside className="w-60 flex-shrink-0 border-r border-zinc-200/50 flex flex-col">
        <div className="flex items-center justify-between px-4 h-11">
          <h2 className="text-sm font-semibold text-zinc-800">APIs de prueba</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-3 pb-2 flex gap-1 flex-wrap border-b border-zinc-100">
          {(['Todas', ...methods] as const).map((m) => {
            const c = m !== 'Todas' ? methodColors[m] : null
            const act = filter === m
            return (
              <button
                key={m}
                onClick={() => setFilter(m)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 transition-all ${
                  act ? 'text-white' : 'text-zinc-400 hover:text-zinc-600'
                }`}
                style={act && c ? { backgroundColor: c.dot } : act ? { backgroundColor: '#18181b' } : undefined}
              >
                {c && (
                  <span className={`w-1.5 h-1.5 rounded-full ${act ? 'bg-white/70' : ''}`} style={!act ? { backgroundColor: c.dot } : undefined} />
                )}
                {m}
              </button>
            )
          })}
        </div>

        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-zinc-50 border border-zinc-200/50 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-zinc-600 placeholder-zinc-300 outline-none focus:border-zinc-300 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {mockApis.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <p className="text-xs text-zinc-500 mb-0.5">No hay APIs de prueba</p>
              <p className="text-[10px] text-zinc-300">Crea una desde el botón de abajo</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] text-zinc-400">Sin resultados</p>
            </div>
          ) : (
            filtered.map((api) => {
              const c = methodColors[api.method]
              const isSelected = activeTab?.apiId === api.id
              return (
                <button
                  key={api.id}
                  onClick={() => selectApi(api.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    isSelected ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-zinc-800 truncate">{api.name}</span>
                        <span
                          className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: c.badge, color: c.text }}
                        >
                          {api.method}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="text-[10px] font-mono text-zinc-400 truncate">/{api.path}</code>
                      </div>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${api.running ? 'bg-emerald-400' : 'bg-zinc-200'}`} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-2 pb-2 border-t border-zinc-100 pt-2">
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-[11px] font-medium
                       bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva API
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs bar */}
        {tabs.length > 0 && (
          <div className="flex items-center h-9 border-b border-zinc-200/50 bg-zinc-50/30 overflow-x-auto scrollbar-none">
            <div className="flex items-center h-full px-1.5 gap-px">
              {tabs.map((tab) => {
                const api = tab.apiId ? mockApis.find((a) => a.id === tab.apiId) : null
                const c = api ? methodColors[api.method] : null
                const isActive = activeTabId === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-t-md text-[11px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-white text-zinc-800 shadow-[inset_0_-1px_0_white] border border-b-0 border-zinc-200/50'
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {api ? (
                      <span className={`w-1.5 h-1.5 rounded-full ${api.running ? 'bg-emerald-400' : 'bg-zinc-300'}`} style={api.running && isActive && c ? { backgroundColor: c.dot } : undefined} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                    )}
                    <span className="truncate max-w-[120px]">{api?.name ?? 'Nueva pestaña'}</span>
                    <span
                      className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-sm text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors"
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => addTab(null)}
                className="flex items-center justify-center w-7 h-7 rounded-t-md text-zinc-400 hover:text-zinc-600 hover:bg-white transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {activeApi ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-base font-semibold text-zinc-900">{activeApi.name}</h3>
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: methodColors[activeApi.method].badge, color: methodColors[activeApi.method].text }}
                    >
                      {activeApi.method}
                    </span>
                    <span className={`text-[10px] font-medium ${activeApi.running ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {activeApi.running ? 'Activo' : 'Detenido'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono text-zinc-400">
                      http://localhost:{activeApi.port}/{activeApi.path}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`http://localhost:${activeApi.port}/${activeApi.path}`)}
                      className="p-0.5 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeApi.running ? (
                    <button
                      onClick={() => stopApi(activeApi)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 16.5v-9z" />
                      </svg>
                      Detener
                    </button>
                  ) : (
                    <button
                      onClick={() => startApi(activeApi)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      Iniciar
                    </button>
                  )}
                  <button
                    onClick={() => confirmDelete(activeApi)}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-5">
              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Endpoint</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Puerto</label>
                    <div className="bg-zinc-50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700">{activeApi.port}</div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Ruta</label>
                    <div className="bg-zinc-50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700">/{activeApi.path}</div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">
                  {activeApi.method === 'GET' && 'Query params'}
                  {activeApi.method === 'POST' && 'Body'}
                  {activeApi.method === 'DELETE' && 'Route params'}
                  {activeApi.method === 'UPDATE' && 'Fields'}
                </h4>
                <div className="bg-zinc-50 rounded-xl p-3">
                  {activeApi.method === 'GET' && (
                    <div className="flex flex-wrap gap-1.5">
                      {['page', 'limit', 'sort'].map((p) => (
                        <span key={p} className="bg-white border border-zinc-200/60 rounded-md px-2.5 py-1 text-[10px] font-mono text-zinc-600">:{p}</span>
                      ))}
                    </div>
                  )}
                  {activeApi.method === 'POST' && (
                    <div className="bg-white border border-zinc-200/60 rounded-lg p-2.5 font-mono text-[10px] text-zinc-500 leading-relaxed">
                      {'{\n  "name": "string",\n  "email": "string"\n}'}
                    </div>
                  )}
                  {activeApi.method === 'DELETE' && (
                    <div className="flex items-center gap-2 bg-white border border-zinc-200/60 rounded-md px-3 py-1.5">
                      <code className="text-[11px] font-mono text-zinc-700">:id</code>
                      <span className="text-[10px] text-zinc-400">string</span>
                    </div>
                  )}
                  {activeApi.method === 'UPDATE' && (
                    <div className="flex flex-wrap gap-1.5">
                      {['name', 'email', 'role'].map((f) => (
                        <span key={f} className="bg-white border border-zinc-200/60 rounded-md px-2.5 py-1 text-[10px] font-mono text-zinc-600">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Response</h4>
                <div className="bg-zinc-50 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Status</span>
                    <div className="flex gap-1">
                      {[200, 201, 400, 404, 500].map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusCode(activeApi.id, s)}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-medium transition-all ${
                            activeApi.statusCode === s ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-400 hover:bg-zinc-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={activeApi.responseBody}
                    onChange={(e) => setResponseBody(activeApi.id, e.target.value)}
                    className="w-full bg-white border border-zinc-200/60 rounded-lg p-2.5 font-mono text-[10px] text-zinc-600 outline-none focus:border-zinc-300 transition-all resize-none h-24"
                  />
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500 mb-0.5">
                {tabs.length > 0 ? 'API aún no seleccionada' : 'Selecciona una API'}
              </p>
              <p className="text-xs text-zinc-400">
                {tabs.length > 0
                  ? 'Elige una desde la barra lateral'
                  : 'Presiona + para abrir una pestaña'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[480px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Nueva API de prueba</h3>
              <button onClick={() => setShowModal(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Nombre</label>
                <input
                  value={formName}
                  onChange={(e) => { setFormName(e.target.value); setFormErrors((e) => ({ ...e, name: '' })) }}
                  placeholder="Ej: Users API"
                  className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                />
                {formErrors.name && <p className="text-[10px] text-red-500 mt-1">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Puerto</label>
                  <input
                    value={formPort}
                    onChange={(e) => { setFormPort(e.target.value); setFormErrors((e) => ({ ...e, port: '' })) }}
                    placeholder="34512"
                    className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                  />
                  {formErrors.port && <p className="text-[10px] text-red-500 mt-1">{formErrors.port}</p>}
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Método</label>
                  <div className="flex gap-1">
                    {methods.map((m) => (
                      <button
                        key={m}
                        onClick={() => setFormMethod(m)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                          formMethod === m ? 'text-white' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
                        }`}
                        style={formMethod === m ? { backgroundColor: methodColors[m].dot } : undefined}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Ruta</label>
                <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-zinc-300 font-mono">/</span>
                  <input
                    value={formPath}
                    onChange={(e) => { setFormPath(e.target.value); setFormErrors((e) => ({ ...e, path: '' })) }}
                    placeholder="api/users"
                    className="flex-1 text-xs font-mono text-zinc-700 outline-none bg-transparent placeholder-zinc-300"
                  />
                </div>
                {formErrors.path && <p className="text-[10px] text-red-500 mt-1">{formErrors.path}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
              <button
                onClick={createApi}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all"
              >
                Crear API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-80 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">Eliminar API</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  La API está en ejecución. ¿Detener y liberar el puerto?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => doDelete(deleteTarget)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
