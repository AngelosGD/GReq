import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../store/authStore'
import { getMockApis, saveMockApi, deleteMockApi } from '../lib/database'
import { trackServer, untrackServer, getActiveServers, clearTrackedServers } from '../lib/runningServers'
import { generateMockApi } from '../lib/ai'
import { KeyValuePair } from '../types'
import { KeyValueEditor } from './KeyValueEditor'

const invokeWithTimeout = <T,>(cmd: string, args: Record<string, unknown>, ms = 4000): Promise<T> =>
  Promise.race([
    invoke<T>(cmd, args),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado — el backend Tauri no responde')), ms)),
  ])

interface Props {
  onClose: () => void
  onTestInCanvas?: (api: MockApiItem) => void
}

const methods = ['GET', 'POST', 'DELETE', 'UPDATE'] as const
const STORAGE_KEY = 'greq-mock-apis'

const methodColors: Record<string, { dot: string; badge: string; text: string }> = {
  GET:    { dot: '#10b981', badge: '#d1fae5', text: '#059669' },
  POST:   { dot: '#3b82f6', badge: '#dbeafe', text: '#2563eb' },
  DELETE: { dot: '#ef4444', badge: '#fee2e2', text: '#dc2626' },
  UPDATE: { dot: '#f59e0b', badge: '#fef3c7', text: '#d97706' },
}

interface FieldDef {
  name: string
  type: string
  value?: string
}

const FIELD_TYPES = ['string', 'int', 'bool'] as const

interface MockApiItem {
  id: string
  name: string
  methods: string[]
  fields: FieldDef[]
  pinned: boolean
  path: string
  port: number
  running: boolean
  serverId: string | null
  statusCode: number
  responseBody: string
  responseHeaders: KeyValuePair[]
  delayMs: number
  methodBodies: Record<string, { statusCode: number; responseBody: string; responseHeaders: KeyValuePair[] }>
  sampleData: Record<string, string>[]
}

type FilterMethod = 'Todas' | 'GET' | 'POST' | 'DELETE' | 'UPDATE'

interface Tab {
  id: string
  apiId: string | null
}

const randomPort = () => Math.floor(Math.random() * 10000) + 30000
const defaultBody = JSON.stringify({ id: 1, name: 'John Doe' }, null, 2)

function genId(): string {
  try {
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const h = (i: number) => buf[i].toString(16).padStart(2, '0')
    return `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-${h(8)}${h(9)}-${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function MockApi({ onClose, onTestInCanvas }: Props) {
  const user = useAuthStore((s) => s.user)
  const [filter, setFilter] = useState<FilterMethod>('Todas')
  const [search, setSearch] = useState('')
  const [mockApis, setMockApis] = useState<MockApiItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: any[] = JSON.parse(raw)
      return parsed.map((a) => ({
        id: a.id ?? '',
        name: a.name ?? 'Sin nombre',
        methods: Array.isArray(a.methods) ? a.methods : (a.method ? [a.method] : ['GET']),
        fields: Array.isArray(a.fields)
          ? a.fields.map((f: any) => typeof f === 'string' ? { name: f, type: 'string' } : { name: f.name ?? '', type: f.type ?? 'string', value: f.value ?? '' })
          : [],
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
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (user) {
      getMockApis(user.$id).then((apis) => {
        const items: MockApiItem[] = (apis as any[]).map((a) => ({
          id: a.id,
          name: a.name ?? '',
        methods: Array.isArray(a.methods) ? a.methods : (a.method ? [a.method] : ['GET']),
        fields: Array.isArray(a.fields)
          ? a.fields.map((f: any) => typeof f === 'string' ? { name: f, type: 'string' } : { name: f.name ?? '', type: f.type ?? 'string', value: f.value ?? '' })
          : [],
        pinned: typeof a.pinned === 'boolean' ? a.pinned : false,
          path: a.path ?? '',
          port: a.port ?? 0,
          running: a.isRunning ?? false,
          serverId: a.serverId ?? null,
          statusCode: a.statusCode ?? 200,
          responseBody: a.responseBody ?? '',
          responseHeaders: Array.isArray(a.responseHeaders) ? a.responseHeaders : [],
          delayMs: a.delayMs ?? 0,
          methodBodies: a.methodBodies ?? {},
          sampleData: Array.isArray(a.sampleData) ? a.sampleData : [],
        }))
        setMockApis(items)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      }).catch((err) => console.error('[greq] load mock apis:', err))
    }
  }, [user])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const [activeMethod, setActiveMethod] = useState('GET')
  const [restoreList, setRestoreList] = useState<{ apiId: string; name: string; port: number }[]>([])

  const [formName, setFormName] = useState('')
  const [formMethods, setFormMethods] = useState<string[]>(['GET'])
  const [formTempFields, setFormTempFields] = useState<FieldDef[]>([])
  const [formNewFieldName, setFormNewFieldName] = useState('')
  const [formNewFieldType, setFormNewFieldType] = useState<string>('string')
  const [formNewFieldValue, setFormNewFieldValue] = useState('')
  const [formSampleData, setFormSampleData] = useState<Record<string, string>[]>([])
  const [formPath, setFormPath] = useState('')
  const [formPort, setFormPort] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<MockApiItem | null>(null)
  const [inspectLog, setInspectLog] = useState<{ method: string; path: string; body: string } | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editPort, setEditPort] = useState('')
  const [editMethods, setEditMethods] = useState<string[]>([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockApis.slice(0, 20)))
    if (user) {
      for (const api of mockApis) {
        saveMockApi(user.$id, {
          id: api.id,
          name: api.name,
          methods: api.methods,
          fields: api.fields,
          pinned: api.pinned,
          path: api.path,
          method: api.methods[0] ?? 'GET',
          statusCode: api.statusCode,
          responseBody: api.responseBody,
          responseHeaders: api.responseHeaders,
          delayMs: api.delayMs,
          methodBodies: api.methodBodies,
          sampleData: api.sampleData,
          port: api.port,
          isRunning: api.running,
          serverId: api.serverId,
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

  const handleAddField = () => {
    if (!formNewFieldName.trim()) return
    setFormTempFields((prev) => [...prev, { name: formNewFieldName.trim(), type: formNewFieldType, value: formNewFieldValue || undefined }])
    setFormNewFieldName('')
    setFormNewFieldValue('')
    setFormErrors((e) => ({ ...e, fields: '' }))
  }

  const handleRemoveField = (idx: number) => {
    setFormTempFields((prev) => prev.filter((_, i) => i !== idx))
  }

  const resetForm = () => {
    setFormName('')
    setFormMethods(['GET'])
    setFormTempFields([])
    setFormNewFieldName('')
    setFormNewFieldType('string')
    setFormNewFieldValue('')
    setFormSampleData([])
    setFormPath('')
    setFormErrors({})
    setAiDescription('')
  }

  useEffect(() => {
    if (formTempFields.length > 0 && formSampleData.length === 0) {
      const row: Record<string, string> = {}
      for (const f of formTempFields) {
        row[f.name] = f.value ?? ''
      }
      setFormSampleData([row])
    }
  }, [formTempFields])

  const addSampleRow = () => {
    const row: Record<string, string> = {}
    for (const f of formTempFields) {
      row[f.name] = f.value ?? ''
    }
    setFormSampleData((prev) => [...prev, row])
  }

  const removeSampleRow = (idx: number) => {
    setFormSampleData((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateSampleRow = (idx: number, field: string, value: string) => {
    setFormSampleData((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))
  }

  const filtered = mockApis
    .filter((a) => filter === 'Todas' || a.methods.includes(filter))
    .filter((a) => (a.name ?? '').toLowerCase().includes(search.toLowerCase()))

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
    if (activeTabId) {
      setTabs((t) => t.map((tab) => (tab.id === activeTabId ? { ...tab, apiId } : tab)))
    } else {
      addTab(apiId)
    }
  }

  const startApi = async (api: MockApiItem) => {
    try {
      const reqHeaders = api.responseHeaders ?? []
      const methodConfigs = Object.entries(api.methodBodies ?? {}).map(([m, cfg]) => ({
        method: m,
        status: cfg.statusCode ?? api.statusCode,
        headers: cfg.responseHeaders ?? reqHeaders,
        body: cfg.responseBody || defaultBody,
      }))
      const info = await invokeWithTimeout<{ url: string; id: string }>('start_mock_server', {
        config: {
          path: api.path,
          methods: api.methods,
          status: api.statusCode,
          headers: reqHeaders,
          body: api.responseBody || defaultBody,
          port: api.port,
          delayMs: api.delayMs,
          methodConfigs,
          fields: api.fields,
          sampleData: api.sampleData,
        },
      })
      const url = new URL(info.url)
      const port = Number(url.port)
      trackServer({ id: info.id, apiId: api.id, name: api.name, port })
      setMockApis((a) =>
        a.map((x) =>
          x.id === api.id
            ? { ...x, running: true, serverId: info.id, port }
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
    untrackServer(api.serverId)
    setMockApis((a) =>
      a.map((x) => (x.id === api.id ? { ...x, running: false, serverId: null } : x))
    )
  }

  const restoreServers = () => {
    clearTrackedServers()
    for (const item of restoreList) {
      const api = mockApis.find((a) => a.id === item.apiId)
      if (api) startApi(api)
    }
    setRestoreList([])
  }

  const handleAiGenerate = async () => {
    if (!aiDescription.trim()) return
    setAiLoading(true)
    try {
      const result = await generateMockApi(aiDescription)
      setFormName(result.name)
      setFormPath(result.path.replace(/^\/+/, ''))
      setFormMethods(result.methods)
      resetFormFieldTypes(result.fields)
      setFormTempFields(result.fields)
      setFormErrors({})
    } catch (e) {
      alert(`Error al generar con IA: ${e}`)
    } finally {
      setAiLoading(false)
    }
  }

  const resetFormFieldTypes = (fields: { name: string; type: string }[]) => {
    if (fields.length > 0) {
      setFormNewFieldType(fields[fields.length - 1].type)
    }
  }

  const createApi = () => {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'El nombre es obligatorio'
    if (formMethods.length === 0) errors.methods = 'Selecciona al menos un método'
    if (formTempFields.length === 0) errors.fields = 'Agrega al menos un campo'
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

    const id = genId()
    const cleanSampleData = formSampleData.filter((row) => Object.values(row).some((v) => v.trim()))
    const api: MockApiItem = {
      id,
      name: formName.trim(),
      methods: formMethods,
      fields: formTempFields,
      pinned: false,
      path: formPath.trim(),
      port: Number(formPort),
      running: false,
      serverId: null,
      statusCode: 200,
      responseHeaders: [],
      delayMs: 0,
      methodBodies: {},
      sampleData: cleanSampleData,
      responseBody: cleanSampleData.length > 0
        ? JSON.stringify(
            cleanSampleData.map((row, i) => ({
              id: i + 1,
              ...Object.fromEntries(
                formTempFields.map((f) => {
                  let val: any
                  if (row[f.name]) {
                    if (f.type === 'int') val = Number(row[f.name])
                    else if (f.type === 'bool') val = row[f.name] === 'true' || row[f.name] === '1'
                    else val = row[f.name]
                  } else {
                    if (f.type === 'int') val = 0
                    else if (f.type === 'bool') val = false
                    else val = ''
                  }
                  return [f.name, val]
                })
              ),
            })),
            null,
            2
          )
        : defaultBody,
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
    if (user) {
      deleteMockApi(user.$id, api.id).catch((err) => console.error('[greq] delete mock api:', err))
    }
    setDeleteTarget(null)
  }

  const setDelayMs = (apiId: string, ms: number) => {
    setMockApis((a) => a.map((x) => (x.id === apiId ? { ...x, delayMs: ms } : x)))
  }

  const setMethodStatusCode = (apiId: string, method: string, code: number) => {
    setMockApis((a) => a.map((x) =>
      x.id === apiId
        ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { responseBody: x.responseBody, responseHeaders: x.responseHeaders }), statusCode: code } } }
        : x
    ))
  }

  const setMethodResponseBody = (apiId: string, method: string, body: string) => {
    setMockApis((a) => a.map((x) =>
      x.id === apiId
        ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { statusCode: x.statusCode, responseHeaders: x.responseHeaders }), responseBody: body } } }
        : x
    ))
  }

  const setMethodResponseHeaders = (apiId: string, method: string, headers: KeyValuePair[]) => {
    setMockApis((a) => a.map((x) =>
      x.id === apiId
        ? { ...x, methodBodies: { ...x.methodBodies, [method]: { ...(x.methodBodies[method] ?? { statusCode: x.statusCode, responseBody: x.responseBody }), responseHeaders: headers } } }
        : x
    ))
  }

  const effStatusCode = (api: MockApiItem, method: string) =>
    api.methodBodies?.[method]?.statusCode ?? api.statusCode
  const effResponseBody = (api: MockApiItem, method: string) =>
    api.methodBodies?.[method]?.responseBody ?? api.responseBody
  const effResponseHeaders = (api: MockApiItem, method: string) =>
    api.methodBodies?.[method]?.responseHeaders ?? api.responseHeaders ?? []

  const fetchInspect = async (api: MockApiItem) => {
    setInspectLoading(true)
    try {
      const res = await fetch(`http://localhost:${api.port}/__inspect`)
      if (res.ok) {
        const data = await res.json()
        setInspectLog(data)
      } else {
        setInspectLog(null)
        alert('No hay peticiones registradas aún')
      }
    } catch {
      alert('Error al consultar el inspector')
    } finally {
      setInspectLoading(false)
    }
  }

  const genCurl = (api: MockApiItem, method: string) => {
    const body = effResponseBody(api, method)
    const pairs: string[] = [`curl -X ${method} "http://localhost:${api.port}/${api.path}"`]
    for (const h of effResponseHeaders(api, method)) {
      if (h.key) pairs.push(`  -H "${h.key}: ${h.value}"`)
    }
    if (body && (method === 'POST' || method === 'UPDATE')) {
      pairs.push(`  -d '${body.replace(/'/g, "\\'")}'`)
    }
    return pairs.join(' \\\n')
  }

  const togglePin = (apiId: string) => {
    setMockApis((a) => a.map((x) => (x.id === apiId ? { ...x, pinned: !x.pinned } : x)))
  }

  const startEditing = (api: MockApiItem) => {
    setEditName(api.name)
    setEditPath(api.path)
    setEditPort(String(api.port))
    setEditMethods([...api.methods])
    setEditing(true)
  }

  const saveEditing = (api: MockApiItem) => {
    const port = Number(editPort)
    if (!editName.trim() || !editPath.trim() || !editPort.trim() || isNaN(port) || port < 1 || port > 65535 || editMethods.length === 0) return
    setMockApis((a) => a.map((x) =>
      x.id === api.id
        ? { ...x, name: editName.trim(), path: editPath.trim(), port, methods: editMethods }
        : x
    ))
    setEditing(false)
  }

  const cancelEditing = () => setEditing(false)

  const duplicateApi = (api: MockApiItem) => {
    if (mockApis.length >= 20) {
      alert('Límite de 20 APIs de prueba alcanzado')
      return
    }
    const id = genId()
    const copy: MockApiItem = {
      ...JSON.parse(JSON.stringify(api)),
      id,
      name: `${api.name} (copia)`,
      running: false,
      serverId: null,
      port: randomPort(),
    }
    setMockApis((a) => [...a, copy])
    selectApi(id)
  }

  const exportApi = (api: MockApiItem) => {
    const blob = new Blob([JSON.stringify(api, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mock-${api.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
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
                  act ? 'text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {c ? (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${act ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
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
            [...filtered]
              .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
              .map((api) => {
                const isSelected = activeTab?.apiId === api.id
                return (
                  <div
                    key={api.id}
                    className={`w-full px-1.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                      isSelected ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <button
                      onClick={() => togglePin(api.id)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center"
                    >
                      <svg className={`w-3 h-3 ${api.pinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 hover:text-zinc-400'}`} viewBox="0 0 24 24" fill={api.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => selectApi(api.id)}
                      className="flex-1 flex items-center gap-2 min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-zinc-800 truncate">{api.name}</span>
                          <div className="flex gap-0.5 flex-wrap shrink-0">
                            {api.methods.map((m) => {
                              const c = methodColors[m]
                              return (
                                <span key={m} className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: c?.dot ?? '#a1a1aa' }} />
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex gap-1 flex-wrap">
                            {api.methods.map((m) => {
                              const c = methodColors[m]
                              return (
                                <span
                                  key={m}
                                  className="text-[8px] font-medium uppercase tracking-wider"
                                  style={{ color: c?.text ?? '#a1a1aa' }}
                                >
                                  {m}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        <code className="text-[10px] font-mono text-zinc-400 truncate">/{api.path}</code>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${api.running ? 'bg-emerald-400' : 'bg-zinc-200'}`} />
                    </button>
                  </div>
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
                const c = api ? methodColors[api.methods[0] ?? 'GET'] : null
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

        {restoreList.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-xs text-amber-800">
              {restoreList.length} servidor(es) estaban activos antes de cerrar la app.
            </p>
            <div className="flex gap-2">
              <button
                onClick={restoreServers}
                className="text-xs px-3 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors"
              >
                Restaurar
              </button>
              <button
                onClick={() => setRestoreList([])}
                className="text-xs px-3 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              >
                Ignorar
              </button>
            </div>
          </div>
        )}

        {activeApi ? (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-4 pb-3 border-b border-zinc-100">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-800 outline-none focus:border-zinc-300 transition-all"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[8px] font-semibold text-zinc-400 uppercase tracking-wider block mb-0.5">Puerto</label>
                          <input
                            value={editPort}
                            onChange={(e) => setEditPort(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all"
                          />
                        </div>
                        <div className="flex-[2]">
                          <label className="text-[8px] font-semibold text-zinc-400 uppercase tracking-wider block mb-0.5">Ruta</label>
                          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-xs text-zinc-300 font-mono">/</span>
                            <input
                              value={editPath}
                              onChange={(e) => setEditPath(e.target.value)}
                              className="flex-1 text-xs font-mono text-zinc-700 outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] font-semibold text-zinc-400 uppercase tracking-wider block mb-0.5">Métodos</label>
                        <div className="flex gap-1">
                          {methods.map((m) => {
                            const selected = editMethods.includes(m)
                            return (
                              <button
                                key={m}
                                onClick={() => setEditMethods((prev) =>
                                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                                )}
                                className={`flex-1 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all ${
                                  selected ? 'text-white' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
                                }`}
                                style={selected ? { backgroundColor: methodColors[m].dot } : undefined}
                              >
                                {m}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-zinc-900 truncate">{activeApi.name}</h3>
                        <button
                          onClick={() => togglePin(activeApi.id)}
                          className="shrink-0 w-5 h-5 flex items-center justify-center"
                        >
                          <svg className={`w-3.5 h-3.5 ${activeApi.pinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 hover:text-zinc-400'}`} viewBox="0 0 24 24" fill={activeApi.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        </button>
                        <span className={`text-[10px] font-medium ${activeApi.running ? 'text-emerald-600' : 'text-zinc-400'}`}>
                          {activeApi.running ? 'Activo' : 'Detenido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[11px] font-mono text-zinc-400 truncate">
                          http://localhost:{activeApi.port}/{activeApi.path}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(`http://localhost:${activeApi.port}/${activeApi.path}`)}
                          className="p-0.5 rounded text-zinc-300 hover:text-zinc-500 transition-colors shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        </button>
                      </div>
                      {activeApi.methods.length > 1 && (
                        <div className="flex gap-0 mt-3">
                          {activeApi.methods.map((m) => {
                            const c = methodColors[m]
                            return (
                              <button
                                key={m}
                                onClick={() => setActiveMethod(m)}
                                className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all ${
                                  activeMethod === m
                                    ? 'text-zinc-900 border-b-2'
                                    : 'text-zinc-400 hover:text-zinc-600 border-b-2 border-transparent'
                                }`}
                                style={activeMethod === m ? { borderBottomColor: c?.dot, color: c?.dot } : undefined}
                              >
                                {m}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={() => saveEditing(activeApi)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
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
                      {!activeApi.running && (
                        <button
                          onClick={() => startEditing(activeApi)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          Editar
                        </button>
                      )}
                      {activeApi.running && (
                        <button
                          onClick={() => fetchInspect(activeApi)}
                          disabled={inspectLoading}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-50 text-zinc-500 hover:bg-zinc-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          {inspectLoading ? '...' : 'Inspeccionar'}
                        </button>
                      )}
                      {activeApi.running && onTestInCanvas && (
                        <button
                          onClick={() => onTestInCanvas(activeApi)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Probar
                        </button>
                      )}
                      <button
                        onClick={() => duplicateApi(activeApi)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-all"
                        title="Duplicar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      </button>
                      <button
                        onClick={() => exportApi(activeApi)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-all"
                        title="Exportar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => confirmDelete(activeApi)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </>
                  )}
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
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Comportamiento — <span className="text-zinc-600">{activeMethod}</span></h4>
                <div className="bg-zinc-50 rounded-xl p-3 space-y-2">
                  {activeMethod === 'GET' && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 font-mono text-[9px]">GET /{activeApi.path}</span>
                        <span>→ array con 3 elementos</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 font-mono text-[9px]">GET /{activeApi.path}/:id</span>
                        <span>→ un elemento por ID</span>
                      </div>
                    </>
                  )}
                  {activeMethod === 'POST' && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 font-mono text-[9px]">POST /{activeApi.path}</span>
                        <span>→ crea recurso, genera ID auto</span>
                      </div>
                      <p className="text-[9px] text-zinc-400">Envía body con los campos, se mezcla con los valores por defecto</p>
                    </>
                  )}
                  {activeMethod === 'DELETE' && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 font-mono text-[9px]">DELETE /{activeApi.path}/:id</span>
                        <span>→ elimina recurso por ID</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <code className="text-[10px] font-mono text-zinc-500">:id</code>
                        <span className="text-[9px] text-zinc-400">— path param obligatorio (último segmento de la ruta)</span>
                      </div>
                    </>
                  )}
                  {activeMethod === 'UPDATE' && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-200/60 font-mono text-[9px]">UPDATE /{activeApi.path}/:id</span>
                        <span>→ actualiza recurso por ID</span>
                      </div>
                      <p className="text-[9px] text-zinc-400">Envía body con los campos a actualizar + <code className="font-mono text-zinc-500">:id</code> en la ruta</p>
                    </>
                  )}
                  {activeApi.fields.length > 0 && activeMethod !== 'DELETE' && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeApi.fields.map((f) => (
                        <div key={f.name} className="flex items-center gap-1 bg-white border border-zinc-200/60 rounded-md px-2 py-1">
                          <code className="text-[9px] font-mono text-zinc-600">{f.name}</code>
                          {f.value && <span className="text-[8px] text-zinc-400">: <span className="font-mono">{f.value}</span></span>}
                          <span className="text-[7px] font-mono text-zinc-400 bg-zinc-100 px-0.5 rounded">{f.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Response — <span className="text-zinc-600">{activeMethod}</span></h4>
                <div className="bg-zinc-50 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Status</span>
                    <div className="flex gap-1">
                      {[200, 201, 400, 404, 500].map((s) => (
                        <button
                          key={s}
                          onClick={() => setMethodStatusCode(activeApi.id, activeMethod, s)}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-medium transition-all ${
                            effStatusCode(activeApi, activeMethod) === s ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-400 hover:bg-zinc-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={effResponseBody(activeApi, activeMethod)}
                    onChange={(e) => setMethodResponseBody(activeApi.id, activeMethod, e.target.value)}
                    className="w-full bg-white border border-zinc-200/60 rounded-lg p-2.5 font-mono text-[10px] text-zinc-600 outline-none focus:border-zinc-300 transition-all resize-none h-24"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(genCurl(activeApi, activeMethod))
                      }}
                      className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Copiar cURL
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Response Headers — <span className="text-zinc-600">{activeMethod}</span></h4>
                <div className="bg-zinc-50 rounded-xl p-3">
                  <KeyValueEditor
                    pairs={effResponseHeaders(activeApi, activeMethod)}
                    onChange={(pairs) => setMethodResponseHeaders(activeApi.id, activeMethod, pairs)}
                    keyLabel="Header"
                    valueLabel="Value"
                  />
                </div>
              </section>

              <section>
                <h4 className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-2.5">Latencia</h4>
                <div className="bg-zinc-50 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={5000}
                      step={100}
                      value={activeApi.delayMs}
                      onChange={(e) => setDelayMs(activeApi.id, Number(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-200 accent-zinc-900"
                    />
                    <span className="text-xs font-mono text-zinc-600 w-16 text-right">
                      {activeApi.delayMs}ms
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-400 mt-1.5">
                    Simula latencia de red antes de responder
                  </p>
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
              <div>
                <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Métodos</label>
                <div className="flex gap-1">
                  {methods.map((m) => {
                    const selected = formMethods.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          setFormMethods((prev) =>
                            prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                          )
                          setFormErrors((e) => ({ ...e, methods: '' }))
                        }}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                          selected ? 'text-white' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
                        }`}
                        style={selected ? { backgroundColor: methodColors[m].dot } : undefined}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
                {formErrors.methods && <p className="text-[10px] text-red-500 mt-1">{formErrors.methods}</p>}
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
              <div>
                <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Campos</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formTempFields.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-zinc-100 rounded-md px-2 py-1">
                      <span className="text-[10px] font-mono text-zinc-700">{f.name}</span>
                      {f.value && <span className="text-[9px] text-zinc-500">: <span className="font-mono">{f.value}</span></span>}
                      <span className="text-[8px] font-mono text-zinc-400 bg-zinc-200/60 px-1 rounded">{f.type}</span>
                      <button
                        onClick={() => handleRemoveField(i)}
                        className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={formNewFieldName}
                    onChange={(e) => setFormNewFieldName(e.target.value)}
                    placeholder="nombre"
                    className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }}
                  />
                  <select
                    value={formNewFieldType}
                    onChange={(e) => {
                      setFormNewFieldType(e.target.value)
                      if (e.target.value === 'bool') setFormNewFieldValue('true')
                      if (e.target.value === 'int') setFormNewFieldValue(formNewFieldValue.replace(/\D/g, ''))
                    }}
                    className="bg-zinc-50 border border-zinc-200/60 rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-600 outline-none focus:border-zinc-300 transition-all"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    value={formNewFieldValue}
                    onChange={(e) => {
                      let v = e.target.value
                      if (formNewFieldType === 'int') v = v.replace(/\D/g, '')
                      setFormNewFieldValue(v)
                    }}
                    placeholder={formNewFieldType === 'int' ? '0' : formNewFieldType === 'bool' ? 'true' : 'valor'}
                    className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }}
                  />
                  <button
                    onClick={handleAddField}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
              </div>
              {formErrors.fields && <p className="text-[10px] text-red-500 mt-1">{formErrors.fields}</p>}
            </div>

            {formTempFields.length > 0 && (
              <div>
                <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Datos de ejemplo</label>
                <div className="space-y-1.5">
                  {formSampleData.map((row, ri) => (
                    <div key={ri} className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-2 py-1.5">
                      {formTempFields.map((f) => (
                        <input
                          key={f.name}
                          value={row[f.name] ?? ''}
                          onChange={(e) => updateSampleRow(ri, f.name, e.target.value)}
                          placeholder={f.name}
                          className="flex-1 min-w-0 bg-white border border-zinc-200/60 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300"
                        />
                      ))}
                      <button
                        onClick={() => removeSampleRow(ri)}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addSampleRow}
                    className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Añadir registro
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setAiDescription(aiDescription ? '' : ' ')}
                className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Generar con IA
              </button>

              {aiDescription !== '' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={aiDescription === ' ' ? '' : aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder="Describí qué API querés, ej: API de usuarios con nombre, email y edad"
                    rows={3}
                    className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-2 text-[11px] text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300 resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAiGenerate}
                      disabled={aiLoading}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                      {aiLoading && (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {aiLoading ? 'Generando...' : 'Generar'}
                    </button>
                  </div>
                </div>
              )}
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

      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={() => setInspectLog(null)}>
          <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[480px] max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-800">Última petición</h3>
              <button onClick={() => setInspectLog(null)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Método</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: methodColors[inspectLog.method]?.badge ?? '#f4f4f5', color: methodColors[inspectLog.method]?.text ?? '#18181b' }}>{inspectLog.method}</span>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Path</span>
                <code className="text-xs font-mono text-zinc-600 bg-zinc-50 rounded-lg px-2 py-1 block truncate">/{inspectLog.path}</code>
              </div>
              {inspectLog.body && (
                <div>
                  <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Body</span>
                  <pre className="text-[10px] font-mono text-zinc-600 bg-zinc-50 rounded-lg p-2.5 whitespace-pre-wrap max-h-40 overflow-y-auto">{inspectLog.body}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
