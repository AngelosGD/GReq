import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'
import { getMockApis, saveMockApi, deleteMockApi } from '../lib/database'
import { trackServer, untrackServer, getActiveServers, clearTrackedServers } from '../lib/runningServers'
import { parseOpenApiSpec } from '../lib/openapi'
import { MockApiSidebar } from './mockApi/MockApiSidebar'
import { MockApiEditor } from './mockApi/MockApiEditor'
import { MockApiCreateModal } from './mockApi/MockApiCreateModal'
import { MockApiItem, methods, STORAGE_KEY, methodColors, randomPort, defaultBody, genId, type FilterMethod, type Tab, type FieldDef } from './mockApi/types'

const invokeWithTimeout = <T,>(cmd: string, args: Record<string, unknown>, ms = 4000): Promise<T> =>
  Promise.race([
    invoke<T>(cmd, args),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado — el backend Tauri no responde')), ms)),
  ])

interface Props {
  onClose: () => void
  onTestInCanvas?: (api: MockApiItem) => void
}

const parseApis = (raw: any[]): MockApiItem[] =>
  raw.map((a) => ({
    id: a.id ?? '',
    name: a.name ?? 'Sin nombre',
    methods: Array.isArray(a.methods) ? a.methods : (a.method ? [a.method] : ['GET']),
    fields: Array.isArray(a.fields) ? a.fields.map((f: any) => typeof f === 'string' ? { name: f, type: 'string' } : { name: f.name ?? '', type: f.type ?? 'string', value: f.value ?? '' }) : [],
    pinned: typeof a.pinned === 'boolean' ? a.pinned : false,
    path: a.path ?? '',
    port: a.port ?? 0,
    running: a.running ?? false,
    serverId: a.serverId ?? null,
    statusCode: a.statusCode ?? 200,
    responseBody: a.responseBody ?? '',
    responseHeaders: Array.isArray(a.responseHeaders) ? a.responseHeaders : [],
    delayMs: a.delayMs ?? 0,
    methodBodies: a.methodBodies ?? {},
    sampleData: Array.isArray(a.sampleData) ? a.sampleData : [],
  }))

export function MockApi({ onClose, onTestInCanvas }: Props) {
  const user = useAuthStore((s) => s.user)
  const [filter, setFilter] = useState<FilterMethod>('Todas')
  const [search, setSearch] = useState('')
  const [mockApis, setMockApis] = useState<MockApiItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? parseApis(JSON.parse(raw)) : []
    } catch { return [] }
  })
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [activeMethod, setActiveMethod] = useState('GET')
  const [restoreList, setRestoreList] = useState<{ apiId: string; name: string; port: number }[]>([])
  const [deleteTarget, setDeleteTarget] = useState<MockApiItem | null>(null)
  const [inspectLog, setInspectLog] = useState<{ method: string; path: string; body: string } | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editPort, setEditPort] = useState('')
  const [editMethods, setEditMethods] = useState<string[]>([])
  const [showOpenApiImport, setShowOpenApiImport] = useState(false)
  const [openApiText, setOpenApiText] = useState('')
  const [openApiLoading, setOpenApiLoading] = useState(false)

  useEffect(() => {
    if (user) {
      getMockApis(user.$id).then((apis) => {
        const items = parseApis(apis as any[])
        setMockApis(items)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      }).catch((err) => console.error('[greq] load mock apis:', err))
    }
  }, [user])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockApis.slice(0, 20)))
    if (user) {
      for (const api of mockApis) {
        saveMockApi(user.$id, {
          id: api.id, name: api.name, methods: api.methods, fields: api.fields, pinned: api.pinned,
          path: api.path, method: api.methods[0] ?? 'GET', statusCode: api.statusCode,
          responseBody: api.responseBody, responseHeaders: api.responseHeaders, delayMs: api.delayMs,
          methodBodies: api.methodBodies, sampleData: api.sampleData, port: api.port,
          isRunning: api.running, serverId: api.serverId,
        }).catch((err) => console.error('[greq] save mock api batch:', err))
      }
    }
  }, [mockApis, user])

  useEffect(() => {
    const saved = getActiveServers()
    if (saved.length > 0) {
      const existing = mockApis.filter((a) => saved.some((s) => s.apiId === a.id))
      setRestoreList(existing.map((a) => ({ apiId: a.id, name: a.name, port: a.port })))
    }
  }, [])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeApi = activeTab?.apiId ? mockApis.find((a) => a.id === activeTab.apiId) ?? null : null

  const addTab = (apiId: string | null) => {
    const id = genId()
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
    if (activeTabId) setTabs((t) => t.map((tab) => (tab.id === activeTabId ? { ...tab, apiId } : tab)))
    else addTab(apiId)
  }

  const startApi = async (api: MockApiItem) => {
    try {
      const reqHeaders = api.responseHeaders ?? []
      const methodConfigs = Object.entries(api.methodBodies ?? {}).map(([m, cfg]) => ({
        method: m, status: cfg.statusCode ?? api.statusCode, headers: cfg.responseHeaders ?? reqHeaders, body: cfg.responseBody || defaultBody,
      }))
      const info = await invokeWithTimeout<{ url: string; id: string }>('start_mock_server', {
        config: { path: api.path, methods: api.methods, status: api.statusCode, headers: reqHeaders, body: api.responseBody || defaultBody, port: api.port, delayMs: api.delayMs, methodConfigs, fields: api.fields, sampleData: api.sampleData },
      })
      const url = new URL(info.url)
      const port = Number(url.port)
      trackServer({ id: info.id, apiId: api.id, name: api.name, port })
      setMockApis((a) => a.map((x) => x.id === api.id ? { ...x, running: true, serverId: info.id, port } : x))
    } catch (e) { alert(`Error al iniciar: ${e}`) }
  }

  const stopApi = async (api: MockApiItem) => {
    if (!api.serverId) return
    try { await invoke('stop_mock_server', { id: api.serverId }) } catch {}
    untrackServer(api.serverId)
    setMockApis((a) => a.map((x) => x.id === api.id ? { ...x, running: false, serverId: null } : x))
  }

  const restoreServers = () => {
    clearTrackedServers()
    for (const item of restoreList) {
      const api = mockApis.find((a) => a.id === item.apiId)
      if (api) startApi(api)
    }
    setRestoreList([])
  }

  const createApi = (name: string, formMethods: string[], formPath: string, formPort: string, formTempFields: FieldDef[], formSampleData: Record<string, string>[]) => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'El nombre es obligatorio'
    if (formMethods.length === 0) errors.methods = 'Selecciona al menos un método'
    if (!formPath.trim()) errors.path = 'La ruta es obligatoria'
    if (!formPort.trim()) errors.port = 'El puerto es obligatorio'
    else if (isNaN(Number(formPort)) || Number(formPort) < 1 || Number(formPort) > 65535) errors.port = 'Puerto inválido (1-65535)'
    if (Object.keys(errors).length > 0) { return false }
    if (mockApis.length >= 20) { alert('Límite de 20 APIs de prueba alcanzado'); return false }
    const id = genId()
    const cleanSampleData = formSampleData.filter((row) => Object.values(row).some((v) => v.trim()))
    const api: MockApiItem = {
      id, name: name.trim(), methods: formMethods, fields: formTempFields, pinned: false,
      path: formPath.trim(), port: Number(formPort), running: false, serverId: null, statusCode: 200,
      responseHeaders: [], delayMs: 0, methodBodies: {}, sampleData: cleanSampleData,
      responseBody: cleanSampleData.length > 0
        ? JSON.stringify(cleanSampleData.map((row, i) => ({ id: i + 1, ...Object.fromEntries(formTempFields.map((f) => {
            let val: any = row[f.name] ?? ''
            if (f.type === 'int') val = Number(row[f.name]) || 0
            else if (f.type === 'float') val = Number(row[f.name]) || 0
            else if (f.type === 'bool') val = row[f.name] === 'true' || row[f.name] === '1'
            return [f.name, val]
          })) })), null, 2)
        : JSON.stringify({ message: 'api vacía', hint: 'Agregá datos de ejemplo en el editor' }, null, 2),
    }
    setMockApis((a) => [...a, api])
    setShowModal(false)
    selectApi(id)
    return true
  }

  const confirmDelete = (api: MockApiItem) => {
    if (api.running) setDeleteTarget(api)
    else doDelete(api)
  }

  const doDelete = async (api: MockApiItem) => {
    if (api.running && api.serverId) { try { await invoke('stop_mock_server', { id: api.serverId }) } catch {} }
    setMockApis((a) => a.filter((x) => x.id !== api.id))
    setTabs((t) => t.map((tab) => (tab.apiId === api.id ? { ...tab, apiId: null } : tab)))
    if (user) deleteMockApi(user.$id, api.id).catch((err) => console.error('[greq] delete mock api:', err))
    setDeleteTarget(null)
  }

  const setDelayMs = (apiId: string, ms: number) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, delayMs: ms } : x))
  const setMethodStatusCode = (apiId: string, method: string, code: number) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { responseBody: x.responseBody, responseHeaders: x.responseHeaders }), statusCode: code } } } : x))
  const setMethodResponseBody = (apiId: string, method: string, body: string) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { statusCode: x.statusCode, responseHeaders: x.responseHeaders }), responseBody: body } } } : x))
  const setMethodResponseHeaders = (apiId: string, method: string, headers: { key: string; value: string }[]) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { statusCode: x.statusCode, responseBody: x.responseBody }), responseHeaders: headers } } } : x))
  const setSampleData = (apiId: string, data: Record<string, string>[]) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, sampleData: data, responseBody: JSON.stringify(data.map((row, i) => ({ id: i + 1, ...row })), null, 2) } : x))

  const fetchInspect = async (api: MockApiItem) => {
    setInspectLoading(true)
    try {
      const res = await fetch(`http://localhost:${api.port}/__inspect`)
      if (res.ok) { const data = await res.json(); setInspectLog(data) }
      else { setInspectLog(null); alert('No hay peticiones registradas aún') }
    } catch { alert('Error al consultar el inspector') }
    finally { setInspectLoading(false) }
  }

  const togglePin = (apiId: string) => setMockApis((a) => a.map((x) => x.id === apiId ? { ...x, pinned: !x.pinned } : x))

  const startEditing = (api: MockApiItem) => {
    setEditName(api.name); setEditPath(api.path); setEditPort(String(api.port)); setEditMethods([...api.methods]); setEditing(true)
  }
  const saveEditing = (api: MockApiItem) => {
    const port = Number(editPort)
    if (!editName.trim() || !editPath.trim() || !editPort.trim() || isNaN(port) || port < 1 || port > 65535 || editMethods.length === 0) return
    setMockApis((a) => a.map((x) => x.id === api.id ? { ...x, name: editName.trim(), path: editPath.trim(), port, methods: editMethods } : x))
    setEditing(false)
  }
  const cancelEditing = () => setEditing(false)
  const duplicateApi = (api: MockApiItem) => {
    if (mockApis.length >= 20) { alert('Límite de 20 APIs de prueba alcanzado'); return }
    const id = genId()
    setMockApis((a) => [...a, { ...JSON.parse(JSON.stringify(api)), id, name: `${api.name} (copia)`, running: false, serverId: null, port: randomPort() }])
    selectApi(id)
  }
  const exportApi = (api: MockApiItem) => {
    const blob = new Blob([JSON.stringify(api, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mock-${api.name.replace(/\s+/g, '-').toLowerCase()}.json`; a.click(); URL.revokeObjectURL(url)
  }

  const handleImportOpenApi = async () => {
    if (!openApiText.trim()) return
    setOpenApiLoading(true)
    try {
      const apis = parseOpenApiSpec(openApiText)
      if (apis.length === 0) { alert('No se encontraron endpoints'); return }
      for (const api of apis) {
        setMockApis((a) => {
          if (a.length >= 20) return a
          return [...a, api as MockApiItem]
        })
      }
      setShowOpenApiImport(false)
      setOpenApiText('')
      alert(`${apis.length} API(s) importadas correctamente`)
    } catch (e) { alert(`Error al importar: ${e}`) }
    finally { setOpenApiLoading(false) }
  }

  const prevApiIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeApi && activeApi.id !== prevApiIdRef.current) {
      prevApiIdRef.current = activeApi.id
      setActiveMethod(activeApi.methods[0] ?? 'GET')
      setEditing(false)
    }
  }, [activeApi])

  return (
    <div className="h-full flex bg-white">
      <div className="flex flex-col">
        <MockApiSidebar
          mockApis={mockApis} filter={filter} search={search} activeTabApiId={activeTab?.apiId ?? null}
          onSetFilter={setFilter} onSetSearch={setSearch} onSelectApi={selectApi}
          onTogglePin={togglePin} onNewApi={() => { setShowModal(true); setEditing(false) }} onClose={onClose}
        />
        <div className="px-2 pb-2 border-t border-zinc-100 pt-2">
          <button onClick={() => setShowOpenApiImport(true)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-[10px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Importar OpenAPI
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {tabs.length > 0 && (
          <div className="flex items-center h-9 border-b border-zinc-200/50 bg-zinc-50/30 overflow-x-auto scrollbar-none">
            <div className="flex items-center h-full px-1.5 gap-px">
              {tabs.map((tab) => {
                const api = tab.apiId ? mockApis.find((a) => a.id === tab.apiId) : null
                const c = api ? methodColors[api.methods[0] ?? 'GET'] : null
                const isActive = activeTabId === tab.id
                return (
                  <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-t-md text-[11px] font-medium whitespace-nowrap transition-all ${isActive ? 'bg-white text-zinc-800 shadow-[inset_0_-1px_0_white] border border-b-0 border-zinc-200/50' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    {api ? <span className={`w-1.5 h-1.5 rounded-full ${api.running ? 'bg-emerald-400' : 'bg-zinc-300'}`} style={api.running && isActive && c ? { backgroundColor: c.dot } : undefined} /> : <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />}
                    <span className="truncate max-w-[120px]">{api?.name ?? 'Nueva pestaña'}</span>
                    <span className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-sm text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors" onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}>
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                  </button>
                )
              })}
              <button onClick={() => addTab(null)} className="flex items-center justify-center w-7 h-7 rounded-t-md text-zinc-400 hover:text-zinc-600 hover:bg-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
          </div>
        )}

        {restoreList.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-xs text-amber-800">{restoreList.length} servidor(es) estaban activos antes de cerrar la app.</p>
            <div className="flex gap-2">
              <button onClick={restoreServers} className="text-xs px-3 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors">Restaurar</button>
              <button onClick={() => setRestoreList([])} className="text-xs px-3 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Ignorar</button>
            </div>
          </div>
        )}

        {activeApi ? (
          <MockApiEditor
            api={activeApi} activeMethod={activeMethod} editing={editing}
            editName={editName} editPath={editPath} editPort={editPort} editMethods={editMethods}
            methods={[...methods]} inspectLoading={inspectLoading}
            onSetActiveMethod={setActiveMethod}
            onSetEditName={setEditName} onSetEditPath={setEditPath} onSetEditPort={setEditPort} onSetEditMethods={setEditMethods}
            onSaveEditing={() => saveEditing(activeApi)} onCancelEditing={cancelEditing} onStartEditing={() => startEditing(activeApi)}
            onStartApi={() => startApi(activeApi)} onStopApi={() => stopApi(activeApi)}
            onFetchInspect={() => fetchInspect(activeApi)} onTestInCanvas={onTestInCanvas}
            onDuplicateApi={() => duplicateApi(activeApi)} onExportApi={() => exportApi(activeApi)}
            onConfirmDelete={() => confirmDelete(activeApi)}
            onSetDelayMs={(ms) => setDelayMs(activeApi.id, ms)}
            onSetMethodStatusCode={(m, c) => setMethodStatusCode(activeApi.id, m, c)}
            onSetMethodResponseBody={(m, b) => setMethodResponseBody(activeApi.id, m, b)}
            onSetMethodResponseHeaders={(m, h) => setMethodResponseHeaders(activeApi.id, m, h)}
            onSetSampleData={(d) => setSampleData(activeApi.id, d)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500 mb-0.5">{tabs.length > 0 ? 'API aún no seleccionada' : 'Selecciona una API'}</p>
              <p className="text-xs text-zinc-400">{tabs.length > 0 ? 'Elige una desde la barra lateral' : 'Presiona + para abrir una pestaña'}</p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <MockApiCreateModal
          onClose={() => setShowModal(false)}
          onCreate={(name, m, path, port, fields, sampleData) => createApi(name, m, path, port, fields, sampleData)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-80 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">Eliminar API</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">La API está en ejecución. ¿Detener y liberar el puerto?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
              <button onClick={() => doDelete(deleteTarget)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-all">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setInspectLog(null)}>
          <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[480px] max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-800">Última petición</h3>
              <button onClick={() => setInspectLog(null)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div><span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Método</span><span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: methodColors[inspectLog.method]?.badge ?? '#f4f4f5', color: methodColors[inspectLog.method]?.text ?? '#18181b' }}>{inspectLog.method}</span></div>
              <div><span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Path</span><code className="text-xs font-mono text-zinc-600 bg-zinc-50 rounded-lg px-2 py-1 block truncate">/{inspectLog.path}</code></div>
              {inspectLog.body && <div><span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Body</span><pre className="text-[10px] font-mono text-zinc-600 bg-zinc-50 rounded-lg p-2.5 whitespace-pre-wrap max-h-40 overflow-y-auto">{inspectLog.body}</pre></div>}
            </div>
          </div>
        </div>
      )}

      {showOpenApiImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm" onClick={() => setShowOpenApiImport(false)}>
          <div className="bg-white rounded-2xl shadow-tinted-lg border border-zinc-200/70 w-[520px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-800">Importar OpenAPI</h3>
              <button onClick={() => setShowOpenApiImport(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[11px] text-zinc-500">Pegá el contenido de un archivo OpenAPI (JSON o YAML) para crear APIs de prueba automáticamente.</p>
              <textarea value={openApiText} onChange={(e) => setOpenApiText(e.target.value)} placeholder='{"openapi":"3.0.0","paths":{...}}' rows={10}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 font-mono text-[11px] text-zinc-700 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all resize-none placeholder-zinc-300" />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
              <button onClick={() => setShowOpenApiImport(false)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100">Cancelar</button>
              <button onClick={handleImportOpenApi} disabled={openApiLoading || !openApiText.trim()}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center gap-1.5">
                {openApiLoading && <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {openApiLoading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
