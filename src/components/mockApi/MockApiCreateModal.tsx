import { useState, useMemo } from 'react'
import { FieldDef, methods, methodColors, FIELD_TYPES } from './types'
import { generateMockApi } from '../../lib/ai'
import { generateRows } from '../../lib/generateSampleData'
import { parseCurl } from '../../lib/parseCurl'

interface Props {
  onClose: () => void
  onCreate: (name: string, methods: string[], path: string, port: string, fields: FieldDef[], sampleData: Record<string, string>[]) => boolean
}

const inputClass = "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all"
const labelClass = "text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] block mb-1.5"

export function MockApiCreateModal({ onClose, onCreate }: Props) {
  const [formName, setFormName] = useState('')
  const [formMethods, setFormMethods] = useState<string[]>(['GET'])
  const [formTempFields, setFormTempFields] = useState<FieldDef[]>([])
  const [formNewFieldName, setFormNewFieldName] = useState('')
  const [formNewFieldType, setFormNewFieldType] = useState<string>('string')
  const [formNewFieldValue, setFormNewFieldValue] = useState('')
  const [formNewFieldMaxLen, setFormNewFieldMaxLen] = useState('')
  const [formSampleData, setFormSampleData] = useState<Record<string, string>[]>([])
  const [formPath, setFormPath] = useState('')
  const [formPort, setFormPort] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [curlInput, setCurlInput] = useState('')
  const [showCurlImport, setShowCurlImport] = useState(false)

  const resetFormFieldTypes = (fields: { name: string; type: string }[]) => {
    if (fields.length > 0) setFormNewFieldType(fields[fields.length - 1].type)
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
      if (result.sampleData) {
        setFormSampleData(result.sampleData.map((r) => {
          const row: Record<string, string> = {}
          for (const f of result.fields) {
            const v = r[f.name]
            row[f.name] = v == null ? '' : String(v)
          }
          return row
        }))
      }
      setFormErrors({})
    } catch (e) {
      alert(`Error al generar con IA: ${e}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddField = () => {
    if (!formNewFieldName.trim()) return
    const newField: FieldDef = { name: formNewFieldName.trim(), type: formNewFieldType, value: formNewFieldValue || undefined, maxLength: formNewFieldMaxLen ? Number(formNewFieldMaxLen) : undefined }
    const nextFields = [...formTempFields, newField]
    setFormTempFields(nextFields)
    setFormSampleData((curr) => curr.length === 0 ? [{ ...Object.fromEntries(nextFields.map((f) => [f.name, f.value ?? ''])) }] : curr)
    setFormNewFieldName('')
    setFormNewFieldValue('')
    setFormNewFieldMaxLen('')
    setFormErrors((e) => ({ ...e, fields: '' }))
  }

  const handleBulkFields = (text: string) => {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean)
    const parsed: FieldDef[] = []
    for (const part of parts) {
      const [rawName, rawType] = part.split(':').map((s) => s.trim())
      if (!rawName) continue
      const type = FIELD_TYPES.includes(rawType as any) ? rawType : 'string'
      parsed.push({ name: rawName, type })
    }
    const nextFields = [...formTempFields, ...parsed]
    setFormTempFields(nextFields)
    setFormSampleData((curr) => curr.length === 0 ? [{ ...Object.fromEntries(nextFields.map((f) => [f.name, f.value ?? ''])) }] : curr)
  }

  const handleApplyTemplate = (template: { name: string; path: string; methods: string[]; fields: FieldDef[] }) => {
    setFormName(template.name)
    setFormPath(template.path)
    setFormMethods(template.methods)
    setFormTempFields(template.fields)
    setFormSampleData((curr) => curr.length === 0 ? [{ ...Object.fromEntries(template.fields.map((f) => [f.name, f.value ?? ''])) }] : curr)
    setFormErrors({})
  }

  const handleImportCurl = () => {
    const parsed = parseCurl(curlInput)
    if (!parsed) { alert('No se pudo interpretar el comando curl'); return }
    setFormName(`API desde cURL`)
    setFormPath(parsed.url)
    setFormMethods([parsed.method])
    if (parsed.body) {
      try {
        const bodyObj = JSON.parse(parsed.body)
        const fields: FieldDef[] = Object.keys(bodyObj).map((k) => ({ name: k, type: typeof bodyObj[k] === 'number' ? 'int' : 'string' }))
        setFormTempFields(fields)
        setFormSampleData((curr) => curr.length === 0 ? [{ ...Object.fromEntries(fields.map((f) => [f.name, f.value ?? ''])) }] : curr)
      } catch { setFormTempFields([]) }
    }
    setShowCurlImport(false)
    setCurlInput('')
    setFormErrors({})
  }

  const handleRemoveField = (idx: number) => setFormTempFields((p) => p.filter((_, i) => i !== idx))

  const addSampleRow = () => {
    const row: Record<string, string> = {}
    for (const f of formTempFields) row[f.name] = f.value ?? ''
    setFormSampleData((p) => [...p, row])
  }

  const removeSampleRow = (idx: number) => setFormSampleData((p) => p.filter((_, i) => i !== idx))

  const updateSampleRow = (idx: number, field: string, value: string) =>
    setFormSampleData((p) => p.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))

  const responsePreview = useMemo(() => {
    if (formTempFields.length === 0) return JSON.stringify({ message: 'Agregá campos para ver la respuesta' }, null, 2)
    if (formSampleData.length > 0) {
      return JSON.stringify(formSampleData.map((row, i) => ({
        id: i + 1,
        ...Object.fromEntries(formTempFields.map((f) => {
          let v: any = row[f.name] ?? ''
          if (f.type === 'int') v = Number(row[f.name]) || 0
          else if (f.type === 'float') v = Number(row[f.name]) || 0
          else if (f.type === 'bool') v = row[f.name] === 'true' || row[f.name] === '1'
          return [f.name, v]
        }))
      })), null, 2)
    }
    return JSON.stringify({
      id: 1,
      ...Object.fromEntries(formTempFields.map((f) => {
        let v: any = ''
        if (f.type === 'int') v = 0
        else if (f.type === 'float') v = 0
        else if (f.type === 'bool') v = false
        else v = f.value || `${f.name}_ejemplo`
        return [f.name, v]
      }))
    }, null, 2)
  }, [formTempFields, formSampleData])

  const validateRequired = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = 'El nombre es obligatorio'
    if (formMethods.length === 0) errs.methods = 'Selecciona al menos un método'
    if (!formPath.trim()) errs.path = 'La ruta es obligatoria'
    if (!formPort.trim()) errs.port = 'El puerto es obligatorio'
    else if (isNaN(Number(formPort)) || Number(formPort) < 1 || Number(formPort) > 65535) errs.port = 'Puerto inválido (1-65535)'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = () => {
    if (!validateRequired()) return
    const ok = onCreate(formName, formMethods, formPath, formPort, formTempFields, formSampleData)
    if (ok) setFormErrors({})
  }

  const handleCreateNoSample = () => {
    if (!validateRequired()) return
    const ok = onCreate(formName, formMethods, formPath, formPort, formTempFields, [])
    if (ok) setFormErrors({})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-tinted-lg border border-zinc-200/70 dark:border-zinc-700/70 w-[480px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nueva API de prueba</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Nombre</label>
            <input value={formName} onChange={(e) => { setFormName(e.target.value); setFormErrors((e) => ({ ...e, name: '' })) }} placeholder="Ej: Users API" className={inputClass + " w-full placeholder-zinc-300 dark:placeholder-zinc-500"} />
            {formErrors.name && <p className="text-[10px] text-red-500 mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className={labelClass}>Métodos</label>
            <div className="flex gap-1">
              {methods.map((m) => {
                const selected = formMethods.includes(m)
                return (
                  <button key={m} onClick={() => { setFormMethods((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]); setFormErrors((e) => ({ ...e, methods: '' })) }}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-150 ${selected ? 'text-white' : 'bg-zinc-50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700/30'}`}
                    style={selected ? { backgroundColor: methodColors[m].dot } : undefined}>{m}</button>
                )
              })}
            </div>
            {formErrors.methods && <p className="text-[10px] text-red-500 mt-1">{formErrors.methods}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Puerto</label>
              <input value={formPort} onChange={(e) => { setFormPort(e.target.value); setFormErrors((e) => ({ ...e, port: '' })) }} placeholder="34512" className={inputClass + " w-full placeholder-zinc-300 dark:placeholder-zinc-500 font-mono"} />
              {formErrors.port && <p className="text-[10px] text-red-500 mt-1">{formErrors.port}</p>}
            </div>
            <div>
              <label className={labelClass}>Ruta</label>
              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-1.5">
                <span className="text-xs text-zinc-300 dark:text-zinc-500 font-mono">/</span>
                <input value={formPath} onChange={(e) => { setFormPath(e.target.value); setFormErrors((e) => ({ ...e, path: '' })) }} placeholder="api/users" className="flex-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 outline-none bg-transparent placeholder-zinc-300 dark:placeholder-zinc-500" />
              </div>
              {formErrors.path && <p className="text-[10px] text-red-500 mt-1">{formErrors.path}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Campos</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formTempFields.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md px-2 py-1">
                  <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">{f.name}</span>
                  {f.value && <span className="text-[9px] text-zinc-500 dark:text-zinc-400">: <span className="font-mono">{f.value}</span></span>}
                  <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-200/60 dark:bg-zinc-700 px-1 rounded">{f.type}</span>
                  {f.maxLength != null && <span className="text-[7px] font-mono text-zinc-300 dark:text-zinc-600">≤{f.maxLength}</span>}
                  <button onClick={() => handleRemoveField(i)} className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input value={formNewFieldName} onChange={(e) => setFormNewFieldName(e.target.value)} placeholder="nombre" className={inputClass + " flex-1 min-w-0 placeholder-zinc-300 dark:placeholder-zinc-500"} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              <select value={formNewFieldType} onChange={(e) => { setFormNewFieldType(e.target.value); setFormNewFieldValue(''); if (e.target.value === 'bool') setFormNewFieldValue('true') }} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-1.5 py-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all w-14 shrink-0">
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={formNewFieldValue} onChange={(e) => { let v = e.target.value; if (formNewFieldType === 'int') v = v.replace(/\D/g, ''); if (formNewFieldType === 'float') v = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); if (formNewFieldType === 'string' && formNewFieldMaxLen) v = v.slice(0, Number(formNewFieldMaxLen)); setFormNewFieldValue(v) }} placeholder={formNewFieldType === 'int' ? '0' : formNewFieldType === 'float' ? '0.0' : formNewFieldType === 'bool' ? 'true' : 'val'} className={inputClass + " w-20 shrink-0 placeholder-zinc-300 dark:placeholder-zinc-500"} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              {formNewFieldType === 'string' && (
                <input value={formNewFieldMaxLen} onChange={(e) => setFormNewFieldMaxLen(e.target.value.replace(/\D/g, ''))} placeholder="max" title="Longitud máxima" className={inputClass + " w-12 shrink-0 placeholder-zinc-300 dark:placeholder-zinc-500 text-center"} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              )}
              <button onClick={handleAddField} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
            {formErrors.fields && <p className="text-[10px] text-red-500 mt-1">{formErrors.fields}</p>}

            <details className="group mt-2">
              <summary className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors">
                <svg className="w-2 h-2 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                Añadir en lote
              </summary>
              <div className="mt-1.5 flex gap-1">
                <textarea rows={1} placeholder="nombre:string, precio:int, descripcion:string" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBulkFields((e.target as HTMLTextAreaElement).value); (e.target as HTMLTextAreaElement).value = '' } }} className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-400/70 placeholder-zinc-300 dark:placeholder-zinc-500 resize-none" />
                <button onClick={(e) => { const ta = e.currentTarget.previousElementSibling as HTMLTextAreaElement; handleBulkFields(ta.value); ta.value = '' }} className="shrink-0 px-2 py-1 rounded-md text-[9px] font-medium bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Añadir</button>
              </div>
            </details>

            <div className="flex flex-wrap gap-1 mt-2">
              {[
                { label: 'Usuarios', name: 'API Usuarios', path: 'api/usuarios', methods: ['GET','POST','DELETE'], fields: [{name:'nombre',type:'string'},{name:'email',type:'string'},{name:'edad',type:'int'}] },
                { label: 'Productos', name: 'API Productos', path: 'api/productos', methods: ['GET','POST','DELETE'], fields: [{name:'nombre',type:'string'},{name:'precio',type:'int'},{name:'stock',type:'int'},{name:'descripcion',type:'string'}] },
                { label: 'Tareas', name: 'API Tareas', path: 'api/tareas', methods: ['GET','POST','DELETE'], fields: [{name:'titulo',type:'string'},{name:'completada',type:'bool'}] },
              ].map((t) => (
                <button key={t.label} onClick={() => handleApplyTemplate(t)} className="px-2 py-1 rounded-md text-[9px] font-medium bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/30 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors border border-zinc-200/40 dark:border-zinc-700/40">{t.label}</button>
              ))}
            </div>
          </div>

          {formTempFields.length > 0 && (
            <div>
              <label className={labelClass}>Datos de ejemplo</label>
              <div className="space-y-1.5">
                {formSampleData.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-2 py-1.5">
                    {formTempFields.map((f) => (
                      <input key={f.name} value={row[f.name] ?? ''} onChange={(e) => { let v = e.target.value; if (f.maxLength && f.type === 'string') v = v.slice(0, f.maxLength); updateSampleRow(ri, f.name, v) }} placeholder={f.name} className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder-zinc-300 dark:placeholder-zinc-500" />
                    ))}
                    <button onClick={() => removeSampleRow(ri)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={addSampleRow} className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Añadir registro
                  </button>
                  <button onClick={() => setFormSampleData(generateRows(formTempFields, 5))} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                    Generar 5 filas
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <details className="group">
              <summary className="flex items-center gap-1.5 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                <svg className="w-2.5 h-2.5 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                Vista previa respuesta
              </summary>
              <div className="mt-2">
                <pre className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg p-3 text-[9px] font-mono text-zinc-600 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">{responsePreview}</pre>
              </div>
            </details>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setAiDescription(aiDescription ? '' : ' ')} className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Generar con IA
              </button>
              <button type="button" onClick={() => setShowCurlImport(!showCurlImport)} className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Importar cURL
              </button>
            </div>
            {showCurlImport && (
              <div className="mt-3 space-y-2 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                <textarea value={curlInput} onChange={(e) => setCurlInput(e.target.value)} placeholder='curl -X POST https://api.ejemplo.com/users -H "Content-Type: application/json" -d \{\"name\":\"Juan\"\}' rows={3} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder-zinc-300 dark:placeholder-zinc-500 resize-none" />
                <div className="flex justify-end">
                  <button onClick={handleImportCurl} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all">Importar</button>
                </div>
              </div>
            )}
            {aiDescription !== '' && (
              <div className="mt-3 space-y-2">
                <textarea value={aiDescription === ' ' ? '' : aiDescription} onChange={(e) => setAiDescription(e.target.value)} placeholder="Describí qué API querés, ej: API de usuarios con nombre, email y edad" rows={3} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-2 text-[11px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder-zinc-300 dark:placeholder-zinc-500 resize-none" />
                <div className="flex justify-end">
                  <button onClick={handleAiGenerate} disabled={aiLoading} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5">
                    {aiLoading && <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {aiLoading ? 'Generando...' : 'Generar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150">Cancelar</button>
          <button onClick={handleCreateNoSample} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150">Crear sin registros</button>
          <button onClick={handleCreate} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150">Crear API</button>
        </div>
      </div>
    </div>
  )
}
