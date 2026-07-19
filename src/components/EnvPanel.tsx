import { useState } from 'react'
import { useEnvStore } from '../store/envStore'

interface Props {
  onClose: () => void
}

export function EnvPanel({ onClose }: Props) {
  const {
    profiles, activeProfile, setActiveProfile,
    upsertVar, removeVar, renameProfile, addProfile, removeProfile,
  } = useEnvStore()

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const activeVars = profiles.find((p) => p.name === activeProfile)?.vars ?? []

  const handleAdd = () => {
    const key = newKey.trim()
    if (!key) return
    upsertVar(activeProfile, key, newValue.trim())
    setNewKey('')
    setNewValue('')
    setAdding(false)
  }

  const handleAddProfile = () => {
    const name = profileName.trim()
    if (!name) return
    if (addProfile(name)) {
      setActiveProfile(name)
    }
    setProfileName('')
    setEditingProfile(false)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-zinc-200/60 dark:border-zinc-800/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Entornos</h2>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <label className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1.5">Entorno activo</label>
        <div className="flex gap-1.5 flex-wrap">
          {profiles.map((p) => (
            <button
              key={p.name}
              onClick={() => setActiveProfile(p.name)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                activeProfile === p.name
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 border border-transparent'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => { setEditingProfile(true); setProfileName('') }}
            className="px-2 py-1 rounded-lg text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-700"
          >
            + Nuevo
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Variables</span>
            <button
              onClick={() => setAdding(true)}
              className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              + Agregar
            </button>
          </div>

          <div className="space-y-1.5">
            {activeVars.map((v) => (
              <EnvVarRow
                key={v.key}
                envVar={v}
                onUpdate={(key, value) => upsertVar(activeProfile, key, value)}
                onRemove={() => removeVar(activeProfile, v.key)}
              />
            ))}
          </div>

          {activeVars.length === 0 && !adding && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center py-6">Sin variables en este entorno</p>
          )}

          {adding && (
            <div className="mt-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-2">
              <input
                autoFocus
                placeholder="Nombre"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="w-full px-2 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
              <input
                placeholder="Valor"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="w-full px-2 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setAdding(false)} className="px-2 py-1 rounded-md text-[10px] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
                <button onClick={handleAdd} className="px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-600 text-white hover:bg-emerald-700">Agregar</button>
              </div>
            </div>
          )}
        </div>

        {activeVars.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Uso en nodos</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Usá <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono">{`{{nombreVariable}}`}</code> en URL, headers, body o params.
            </p>
          </div>
        )}
      </div>

      {renaming && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim()) {
                  renameProfile(renaming, renameValue.trim())
                  setRenaming(null)
                }
                if (e.key === 'Escape') setRenaming(null)
              }}
              className="flex-1 px-2 py-1 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Nuevo nombre"
            />
            <button onClick={() => setRenaming(null)} className="px-2 py-1 rounded-md text-[10px] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Ok</button>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddProfile()
                if (e.key === 'Escape') setEditingProfile(false)
              }}
              className="flex-1 px-2 py-1 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Nombre del entorno"
            />
            <button onClick={handleAddProfile} className="px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-600 text-white hover:bg-emerald-700">Crear</button>
            <button onClick={() => setEditingProfile(false)} className="px-2 py-1 rounded-md text-[10px] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">X</button>
          </div>
        </div>
      )}

      {profiles.length > 1 && profiles.find((p) => p.name === activeProfile) && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
          <button
            onClick={() => setRenaming(activeProfile)}
            className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Renombrar
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar entorno "${activeProfile}"?`)) {
                removeProfile(activeProfile)
              }
            }}
            className="text-[10px] text-red-400 hover:text-red-600"
          >
            Eliminar entorno
          </button>
        </div>
      )}
    </div>
  )
}

function EnvVarRow({ envVar, onUpdate, onRemove }: {
  envVar: { key: string; value: string }
  onUpdate: (key: string, value: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editKey, setEditKey] = useState(envVar.key)
  const [editValue, setEditValue] = useState(envVar.value)

  if (!editing) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer group transition-colors"
        onClick={() => { setEditKey(envVar.key); setEditValue(envVar.value); setEditing(true) }}
      >
        <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 min-w-[80px] truncate">{envVar.key}</span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex-1">{envVar.value}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
      <input
        autoFocus
        value={editKey}
        onChange={(e) => setEditKey(e.target.value)}
        className="w-20 px-1.5 py-1 text-[11px] font-mono rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        placeholder="key"
      />
      <span className="text-zinc-300 dark:text-zinc-600">=</span>
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="flex-1 px-1.5 py-1 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        placeholder="value"
      />
      <button
        onClick={() => {
          if (editKey.trim()) {
            onUpdate(editKey.trim(), editValue)
          }
          setEditing(false)
        }}
        className="px-1.5 py-1 rounded text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
      >
        Ok
      </button>
    </div>
  )
}
