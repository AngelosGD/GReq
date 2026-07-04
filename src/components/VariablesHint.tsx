import { useExecStore } from '../store/execStore'

export function VariablesHint() {
  const responses = useExecStore((s) => s.responses)
  const entries = Object.entries(responses)
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] block mb-1.5">Variables disponibles</label>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {entries.map(([id, res]) => {
          const isJson = res.body.startsWith('{') || res.body.startsWith('[')
          return (
            <details key={id} className="text-[10px]">
              <summary className="cursor-pointer text-zinc-600 hover:text-zinc-800 font-medium">
                {id.slice(0, 8)}
                <span className="text-zinc-400 ml-1">({res.status})</span>
              </summary>
              <div className="mt-1 ml-2 space-y-0.5">
                <code className="block text-zinc-500 font-mono text-[9px]">$prev.status</code>
                <code className="block text-zinc-500 font-mono text-[9px]">$prev.headers.X-*</code>
                {isJson && (
                  <>
                    <code className="block text-zinc-500 font-mono text-[9px]">$prev.body</code>
                    <code className="block text-zinc-500 font-mono text-[9px]">$prev.body.path.to.field</code>
                  </>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
