import { useState, useEffect } from 'react'
import { FieldDef, methods, methodColors, FIELD_TYPES } from './types'
import { generateMockApi } from '../../lib/ai'

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

  useEffect(() => {
    if (formTempFields.length > 0 && formSampleData.length === 0) {
      const row: Record<string, string> = {}
      for (const f of formTempFields) row[f.name] = f.value ?? ''
      setFormSampleData([row])
    }
  }, [formTempFields])

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
      setFormErrors({})
    } catch (e) {
      alert(`Error al generar con IA: ${e}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddField = () => {
    if (!formNewFieldName.trim()) return
    setFormTempFields((p) => [...p, { name: formNewFieldName.trim(), type: formNewFieldType, value: formNewFieldValue || undefined, maxLength: formNewFieldMaxLen ? Number(formNewFieldMaxLen) : undefined }])
    setFormNewFieldName('')
    setFormNewFieldValue('')
    setFormNewFieldMaxLen('')
    setFormErrors((e) => ({ ...e, fields: '' }))
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

  const handleCreate = () => {
    const ok = onCreate(formName, formMethods, formPath, formPort, formTempFields, formSampleData)
    if (ok) {
      setFormErrors({})
    }
  }

  const handleCreateNoSample = () => {
    const ok = onCreate(formName, formMethods, formPath, formPort, formTempFields, [])
    if (ok) {
      setFormErrors({})
    }
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
              <input value={formNewFieldValue} onChange={(e) => { let v = e.target.value; if (formNewFieldType === 'int') v = v.replace(/\D/g, ''); if (formNewFieldType === 'float') v = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); setFormNewFieldValue(v) }} placeholder={formNewFieldType === 'int' ? '0' : formNewFieldType === 'float' ? '0.0' : formNewFieldType === 'bool' ? 'true' : 'val'} className={inputClass + " w-20 shrink-0 placeholder-zinc-300 dark:placeholder-zinc-500"} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              {formNewFieldType === 'string' && (
                <input value={formNewFieldMaxLen} onChange={(e) => setFormNewFieldMaxLen(e.target.value.replace(/\D/g, ''))} placeholder="max" title="Longitud máxima" className={inputClass + " w-12 shrink-0 placeholder-zinc-300 dark:placeholder-zinc-500 text-center"} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              )}
              <button onClick={handleAddField} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all duration-150">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
            {formErrors.fields && <p className="text-[10px] text-red-500 mt-1">{formErrors.fields}</p>}
          </div>

          {formTempFields.length > 0 && (
            <div>
              <label className={labelClass}>Datos de ejemplo</label>
              <div className="space-y-1.5">
                {formSampleData.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-2 py-1.5">
                    {formTempFields.map((f) => (
                      <input key={f.name} value={row[f.name] ?? ''} onChange={(e) => updateSampleRow(ri, f.name, e.target.value)} placeholder={f.name} className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder-zinc-300 dark:placeholder-zinc-500" />
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
                  <button onClick={() => {
                    const rows: Record<string, string>[] = []
                    const firstNames = ['Alice','Bob','Charlie','Diana','Eve','Frank','Grace','Hank']
                    const lastNames = ['Smith','Jones','Garcia','Lee','Kim','Brown','Chen','Patel']
                    const domains = ['gmail.com','outlook.com','corp.io','demo.org']
                    for (let i = 0; i < 5; i++) {
                      const row: Record<string, string> = {}
                      for (const f of formTempFields) {
                        if (f.type === 'int') row[f.name] = String(Math.floor(Math.random() * 1000) + 1)
                        else if (f.type === 'float') row[f.name] = (Math.random() * 10000).toFixed(2)
                        else if (f.type === 'bool') row[f.name] = Math.random() > 0.5 ? 'true' : 'false'
                        else if (f.name.toLowerCase().includes('email')) row[f.name] = `${firstNames[i % firstNames.length].toLowerCase()}@${domains[i % domains.length]}`
                        else if (f.name.toLowerCase().includes('name') || f.name.toLowerCase().includes('nombre')) row[f.name] = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`
                        else {
                          const val = `${f.name}_${i + 1}`
                          row[f.name] = f.maxLength ? val.slice(0, f.maxLength) : val
                        }
                      }
                      rows.push(row)
                    }
                    setFormSampleData(rows)
                  }} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                    Generar 5 filas
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <button type="button" onClick={() => setAiDescription(aiDescription ? '' : ' ')} className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              Generar con IA
            </button>
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
