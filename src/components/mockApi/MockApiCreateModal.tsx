import { useState, useEffect } from 'react'
import { FieldDef, methods, methodColors, FIELD_TYPES } from './types'
import { generateMockApi } from '../../lib/ai'

interface Props {
  onClose: () => void
  onCreate: (name: string, methods: string[], path: string, port: string, fields: FieldDef[], sampleData: Record<string, string>[]) => boolean
}

export function MockApiCreateModal({ onClose, onCreate }: Props) {
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
    setFormTempFields((p) => [...p, { name: formNewFieldName.trim(), type: formNewFieldType, value: formNewFieldValue || undefined }])
    setFormNewFieldName('')
    setFormNewFieldValue('')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl shadow-black/8 w-[480px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Nueva API de prueba</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Nombre</label>
            <input value={formName} onChange={(e) => { setFormName(e.target.value); setFormErrors((e) => ({ ...e, name: '' })) }} placeholder="Ej: Users API" className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300" />
            {formErrors.name && <p className="text-[10px] text-red-500 mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Métodos</label>
            <div className="flex gap-1">
              {methods.map((m) => {
                const selected = formMethods.includes(m)
                return (
                  <button key={m} onClick={() => { setFormMethods((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]); setFormErrors((e) => ({ ...e, methods: '' })) }}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${selected ? 'text-white' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                    style={selected ? { backgroundColor: methodColors[m].dot } : undefined}>{m}</button>
                )
              })}
            </div>
            {formErrors.methods && <p className="text-[10px] text-red-500 mt-1">{formErrors.methods}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Puerto</label>
              <input value={formPort} onChange={(e) => { setFormPort(e.target.value); setFormErrors((e) => ({ ...e, port: '' })) }} placeholder="34512" className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300" />
              {formErrors.port && <p className="text-[10px] text-red-500 mt-1">{formErrors.port}</p>}
            </div>
            <div>
              <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-[0.12em] block mb-1.5">Ruta</label>
              <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-1.5">
                <span className="text-xs text-zinc-300 font-mono">/</span>
                <input value={formPath} onChange={(e) => { setFormPath(e.target.value); setFormErrors((e) => ({ ...e, path: '' })) }} placeholder="api/users" className="flex-1 text-xs font-mono text-zinc-700 outline-none bg-transparent placeholder-zinc-300" />
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
                  <button onClick={() => handleRemoveField(i)} className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={formNewFieldName} onChange={(e) => setFormNewFieldName(e.target.value)} placeholder="nombre" className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              <select value={formNewFieldType} onChange={(e) => { setFormNewFieldType(e.target.value); if (e.target.value === 'bool') setFormNewFieldValue('true'); if (e.target.value === 'int') setFormNewFieldValue(formNewFieldValue.replace(/\D/g, '')) }} className="bg-zinc-50 border border-zinc-200/60 rounded-lg px-2 py-1.5 text-[10px] font-mono text-zinc-600 outline-none focus:border-zinc-300 transition-all">
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={formNewFieldValue} onChange={(e) => { let v = e.target.value; if (formNewFieldType === 'int') v = v.replace(/\D/g, ''); setFormNewFieldValue(v) }} placeholder={formNewFieldType === 'int' ? '0' : formNewFieldType === 'bool' ? 'true' : 'valor'} className="flex-1 bg-zinc-50 border border-zinc-200/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField() } }} />
              <button onClick={handleAddField} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
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
                      <input key={f.name} value={row[f.name] ?? ''} onChange={(e) => updateSampleRow(ri, f.name, e.target.value)} placeholder={f.name} className="flex-1 min-w-0 bg-white border border-zinc-200/60 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300" />
                    ))}
                    <button onClick={() => removeSampleRow(ri)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                <button onClick={addSampleRow} className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Añadir registro
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-100 pt-4">
            <button type="button" onClick={() => setAiDescription(aiDescription ? '' : ' ')} className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              Generar con IA
            </button>
            {aiDescription !== '' && (
              <div className="mt-3 space-y-2">
                <textarea value={aiDescription === ' ' ? '' : aiDescription} onChange={(e) => setAiDescription(e.target.value)} placeholder="Describí qué API querés, ej: API de usuarios con nombre, email y edad" rows={3} className="w-full bg-zinc-50 border border-zinc-200/60 rounded-lg px-3 py-2 text-[11px] text-zinc-700 outline-none focus:border-zinc-300 transition-all placeholder-zinc-300 resize-none" />
                <div className="flex justify-end">
                  <button onClick={handleAiGenerate} disabled={aiLoading} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5">
                    {aiLoading && <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {aiLoading ? 'Generando...' : 'Generar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-100">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
          <button onClick={handleCreate} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all">Crear API</button>
        </div>
      </div>
    </div>
  )
}
