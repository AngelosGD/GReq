import { useState } from 'react'
import type { Node } from '@xyflow/react'
import { useExecStore } from '../store/execStore'

function simpleDiff(a: string, b: string): { type: 'same' | 'added' | 'removed'; line: string }[] {
  const linesA = a.split('\n')
  const linesB = b.split('\n')
  const maxLen = Math.max(linesA.length, linesB.length)
  const result: { type: 'same' | 'added' | 'removed'; line: string }[] = []
  for (let i = 0; i < maxLen; i++) {
    if (i >= linesA.length) {
      result.push({ type: 'added', line: linesB[i] })
    } else if (i >= linesB.length) {
      result.push({ type: 'removed', line: linesA[i] })
    } else if (linesA[i] === linesB[i]) {
      result.push({ type: 'same', line: linesA[i] })
    } else {
      result.push({ type: 'removed', line: linesA[i] })
      result.push({ type: 'added', line: linesB[i] })
    }
  }
  return result
}

export function ResponseSection({ node, setNodeData }: { node: Node; setNodeData: (id: string, data: Record<string, unknown>) => void }) {
  const [prettify, setPrettify] = useState(false)
  const [diffMode, setDiffMode] = useState(false)
  const [diffTargetA, setDiffTargetA] = useState(0)
  const [diffTargetB, setDiffTargetB] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const history = useExecStore((s) => s.responseHistory[node.id])
  const d = (node.data as Record<string, unknown>) ?? {}
  const responsesList = d.responses as unknown[] | undefined
  const singleRes = d.response as unknown

  const allRes = responsesList ?? (singleRes ? [singleRes] : [])
  if (allRes.length === 0) return null

  const prettyBody = (body: string) => {
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
  }

  return (
    <>
    <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em]">
          {allRes.length > 1 ? `Respuestas (${allRes.length})` : 'Respuesta'}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrettify(!prettify)}
            className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
          >
            {prettify ? 'Crudo' : 'Prettify'}
          </button>
          {allRes.length > 1 && (
            <button
              onClick={() => setDiffMode(!diffMode)}
              className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
            >
              {diffMode ? 'Normal' : 'Diff'}
            </button>
          )}
          {history && history.length > 1 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {history.length}
            </button>
          )}
          <button
            onClick={() => setNodeData(node.id, { response: undefined, responses: undefined })}
            className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
          >
            Limpiar
          </button>
        </div>
      </div>

      {diffMode ? (
        <div>
          <div className="flex gap-2 mb-2">
            <select value={diffTargetA} onChange={(e) => setDiffTargetA(Number(e.target.value))} className="text-[10px] px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              {allRes.map((_, i) => <option key={i} value={i}>Respuesta {i+1}</option>)}
            </select>
            <span className="text-[10px] text-zinc-400 self-center">vs</span>
            <select value={diffTargetB} onChange={(e) => setDiffTargetB(Number(e.target.value))} className="text-[10px] px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              {allRes.map((_, i) => <option key={i} value={i}>Respuesta {i+1}</option>)}
            </select>
          </div>
          <pre className="w-full max-h-96 overflow-auto bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-2.5 text-[10px] font-mono leading-relaxed whitespace-pre-wrap break-all">
            {simpleDiff(
              prettyBody(typeof allRes[diffTargetA] === 'object' && allRes[diffTargetA] !== null ? (allRes[diffTargetA] as any).body ?? '' : ''),
              prettyBody(typeof allRes[diffTargetB] === 'object' && allRes[diffTargetB] !== null ? (allRes[diffTargetB] as any).body ?? '' : ''),
            ).map((line, i) => (
              <div key={i} className={`${line.type === 'added' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : line.type === 'removed' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                <span className="select-none w-4 inline-block text-zinc-300">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                {line.line}
              </div>
            ))}
          </pre>
        </div>
      ) : (

      allRes.map((res: any, idx: number) => {
        const statusColor =
          res.status >= 200 && res.status < 300 ? 'text-emerald-600'
          : res.status >= 300 && res.status < 400 ? 'text-amber-600'
          : res.status >= 400 ? 'text-red-600'
          : 'text-zinc-500'

        const statusBg =
          res.status >= 200 && res.status < 300 ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : res.status >= 300 && res.status < 400 ? 'bg-amber-50 dark:bg-amber-950/30'
          : res.status >= 400 ? 'bg-red-50 dark:bg-red-950/30'
          : 'bg-zinc-50'

        return (
          <div key={idx}>
            {allRes.length > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                <span className="text-[9px] font-medium text-zinc-400">{idx + 1}/{allRes.length}</span>
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
              </div>
            )}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusBg} border border-zinc-200/50 dark:border-zinc-700/50 mb-2`}>
              <span className={`text-xs font-bold ${statusColor}`}>{res.status}</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{res.statusText}</span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 ml-auto font-mono">{res.durationMs}ms</span>
            </div>

            <details className="group mb-2">
              <summary className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors list-none flex items-center gap-1.5">
                <svg className="w-3 h-3 text-zinc-400 group-open:rotate-90 transition-transform duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Headers ({res.headers?.length ?? 0})
              </summary>
              <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto">
                {(res.headers as { key: string; value: string }[] ?? []).map((h: any, i: number) => (
                  <div key={i} className="flex gap-2 text-[9px] font-mono px-2 py-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{h.key}:</span>
                    <span className="text-zinc-700 dark:text-zinc-300 break-all">{h.value}</span>
                  </div>
                ))}
              </div>
            </details>

            <div>
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.1em] block mb-1.5">Body</label>
              <pre className="w-full max-h-60 overflow-auto bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg px-3 py-2.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-all">
                {prettify ? (() => { try { return JSON.stringify(JSON.parse(res.body), null, 2) } catch { return res.body } })() : res.body}
              </pre>
            </div>
          </div>
        )
      })
      )
      }
    </div>

      {showHistory && history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 dark:bg-black/40" onClick={() => setShowHistory(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl shadow-black/8 dark:shadow-black/40 w-[420px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Historial de respuestas</h3>
              <button onClick={() => setShowHistory(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {[...history].reverse().map((res, i) => {
                const statusColor = res.status >= 200 && res.status < 300 ? 'text-emerald-600' : res.status >= 400 ? 'text-red-600' : 'text-amber-600'
                return (
                  <button key={i} onClick={() => { setNodeData(node.id, { response: res, responses: undefined }); setShowHistory(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <span className={`text-xs font-bold ${statusColor}`}>{res.status}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate flex-1">{res.statusText}</span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">{res.durationMs}ms</span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{history.length - i}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
