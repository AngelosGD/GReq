import { useState } from 'react'
import { KeyValueEditor } from '../KeyValueEditor'
import { MockApiItem, methodColors } from './types'
import { generateRows } from '../../lib/generateSampleData'

interface Props {
  api: MockApiItem
  activeMethod: string
  editing: boolean
  editName: string
  editPath: string
  editPort: string
  editMethods: string[]
  methods: readonly string[]
  inspectLoading: boolean
  onSetActiveMethod: (m: string) => void
  onSetEditName: (v: string) => void
  onSetEditPath: (v: string) => void
  onSetEditPort: (v: string) => void
  onSetEditMethods: (v: string[]) => void
  onSaveEditing: () => void
  onCancelEditing: () => void
  onStartEditing: () => void
  onStartApi: () => void
  onStopApi: () => void
  onFetchInspect: () => void
  onFetchHistory: () => void
  onDuplicateApi: () => void
  onTestInCanvas?: (api: MockApiItem) => void
  onExportApi: () => void
  onConfirmDelete: () => void
  onSetDelayMs: (ms: number) => void
  onSetMethodStatusCode: (method: string, code: number) => void
  onSetMethodResponseBody: (method: string, body: string) => void
  onSetMethodResponseHeaders: (method: string, headers: { key: string; value: string }[]) => void
  onSetSampleData: (data: Record<string, string>[]) => void
}

export function MockApiEditor({
  api, activeMethod, editing, editName, editPath, editPort, editMethods, methods,
  inspectLoading,
  onSetActiveMethod, onSetEditName, onSetEditPath, onSetEditPort, onSetEditMethods,
  onSaveEditing, onCancelEditing, onStartEditing,
  onStartApi, onStopApi, onFetchInspect, onFetchHistory, onTestInCanvas,
  onDuplicateApi, onExportApi, onConfirmDelete,
  onSetDelayMs, onSetMethodStatusCode, onSetMethodResponseBody, onSetMethodResponseHeaders,
  onSetSampleData,
}: Props) {
  const [genCount, setGenCount] = useState(5)
  const effStatusCode = (m: string) => api.methodBodies?.[m]?.statusCode ?? api.statusCode
  const effResponseBody = (m: string) => api.methodBodies?.[m]?.responseBody ?? api.responseBody
  const effResponseHeaders = (m: string) => api.methodBodies?.[m]?.responseHeaders ?? api.responseHeaders ?? []

  const genCurl = (a: MockApiItem, method: string) => {
    const body = effResponseBody(method)
    const pairs: string[] = [`curl -X ${method} "http://localhost:${a.port}/${a.path}"`]
    for (const h of effResponseHeaders(method)) {
      if (h.key) pairs.push(`  -H "${h.key}: ${h.value}"`)
    }
    if (body && (method === 'POST' || method === 'UPDATE')) pairs.push(`  -d '${body.replace(/'/g, "\\'")}'`)
    return pairs.join(' \\\n')
  }

  const inputClass = "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="px-6 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input value={editName} onChange={(e) => onSetEditName(e.target.value)} className={inputClass + " text-sm font-semibold w-full"} />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[8px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Puerto</label>
                    <input value={editPort} onChange={(e) => onSetEditPort(e.target.value)} className={inputClass + " w-full"} />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[8px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Ruta</label>
                    <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-zinc-300 dark:text-zinc-500 font-mono">/</span>
                      <input value={editPath} onChange={(e) => onSetEditPath(e.target.value)} className="flex-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 outline-none bg-transparent" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">Métodos</label>
                  <div className="flex gap-1">
                    {methods.map((m) => {
                      const selected = editMethods.includes(m)
                      return (
                        <button key={m} onClick={() => onSetEditMethods(editMethods.includes(m) ? editMethods.filter((x) => x !== m) : [...editMethods, m])}
                          className={`flex-1 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all duration-150 ${selected ? 'text-white' : 'bg-zinc-50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700/30'}`}
                          style={selected ? { backgroundColor: methodColors[m].dot } : undefined}>{m}</button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{api.name}</h3>
                  <button onClick={() => onDuplicateApi()} className="shrink-0 w-5 h-5 flex items-center justify-center">
                    <svg className={`w-3.5 h-3.5 ${api.pinned ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-400'}`} viewBox="0 0 24 24" fill={api.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                  <span className={`text-[10px] font-medium ${api.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>{api.running ? 'Activo' : 'Detenido'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <code className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">http://localhost:{api.port}/{api.path}</code>
                  <button onClick={() => navigator.clipboard.writeText(`http://localhost:${api.port}/${api.path}`)} className="p-0.5 rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-300 transition-colors shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
                {api.methods.length > 1 && (
                  <div className="flex gap-0 mt-3">
                    {api.methods.map((m) => {
                      const c = methodColors[m]
                      return (
                        <button key={m} onClick={() => onSetActiveMethod(m)}
                          className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all duration-150 ${activeMethod === m ? 'border-b-2' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 border-b-2 border-transparent'}`}
                          style={activeMethod === m ? { borderBottomColor: c?.dot, color: c?.dot } : undefined}>{m}</button>
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
                <button onClick={onSaveEditing} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150">Guardar</button>
                <button onClick={onCancelEditing} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150">Cancelar</button>
              </>
            ) : (
              <>
                {api.running ? (
                  <button onClick={onStopApi} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 16.5v-9z" /></svg>
                    Detener
                  </button>
                ) : (
                  <button onClick={onStartApi} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                    Iniciar
                  </button>
                )}
                {!api.running && (
                  <button onClick={onStartEditing} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    Editar
                  </button>
                )}
                {api.running && (
                  <button onClick={onFetchInspect} disabled={inspectLoading} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/30 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                    {inspectLoading ? '...' : 'Inspeccionar'}
                  </button>
                )}
                {api.running && (
                  <button onClick={onFetchHistory} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/30 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Historial
                  </button>
                )}
                {api.running && onTestInCanvas && (
                  <button onClick={() => onTestInCanvas(api)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Probar
                  </button>
                )}
                <button onClick={onDuplicateApi} className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150" title="Duplicar">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                </button>
                <button onClick={onExportApi} className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150" title="Exportar">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                </button>
                <button onClick={onConfirmDelete} className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-5">
        <section>
          <h4 className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Endpoint</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-zinc-400 dark:text-zinc-500 block mb-1">Puerto</label><div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300">{api.port}</div></div>
            <div><label className="text-[10px] text-zinc-400 dark:text-zinc-500 block mb-1">Ruta</label><div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300">/{api.path}</div></div>
          </div>
        </section>

        <section>
          <h4 className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Comportamiento — <span className="text-zinc-600 dark:text-zinc-300">{activeMethod}</span></h4>
          <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 space-y-2">
            {activeMethod === 'GET' && (
              <><div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[9px]">GET /{api.path}</span><span>→ array con 3 elementos</span></div><div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[9px]">GET /{api.path}/:id</span><span>→ un elemento por ID</span></div></>
            )}
            {activeMethod === 'POST' && (
              <><div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[9px]">POST /{api.path}</span><span>→ crea recurso, genera ID auto</span></div><p className="text-[9px] text-zinc-400 dark:text-zinc-500">Envía body con los campos, se mezcla con los valores por defecto</p></>
            )}
            {activeMethod === 'DELETE' && (
              <><div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[9px]">DELETE /{api.path}/:id</span><span>→ elimina recurso por ID</span></div><div className="flex items-center gap-1.5 mt-1"><code className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">:id</code><span className="text-[9px] text-zinc-400 dark:text-zinc-500">— path param obligatorio (último segmento de la ruta)</span></div></>
            )}
            {activeMethod === 'UPDATE' && (
              <><div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400"><span className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[9px]">UPDATE /{api.path}/:id</span><span>→ actualiza recurso por ID</span></div><p className="text-[9px] text-zinc-400 dark:text-zinc-500">Envía body con los campos a actualizar + <code className="font-mono text-zinc-500 dark:text-zinc-400">:id</code> en la ruta</p></>
            )}
            {api.fields.length > 0 && activeMethod !== 'DELETE' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {api.fields.map((f) => (
                  <div key={f.name} className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md px-2 py-1">
                    <code className="text-[9px] font-mono text-zinc-600 dark:text-zinc-300">{f.name}</code>
                    {f.value && <span className="text-[9px] text-zinc-500 dark:text-zinc-400">: <span className="font-mono">{f.value}</span></span>}
                    {f.maxLength != null && <span className="text-[7px] font-mono text-zinc-300 dark:text-zinc-600">≤{f.maxLength}</span>}
                    <span className="text-[7px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-0.5 rounded">{f.type}</span>
                  </div>
                ))}
              </div>
            )}
            {api.fields.length > 0 && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/50 mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Generar registros aleatorios:</span>
                  <input type="number" min={1} max={20} value={genCount} onChange={(e) => setGenCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-12 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 outline-none text-center" />
                  <span className="text-[9px] text-zinc-400">registros (máx 20)</span>
                  <button onClick={() => onSetSampleData(generateRows(api.fields, genCount))} className="px-2 py-1 rounded-md text-[9px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all">Generar</button>
                </div>
                {api.sampleData.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors">
                      <svg className="w-2 h-2 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      Editar datos ({api.sampleData.length} registros)
                    </summary>
                    <div className="mt-2 space-y-1">
                      {api.sampleData.map((row, ri) => (
                        <div key={`${ri}-${row[api.fields[0]?.name] ?? ''}`} className="flex items-center gap-1">
                          {api.fields.map((f) => (
                            <input key={f.name} defaultValue={row[f.name] ?? ''} onBlur={(e) => {
                              const newData = api.sampleData.map((r, i) => i === ri ? { ...r, [f.name]: e.target.value } : r)
                              onSetSampleData(newData)
                            }} placeholder={f.name} className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md px-1.5 py-1 text-[9px] font-mono text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-400/70 placeholder-zinc-300 dark:placeholder-zinc-500" />
                          ))}
                          <button onClick={() => onSetSampleData(api.sampleData.filter((_, i) => i !== ri))} className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Response — <span className="text-zinc-600 dark:text-zinc-300">{activeMethod}</span></h4>
          <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Status</span>
              <div className="flex gap-1">
                {[200, 201, 400, 404, 500].map((s) => (
                  <button key={s} onClick={() => onSetMethodStatusCode(activeMethod, s)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-medium transition-all duration-150 ${effStatusCode(activeMethod) === s ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>{s}</button>
                ))}
              </div>
            </div>
            <textarea value={effResponseBody(activeMethod)} onChange={(e) => onSetMethodResponseBody(activeMethod, e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg p-2.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all resize-none h-24" />
            <details className="text-[9px] text-zinc-400">
              <summary className="cursor-pointer hover:text-zinc-600">Templates dinámicos</summary>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {['{{$randomName}}','{{$randomEmail}}','{{$randomInt}}','{{$uuid}}','{{$timestamp}}','{{$randomBoolean}}','{{$randomWord}}','{{$randomNumber(1,100)}}'].map((t) => (
                  <button key={t} onClick={() => {
                    const ta = document.querySelector('textarea.font-mono') as HTMLTextAreaElement
                    if (ta) { ta.value += t; ta.dispatchEvent(new Event('input', { bubbles: true })) }
                  }} className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-mono transition-colors">{t}</button>
                ))}
              </div>
            </details>
            <div className="flex justify-end">
              <button onClick={() => navigator.clipboard.writeText(genCurl(api, activeMethod))}
                className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                Copiar cURL
              </button>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Response Headers — <span className="text-zinc-600 dark:text-zinc-300">{activeMethod}</span></h4>
          <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3">
            <KeyValueEditor pairs={effResponseHeaders(activeMethod)} onChange={(pairs) => onSetMethodResponseHeaders(activeMethod, pairs)} keyLabel="Header" valueLabel="Value" />
          </div>
        </section>

        <section>
          <h4 className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Latencia</h4>
          <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={5000} step={100} value={api.delayMs} onChange={(e) => onSetDelayMs(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-200 dark:bg-zinc-700 accent-zinc-900 dark:accent-zinc-100" />
              <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 w-16 text-right">{api.delayMs}ms</span>
            </div>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1.5">Simula latencia de red antes de responder</p>
          </div>
        </section>
      </div>
    </div>
  )
}
