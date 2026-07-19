import { useState, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { generateCode, countGroups, type CodegenLang } from '../lib/codegen'

interface Props {
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
}

const LANGS: { key: CodegenLang; label: string }[] = [
  { key: 'curl', label: 'cURL' },
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'rust', label: 'Rust' },
]

export function ExportCodePanel({ nodes, edges, onClose }: Props) {
  const [lang, setLang] = useState<CodegenLang>('curl')
  const [resolveVars, setResolveVars] = useState(true)
  const [copied, setCopied] = useState(false)

  const total = useMemo(() => countGroups(nodes, edges), [nodes, edges])

  const code = useMemo(
    () => generateCode(nodes, edges, lang, resolveVars),
    [nodes, edges, lang, resolveVars],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-zinc-200/60 dark:border-zinc-800/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Exportar código</h2>
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
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {total} {total === 1 ? 'endpoint' : 'endpoints'} detectados en el canvas
        </p>
      </div>

      <div className="flex gap-1 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
        {LANGS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              lang === l.key
                ? 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <pre className="text-[11px] font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {code || <span className="text-zinc-400 dark:text-zinc-500">Sin endpoints para exportar</span>}
        </pre>
      </div>

      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={resolveVars}
            onChange={(e) => setResolveVars(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500/30"
          />
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Resolver variables con valores actuales</span>
        </label>
        <button
          onClick={handleCopy}
          className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
            copied
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 dark:hover:bg-zinc-600 active:scale-[0.98]'
          }`}
        >
          {copied ? '✓ Copiado' : 'Copiar código'}
        </button>
      </div>
    </div>
  )
}
