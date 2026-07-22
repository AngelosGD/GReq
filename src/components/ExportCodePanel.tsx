import { useState, useMemo, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { generateCode, countGroups, getFileExtension, type CodegenLang } from '../lib/codegen'

interface Props {
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
}

const LANGS: { key: CodegenLang; label: string }[] = [
  { key: 'curl', label: 'cURL' },
  { key: 'httpie', label: 'HTTPie' },
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'rust', label: 'Rust' },
]

function highlightCode(code: string, lang: CodegenLang): string {
  const commentChar = lang === 'curl' || lang === 'httpie' || lang === 'python' || lang === 'rust' ? '#' : '//'
  const lines = code.split('\n')
  return lines.map((line) => {
    let h = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    if (h.trimStart().startsWith(commentChar)) {
      const indent = h.match(/^\s*/)?.[0] ?? ''
      const content = h.trimStart().slice(commentChar.length)
      return `<span class="hl-comment">${indent}${commentChar}</span><span class="hl-comment-text">${content}</span>`
    }

    h = h.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="hl-string">$&</span>')
    h = h.replace(/\b(import|from|def|return|if|else|for|while|in|async|await|let|const|var|function|class|new|try|catch|throw|await|yield|typeof|instanceof|void|delete|switch|case|break|continue|fn|mut|pub|struct|enum|impl|trait|use|mod|match|where|as|ref|move|async|await|Result|Some|None|Ok|Err)\b/g, '<span class="hl-keyword">$1</span>')
    h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>')

    return h
  }).join('\n')
}

export function ExportCodePanel({ nodes, edges, onClose }: Props) {
  const [lang, setLang] = useState<CodegenLang>('curl')
  const [resolveVars, setResolveVars] = useState(true)
  const [copied, setCopied] = useState(false)

  const total = useMemo(() => countGroups(nodes, edges), [nodes, edges])

  const code = useMemo(
    () => generateCode(nodes, edges, lang, resolveVars),
    [nodes, edges, lang, resolveVars],
  )

  const highlighted = useMemo(() => highlightCode(code, lang), [code, lang])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }, [code])

  const handleDownload = useCallback(() => {
    const ext = getFileExtension(lang)
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `request.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [code, lang])

  const lineCount = code.split('\n').length

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

      <div className="flex gap-1 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-x-auto">
        {LANGS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
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
        <div
          className="code-block text-[11px] font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 whitespace-pre overflow-x-auto leading-relaxed"
          style={{ counterReset: 'line ' + (lineCount + 1) }}
        >
          {code ? (
            <div className="flex">
              <div className="select-none text-right pr-3 pl-3 py-4 text-zinc-300 dark:text-zinc-600 border-r border-zinc-200 dark:border-zinc-700 leading-relaxed" style={{ minWidth: `${String(lineCount).length + 3}ch` }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-[10px] leading-relaxed">{i + 1}</div>
                ))}
              </div>
              <div className="py-4 pl-3 pr-4 leading-relaxed overflow-x-auto" dangerouslySetInnerHTML={{ __html: highlighted }} />
            </div>
          ) : (
            <div className="p-4 text-zinc-400 dark:text-zinc-500">Sin endpoints para exportar</div>
          )}
        </div>
      </div>

      <style>{`
        .hl-comment { color: #6b7280; }
        .hl-comment-text { color: #9ca3af; }
        .hl-string { color: #059669; }
        .hl-keyword { color: #7c3aed; font-weight: 600; }
        .hl-number { color: #d97706; }
        .dark .hl-string { color: #34d399; }
        .dark .hl-keyword { color: #a78bfa; }
        .dark .hl-number { color: #fbbf24; }
      `}</style>

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
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 dark:hover:bg-zinc-600 active:scale-[0.98]'
            }`}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 active:scale-[0.98] transition-all"
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  )
}
